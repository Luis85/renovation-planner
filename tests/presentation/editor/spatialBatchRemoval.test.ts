// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { expectDefined, expectOk, injectedPersistenceError } from '../../helpers/domain';
import { settle } from '../../helpers/editor';
import { elementInput } from '../../../src/presentation/editor/elements/elementInput';
import { err, ok } from '../../../src/core/result/Result';
import { defer } from '../../helpers/async';
import * as notices from '../../../src/presentation/notices/notify';
import { planningDraft, materialInput } from '../../../src/presentation/editor/planning/planningDraft';
import { EMPTY_RENOVATION } from '../../../src/domain/renovation/Renovation';
import { spatialRemovalInput } from '../../../src/presentation/editor/elements/spatialRemovalInput';

const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); vi.restoreAllMocks(); });
async function setup() {
 const rig = await renovationEditor(true); mounted.push(rig);
 for (const [id, kind] of [['element-path', 'path'], ['element-fence', 'fence']] as const) {
  const baseline = expectOk(await rig.renovation.read(rig.plan.id));
  expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(baseline, elementInput(baseline, { id, kind, name: id, points: [{ x: 0, y: 500 }, { x: 3000, y: 500 }] }), rig.runtime.structureTask.ledger)));
 }
 rig.selection.select(['element-path', 'element-fence'] as never[]); await settle();
 return rig;
}
it('deletes a mixed wall/element selection once, including hosted openings, and restores exact labels/shapes with Undo/Redo', async () => {
 const rig = await setup(), baseline = expectOk(await rig.renovation.read(rig.plan.id));
 const structure = expectDefined(baseline.geometry.document.structure, 'structure');
 const associated = { ...structure, boundaries: [{ roomId: rig.room.id, wallIds: structure.walls.map(wall => wall.id) }] };
 const opening = { id: 'opening-a', hostId: 'wall-a', kind: 'door' as const, offset: 100, width: 800, height: 2000, sill: 0 };
 expectOk(await rig.geometry.write(rig.plan.id, { ...baseline.geometry.document, structure: { ...associated, openings: [opening] }, intended: { ...associated, openings: [opening] } }, baseline.geometry.version));
 await rig.runtime.refreshProjection(); rig.selection.select(['element-path', 'wall-a'] as never[]); await settle();
 const before = expectOk(await rig.renovation.read(rig.plan.id)), labels = rig.project.plan?.spatialElements;
 const command = vi.spyOn(rig.renovation, 'command');
 await rig.wrapper.get('[data-rp-batch="delete"]').trigger('click'); await settle();
 expect(rig.wrapper.get('.rp-dialog').text()).toContain('element-path'); expect(rig.wrapper.get('.rp-dialog').text()).toContain('Wall 1');
 rig.dialogs.resolve('confirm'); await settle();
 expect(command).toHaveBeenCalledTimes(1); expect(rig.project.structure.walls.some(item => item.id === 'wall-a')).toBe(false);
 expect(rig.project.structure.openings).toEqual([]); expect(rig.project.structure.boundaries).toEqual([]); expect(rig.project.intended?.boundaries).toEqual([]); expect(rig.project.structure.elements?.map(item => item.id)).toEqual(['element-fence']);
 expect(rig.project.intended?.elements?.map(item => item.id)).toEqual(['element-fence']);
 expect(rig.project.zones.get(rig.room.id)?.points).toEqual(rig.room.geometry.points);
 expectOk(await rig.runtime.dispatcher.undo()); await settle();
 expect(expectOk(await rig.geometry.read(rig.plan.id)).document).toEqual(before.geometry.document); expect(rig.project.plan?.spatialElements).toEqual(labels);
 expectOk(await rig.runtime.dispatcher.redo()); await settle(); expect(rig.project.structure.elements).toHaveLength(1);
});
it('leaves every member untouched on cancellation, a failed read, and a sidecar failure with conditional compensation', async () => {
 const rig = await setup(), before = expectOk(await rig.renovation.read(rig.plan.id));
 const remove = rig.runtime.elementActions.removeMany, ids = [...rig.selection.selectedIds];
 const cancelled = remove(ids); await settle(); rig.dialogs.resolve('cancel'); await cancelled;
 vi.spyOn(rig.renovation, 'read').mockResolvedValueOnce(err(injectedPersistenceError())); await remove(ids);
 vi.spyOn(rig.geometry, 'write').mockResolvedValueOnce(err(injectedPersistenceError()));
 const failed = remove(ids); await settle(); rig.dialogs.resolve('confirm'); await failed;
 const after = expectOk(await rig.renovation.read(rig.plan.id)); expect(after.geometry.document).toEqual(before.geometry.document); expect(after.plan.entity).toEqual(before.plan.entity);
});
it('refuses a peer edit that arrives while the named deletion confirmation is open', async () => {
 const rig = await setup(), remove = rig.runtime.elementActions.removeMany([...rig.selection.selectedIds]); await settle();
 const baseline = expectOk(await rig.geometry.read(rig.plan.id));
 const structure = expectDefined(baseline.document.structure, 'structure');
 const elements = expectDefined(structure.elements, 'elements').map(item => ({ ...item, points: item.points.map(point => ({ ...point, x: point.x + 10 })) }));
 expectOk(await rig.geometry.write(rig.plan.id, { ...baseline.document, structure: { ...structure, elements } }, baseline.version));
 const bytes = [...rig.stack.vault.entries]; rig.dialogs.resolve('confirm'); await remove; expect([...rig.stack.vault.entries]).toEqual(bytes);
});
it('abandons a delayed read when selection changes and refuses missing or Room members', async () => {
 const rig = await setup(), baseline = expectOk(await rig.renovation.read(rig.plan.id)), pending = defer<Awaited<ReturnType<typeof rig.renovation.read>>>();
 vi.spyOn(rig.renovation, 'read').mockReturnValueOnce(pending.promise);
 const removal = rig.runtime.elementActions.removeMany([...rig.selection.selectedIds]); rig.selection.select([rig.room.id]);
 pending.resolve(ok(baseline)); await removal; expect(rig.dialogs.current).toBeNull();
 await rig.runtime.elementActions.removeMany([rig.room.id, 'element-path']); await rig.runtime.elementActions.removeMany(['missing', 'element-path']);
 expect(rig.dialogs.current).toBeNull(); expect(rig.project.structure.elements).toHaveLength(2);
});
it('includes intended-only hosted openings in the same referential removal scope', async () => {
 const rig = await setup(), baseline = expectOk(await rig.renovation.read(rig.plan.id)), structure = expectDefined(baseline.geometry.document.structure, 'structure');
 const intended = { ...structure, openings: [{ id: 'opening-future', hostId: 'wall-a', kind: 'window' as const, offset: 100, width: 800, height: 1200, sill: 800 }] };
 const proposal = spatialRemovalInput({ ...baseline, geometry: { ...baseline.geometry, document: { ...baseline.geometry.document, intended } } }, ['wall-a', 'element-path']);
 expect(proposal.ids).toContain('opening-future'); expect(proposal.input.intended?.openings).toEqual([]);
});

