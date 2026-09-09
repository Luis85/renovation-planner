// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { groupEditor } from '../../helpers/groupEditor';
import { expectDefined, expectOk } from '../../helpers/domain';
import { settle, settleUntil } from '../../helpers/editor';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';
import { STAGE_PIXELS, worldToScreen } from '../../../src/presentation/editor/viewport/Viewport';

const mounted: { unmount(): void }[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); vi.restoreAllMocks(); });

it('keeps a persisted singleton Room group outline and vertex handles on the numeric rotation preview, then cancels without writes', async () => {
	const rig = await groupEditor(); mounted.push(rig);
	const baseline = expectOk(await rig.geometry.read(rig.plan.id)), group = rig.project.groups[0];
	// A valid persisted remainder after the assembly's other members have been removed.
	expectOk(await rig.geometry.write(rig.plan.id, { ...baseline.document,
		structure: { walls: [], openings: [], boundaries: [] }, groups: [{ ...group, memberIds: [rig.room.id] }],
	}, baseline.version));
	await rig.runtime.refreshProjection(); rig.selection.select([rig.room.id]); await settle();
	expect(rig.project.groups).toEqual([{ ...group, memberIds: [rig.room.id] }]);
	const before = expectOk(await rig.geometry.read(rig.plan.id)).document, write = vi.spyOn(rig.geometry, 'write');
	const stage = expectDefined(rig.stage, 'native stage'), layer = expectDefined(stage.getLayers().find(item => item.name() === 'interaction'), 'interaction layer');
	const outline = expectDefined(layer.findOne('.selection-outline'), 'single Room outline');
	const handles = layer.getChildren().filter(node => node.getClassName() === 'Circle');
	expect(handles).toHaveLength(4);
	const originalOutline = [...outline.getAttr('points') as number[]], originalHandles = handles.map(node => node.position());
	await rig.wrapper.get('[data-rp-group-transform="rotate"]').trigger('click');
	await settleUntil(() => rig.wrapper.find('[data-rp-form="object-rotation"]').exists(), 'saved singleton group rotation');
	const form = rig.wrapper.get('[data-rp-form="object-rotation"]'); await form.get('input').setValue('37'); await settle();
	const preview = expectDefined(rig.runtime.groupActions.preview.value?.objects.find(object => object.id === rig.room.id), 'group Room preview');
	expect(preview.points).not.toEqual(rig.room.geometry.points);
	const editor = useEditorStore(rig.pinia), projected = preview.points.map(point => worldToScreen(point, editor.viewport, STAGE_PIXELS));
	expect(layer.findOne('.selection-outline')).toBe(outline);
	expect.soft(outline.getAttr('points')).toEqual(projected.flatMap(point => [point.x, point.y]));
	expect.soft(handles.map(node => node.position())).toEqual(projected);
	const measurements = rig.wrapper.findAll('[data-rp-room-edge]');
	expect.soft(measurements.map(item => item.attributes('data-rp-room-edge'))).toEqual(['0', '1', '2', '3']);
	expect.soft(measurements.map(item => item.get('[aria-hidden="true"]').text())).toEqual(['4 m', '3 m', '4 m', '3 m']);
	expect.soft(rig.wrapper.findAll('[data-rp-dimension]')).toHaveLength(0);
	expect(write).not.toHaveBeenCalled();
	await form.get('input').trigger('keydown', { key: 'Escape' });
	await settleUntil(() => !rig.runtime.groupActions.active.value, 'cancelled singleton preview'); await settle();
	expect(rig.runtime.groupActions.preview.value).toBeNull(); expect(write).not.toHaveBeenCalled();
	expect(expectOk(await rig.geometry.read(rig.plan.id)).document).toEqual(before);
	expect(layer.findOne('.selection-outline')).toBe(outline); expect(outline.getAttr('points')).toEqual(originalOutline);
	expect(handles.map(node => node.position())).toEqual(originalHandles);
	expect(rig.wrapper.findAll('[data-rp-room-edge]')).toHaveLength(2);
	expect(rig.wrapper.findAll('[data-rp-dimension]')).toHaveLength(2);
});
