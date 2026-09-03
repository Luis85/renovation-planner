// @vitest-environment jsdom
/**
 * Task 18's temporary task banner: names the active creation task over the canvas and gives a
 * mouse user a Cancel button. NOT `routeEscape` (R7, 2026-09-04): Cancel LEAVES the active task
 * in one gesture — clears any draft and returns to Select — where Escape instead steps back one
 * interaction at a time. `TemporaryToolBanner.vue`'s own header carries the rest of the design;
 * this file is scoped to what THIS surface draws and what pressing Cancel actually does.
 */
import { describe, expect, it } from 'vitest';
import { t } from '../../../../src/presentation/i18n/strings';
import { useSelectionStore } from '../../../../src/presentation/editor/selection/selection-store';
import { mountPlanEditorCanvas, runtimeOf, settle } from '../../../helpers/editor';
import { click } from '../../../helpers/planEditorRig';

describe('TemporaryToolBanner', () => {
	it('is absent under Select and names the task under a creation tool', async () => {
		const harness = await mountPlanEditorCanvas();
		expect(harness.wrapper.find('.rp-task-banner').exists()).toBe(false);
		runtimeOf(harness).setTool('draw-polygon');
		await settle();
		expect(harness.wrapper.find('.rp-task-banner').text()).toContain(t('en', 'editor.task.draw-room.name'));
	});

	it('Cancel returns to Select whether or not a draft exists, and a drafted room is discarded with it', async () => {
		const harness = await mountPlanEditorCanvas();
		const runtime = runtimeOf(harness);
		runtime.setTool('draw-polygon');
		await settle();
		await harness.wrapper.find('.rp-task-banner button').trigger('click');
		expect(runtime.activeToolId.value).toBe('select');
		expect(harness.wrapper.find('.rp-task-banner').exists()).toBe(false);

		runtime.setTool('draw-polygon');
		click(harness.canvasEl, 100, 100); // one vertex placed
		await settle();
		expect(runtime.renderState.polygonSketch).not.toBeNull();
		await harness.wrapper.find('.rp-task-banner button').trigger('click');
		await settle();

		// Cancel LEAVES the task (PBI criterion 7, main flow step 6); Escape is the key that steps
		// back one interaction at a time. The two are different questions since 2026-09-04 (R7).
		expect(runtime.activeToolId.value).toBe('select');
		expect(runtime.renderState.polygonSketch).toBeNull();
		expect(harness.wrapper.find('.rp-task-banner').exists()).toBe(false);
	});

	it('Cancel under Select is a no-op: nothing to leave, and the selection is untouched', async () => {
		const harness = await mountPlanEditorCanvas();
		const runtime = runtimeOf(harness);
		useSelectionStore(harness.pinia).select(['zone-kitchen' as never]);
		runtime.cancelActiveTask();
		expect(runtime.activeToolId.value).toBe('select');
		expect(useSelectionStore(harness.pinia).selectedIds).toEqual(['zone-kitchen']);
	});

	/**
	 * The `TASKS` table's second entry, exercised on its own: the first test above only ever
	 * drives `draw-polygon`, so nothing yet asked the lookup to answer for `calibrate`.
	 */
	it('names the calibrate task under the calibrate tool', async () => {
		const harness = await mountPlanEditorCanvas();
		runtimeOf(harness).setTool('calibrate');
		await settle();
		expect(harness.wrapper.find('.rp-task-banner').text()).toContain(t('en', 'editor.task.calibrate.name'));
	});
});
