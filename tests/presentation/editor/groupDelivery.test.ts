// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { groupEditor } from '../../helpers/groupEditor';
import { expectDefined, expectOk, injectedPersistenceError } from '../../helpers/domain';
import { settle, settleUntil } from '../../helpers/editor';
import { pointerAt } from '../../helpers/tool-context';
import { defer } from '../../helpers/async';
import { err } from '../../../src/core/result/Result';
import { useWorkspaceStore } from '../../../src/presentation/stores/WorkspaceStore';
import { rotationPivot, rotationPoints } from '../../../src/presentation/editor/elements/objectRotation';
import { PlanGeometryStore } from '../../../src/infrastructure/obsidian/repositories/PlanGeometryStore';
import { ObsidianPlanGeometrySidecar } from '../../../src/infrastructure/obsidian/repositories/ObsidianPlanGeometrySidecar';
import { roomEdges } from '../../../src/presentation/editor/resize/roomEdgeMeasurements';
import { openingSymbol } from '../../../src/domain/spatial/openingGeometry';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';
import type Konva from 'konva';

const mounted: { unmount(): void }[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); vi.restoreAllMocks(); });
async function setup(bulge = 0.25) {
	const rig = await groupEditor(); mounted.push(rig);
	const baseline = expectOk(await rig.geometry.read(rig.plan.id)), structure = rig.project.structure;
	const opening = { id: 'opening-group-delivery', hostId: structure.walls[0].id, kind: 'door' as const,
		offset: 500, width: 800, height: 2100, sill: 0, swing: { hinge: 'end' as const, side: 'right' as const, angle: 65 } };
	const original = { ...baseline.document, intended: structure,
		objects: baseline.document.objects.map(object => ({ ...object, bulges: [bulge, 0, 0, 0] })),
		structure: { ...structure, walls: structure.walls.map((wall, index) => index === 0 ? { ...wall, bulge } : wall), openings: [opening] },
	};
	expectOk(await rig.geometry.write(rig.plan.id, original, baseline.version)); await rig.runtime.refreshProjection();
	rig.runtime.selectAndFrame(rig.room.id, false); await settle();
	const stack = rig.stack;
	const fresh = () => new ObsidianPlanGeometrySidecar(new PlanGeometryStore(stack.deps.vault, stack.deps.fileManager, stack.index, stack.migrations, stack.echo));
	return { ...rig, original, opening, fresh };
}

it.each([0.25, -0.25])('transforms curved saved members and opening symbols from one frozen preview and preserves exact history, bulge=%s', async bulge => {
	const rig = await setup(bulge), write = vi.spyOn(rig.geometry, 'write');
	const shape = expectDefined(rig.runtime.groupActions.target.value, 'group target'), pivot = expectDefined(rotationPivot(shape), 'frozen pivot');
	const envelope = expectDefined(rotationPoints(shape, 37.5, pivot), 'rotation');
	rig.runtime.rotationActions.previewShape(shape.id, envelope); await settle();
	const preview = expectDefined(rig.runtime.groupActions.preview.value, 'preview'), structure = expectDefined(preview.structure, 'preview walls');
	expect(preview.structure?.openings).toEqual([rig.opening]); expect(preview.intended).toEqual(rig.original.intended);
	const lengths = roomEdges(rig.original.objects[0].points, true, false, rig.original.objects[0].bulges);
	for (const edge of roomEdges(preview.objects[0].points, true, false, preview.objects[0].bulges)) expect(edge.length).toBeCloseTo(lengths[edge.index].length, 8);
	const symbol = openingSymbol(rig.opening, structure.walls[0], 0.25 / useEditorStore(rig.pinia).viewport.zoom);
	const node = expectDefined(rig.stage?.findOne<Konva.Group>('.opening-group-delivery'), 'opening symbol');
	expect(expectDefined(node.findOne<Konva.Line>('Line'), 'opening cut').points()).toEqual(symbol.cut.flatMap(point => [point.x, point.y]));
	expect(write).not.toHaveBeenCalled();
	await rig.runtime.rotationActions.move(shape.id, envelope, shape);
	expect(write).toHaveBeenCalledOnce(); expect(expectOk(await rig.fresh().read(rig.plan.id)).document).toEqual(preview);
	await rig.runtime.undo(); expect(expectOk(await rig.fresh().read(rig.plan.id)).document).toEqual(rig.original);
	await rig.runtime.redo(); expect(expectOk(await rig.fresh().read(rig.plan.id)).document).toEqual(preview);
	expect(write).toHaveBeenCalledTimes(3);
});

