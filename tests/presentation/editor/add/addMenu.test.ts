// @vitest-environment jsdom
/**
 * Task 17's Add menu — the live control behind `FloatingPrimaryActions`'s Add button
 * (Task 13 shipped it disabled). Driven through the real mounted Plan Editor tree
 * (`mountPlanEditorCanvas`), never a fixture typed into this file, so what is asserted here
 * is what a user actually presses. The last `describe` block mounts the menu standalone,
 * for the one case the real tree cannot drive: a `null` anchor.
 */
import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { mountPlanEditorCanvas, runtimeOf, settle } from '../../../helpers/editor';
import { useSelectionStore } from '../../../../src/presentation/editor/selection/selection-store';
import type { EditorHarness } from '../../../helpers/editor';
import AddMenu from '../../../../src/presentation/editor/add/AddMenu.vue';
import { EDITOR_RUNTIME, type EditorRuntime } from '../../../../src/presentation/editor/runtime';
import type { ToolId } from '../../../../src/presentation/editor/tools/editor-tool';

/** The one gesture every case starts from: pressing the Add button. */
async function openAdd(harness: EditorHarness): Promise<void> {
	await harness.wrapper.find('button[data-rp-action="add"]').trigger('click');
}

describe('the Add menu', () => {
	it('opens from Add, focuses Room, and closes on Escape with focus back on Add and nothing dispatched', async () => {
		const harness = await mountPlanEditorCanvas();
		await openAdd(harness);
		await settle();

		const menu = harness.wrapper.find('[role="menu"]');
		expect(menu.exists()).toBe(true);
		expect(document.activeElement?.getAttribute('data-rp-entry')).toBe('room');

		menu.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		await settle();

		expect(harness.wrapper.find('[role="menu"]').exists()).toBe(false);
		expect(document.activeElement?.getAttribute('data-rp-action')).toBe('add');
		expect(runtimeOf(harness).activeToolId.value).toBe('select');
	});

	it('ArrowDown moves focus through enabled and disabled items alike; Enter on Room starts exactly one tool and closes', async () => {
		const harness = await mountPlanEditorCanvas();
		await openAdd(harness);
		await settle();

		const menu = harness.wrapper.find('[role="menu"]');
		menu.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
		await settle();
		expect(document.activeElement?.getAttribute('data-rp-entry')).toBe('wall');

		menu.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
		await settle();
		expect(document.activeElement?.getAttribute('data-rp-entry')).toBe('room');

		menu.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		await settle();

		expect(harness.wrapper.find('[role="menu"]').exists()).toBe(false);
		expect(runtimeOf(harness).activeToolId.value).toBe('draw-polygon');
	});

	it('End jumps to the last item in the flat, filtered list', async () => {
		const harness = await mountPlanEditorCanvas();
		await openAdd(harness);
		await settle();

		const menu = harness.wrapper.find('[role="menu"]');
		menu.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
		await settle();
		expect(document.activeElement?.getAttribute('data-rp-entry')).toBe('note');
	});

	it('an unsupported item is aria-disabled with its reason and Enter on it changes nothing', async () => {
		const harness = await mountPlanEditorCanvas();
		await openAdd(harness);
		await settle();

		const menu = harness.wrapper.find('[role="menu"]');
		const wall = harness.wrapper.find('[data-rp-entry="wall"]');
		expect(wall.attributes('aria-disabled')).toBe('true');
		const reasonId = wall.attributes('aria-describedby');
		expect(reasonId).toBeDefined();
		expect(harness.wrapper.find(`#${reasonId}`).text()).toBe('Not available in this version yet.');

		menu.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
		await settle();
		expect(document.activeElement?.getAttribute('data-rp-entry')).toBe('wall');
		menu.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		await settle();

		// Still open, and nothing dispatched: the runtime never left camera-select for a tool.
		expect(harness.wrapper.find('[role="menu"]').exists()).toBe(true);
		expect(runtimeOf(harness).activeToolId.value).toBe('select');
	});

	it('typing filters by localized label and synonym', async () => {
		const harness = await mountPlanEditorCanvas();
		await openAdd(harness);
		await settle();

		await harness.wrapper.find('.rp-add-menu__search').setValue('kitch');
		await settle();

		const items = harness.wrapper.findAll('[role="menuitem"]');
		expect(items).toHaveLength(1);
		expect(items[0].attributes('data-rp-entry')).toBe('room');
	});

	it('click outside closes without dispatch', async () => {
		const harness = await mountPlanEditorCanvas();
		await openAdd(harness);
		await settle();

		document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
		await settle();

		expect(harness.wrapper.find('[role="menu"]').exists()).toBe(false);
		expect(runtimeOf(harness).activeToolId.value).toBe('select');
	});

	it('Escape reaches the menu and never the canvas: a selected zone stays selected', async () => {
		const harness = await mountPlanEditorCanvas();
		useSelectionStore(harness.pinia).select(['zone-kitchen' as never]);
		await openAdd(harness);
		await settle();

		const menu = harness.wrapper.find('[role="menu"]');
		menu.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		await settle();

		expect(harness.wrapper.find('[role="menu"]').exists()).toBe(false);
		expect(useSelectionStore(harness.pinia).selectedIds).toEqual(['zone-kitchen']);
	});

	it('ArrowUp from the first item wraps to the last, and ArrowDown from the last wraps to the first', async () => {
		const harness = await mountPlanEditorCanvas();
		await openAdd(harness);
		await settle();

		const menu = harness.wrapper.find('[role="menu"]');
		menu.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
		await settle();
		expect(document.activeElement?.getAttribute('data-rp-entry')).toBe('note');

		menu.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
		await settle();
		expect(document.activeElement?.getAttribute('data-rp-entry')).toBe('room');
	});

	it('Space activates the focused available item, exactly like Enter', async () => {
		const harness = await mountPlanEditorCanvas();
		await openAdd(harness);
		await settle();

		harness.wrapper.find('[role="menu"]').element.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
		await settle();

		expect(harness.wrapper.find('[role="menu"]').exists()).toBe(false);
		expect(runtimeOf(harness).activeToolId.value).toBe('draw-polygon');
	});

	it('Space on an unsupported item changes nothing', async () => {
		const harness = await mountPlanEditorCanvas();
		await openAdd(harness);
		await settle();

		const menu = harness.wrapper.find('[role="menu"]');
		menu.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
		await settle();
		menu.element.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
		await settle();

		expect(harness.wrapper.find('[role="menu"]').exists()).toBe(true);
		expect(runtimeOf(harness).activeToolId.value).toBe('select');
	});

	it('Home, End and Space are withheld while the search input itself has focus', async () => {
		const harness = await mountPlanEditorCanvas();
		await openAdd(harness);
		await settle();

		// Room is focused after open (asserted by the first case); ArrowDown moves the roving
		// focus to Wall so a withheld Home/End would be visible against a DIFFERENT starting point.
		harness.wrapper.find('[role="menu"]').element.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
		await settle();
		expect(document.activeElement?.getAttribute('data-rp-entry')).toBe('wall');

		// `cancelable: true` is load-bearing on the assertion below: an event constructed
		// without it reports `defaultPrevented === false` NO MATTER what the handler does —
		// jsdom (correctly, per spec) only sets that flag on a call to `preventDefault()` when
		// the event itself is cancelable — so this is what actually proves the code withheld
		// the call rather than merely proving a claim about an event that could never disagree.
		const search = harness.wrapper.find('.rp-add-menu__search').element;
		for (const key of ['Home', 'End', ' ']) {
			const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
			search.dispatchEvent(event);
			// The mechanism that lets the browser insert the character / move the caret:
			// withholding `preventDefault()` is what a native editing gesture needs, not merely
			// a side effect of this menu doing nothing.
			expect(event.defaultPrevented, `${key} must not be prevented in the search input`).toBe(false);
		}
		await settle();

		// The roving focus never moved off Wall, and nothing was dispatched.
		expect(document.activeElement?.getAttribute('data-rp-entry')).toBe('wall');
		expect(harness.wrapper.find('[role="menu"]').exists()).toBe(true);
		expect(runtimeOf(harness).activeToolId.value).toBe('select');
	});

	/**
	 * A mouse click and a keyboard Enter/Space are two different doors onto the same
	 * `activate` — `onItemClick` is the mouse one, and it never got a case of its own before
	 * this: every other case in this file drives a `keydown` on the menu root, so a click
	 * straight on an item's own `@click` was untested.
	 */
	it('clicking an item works too: Room activates and closes, an unsupported item does nothing', async () => {
		const harness = await mountPlanEditorCanvas();
		await openAdd(harness);
		await settle();

		await harness.wrapper.find('[data-rp-entry="wall"]').trigger('click');
		await settle();
		expect(harness.wrapper.find('[role="menu"]').exists()).toBe(true);
		expect(runtimeOf(harness).activeToolId.value).toBe('select');

		await harness.wrapper.find('[data-rp-entry="room"]').trigger('click');
		await settle();
		expect(harness.wrapper.find('[role="menu"]').exists()).toBe(false);
		expect(runtimeOf(harness).activeToolId.value).toBe('draw-polygon');
	});

	/**
	 * A press inside the menu, or on the Add button that opened it, genuinely reaches
	 * `onDocumentPointerDown` and takes its "inside"/"on the anchor" early-returns — CAPTURE
	 * is what makes that true. Both elements sit inside `EditorSurface`'s `.rp-plan-overlay`,
	 * whose own `@pointerdown.stop` (Task 8) is a BUBBLE-phase listener; the menu's own
	 * listener runs on `document` with `{ capture: true }` (review round 1's fix — see
	 * `AddMenu.vue`'s docblock), which fires on the way DOWN to the target, before that
	 * bubble-phase `stopPropagation()` ever gets a chance to run. Before that fix this case
	 * passed for the wrong reason: the press never reached the listener at all, so it would
	 * have passed just as well with the "inside"/"on the anchor" checks deleted outright.
	 */
	it('a press inside the menu, or on the button that opened it, does not close the menu', async () => {
		const harness = await mountPlanEditorCanvas();
		await openAdd(harness);
		await settle();

		harness.wrapper
			.find('.rp-add-menu__search')
			.element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
		await settle();
		expect(harness.wrapper.find('[role="menu"]').exists()).toBe(true);

		harness.wrapper
			.find('button[data-rp-action="add"]')
			.element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
		await settle();
		expect(harness.wrapper.find('[role="menu"]').exists()).toBe(true);
	});

	/**
	 * The finding review round 1 caught: `FloatingPrimaryActions` (Select and Add) and
	 * `AddMenu` are SIBLINGS inside the same `.rp-plan-overlay`, so a press on Select used to
	 * be swallowed by that wrapper's bubble-phase `.stop` exactly like a press on the canvas
	 * was — the menu stayed open above the canvas after the user switched tools, silently.
	 * `{ capture: true }` is what closes it: Select's own `pointerdown` still reaches
	 * `document`'s capture-phase listener first, closing the menu, and its ordinary `click`
	 * handler still runs afterward and sets the tool exactly as it always did.
	 */
	it('pressing Select while the Add menu is open closes the menu, and Select still works', async () => {
		const harness = await mountPlanEditorCanvas();
		await openAdd(harness);
		await settle();

		const select = harness.wrapper.find('button[data-rp-action="select"]');
		select.element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
		await select.trigger('click');
		await settle();

		expect(harness.wrapper.find('[role="menu"]').exists()).toBe(false);
		expect(runtimeOf(harness).activeToolId.value).toBe('select');
	});

	it('a query matching nothing empties the list, and every navigation key is a safe no-op', async () => {
		const harness = await mountPlanEditorCanvas();
		await openAdd(harness);
		await settle();

		await harness.wrapper.find('.rp-add-menu__search').setValue('zzzzz');
		await settle();

		expect(harness.wrapper.findAll('[role="menuitem"]')).toHaveLength(0);

		const menu = harness.wrapper.find('[role="menu"]');
		for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter']) {
			menu.element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
		}
		await settle();

		// Still open, and nothing dispatched — an empty result cannot activate or crash.
		expect(harness.wrapper.find('[role="menu"]').exists()).toBe(true);
		expect(runtimeOf(harness).activeToolId.value).toBe('select');
	});

	it('narrowing the filter past the focused item moves the roving focus to the first remaining one', async () => {
		const harness = await mountPlanEditorCanvas();
		await openAdd(harness);
		await settle();
		expect(document.activeElement?.getAttribute('data-rp-entry')).toBe('room');

		// "wall" matches Wall's own label and excludes Room, so the roving `tabindex` — a fact
		// about `focusedId` rather than about DOM focus, which stays in the search input while
		// typing — has to move off an item the filter just removed.
		await harness.wrapper.find('.rp-add-menu__search').setValue('wall');
		await settle();

		expect(harness.wrapper.find('[data-rp-entry="wall"]').attributes('tabindex')).toBe('0');
		expect(harness.wrapper.find('[data-rp-entry="room"]').exists()).toBe(false);
	});
});

describe('the Add menu, mounted standalone', () => {
	/**
	 * `PlanEditorRoot` always resolves a real Add button before opening this menu, so the real
	 * tree can never drive `anchor: null` — the one shape `PlanEditorRoot.vue`'s own docblock
	 * still declares (`anchor: HTMLElement | null`). Mounted here directly, with a stub
	 * `EditorRuntime` the same shape `roomSummaryList.test.ts` uses for a component that
	 * cannot supply its one dependency to itself.
	 */
	it('does not throw with no anchor to return focus to, and closes on a press outside with no anchor to except', async () => {
		const setTool = vi.fn<(id: ToolId | null) => void>();
		const runtime = { setTool } as unknown as EditorRuntime;
		const wrapper = mount(AddMenu, {
			props: { anchor: null },
			attachTo: document.body,
			global: { provide: { [EDITOR_RUNTIME as symbol]: runtime } },
		});
		await nextTick();

		document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
		await nextTick();
		expect(wrapper.emitted('close')).toHaveLength(1);

		expect(() => wrapper.unmount()).not.toThrow();
	});
});
