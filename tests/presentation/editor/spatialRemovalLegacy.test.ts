// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { expectDefined, expectOk } from '../../helpers/domain';
import { settle, settleUntil } from '../../helpers/editor';
import { parseFrontmatter } from '../../helpers/vault';
import { withPlanRenovation } from '../../../src/domain/plan/Plan';
import type { NamedSpatialElement } from '../../../src/domain/spatial/SpatialElement';
import { elementInput } from '../../../src/presentation/editor/elements/elementInput';

type Rig = Awaited<ReturnType<typeof renovationEditor>>;
const mounted: Rig[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });
const elements: readonly NamedSpatialElement[] = [
 { id: 'element-legacy-path', name: 'Garden path', kind: 'path', points: [{ x: 200, y: 500 }, { x: 2500, y: 500 }] },
 { id: 'element-legacy-fence', name: 'Garden fence', kind: 'fence', points: [{ x: 200, y: 1500 }, { x: 2500, y: 1500 }] },
 { id: 'element-retained-path', name: 'Retained route', kind: 'path', points: [{ x: 200, y: 2500 }, { x: 2500, y: 2500 }] },
];
async function setup(): Promise<Rig> { const rig = await renovationEditor(true); mounted.push(rig); return rig; }
async function addElements(rig: Rig): Promise<void> {
 for (const element of elements) {
  const read = expectOk(await rig.renovation.read(rig.plan.id));
  expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(read, elementInput(read, element), rig.runtime.structureTask.ledger)));
 }
 await rig.runtime.refreshProjection(); rig.selection.select(elements.slice(0, 2).map(item => item.id) as never[]); await settle();
}
function planFrontmatter(rig: Rig) {
 const path = expectDefined(rig.stack.index.getPath(rig.plan.id), 'Plan path');
 return parseFrontmatter(expectDefined(rig.stack.vault.entries.get(path), 'Plan bytes')).frontmatter;
}
async function openDelete(rig: Rig): Promise<void> {
 const button = rig.wrapper.get<HTMLButtonElement>('[data-rp-batch="delete"]'), details = expectDefined(button.element.closest('details'), 'batch disclosure');
 if (!details.open) expectDefined(details.querySelector('summary'), 'batch summary').click();
 expect(button.element.disabled).toBe(false); button.element.click();
 await settleUntil(() => rig.dialogs.current?.kind === 'confirm', 'spatial batch confirmation');
 expect(rig.wrapper.get('.rp-dialog').text()).toContain('Garden path'); expect(rig.wrapper.get('.rp-dialog').text()).toContain('Garden fence');
}
async function cancelDelete(rig: Rig): Promise<void> {
 await openDelete(rig); rig.wrapper.get<HTMLButtonElement>('[data-rp-action="cancel"]').element.click();
 await settleUntil(() => !rig.runtime.elementActions.removeManyActive.value, 'cancelled spatial batch');
}
async function confirmDelete(rig: Rig): Promise<void> {
 await openDelete(rig); rig.wrapper.get<HTMLButtonElement>('[data-rp-action="confirm"]').element.click();
 await settleUntil(() => !rig.runtime.elementActions.removeManyActive.value, 'confirmed spatial batch');
}
async function undoDelete(rig: Rig): Promise<void> {
 const undo = rig.wrapper.get<HTMLButtonElement>('[data-rp-action="undo"]'); expect(undo.element.disabled).toBe(false); undo.element.click();
 await settleUntil(() => rig.project.structure.elements?.length === elements.length, 'spatial batch Undo');
}
async function proposeWall(rig: Rig): Promise<void> {
 rig.selection.select(['wall-a'] as never[]); await settle();
 await rig.wrapper.get('.rp-structure-renovation-entry select').setValue(rig.room.id);
 await rig.wrapper.get('.rp-structure-renovation-entry button').trigger('click'); await settle();
 await rig.wrapper.get('[data-rp-mode="planned"]').trigger('click'); await settle();
 await rig.wrapper.get('[data-rp-action="new-record"]').trigger('click');
 await settleUntil(() => rig.wrapper.find('[data-rp-form="renovation"]').exists(), 'wall proposal form');
 const form = rig.wrapper.get('[data-rp-form="renovation"]');
 await form.get('textarea[name="description"]').setValue('Raise the partition'); await form.get('input[name="height"]').setValue('2.5');
 await form.trigger('submit'); await settle(); expect(form.find('[role="status"]').exists()).toBe(true);
 await form.trigger('submit'); await settleUntil(() => !rig.wrapper.find('[data-rp-form="renovation"]').exists(), 'wall proposal save');
 await rig.runtime.renovation.perspective('plan'); await settle();
}