it('expands real saved membership from primary marquee hits, retains hidden members, and permits Alt individual selection', async () => {
	const rig = await setup(), workspace = useWorkspaceStore(rig.pinia), tool = rig.runtime.toolManager, ids = [...rig.selection.selectedIds];
	workspace.layerVisibility.architecture = false; rig.selection.clear();
	tool.pointerDown(pointerAt(-1000, -2000)); tool.pointerMove(pointerAt(2000, 1000)); tool.pointerUp(pointerAt(2000, 1000));
	expect(rig.selection.selectedIds).toEqual(ids); expect(rig.selection.selectedIds).not.toContain(rig.project.groups[0].id);
	const write = vi.spyOn(rig.geometry, 'write');
	tool.pointerDown(pointerAt(1800, 1200)); tool.pointerMove(pointerAt(2125, 1100)); await settle();
	const preview = expectDefined(rig.runtime.groupActions.preview.value, 'hidden-member move');
	expect(preview.structure?.walls[0].start).toEqual({ x: 325, y: -100 }); expect(preview.structure?.openings).toEqual([rig.opening]);
	tool.pointerUp(pointerAt(2125, 1100)); await settleUntil(() => !rig.runtime.groupActions.active.value, 'group move');
	expect(write).toHaveBeenCalledOnce(); expect(expectOk(await rig.fresh().read(rig.plan.id)).document).toEqual(preview);
	tool.pointerDown({ ...pointerAt(1800, 1200), modifiers: { alt: true, shift: false, ctrl: false } }); tool.pointerUp(pointerAt(1800, 1200));
	expect(rig.selection.selectedIds).toEqual([rig.room.id]); expect(rig.runtime.groupActions.target.value).toBeNull();
});

it('encloses a curved Room with exact reused edges and membership in one reversible operation', async () => {
	const rig = await setup(-0.25), baseline = expectOk(await rig.geometry.read(rig.plan.id));
	const original = { ...baseline.document, groups: undefined, structure: { ...rig.original.structure,
		walls: [rig.original.structure.walls[0]], boundaries: [] } };
	expectOk(await rig.geometry.write(rig.plan.id, original, baseline.version)); await rig.runtime.refreshProjection(); rig.selection.select([rig.room.id]); await settle();
	const before = expectOk(await rig.fresh().read(rig.plan.id)).document, write = vi.spyOn(rig.geometry, 'write');
	await rig.wrapper.get('[data-rp-group-action="enclose"]').trigger('click'); await settleUntil(() => !rig.runtime.groupActions.active.value, 'curved enclosure');
	const saved = expectOk(await rig.fresh().read(rig.plan.id)).document, walls = expectDefined(saved.structure, 'enclosure').walls;
	expect(walls).toHaveLength(4); expect(walls[0]).toEqual(rig.original.structure.walls[0]);
	expect(walls.map(wall => wall.start)).toEqual(rig.original.objects[0].points);
	expect(saved.groups?.[0].memberIds).toEqual([rig.room.id, ...walls.map(wall => wall.id)]);
	expect(saved.structure?.openings).toEqual([rig.opening]); expect(write).toHaveBeenCalledOnce();
	await rig.runtime.undo(); expect(expectOk(await rig.fresh().read(rig.plan.id)).document).toEqual(before);
	await rig.runtime.redo(); expect(expectOk(await rig.fresh().read(rig.plan.id)).document).toEqual(saved);
});

it('repeating enclosure preserves catalogue and member order without a write when another group follows it', async () => {
	const rig = await setup(), baseline = expectOk(await rig.geometry.read(rig.plan.id));
	const wall = { ...rig.original.structure.walls[1], id: 'wall-elsewhere', start: { x: 10000, y: 0 }, end: { x: 10000, y: 3000 } };
	const group = expectDefined(rig.original.groups?.[0], 'assembly');
	const groups = [{ ...group, memberIds: group.memberIds.toReversed() }, { id: 'group-elsewhere', name: 'Elsewhere', memberIds: [wall.id] }];
	expectOk(await rig.geometry.write(rig.plan.id, { ...rig.original, groups, structure: { ...rig.original.structure, walls: [...rig.original.structure.walls, wall] } }, baseline.version));
	await rig.runtime.refreshProjection(); rig.selection.select([rig.room.id]); await settle();
	const bytes = [...rig.stack.vault.entries], write = vi.spyOn(rig.geometry, 'write');
	await rig.wrapper.get('[data-rp-group-action="enclose"]').trigger('click'); await settleUntil(() => !rig.runtime.groupActions.active.value, 'unchanged enclosure');
	expect(write).not.toHaveBeenCalled(); expect([...rig.stack.vault.entries]).toEqual(bytes);
	expect(rig.project.groups).toEqual(groups); expect(rig.selection.selectedIds).toEqual([...groups[0].memberIds, rig.opening.id]);
});

