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
import { nextTick } from 'vue';
// Mock-only surface, imported BY NAME. `Notice` carries members
// the real `obsidian` module does not declare (`shown`, `constructed`, `opened`, `choose`), so reaching them through the
// `'obsidian'` specifier type-checks against a surface that has no such thing. The
// vitest alias points that specifier at this very file, so this is the SAME class and
// the same statics — proven, not assumed — and the import now says which surface it
// wants.
import { Notice } from '../../helpers/obsidian-mock';
import { expectOk } from '../../helpers/domain';
import { click, pointer, rig, toolbarButton, type Rig } from '../../helpers/planEditorRig';
import { mountPlanEditor, runtimeOf, settle } from '../../helpers/editor';
import { fakeQueries, FIXTURE_PLAN, FIXTURE_ZONES } from '../../helpers/planFixtures';
import type { ZoneDto } from '../../../src/presentation/read-models/PlanDto';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';
import { useProjectStore } from '../../../src/presentation/stores/ProjectStore';
import { useSelectionStore } from '../../../src/presentation/editor/selection/selection-store';
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
/**
 * The save indicator's label element, which since design slice 17 is where a refused
 * autosave-path write is reported — the toast door no longer carries it.
 */
function saveStateLabel(harness: Rig['harness']): HTMLElement {
	const label = harness.wrapper.find('.rp-save-state-label');
	if (!label.exists()) throw new Error('expected the save-state indicator to be mounted');
	return label.element as HTMLElement;
}

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

		// **Told, not swallowed — and design slice 17 changed WHICH surface tells them.** An
		// undo is a write like any other (`withSaveStateTracking` wraps `undo` and `redo` for
		// exactly that reason), so its refusal is an `autosave-write` origin and the table sends
		// it to the save indicator, which is already on screen for this plan. The toast is
		// deliberately NOT also raised: one failure reported through two widgets is two widgets
		// that can drift apart, which is what that slice's Definition of Done forbids by name.
		//
		// Both halves are asserted, and the pairing is the point — "the indicator flipped" is
		// equally true of a build that toasts as well, which is the defect this replaced.
		expect(saveStateLabel(harness).classList.contains('rp-save-state-save-error')).toBe(true);
		expect(Notice.shown.length).toBe(noticesBefore);
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

		// The same slice 17 rule as the refused undo above, through the redo door.
		expect(saveStateLabel(harness).classList.contains('rp-save-state-save-error')).toBe(true);
		expect(Notice.shown.length).toBe(noticesBefore);
		expect(redoButton.disabled).toBe(false);
		// The redo never landed: the zone is still where the undo left it.
		expect(
			expectOk(await zonesRepo.getById('zone-a' as never))?.entity.geometry.points[0],
		).toEqual({ x: 1500, y: 1500 });

		harness.unmount();
	});

	it('leaves Undo DISABLED until there is something to undo, which nothing asserted', async () => {
		const { harness } = await rig();
		const canvas = harness.canvasEl;
		if (canvas === null) throw new Error('expected a mounted canvas');

		toolbarButton(harness, 'Select').click();
		await settle();

		// Every other assertion on this control in the suite is `disabled === false`. A
		// binding that lost its condition — an Undo always live — satisfies all of them and
		// offers the user a control for a history that does not exist.
		expect(toolbarButton(harness, 'Undo').disabled).toBe(true);

		click(canvas, 200, 200);
		await settle();

		// A plain selection is not a command: still nothing to undo.
		expect(toolbarButton(harness, 'Undo').disabled).toBe(true);

		harness.unmount();
	});

});

describe('Select is the default tool (Task 10)', () => {
	it('activates Select once the plan becomes ready, and a refresh that keeps status ready does not re-arm it', async () => {
		// `rig()` awaits hydration to `'ready'` before handing the harness back, so the
		// transition INTO `'ready'` has already happened by this line — Select is what a fresh
		// Plan Editor leaf opens onto rather than camera mode.
		const { harness } = await rig();

		expect(toolbarButton(harness, 'Select').getAttribute('aria-pressed')).toBe('true');

		toolbarButton(harness, 'Draw zone').click();
		await settle();
		expect(toolbarButton(harness, 'Draw zone').getAttribute('aria-pressed')).toBe('true');

		// `PlanEditorRoot` subscribes a plain re-hydration to `onPlanChanged`, and
		// `ProjectStore.hydrate` only sets `status = 'loading'` when it was not already
		// `'ready'` — so this refresh never actually CHANGES `status`, Vue's `watch` never
		// invokes its callback for a same-value write, and the tool the user chose survives it
		// without the watch needing to ask what the status used to be.
		harness.changePlan();
		await settle();
		expect(toolbarButton(harness, 'Draw zone').getAttribute('aria-pressed')).toBe('true');

		harness.unmount();
	});
});

