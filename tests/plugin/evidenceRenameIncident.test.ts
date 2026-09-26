// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { evidenceRenamed } from '../../src/plugin/evidenceRename';
import type { CompositionRoot } from '../../src/plugin/composition-root';
import { InMemoryPlanRepository } from '../../src/infrastructure/persistence/in-memory/InMemoryPlanRepository';
import { InMemoryProjectIndex } from '../../src/infrastructure/persistence/index/InMemoryProjectIndex';
import { InMemoryDiagnosticsLedger } from '../../src/infrastructure/logging/diagnosticsLedger';
import { createEventBus } from '../../src/core/events/EventBus';
import { withPlanRenovation } from '../../src/domain/plan/Plan';
import { EMPTY_DEPTH, type Evidence } from '../../src/domain/renovation/PlanningDepth';
import {
	WriteIncidentRegistry,
	activeWriteIncidentRegistry,
	installWriteIncidentRegistry,
} from '../../src/application/incidents/WriteIncidentRegistry';
import { InMemoryWriteIncidentStore } from '../helpers/InMemoryWriteIncidentStore';
import type { EntityId } from '../../src/core/identity/EntityId';
import type { PlanId } from '../../src/domain/plan/PlanId';
import { err } from '../../src/core/result/Result';
import { expectOk } from '../helpers/domain';
import { makePlan, makeProject } from '../helpers/entities';
import { installObsidianDom } from '../helpers/dom';
import { recorder, resetRecorder } from '../helpers/logger';

installObsidianDom();

/**
 * ADR-0034 names `relocateEvidence`'s host-rename listener as one of the three paths OUTSIDE
 * `guardCommand`. Its stamp is recorded where `markUncompensated` makes it (owner ruling 13), so
 * this listener records nothing itself — and the count below is what tells those apart: a
 * listener still recording beside the stamp would open TWO incidents for one half-landed rename.
 * The case lives here rather than beside the repository because it is the listener's composition
 * that is under test, the registry installed and the hold taken around the relocation.
 */

const FAILURE = { category: 'Persistence' as const, code: 'test.disk', message: 'offline' };

const evidenceAt = (id: string, path: string): Evidence => ({
	id,
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

async function rootOf(...paths: readonly string[]) {
	const plans = new InMemoryPlanRepository();
	const index = new InMemoryProjectIndex();
	const project = makeProject();
	const ids: PlanId[] = [];
	for (const [position, path] of paths.entries()) {
		const plan = expectOk(
			withPlanRenovation(makePlan({ projectId: project.id, name: `Plan ${String(position)}` }), {
				subjects: [],
				work: [],
				decisions: [],
				depth: { ...EMPTY_DEPTH, evidence: [evidenceAt(`evidence-${String(position)}`, path)] },
			}),
		);
		expectOk(await plans.save(plan, 'absent'));
		ids.push(plan.id);
	}
	index.rebuild(
		ids.map((id, position) => ({
			id: id as EntityId<string>,
			type: 'renovation-plan' as const,
			path: `Renovation/Plan ${String(position)}.md`,
			projectId: project.id,
		})),
		[],
	);
	// The members `evidenceRenamed` actually reaches, NAMED rather than left to a bare
	// `{} as CompositionRoot`: `tests/plugin/diagnostics/diagnosticsReportDoors.test.ts` shipped
	// a snapshot literal missing a required field precisely because its cast accepted anything.
	const vaultDeps = { ledger: new InMemoryDiagnosticsLedger() };
	const root = { logger: recorder, eventBus: createEventBus(() => undefined), persistence: { plans, index, vaultDeps } } as unknown as CompositionRoot;
	return { plans, index, ids, root };
}

describe('the host-rename listener, which no guard sits in front of', () => {
	afterEach(() => {
		installWriteIncidentRegistry(null);
		resetRecorder();
	});

	it('records the incident the stamp carried, naming the plans already written', async () => {
		const rig = await rootOf('Evidence/one.pdf', 'Evidence/two.pdf');
		const registry = new WriteIncidentRegistry(new InMemoryWriteIncidentStore(), recorder, 'plugins/rp/write-incidents.json');
		installWriteIncidentRegistry(registry);
		const save = rig.plans.save.bind(rig.plans);
		vi.spyOn(rig.plans, 'save').mockImplementationOnce(save).mockResolvedValueOnce(err(FAILURE));

		await evidenceRenamed(rig.root, 'Evidence', 'Archive');

		expect(registry.report().open).toHaveLength(1);
		expect(registry.report().open[0]).toMatchObject({
			code: 'test.disk',
			category: 'Persistence',
			affected: [{ entityKind: 'plan', entityId: rig.ids[0] }],
		});
	});

	it('records NOTHING when the refusal left no write behind', async () => {
		const rig = await rootOf('Evidence/one.pdf', 'Evidence/two.pdf');
		const registry = new WriteIncidentRegistry(new InMemoryWriteIncidentStore(), recorder, 'plugins/rp/write-incidents.json');
		installWriteIncidentRegistry(registry);
		vi.spyOn(rig.plans, 'save').mockResolvedValueOnce(err(FAILURE));

		await evidenceRenamed(rig.root, 'Evidence', 'Archive');

		expect(registry.anyOpen()).toBe(false);
	});

	/**
	 * The THROW arm of the hold `evidenceRenamed` takes for its whole relocation (owner ruling 16):
	 * a relocation that throws rather than refusing must still release it, or a later teardown
	 * would wait on a rename that already ended and keep a clean record installed.
	 */
	it('releases its hold when the relocation throws', async () => {
		const rig = await rootOf('Evidence/one.pdf');
		const registry = new WriteIncidentRegistry(new InMemoryWriteIncidentStore(), recorder, 'plugins/rp/write-incidents.json');
		installWriteIncidentRegistry(registry);
		vi.spyOn(rig.index, 'getIdsByType').mockImplementation(() => {
			throw new Error('index gone');
		});

		await expect(evidenceRenamed(rig.root, 'Evidence', 'Archive')).resolves.toBeUndefined();

		let idle = false;
		registry.whenIdle(() => {
			idle = true;
		});
		expect(idle).toBe(true);
	});

	/**
	 * No registry installed — a root composed without a session — must not turn a refusal into
	 * a crash. The accessor answers `null` and the optional call is the whole of the handling;
	 * the user still gets the operation-failure notice.
	 */
	it('survives a half-landed rename with no registry installed', async () => {
		const rig = await rootOf('Evidence/one.pdf', 'Evidence/two.pdf');
		const save = rig.plans.save.bind(rig.plans);
		vi.spyOn(rig.plans, 'save').mockImplementationOnce(save).mockResolvedValueOnce(err(FAILURE));

		await expect(evidenceRenamed(rig.root, 'Evidence', 'Archive')).resolves.toBeUndefined();
		expect(activeWriteIncidentRegistry()).toBeNull();
	});
});