describe('spatial batch removal with optional persisted fields', () => {
 it('cancels, deletes and undoes valid existing elements whose optional renovation register is absent', async () => {
  const rig = await setup(); await addElements(rig);
  const created = expectOk(await rig.renovation.read(rig.plan.id));
  // A supported persisted format, not the current element creator's default: an
  // external edit may remove the optional empty register while retaining geometry.
  expect(created.plan.entity.renovation).toEqual({ subjects: [], work: [], decisions: [] });
  expectOk(await rig.stack.plans.save(expectOk(withPlanRenovation(created.plan.entity, undefined)), created.plan.version));
  await rig.runtime.refreshProjection(); await settle();
  const before = expectOk(await rig.renovation.read(rig.plan.id)), bytes = [...rig.stack.vault.entries];
  expect(before.plan.entity.renovation).toBeUndefined(); expect(planFrontmatter(rig)).not.toHaveProperty('renovation');
  expect(before.geometry.document.intended).toBeUndefined(); expect(rig.project.plan?.renovation).toBeUndefined();
  expect(before.geometry.document.structure?.elements).toHaveLength(elements.length);
  await cancelDelete(rig); expect([...rig.stack.vault.entries]).toEqual(bytes);
  await confirmDelete(rig);
  const removed = expectOk(await rig.renovation.read(rig.plan.id));
  expect(removed.geometry.document.structure?.elements?.map(item => item.id)).toEqual(['element-retained-path']);
  expect(removed.plan.entity.spatialElements).toEqual([{ id: 'element-retained-path', name: 'Retained route' }]);
  expect(removed.geometry.document.objects).toEqual(before.geometry.document.objects);
  expect(removed.geometry.document.structure?.walls).toEqual(before.geometry.document.structure?.walls); expect(removed.geometry.document.intended).toBeUndefined();
  await undoDelete(rig);
  const restored = expectOk(await rig.renovation.read(rig.plan.id));
  expect(restored.geometry.document).toEqual(before.geometry.document); expect(restored.plan.entity.spatialElements).toEqual(before.plan.entity.spatialElements);
  expect(restored.plan.entity.renovation).toBeUndefined(); expect(planFrontmatter(rig)).not.toHaveProperty('renovation');
 });

 it('retains an older wall proposal without an intended element array while deleting and restoring later current elements', async () => {
  const rig = await setup(); await proposeWall(rig);
  const wall = expectOk(await rig.renovation.read(rig.plan.id));
  const intended = expectDefined(wall.geometry.document.intended, 'wall proposal');
  expect(intended.elements).toBeUndefined(); expect(intended.walls.find(item => item.id === 'wall-a')?.height).toBe(2500);
  expect(wall.geometry.document.structure?.walls.find(item => item.id === 'wall-a')?.height).toBe(2400);
  expect(wall.plan.entity.renovation?.subjects[0].planned?.description).toBe('Raise the partition');
  await addElements(rig);
  const before = expectOk(await rig.renovation.read(rig.plan.id)), bytes = [...rig.stack.vault.entries];
  expect(before.geometry.document.intended).toEqual(intended); expect(before.geometry.document.intended).not.toHaveProperty('elements');
  expect(before.geometry.document.structure?.elements).toHaveLength(elements.length);
  await cancelDelete(rig); expect([...rig.stack.vault.entries]).toEqual(bytes);
  await confirmDelete(rig);
  const removed = expectOk(await rig.renovation.read(rig.plan.id));
  expect(removed.geometry.document.structure?.elements?.map(item => item.id)).toEqual(['element-retained-path']);
  expect(removed.geometry.document.intended).toEqual(intended); expect(removed.geometry.document.intended).not.toHaveProperty('elements');
  expect(removed.geometry.document.objects).toEqual(before.geometry.document.objects); expect(removed.plan.entity.renovation).toEqual(before.plan.entity.renovation);
  expect(removed.plan.entity.spatialElements).toEqual([{ id: 'element-retained-path', name: 'Retained route' }]);
  await undoDelete(rig);
  const restored = expectOk(await rig.renovation.read(rig.plan.id));
  expect(restored.geometry.document).toEqual(before.geometry.document); expect(restored.geometry.document.intended).not.toHaveProperty('elements');
  expect(restored.plan.entity.renovation).toEqual(before.plan.entity.renovation); expect(restored.plan.entity.spatialElements).toEqual(before.plan.entity.spatialElements);
 });
});
