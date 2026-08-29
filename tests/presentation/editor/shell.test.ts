/**
 * @vitest-environment jsdom
 *
 * The editor shell (SDD §60) and the camera on the canvas inside it.
 *
 * The five regions are a layout CONTRACT — slice 6 fills the toolbar and inspector, slice
 * 13 mounts into the status bar's third region by name — so what is asserted here is that
 * each region exists, is labelled, and holds what this slice puts in it.
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
import { mountPlanEditor, settle, type EditorHarness } from '../../helpers/editor';
import { FIXTURE_PLAN } from '../../helpers/planFixtures';

let harness: EditorHarness | null = null;

afterEach(() => {
	harness?.unmount();
	harness = null;
});

const READ_FAILED = { category: 'Persistence', code: 'plan.read-failed', message: 'boom' } as const;

/** Pointer and wheel events must BUBBLE: the camera listens on the canvas container. */
function wheelOver(mounted: EditorHarness, deltaY: number, at = { clientX: 400, clientY: 300 }): void {
	mounted.canvasEl.dispatchEvent(new WheelEvent('wheel', { deltaY, ...at, bubbles: true }));
}

describe('the five regions', () => {
	it('stands up the toolbar, both panels, the canvas and the status bar', async () => {
		harness = await mountPlanEditor();
		const { wrapper } = harness;

		expect(wrapper.find('.rp-editor-toolbar').exists()).toBe(true);
		expect(wrapper.find('.rp-editor-layers').exists()).toBe(true);
		expect(wrapper.find('.rp-plan-canvas').exists()).toBe(true);
		expect(wrapper.find('.rp-editor-inspector').exists()).toBe(true);
		expect(wrapper.find('.rp-editor-status-bar').exists()).toBe(true);
	});

	/**
	 * §60 names three status regions and slice 13 mounts its save-state indicator into the
	 * third BY NAME. A bar with two regions or four leaves it nowhere to go.
	 */
	it('keeps the status bar three named regions, save state included and empty', async () => {
		harness = await mountPlanEditor();
		const { wrapper } = harness;

		expect(wrapper.find('.rp-editor-status').attributes('aria-label')).toBe(t('en', 'editor.status'));
		expect(wrapper.find('.rp-editor-measurements').attributes('aria-label')).toBe(
			t('en', 'editor.measurements'),
		);
		const saveState = wrapper.find('.rp-editor-save-state');
		expect(saveState.attributes('aria-label')).toBe(t('en', 'editor.save-state'));
		// Empty on purpose: there are no edits until slice 6 and no indicator until slice 13,
		// and a region showing "saved" when nothing can be saved is a lie with a tick on it.
		expect(saveState.text()).toBe('');
	});

	it('shows the plan name in the status region', async () => {
		harness = await mountPlanEditor();

		expect(harness.wrapper.find('.rp-editor-status').text()).toBe(FIXTURE_PLAN.name);
	});

	/**
	 * The angle constraint is a modifier, and a modifier is invisible: no control shows it and
	 * no menu lists it. This hint is the only place the plugin mentions it, so which tools it
	 * appears under is the whole of its correctness — present while the gesture it applies to
	 * is available, absent when pressing the key would do nothing.
	 */
	it('announces the angle constraint under the tools that take it, and no others', async () => {
		harness = await mountPlanEditor();
		const hint = () => harness.wrapper.find('.rp-editor-hint');
		const press = (label: string) => {
			const button = harness.wrapper.findAll('button').find((candidate) => candidate.text() === label);
			if (button === undefined) throw new Error(`no toolbar button labelled ${label}`);
			button.element.click();
		};

		// Camera mode: no tool, so no constraint to announce.
		expect(hint().exists()).toBe(false);

		press(t('en', 'editor.toolbar.draw-zone'));
		await settle();
		expect(hint().text()).toBe(t('en', 'editor.hint.constrain-angle'));

		press(t('en', 'editor.toolbar.calibrate'));
		await settle();
		expect(hint().exists()).toBe(true);

		// Select moves and picks; it constrains nothing, so the key would be a dead letter.
		press(t('en', 'editor.toolbar.select'));
		await settle();
		expect(hint().exists()).toBe(false);
	});

	it('labels the toolbar and the inspector, empty though they are', async () => {
		harness = await mountPlanEditor();
		const { wrapper } = harness;

		expect(wrapper.find('.rp-editor-toolbar').attributes('aria-label')).toBe(t('en', 'editor.toolbar'));
		expect(wrapper.find('.rp-editor-inspector').attributes('aria-label')).toBe(t('en', 'editor.inspector'));
	});

	/**
	 * Slice 15's host, mounted per ItemView-scoped app. Asserted at the SHELL rather than
	 * only in the dialogs' own tests: a host that exists but is mounted nowhere is exactly
	 * the state `CalibrateTool` was in for a whole slice.
	 */
	it('mounts a dialog host that the leaf can open a dialog through', async () => {
		harness = await mountPlanEditor();
		const store = useDialogStore(harness.pinia);

		void store.openDialog({ kind: 'confirm', title: 'T', message: 'M' });
		await settle();

		expect(harness.wrapper.find('.rp-dialog').exists()).toBe(true);
	});

	/**
	 * Presence alone does not prove the mount point is correct: `DialogHost`'s
	 * `inertBackground` walks exactly two levels up from `.rp-dialog` to reach the element
	 * whose OTHER children it backgrounds. Mounted a level too deep, the toolbar would stay
	 * live and clickable behind the dialog with nothing erroring anywhere — this is the case
	 * that would catch that.
	 */
	it('makes a shell region inert while the dialog is open, and releases it on close', async () => {
		harness = await mountPlanEditor();
		const store = useDialogStore(harness.pinia);

		void store.openDialog({ kind: 'confirm', title: 'T', message: 'M' });
		await settle();

		expect(harness.wrapper.find('.rp-editor-toolbar').element.hasAttribute('inert')).toBe(true);

		store.resolve('cancel');
		await settle();

		expect(harness.wrapper.find('.rp-editor-toolbar').element.hasAttribute('inert')).toBe(false);
	});
});

