import { afterEach, describe, expect, it, beforeEach, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { AppError } from '../../../../src/core/errors/AppError';
import { ok } from '../../../../src/core/result/Result';
import { leftWritesBehind, type DispatchOutcome, type DispatchResult } from '../../../../src/application/commands/DispatchOutcome';
import { guardCommand, WRITES_PAUSED_CODE } from '../../../../src/application/errors/guardAgainstThrowing';
import type { VaultExceptionMapper } from '../../../../src/application/errors/exceptionMapper';
import { persistenceError } from '../../../../src/application/errors';
import { installWriteIncidentRegistry } from '../../../../src/application/incidents/WriteIncidentRegistry';
import { ReversibleDeleteZoneCommand } from '../../../../src/application/commands/zone/reversible-delete-zone-command';
import { SessionWriteLedger } from '../../../../src/application/editor/WriteLedger';
import { projectFolderOf, sidecarPathFor } from '../../../../src/infrastructure/obsidian/repositories/paths';
import { createPlanId } from '../../../../src/domain/plan/PlanId';
import { createProjectId } from '../../../../src/domain/project/ProjectId';
import { createZoneId } from '../../../../src/domain/zone/ZoneId';
import { CommandHistory } from '../../../../src/presentation/editor/tools/command-history';
import { useSaveStateStore } from '../../../../src/presentation/editor/save-state/save-state-store';
import { withSaveStateTracking } from '../../../../src/presentation/editor/save-state/with-save-state-tracking';
import { expectErr, expectFound, expectOk, RecordingEventBus } from '../../../helpers/domain';
import { makePlan, makeProject, makeZone } from '../../../helpers/entities';
import { makeDeleteZoneCommand, zoneUndoDeps } from '../../../helpers/slice10';
import { createRepositoryStack } from '../../../helpers/vault';
import { recorder } from '../../../helpers/logger';
import { installOpenWriteIncident } from '../../../helpers/writeIncidents';

/**
 * The boundary's own mapper, for the guarded door the second describe below composes. It maps a
 * THROWN fault, which nothing here throws — it is present because `guardCommand` requires one,
 * the way production's does, rather than because a case reaches it.
 */
const threw: VaultExceptionMapper = (cause) => ({ ...persistenceError('vault.threw', 'threw', cause), technicalFault: true });

/**
 * **Zone delete is the ONE newly-stamped repository path that reaches a live gate, and this
 * is the whole of it driven end to end.** `ObsidianZoneRepository.delete` stamps
 * `zone.sidecar-remove-uncompensated` with `markUncompensated`; the Plan editor is the one
 * surface that wraps its dispatcher in `withSaveStateTracking`, which asks
 * `leftWritesBehind` and calls `markUnrecovered()` — and `markUnrecovered` is what blocks
 * further edits in that tab (`runtime.ts`'s `unsafeHistory`/`writesBlocked`). The four other
 * newly-stamped paths reach no such surface today, so this case is not a sample of a family:
 * it is the only member with a reader.
 *
 * **Every hop between the two ends is the REAL one, because the hazard is a re-wrap.**
 * `markUncompensated` returns a COPY, so any layer that rebuilds the error instead of passing
 * it along by identity silently drops the flag, and each of these hops had the opportunity:
 * `deleteResolution.compensate` (which re-stamps or returns `cause` untouched),
 * `DeleteZoneCommand`, `ReversibleDeleteZoneCommand.execute`, `CommandHistory.runNow`. A
 * hand-built double standing in for any of them would assert the wrapper reads a flag
 * somebody handed it, which nobody doubted, rather than that the flag arrives.
 *
 * The repository failure is the same injected pair `errorPaths.test.ts` drives for this arm:
 * the sidecar mutation refuses, so the trashed note has to come back, and the restore's
 * `create` refuses too.
 */

async function deletingZoneWithBothWritesFailing() {
	const stack = createRepositoryStack();
	const projectId = createProjectId();
	const planId = createPlanId();
	expectOk(await stack.projects.save(makeProject({ id: projectId }), 'absent'));
	expectOk(await stack.plans.save(makePlan({ id: planId, projectId }), 'absent'));
	const zoneId = createZoneId();
	expectOk(await stack.zones.save(makeZone({ id: zoneId, projectId, planId }), 'absent'));
	expectFound(await stack.zones.getById(zoneId));

	const folder = projectFolderOf(stack.index, projectId);
	if (folder === undefined) throw new Error(`no folder indexed for project ${projectId}`);
	const notePath = stack.index.getPath(zoneId) ?? '';
	expect(notePath).not.toBe('');

	const events = new RecordingEventBus();
	const command = new ReversibleDeleteZoneCommand(
		makeDeleteZoneCommand(stack.zones, events),
		stack.zones,
		new SessionWriteLedger(),
		{ zoneId },
		zoneUndoDeps(),
	);
	const saveState = useSaveStateStore();
	const history = withSaveStateTracking(new CommandHistory(), saveState);
	return { stack, command, history, saveState, notePath, sidecarPath: sidecarPathFor(folder, planId) };
}

describe('an uncompensated repository write and the Plan editor incident', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
	});

	it('raises the unrecovered-write incident when the note restore fails too', async () => {
		const w = await deletingZoneWithBothWritesFailing();
		w.stack.vault.failures.add(`modify:${w.sidecarPath}`);
		w.stack.vault.failures.add(`create:${w.notePath}`);

		const refusal = expectErr(await w.history.run(w.command));

		// The stamp arrived intact at the far end of four hops that each rebuild a Result.
		expect(refusal.code).toBe('zone.sidecar-remove-uncompensated');
		expect(leftWritesBehind(refusal)).toBe(true);
		expect(w.saveState.unrecoveredWrite).toBe(true);
		expect(w.saveState.state).toBe('save-error');
		// ...over a vault that really is in the state the incident claims.
		expect(w.stack.vault.entries.has(w.notePath)).toBe(false);
	});

	/**
	 * The control, and it is not optional. A `save-error` alone is equally true of a build
	 * where the stamp never survives: `withSaveStateTracking` resolves any `Persistence`
	 * refusal to `save-error` whether or not `leftWritesBehind` answered. Only
	 * `unrecoveredWrite` separates the two, so a compensated failure must leave it FALSE
	 * while the indicator still reports the error.
	 */
	it('leaves the incident unraised when the compensation puts the note back', async () => {
		const w = await deletingZoneWithBothWritesFailing();
		w.stack.vault.failures.add(`modify:${w.sidecarPath}`);

		const refusal = expectErr(await w.history.run(w.command));

		expect(refusal.code).toBe('zone.sidecar-remove-failed');
		expect(leftWritesBehind(refusal)).toBe(false);
		expect(w.saveState.unrecoveredWrite).toBe(false);
		expect(w.saveState.state).toBe('save-error');
		expect(w.stack.vault.entries.has(w.notePath)).toBe(true);
	});
});

