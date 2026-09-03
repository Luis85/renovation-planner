/**
 * @vitest-environment jsdom
 *
 * The editor shell (SDD §60) and the camera on the canvas inside it.
 *
 * The five regions are a layout CONTRACT — slice 6 fills the toolbar (Task 13 replaced it
 * with a context bar and a floating Select/Add group) and the inspector, slice 13 mounts
 * into the status bar's third region by name — so what is asserted here is that each region
 * exists, is labelled, and holds what this slice puts in it.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { useDialogStore } from '../../../src/presentation/dialogs/dialog-store';
import { err, ok } from '../../../src/core/result/Result';
import { t } from '../../../src/presentation/i18n/strings';
import {
	DEFAULT_VIEWPORT,
	screenPoint,
	screenToWorld,
	STAGE_PIXELS,
} from '../../../src/presentation/editor/viewport/Viewport';
import { useWorkspaceStore } from '../../../src/presentation/stores/WorkspaceStore';
import {
	fakeQueries,
	mountPlanEditor,
	mountPlanEditorCanvas,
	settle,
	type CanvasHarness,
	type EditorHarness,
	type EditorHarnessOptions,
} from '../../helpers/editor';
import { FIXTURE_PLAN } from '../../helpers/planFixtures';
import { activateTool } from '../../helpers/planEditorRig';

/**
 * What `afterEach` has to unmount, which is the only thing the whole file shares.
 *
 * Every case takes its harness as a LOCAL const from one of the two mounts below, because a
 * module-level `EditorHarness | null` read inside a case is a value the compiler cannot
 * narrow — least of all inside the arrow functions several cases build over it.
 */
let open: EditorHarness | null = null;

afterEach(() => {
	open?.unmount();
	open = null;
});

/** Mount over an ordinary plan: a canvas is not in question, so it is proven once here. */
async function mountCanvas(options: EditorHarnessOptions = {}): Promise<CanvasHarness> {
	const harness = await mountPlanEditorCanvas(options);
	open = harness;
	return harness;
}

/** Mount for a state that draws NO canvas — a missing plan, a failed read, one still loading. */
async function mountShell(options: EditorHarnessOptions): Promise<EditorHarness> {
	const harness = await mountPlanEditor(options);
	open = harness;
	return harness;
}

const READ_FAILED = { category: 'Persistence', code: 'plan.read-failed', message: 'boom' } as const;

/** Pointer and wheel events must BUBBLE: the camera listens on the canvas container. */
function wheelOver(mounted: CanvasHarness, deltaY: number, at = { clientX: 400, clientY: 300 }): void {
	mounted.canvasEl.dispatchEvent(new WheelEvent('wheel', { deltaY, ...at, bubbles: true }));
}

