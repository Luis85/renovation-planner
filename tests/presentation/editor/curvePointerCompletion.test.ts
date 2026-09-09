// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { expectDefined, expectOk } from '../../helpers/domain';
import { settle, settleUntil } from '../../helpers/editor';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';
import { STAGE_PIXELS, worldToScreen } from '../../../src/presentation/editor/viewport/Viewport';
import type { Point } from '../../../src/core/geometry/Point';
import { defer } from '../../helpers/async';

const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); vi.restoreAllMocks(); });
async function setup() {
	const rig = await renovationEditor(); mounted.push(rig); rig.changePlan(); await settle();
	const editor = useEditorStore(rig.pinia), canvas = expectDefined(rig.canvasEl, 'native canvas');
	function pointer(type: string, world: Point, buttons: number, modifiers: Pick<PointerEventInit, 'shiftKey' | 'altKey'> = {}): void {
		const screen = worldToScreen(world, editor.viewport, STAGE_PIXELS), bounds = canvas.getBoundingClientRect();
		canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, button: 0, buttons,
			clientX: bounds.left + screen.x, clientY: bounds.top + screen.y, ...modifiers }));
	}
	return { ...rig, pointer };
}

it('uses the final native release point with Shift and Alt, refuses finish during a bend, then commits once with exact undo', async () => {
	const rig = await setup(), before = expectOk(await rig.geometry.read(rig.plan.id)).document;
	await rig.wrapper.get('[data-rp-action="edit-curves"]').trigger('click');
	await settleUntil(() => rig.runtime.curveTask.target.value !== null, 'curve baseline');
	const task = rig.runtime.curveTask, manager = rig.runtime.toolManager, handle = expectDefined(rig.stage.findOne('.curve-bend-0'), 'native bend handle');
	const start = handle.position(), write = vi.spyOn(rig.geometry, 'write');
	expect(manager.activeToolHasDraft()).toBe(true);
	rig.pointer('pointerdown', start, 1, { shiftKey: true, altKey: true });
	rig.pointer('pointermove', { x: start.x, y: start.y - 400 }, 1, { shiftKey: true, altKey: true }); await settle();
	expect(task.target.value?.geometry.bulges?.[0]).toBeCloseTo(0.2);
	manager.finishActiveTool(); await settle(); expect(write).not.toHaveBeenCalled();
	expect(rig.runtime.activeToolId.value).toBe('edit-curves');
	rig.pointer('pointerup', { x: start.x, y: start.y - 600 }, 0, { shiftKey: true, altKey: true }); await settle();
	expect(task.target.value?.geometry.bulges?.[0]).toBeCloseTo(0.3);
	expect(handle.x()).toBeCloseTo(start.x); expect(handle.y()).toBeCloseTo(start.y - 600);
	expect(manager.gestureInFlight).toBe(false); expect(write).not.toHaveBeenCalled();
	manager.finishActiveTool(); await settleUntil(() => rig.runtime.activeToolId.value === 'select', 'curve finish');
	expect(write).toHaveBeenCalledTimes(1); expect(rig.project.zones.get(rig.room.id)?.bulges?.[0]).toBeCloseTo(0.3);
	expect(manager.activeToolHasDraft()).toBe(false);
	await rig.runtime.undo(); await settle(); expect(expectOk(await rig.geometry.read(rig.plan.id)).document).toEqual(before);
});

it('has no admitted draft while the native curve task loads and cancels that lifetime without accepting a late read', async () => {
	const rig = await setup(), service = expectDefined(rig.deps.commands.groups, 'group geometry services');
	const result = await service.read(rig.plan.id), pending = defer<typeof result>(), bytes = [...rig.stack.vault.entries];
	vi.spyOn(service, 'read').mockReturnValueOnce(pending.promise);
	const opening = rig.runtime.curveTask.open(rig.room.id); await settle();
	expect(rig.runtime.activeToolId.value).toBe('edit-curves'); expect(rig.runtime.toolManager.activeToolHasDraft()).toBe(false);
	rig.pointer('pointerdown', { x: 2000, y: 0 }, 1); rig.pointer('pointerup', { x: 2000, y: -500 }, 0);
	expect(rig.runtime.curveTask.target.value).toBeNull(); expect(rig.stage.find('.curve-bend-0')).toHaveLength(0);
	rig.runtime.toolManager.cancelGesture(); await settle(); pending.resolve(result); await opening; await settle();
	expect(rig.runtime.activeToolId.value).toBe('select'); expect(rig.runtime.curveTask.target.value).toBeNull();
	expect([...rig.stack.vault.entries]).toEqual(bytes);
});