it.each(['Work', 'material'] as const)('refuses the whole selected deletion when a current %s refers to one member', async kind => {
 const rig = await setup(); let referenceName = 'Lay garden path';
 if (kind === 'Work') {
  const read = expectOk(await rig.renovation.read(rig.plan.id));
  const work = { id: 'work-path', roomId: rig.room.id, targetId: 'element-path', title: 'Lay garden path', description: '', order: 0, progress: 'pending' as const, responsibility: 'unassigned' as const, outcomes: [], dependencies: [] };
  expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(read, { renovation: { ...(read.plan.entity.renovation ?? EMPTY_RENOVATION), work: [work] }, intended: read.geometry.document.intended }, rig.runtime.structureTask.ledger)));
 } else {
  const planning = expectDefined(rig.deps.commands.planning, 'planning'), read = expectOk(await planning.read(rig.plan.id));
  const draft = planningDraft('material', read, rig.room.id);
  const asset = expectDefined(read.catalogue.find(item => item.asset.unit === 'm2'), 'area asset').asset;
  draft.assetId = asset.id; referenceName = asset.name;
  draft.targetId = 'element-path'; draft.source = { ...draft.source, rule: 'manual', manual: '1' };
  expectOk(await rig.runtime.dispatcher.run(planning.material(read, materialInput(draft), rig.runtime.structureTask.ledger)));
 }
 rig.selection.select(['element-path', 'element-fence'] as never[]); await settle();
 const before = [...rig.stack.vault.entries], command = vi.spyOn(rig.renovation, 'command');
 const removing = rig.runtime.elementActions.removeMany([...rig.selection.selectedIds]); await settle();
 expect(rig.dialogs.current?.kind).toBe('confirm'); expect(rig.wrapper.get('.rp-dialog').text()).toContain(referenceName);
 rig.dialogs.resolve('confirm'); await removing;
 expect(command).not.toHaveBeenCalled(); expect([...rig.stack.vault.entries]).toEqual(before); expect(rig.project.structure.elements).toHaveLength(2);
});
it('refreshes a peer shape before asking for deletion and does not overwrite that shape', async () => {
 const rig = await setup(), read = expectOk(await rig.geometry.read(rig.plan.id)), structure = expectDefined(read.document.structure, 'structure');
 const elements = expectDefined(structure.elements, 'elements').map(item => ({ ...item, points: item.points.map(point => ({ ...point, y: point.y + 100 })) }));
 expectOk(await rig.geometry.write(rig.plan.id, { ...read.document, structure: { ...structure, elements } }, read.version));
 const before = [...rig.stack.vault.entries], command = vi.spyOn(rig.renovation, 'command');
 await rig.runtime.elementActions.removeMany([...rig.selection.selectedIds]); await settle();
 expect(rig.dialogs.current).toBeNull(); expect(command).not.toHaveBeenCalled(); expect([...rig.stack.vault.entries]).toEqual(before);
 expect(rig.project.structure.elements).toEqual(elements);
});

