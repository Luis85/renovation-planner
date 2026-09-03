// @vitest-environment jsdom
/**
 * Task 13's floating Select/Add group, over the canvas. `openAdd` is Task 18's own door — the
 * root ignores it until then (`() => {}`).
 */
import { describe, expect, it } from 'vitest';
import { mountPlanEditorCanvas, runtimeOf, settle } from '../../../helpers/editor';

describe('FloatingPrimaryActions', () => {
	it('presses Select while the select tool is active and emits openAdd from Add', async () => {
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
});
