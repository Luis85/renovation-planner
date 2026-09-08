// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { expectDefined, expectOk } from '../../helpers/domain';
import { settle, settleUntil } from '../../helpers/editor';
import { AssignAssetCommand } from '../../../src/application/commands/requirement/AssignAsset';
import { ReferenceLocks } from '../../../src/application/reference/ReferenceLocks';
import { InMemoryAssetPriceOverrideRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryAssetPriceOverrideRepository';
import type { RequirementId } from '../../../src/domain/requirement/RequirementId';
import type { NamedSpatialElement } from '../../../src/domain/spatial/SpatialElement';
import { elementInput } from '../../../src/presentation/editor/elements/elementInput';
import { tr } from '../../../src/presentation/i18n/strings';
import { compare } from '../../../src/core/money/Money';

type Rig = Awaited<ReturnType<typeof renovationEditor>>;
const mounted: Rig[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });
async function setup(): Promise<Rig> {
 const rig = await renovationEditor(true); mounted.push(rig);
 await rig.runtime.refreshProjection(); rig.runtime.renovation.focus(rig.room.id, 'materials'); await settle();
 return rig;
}
async function areaAsset(rig: Rig) {
 return expectDefined(expectOk(await rig.stack.assets.listAll()).loaded.find(item => item.entity.unit === 'm2'), 'area material').entity;
}
async function startMaterial(rig: Rig): Promise<void> {
 await rig.wrapper.get('[data-rp-new-material]').trigger('click'); await settle();
 await rig.wrapper.get('select[name="asset"]').setValue((await areaAsset(rig)).id);
}
async function saveMaterial(rig: Rig) {
 await rig.wrapper.get('[data-rp-form="planning"]').trigger('submit');
 await settleUntil(() => !rig.wrapper.find('[data-rp-form="planning"]').exists(), 'material save');
 return expectDefined(expectOk(await rig.stack.requirements.listByZone(rig.room.id))[0], 'saved material').entity;
}
async function cancel(rig: Rig): Promise<void> { rig.dialogs.resolve('cancel'); await settle(); }
async function editMaterial(rig: Rig, id: string): Promise<void> {
 const row = rig.wrapper.get(`[data-rp-record="${id}"]`), disclosure = row.get('[data-rp-material-details]');
 if (disclosure.attributes('aria-expanded') !== 'true') await disclosure.trigger('click');
 await expectDefined(row.findAll('button').find(button => button.text() === tr('renovation.edit')), 'Edit material').trigger('click'); await settle();
}
async function readMaterial(rig: Rig, id: RequirementId) { return expectDefined(expectOk(await rig.stack.requirements.getById(id)), 'material').entity; }
async function costChoice(rig: Rig, id: string): Promise<string> {
 rig.runtime.renovation.focus(rig.room.id, 'costs'); await settle();
 await rig.wrapper.get('[data-rp-new-cost]').trigger('click'); await settle();
 return rig.wrapper.get(`select[name="requirement"] option[value="${id}"]`).text();
}
async function evidenceChoice(rig: Rig, id: string): Promise<string> {
 rig.runtime.renovation.focus(rig.room.id, 'documents'); await settle();
 await rig.wrapper.get('[data-rp-new-evidence]').trigger('click'); await settle();
 return rig.wrapper.get(`select[name="record"] option[value="${id}"]`).text();
}

