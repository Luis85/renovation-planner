// @vitest-environment jsdom
/**
 * Task 13's floating Select/Add group, over the canvas. Task 17 made Add live: it carries
 * `aria-haspopup="menu"` and an `aria-expanded` that follows `PlanEditorRoot`'s own
 * `addMenuOpen`, and pressing it really opens `AddMenu` — see
 * `tests/presentation/editor/add/addMenu.test.ts` for the menu itself. This file stays scoped
 * to what THIS component draws and emits, never the menu's own behaviour.
 */
import { describe, expect, it } from 'vitest';
import FloatingPrimaryActions from '../../../../src/presentation/editor/shell/FloatingPrimaryActions.vue';
import { mountPlanEditorCanvas, runtimeOf, settle } from '../../../helpers/editor';

describe('FloatingPrimaryActions', () => {
	it('presses Select while the select tool is active', async () => {
		const harness = await mountPlanEditorCanvas();
		const select = harness.wrapper.find('button[data-rp-action="select"]');
		expect(select.attributes('aria-pressed')).toBe('true'); // Task 10 made it the default
		const runtime = runtimeOf(harness);
		runtime.setTool('draw-polygon');
		await settle();
		expect(select.attributes('aria-pressed')).toBe('false');
		await select.trigger('click');
		expect(runtime.activeToolId.value).toBe('select');
	});

	/**
	 * `aria-haspopup="menu"` and no `disabled`: Task 13's live-control-that-does-nothing
	 * amendment refused BOTH the disabled button (a live one telling a screen reader a menu
	 * is coming would have been worse than one that plainly did nothing) until the menu it
	 * announces actually existed. `aria-expanded` follows the real menu's presence, driven
	 * through the same click a user would press.
	 */
	it('renders Add live, with aria-haspopup="menu" and aria-expanded reflecting whether the menu is open', async () => {
		const harness = await mountPlanEditorCanvas();
		const add = () => harness.wrapper.find('button[data-rp-action="add"]');

		expect(add().attributes('disabled')).toBeUndefined();
		expect(add().attributes('aria-haspopup')).toBe('menu');
		expect(add().attributes('aria-expanded')).toBe('false');

		await add().trigger('click');
		await settle();

		expect(add().attributes('aria-expanded')).toBe('true');
		expect(harness.wrapper.find('[role="menu"]').exists()).toBe(true);
	});

	/**
	 * The WIRING, not the menu's own behaviour: `FloatingPrimaryActions.vue`'s own click
	 * handler emits `openAdd`, found through the component wrapper within the real mounted
	 * tree — which is what proves the real runtime is composed the way a user would find it,
	 * rather than a hand-built stub agreeing with itself.
	 */
	it('emits openAdd when pressed', async () => {
		const harness = await mountPlanEditorCanvas();
		const primaryActions = harness.wrapper.findComponent(FloatingPrimaryActions);

		await primaryActions.find('button[data-rp-action="add"]').trigger('click');

		expect(primaryActions.emitted('openAdd')).toHaveLength(1);
	});
});
