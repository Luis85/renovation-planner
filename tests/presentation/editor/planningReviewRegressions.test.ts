// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { planningStack } from '../../helpers/planning';
import { expectDefined, expectOk } from '../../helpers/domain';
import { settle } from '../../helpers/editor';
import { defer } from '../../helpers/async';
import { err } from '../../../src/core/result/Result';
import { withPlanRenovation } from '../../../src/domain/plan/Plan';
import { materialRows, costRows, aggregateCosts, shoppingBody } from '../../../src/presentation/editor/planning/planningProjection';

const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });
async function setup() {
 const rig = await renovationEditor(true); mounted.push(rig); rig.changePlan(); await settle();
 return rig;
}
describe('planning review regressions', () => {
 it('generates renovation and planning findings from one fresh baseline before a peer notification arrives', async () => {
  const rig = await setup(), services = expectDefined(rig.deps.commands.planning, 'planning');
  await rig.runtime.renovation.perspective('review'); await settle();
  const read = expectOk(await services.read(rig.plan.id));
  const subject = { id: 'peer-proposal', roomId: rig.room.id, targetId: rig.room.id, kind: 'floor' as const, existing: null, planned: { change: 'add' as const, description: 'Peer floor proposal' } };
  expectOk(await rig.stack.plans.save(expectOk(withPlanRenovation(read.plan.entity, { subjects: [subject], work: [], decisions: [] })), read.plan.version));
  expect(rig.wrapper.text()).toContain('No gaps found');
  const write = vi.spyOn(rig.deps.commands, 'reviewNote');
  await rig.wrapper.get('[data-rp-action="review-note"]').trigger('click'); await settle();
  expect(write.mock.calls[0][1]).toContain('Peer floor proposal'); expect(write.mock.calls[0][1]).not.toContain('No gaps found');
 });
 it('refuses a shopping list when a fully procured source becomes stale', async () => {
  const rig = await planningStack();
  expectOk(await rig.planning.material(expectOk(await rig.read()), rig.input, rig.ledger).execute());
  const before = expectOk(await rig.read()), requirement = before.materials[0].entity;
  const renovation = { ...rig.value, depth: { ...rig.depth, procurement: [{ id: 'stock', roomId: rig.roomId, targetId: rig.roomId, workId: '', unit: requirement.unit, requirementId: requirement.id, purchased: requirement.quantity.calculated.value.toString(), reserved: '0' }] } };
  expectOk(await rig.stack.plans.save(expectOk(withPlanRenovation(before.plan.entity, renovation)), before.plan.version));
  expect(shoppingBody(expectOk(await rig.read()))).toBe('');
  expectOk(await rig.geometry.write(rig.plan.id, { ...before.geometry.document, objects: before.geometry.document.objects.map(room => ({ ...room, points: room.points.map(point => ({ ...point, x: point.x * 2 })) })) }, before.geometry.version));
  const after = expectOk(await rig.read()); expect(materialRows(after)[0].outstanding.toString()).toBe('0');
  expect(shoppingBody(after)).toBeNull();
 });
 it('withholds the all-clear during pending/failed reads and for missing evidence, including the generated note', async () => {
  const rig = await setup(), services = expectDefined(rig.deps.commands.planning, 'planning');
  await rig.runtime.renovation.perspective('review'); await settle();
  expect(rig.wrapper.text()).toContain('No gaps found');
  const write = vi.spyOn(rig.deps.commands, 'reviewNote');
  await rig.wrapper.get('[data-rp-action="review-note"]').trigger('click'); await settle();
  expect(write).toHaveBeenCalledWith(rig.plan.id, expect.stringContaining('No gaps found'));
  write.mockClear();
  const pending = defer<Awaited<ReturnType<typeof services.read>>>();
  vi.spyOn(services, 'read').mockReturnValueOnce(pending.promise); rig.changePlan(); await settle();
  expect(rig.wrapper.text()).not.toContain('No gaps found');
  pending.resolve(err({ category: 'Persistence', code: 'test.read', message: 'offline' })); await settle();
  expect(rig.wrapper.text()).not.toContain('No gaps found');
  const read = expectOk(await services.read(rig.plan.id));
  const evidence = { id: 'missing', roomId: rig.room.id, targetId: rig.room.id, workId: '', recordId: '', path: 'Evidence/missing.pdf', subpath: '', description: 'Invoice', type: 'document' as const, phase: 'before' as const, pin: null };
  expectOk(await rig.stack.plans.save(expectOk(withPlanRenovation(read.plan.entity, { subjects: [], work: [], decisions: [], depth: { costs: [], procurement: [], evidence: [evidence] } })), read.plan.version));
  rig.changePlan(); await settle();
  expect(rig.wrapper.text()).toContain('Invoice'); expect(rig.wrapper.text()).not.toContain('No gaps found');
  await rig.wrapper.get('[data-rp-action="review-note"]').trigger('click'); await settle();
  expect(write).toHaveBeenCalledWith(rig.plan.id, expect.stringContaining('Invoice'));
  expect(write.mock.calls[0][1]).not.toContain('No gaps found');
 });
 it('ignores unrelated vault activity but refreshes linked files and entity changes', async () => {
  const rig = await setup(), services = expectDefined(rig.deps.commands.planning, 'planning'), read = expectOk(await services.read(rig.plan.id));
  const evidence = { id: 'invoice', roomId: rig.room.id, targetId: rig.room.id, workId: '', recordId: '', path: 'Evidence/invoice.pdf', subpath: '', description: 'Invoice', type: 'document' as const, phase: 'before' as const, pin: null };
  expectOk(await rig.stack.plans.save(expectOk(withPlanRenovation(read.plan.entity, { subjects: [], work: [], decisions: [], depth: { costs: [], procurement: [], evidence: [evidence] } })), read.plan.version)); rig.changePlan(); await settle();
  const reads = vi.spyOn(services, 'read');
  for (let index = 0; index < 30; index++) rig.changeFile(`Journal/${index}.md`);
  rig.changeFile('Evidence/invoice.pdf.bak'); await settle(); expect(reads).not.toHaveBeenCalled();
  rig.changeFile('Evidence/invoice.pdf'); await settle(); expect(reads).toHaveBeenCalledTimes(1);
  rig.changeFile('Evidence'); await settle(); expect(reads).toHaveBeenCalledTimes(2);
  rig.changePlan(); await settle(); expect(reads).toHaveBeenCalledTimes(3);
  rig.changeCatalogue(); await settle(); expect(reads).toHaveBeenCalledTimes(4);
 });
 it('detects changed source measurements even when packaging leaves quantity and cost unchanged', async () => {
  const rig = await planningStack(), input = { ...rig.input, source: { ...rig.input.source, lot: '100' } };
  expectOk(await rig.planning.material(expectOk(await rig.read()), input, rig.ledger).execute());
  const before = expectOk(await rig.read());
  expectOk(await rig.geometry.write(rig.plan.id, { ...before.geometry.document, objects: before.geometry.document.objects.map(room => ({ ...room, points: room.points.map(point => ({ ...point, x: point.x * 1.01 })) })) }, before.geometry.version));
  const after = expectOk(await rig.read()), row = materialRows(after)[0];
  expect(row.entity.quantity.calculated.value.toString()).toBe('100');
  expect(row.entity.estimatedCost).toEqual(before.materials[0].entity.estimatedCost);
  expect(row.entity.recalculationStatus).toBe('current'); expect(row.stale).toBe(true);
  expect(shoppingBody(after)).toBeNull(); expect(aggregateCosts(costRows(after, rig.roomId), after.currency)).toBeNull();
 });
});