it('never replays a successful group write across failed refresh and three read-only retries', async () => {
	const rig = await setup(), write = vi.spyOn(rig.geometry, 'write');
	const read = vi.spyOn(rig.deps.queries, 'getPlan').mockResolvedValue(err(injectedPersistenceError()));
	await rig.runtime.groupActions.moveBy({ dx: 375.25, dy: -150.5 });
	const saved = expectOk(await rig.fresh().read(rig.plan.id)).document, bytes = [...rig.stack.vault.entries];
	expect(write).toHaveBeenCalledOnce(); expect(rig.runtime.writesBlocked.value).toBe(true);
	for (let index = 0; index < 3; index++) { await rig.runtime.refreshProjection(); await rig.runtime.groupActions.moveBy({ dx: 375.25, dy: -150.5 }); }
	expect(write).toHaveBeenCalledOnce(); expect([...rig.stack.vault.entries]).toEqual(bytes);
	read.mockRestore(); await rig.runtime.refreshProjection(); await rig.runtime.undo();
	expect(expectOk(await rig.fresh().read(rig.plan.id)).document).toEqual(rig.original);
	await rig.runtime.redo(); expect(expectOk(await rig.fresh().read(rig.plan.id)).document).toEqual(saved);
});

it('leaves a refused group write unchanged and performs only reads during recovery', async () => {
	const rig = await setup(), bytes = [...rig.stack.vault.entries];
	const write = vi.spyOn(rig.geometry, 'write').mockResolvedValueOnce(err(injectedPersistenceError()));
	await rig.runtime.groupActions.moveBy({ dx: 150, dy: 50 });
	for (let index = 0; index < 3; index++) await rig.runtime.refreshProjection();
	expect(write).toHaveBeenCalledOnce(); expect([...rig.stack.vault.entries]).toEqual(bytes);
	expect(expectOk(await rig.fresh().read(rig.plan.id)).document).toEqual(rig.original);
});

it('refuses a peer change at the conditional write boundary and preserves the peer membership and opening metadata', async () => {
	const rig = await setup(), baseline = expectOk(await rig.geometry.read(rig.plan.id));
	const peer = { ...rig.original, groups: rig.original.groups?.map(group => ({ ...group, name: 'Peer assembly' })),
		structure: { ...rig.original.structure, openings: [{ ...rig.opening, sill: 100 }] } };
	const originalWrite = rig.geometry.write.bind(rig.geometry);
	const write = vi.spyOn(rig.geometry, 'write').mockImplementationOnce(async (...args) => {
		expectOk(await originalWrite(rig.plan.id, peer, baseline.version));
		return originalWrite(...args);
	});
	await rig.runtime.groupActions.moveBy({ dx: 150, dy: 50 });
	expect(write).toHaveBeenCalledOnce(); expect(expectOk(await rig.fresh().read(rig.plan.id)).document).toEqual(peer);
	await rig.runtime.refreshProjection(); expect(write).toHaveBeenCalledOnce();
	expect(rig.runtime.groupActions.preview.value).toBeNull();
});

it('keeps an Alt-selected opening individually editable when its host is a singleton saved group', async () => {
	const rig = await setup(), baseline = expectOk(await rig.geometry.read(rig.plan.id));
	const groups = rig.original.groups?.map(group => ({ ...group, memberIds: [rig.opening.hostId] }));
	expectOk(await rig.geometry.write(rig.plan.id, { ...rig.original, groups }, baseline.version)); await rig.runtime.refreshProjection();
	rig.selection.select([rig.opening.id as never]); await settle();
	expect(rig.runtime.groupActions.target.value).toBeNull();
	expect(rig.wrapper.find('[name="group-dx"]').exists()).toBe(false);
	expect(rig.runtime.groupActions.actions(rig.selection.selectedIds).map(action => action.id)).toContain('select-group');
	const write = vi.spyOn(rig.geometry, 'write');
	await rig.runtime.groupActions.moveBy({ dx: 100, dy: 50 }); expect(write).not.toHaveBeenCalled();
});

it('finishes an enclosure write after disposal without changing the disposed selection or replaying the write', async () => {
	const rig = await setup(), ungroup = expectDefined(rig.runtime.groupActions.actions(rig.selection.selectedIds).find(action => action.id === 'ungroup'), 'ungroup');
	await ungroup.run(); rig.selection.select([rig.room.id]); await settle();
	const enclose = expectDefined(rig.runtime.groupActions.actions(rig.selection.selectedIds).find(action => action.id === 'enclose'), 'enclose');
	const written = defer<void>(), release = defer<void>(), originalWrite = rig.geometry.write.bind(rig.geometry);
	const write = vi.spyOn(rig.geometry, 'write').mockImplementationOnce(async (...args) => {
		const result = await originalWrite(...args); written.resolve(undefined); await release.promise; return result;
	});
	const action = enclose.run(); await written.promise;
	rig.unmount(); mounted.pop(); const selection = [...rig.selection.selectedIds]; release.resolve(undefined); await action;
	expect(write).toHaveBeenCalledOnce(); expect(rig.selection.selectedIds).toEqual(selection);
	expect(expectOk(await rig.fresh().read(rig.plan.id)).document.groups?.[0].memberIds).toEqual(rig.original.groups?.[0].memberIds);
});