describe('the five regions', () => {
	it('stands up the context bar, both panels, the canvas, the floating actions and the status bar', async () => {
		const harness = await mountCanvas();
		const { wrapper } = harness;

		expect(wrapper.find('.rp-context-bar').exists()).toBe(true);
		expect(wrapper.find('.rp-editor-layers').exists()).toBe(true);
		expect(wrapper.find('.rp-plan-canvas').exists()).toBe(true);
		expect(wrapper.find('.rp-primary-actions').exists()).toBe(true);
		expect(wrapper.find('.rp-editor-inspector').exists()).toBe(true);
		expect(wrapper.find('.rp-editor-status-bar').exists()).toBe(true);
	});

	/**
	 * §60 names three status regions and slice 13 mounts its save-state indicator into the
	 * third BY NAME. A bar with two regions or four leaves it nowhere to go.
	 */
	it('keeps the status bar three named regions, save state included', async () => {
		const harness = await mountCanvas();
		const { wrapper } = harness;

		expect(wrapper.find('.rp-editor-status').attributes('aria-label')).toBe(t('en', 'editor.status'));
		expect(wrapper.find('.rp-editor-measurements').attributes('aria-label')).toBe(
			t('en', 'editor.measurements'),
		);
		const saveState = wrapper.find('.rp-editor-save-state');
		expect(saveState.attributes('aria-label')).toBe(t('en', 'editor.save-state'));
		// Slice 13's indicator renders the resting state as the translated word — a fresh
		// Plan Editor has nothing unsaved by construction.
		expect(saveState.text()).toBe(t('en', 'save-state.saved'));
	});

	it('shows the plan name in the status region', async () => {
		const harness = await mountCanvas();

		expect(harness.wrapper.find('.rp-editor-status').text()).toBe(FIXTURE_PLAN.name);
	});

	/**
	 * The angle constraint is a modifier, and a modifier is invisible: no control shows it and
	 * no menu lists it. This hint is the only place the plugin mentions it, so which tools it
	 * appears under is the whole of its correctness — present while the gesture it applies to
	 * is available, absent when pressing the key would do nothing.
	 */
	it('announces the angle constraint under the tools that take it, and no others', async () => {
		const harness = await mountCanvas();
		const hint = () => harness.wrapper.find('.rp-editor-hint');

		// Camera mode: no tool, so no constraint to announce.
		expect(hint().exists()).toBe(false);

		activateTool(harness, 'draw-polygon');
		await settle();
		expect(hint().text()).toBe(t('en', 'editor.hint.constrain-angle'));

		activateTool(harness, 'calibrate');
		await settle();
		expect(hint().exists()).toBe(true);

		// Select moves and picks; it constrains nothing, so the key would be a dead letter.
		activateTool(harness, 'select');
		await settle();
		expect(hint().exists()).toBe(false);
	});

	it('labels the context bar, the primary actions and the inspector, empty though they are', async () => {
		const harness = await mountCanvas();
		const { wrapper } = harness;

		expect(wrapper.find('.rp-context-bar').attributes('aria-label')).toBe(t('en', 'editor.context-bar'));
		expect(wrapper.find('.rp-primary-actions').attributes('aria-label')).toBe(
			t('en', 'editor.primary-actions'),
		);
		expect(wrapper.find('.rp-editor-inspector').attributes('aria-label')).toBe(t('en', 'editor.inspector'));
	});

	/**
	 * Slice 15's host, mounted per ItemView-scoped app. Asserted at the SHELL rather than
	 * only in the dialogs' own tests: a host that exists but is mounted nowhere is exactly
	 * the state `CalibrateTool` was in for a whole slice.
	 */
	it('mounts a dialog host that the leaf can open a dialog through', async () => {
		const harness = await mountCanvas();
		const store = useDialogStore(harness.pinia);

		void store.openDialog({ kind: 'confirm', title: 'T', message: 'M' });
		await settle();

		expect(harness.wrapper.find('.rp-dialog').exists()).toBe(true);
	});

	/**
	 * Presence alone does not prove the mount point is correct: `DialogHost`'s
	 * `inertBackground` walks exactly two levels up from `.rp-dialog` to reach the element
	 * whose OTHER children it backgrounds. Mounted a level too deep, the context bar would
	 * stay live and clickable behind the dialog with nothing erroring anywhere — this is the
	 * case that would catch that.
	 */
	it('makes a shell region inert while the dialog is open, and releases it on close', async () => {
		const harness = await mountCanvas();
		const store = useDialogStore(harness.pinia);

		void store.openDialog({ kind: 'confirm', title: 'T', message: 'M' });
		await settle();

		expect(harness.wrapper.find('.rp-context-bar').element.hasAttribute('inert')).toBe(true);

		store.resolve('cancel');
		await settle();

		expect(harness.wrapper.find('.rp-context-bar').element.hasAttribute('inert')).toBe(false);
	});
});

/**
 * Task 14 replaced the seven-checkbox-per-Konva-layer panel with the truthful two-entry
 * catalogue (`layerCatalogue.ts`): a row for a layer with no records and no capability was a
 * fake, and four of the old seven were exactly that. `layerCatalogue.test.ts` and
 * `layerList.test.ts` own the catalogue's own rules; what belongs here is that the SHELL
 * mounts the new panel in the old one's place.
 */