it('refuses repeated deletion while its read is pending and reports a thrown read without writes', async () => {
 const rig = await setup(), ids = [...rig.selection.selectedIds], before = [...rig.stack.vault.entries];
 const baseline = expectOk(await rig.renovation.read(rig.plan.id)), gate = defer<Awaited<ReturnType<typeof rig.renovation.read>>>();
 const read = vi.spyOn(rig.renovation, 'read').mockReturnValueOnce(gate.promise);
 const pending = rig.runtime.elementActions.removeMany(ids); await rig.runtime.elementActions.removeMany(ids);
 expect(read).toHaveBeenCalledTimes(1); rig.selection.clear(); gate.resolve(ok(baseline)); await pending;
 rig.selection.select(ids as never[]); await settle(); read.mockRejectedValueOnce(new Error('Offline geometry'));
 await rig.runtime.elementActions.removeMany(ids); expect(rig.runtime.elementActions.removeManyActive.value).toBe(false);
 expect(rig.dialogs.current).toBeNull(); expect([...rig.stack.vault.entries]).toEqual(before);
});
it.each(['read failure', 'leaf close'] as const)('does not confirm deletion after material %s', async kind => {
 const rig = await setup(), planning = expectDefined(rig.deps.commands.planning, 'planning');
 const baseline = expectOk(await planning.read(rig.plan.id)), gate = defer<Awaited<ReturnType<typeof planning.read>>>();
 const read = vi.spyOn(planning, 'read').mockReturnValueOnce(gate.promise), before = [...rig.stack.vault.entries];
 const pending = rig.runtime.elementActions.removeMany([...rig.selection.selectedIds]); await settle(); expect(read).toHaveBeenCalledTimes(1);
 if (kind === 'leaf close') { mounted.splice(mounted.indexOf(rig), 1); rig.unmount(); gate.resolve(ok(baseline)); }
 else gate.resolve(err(injectedPersistenceError()));
 await pending; expect(rig.dialogs.current).toBeNull(); expect([...rig.stack.vault.entries]).toEqual(before);
});

it('does not report a retired batch deletion read failure after the leaf closes', async () => {
 const rig = await setup(), planning = expectDefined(rig.deps.commands.planning, 'planning');
 const gate = defer<Awaited<ReturnType<typeof planning.read>>>();
 const read = vi.spyOn(planning, 'read').mockReturnValueOnce(gate.promise);
 const report = vi.spyOn(notices, 'notifyOperationFailure').mockImplementation(() => undefined);
 const before = [...rig.stack.vault.entries];
 const pending = rig.runtime.elementActions.removeMany([...rig.selection.selectedIds]); await settle();
 expect(read).toHaveBeenCalledOnce();
 mounted.splice(mounted.indexOf(rig), 1); rig.unmount(); gate.resolve(err(injectedPersistenceError())); await pending;
 expect(report).not.toHaveBeenCalled(); expect([...rig.stack.vault.entries]).toEqual(before); expect(rig.dialogs.current).toBeNull();
 report.mockRestore();
});
