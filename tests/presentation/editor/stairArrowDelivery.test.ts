// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { settle, settleUntil } from '../../helpers/editor';
import { expectDefined, expectOk, injectedPersistenceError } from '../../helpers/domain';
import { elementInput } from '../../../src/presentation/editor/elements/elementInput';
import { err } from '../../../src/core/result/Result';
import type { NamedSpatialElement } from '../../../src/domain/spatial/SpatialElement';
import type Konva from 'konva';
import { rotationPivot, rotationPoints } from '../../../src/presentation/editor/elements/objectRotation';
import { defer } from '../../helpers/async';
import { pointerAt, shiftPointerAt } from '../../helpers/tool-context';

const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); vi.restoreAllMocks(); });
const points = [{ x: 1000.123, y: 5000.678 }, { x: 1000.123, y: 2000.321 }];
const stair: NamedSpatialElement = { id: 'element-delivery-stair', name: 'Landing', kind: 'stair', points, stair: { width: 900.456, treads: 12, direction: 'up' } };
const arrow: NamedSpatialElement = { id: 'element-delivery-arrow', name: 'Route', kind: 'arrow', points: [...points, { x: 2000.987, y: 2000.321 }] };
async function setup(element?: NamedSpatialElement) {
	const rig = await renovationEditor(true); mounted.push(rig); rig.changePlan(); await settle();
	if (element) {
		const baseline = expectOk(await rig.renovation.read(rig.plan.id));
		expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(baseline, elementInput(baseline, element), rig.runtime.structureTask.ledger)));
		rig.selection.select([element.id as never]); await settle();
	}
	return rig;
}

it('preserves untouched placement precision when changing only Stair treads and direction', async () => {
	const rig = await setup(), task = rig.runtime.elementTask;
	rig.runtime.setTool('place-stair'); await settleUntil(() => !task.draft.loading, 'stair baseline');
	task.setPoints(points); task.draft.stair = expectDefined(stair.stair, 'options'); await settle();
	const form = rig.wrapper.get('[data-rp-form="stair-parameters"]'), bytes = [...rig.stack.vault.entries];
	await form.get('input[name="stair-treads"]').setValue('200');
	await form.get('select[name="stair-direction"]').setValue('down');
	await form.trigger('submit');
	expect(task.draft.points).toEqual(points);
	expect(task.draft.stair).toEqual({ width: 900.456, treads: 200, direction: 'down' });
	expect([...rig.stack.vault.entries]).toEqual(bytes);
	await task.finish(); await settle();
	const saved = expectDefined(rig.project.structure.elements?.[0], 'saved stair');
	expect(saved.points).toEqual(points);
	await rig.runtime.undo(); await settle(); expect(rig.project.structure.elements ?? []).toEqual([]);
	await rig.runtime.redo(); await settle(); expect(rig.project.structure.elements?.[0]).toEqual(saved);
	expect(expectOk(await rig.geometry.read(rig.plan.id)).document.structure?.elements?.[0]).toEqual(saved);
});

it.each([stair, arrow])('does not write or add history for an unchanged $kind movement', async element => {
	const rig = await setup(element), original = expectDefined(rig.project.structure.elements?.[0], 'element');
	const bytes = [...rig.stack.vault.entries], command = vi.spyOn(rig.renovation, 'command');
	await rig.runtime.elementActions.move(element.id, original.points.map(point => ({ ...point })), original);
	expect(command).not.toHaveBeenCalled(); expect([...rig.stack.vault.entries]).toEqual(bytes);
	await rig.runtime.undo(); await settle(); expect(rig.project.structure.elements ?? []).toEqual([]);
});

