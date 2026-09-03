// @vitest-environment jsdom
/**
 * Task 19's responsive shell (design spec §5.4/§5.5): `ResponsiveEditorShell.vue` reads its own
 * root width through a `ResizeObserver`, writes `WorkspaceStore.layoutMode`, and rearranges the
 * regions around ONE `PlanCanvas` instance that is never remounted.
 *
 * Every case here drives the REAL mounted editor and resizes the REAL shell root
 * (`harness.rootEl`), because the thing under test is what the observer does with a width — a
 * fixture that set `layoutMode` in the store directly would certify the branches and say
 * nothing about the one wire that decides them.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import { t } from '../../../../src/presentation/i18n/strings';
import { useSelectionStore } from '../../../../src/presentation/editor/selection/selection-store';
import { useEditorStore } from '../../../../src/presentation/stores/EditorStore';
import { STAGE_PIXELS, worldToScreen } from '../../../../src/presentation/editor/viewport/Viewport';
import {
	mountPlanEditor,
	mountPlanEditorCanvas,
	runtimeOf,
	settle,
	type EditorHarness,
} from '../../../helpers/editor';
import { connectedObservers, resizeTo } from '../../../helpers/layout';
import { click, pointer } from '../../../helpers/planEditorRig';
import { FIXTURE_ZONES } from '../../../helpers/planFixtures';

let open: EditorHarness | null = null;

afterEach(() => {
	open?.unmount();
	open = null;
});

/** Escape as the browser delivers it: on the focused container, bubbling. */
function escapeOn(element: Element): void {
	element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
}

