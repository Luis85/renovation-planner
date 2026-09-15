// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { expectDefined, expectOk } from '../../helpers/domain';
import { settle, settleUntil } from '../../helpers/editor';
import { elementInput } from '../../../src/presentation/editor/elements/elementInput';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';
import { worldToScreen, STAGE_PIXELS } from '../../../src/presentation/editor/viewport/Viewport';
import { pointer } from '../../helpers/planEditorRig';
import type { Point } from '../../../src/core/geometry/Point';

const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });
const object = { id: 'element-hover-object', kind: 'object' as const, name: 'Desk', points: [{ x: 500, y: 500 }, { x: 2500, y: 500 }, { x: 2500, y: 1500 }, { x: 500, y: 1500 }] };
async function setup() {
	const rig = await renovationEditor(); mounted.push(rig); rig.changePlan(); await settle();
	const before = expectOk(await rig.renovation.read(rig.plan.id));
	expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(before, elementInput(before, object), rig.runtime.structureTask.ledger)));
	rig.selection.clear(); await settle();
	const editor = useEditorStore(rig.pinia), canvas = expectDefined(rig.canvasEl, 'native canvas');
	const at = (point: Point) => { const local = worldToScreen(point, editor.viewport, STAGE_PIXELS), bounds = canvas.getBoundingClientRect(); return { x: local.x + bounds.left, y: local.y + bounds.top }; };
	const hover = async (point: Point) => { const screen = at(point); pointer(canvas, 'pointermove', screen.x, screen.y, 0, 1, 0); await settle(); };
	return { ...rig, editor, canvas, at, hover };
}
it('draws the arrow on a stem above the selected object only, and opens the precise angle when it is clicked', async () => {
	const rig = await setup(), bytes = [...rig.stack.vault.entries];
	await rig.hover({ x: 1500, y: 1000 });
	expect(rig.runtime.rotationActions.displayControls.value).toEqual([]);
	expect(rig.stage.find('.object-rotation-handle')).toHaveLength(0);
	rig.selection.select([object.id as never]); await settle();
	const control = expectDefined(rig.runtime.rotationActions.displayControls.value[0], 'selected object control');
	expect(control.anchor).toEqual({ x: 1500, y: 500 }); expect(control.handle.x).toBe(1500); expect(control.handle.y).toBeLessThan(500);
	expect(rig.stage.find('.rotation-handle-stem')).toHaveLength(1);
	await rig.hover(control.handle);
	expect(rig.runtime.renderState.hoveredTargetKind).toBe('rotation');
	expect(rig.stage.find('.rotation-pivot')).toHaveLength(1);
	const start = rig.at(control.handle); pointer(rig.canvas, 'pointerdown', start.x, start.y); await settle();
	expect(rig.runtime.renderState.rotationInteraction?.dragging).toBe(false);
	pointer(rig.canvas, 'pointerup', start.x + 3, start.y);
	await settleUntil(() => rig.wrapper.find('[data-rp-form="object-rotation"]').exists(), 'precise angle after arrow click');
	expect([...rig.stack.vault.entries]).toEqual(bytes);
	await rig.wrapper.get('[data-rp-form="object-rotation"] [name="angle"]').trigger('keydown', { key: 'Escape' }); await settle();
	pointer(rig.canvas, 'pointerleave', start.x, start.y, 0, 1, 0); await settle();
	expect(rig.stage.find('.object-rotation-handle')).toHaveLength(1);
	expect(rig.selection.selectedIds).toEqual([object.id]); expect([...rig.stack.vault.entries]).toEqual(bytes);
});
it('offers one arrow for a multi-selection and hides it while Alt bypasses rotation', async () => {
	const rig = await setup(); rig.selection.select([rig.room.id, object.id as never]); await settle();
	const bytes = [...rig.stack.vault.entries];
	const group = expectDefined(rig.runtime.rotationActions.target.value, 'selected group target');
	expect(group.kind).toBe('group'); expect(group.group?.selectionIds).toEqual([rig.room.id, object.id]);
	expect(rig.runtime.rotationActions.displayControls.value).toHaveLength(1);
	expect(rig.stage.find('.rotation-control-target')).toHaveLength(1);
	const point = rig.at({ x: 1500, y: 1000 });
	rig.canvas.dispatchEvent(new PointerEvent('pointermove', { clientX: point.x, clientY: point.y, button: 0, buttons: 0, pointerId: 1, altKey: true, bubbles: true })); await settle();
	expect(rig.stage.find('.object-rotation-handle')).toHaveLength(0);
	await rig.hover({ x: 1500, y: 1000 });
	expect(rig.stage.find('.object-rotation-handle')).toHaveLength(1);
	expect(rig.selection.selectedIds).toEqual([rig.room.id, object.id]); expect([...rig.stack.vault.entries]).toEqual(bytes);
});