describe('the layers panel', () => {
	it('offers one labelled checkbox per catalogue entry — Reference plan, then Rooms', async () => {
		const harness = await mountCanvas();

		const rows = harness.wrapper.findAll('.rp-layer-list__row');

		expect(rows).toHaveLength(2);
		expect(rows[0].find('label').text()).toBe(t('en', 'editor.layer.reference-plan'));
		expect(rows[1].find('label').text()).toBe(t('en', 'editor.layer.rooms'));
		expect(rows.every((row) => row.find('input').attributes('type') === 'checkbox')).toBe(true);
	});

	/**
	 * The one shell region with real behaviour in this slice, and it goes all the way to
	 * Konva: layer visibility is a pure rendering concern, so it needs no command and no
	 * write — but it does have to actually hide the layer.
	 */
	it('hides the Konva layer when its checkbox is unticked', async () => {
		const harness = await mountCanvas();
		const zoneLayer = harness.stage.findOne('.zone');
		expect(zoneLayer?.visible()).toBe(true);

		await harness.wrapper.findAll('.rp-layer-list__row')[1].find('input').setValue(false);
		await settle();

		expect(harness.stage.findOne('.zone')?.visible()).toBe(false);
		// And only that one: a toggle that took its siblings with it would look the same
		// through the panel and be plainly wrong on the canvas.
		expect(harness.stage.findOne('.background')?.visible()).toBe(true);
	});
});

describe('the measurements readout', () => {
	it('reports the zoom as a percentage', async () => {
		const harness = await mountCanvas();

		expect(harness.wrapper.find('.rp-editor-measurements').text()).toContain('10%');
	});

	it('blanks the pointer position until the pointer is over the canvas', async () => {
		const harness = await mountCanvas();

		expect(harness.wrapper.find('.rp-editor-measurements').text()).toContain('—');
	});

	/**
	 * Read-only telemetry, and the one place `screenToWorld` is visible to a user: it shows
	 * the viewport transform working end to end without any editable state behind it.
	 */
	it('shows the pointer position in world millimetres, and blanks it again on leave', async () => {
		const harness = await mountCanvas();

		harness.canvasEl.dispatchEvent(
			new PointerEvent('pointermove', { clientX: 100, clientY: 50, bubbles: true }),
		);
		await settle();
		// Derived rather than typed: the default viewport carries a margin, so a literal here
		// would be re-deriving the transform the readout is supposed to demonstrate.
		const expected = screenToWorld(screenPoint(100, 50), DEFAULT_VIEWPORT, STAGE_PIXELS);
		expect(harness.wrapper.find('.rp-editor-measurements').text()).toContain(
			`${Math.round(expected.x)}, ${Math.round(expected.y)} mm`,
		);

		harness.canvasEl.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true }));
		await settle();

		expect(harness.wrapper.find('.rp-editor-measurements').text()).toContain('—');
	});
});

