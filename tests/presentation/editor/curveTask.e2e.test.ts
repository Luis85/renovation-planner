// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { expectDefined, expectOk } from '../../helpers/domain';
import { settle } from '../../helpers/editor';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';
import { STAGE_PIXELS, worldToScreen } from '../../../src/presentation/editor/viewport/Viewport';
import { pointer } from '../../helpers/planEditorRig';
import type { Point } from '../../../src/core/geometry/Point';
import { defer } from '../../helpers/async';

const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); vi.restoreAllMocks(); });
async function setup() { const rig = await renovationEditor(); mounted.push(rig); rig.changePlan(); await settle(); return rig; }

it('opens a visible precise curve task, previews every edge, applies once and restores exact straight bytes through history', async () => {
	const rig = await setup(), original = expectOk(await rig.geometry.read(rig.plan.id)).document;
	await rig.wrapper.get('[data-rp-action="edit-curves"]').trigger('click'); await settle();
	expect(rig.runtime.activeToolId.value).toBe('edit-curves'); expect(rig.wrapper.find('[data-rp-form="edit-curves"]').exists()).toBe(true);
	const write = vi.spyOn(rig.geometry, 'write');
	await rig.wrapper.get('[data-rp-form="edit-curves"] input[name="depth"]').setValue('0.5'); await settle();
	expect(write).not.toHaveBeenCalled(); expect(rig.runtime.curveTask.preview.value?.objects.find(item => item.id === rig.room.id)?.bulges).toEqual([0.25, 0, 0, 0]);
	expect(rig.wrapper.findAll('[data-rp-room-edge]')).toHaveLength(4);
	expect(rig.stage.find('.curve-bend-0')).toHaveLength(1);
	await rig.runtime.curveTask.finish(); await settle(); expect(write).toHaveBeenCalledOnce();
	expect(rig.runtime.activeToolId.value).toBe('select'); expect(rig.project.zones.get(rig.room.id)?.bulges).toEqual([0.25, 0, 0, 0]);
	expect(rig.wrapper.find('[data-rp-action="resize-room"]').exists()).toBe(false);
	await rig.runtime.undo(); await settle(); expect(expectOk(await rig.geometry.read(rig.plan.id)).document).toEqual(original);
	await rig.runtime.redo(); await settle(); expect(rig.project.zones.get(rig.room.id)?.bulges).toEqual([0.25, 0, 0, 0]);
	await rig.runtime.curveTask.open(rig.room.id); rig.runtime.curveTask.set(0, 0); await rig.runtime.curveTask.finish(); await settle();
	expect(rig.project.zones.get(rig.room.id)?.bulges).toBeUndefined();
	await rig.runtime.curveTask.open(rig.room.id); expect(rig.runtime.curveTask.target.value?.id).toBe(rig.room.id);
});

it('opens an ordinary Room with no structure sidecar section and leaves a no-op task write-free', async () => {
	const rig = await setup(), snapshot = expectOk(await rig.geometry.read(rig.plan.id));
	expectOk(await rig.geometry.write(rig.plan.id, { ...snapshot.document, structure: undefined }, snapshot.version));
	await rig.runtime.refreshProjection(); await settle(); const bytes = [...rig.stack.vault.entries];
	await rig.runtime.curveTask.open(rig.room.id); expect(rig.runtime.curveTask.target.value?.id).toBe(rig.room.id);
	await rig.runtime.curveTask.finish(); await settle(); expect([...rig.stack.vault.entries]).toEqual(bytes);
});

it('retires a pending curve read when the selected subject changes and preserves a later tool choice', async () => {
	const rig = await setup(), service = expectDefined(rig.deps.commands.groups, 'geometry service');
	const result = await service.read(rig.plan.id), pending = defer<typeof result>(), bytes = [...rig.stack.vault.entries];
	vi.spyOn(service, 'read').mockReturnValueOnce(pending.promise);
	const opening = rig.runtime.curveTask.open(rig.room.id); expect(rig.runtime.curveTask.state.loading).toBe(true);
	rig.selection.select([rig.project.structure.walls[0].id as never]); await settle(); pending.resolve(result); await opening; await settle();
	expect(rig.runtime.curveTask.target.value).toBeNull(); expect(rig.runtime.activeToolId.value).toBe('select');
	await rig.runtime.curveTask.open(rig.project.structure.walls[0].id); await settle();
	rig.selection.clear(); rig.runtime.setTool('draw-wall'); await settle();
	expect(rig.runtime.activeToolId.value).toBe('draw-wall'); expect([...rig.stack.vault.entries]).toEqual(bytes);
});

