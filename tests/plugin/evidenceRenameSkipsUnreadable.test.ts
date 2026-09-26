// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { evidenceRenamed } from '../../src/plugin/evidenceRename';
import type { CompositionRoot } from '../../src/plugin/composition-root';
import { installWriteIncidentRegistry } from '../../src/application/incidents/WriteIncidentRegistry';
import { activateNotices, disposeNotices } from '../../src/presentation/notices/notify';
import { createEventBus } from '../../src/core/events/EventBus';
import { err } from '../../src/core/result/Result';
import { withPlanRenovation, type Plan } from '../../src/domain/plan/Plan';
import { EMPTY_DEPTH, type Evidence } from '../../src/domain/renovation/PlanningDepth';
import { createRepositoryStack, parseFrontmatter, serializeFrontmatter } from '../helpers/vault';
import { makePlan, makeProject } from '../helpers/entities';
import { expectDefined, expectOk } from '../helpers/domain';
import { installObsidianDom } from '../helpers/dom';
import { recorder } from '../helpers/logger';
import { installQuietWriteIncidents } from '../helpers/writeIncidents';
// Mock-only surface (`Notice.shown`), imported BY NAME, as `assetPriceNoticeWiring.test.ts` does.
import { Notice } from '../helpers/obsidian-mock';

installObsidianDom();
// A notice is inert until the queue is activated (`onload` does it in production), and the
// queue dedups, so it is activated per test.
beforeEach(() => {
	activateNotices();
});
afterEach(() => {
	vi.restoreAllMocks();
	installWriteIncidentRegistry(null);
	disposeNotices();
});

/**
 * Owner ruling 14 (census #23): a rename updates every READABLE plan's evidence links and leaves
 * an unreadable plan as it is — the way `ObsidianPlanRepository.listByProject` already treats
 * one — naming it in the diagnostics ledger rather than opening a vault-wide write incident or
 * raising a failure notice for a rename that succeeded.
 *
 * The rig is the real Obsidian plan repository over the fake vault, because the three states
 * are PARSE refusals, which the in-memory repository cannot produce. Both index orders are
 * driven: with the unreadable plan LAST the old loop stamped the plan it had correctly updated;
 * with it FIRST the old loop never updated the readable plan at all.
 */

const UNREADABLE = ['plan.schema-version-malformed', 'plan.schema-version-unsupported', 'plan.sidecar-unreadable'] as const;
type Unreadable = (typeof UNREADABLE)[number];

const evidenceAt = (path: string): Evidence => ({
	id: 'evidence-1',
	roomId: 'room-1',
	targetId: 'room-1',
	workId: '',
	recordId: '',
	path,
	subpath: '',
	description: 'Invoice',
	type: 'document',
	phase: 'during',
	pin: null,
});

type Slot = 'readable' | 'broken' | 'third';

async function vaultWith(code: Unreadable, order: readonly Slot[]) {
	const registry = installQuietWriteIncidents();
	const stack = createRepositoryStack();
	const project = makeProject();
	expectOk(await stack.projects.save(project, 'absent'));
	const citing = (name: string, path = 'Evidence/one.pdf') =>
		expectOk(
			withPlanRenovation(makePlan({ projectId: project.id, name }), {
				subjects: [],
				work: [],
				decisions: [],
				depth: { ...EMPTY_DEPTH, evidence: [evidenceAt(path)] },
			}),
		);
	// The unreadable plan CITES the renamed path too, so "left as it is" is a real claim.
	const plans = { readable: citing('Readable'), broken: citing('Broken'), third: citing('Third', 'Evidence/two.pdf') };
	const { readable, broken } = plans;
	for (const slot of order) expectOk(await stack.plans.save(plans[slot], 'absent'));
	const notePath = expectDefined(stack.index.getPath(broken.id), 'broken note');
	const sidecarPath = expectDefined(stack.index.getGeometrySidecarPath(broken.id), 'broken sidecar');
	if (code === 'plan.sidecar-unreadable') stack.vault.entries.delete(sidecarPath);
	else {
		const { frontmatter, body } = parseFrontmatter(stack.vault.entries.get(notePath) ?? '');
		const version = code === 'plan.schema-version-unsupported' ? 999 : 'not-a-number';
		stack.vault.entries.set(notePath, serializeFrontmatter({ ...frontmatter, 'schema-version': version }) + body);
	}
	stack.metadataCache.catchUp();
	// Preconditions, so a case cannot pass by driving a different state than it names.
	const refused = await stack.plans.getById(broken.id);
	expect(refused.ok ? 'readable' : refused.error.code).toBe(code);
	expect(stack.index.getIdsByType('renovation-plan')).toEqual(order.map(slot => plans[slot].id));
	const brokenFiles = () => [stack.vault.entries.get(notePath), stack.vault.entries.get(sidecarPath)];
	const root = {
		logger: recorder,
		eventBus: createEventBus(() => undefined),
		persistence: { plans: stack.plans, index: stack.index, vaultDeps: stack.deps },
	} as unknown as CompositionRoot;
	return { stack, registry, root, readable, broken, brokenFiles };
}

