// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { expectDefined, expectOk, injectedPersistenceError } from '../../helpers/domain';
import { settle } from '../../helpers/editor';
import { elementInput } from '../../../src/presentation/editor/elements/elementInput';
import { err, ok } from '../../../src/core/result/Result';
import { defer } from '../../helpers/async';
import { spatialRemovalInput } from '../../../src/presentation/editor/elements/spatialRemovalInput';

const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });
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
 const opening = { id: 'opening-a', hostId: 'wall-a', kind: 'door' as const, offset: 100, width: 800, height: 2000, sill: 0 };
 expectOk(await rig.geometry.write(rig.plan.id, { ...baseline.geometry.document, structure: { ...structure, openings: [opening] }, intended: { ...structure, openings: [opening] } }, baseline.geometry.version));
 await rig.runtime.refreshProjection(); rig.selection.select(['element-path', 'wall-a'] as never[]); await settle();
 const before = expectOk(await rig.renovation.read(rig.plan.id)), labels = rig.project.plan?.spatialElements;
 const command = vi.spyOn(rig.renovation, 'command');
 await rig.wrapper.get('[data-rp-batch="delete"]').trigger('click'); await settle();
 expect(rig.wrapper.get('.rp-dialog').text()).toContain('element-path'); expect(rig.wrapper.get('.rp-dialog').text()).toContain('Wall 1');
 rig.dialogs.resolve('confirm'); await settle();
 expect(command).toHaveBeenCalledTimes(1); expect(rig.project.structure.walls.some(item => item.id === 'wall-a')).toBe(false);
 expect(rig.project.structure.openings).toEqual([]); expect(rig.project.structure.elements?.map(item => item.id)).toEqual(['element-fence']);
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
