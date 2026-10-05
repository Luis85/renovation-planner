import { describe, expect, it, vi } from 'vitest';
import { relocateEvidence } from '../../../../src/infrastructure/obsidian/repositories/relocateEvidence';
import { InMemoryPlanRepository } from '../../../../src/infrastructure/persistence/in-memory/InMemoryPlanRepository';
import { InMemoryProjectIndex } from '../../../../src/infrastructure/persistence/index/InMemoryProjectIndex';
import { InMemoryDiagnosticsLedger } from '../../../../src/infrastructure/logging/diagnosticsLedger';
import { createEventBus } from '../../../../src/core/events/EventBus';
import { withPlanRenovation } from '../../../../src/domain/plan/Plan';
import type { PlanId } from '../../../../src/domain/plan/PlanId';
import { EMPTY_DEPTH, type Evidence } from '../../../../src/domain/renovation/PlanningDepth';
import { leftWritesBehind, type UncompensatedWrite } from '../../../../src/application/commands/DispatchOutcome';
import type { AppError } from '../../../../src/core/errors/AppError';
import type { EntityId } from '../../../../src/core/identity/EntityId';
import { err } from '../../../../src/core/result/Result';
import { expectOk, expectDefined } from '../../../helpers/domain';
import { makePlan, makeProject } from '../../../helpers/entities';

/**
 * `relocateEvidence` is a PARTIAL-WRITE path: a host file-rename listener calls it after
 * Obsidian has already moved a user file, it performs one version-conditional `plans.save` per
 * matching plan, and on the first failure at any step it returns immediately — plans already
 * saved stay saved, their events stay published, and plans later in index order are never
 * attempted.
 *
 * ADR-0034 makes "the vault was left half-written" a durable, vault-scoped incident. This path
 * recorded nothing, so a rename that half landed was visible to no user and no gate. These
 * cases pin BOTH arms, because under ADR-0034 a stamp is a vault-wide write block: a stamp
 * raised over a coherent vault is a real cost, not a harmless over-report.
 *
 * **The rig is production code, not a hand-rolled double.** `InMemoryPlanRepository`,
 * `InMemoryProjectIndex` and `createEventBus` all ship in `src/`, so the version conditions,
 * the index ordering and the publish semantics are the real ones; only the failure is
 * injected, with the same `vi.spyOn(...).mockResolvedValueOnce(err(...))` spelling
 * `planningFiles.test.ts` already uses against the Obsidian repository. What the in-memory
 * plan repository cannot be is a repository that REFUSES TO PARSE — it holds entities rather
 * than text — which is an absent subject here rather than a tolerated one: this path's
 * subject is what happens AFTER a save lands, not how a read fails.
 */

const FAILURE = { category: 'Persistence' as const, code: 'test.disk', message: 'offline' };

/**
 * The minimum a `Plan` accepts: one Evidence record with no Work and no cost behind it.
 * `validatePlanningDepth` needs a non-empty `targetId` and a `roomId` that is not the empty
 * string, and `validEvidence` needs a path, a description and a known type and phase — an
 * empty `recordId`/`workId` is legal and skips the cross-record link checks.
 */
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

async function rigOf(...paths: readonly string[]) {
	const plans = new InMemoryPlanRepository();
	const index = new InMemoryProjectIndex();
	const events = createEventBus(() => undefined);
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
	// INDEX order is what the loop walks, so it is what "the second of three" means here.
	index.rebuild(
		ids.map((id, position) => ({
			id: id as EntityId<string>,
			type: 'renovation-plan' as const,
			path: `Renovation/Plan ${String(position)}.md`,
			projectId: project.id,
		})),
		[],
	);
	return { plans, index, events, ids, deps: { plans, index, events, ledger: new InMemoryDiagnosticsLedger() } };
}

const evidencePathOf = async (plans: InMemoryPlanRepository, id: PlanId): Promise<string> =>
	expectDefined(expectOk(await plans.getById(id))?.entity.renovation?.depth?.evidence[0]?.path, 'evidence');

