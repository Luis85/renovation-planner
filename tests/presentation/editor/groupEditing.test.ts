// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { structureEditor } from '../../helpers/structureEditor';
import { makeZone } from '../../helpers/entities';
import { WALL_LOOP } from '../../helpers/structure';
import { expectDefined, expectFound, expectOk, injectedPersistenceError } from '../../helpers/domain';
import { err } from '../../../src/core/result/Result';
import { mountPlanEditorCanvas, runtimeOf, settle, settleUntil } from '../../helpers/editor';
import { useProjectStore } from '../../../src/presentation/stores/ProjectStore';
import { useSelectionStore } from '../../../src/presentation/editor/selection/selection-store';
import { pointerAt } from '../../helpers/tool-context';
import { useRenovationSession } from '../../../src/presentation/editor/renovation/renovationSession';
import { useWorkspaceStore } from '../../../src/presentation/stores/WorkspaceStore';
import { rotationPivot, rotationPoints } from '../../../src/presentation/editor/elements/objectRotation';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';
import { hoverRotation } from '../../helpers/rotationHover';
import { HARNESS_PLAN } from '../../harness/planEditor';

const mounted: { unmount(): void }[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); vi.restoreAllMocks(); });
async function setup(enclosed = true) {
	const rig = await structureEditor(); mounted.push(rig);
	const room = makeZone({ projectId: rig.plan.projectId, planId: rig.plan.id, zoneType: 'Room', name: 'Kitchen', geometry: { points: WALL_LOOP.walls.map(wall => wall.start) } });
	expectOk(await rig.stack.zones.save(room, 'absent')); await rig.runtime.refreshProjection();
	rig.selection.select([room.id]); await settle();
	if (enclosed) {
		await rig.wrapper.get('[data-rp-group-action="enclose"]').trigger('click');
		await settleUntil(() => rig.project.groups.length === 1, 'saved enclosure');
	}
	return { rig, room };
}
it('encloses a Room in one saved group and restores both walls and membership on undo/redo', async () => {
	const { rig, room } = await setup(false), write = vi.spyOn(rig.geometry, 'write');
	await rig.wrapper.get('[data-rp-group-action="enclose"]').trigger('click'); await settleUntil(() => rig.project.groups.length === 1, 'enclosure');
	expect(write).toHaveBeenCalledTimes(1); expect(rig.project.structure.walls).toHaveLength(4);
	const group = rig.project.groups[0]; expect(group.name).toBe('Kitchen'); expect(group.memberIds).toContain(room.id);
	expect(rig.selection.selectedIds).toEqual(group.memberIds); expect(expectOk(await rig.geometry.read(rig.plan.id)).document.groups).toEqual([group]);
	await rig.runtime.undo(); expect(rig.project.groups).toEqual([]); expect(rig.project.structure.walls).toEqual([]);
	await rig.runtime.redo(); expect(rig.project.groups).toEqual([group]); expect(rig.project.structure.walls).toHaveLength(4);
});
it('encloses a Room beside another Room with one centred wall on the edge they share and the rest outside', async () => {
	const { rig, room } = await setup(false);
	const pantry = makeZone({ projectId: rig.plan.projectId, planId: rig.plan.id, zoneType: 'Room', name: 'Pantry', geometry: { points: [{ x: 4000, y: 0 }, { x: 7000, y: 0 }, { x: 7000, y: 3000 }, { x: 4000, y: 3000 }] } });
	expectOk(await rig.stack.zones.save(pantry, 'absent')); await rig.runtime.refreshProjection();
	rig.selection.select([room.id]); await settle();
	await rig.wrapper.get('[data-rp-group-action="enclose"]').trigger('click'); await settleUntil(() => rig.project.groups.length === 1, 'enclosure beside a Room');
	expect(rig.project.structure.walls.map(wall => [wall.start, wall.end])).toEqual([[{ x: -75, y: -75 }, { x: 4000, y: -75 }], [{ x: 4000, y: -75 }, { x: 4000, y: 3075 }], [{ x: 4000, y: 3075 }, { x: -75, y: 3075 }], [{ x: -75, y: 3075 }, { x: -75, y: -75 }]]);
});
it('moves a grouped Room, walls and later hosted opening from the immutable pointer baseline with one write', async () => {
	const { rig, room } = await setup(), before = expectOk(await rig.geometry.read(rig.plan.id));
	const wall = rig.project.structure.walls[0], opening = { id: 'opening-group', kind: 'door' as const, hostId: wall.id, offset: 300, width: 900, height: 2100, sill: 0, swing: { hinge: 'end' as const, side: 'right' as const, angle: 45 } };
	expectOk(await rig.geometry.write(rig.plan.id, { ...before.document, structure: { ...rig.project.structure, openings: [opening] } }, before.version));
	await rig.runtime.refreshProjection(); rig.runtime.selectAndFrame(room.id, false); await settle();
	expect(rig.selection.selectedIds).toContain(opening.id);
	const write = vi.spyOn(rig.geometry, 'write'), tool = rig.runtime.toolManager;
	tool.pointerDown(pointerAt(1800, 1400)); tool.pointerMove(pointerAt(2100, 1550));
	expect(rig.runtime.groupActions.preview.value?.objects[0].points[0]).toEqual({ x: 300, y: 150 });
	tool.pointerMove(pointerAt(2200, 1600)); tool.pointerUp(pointerAt(2300, 1700));
	await settleUntil(() => write.mock.calls.length === 1 && !rig.runtime.groupActions.active.value, 'group move');
	expect(rig.project.zones.get(room.id)?.points[0]).toEqual({ x: 500, y: 300 });
	expect(rig.project.structure.walls[0].start).toEqual({ x: 425, y: 225 }); expect(rig.project.structure.openings).toEqual([opening]);
	await rig.runtime.undo(); expect(rig.project.zones.get(room.id)?.points).toEqual(room.geometry.points); expect(rig.project.structure.openings).toEqual([opening]);
	await rig.runtime.redo(); expect(rig.project.zones.get(room.id)?.points[0]).toEqual({ x: 500, y: 300 });
});
it('keeps cancel, click jitter, zero movement and Review free of writes', async () => {
	const { rig } = await setup(), write = vi.spyOn(rig.geometry, 'write'), gesture = rig.runtime.groupActions.selectionMove;
	expect(gesture.start(rig.selection.selectedIds, pointerAt(1000, 1000))).toBe(true);
	gesture.move(pointerAt(1600, 1000)); gesture.cancel(); gesture.finish(pointerAt(1600, 1000));
	expect(rig.runtime.groupActions.preview.value).toBeNull();
	gesture.start(rig.selection.selectedIds, pointerAt(1000, 1000)); gesture.finish(pointerAt(1000, 1000));
	await rig.runtime.groupActions.moveBy({ dx: 0, dy: 0 });
	useRenovationSession(rig.pinia).perspective = 'review';
	expect(gesture.start(rig.selection.selectedIds, pointerAt(1000, 1000))).toBe(false);
	await rig.runtime.groupActions.moveBy({ dx: 500, dy: 0 }); expect(write).not.toHaveBeenCalled();
});
it('rotates hidden members with the saved group, retaining exact cardinal coordinates and history', async () => {
	const { rig, room } = await setup(); useWorkspaceStore(rig.pinia).layerVisibility.architecture = false;
	const shape = expectDefined(rig.runtime.rotationActions.target.value, 'group target'), pivot = expectDefined(rotationPivot(shape), 'group pivot');
	expect(shape.kind).toBe('group'); const write = vi.spyOn(rig.geometry, 'write');
	await rig.runtime.rotationActions.rotate(shape.id, 90);
	expect(write).toHaveBeenCalledTimes(1); const expected = expectDefined(rotationPoints({ ...shape, kind: 'room', points: room.geometry.points }, 90, pivot), 'rotated Room');
	expect(rig.project.zones.get(room.id)?.points).toEqual(expected); expect(rig.project.structure.walls[0].start).toEqual({ x: expected[0].x + 75, y: expected[0].y - 75 });
	await rig.runtime.undo(); expect(rig.project.zones.get(room.id)?.points).toEqual(room.geometry.points);
});
it('shows grouped numeric rotation preview and cancels without persisting', async () => {
	const { rig } = await setup(), shape = expectDefined(rig.runtime.rotationActions.target.value, 'group'), write = vi.spyOn(rig.geometry, 'write');
	const operation = rig.runtime.rotationActions.rotate(shape.id);
	await settleUntil(() => rig.wrapper.find('[data-rp-form="object-rotation"]').exists(), 'group rotation form');
	await rig.wrapper.get('input[name="angle"]').setValue('27,5');
	expect(rig.runtime.groupActions.preview.value).not.toBeNull(); expect(write).not.toHaveBeenCalled();
	rig.dialogs.resolve('cancel'); await operation;
	expect(rig.runtime.groupActions.preview.value).toBeNull(); expect(write).not.toHaveBeenCalled();
});
it('expands hovered saved membership only when its edge rotation control is pressed', async () => {
	const { rig, room } = await setup(), ids = [...rig.selection.selectedIds]; rig.selection.clear();
	await hoverRotation(rig.runtime, useEditorStore(rig.pinia), { x: 1500, y: 1200 });
	expect(rig.selection.selectedIds).toEqual([]);
	const handle = expectDefined(rig.runtime.rotationActions.displayControls.value[0], 'hover group control');
	rig.runtime.toolManager.pointerDown(pointerAt(handle.handle.x, handle.handle.y));
	expect(rig.selection.selectedIds).toEqual(ids); expect(rig.runtime.rotationActions.target.value?.kind).toBe('group');
	rig.runtime.toolManager.cancelGesture(); expect(rig.runtime.groupActions.preview.value).toBeNull();
	expect(rig.runtime.groupActions.expandSelection(room.id, true)).toEqual([room.id]);
});
it('retires a pending gesture after peer member edits even when the group bounding box stays the same', async () => {
	const { rig } = await setup(), gesture = rig.runtime.groupActions.selectionMove;
	gesture.start(rig.selection.selectedIds, pointerAt(1500, 1000));
	const before = expectOk(await rig.geometry.read(rig.plan.id));
	expectOk(await rig.geometry.write(rig.plan.id, { ...before.document, structure: { ...rig.project.structure,
		walls: rig.project.structure.walls.map(wall => ({ ...wall, height: wall.height + 100 })) } }, before.version));
	await rig.runtime.refreshProjection(); const write = vi.spyOn(rig.geometry, 'write');
	gesture.move(pointerAt(2000, 1000)); gesture.finish(pointerAt(2000, 1000)); await settle();
	expect(gesture.active).toBe(false); expect(write).not.toHaveBeenCalled();
});
it('ungroups without moving members, then saves an explicit multi-selection as a group again', async () => {
	const { rig } = await setup(), before = expectOk(await rig.geometry.read(rig.plan.id)).document.structure, write = vi.spyOn(rig.geometry, 'write');
	await rig.wrapper.get('[data-rp-group-action="ungroup"]').trigger('click'); await settleUntil(() => !rig.project.groups.length, 'ungroup');
	expect(rig.project.structure).toEqual(before); expect(rig.runtime.groupActions.target.value?.id).toBe('selection-group');
	await rig.wrapper.get('[data-rp-group-action="group"]').trigger('click'); await settleUntil(() => rig.project.groups.length === 1, 'regroup');
	expect(write).toHaveBeenCalledTimes(2); expect(rig.project.structure).toEqual(before);
});
it('reopens a saved group through fresh editor stores and expands its Room from the accessible list route', async () => {
	const { rig, room } = await setup(), expected = expectOk(await rig.geometry.read(rig.plan.id)).document.groups;
	rig.unmount(); mounted.splice(mounted.indexOf(rig), 1);
	const reopened = await mountPlanEditorCanvas({ plan: HARNESS_PLAN, queries: rig.deps.queries, commands: rig.deps.commands, vault: rig.deps.vault }); mounted.push(reopened);
	const runtime = runtimeOf(reopened), project = useProjectStore(reopened.pinia), selection = useSelectionStore(reopened.pinia);
	expect(project.groups).toEqual(expected); runtime.selectAndFrame(room.id, false); await settle();
	expect(selection.selectedIds).toEqual(project.groups[0].memberIds); expect(runtime.rotationActions.target.value?.kind).toBe('group');
});
it('never replays a saved group rotation during repeated failed readback recovery', async () => {
	const { rig } = await setup(), shape = expectDefined(rig.runtime.rotationActions.target.value, 'group');
	const write = vi.spyOn(rig.geometry, 'write'), read = vi.spyOn(rig.deps.queries, 'findZonesByPlan').mockResolvedValue(err(injectedPersistenceError()));
	await rig.runtime.rotationActions.rotate(shape.id, 90); expect(write).toHaveBeenCalledTimes(1); expect(rig.project.stale).toBe(true);
	for (let index = 0; index < 2; index++) { await rig.runtime.refreshProjection(); expect(write).toHaveBeenCalledTimes(1); }
	read.mockRestore(); await rig.runtime.refreshProjection(); expect(rig.project.stale).toBe(false); expect(write).toHaveBeenCalledTimes(1);
	await rig.runtime.undo(); expect(rig.project.structure.walls[0].start).toEqual({ x: -75, y: -75 });
});
it('reviews connected walls outside an explicitly partial selection before applying a group move', async () => {
	const { rig, room } = await setup(), wall = rig.project.structure.walls[0], write = vi.spyOn(rig.geometry, 'write');
	rig.selection.select([room.id, wall.id as never]);
	const cancelled = rig.runtime.groupActions.moveBy({ dx: 100, dy: 100 });
	await settleUntil(() => rig.dialogs.current?.kind === 'confirm', 'connected wall review');
	expect(rig.wrapper.get('.rp-dialog').text()).toContain('2 walls'); expect(write).not.toHaveBeenCalled();
	rig.dialogs.resolve('cancel'); await cancelled; expect(rig.runtime.groupActions.preview.value).toBeNull();
	const accepted = rig.runtime.groupActions.moveBy({ dx: 100, dy: 100 });
	await settleUntil(() => rig.dialogs.current?.kind === 'confirm', 'renewed wall review'); rig.dialogs.resolve('confirm'); await accepted;
	expect(write).toHaveBeenCalledTimes(1); expect(rig.project.structure.walls[0].start).toEqual({ x: 25, y: 25 });
	expect(rig.project.structure.walls[1].start).toEqual({ x: 4175, y: 25 }); expect(rig.project.structure.walls[2].start).toEqual({ x: 4075, y: 3075 });
});
it('submits numeric group rotation once and freezes its input while the write is pending', async () => {
	const { rig } = await setup(), shape = expectDefined(rig.runtime.rotationActions.target.value, 'group');
	const operation = rig.runtime.rotationActions.rotate(shape.id);
	await settleUntil(() => rig.wrapper.find('[data-rp-form="object-rotation"]').exists(), 'group form');
	const form = rig.wrapper.get('[data-rp-form="object-rotation"]'); await form.get('input').setValue('27,5');
	let release!: () => void; const pending = new Promise<void>(resolve => { release = resolve; }), originalWrite = rig.geometry.write.bind(rig.geometry);
	const write = vi.spyOn(rig.geometry, 'write').mockImplementationOnce(async (...args) => { await pending; return originalWrite(...args); });
	await form.trigger('submit'); await settleUntil(() => write.mock.calls.length === 1, 'group write');
	await form.trigger('submit'); await form.get('input').setValue('90'); expect(form.get('input').element).toHaveProperty('value', '27,5');
	await rig.wrapper.get('[data-rp-action="cancel"]').trigger('click'); expect(rig.dialogs.current).not.toBeNull();
	release(); await operation; expect(write).toHaveBeenCalledTimes(1); expect(rig.dialogs.current).toBeNull();
});
it('encloses and rotates a curved Room while preserving each persisted bend and exact undo geometry', async () => {
	const { rig, room } = await setup(false), loaded = expectFound(await rig.stack.zones.getById(room.id));
	const curved = expectOk(loaded.entity.withGeometry({ points: room.geometry.points, bulges: [0.25, 0, 0, 0] }));
	expectOk(await rig.stack.zones.save(curved, loaded.version)); await rig.runtime.refreshProjection();
	await rig.wrapper.get('[data-rp-group-action="enclose"]').trigger('click');
	await settleUntil(() => rig.project.groups.length === 1 && !rig.runtime.groupActions.active.value, 'curved enclosure');
	const before = expectOk(await rig.geometry.read(rig.plan.id)).document;
	const bend = expectDefined(before.structure?.walls[0].bulge, 'the outside arc'); expect(bend).toBeGreaterThan(0.25);
	const shape = expectDefined(rig.runtime.rotationActions.target.value, 'curved group'); await rig.runtime.rotationActions.rotate(shape.id, 37.5);
	const after = expectOk(await rig.geometry.read(rig.plan.id)).document;
	expect(after.objects[0].bulges).toEqual([0.25, 0, 0, 0]); expect(after.structure?.walls[0].bulge).toBe(bend); expect(after.objects[0].points).not.toEqual(before.objects[0].points);
	await rig.runtime.undo(); expect(expectOk(await rig.geometry.read(rig.plan.id)).document).toEqual(before);
});
it('selects an individual group member for editing and restores the saved group without changing membership', async () => {
	const { rig } = await setup(), ids = [...rig.selection.selectedIds], wall = rig.project.structure.walls[0];
	const groups = expectOk(await rig.geometry.read(rig.plan.id)).document.groups, write = vi.spyOn(rig.geometry, 'write');
	rig.selection.focus(wall.id as never); await settle();
	const button = rig.wrapper.get('[data-rp-group-action="inspect"]'); (button.element as HTMLButtonElement).focus();
	await button.trigger('click'); await settle();
	expect(rig.selection.selectedIds).toEqual([wall.id]); expect(rig.runtime.groupActions.target.value).toBeNull();
	expect(rig.runtime.rotationActions.target.value?.kind).toBe('wall');
	expect(document.activeElement).toBe(rig.wrapper.get('[data-rp-region="inspector"]').element);
	expect(rig.wrapper.find('[name="group-dx"]').exists()).toBe(false);
	await rig.wrapper.get('[data-rp-group-action="select-group"]').trigger('click'); await settle();
	expect(rig.selection.selectedIds).toEqual(ids); expect(rig.runtime.groupActions.target.value?.kind).toBe('group');
	expect(expectOk(await rig.geometry.read(rig.plan.id)).document.groups).toEqual(groups); expect(write).not.toHaveBeenCalled();
});
it('keeps a group selected on right-click while focusing the actual member offered by the context menu', async () => {
	const { rig } = await setup(), ids = [...rig.selection.selectedIds], wall = rig.project.structure.walls[1];
	await rig.wrapper.get(`.rp-multi-selection [data-rp-id="${wall.id}"]`).trigger('contextmenu'); await settle();
	expect(rig.selection.selectedIds).toEqual(ids); expect(rig.selection.focusedId).toBe(wall.id);
	await rig.wrapper.get('[data-rp-context-action="inspect"]').trigger('click'); await settle();
	expect(rig.selection.selectedIds).toEqual([wall.id]); expect(rig.project.groups).toHaveLength(1);
});
