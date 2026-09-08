// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { rig } from '../../helpers/planEditorRig';
import { runtimeOf, settle, settleUntil } from '../../helpers/editor';
import { expectFound } from '../../helpers/domain';
import { pointerAt } from '../../helpers/tool-context';
import { resizeTo } from '../../helpers/layout';
import { useWorkspaceStore } from '../../../src/presentation/stores/WorkspaceStore';
const mounted: Awaited<ReturnType<typeof rig>>[] = [];
afterEach(() => { for (const r of mounted.splice(0)) r.harness.unmount(); });

it('keeps all Room edges visible during rotation and point previews while saved geometry stays unchanged', async () => {
	const r = await rig(); mounted.push(r); const runtime = runtimeOf(r.harness);
	runtime.selectAndFrame('zone-a'); await settle();
	const original = expectFound(await r.zonesRepo.getById('zone-a' as never));
	expect(r.harness.wrapper.findAll('[data-rp-room-edge]')).toHaveLength(2);
	expect(r.harness.wrapper.findAll('[data-rp-dimension]')).toHaveLength(2);
	void runtime.rotationActions.rotate('zone-a'); await settleUntil(() => r.harness.wrapper.find('[data-rp-form="object-rotation"]').exists(), 'rotation input');
	await r.harness.wrapper.get('[data-rp-form="object-rotation"] [name="angle"]').setValue('37');
	expect(r.harness.wrapper.findAll('[data-rp-room-edge]')).toHaveLength(4);
	expect(r.harness.wrapper.findAll('[data-rp-dimension]')).toHaveLength(0);
	expect(expectFound(await r.zonesRepo.getById(original.entity.id))).toEqual(original);
	await r.harness.wrapper.get('[data-rp-form="object-rotation"] [name="angle"]').trigger('keydown', { key: 'Escape' }); await settle();
	const first = original.entity.geometry.points[0];
	runtime.toolManager.pointerDown(pointerAt(first.x, first.y));
	runtime.toolManager.pointerMove(pointerAt(first.x + 500, first.y + 400)); await settle();
	expect(runtime.renderState.previewPolygon?.[0]).not.toEqual(first);
	expect(r.harness.wrapper.findAll('[data-rp-room-edge]')).toHaveLength(4);
	expect(expectFound(await r.zonesRepo.getById(original.entity.id))).toEqual(original);
	runtime.toolManager.cancelGesture(); await settle();
	expect(r.harness.wrapper.findAll('[data-rp-dimension]')).toHaveLength(2);
	expect(runtime.canUndo.value).toBe(false);
});

it('makes free-form creation reachable from a constrained task banner and preserves the rectangle/name when switching', async () => {
	const r = await rig(); mounted.push(r); const runtime = runtimeOf(r.harness);
	resizeTo(r.harness.rootEl, 460, 800); await settle();
	await r.harness.wrapper.get('[data-rp-action="add"]').trigger('click');
	await r.harness.wrapper.get('[data-rp-entry="room"]').trigger('click'); await settle();
	useWorkspaceStore(r.harness.pinia).closeOverlay();
	runtime.roomDraft.setName('Irregular kitchen');
	runtime.roomDraft.commitDimension('width', '4', () => ({ x: 1000, y: 1000 }));
	runtime.roomDraft.commitDimension('depth', '3', () => ({ x: 1000, y: 1000 })); await settle();
	const original = runtime.roomDraft.geometry?.points;
	expect(r.harness.wrapper.findAll('[data-rp-room-edge]')).toHaveLength(2);
	const action = r.harness.wrapper.get('.rp-task-banner [data-rp-action="draw-free-room"]');
	expect(action.text()).toBe('Draw a free-form room');
	await action.trigger('click'); await settle();
	expect(runtime.activeToolId.value).toBe('draw-polygon');
	expect(runtime.roomDraft.name).toBe('Irregular kitchen');
	expect(runtime.renderState.polygonSketch?.vertices).toEqual(original);
	expect(r.harness.wrapper.findAll('[data-rp-room-edge]')).toHaveLength(3);
	expect(document.activeElement).toBe(r.harness.canvasEl);
	runtime.cancelActiveTask(); expect(runtime.canUndo.value).toBe(false);
});