it('applies explicitly retyped placement dimensions and clears their intent when the draft is cancelled', async () => {
	const rig = await setup(), task = rig.runtime.elementTask;
	rig.runtime.setTool('place-stair'); await settleUntil(() => !task.draft.loading, 'stair baseline');
	task.setPoints(points); task.draft.stair = expectDefined(stair.stair, 'options'); await settle();
	const form = rig.wrapper.get('[data-rp-form="stair-parameters"]'), bytes = [...rig.stack.vault.entries];
	await form.get('input[name="stair-width"]').setValue('0.9'); await form.trigger('submit');
	expect(task.draft.stair.width).toBe(900); expect(task.draft.points).toEqual(points);
	await form.get('input[name="stair-run"]').setValue('3'); await form.trigger('submit');
	expect(task.draft.points).toEqual([points[0], { x: points[0].x, y: points[0].y - 3000 }]);
	rig.runtime.toolManager.cancelGesture(); await settle();
	task.setPoints(points); task.draft.stair = expectDefined(stair.stair, 'options'); await settle();
	await form.get('input[name="stair-treads"]').setValue('1'); await form.trigger('submit');
	expect(task.draft.points).toEqual(points); expect(task.draft.stair).toEqual({ ...stair.stair, treads: 1 });
	expect([...rig.stack.vault.entries]).toEqual(bytes);
});

it.each([stair, arrow])('retires the $kind form after a same-revision external geometry edit', async element => {
	const rig = await setup(element), operation = rig.runtime.elementActions.edit(element.id); await settle();
	const form = rig.wrapper.get(`[data-rp-form="${element.kind === 'stair' ? 'stair-edit' : 'outline-points'}"]`);
	await form.get('input[name="name"]').setValue('My draft');
	const saved = expectOk(await rig.stack.store.read(rig.plan.id)), structure = expectDefined(saved.dto.structure, 'structure');
	const peer = { ...saved.dto, structure: { ...structure, elements: structure.elements?.map(item => ({ ...item, points: item.points.map(point => ({ x: point.x + 100, y: point.y })) })) } };
	rig.stack.vault.entries.set(saved.path, JSON.stringify(peer));
	const bytes = [...rig.stack.vault.entries], writes = vi.spyOn(rig.geometry, 'write');
	await form.trigger('submit'); await settle();
	expect(form.get('input[name="name"]').element).toHaveProperty('readOnly', true);
	expect(form.text()).toContain('changed');
	expect(rig.project.structure.elements?.[0].points).toEqual(element.points.map(point => ({ x: point.x + 100, y: point.y })));
	await form.trigger('submit'); await settle(); expect(writes).not.toHaveBeenCalled(); expect([...rig.stack.vault.entries]).toEqual(bytes);
	rig.dialogs.resolve('cancel'); await operation;
});

it.each([stair, arrow])('retries a compensated $kind edit through the same reversible command', async element => {
	const rig = await setup(element), original = expectOk(await rig.renovation.read(rig.plan.id));
	const operation = rig.runtime.elementActions.edit(element.id); await settle();
	const form = rig.wrapper.get(`[data-rp-form="${element.kind === 'stair' ? 'stair-edit' : 'outline-points'}"]`);
	await form.get('input[name="name"]').setValue('Renamed');
	const writes = vi.spyOn(rig.geometry, 'write').mockResolvedValueOnce(err(injectedPersistenceError()));
	await form.trigger('submit'); await settle();
	expect(rig.dialogs.current).not.toBeNull();
	const compensated = expectOk(await rig.renovation.read(rig.plan.id));
	expect(compensated.plan.entity).toEqual(original.plan.entity); expect(compensated.geometry.document).toEqual(original.geometry.document);
	await form.trigger('submit'); await settle();
	expect(rig.dialogs.current).toBeNull();
	await operation;
	expect(writes).toHaveBeenCalledTimes(2);
	expect(rig.project.plan?.spatialElements?.[0].name).toBe('Renamed');
	expect(rig.project.structure.elements?.[0].points).toEqual(element.points);
	await rig.runtime.undo(); await settle();
	expect(rig.project.plan?.spatialElements).toEqual(original.plan.entity.spatialElements);
	expect(rig.project.structure).toEqual(original.geometry.document.structure);
	await rig.runtime.redo(); await settle();
	expect(rig.project.plan?.spatialElements?.[0].name).toBe('Renamed');
});

