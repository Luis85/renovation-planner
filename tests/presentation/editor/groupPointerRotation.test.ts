// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { groupEditor } from '../../helpers/groupEditor';
import { expectDefined, expectOk } from '../../helpers/domain';
import { settle, settleUntil } from '../../helpers/editor';
import { pointer } from '../../helpers/planEditorRig';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';
import { worldToScreen, STAGE_PIXELS } from '../../../src/presentation/editor/viewport/Viewport';
import { rotationPivot } from '../../../src/presentation/editor/elements/objectRotation';
import type { Point } from '../../../src/core/geometry/Point';

const mounted: { unmount(): void }[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); vi.restoreAllMocks(); });
async function setup() {
	const rig = await groupEditor(); mounted.push(rig);
	const editor = useEditorStore(rig.pinia), canvas = expectDefined(rig.canvasEl, 'native canvas');
	const at = (point: Point) => { const local = worldToScreen(point, editor.viewport, STAGE_PIXELS), bounds = canvas.getBoundingClientRect(); return { x: local.x + bounds.left, y: local.y + bounds.top }; };
	const hover = at({ x: 1500, y: 1200 }); pointer(canvas, 'pointermove', hover.x, hover.y, 0, 1, 0); await settle();
	const control = expectDefined(rig.runtime.rotationActions.displayControls.value[0], 'group edge arrow');
	const shape = expectDefined(rig.runtime.rotationActions.target.value, 'saved group'), pivot = expectDefined(rotationPivot(shape), 'frozen group pivot');
	const start = at(control.handle), end = at({ x: pivot.x - (control.handle.y - pivot.y), y: pivot.y + (control.handle.x - pivot.x) });
	return { ...rig, canvas, start, end };
}
async function drag() {
	const rig = await setup(), before = expectOk(await rig.geometry.read(rig.plan.id)).document, ids = [...rig.selection.selectedIds];
	const originalWrite = rig.geometry.write.bind(rig.geometry), write = vi.spyOn(rig.geometry, 'write');
	pointer(rig.canvas, 'pointerdown', rig.start.x, rig.start.y);
	pointer(rig.canvas, 'pointermove', rig.end.x, rig.end.y); await settle();
	expect(rig.runtime.groupActions.preview.value).not.toBeNull(); expect(write).not.toHaveBeenCalled();
	expect(rig.selection.selectedIds).toEqual(ids);
	return { ...rig, before, ids, write, originalWrite };
}
it('releases an edge-arrow group rotation as one reversible command', async () => {
	const rig = await drag();
	let unblock!: () => void; const held = new Promise<void>(resolve => { unblock = resolve; });
	rig.write.mockImplementationOnce(async (...args) => { await held; return rig.originalWrite(...args); });
	pointer(rig.canvas, 'pointerup', rig.end.x, rig.end.y); await settleUntil(() => rig.write.mock.calls.length === 1, 'group pointer rotation write');
	// The released group stays rotated while its write is pending instead of flicking back.
	expect(rig.runtime.groupActions.preview.value).not.toBeNull(); unblock();
	await settleUntil(() => rig.write.mock.calls.length === 1 && !rig.runtime.groupActions.active.value, 'group pointer rotation saved');
	expect(rig.project.structure.walls[0].start.x).toBeCloseTo(3575, 9); expect(rig.project.structure.walls[0].start.y).toBeCloseTo(-575, 9);
	const after = expectOk(await rig.geometry.read(rig.plan.id)).document;
	await rig.runtime.undo(); expect(expectOk(await rig.geometry.read(rig.plan.id)).document).toEqual(rig.before);
	await rig.runtime.redo(); expect(expectOk(await rig.geometry.read(rig.plan.id)).document).toEqual(after); expect(rig.write).toHaveBeenCalledTimes(3);
	expect(rig.runtime.groupActions.preview.value).toBeNull(); expect(rig.selection.selectedIds).toEqual(rig.ids);
});
it('cancels an edge-arrow group rotation with Escape even when a late pointer release arrives', async () => {
	const rig = await drag();
	rig.canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
	pointer(rig.canvas, 'pointerup', rig.end.x, rig.end.y); await settle();
	expect(rig.write).not.toHaveBeenCalled(); expect(expectOk(await rig.geometry.read(rig.plan.id)).document).toEqual(rig.before);
	expect(rig.runtime.groupActions.preview.value).toBeNull(); expect(rig.selection.selectedIds).toEqual(rig.ids);
});