describe('the camera', () => {
	it('zooms in on a wheel up and out on a wheel down', async () => {
		const harness = await mountCanvas();
		const zoomOf = () => harness.stage.findOne('.zone')?.scaleX() ?? 0;
		const start = zoomOf();

		wheelOver(harness, -240);
		await settle();
		const zoomedIn = zoomOf();
		expect(zoomedIn).toBeGreaterThan(start);

		wheelOver(harness, 240);
		await settle();

		expect(zoomOf()).toBeLessThan(zoomedIn);
	});

	it('pans on a primary-button drag', async () => {
		const harness = await mountCanvas();
		// Task 10 made Select — not camera mode — the tool a ready plan opens onto, and
		// (0,0)-(4000,3000) zone-kitchen sits under this drag's start; back to camera mode so
		// the drag pans rather than moving the zone.
		activateTool(harness, null);
		await settle();
		const positionOf = () => ({ x: harness.stage.findOne('.zone')?.x(), y: harness.stage.findOne('.zone')?.y() });
		const before = positionOf();

		harness.canvasEl.dispatchEvent(
			new PointerEvent('pointerdown', { button: 0, clientX: 100, clientY: 100, bubbles: true }),
		);
		harness.canvasEl.dispatchEvent(
			// `buttons: 1` because the button is still down: a move reporting none is how a
			// device says the primary button came up, and the canvas ends the drag on it.
			new PointerEvent('pointermove', { buttons: 1, clientX: 180, clientY: 140, bubbles: true }),
		);
		await settle();

		expect(positionOf()).not.toEqual(before);
	});

	/**
	 * The RIGHT button is the context menu, and claiming it takes a gesture the host owns —
	 * the user finds out by losing it.
	 *
	 * This case used to cover the middle button too, under a comment calling it
	 * "paste-on-Linux". That reading was wrong and the claim is now narrowed to the button it
	 * is actually true of: X11's primary-selection paste is a TEXT INPUT gesture, and a
	 * canvas is not one — while Obsidian's own Canvas documents middle-drag as its pan. The
	 * middle button pans here now (`canvasNavigation.test.ts` covers it), so a case that
	 * still asserted otherwise would be pinning a decision this project has reversed.
	 */
	it('ignores a drag started with the secondary button', async () => {
		const harness = await mountCanvas();
		const positionOf = () => harness.stage.findOne('.zone')?.x();
		const before = positionOf();

		harness.canvasEl.dispatchEvent(
			new PointerEvent('pointerdown', { button: 2, clientX: 100, clientY: 100, bubbles: true }),
		);
		harness.canvasEl.dispatchEvent(
			new PointerEvent('pointermove', { clientX: 400, clientY: 400, bubbles: true }),
		);
		await settle();

		expect(positionOf()).toBe(before);
	});

	it('stops panning when the button is released', async () => {
		const harness = await mountCanvas();
		// Same reason as the case above: an explicit return to camera mode, since Select would
		// otherwise turn this into a completed (and irrelevant) zone move.
		activateTool(harness, null);
		await settle();
		const positionOf = () => harness.stage.findOne('.zone')?.x();

		harness.canvasEl.dispatchEvent(
			new PointerEvent('pointerdown', { button: 0, clientX: 100, clientY: 100, bubbles: true }),
		);
		harness.canvasEl.dispatchEvent(
			new PointerEvent('pointermove', { clientX: 180, clientY: 100, bubbles: true }),
		);
		harness.canvasEl.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
		await settle();
		const afterRelease = positionOf();

		harness.canvasEl.dispatchEvent(
			new PointerEvent('pointermove', { clientX: 400, clientY: 100, bubbles: true }),
		);
		await settle();

		expect(positionOf()).toBe(afterRelease);
	});

	it('ends a pan that leaves the pane, so the view does not stay stuck to the cursor', async () => {
		const harness = await mountCanvas();
		// Same reason again: without it, this is a Select press over zone-kitchen instead.
		activateTool(harness, null);
		await settle();
		const positionOf = () => harness.stage.findOne('.zone')?.x();

		harness.canvasEl.dispatchEvent(
			new PointerEvent('pointerdown', { button: 0, clientX: 100, clientY: 100, bubbles: true }),
		);
		harness.canvasEl.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true }));
		await settle();
		const afterLeave = positionOf();

		harness.canvasEl.dispatchEvent(
			new PointerEvent('pointermove', { clientX: 500, clientY: 100, bubbles: true }),
		);
		await settle();

		expect(positionOf()).toBe(afterLeave);
	});

	/**
	 * §85: the one interaction this slice adds is reachable by keyboard as well as by wheel,
	 * because a wheel is not a control everyone has.
	 */
	it.each([['+'], ['=']])('zooms in on %s', async (key) => {
		const harness = await mountCanvas();
		const zoomOf = () => harness.stage.findOne('.zone')?.scaleX() ?? 0;
		const before = zoomOf();

		harness.canvasEl.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
		await settle();

		expect(zoomOf()).toBeGreaterThan(before);
	});

	it('zooms out on -', async () => {
		const harness = await mountCanvas();
		const zoomOf = () => harness.stage.findOne('.zone')?.scaleX() ?? 0;
		const before = zoomOf();

		harness.canvasEl.dispatchEvent(new KeyboardEvent('keydown', { key: '-', bubbles: true }));
		await settle();

		expect(zoomOf()).toBeLessThan(before);
	});

	it('leaves every other key to whoever else wants it', async () => {
		const harness = await mountCanvas();
		const zoomOf = () => harness.stage.findOne('.zone')?.scaleX() ?? 0;
		const before = zoomOf();

		harness.canvasEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
		await settle();

		expect(zoomOf()).toBe(before);
	});

	it('is focusable and named, so the keyboard can reach it at all', async () => {
		const harness = await mountCanvas();

		expect(harness.canvasEl.getAttribute('tabindex')).toBe('0');
		expect(harness.canvasEl.getAttribute('aria-label')).toBe(t('en', 'editor.canvas'));
	});
});