/**
 * `EditorRuntime.selectAndFrame` (design slice 12): the list-framing seam a room-list row
 * dispatches through — select the id and fit the camera to its bounds through
 * `EditorStore.fitTo`, unless there is nothing to fit or nowhere to fit it into.
 *
 * `mountPlanEditor()` mounts the real canvas over `FIXTURE_PLAN`/`FIXTURE_ZONES`
 * (`zone-kitchen`, `zone-terrace`), which is what wires `EditorSurface`'s resize observer —
 * so `editor.stageSize` is already the harness's own 800×600 by the time these cases run,
 * the same way a real leaf's would be after its first layout.
 */
describe('selectAndFrame (Task 12: list framing)', () => {
	it('selects the id and moves the camera onto it', async () => {
		const harness = await mountPlanEditor();
		const runtime = runtimeOf(harness);
		const editor = useEditorStore();
		const before = editor.viewport;

		runtime.selectAndFrame('zone-kitchen');

		expect(useSelectionStore().selectedIds.map(String)).toEqual(['zone-kitchen']);
		expect(editor.viewport).not.toEqual(before);
		harness.unmount();
	});

	/**
	 * `boundsOfZones` answers `null` for a zone with NO points at all — the case its own
	 * docblock means by "nothing to frame" — which is a different arm of `selectAndFrame`
	 * from `fitTo`'s own doubly-degenerate handling (a single-point extent, still a valid
	 * bounding box) that `EditorStore`'s own tests already cover.
	 */
	it('on a degenerate record selects it and leaves the camera alone', async () => {
		const pointless: ZoneDto = {
			id: 'zone-empty',
			planId: FIXTURE_PLAN.id,
			name: 'Nothing to frame',
			zoneType: 'Room',
			status: 'Planned',
			points: [],
		};
		const harness = await mountPlanEditor({ queries: fakeQueries(FIXTURE_PLAN, [pointless]) });
		const runtime = runtimeOf(harness);
		const editor = useEditorStore();
		const before = editor.viewport;

		runtime.selectAndFrame('zone-empty');

		expect(useSelectionStore().selectedIds.map(String)).toEqual(['zone-empty']);
		expect(editor.viewport).toEqual(before);
		harness.unmount();
	});

	it('selects an id the hydrated zones do not hold, and leaves the camera alone', async () => {
		const harness = await mountPlanEditor();
		const runtime = runtimeOf(harness);
		const editor = useEditorStore();
		const before = editor.viewport;

		runtime.selectAndFrame('zone-nonexistent');

		expect(useSelectionStore().selectedIds.map(String)).toEqual(['zone-nonexistent']);
		expect(editor.viewport).toEqual(before);
		harness.unmount();
	});

	/**
	 * `fitTo` treats a `0 x 0` stage as an ordinary early call rather than an error (its own
	 * docblock) — the window before `EditorSurface`'s resize observer has ever run. Reset
	 * directly through the store rather than by avoiding the canvas mount, since mounting one
	 * at all is what wires the observer that sets a real size.
	 */
	it('leaves the camera alone while the stage has not been measured', async () => {
		const harness = await mountPlanEditor();
		const runtime = runtimeOf(harness);
		const editor = useEditorStore();
		editor.setStageSize({ width: 0, height: 0 });
		const before = editor.viewport;

		runtime.selectAndFrame('zone-kitchen');

		expect(useSelectionStore().selectedIds.map(String)).toEqual(['zone-kitchen']);
		expect(editor.viewport).toEqual(before);
		harness.unmount();
	});

	it('a selected zone that disappears from the next hydrate is retired, not rebound', async () => {
		const harness = await mountPlanEditor();
		const projectStore = useProjectStore();
		useSelectionStore().select(['zone-kitchen' as never]);

		await projectStore.hydrate(fakeQueries(FIXTURE_PLAN, [FIXTURE_ZONES[1]]), FIXTURE_PLAN.id);
		await nextTick();

		expect(useSelectionStore().selectedIds).toEqual([]);
		harness.unmount();
	});

	it('keeps a selected id that survives the next hydrate untouched', async () => {
		const harness = await mountPlanEditor();
		const projectStore = useProjectStore();
		useSelectionStore().select(['zone-kitchen' as never]);

		await projectStore.hydrate(fakeQueries(FIXTURE_PLAN, FIXTURE_ZONES), FIXTURE_PLAN.id);
		await nextTick();

		expect(useSelectionStore().selectedIds.map(String)).toEqual(['zone-kitchen']);
		harness.unmount();
	});
});