it.each([stair, arrow])('retries a compensated $kind rotation without losing its exact inverse', async element => {
	const rig = await setup(element), original = expectOk(await rig.geometry.read(rig.plan.id)).document;
	const operation = rig.runtime.rotationActions.rotate(element.id); await settle();
	const form = rig.wrapper.get('[data-rp-form="object-rotation"]');
	await form.get('input[name="angle"]').setValue('37,5');
	const writes = vi.spyOn(rig.geometry, 'write').mockResolvedValueOnce(err(injectedPersistenceError()));
	await form.trigger('submit'); await settle(); expect(rig.dialogs.current).not.toBeNull();
	await form.trigger('submit'); await settle(); expect(rig.dialogs.current).toBeNull(); await operation;
	expect(writes).toHaveBeenCalledTimes(2);
	const saved = expectOk(await rig.geometry.read(rig.plan.id)).document;
	expect(saved.structure?.elements?.[0].points).not.toEqual(element.points);
	await rig.runtime.undo(); expect(expectOk(await rig.geometry.read(rig.plan.id)).document).toEqual(original);
	await rig.runtime.redo(); expect(expectOk(await rig.geometry.read(rig.plan.id)).document).toEqual(saved);
});

it.each([stair, arrow])('never replays a successful $kind placement across failed refresh and three retries', async element => {
	const rig = await setup(), task = rig.runtime.elementTask;
	rig.runtime.setTool(element.kind === 'stair' ? 'place-stair' : 'draw-arrow');
	await settleUntil(() => !task.draft.loading, 'placement baseline');
	task.setPoints(element.points);
	const writes = vi.spyOn(rig.geometry, 'write');
	const read = vi.spyOn(rig.deps.queries, 'getPlan').mockResolvedValue(err(injectedPersistenceError()));
	await task.finish(); await settle();
	const saved = expectOk(await rig.geometry.read(rig.plan.id)).document, bytes = [...rig.stack.vault.entries];
	expect(writes).toHaveBeenCalledOnce(); expect(rig.runtime.writesBlocked.value).toBe(true);
	for (let index = 0; index < 3; index++) { await task.retry(); await task.finish(); }
	expect(writes).toHaveBeenCalledOnce(); expect([...rig.stack.vault.entries]).toEqual(bytes);
	read.mockRestore(); await rig.runtime.refreshProjection();
	expect(rig.project.structure.elements?.[0].points).toEqual(element.points);
	await rig.runtime.undo(); expect(rig.project.structure.elements ?? []).toEqual([]);
	await rig.runtime.redo(); expect(expectOk(await rig.geometry.read(rig.plan.id)).document).toEqual(saved);
});

it('commits a started Arrow placement after disposal without restoring selection or replaying it', async () => {
	const rig = await setup(), task = rig.runtime.elementTask;
	rig.runtime.setTool('draw-arrow'); await settleUntil(() => !task.draft.loading, 'arrow baseline'); task.setPoints(arrow.points);
	const release = defer<void>(), entered = defer<void>(), originalWrite = rig.geometry.write.bind(rig.geometry);
	const writes = vi.spyOn(rig.geometry, 'write').mockImplementationOnce(async (...args) => { entered.resolve(); await release.promise; return originalWrite(...args); });
	const action = task.finish(); await entered.promise;
	mounted.pop(); rig.unmount(); const selected = [...rig.selection.selectedIds];
	release.resolve(); await action;
	expect(writes).toHaveBeenCalledOnce(); expect(rig.selection.selectedIds).toEqual(selected);
	expect(expectOk(await rig.geometry.read(rig.plan.id)).document.structure?.elements?.[0].points).toEqual(arrow.points);
});

it('preserves precise Arrow coordinates on rename and applies only an explicitly edited vertex coordinate', async () => {
	const rig = await setup(arrow), original = expectOk(await rig.geometry.read(rig.plan.id)).document;
	const action = rig.runtime.elementActions.edit(arrow.id); await settle();
	const form = rig.wrapper.get('[data-rp-form="outline-points"]');
	await form.get('input[name="name"]').setValue('Precise route');
	await form.get('input[name="2.x"]').setValue('2,125');
	await form.trigger('submit'); await action;
	expect(rig.project.structure.elements?.[0].points).toEqual([points[0], points[1], { x: 2125, y: 2000.321 }]);
	await rig.runtime.undo(); expect(expectOk(await rig.geometry.read(rig.plan.id)).document).toEqual(original);
});

