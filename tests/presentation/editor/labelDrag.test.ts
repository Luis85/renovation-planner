// @vitest-environment jsdom
/**
 * ADR-0029, end to end: a selected item's caption dragged through the real Select tool is saved as an
 * offset through that item's own guarded write, previewed until read back, and undone in one step.
 */
import { afterEach, expect, it, vi } from 'vitest';
import { structureEditor } from '../../helpers/structureEditor';
import { renovationEditor } from '../../helpers/renovationEditor';
import { settle, settleUntil } from '../../helpers/editor';
import { expectDefined, expectOk, injectedPersistenceError } from '../../helpers/domain';
import { defer } from '../../helpers/async';
import { Notice } from '../../helpers/obsidian-mock';
import { activateNotices, disposeNotices } from '../../../src/presentation/notices/notify';
import { makeZone } from '../../helpers/entities';
import { pointerAt } from '../../helpers/tool-context';
import { err, ok } from '../../../src/core/result/Result';
import { elementInput } from '../../../src/presentation/editor/elements/elementInput';
import { projectedGroupGeometry } from '../../../src/presentation/editor/groups/groupSnapshot';
import { usePlanHierarchyStore } from '../../../src/presentation/stores/PlanHierarchyStore';
import { NO_HIERARCHY } from '../../../src/presentation/read-models/planHierarchy';
import { CAPTION_BOUNDS_PX, DETAIL_CAPTION_BOTTOM } from '../../../src/presentation/editor/layers/zone/captionPlacement';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';
import type { NamedSpatialElement } from '../../../src/domain/spatial/SpatialElement';
import type { BoundingBox } from '../../../src/core/geometry/BoundingBox';

const rigs: { unmount(): void }[] = [];
afterEach(() => { rigs.splice(0).forEach(rig => rig.unmount()); disposeNotices(); });

const centre = (box: BoundingBox) => ({ x: (box.min.x + box.max.x) / 2, y: (box.min.y + box.max.y) / 2 });
const square = [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }, { x: 0, y: 3000 }];

async function roomRig() {
	const rig = await structureEditor(); rigs.push(rig);
	const zone = makeZone({ projectId: rig.plan.projectId, planId: rig.plan.id, zoneType: 'Room', geometry: { points: square } });
	expectOk(await rig.stack.zones.save(zone, 'absent'));
	await rig.runtime.refreshProjection(); await settle();
	rig.selection.select([zone.id]); await settle();
	return { rig, zone };
}

it('drags a selected room caption, saves only its offset, and undo restores the automatic caption', async () => {
	const { rig, zone } = await roomRig();
	const hit = expectDefined(rig.runtime.labelActions.hits.value.find(item => item.id === zone.id), 'room caption hit');
	const from = centre(hit.bounds), tool = rig.runtime.toolManager;
	const expected = { dx: hit.offset.dx + 500, dy: hit.offset.dy - 300 };
	tool.pointerDown(pointerAt(from.x, from.y)); tool.pointerMove(pointerAt(from.x + 500, from.y - 300)); await settle();
	expect(rig.runtime.renderState.labelPreview).toEqual({ id: zone.id, offset: expected });
	tool.pointerUp(pointerAt(from.x + 500, from.y - 300));
	await settleUntil(() => rig.project.zones.get(zone.id)?.labelOffset !== undefined && rig.runtime.renderState.labelPreview === null, 'room caption save');
	const saved = expectDefined(expectOk(await rig.stack.zones.getById(zone.id)), 'saved zone').entity;
	expect(saved.labelOffset).toEqual(expected);
	expect(saved.geometry).toEqual(zone.geometry);
	expect(projectedGroupGeometry(rig.project).objects.find(object => object.id === zone.id)?.labelOffset).toEqual(expected);
	await rig.runtime.undo(); await settle();
	expect(expectDefined(expectOk(await rig.stack.zones.getById(zone.id)), 'undone zone').entity.labelOffset).toBeNull();
});

it('draws a taller grab box for a room whose plan has a detail plan (ADR-0028)', async () => {
	const { rig, zone } = await roomRig();
	const plain = expectDefined(rig.runtime.labelActions.hits.value.find(item => item.id === zone.id), 'undetailed hit');
	usePlanHierarchyStore(rig.pinia).hierarchy = { ...NO_HIERARCHY, detailPlans: [{ id: 'detail-1', name: 'Upper floor', parentZoneId: zone.id }] };
	await settle();
	const detailed = expectDefined(rig.runtime.labelActions.hits.value.find(item => item.id === zone.id), 'detailed hit');
	const zoom = useEditorStore(rig.pinia).viewport.zoom;
	expect(detailed.bounds.max.y - plain.bounds.max.y).toBeCloseTo((DETAIL_CAPTION_BOTTOM - CAPTION_BOUNDS_PX.bottom) / zoom, 5);
});

it('grabs no caption in the select-multiple mode, and an unselected room still moves from its caption', async () => {
	const { rig, zone } = await roomRig();
	const from = centre(expectDefined(rig.runtime.labelActions.hits.value[0], 'caption hit').bounds), tool = rig.runtime.toolManager;
	rig.runtime.multiSelectionMode.value = true;
	tool.pointerDown(pointerAt(from.x, from.y)); tool.pointerUp(pointerAt(from.x, from.y)); await settle();
	expect(rig.selection.selectedIds).toEqual([]);
	rig.runtime.multiSelectionMode.value = false;
	tool.pointerDown(pointerAt(from.x, from.y)); tool.pointerMove(pointerAt(from.x + 200, from.y)); tool.pointerUp(pointerAt(from.x + 200, from.y));
	await settleUntil(() => rig.project.zones.get(zone.id)?.points[0].x !== 0, 'room body drag');
	expect(rig.project.zones.get(zone.id)?.labelOffset).toBeUndefined();
	expect(rig.runtime.renderState.labelPreview).toBeNull();
});

