// @vitest-environment jsdom
/**
 * Task 18's temporary task banner: names the active creation task over the canvas and gives a
 * mouse user a Cancel button. NOT `routeEscape` (R7, 2026-09-04): Cancel LEAVES the active task
 * in one gesture — clears any draft and returns to Select — where Escape instead steps back one
 * interaction at a time. `TemporaryToolBanner.vue`'s own header carries the rest of the design;
 * this file is scoped to what THIS surface draws and what pressing Cancel actually does.
 */
import { describe, expect, it, vi } from 'vitest';
import { t } from '../../../../src/presentation/i18n/strings';
import { useSelectionStore } from '../../../../src/presentation/editor/selection/selection-store';
import { mountPlanEditorCanvas, runtimeOf, settle, settleUntil as until } from '../../../helpers/editor';
import { activateTool, click, PLAN_DTO, rig } from '../../../helpers/planEditorRig';
import { expectOk } from '../../../helpers/domain';

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

	it('Cancel under camera mode (no active tool) is a no-op too: nothing to leave', async () => {
		const harness = await mountPlanEditorCanvas();
		const runtime = runtimeOf(harness);
		activateTool(harness, null);
		useSelectionStore(harness.pinia).select(['zone-kitchen' as never]);
		runtime.cancelActiveTask();
		expect(runtime.activeToolId.value).toBeNull();
		expect(useSelectionStore(harness.pinia).selectedIds).toEqual(['zone-kitchen']);
		expect(harness.wrapper.find('.rp-task-banner').exists()).toBe(false);
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

	it('names the room task and offers Finish, aria-disabled with its reason until the draft is valid', async () => {
		const harness = await mountPlanEditorCanvas();
		const runtime = runtimeOf(harness);
		runtime.setTool('draw-room');
		await settle();
		const banner = harness.wrapper.find('.rp-task-banner');
		expect(banner.text()).toContain(t('en', 'editor.task.add-room.name'));
		const finish = banner.find('button.rp-task-banner__finish');
		expect(finish.attributes('aria-disabled')).toBe('true');
		expect(harness.wrapper.find(`#${finish.attributes('aria-describedby')}`).text()).toBe(t('en', 'editor.task.add-room.instruction'));
		runtime.roomDraft.setRect({ x: 0, y: 0, width: 1000, depth: 1000 });
		await settle();
		expect(finish.attributes('aria-disabled')).toBe('false');
	});

	it('offers no Finish under the calibrate tool, which finishes by gesture', async () => {
		const harness = await mountPlanEditorCanvas();
		runtimeOf(harness).setTool('calibrate');
		await settle();
		expect(harness.wrapper.find('button.rp-task-banner__finish').exists()).toBe(false);
	});

	it('Finish creates the room through the same action as the form, and focus lands on the canvas', async () => {
		const { harness, zonesRepo } = await rig();
		const runtime = runtimeOf(harness);
		runtime.setTool('draw-room');
		await settle();
		runtime.roomDraft.setRect({ x: 0, y: 0, width: 4200, depth: 3800 });
		await settle();
		const finish = harness.wrapper.find('button.rp-task-banner__finish');
		(finish.element as HTMLButtonElement).focus();
		await finish.trigger('click');
		await until(async () => expectOk(await zonesRepo.listByPlan(PLAN_DTO.id as never)).loaded.length === 2, 'the room to be written');
		await settle();
		expect(runtime.activeToolId.value).toBe('select');
		expect(document.activeElement).toBe(harness.canvasEl);
	});

	/**
	 * `onFinish` guards on `canCreateRoom` the same way `NewRoomInspector`'s `onCreate` does
	 * (`newRoomInspector.test.ts`'s "pressing Create while the draft is incomplete writes
	 * nothing"): a click on an `aria-disabled` button still fires, so the promise the
	 * attribute makes is kept at the control only if the handler asks again. The outcome
	 * assertions alone would not discriminate a guarded build from an unguarded one whose
	 * command independently refuses an invalid draft — `createRoomFromDraft` answers
	 * `'invalid'` for this same draft — so the spy on `runtime.createRoom` is what tells them
	 * apart. Mutation-checked: deleting the guard reddens this case at `not.toHaveBeenCalled()`.
	 */
	it('pressing Finish while the draft is incomplete calls no action and leaves the tool in place', async () => {
		const { harness, zonesRepo } = await rig();
		const runtime = runtimeOf(harness);
		runtime.setTool('draw-room'); // sized never — draft invalid
		await settle();
		const finish = harness.wrapper.find('button.rp-task-banner__finish');
		expect(finish.attributes('aria-disabled')).toBe('true');
		const createRoom = vi.spyOn(runtime, 'createRoom');
		await finish.trigger('click');
		await settle();
		expect(createRoom).not.toHaveBeenCalled();
		expect(expectOk(await zonesRepo.listByPlan(PLAN_DTO.id as never)).loaded).toHaveLength(1);
		expect(runtime.activeToolId.value).toBe('draw-room');
	});
});