it('aligns the native Arrow head to the final segment and moves its middle vertex with Shift', async () => {
	const route = { ...arrow, points: [{ x: 8000, y: 8000 }, { x: 10000, y: 8000 }, { x: 9400, y: 8800 }] };
	const rig = await setup(route), shape = expectDefined(rig.stage.findOne<Konva.Arrow>('.direction-arrow'), 'arrow');
	const context = expectDefined(shape.getLayer(), 'layer').getContext();
	const rotate = vi.spyOn(context, 'rotate'), translate = vi.spyOn(context, 'translate');
	shape._sceneFunc(context);
	expect(translate).toHaveBeenCalledWith(9400, 8800); expect(rotate).toHaveBeenCalledWith(2.214297435588181);
	expect(shape.closed()).toBe(false); expect(shape.pointerAtBeginning()).toBe(false); expect(shape.pointerAtEnding()).toBe(true);
	const tool = rig.runtime.toolManager, bytes = [...rig.stack.vault.entries];
	tool.pointerDown(pointerAt(10000, 8000)); tool.pointerMove(shiftPointerAt(11000, 8200)); await settle();
	expect(rig.runtime.elementActions.preview.value?.points[1].y).toBe(8000);
	expect([...rig.stack.vault.entries]).toEqual(bytes);
	tool.pointerUp(shiftPointerAt(11000, 8200)); await settle();
	const changed = expectDefined(rig.project.structure.elements?.[0], 'changed arrow');
	expect(changed.points[0]).toEqual(route.points[0]); expect(changed.points[2]).toEqual(route.points[2]);
	expect(changed.points[1].y).toBe(8000); expect(changed.points[1].x).toBeGreaterThan(10000);
	await rig.runtime.undo(); expect(rig.project.structure.elements?.[0].points).toEqual(route.points);
	await rig.runtime.redo(); expect(rig.project.structure.elements?.[0]).toEqual(changed);
});

it('moves and rotates a saved Stair/Arrow group using its full footprint and exact reversible geometry', async () => {
	const rig = await setup(stair), baseline = expectOk(await rig.renovation.read(rig.plan.id));
	expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(baseline, elementInput(baseline, arrow), rig.runtime.structureTask.ledger)));
	rig.selection.select([stair.id as never, arrow.id as never]); await settle();
	await expectDefined(rig.runtime.groupActions.actions(rig.selection.selectedIds).find(action => action.id === 'group'), 'group action').run();
	const original = expectOk(await rig.geometry.read(rig.plan.id)).document, names = rig.project.plan?.spatialElements;
	const shape = expectDefined(rig.runtime.groupActions.target.value, 'group target');
	expect(Math.min(...shape.points.map(point => point.x))).toBeCloseTo(549.895, 6);
	const pivot = expectDefined(rotationPivot(shape), 'pivot'), rotated = expectDefined(rotationPoints(shape, 37.5, pivot), 'rotation');
	rig.runtime.rotationActions.previewShape(shape.id, rotated);
	const preview = expectDefined(rig.runtime.groupActions.preview.value, 'group preview');
	const writes = vi.spyOn(rig.geometry, 'write');
	await rig.runtime.rotationActions.move(shape.id, rotated, shape);
	expect(writes).toHaveBeenCalledOnce(); expect(expectOk(await rig.geometry.read(rig.plan.id)).document).toEqual(preview);
	expect(rig.project.structure.elements?.[0].stair).toEqual(stair.stair);
	expect(rig.project.structure.walls).toEqual(original.structure?.walls); expect(rig.project.groups).toEqual(original.groups);
	await rig.runtime.undo(); expect(expectOk(await rig.geometry.read(rig.plan.id)).document).toEqual(original);
	await rig.runtime.redo(); expect(expectOk(await rig.geometry.read(rig.plan.id)).document).toEqual(preview);
	await rig.runtime.groupActions.moveBy({ dx: 125.25, dy: -50.75 });
	const moved = expectOk(await rig.geometry.read(rig.plan.id)).document;
	expect(moved.structure?.elements?.map(element => element.points)).toEqual(preview.structure?.elements?.map(element => element.points.map(point => ({ x: point.x + 125.25, y: point.y - 50.75 }))));
	expect(rig.project.plan?.spatialElements).toEqual(names);
	await rig.runtime.undo(); expect(expectOk(await rig.geometry.read(rig.plan.id)).document).toEqual(preview);
	await rig.runtime.redo(); expect(expectOk(await rig.geometry.read(rig.plan.id)).document).toEqual(moved);
});
