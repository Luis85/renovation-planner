import { describe, expect, it, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { leftWritesBehind } from '../../../../src/application/commands/DispatchOutcome';
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