it('cancels pointer bend interruption and the entire task without writes or camera changes', async () => {
	const rig = await setup(), editor = useEditorStore(rig.pinia), original = JSON.stringify(editor.viewport), bytes = [...rig.stack.vault.entries];
	await rig.runtime.curveTask.open(rig.room.id); await settle();
	const canvas = expectDefined(rig.canvasEl, 'canvas'), bounds = canvas.getBoundingClientRect();
	const at = (point: Point) => { const screen = worldToScreen(point, editor.viewport, STAGE_PIXELS); return { x: screen.x + bounds.left, y: screen.y + bounds.top }; };
	const edge = rig.runtime.curveTask.edges.value[0], start = at(edge.midpoint), next = at({ x: edge.midpoint.x, y: edge.midpoint.y - 400 });
	pointer(canvas, 'pointerdown', start.x, start.y); pointer(canvas, 'pointermove', next.x, next.y); await settle();
	expect(rig.runtime.curveTask.target.value?.geometry.bulges?.[0]).toBeCloseTo(0.2);
	rig.runtime.toolManager.cancelInterruptedGesture(); await settle();
	expect(rig.runtime.curveTask.target.value?.geometry.bulges?.[0]).toBe(0);
	rig.runtime.curveTask.set(0, 0.3); rig.runtime.curveTask.cancel(); await settle();
	await rig.runtime.curveTask.open(rig.room.id); await settle();
	pointer(canvas, 'pointerdown', start.x, start.y); pointer(canvas, 'pointermove', next.x, next.y);
	rig.runtime.setTool('draw-wall'); await settle();
	expect(rig.runtime.activeToolId.value).toBe('draw-wall'); expect(rig.runtime.curveTask.target.value).toBeNull();
	expect([...rig.stack.vault.entries]).toEqual(bytes); expect(JSON.stringify(editor.viewport)).toBe(original);
});

it('retires a curve-only peer change and rejects invalid depth without a write', async () => {
	const rig = await setup(); await rig.runtime.curveTask.open(rig.room.id); await settle();
	rig.runtime.curveTask.input('depth', '3'); await rig.runtime.curveTask.finish(); expect(rig.runtime.curveTask.state.invalidField).toBe('depth');
	const baseline = expectOk(await rig.geometry.read(rig.plan.id));
	const document = { ...baseline.document, objects: baseline.document.objects.map(object => object.id === rig.room.id ? { ...object, bulges: [0.4, 0, 0, 0] } : object) };
	expectOk(await rig.geometry.write(rig.plan.id, document, baseline.version)); await rig.runtime.refreshProjection(); await settle();
	expect(rig.runtime.curveTask.state.conflict).toBe(true); expect(rig.runtime.curveTask.preview.value).toBeNull();
	const bytes = [...rig.stack.vault.entries]; await rig.runtime.curveTask.finish(); expect([...rig.stack.vault.entries]).toEqual(bytes);
});

it('edits a Wall through the same task while preserving attached openings and refusing Review', async () => {
	const rig = await setup(), wall = rig.project.structure.walls[0]; rig.selection.select([wall.id as never]); await settle();
	const original = rig.project.structure; await rig.runtime.curveTask.open(wall.id); await settle();
	rig.runtime.curveTask.set(0, 0.25); await rig.runtime.curveTask.finish(); await settle();
	expect(rig.project.structure.walls[0].bulge).toBe(0.25); expect(rig.project.structure.openings).toEqual(original.openings);
	await rig.runtime.undo(); await settle(); expect(rig.project.structure).toEqual(original);
	rig.session.perspective = 'review'; await rig.runtime.curveTask.open(wall.id); expect(rig.runtime.curveTask.target.value).toBeNull();
});