describe('the responsive shell', () => {
	it('moves from full to constrained without remounting the canvas', async () => {
		const harness = await mountPlanEditorCanvas();
		open = harness;
		const canvasBefore = harness.canvasEl;
		expect(harness.rootEl.dataset.layout).toBe('full');

		resizeTo(harness.rootEl, 460, 800);
		await settle();

		expect(harness.rootEl.dataset.layout).toBe('constrained');
		expect(harness.wrapper.find('.rp-editor-layers').exists()).toBe(false);
		expect(harness.wrapper.find('.rp-editor-inspector').exists()).toBe(false);
		expect(harness.wrapper.find('.rp-panel-rail').exists()).toBe(true);
		// The SAME node, not merely another canvas: a second `<slot name="canvas">` site under
		// its own `v-if` would draw an identical picture over a remounted stage, losing the
		// camera and the selection with nothing to show for it.
		expect(harness.wrapper.find('.rp-plan-canvas').element).toBe(canvasBefore);
	});

	it('keeps selection and viewport across the change', async () => {
		const harness = await mountPlanEditorCanvas();
		open = harness;
		// Through the Inspector's own room row, which selects AND frames — so the viewport
		// captured below is one a gesture really produced rather than the default.
		await harness.wrapper.findAll('.rp-room-list__row')[0].trigger('click');
		await settle();
		const selection = [...useSelectionStore().selectedIds];
		const viewport = { ...useEditorStore().viewport };
		expect(selection).toHaveLength(1);

		resizeTo(harness.rootEl, 460, 800);
		await settle();

		expect([...useSelectionStore().selectedIds]).toEqual(selection);
		expect({ ...useEditorStore().viewport }).toEqual(viewport);
	});

	it('opens one overlay at a time from the rail, closes on Escape, and returns focus to the rail button', async () => {
		const harness = await mountPlanEditorCanvas();
		open = harness;
		resizeTo(harness.rootEl, 460, 800);
		await settle();

		await harness.wrapper.find('button[data-rp-rail="layers"]').trigger('click');
		await settle();
		expect(harness.wrapper.find('.rp-overlay-panel .rp-layer-list').exists()).toBe(true);
		expect(harness.wrapper.find('button[data-rp-rail="layers"]').attributes('aria-expanded')).toBe('true');

		await harness.wrapper.find('button[data-rp-rail="details"]').trigger('click');
		await settle();
		expect(harness.wrapper.find('.rp-overlay-panel').exists()).toBe(false);
		expect(harness.wrapper.find('.rp-inspector-drawer').exists()).toBe(true);

		escapeOn(harness.wrapper.find('.rp-inspector-drawer').element);
		await settle();
		expect(harness.wrapper.find('.rp-inspector-drawer').exists()).toBe(false);
		expect(document.activeElement?.getAttribute('data-rp-rail')).toBe('details');
	});

	/**
	 * BOTH containers through BOTH doors, which is four combinations and not two: the case above
	 * drives one of them, and the three left over are where a close button wired to nothing, or
	 * an Escape one container hears and the other does not, would sit unnoticed. The focus
	 * assertion repeats in each because `closeOverlay(kind)` maps the store's `inspector` onto
	 * the rail's `details`, and a mapping is exactly the thing that can be right for one entry.
	 */
	it.each([
		['the layers overlay', 'layers', '.rp-overlay-panel', '.rp-overlay-panel__close'],
		['the inspector drawer', 'details', '.rp-inspector-drawer', '.rp-inspector-drawer__close'],
	])('closes %s from Escape and from its close button, returning focus to its rail button', async (_name, rail, panel, close) => {
		const harness = await mountPlanEditorCanvas();
		open = harness;
		resizeTo(harness.rootEl, 460, 800);
		await settle();

		for (const shut of [
			(): Promise<void> => {
				escapeOn(harness.wrapper.find(panel).element);
				return Promise.resolve();
			},
			(): Promise<void> => harness.wrapper.find(close).trigger('click'),
		]) {
			await harness.wrapper.find(`button[data-rp-rail="${rail}"]`).trigger('click');
			await settle();
			expect(harness.wrapper.find(panel).exists()).toBe(true);

			await shut();
			await settle();

			expect(harness.wrapper.find(panel).exists()).toBe(false);
			expect(document.activeElement?.getAttribute('data-rp-rail')).toBe(rail);
		}
	});

	it('closes an open overlay when the pane grows back to full', async () => {
		const harness = await mountPlanEditorCanvas();
		open = harness;
		resizeTo(harness.rootEl, 460, 800);
		await settle();
		await harness.wrapper.find('button[data-rp-rail="details"]').trigger('click');
		await settle();
		expect(harness.wrapper.find('.rp-inspector-drawer').exists()).toBe(true);

		resizeTo(harness.rootEl, 1280, 800);
		await settle();

		expect(harness.wrapper.find('.rp-inspector-drawer').exists()).toBe(false);
		expect(harness.wrapper.find('.rp-panel-rail').exists()).toBe(false);
		// The persistent panels are back: the overlay stood in for exactly these.
		expect(harness.wrapper.find('.rp-editor-layers').exists()).toBe(true);
		expect(harness.wrapper.find('.rp-editor-inspector').exists()).toBe(true);
	});

	/**
	 * The case above proves the overlay GOES; this one proves the keyboard user goes somewhere
	 * (R10). A growth closes the overlay through `WorkspaceStore.setLayoutMode` rather than
	 * through `closeOverlay`, and `closeOverlay` could not have served here anyway: the rail
	 * button it focuses is removed by this very transition, so focus landed on `<body>` and the
	 * user had no predictable next Tab position. The surviving target is the PERSISTENT region
	 * the overlay stood in for — the aside itself, not its first control, because the aside is
	 * what the overlay was standing in for and a control is a guess about which one mattered.
	 *
	 * Both regions, because the store's `inspector` and the rail's `details` are two
	 * vocabularies and a mapping is exactly the thing that can be right for one entry.
	 */
	it.each([
		['the layers overlay', 'layers', '.rp-overlay-panel', 'layers'],
		['the inspector drawer', 'details', '.rp-inspector-drawer', 'inspector'],
	])('growing back to full while %s is open moves focus to the persistent region it stood in for', async (_name, rail, panel, region) => {
		const harness = await mountPlanEditorCanvas();
		open = harness;
		resizeTo(harness.rootEl, 460, 800);
		await settle();
		await harness.wrapper.find(`button[data-rp-rail="${rail}"]`).trigger('click');
		await settle();
		expect(harness.wrapper.find(panel).element.contains(document.activeElement)).toBe(true);

		resizeTo(harness.rootEl, 1280, 800);
		await settle();

		expect(harness.wrapper.find(panel).exists()).toBe(false);
		expect(document.activeElement).toBe(harness.wrapper.find(`[data-rp-region="${region}"]`).element);
		expect(document.activeElement).not.toBe(document.body);
	});

	/**
	 * R3, pinned: these panels are MODELESS and do not trap focus — the canvas stays reachable
	 * while one is open. A POLICY PIN rather than a regression test: it is green against the
	 * components as they stand, and it exists so that adding a trap to satisfy M16's retired
	 * sentence fails here rather than passing review.
	 *
	 * jsdom performs no Tab traversal, so this MOVES focus to the canvas — the element R3 names
	 * as the one that must stay reachable, and a real Tab stop (`tabindex="0"`) in the same
	 * shell — and then asks the two questions a trap would answer differently: a `focusout`
	 * trap pulls focus back inside, and a dismiss-on-blur panel closes. What no gate here can
	 * ask is what a browser's own Tab does with the order; `docs/tests/cases/Open a floor and
	 * select a room.md` step 9 is that instrument.
	 */
	it.each([
		['the layers overlay', 'layers', '.rp-overlay-panel'],
		['the inspector drawer', 'details', '.rp-inspector-drawer'],
	])('%s does not trap focus: focus can leave it for the canvas (R3)', async (_name, rail, panel) => {
		const harness = await mountPlanEditorCanvas();
		open = harness;
		resizeTo(harness.rootEl, 460, 800);
		await settle();
		await harness.wrapper.find(`button[data-rp-rail="${rail}"]`).trigger('click');
		await settle();

		const inside = [...harness.wrapper.find(panel).element.querySelectorAll<HTMLElement>('button, input, [tabindex="0"]')];
		expect(inside.length).toBeGreaterThan(0);
		const canvas = harness.wrapper.find('.rp-plan-canvas').element as HTMLElement;
		// The canvas is a Tab stop of the same shell and outside the panel: what the browser
		// would walk onto is reachable at all, which a trap is what would take away.
		expect(canvas.tabIndex).toBe(0);
		expect(harness.wrapper.find(panel).element.contains(canvas)).toBe(false);

		(inside.at(-1) as HTMLElement).focus();
		canvas.focus();
		await settle();

		expect(harness.wrapper.find(panel).element.contains(document.activeElement)).toBe(false);
		expect(document.activeElement).toBe(canvas);
		// Leaving does not close it: a panel that dismissed on blur would be a trap's opposite
		// and just as wrong — the user has moved to the canvas, not finished with the panel.
		expect(harness.wrapper.find(panel).exists()).toBe(true);
	});

	it('below the floor width replaces the canvas with a summary and a Focus this tab action that asks the leaf', async () => {
		const harness = await mountPlanEditorCanvas();
		open = harness;

		resizeTo(harness.rootEl, 320, 800);
		await settle();

		expect(harness.rootEl.dataset.layout).toBe('unsupported');
		expect(harness.wrapper.find('.rp-plan-canvas').exists()).toBe(false);
		const notice = harness.wrapper.find('.rp-unsupported-width');
		expect(notice.text()).toContain(t('en', 'editor.unsupported-width.headline'));
		expect(notice.find('.rp-unsupported-width__body').text()).toBe(
			'Ground floor has 1 room. Widen the pane or focus this tab to edit.',
		);

		await notice.find('button').trigger('click');
		expect(harness.focusedLeaf()).toBe(1);

		resizeTo(harness.rootEl, 1280, 800);
		await settle();
		expect(harness.wrapper.find('.rp-plan-canvas').exists()).toBe(true);
	});

	it('inflects the room count: two rooms read as rooms, in both locales', async () => {
		const second = { ...FIXTURE_ZONES[0], id: 'zone-pantry', name: 'Pantry' };
		const harness = await mountPlanEditorCanvas({ zones: [FIXTURE_ZONES[0], second] });
		open = harness;
		resizeTo(harness.rootEl, 320, 800);
		await settle();
		expect(harness.wrapper.find('.rp-unsupported-width__body').text()).toBe(
			'Ground floor has 2 rooms. Widen the pane or focus this tab to edit.',
		);
		expect(t('de', 'editor.unsupported-width.body.one', { floor: 'Erdgeschoss' })).toBe(
			'Erdgeschoss hat 1 Raum. Vergrößern Sie den Bereich oder fokussieren Sie diesen Tab, um zu bearbeiten.',
		);
		expect(t('de', 'editor.unsupported-width.body.other', { floor: 'Erdgeschoss', rooms: '2' })).toBe(
			'Erdgeschoss hat 2 Räume. Vergrößern Sie den Bereich oder fokussieren Sie diesen Tab, um zu bearbeiten.',
		);
	});

	it('does not present a partial room count as complete', async () => {
		const harness = await mountPlanEditorCanvas({ unreadableZones: 2 });
		open = harness;
		resizeTo(harness.rootEl, 320, 800);
		await settle();
		const body = harness.wrapper.find('.rp-unsupported-width__body').text();
		expect(body).toBe(t('en', 'editor.unsupported-width.body.partial', { floor: 'Ground floor' }));
		expect(body).not.toMatch(/has \d+ rooms?\./);
	});

	/**
	 * The notice mounts BEFORE any plan is hydrated too — a leaf restored into a narrow pane
	 * draws it while `ProjectStore.plan` is still `null`, and a summary built from a plan that
	 * is not there would be a crash rather than a missing sentence. The headline and the action
	 * are what it can honestly offer; the body is what it cannot.
	 */
	it('draws its headline and its action with no plan to summarise', async () => {
		const harness = await mountPlanEditor({ plan: null });
		open = harness;

		resizeTo(harness.rootEl, 320, 800);
		await settle();

		const notice = harness.wrapper.find('.rp-unsupported-width');
		expect(notice.text()).toContain(t('en', 'editor.unsupported-width.headline'));
		expect(notice.find('.rp-unsupported-width__body').exists()).toBe(false);
		await notice.find('button').trigger('click');
		expect(harness.focusedLeaf()).toBe(1);
	});

	/**
	 * Below the floor the canvas is UNMOUNTED, and the `ToolManager` is not: it is leaf-scoped,
	 * so a press whose release never comes — the user drags, the split narrows under them —
	 * left `gestureInFlight` true into the remount. `cameraIsLocked()` then refused every wheel
	 * and both fit shortcuts for the rest of the session, and the fresh surface's own pointer
	 * owner was `null`, so the next real press was refused as a foreign pointer's.
	 *
	 * Asserted at the manager's flag AND at the next complete gesture, because the flag alone
	 * is equally true of a build that cancelled the whole tool.
	 */
	it('an interrupted Select drag is abandoned when the canvas unmounts below the floor, and the next click selects normally', async () => {
		const harness = await mountPlanEditorCanvas();
		open = harness;
		const runtime = runtimeOf(harness);
		// The kitchen's centre, projected through the camera the editor opened at — the same
		// transform `EditorSurface` inverts on every press, with the same third argument.
		const inKitchen = worldToScreen({ x: 2000, y: 1500 }, useEditorStore().viewport, STAGE_PIXELS);
		pointer(harness.canvasEl, 'pointerdown', inKitchen.x, inKitchen.y);
		// 40 screen pixels at this zoom is 400 world units, ten times `SelectTool`'s
		// click-versus-drag epsilon: a real drag rather than a click that has not landed yet.
		pointer(harness.canvasEl, 'pointermove', inKitchen.x + 40, inKitchen.y + 40);
		expect(runtime.toolManager.gestureInFlight).toBe(true);

		resizeTo(harness.rootEl, 320, 800);
		await settle();
		expect(runtime.toolManager.gestureInFlight).toBe(false);
		resizeTo(harness.rootEl, 1280, 800);
		await settle();

		const canvas = harness.wrapper.find('.rp-plan-canvas').element as HTMLElement;
		useSelectionStore().clear();
		click(canvas, inKitchen.x, inKitchen.y);
		await settle();
		expect(useSelectionStore().selectedIds.map(String)).toEqual(['zone-kitchen']);
	});

	/**
	 * The other half of the distinction, and the reason the door is `cancelInterruptedGesture`
	 * rather than `cancelGesture`: a multi-click draft is not an interrupted gesture. A vertex
	 * the user really placed survives the unmount; only the press with no release goes.
	 */
	it('a drawing tool keeps its placed vertices across the unmount; only the interrupted press is abandoned', async () => {
		const harness = await mountPlanEditorCanvas();
		open = harness;
		const runtime = runtimeOf(harness);
		runtime.setTool('draw-polygon');
		click(harness.canvasEl, 600, 500);
		pointer(harness.canvasEl, 'pointerdown', 700, 500); // a press whose release never comes
		expect(runtime.toolManager.gestureInFlight).toBe(true);

		resizeTo(harness.rootEl, 320, 800);
		await settle();
		resizeTo(harness.rootEl, 1280, 800);
		await settle();

		expect(runtime.toolManager.gestureInFlight).toBe(false);
		expect(runtime.activeToolId.value).toBe('draw-polygon');
		// TWO, and the number is the discrimination: this tool places its vertex on the PRESS,
		// so both the completed click and the interrupted press left one, and its
		// `abandonGesture` is a documented no-op because there is nothing a missing release
		// would have completed. A `cancelGesture()` at this door would leave none.
		expect(runtime.renderState.polygonSketch?.vertices).toHaveLength(2);
	});

	it('an open Add menu does not survive the canvas being unmounted below the floor width', async () => {
		const harness = await mountPlanEditorCanvas();
		open = harness;
		await harness.wrapper.find('button[data-rp-action="add"]').trigger('click');
		await settle();
		expect(harness.wrapper.find('[role="menu"]').exists()).toBe(true);

		resizeTo(harness.rootEl, 320, 800);
		await settle();
		resizeTo(harness.rootEl, 1280, 800);
		await settle();

		expect(harness.wrapper.find('[role="menu"]').exists()).toBe(false);
		const add = harness.wrapper.find('button[data-rp-action="add"]');
		expect(add.attributes('aria-expanded')).toBe('false');

		await add.trigger('click');
		await settle();
		expect(harness.wrapper.find('[role="menu"]').exists()).toBe(true);
		// The anchor is the NEW button — Escape returns focus to an element still in the document.
		harness.wrapper.find('.rp-add-menu').element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		await settle();
		expect(document.activeElement).toBe(add.element);
		expect(document.activeElement?.isConnected).toBe(true);
	});

	/**
	 * [[Selection clearing is silent while the constrained Inspector is closed]] (R15): the
	 * transition watcher and its `role="status"` region moved out of `EntityInspector` into
	 * `SelectionGuidance.vue`, mounted by `PlanEditorRoot` at shell level so it stays mounted
	 * in every layout mode — including `constrained` with the drawer closed, where
	 * `EntityInspector` itself is unmounted and therefore has nothing to observe the clear.
	 */
	it('announces the return to the floor once even while the constrained drawer is closed, and not again on a refresh', async () => {
		const harness = await mountPlanEditorCanvas();
		open = harness;
		resizeTo(harness.rootEl, 460, 800);
		await settle();
		expect(harness.wrapper.find('.rp-inspector-drawer').exists()).toBe(false); // the Inspector is unmounted here
		useSelectionStore().select(['zone-kitchen' as never]);
		await settle();

		useSelectionStore().clear();
		await nextTick();
		expect(harness.wrapper.find('.rp-selection-guidance[role="status"]').text()).toBe(t('en', 'editor.inspector.floor.guidance'));

		harness.changePlan();
		await settle();
		expect(harness.wrapper.find('.rp-selection-guidance').text()).toBe('');
	});

	it('disconnects its observer on unmount', async () => {
		const before = connectedObservers();
		const harness = await mountPlanEditorCanvas();
		open = harness;
		// Narrow first, so the canvas — which observes its own container — is gone and the
		// shell's observer is the only one this mount still holds.
		resizeTo(harness.rootEl, 320, 800);
		await settle();
		expect(connectedObservers()).toBe(before + 1);

		harness.unmount();
		open = null;
		await settle();

		expect(connectedObservers()).toBe(before);
	});
});
