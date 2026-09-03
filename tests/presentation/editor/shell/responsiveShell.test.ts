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
import { t } from '../../../../src/presentation/i18n/strings';
import { useSelectionStore } from '../../../../src/presentation/editor/selection/selection-store';
import { useEditorStore } from '../../../../src/presentation/stores/EditorStore';
import { mountPlanEditor, mountPlanEditorCanvas, settle, type EditorHarness } from '../../../helpers/editor';
import { connectedObservers, resizeTo } from '../../../helpers/layout';

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

	it('below the floor width replaces the canvas with a summary and a Focus this tab action that asks the leaf', async () => {
		const harness = await mountPlanEditorCanvas();
		open = harness;

		resizeTo(harness.rootEl, 320, 800);
		await settle();

		expect(harness.rootEl.dataset.layout).toBe('unsupported');
		expect(harness.wrapper.find('.rp-plan-canvas').exists()).toBe(false);
		const notice = harness.wrapper.find('.rp-unsupported-width');
		expect(notice.text()).toContain(t('en', 'editor.unsupported-width.headline'));
		// `Ground floor` is FIXTURE_PLAN's name and `1` its only Room — the two holes the body
		// interpolates, asserted through what the user reads rather than through the params.
		expect(notice.text()).toContain('Ground floor');
		expect(notice.text()).toContain('1');
		expect(notice.text()).not.toContain('{');

		await notice.find('button').trigger('click');
		expect(harness.focusedLeaf()).toBe(1);

		resizeTo(harness.rootEl, 1280, 800);
		await settle();
		expect(harness.wrapper.find('.rp-plan-canvas').exists()).toBe(true);
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
