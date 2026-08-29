/**
 * @vitest-environment jsdom
 *
 * `runtime.ts`'s `undo`/`redo` used to pass a resolved `Result` straight through
 * `reportFault`, which notifies only on a THROW — an expected refusal that resolves
 * instead (SDD §65) fell straight through, and `CommandHistory.undoNow`/`redoNow`
 * deliberately leave a refused entry on its stack rather than popping it, so the button
 * stayed enabled, did nothing, and said nothing.
 *
 * This slice made the refusal reachable: `ReversibleMoveZoneCommand` (and
 * `ReversibleCalibratePlanCommand`) take their `expected` version from the shared
 * `WriteLedger`, not from a memory of their own, so anything else that touches the same
 * zone between a command's write and its later undo/redo makes that undo/redo stale.
 *
 * `editorFaults.test.ts` covers the THROW half of this seam (`reportFault` catching an
 * unexpected fault); this file covers the resolved-but-failed half.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { Notice } from 'obsidian';
import { expectOk } from '../../helpers/domain';
import { pointer, rig, toolbarButton, type Rig } from '../../helpers/planEditorRig';
import { settle } from '../../helpers/editor';
import { activateNotices } from '../../../src/presentation/notices/notify';
import { installObsidianDom } from '../../helpers/dom';

// `activateNotices` — reached here through the real plugin/editor wiring — appends its
// two live regions with Obsidian's `createDiv`, one of the prototype extensions the app
// installs globally and this suite installs per file.
installObsidianDom();

/**
 * Rewrites zone-a with its OWN current state, through the repository directly rather than
 * through the editor's dispatcher — standing in for a second leaf's or a synced file's own
 * write landing between the editor's dispatch and its later undo/redo. The geometry is
 * unchanged; only the store's revision moves, which is enough to make the ledger's
 * memory of "what this command last wrote" stale.
 */
async function externallyTouchZoneA(zonesRepo: Rig['zonesRepo']): Promise<void> {
	const loaded = expectOk(await zonesRepo.getById('zone-a' as never));
	if (loaded === null) throw new Error('expected zone-a to exist');
	expectOk(await zonesRepo.save(loaded.entity, loaded.version));
}

/** Selects zone-a and drags it +600mm on x (+60 screen px) — the same gesture
 * `zoneEditing.test.ts`'s move case drives, extracted here for two more callers. */
async function moveZoneA(harness: Rig['harness']): Promise<void> {
	const canvas = harness.canvasEl;
	if (canvas === null) throw new Error('expected a mounted canvas');
	toolbarButton(harness, 'Select').click();
	await settle();
	pointer(canvas, 'pointerdown', 200, 200);
	pointer(canvas, 'pointermove', 230, 200);
	pointer(canvas, 'pointermove', 260, 200);
	pointer(canvas, 'pointerup', 260, 200);
	await settle();
}

/**
 * A notice is INERT until something activates the queue — `onload` is what does that in
 * production, so a suite asserting on `Notice.shown` has to stand where the plugin stands.
 * Per TEST, and for a second reason: the queue DEDUPS, so two cases raising the identical
 * sentence would fold into one `(×2)` and construct no second `Notice` at all.
 */
beforeEach(() => {
	activateNotices();
});

describe('a refused undo', () => {
	it('is reported, and leaves the command on the undo stack rather than doing nothing', async () => {
		const { harness, zonesRepo } = await rig();
		await moveZoneA(harness);

		const movedPoint = expectOk(await zonesRepo.getById('zone-a' as never))?.entity.geometry
			.points[0];
		expect(movedPoint).toEqual({ x: 2100, y: 1500 });

		// Something else touches the same zone before Undo runs — `ReversibleMoveZoneCommand`'s
		// own header names exactly this: "the expectation is the history's, not the adapter's".
		await externallyTouchZoneA(zonesRepo);

		const noticesBefore = Notice.shown.length;
		const undoButton = toolbarButton(harness, 'Undo');
		expect(undoButton.disabled).toBe(false);
		undoButton.click();
		await settle();

		// Told, not swallowed — the same seam every refused gesture already reports through.
		expect(Notice.shown.length).toBe(noticesBefore + 1);
		// Retryable: `CommandHistory.undoNow` leaves a refused undo ON the stack rather than
		// popping it, so the button stays enabled rather than silently going stale.
		expect(undoButton.disabled).toBe(false);
		// And nothing was actually undone: the moved geometry is still what is on the vault.
		expect(
			expectOk(await zonesRepo.getById('zone-a' as never))?.entity.geometry.points[0],
		).toEqual(movedPoint);

		harness.unmount();
	});
});

describe('a refused redo', () => {
	it('is reported, and leaves the command on the redo stack rather than doing nothing', async () => {
		const { harness, zonesRepo } = await rig();
		await moveZoneA(harness);

		// A clean undo first — nothing has touched the zone yet, so this one succeeds and
		// moves the command onto the redo stack.
		const undoButton = toolbarButton(harness, 'Undo');
		undoButton.click();
		await settle();
		expect(
			expectOk(await zonesRepo.getById('zone-a' as never))?.entity.geometry.points[0],
		).toEqual({ x: 1500, y: 1500 });

		// Now something else touches the zone before Redo runs.
		await externallyTouchZoneA(zonesRepo);

		const noticesBefore = Notice.shown.length;
		const redoButton = toolbarButton(harness, 'Redo');
		expect(redoButton.disabled).toBe(false);
		redoButton.click();
		await settle();

		expect(Notice.shown.length).toBe(noticesBefore + 1);
		expect(redoButton.disabled).toBe(false);
		// The redo never landed: the zone is still where the undo left it.
		expect(
			expectOk(await zonesRepo.getById('zone-a' as never))?.entity.geometry.points[0],
		).toEqual({ x: 1500, y: 1500 });

		harness.unmount();
	});
});