describe('the layers panel', () => {
	it('offers one labelled checkbox per Konva layer', async () => {
		harness = await mountPlanEditor();

		const rows = harness.wrapper.findAll('.rp-editor-layer-row');

		expect(rows).toHaveLength(7);
		expect(rows[2].find('label').text()).toBe(t('en', 'editor.layer.zone'));
		expect(rows.every((row) => row.find('input').attributes('type') === 'checkbox')).toBe(true);
	});

	/**
	 * The one shell region with real behaviour in this slice, and it goes all the way to
	 * Konva: layer visibility is a pure rendering concern, so it needs no command and no
	 * write — but it does have to actually hide the layer.
	 */
	it('hides the Konva layer when its checkbox is unticked', async () => {
		harness = await mountPlanEditor();
		const zoneLayer = harness.stage.findOne('.zone');
		expect(zoneLayer?.visible()).toBe(true);

		await harness.wrapper.findAll('.rp-editor-layer-row')[2].find('input').setValue(false);
		await settle();

		expect(harness.stage.findOne('.zone')?.visible()).toBe(false);
		// And only that one: a toggle that took its siblings with it would look the same
		// through the panel and be plainly wrong on the canvas.
		expect(harness.stage.findOne('.background')?.visible()).toBe(true);
	});
});

describe('the measurements readout', () => {
	it('reports the zoom as a percentage', async () => {
		harness = await mountPlanEditor();

		expect(harness.wrapper.find('.rp-editor-measurements').text()).toContain('10%');
	});

	it('blanks the pointer position until the pointer is over the canvas', async () => {
		harness = await mountPlanEditor();

		expect(harness.wrapper.find('.rp-editor-measurements').text()).toContain('—');
	});

	/**
	 * Read-only telemetry, and the one place `screenToWorld` is visible to a user: it shows
	 * the viewport transform working end to end without any editable state behind it.
	 */
	it('shows the pointer position in world millimetres, and blanks it again on leave', async () => {
		harness = await mountPlanEditor();

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
		harness = await mountPlanEditor();
		const zoomOf = () => harness?.stage.findOne('.zone')?.scaleX() ?? 0;
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
		harness = await mountPlanEditor();
		const positionOf = () => ({ x: harness?.stage.findOne('.zone')?.x(), y: harness?.stage.findOne('.zone')?.y() });
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
		harness = await mountPlanEditor();
		const positionOf = () => harness?.stage.findOne('.zone')?.x();
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
		harness = await mountPlanEditor();
		const positionOf = () => harness?.stage.findOne('.zone')?.x();

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
		harness = await mountPlanEditor();
		const positionOf = () => harness?.stage.findOne('.zone')?.x();

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
		harness = await mountPlanEditor();
		const zoomOf = () => harness?.stage.findOne('.zone')?.scaleX() ?? 0;
		const before = zoomOf();

		harness.canvasEl.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
		await settle();

		expect(zoomOf()).toBeGreaterThan(before);
	});

	it('zooms out on -', async () => {
		harness = await mountPlanEditor();
		const zoomOf = () => harness?.stage.findOne('.zone')?.scaleX() ?? 0;
		const before = zoomOf();

		harness.canvasEl.dispatchEvent(new KeyboardEvent('keydown', { key: '-', bubbles: true }));
		await settle();

		expect(zoomOf()).toBeLessThan(before);
	});

	it('leaves every other key to whoever else wants it', async () => {
		harness = await mountPlanEditor();
		const zoomOf = () => harness?.stage.findOne('.zone')?.scaleX() ?? 0;
		const before = zoomOf();

		harness.canvasEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
		await settle();

		expect(zoomOf()).toBe(before);
	});

	it('is focusable and named, so the keyboard can reach it at all', async () => {
		harness = await mountPlanEditor();

		expect(harness.canvasEl.getAttribute('tabindex')).toBe('0');
		expect(harness.canvasEl.getAttribute('aria-label')).toBe(t('en', 'editor.canvas'));
	});
});