describe('what the shell shows when there is no plan to draw', () => {
	it('says so, and mounts no canvas, when the plan does not exist', async () => {
		const harness = await mountShell({
			queries: { ...fakeQueries(null), getPlan: () => Promise.resolve(ok(null)) },
		});

		expect(harness.wrapper.find('.rp-plan-canvas').exists()).toBe(false);
		// Design slice 17 moved this into the shared `ViewFailure` and gave it a headline and a
		// body; the claim — the shell SAYS the plan is gone, and draws no canvas over it — is
		// unchanged. `planEditorFailure.test.ts` is where the new state's own rules are pinned.
		expect(harness.wrapper.find('.rp-view-failure__headline').text()).toBe(
			t('en', 'editor.plan-missing.headline'),
		);
	});

	it('says something DIFFERENT when the read failed', async () => {
		const harness = await mountShell({
			queries: { ...fakeQueries(null), getPlan: () => Promise.resolve(err(READ_FAILED)) },
		});

		// "Something DIFFERENT" is now different in a stronger sense than when this case was
		// written: the body is `trError(error)`, the mapped sentence for the failing code, so two
		// different causes no longer share one fixed line. Asserted as a difference from the
		// missing-plan headline, which is the claim this case has always made.
		expect(harness.wrapper.find('.rp-view-failure__headline').text()).toBe(
			t('en', 'editor.plan-failed.headline'),
		);
		expect(harness.wrapper.find('.rp-view-failure__headline').text()).not.toBe(
			t('en', 'editor.plan-missing.headline'),
		);
	});

	/**
	 * A canvas over a plan that is still loading would size itself, bind a camera and draw
	 * an empty scene indistinguishable from a plan with no zones — which is the state slice
	 * 14's empty states exist to tell apart.
	 */
	it('shows a loading message while the queries are still out', async () => {
		const harness = await mountShell({
			queries: {
				...fakeQueries(null),
				// Never settles: the editor is in its loading state for the whole of this test.
				getPlan: () => new Promise(() => {}),
			},
		});

		expect(harness.wrapper.find('.rp-editor-canvas-message').text()).toBe(t('en', 'editor.loading'));
	});
});

/**
 * The panels are collapsible chrome, not content: hiding one is a `WorkspaceStore` toggle
 * with nothing persisted behind it. Driven through the store because there is no toggle
 * CONTROL yet — the context bar (Task 13) is where that button goes, and the state it will
 * drive is stood up now so the button is all that has to arrive.
 */
describe('collapsing a panel', () => {
	it('removes the layers panel and leaves the canvas', async () => {
		const harness = await mountCanvas();
		useWorkspaceStore().toggleLayersPanel();
		await settle();

		expect(harness.wrapper.find('.rp-editor-layers').exists()).toBe(false);
		expect(harness.wrapper.find('.rp-plan-canvas').exists()).toBe(true);
		expect(harness.wrapper.find('.rp-editor-inspector').exists()).toBe(true);
	});

	it('removes the inspector independently', async () => {
		const harness = await mountCanvas();
		useWorkspaceStore().toggleInspectorPanel();
		await settle();

		expect(harness.wrapper.find('.rp-editor-inspector').exists()).toBe(false);
		expect(harness.wrapper.find('.rp-editor-layers').exists()).toBe(true);
	});
});