const affectedOf = (error: AppError): readonly unknown[] => (error as Partial<UncompensatedWrite>).uncompensatedWrite ?? [];

describe('a rename that half landed', () => {
	it('stamps a failed SAVE with the plans it had already written', async () => {
		const rig = await rigOf('Evidence/one.pdf', 'Evidence/two.pdf', 'Evidence/three.pdf');
		const save = rig.plans.save.bind(rig.plans);
		// The FIRST save lands, the second refuses, the third is never attempted.
		vi.spyOn(rig.plans, 'save').mockImplementationOnce(save).mockResolvedValueOnce(err(FAILURE));

		const failed = await relocateEvidence(rig.deps, 'Evidence', 'Archive');

		expect(failed.ok).toBe(false);
		if (failed.ok) return;
		expect(leftWritesBehind(failed.error)).toBe(true);
		expect(affectedOf(failed.error)).toEqual([{ entityKind: 'plan', entityId: rig.ids[0] }]);
		// The half-write the stamp is ABOUT: one plan moved, one did not, one was never reached.
		expect(await evidencePathOf(rig.plans, rig.ids[0])).toBe('Archive/one.pdf');
		expect(await evidencePathOf(rig.plans, rig.ids[1])).toBe('Evidence/two.pdf');
		expect(await evidencePathOf(rig.plans, rig.ids[2])).toBe('Evidence/three.pdf');
	});

	/**
	 * The other early return that can follow a landed write. A failed READ leaves the vault
	 * exactly as half-written as a failed save does — the plan before it is already moved —
	 * so the two arms cannot differ, and asserting only the save arm would let a stamp that
	 * lived inside the save branch pass.
	 */
	it('stamps a failed READ that follows a write, not only a failed save', async () => {
		const rig = await rigOf('Evidence/one.pdf', 'Evidence/two.pdf');
		const read = rig.plans.getById.bind(rig.plans);
		vi.spyOn(rig.plans, 'getById').mockImplementationOnce(read).mockResolvedValueOnce(err(FAILURE));

		const failed = await relocateEvidence(rig.deps, 'Evidence', 'Archive');

		expect(failed.ok).toBe(false);
		if (failed.ok) return;
		expect(affectedOf(failed.error)).toEqual([{ entityKind: 'plan', entityId: rig.ids[0] }]);
	});

	/**
	 * The arm that must NOT stamp. Nothing was written, so the vault is coherent — and a stamp
	 * here would pause every guarded write in the vault over a rename that changed nothing.
	 * The refusal has to come back byte-identical, which is also what keeps
	 * `planningFiles.test.ts`'s existing `toEqual(err(failure))` honest.
	 */
	it('stamps NOTHING when the first plan fails, because nothing was written', async () => {
		const rig = await rigOf('Evidence/one.pdf', 'Evidence/two.pdf');
		vi.spyOn(rig.plans, 'save').mockResolvedValueOnce(err(FAILURE));

		const failed = await relocateEvidence(rig.deps, 'Evidence', 'Archive');

		expect(failed).toEqual(err(FAILURE));
		expect(failed.ok).toBe(false);
		if (failed.ok) return;
		expect(leftWritesBehind(failed.error)).toBe(false);
		expect(await evidencePathOf(rig.plans, rig.ids[0])).toBe('Evidence/one.pdf');
	});

	it('stamps NOTHING when every plan is written', async () => {
		const rig = await rigOf('Evidence/one.pdf', 'Evidence/two.pdf');

		expectOk(await relocateEvidence(rig.deps, 'Evidence', 'Archive'));

		expect(await evidencePathOf(rig.plans, rig.ids[0])).toBe('Archive/one.pdf');
		expect(await evidencePathOf(rig.plans, rig.ids[1])).toBe('Archive/two.pdf');
	});
});