describe('what the shell shows when there is no plan to draw', () => {
	it('says so, and mounts no canvas, when the plan does not exist', async () => {
		harness = await mountPlanEditor({
			queries: { getPlan: () => Promise.resolve(ok(null)), findZonesByPlan: () => Promise.resolve(ok([])), getRequirementsForZone: () => Promise.resolve(ok([])), listAssets: () => Promise.resolve(ok([])) },
		});

		expect(harness.wrapper.find('.rp-plan-canvas').exists()).toBe(false);
		expect(harness.wrapper.find('.rp-editor-canvas-message').text()).toBe(t('en', 'editor.plan-missing'));
	});

	it('says something DIFFERENT when the read failed', async () => {
		harness = await mountPlanEditor({
			queries: {
				getPlan: () => Promise.resolve(err(READ_FAILED)),
				findZonesByPlan: () => Promise.resolve(ok([])),
				getRequirementsForZone: () => Promise.resolve(ok([])),
				listAssets: () => Promise.resolve(ok([])),
			},
		});

		expect(harness.wrapper.find('.rp-editor-canvas-message').text()).toBe(t('en', 'editor.plan-failed'));
	});

	/**
	 * A canvas over a plan that is still loading would size itself, bind a camera and draw
	 * an empty scene indistinguishable from a plan with no zones — which is the state slice
	 * 14's empty states exist to tell apart.
	 */
	it('shows a loading message while the queries are still out', async () => {
		harness = await mountPlanEditor({
			queries: {
				// Never settles: the editor is in its loading state for the whole of this test.
				getPlan: () => new Promise(() => {}),
				findZonesByPlan: () => Promise.resolve(ok([])),
				getRequirementsForZone: () => Promise.resolve(ok([])),
				listAssets: () => Promise.resolve(ok([])),
			},
		});

		expect(harness.wrapper.find('.rp-editor-canvas-message').text()).toBe(t('en', 'editor.loading'));
	});
});

/**
 * The panels are collapsible chrome, not content: hiding one is a `WorkspaceStore` toggle
 * with nothing persisted behind it. Driven through the store because there is no toggle
 * CONTROL yet — slice 6's toolbar is where that button goes, and the state it will drive
 * is stood up now so the button is all that has to arrive.
 */
describe('collapsing a panel', () => {
	it('removes the layers panel and leaves the canvas', async () => {
		harness = await mountPlanEditor();
		useWorkspaceStore().toggleLayersPanel();
		await settle();

		expect(harness.wrapper.find('.rp-editor-layers').exists()).toBe(false);
		expect(harness.wrapper.find('.rp-plan-canvas').exists()).toBe(true);
		expect(harness.wrapper.find('.rp-editor-inspector').exists()).toBe(true);
	});

	it('removes the inspector independently', async () => {
		harness = await mountPlanEditor();
		useWorkspaceStore().toggleInspectorPanel();
		await settle();

		expect(harness.wrapper.find('.rp-editor-inspector').exists()).toBe(false);
		expect(harness.wrapper.find('.rp-editor-layers').exists()).toBe(true);
	});
});