const element: NamedSpatialElement = { id: 'element-path', kind: 'path', name: 'Garden path', points: [{ x: 500, y: 500 }, { x: 3000, y: 500 }] };

async function elementRig() {
	const rig = await renovationEditor(true); rigs.push(rig); rig.changePlan(); await settle();
	const baseline = expectOk(await rig.renovation.read(rig.plan.id));
	expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(baseline, elementInput(baseline, element), rig.runtime.structureTask.ledger)));
	rig.selection.select([element.id as never]); await settle();
	return rig;
}

it('saves a dragged element caption through the element write path, and grabs it again from where it now is', async () => {
	const rig = await elementRig();
	const hit = expectDefined(rig.runtime.labelActions.hits.value.find(item => item.id === element.id), 'element caption hit');
	const from = centre(hit.bounds), tool = rig.runtime.toolManager;
	tool.pointerDown(pointerAt(from.x, from.y)); tool.pointerMove(pointerAt(from.x + 400, from.y - 200)); tool.pointerUp(pointerAt(from.x + 400, from.y - 200));
	await settleUntil(() => rig.project.structure.elements?.find(item => item.id === element.id)?.labelOffset !== undefined && rig.runtime.renderState.labelPreview === null, 'element caption save');
	expect(rig.project.structure.elements?.find(item => item.id === element.id)).toMatchObject({ points: element.points, labelOffset: { dx: 400, dy: -200 } });
	expect(rig.runtime.labelActions.hits.value.find(item => item.id === element.id)?.offset).toEqual({ dx: 400, dy: -200 });
});

it.each(['refuse', 'throw', 'fail'] as const)('writes nothing and drops the preview when the caption save will %s', async failure => {
	const rig = await elementRig(), before = [...rig.stack.vault.entries];
	if (failure === 'refuse') vi.spyOn(rig.renovation, 'read').mockResolvedValueOnce(err(injectedPersistenceError()));
	if (failure === 'throw') vi.spyOn(rig.renovation, 'read').mockRejectedValueOnce(new Error('Offline baseline'));
	if (failure === 'fail') vi.spyOn(rig.runtime.dispatcher, 'run').mockResolvedValueOnce(err(injectedPersistenceError()));
	rig.runtime.renderState.labelPreview = { id: element.id, offset: { dx: 9, dy: 9 } };
	await rig.runtime.labelActions.move(element.id, { dx: 9, dy: 9 }); await settle();
	expect([...rig.stack.vault.entries]).toEqual(before);
	expect(rig.runtime.renderState.labelPreview).toBeNull();
});

it('offers and saves nothing for an item with no caption, while blocked, or after the leaf is gone', async () => {
	const rig = await elementRig(), baseline = expectOk(await rig.renovation.read(rig.plan.id)), read = vi.spyOn(rig.renovation, 'read');
	await rig.runtime.labelActions.move('element-missing', { dx: 1, dy: 1 });
	rig.selection.select([expectDefined(rig.project.structure.walls[0], 'a wall').id as never]); await settle();
	expect(rig.runtime.labelActions.hits.value).toEqual([]);
	rig.selection.select([element.id as never]); rig.project.stale = true; await settle();
	expect(rig.runtime.labelActions.hits.value).toEqual([]);
	await rig.runtime.labelActions.move(element.id, { dx: 1, dy: 1 });
	expect(read).not.toHaveBeenCalled();
	rig.project.stale = false; await settle();
	const late = defer<Awaited<ReturnType<typeof rig.renovation.read>>>();
	read.mockReturnValueOnce(late.promise);
	const disposed = rig.runtime.labelActions.move(element.id, { dx: 1, dy: 1 });
	rigs.splice(rigs.indexOf(rig), 1); rig.unmount();
	late.resolve(ok(baseline)); await disposed;
	expect(expectDefined(rig.project.structure.elements?.find(item => item.id === element.id), 'element').labelOffset).toBeUndefined();
});

it('reports a failed save even after the leaf that started it is gone', async () => {
	// Unlike the dispose case above (deferred `read`, never reaches the write), this leaf is
	// gone AFTER the baseline read and DURING the write itself: the failure still has to reach
	// the user, because the renovator's drop was lost either way.
	activateNotices(); // inert until activated (`editorFaults.test.ts`'s own precedent), per test so the queue's dedup cannot fold this into an earlier case's notice
	const rig = await elementRig(), before = Notice.shown.length;
	const pending = defer<Awaited<ReturnType<typeof rig.runtime.dispatcher.run>>>();
	vi.spyOn(rig.runtime.dispatcher, 'run').mockReturnValueOnce(pending.promise);
	rig.runtime.renderState.labelPreview = { id: element.id, offset: { dx: 7, dy: 7 } };
	const disposed = rig.runtime.labelActions.move(element.id, { dx: 7, dy: 7 });
	await settle();
	rigs.splice(rigs.indexOf(rig), 1); rig.unmount();
	pending.resolve(err(injectedPersistenceError()));
	await disposed;
	await settleUntil(() => Notice.shown.length === before + 1, 'the dispose-time save failure notice');
	expect(rig.runtime.renderState.labelPreview).toBeNull();
});