/**
 * **The OTHER direction: the incident was raised somewhere else, and this leaf has to find
 * out.** Seeding (`save-state-store.ts`) closes the case where a pane OPENS after an incident.
 * It cannot close the case where the pane was already open: `WriteIncidentRegistry` publishes
 * nothing when `record()` runs, so a mounted leaf's computed never re-evaluates and its
 * controls stay drawn as if writing were still allowed.
 *
 * What DOES reach it is its next write. `guardCommand` refuses that before the command runs and
 * returns `WRITES_PAUSED_CODE` (ADR-0034's gate), and the refusal travels back up the same
 * dispatcher every gesture in the leaf goes through — which is this decorator.
 *
 * **Driven through the REAL `guardCommand`, and that is the point of the case rather than
 * ceremony.** A hand-built `persistenceError(WRITES_PAUSED_CODE, …)` would assert that the
 * decorator reads a code somebody handed it, which nobody doubted. Composing the real gate
 * asserts that the code the gate actually produces is the code the decorator actually matches —
 * the two are spelled in different layers and nothing but this pairing holds them together.
 */
describe('a leaf already open when the vault-wide gate refuses its next write', () => {
	// **Its OWN Pinia, and this is not ceremony.** The file's other `beforeEach` is scoped inside
	// the first describe, so without this one `useSaveStateStore()` below resolved against
	// whatever Pinia the previous case left active — an already-exercised store — and the opening
	// `expect(...unrecoveredWrite).toBe(false)` guard, whose whole job is to establish "this store
	// was seeded clean, exactly as an already-open pane is", was asserted against it. Run alone
	// the case died with `"getActivePinia()" was called but there was no active Pinia`. CLAUDE.md's
	// own rule for this shape: a case whose pass depends on which sibling ran first is not a case
	// anybody has checked.
	beforeEach(() => {
		setActivePinia(createPinia());
	});

	afterEach(() => {
		installWriteIncidentRegistry(null);
	});

	it('marks the leaf on the gate’s own refusal code, so an already-mounted pane catches up', async () => {
		// Built BEFORE the incident exists, which is the whole subject: this store was seeded
		// clean, exactly as a pane that was already open when a peer raised the incident is.
		const saveState = useSaveStateStore();
		const history = withSaveStateTracking(new CommandHistory(), saveState);
		expect(saveState.unrecoveredWrite).toBe(false);

		await installOpenWriteIncident();
		const wrote = vi.fn<() => Promise<DispatchResult>>(() => Promise.resolve(ok<DispatchOutcome>('wrote')));
		const guarded = guardCommand<void, DispatchOutcome, AppError>({ execute: wrote }, 'command.test.failed', recorder, threw);

		const refusal = expectErr(
			await history.run({ execute: () => guarded.execute(undefined), undo: () => guarded.execute(undefined) }),
		);

		expect(refusal.code).toBe(WRITES_PAUSED_CODE);
		expect(saveState.unrecoveredWrite).toBe(true);
		// **The VAULT's fact and not this leaf's**, which is the half a single shared ref could not
		// express. A gate refusal says an incident exists somewhere in the vault; it says nothing
		// about whether THIS leaf ever wrote. Marking the leaf here persisted a stranger's incident
		// into `PlanEditorView`'s view state, where nothing can clear it, and took a READ retry off
		// `DraftRecovery.vue` — both driven as cases of their own, in
		// `tests/presentation/views/planEditorIncident.test.ts` and
		// `tests/presentation/editor/usability/i13-save-recovery.test.ts`.
		expect(saveState.vaultWritesPaused).toBe(true);
		expect(saveState.leafUnrecoveredWrite).toBe(false);
		// The gate refuses BEFORE the command, so the leaf pauses over a vault this write never
		// touched — a refusal after the write would be the same code over a different vault.
		expect(wrote).not.toHaveBeenCalled();
	});
});
