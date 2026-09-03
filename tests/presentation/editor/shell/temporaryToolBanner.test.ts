// @vitest-environment jsdom
/**
 * Task 18's temporary task banner: names the active creation task over the canvas and gives a
 * mouse user the same Cancel `routeEscape` (Task 9) already gives a keyboard user through
 * Escape. `TemporaryToolBanner.vue`'s own header carries the rest of the design; this file is
 * scoped to what THIS surface draws and what pressing Cancel actually does.
 */
import { describe, expect, it } from 'vitest';
import { t } from '../../../../src/presentation/i18n/strings';
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

	it('Cancel with an empty draft returns to Select; Cancel with a draft clears the draft and keeps the tool', async () => {
		const harness = await mountPlanEditorCanvas();
		const runtime = runtimeOf(harness);
		runtime.setTool('draw-polygon');
		await settle();
		await harness.wrapper.find('.rp-task-banner button').trigger('click');
		expect(runtime.activeToolId.value).toBe('select');

		runtime.setTool('draw-polygon');
		click(harness.canvasEl, 100, 100); // one vertex placed
		await settle();
		await harness.wrapper.find('.rp-task-banner button').trigger('click');
		expect(runtime.activeToolId.value).toBe('draw-polygon');
		expect(runtime.renderState.polygonSketch).toBeNull();
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