describe('planning choices from saved and temporarily unavailable facts', () => {
 it('explains persisted packaging and preserves it when an explicit zero override changes the effective quantity', async () => {
  const rig = await setup(); await startMaterial(rig);
  await rig.wrapper.get('input[name="lot"]').setValue('5'); await rig.wrapper.get('input[name="minimum"]').setValue('20');
  const saved = await saveMaterial(rig);
  expect(saved.quantity.calculated.value.toString()).toBe('20'); expect(saved.estimatedCost.calculated.amount).toBe('900');
  const row = rig.wrapper.get(`[data-rp-record="${saved.id}"]`);
  await row.get('[data-rp-material-details]').trigger('click');
  const explanation = row.get<HTMLDetailsElement>('details'); explanation.element.open = true; await explanation.trigger('toggle');
  expect(explanation.text()).toContain(`${tr('planning.lot')}: 5`); expect(explanation.text()).toContain(`${tr('planning.minimum')}: 20`);
  await editMaterial(rig, saved.id); await rig.wrapper.get('input[name="override"]').setValue('0');
  const zero = await saveMaterial(rig);
  expect(zero.id).toBe(saved.id); expect(zero.source).toEqual(saved.source);
  expect(zero.quantity.calculated.value.toString()).toBe('20'); expect(zero.quantity.override?.value.toString()).toBe('0'); expect(zero.estimatedCost.calculated.amount).toBe('0');
  await editMaterial(rig, saved.id);
  expect(rig.wrapper.get<HTMLInputElement>('input[name="override"]').element.value).toBe('0');
  expect(rig.wrapper.get<HTMLInputElement>('input[name="lot"]').element.value).toBe('5'); expect(rig.wrapper.get<HTMLInputElement>('input[name="minimum"]').element.value).toBe('20');
  await cancel(rig);
  const totals = rig.wrapper.get(`[data-rp-record="${saved.id}"] .rp-material-numbers`).text();
  expect(totals).toContain('0 m2'); expect(totals).toContain('0.00 EUR'); expect(totals).toContain(tr('planning.manual'));
 });

 it('keeps the Requirement selectable by identity while its catalogue note is missing and restores its name after repair', async () => {
  const rig = await setup(); await startMaterial(rig); const material = await saveMaterial(rig), asset = await areaAsset(rig);
  const path = expectDefined(rig.stack.index.getPath(asset.id), 'asset note'), original = expectDefined(rig.stack.vault.entries.get(path), 'asset bytes');
  rig.stack.vault.entries.delete(path); const missingBytes = [...rig.stack.vault.entries];
  await rig.runtime.refreshProjection(); await settle();
  expect(await costChoice(rig, material.id)).toBe(material.id); await cancel(rig);
  expect(await evidenceChoice(rig, material.id)).toBe(material.id); await cancel(rig);
  expect(await readMaterial(rig, material.id)).toEqual(material); expect([...rig.stack.vault.entries]).toEqual(missingBytes);
  rig.stack.vault.entries.set(path, original); await rig.runtime.refreshProjection(); await settle();
  expect(await costChoice(rig, material.id)).toBe(asset.name); await cancel(rig);
  expect(await evidenceChoice(rig, material.id)).toBe(asset.name); await cancel(rig);
  expect(await readMaterial(rig, material.id)).toEqual(material);
 });

 it('opens a legacy assignment at its Room and preserves its identity when the first explicit source is saved', async () => {
  const rig = await setup(), asset = await areaAsset(rig);
  const assign = new AssignAssetCommand({ ...rig.stack, locks: new ReferenceLocks(), overrides: new InMemoryAssetPriceOverrideRepository() });
  const legacy = expectOk(await assign.execute({ zoneId: rig.room.id, assetId: asset.id })).requirement;
  expect(legacy.source).toBeUndefined(); await rig.runtime.refreshProjection(); await settle();
  const bytes = [...rig.stack.vault.entries]; await editMaterial(rig, legacy.id);
  expect(rig.wrapper.get<HTMLSelectElement>('select[name="asset"]').element.value).toBe(asset.id);
  expect(rig.wrapper.get<HTMLSelectElement>('select[name="target"]').element.value).toBe(rig.room.id);
  await cancel(rig); expect([...rig.stack.vault.entries]).toEqual(bytes);
  await editMaterial(rig, legacy.id); const saved = await saveMaterial(rig);
  expect(saved.id).toBe(legacy.id); expect(saved.origin).toEqual(legacy.origin); expect(saved.assetId).toBe(asset.id);
  expect(saved.source).toMatchObject({ planId: rig.plan.id, targetId: rig.room.id, rule: 'room-area', state: 'current', workId: '', outcomeId: '' });
  expect(saved.quantity.calculated).toEqual(legacy.quantity.calculated);
  expect(expectOk(compare(saved.estimatedCost.calculated, legacy.estimatedCost.calculated))).toBe(0);
  expect(saved.estimatedCost.override).toEqual(legacy.estimatedCost.override);
  expect(expectOk(await rig.stack.requirements.listByZone(rig.room.id))).toHaveLength(1);
 });

 it('labels a removal outcome with its existing facts and keeps that relation when material is saved', async () => {
  const rig = await setup(), baseline = expectOk(await rig.renovation.read(rig.plan.id));
  const subject = { id: 'detail-remove-floor', roomId: rig.room.id, targetId: rig.room.id, kind: 'floor' as const,
   existing: { description: 'Old parquet', condition: 'worn' as const }, planned: { change: 'remove' as const, description: '' } };
  expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(baseline,
   { renovation: { subjects: [subject], work: [], decisions: [] }, intended: baseline.geometry.document.intended }, rig.runtime.structureTask.ledger)));
  await rig.runtime.refreshProjection(); await settle(); await startMaterial(rig);
  expect(rig.wrapper.get(`select[name="outcome"] option[value="${subject.id}"]`).text()).toBe(subject.existing.description);
  await rig.wrapper.get('select[name="outcome"]').setValue(subject.id); const material = await saveMaterial(rig);
  expect(material.source?.outcomeId).toBe(subject.id);
  expect(expectOk(await rig.renovation.read(rig.plan.id)).plan.entity.renovation?.subjects).toEqual([subject]);
 });

 it('plans a fixture for a selected Object through Room context and native fields without changing its current outline', async () => {
  const rig = await setup(), baseline = expectOk(await rig.renovation.read(rig.plan.id));
  const object: NamedSpatialElement = { id: 'element-cabinet', kind: 'object', name: 'Existing cabinet',
   points: [{ x: 500, y: 500 }, { x: 1500, y: 500 }, { x: 1500, y: 1200 }, { x: 500, y: 1200 }] };
  expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(baseline, elementInput(baseline, object), rig.runtime.structureTask.ledger)));
  await rig.runtime.renovation.perspective('plan'); rig.selection.select([object.id as never]); await settle();
  await rig.wrapper.get('.rp-element-inspector .rp-structure-renovation-entry select').setValue(rig.room.id);
  await rig.wrapper.get('.rp-element-inspector .rp-structure-renovation-entry button').trigger('click'); await settle();
  await rig.wrapper.get('[data-rp-mode="planned"]').trigger('click'); await settle();
  await rig.wrapper.get('[data-rp-action="new-record"]').trigger('click');
  await settleUntil(() => rig.wrapper.find('[data-rp-form="renovation"]').exists(), 'Object planned form');
  const form = rig.wrapper.get('[data-rp-form="renovation"]');
  expect(form.get<HTMLSelectElement>('select').element.value).toBe('fixture');
  await form.get('textarea[name="description"]').setValue('Refinish cabinet');
  await form.trigger('submit'); await settle(); expect(form.find('[role="status"]').exists()).toBe(true);
  await form.trigger('submit'); await settleUntil(() => !rig.wrapper.find('[data-rp-form="renovation"]').exists(), 'Object planned save');
  const saved = expectOk(await rig.renovation.read(rig.plan.id));
  const subject = expectDefined(saved.plan.entity.renovation?.subjects.find(item => item.targetId === object.id), 'planned fixture');
  expect(subject).toMatchObject({ kind: 'fixture', roomId: rig.room.id, targetId: object.id, existing: { description: object.name }, planned: { change: 'modify', description: 'Refinish cabinet' } });
  expect(saved.geometry.document.structure?.elements?.find(item => item.id === object.id)?.points).toEqual(object.points);
  expectOk(await rig.runtime.dispatcher.undo()); await settle();
  const undone = expectOk(await rig.renovation.read(rig.plan.id));
  expect(undone.plan.entity.renovation?.subjects.find(item => item.id === subject.id)).toBeUndefined();
  expect(undone.geometry.document.structure?.elements?.find(item => item.id === object.id)?.points).toEqual(object.points);
 });
});
