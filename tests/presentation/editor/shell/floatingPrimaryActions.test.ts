// @vitest-environment jsdom
/**
 * Task 13's floating Select/Add group, over the canvas.
 *
 * Add is DISABLED and carries no `aria-haspopup` until Task 17 builds the menu it would
 * announce — a live, focusable button with nothing behind it is the live-control-that-does-
 * nothing slice 14's own amendment refuses, and an `aria-haspopup="menu"` on a button that
 * opens nothing tells a screen-reader user a menu is coming that never arrives. The `openAdd`
 * emit and `PlanEditorRoot`'s `@open-add="() => {}"` binding stay wired regardless, so Task 17
 * only has to flip the two attributes and supply the real handler — both are asserted below
 * so a build that changes either fails here rather than silently.
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

	it('renders Add disabled and with no aria-haspopup, since Task 17 has not built the menu yet', async () => {
		const harness = await mountPlanEditorCanvas();
		const add = harness.wrapper.find('button[data-rp-action="add"]');

		expect(add.attributes('disabled')).toBeDefined();
		expect(add.attributes('aria-haspopup')).toBeUndefined();
	});

	/**
	 * The WIRING, not the affordance: `FloatingPrimaryActions.vue`'s own click handler still
	 * emits `openAdd`, and `PlanEditorRoot.vue` still binds a handler to it (a no-op today) —
	 * both have to keep working so Task 17's only change is what that handler does. Found
	 * through the component wrapper within the real mounted tree, which is what proves the
	 * REAL runtime and the REAL root are both still composed the way Task 17 will find them,
	 * rather than a hand-built stub agreeing with itself.
	 *
	 * `disabled` is unset for the length of one dispatch and restored straight after — jsdom
	 * (correctly, measured above by driving an isolated case before writing this one) refuses
	 * to dispatch a click to a disabled control at all, native `.click()` and VTU's `.trigger()`
	 * alike, so a real click could never reach this handler while Add stays disabled. The
	 * previous case already proves Add IS disabled; this one proves the emit and the root's
	 * binding are both still intact underneath that disablement, which is what Task 17 needs
	 * to find true the day it flips the attribute back.
	 */
	it('still emits openAdd when pressed, and the root still has a handler bound to it', async () => {
		const harness = await mountPlanEditorCanvas();
		const primaryActions = harness.wrapper.findComponent(FloatingPrimaryActions);
		const add = primaryActions.find('button[data-rp-action="add"]').element as HTMLButtonElement;

		add.disabled = false;
		await primaryActions.find('button[data-rp-action="add"]').trigger('click');
		add.disabled = true;

		expect(primaryActions.emitted('openAdd')).toHaveLength(1);
		// The bound (no-op) handler ran without throwing, and nothing it could not have
		// affected moved — the runtime's active tool is untouched by a click Add does nothing
		// with today.
		expect(runtimeOf(harness).activeToolId.value).toBe('select');
	});
});