const evidencePathOf = async (rig: Awaited<ReturnType<typeof vaultWith>>, plan: Plan) =>
	expectOk(await rig.stack.plans.getById(plan.id))?.entity.renovation?.depth?.evidence[0]?.path;

describe('a rename while one plan is unreadable', () => {
	for (const code of UNREADABLE) {
		for (const unreadableFirst of [false, true]) {
			it(`${code}, unreadable plan ${unreadableFirst ? 'first' : 'last'}: updates the readable plan, skips the other, pauses nothing`, async () => {
				const rig = await vaultWith(code, unreadableFirst ? ['broken', 'readable'] : ['readable', 'broken']);
				const before = rig.brokenFiles();
				const notices = Notice.shown.length;

				await evidenceRenamed(rig.root, 'Evidence', 'Archive');

				expect(await evidencePathOf(rig, rig.readable)).toBe('Archive/one.pdf');
				expect(rig.brokenFiles()).toEqual(before);
				expect(rig.registry.anyOpen()).toBe(false);
				expect(Notice.shown.slice(notices)).toEqual([]);
				expect(rig.stack.ledger.issues()).toContainEqual({ entityType: 'plan', entityId: rig.broken.id, issue: code });
			});
		}
	}

	it('raises no failure notice for a rename no plan cites', async () => {
		const rig = await vaultWith('plan.schema-version-malformed', ['broken', 'readable']);
		const notices = Notice.shown.length;

		await evidenceRenamed(rig.root, 'Photos/cat.jpg', 'Photos/dog.jpg');

		expect(Notice.shown.slice(notices)).toEqual([]);
		expect(rig.registry.anyOpen()).toBe(false);
	});

	/**
	 * The truthful stamp is not swallowed by the skip. The readable plan is saved and a THIRD,
	 * readable plan's save is refused: a genuine half-write, so it still stamps (naming the plan
	 * written, carrying the SAVE's cause) and is still recorded — whether the unreadable plan
	 * sits AFTER the refusal (the POSITIVE CONTROL, green before and after this change) or
	 * BETWEEN the two (where the old loop stopped at the unreadable plan and stamped its code).
	 */
	for (const order of [['readable', 'third', 'broken'], ['readable', 'broken', 'third']] as const) {
		it(`still stamps and records a refused save after one landed (${order.join(', ')})`, async () => {
			const rig = await vaultWith('plan.sidecar-unreadable', order);
			const save = rig.stack.plans.save.bind(rig.stack.plans);
			const failure = { category: 'Persistence' as const, code: 'test.disk', message: 'offline' };
			vi.spyOn(rig.stack.plans, 'save').mockImplementationOnce(save).mockResolvedValueOnce(err(failure));
			const notices = Notice.shown.length;

			await evidenceRenamed(rig.root, 'Evidence', 'Archive');

			expect(rig.registry.report().open).toEqual([
				expect.objectContaining({ code: 'test.disk', affected: [{ entityKind: 'plan', entityId: rig.readable.id }] }),
			]);
			expect(Notice.shown.length).toBe(notices + 1);
		});
	}
});
