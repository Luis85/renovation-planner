// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import type Konva from 'konva';
import { err } from '../../../src/core/result/Result';
import { renovationEditor } from '../../helpers/renovationEditor';
import { expectDefined, expectFound, expectOk } from '../../helpers/domain';
import { settle, settleUntil } from '../../helpers/editor';
import { defer } from '../../helpers/async';
import * as notices from '../../../src/presentation/notices/notify';
import { EMPTY_DEPTH, type Evidence } from '../../../src/domain/renovation/PlanningDepth';
import { withPlanRenovation } from '../../../src/domain/plan/Plan';
import { MigrationRunner } from '../../../src/infrastructure/persistence/migration/MigrationRunner';
import { PLAN_MIGRATIONS } from '../../../src/infrastructure/persistence/migration/entities/plan/plan.migrations';
import { tr } from '../../../src/presentation/i18n/strings';
import { planToPersistence } from '../../../src/infrastructure/persistence/mappers/planMapper';
const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); vi.restoreAllMocks(); });
async function setup() {
 const rig = await renovationEditor(true); mounted.push(rig);
 rig.runtime.renovation.focus(rig.room.id, 'photos'); await settle();
 await rig.wrapper.get('[data-rp-new-evidence]').trigger('click'); await settle();
 await rig.wrapper.get('input[name="title"]').setValue('Before opening the wall');
 await rig.wrapper.get('input[name="path"]').setValue('scan.png');
 return rig;
}
it('records an explicit photo date through the native form and retains it across read-back, editing and Undo', async () => {
 const rig = await setup(), originalFile = rig.stack.vault.entries.get('scan.png');
 const date = rig.wrapper.get<HTMLInputElement>('input[name="evidence-date"]');
 expect(date.element.value).toBe('');
 await date.setValue('2026-08-28'); await rig.wrapper.get('[data-rp-form="planning"]').trigger('submit'); await settle();
 const saved = expectFound(await rig.stack.plans.getById(rig.plan.id)), record = expectDefined(saved.entity.renovation?.depth?.evidence[0], 'saved photo');
 expect(record).toMatchObject({ description: 'Before opening the wall', type: 'photo', date: '2026-08-28', roomId: rig.room.id, targetId: rig.room.id });
 const raw = planToPersistence(saved.entity, saved.version.revision); expect(raw['schema-version']).toBe(8);
 const older = new MigrationRunner(); older.registerAll('plan', PLAN_MIGRATIONS.filter(step => step.toVersion <= 7));
 expect(() => older.migrateToLatest('plan', raw, 8)).toThrow('newer than this build supports');
 rig.runtime.renovation.focus(rig.room.id, 'photos', record.id); await settle();
 expect(rig.wrapper.get('[data-rp-record="'+record.id+'"] time').attributes('datetime')).toBe('2026-08-28');
 await rig.wrapper.get('[data-rp-record="'+record.id+'"] .rp-planning-actions button:nth-child(2)').trigger('click'); await settle();
 expect(rig.wrapper.get<HTMLInputElement>('input[name="evidence-date"]').element.value).toBe('2026-08-28');
 await rig.wrapper.get('input[name="title"]').setValue('Before opening the north wall');
 await rig.wrapper.get('[data-rp-form="planning"]').trigger('submit'); await settle();
 expect(expectFound(await rig.stack.plans.getById(rig.plan.id)).entity.renovation?.depth?.evidence[0]).toMatchObject({ id: record.id, date: '2026-08-28', description: 'Before opening the north wall' });
 expectOk(await rig.runtime.dispatcher.undo()); await settle();
 expect(expectFound(await rig.stack.plans.getById(rig.plan.id)).entity.renovation?.depth?.evidence[0]).toEqual(record);
 expect(rig.stack.vault.entries.get('scan.png')).toBe(originalFile);
});

async function savedPhoto() {
 const rig = await setup(); await rig.wrapper.get('input[name="evidence-date"]').setValue('2026-08-28');
 await rig.wrapper.get('[data-rp-form="planning"]').trigger('submit'); await settle();
 const record = expectDefined(rig.project.plan?.renovation?.depth?.evidence[0], 'saved dated photo');
 rig.runtime.renovation.focus(rig.room.id, 'photos', record.id); await settle();
 return { rig, record };
}
async function editPhoto(rig: Awaited<ReturnType<typeof setup>>, id: string) {
 await rig.wrapper.get('[data-rp-record="'+id+'"] .rp-planning-actions button:nth-child(2)').trigger('click'); await settle();
}
it('saves a date-only correction and clearing as separate undoable facts without changing file bytes or other metadata', async () => {
 const { rig, record } = await savedPhoto(), file = rig.stack.vault.entries.get('scan.png');
 await editPhoto(rig, record.id); await rig.wrapper.get('input[name="evidence-date"]').setValue('2026-08-29');
 await rig.wrapper.get('[data-rp-form="planning"]').trigger('submit'); await settle();
 const corrected = expectFound(await rig.stack.plans.getById(rig.plan.id));
 expect(corrected.entity.renovation?.depth?.evidence[0]).toEqual({ ...record, date: '2026-08-29' });
 await editPhoto(rig, record.id); await rig.wrapper.get('input[name="evidence-date"]').setValue('');
 await rig.wrapper.get('[data-rp-form="planning"]').trigger('submit'); await settle();
 const cleared = expectFound(await rig.stack.plans.getById(rig.plan.id));
 expect(cleared.entity.renovation?.depth?.evidence[0]?.date).toBeUndefined(); expect(planToPersistence(cleared.entity, cleared.version.revision)['schema-version']).toBe(4);
 expectOk(await rig.runtime.dispatcher.undo()); await settle();
 expect(expectFound(await rig.stack.plans.getById(rig.plan.id)).entity.renovation?.depth?.evidence[0]).toEqual({ ...record, date: '2026-08-29' });
 expectOk(await rig.runtime.dispatcher.undo()); await settle();
 expect(expectFound(await rig.stack.plans.getById(rig.plan.id)).entity.renovation?.depth?.evidence[0]).toEqual(record); expect(rig.stack.vault.entries.get('scan.png')).toBe(file);
});
it.each(['2026-02-30', '2026-2-3', '0000-01-01'])('refuses the typed calendar date %s without a write or losing raw input', async value => {
 const rig = await setup(), writes = vi.spyOn(rig.stack.plans, 'save'), bytes = [...rig.stack.vault.entries];
 await rig.wrapper.get('input[name="evidence-date"]').setValue(value); await rig.wrapper.get('[data-rp-form="planning"]').trigger('submit'); await settle();
 expect(rig.wrapper.get('[data-rp-form="planning"] [role="alert"]').text()).toBe(tr('planning.invalid'));
 expect(rig.wrapper.get<HTMLInputElement>('input[name="evidence-date"]').element.value).toBe(value); expect(writes).not.toHaveBeenCalled(); expect([...rig.stack.vault.entries]).toEqual(bytes);
});
it('keeps an unknown date absent and orders recorded dates identically in the gallery and pins, retaining stable ties', async () => {
 const rig = await renovationEditor(true); mounted.push(rig);
 const base = { roomId: rig.room.id, targetId: rig.room.id, workId: '', recordId: '', path: 'scan.png', subpath: '', type: 'photo' as const, phase: 'before' as const };
 const records: Evidence[] = [
  { ...base, id: 'undated-a', description: 'Unknown date A', pin: null },
  { ...base, id: 'later', description: 'Later capture', date: '2026-08-28', pin: { x: .5, y: .5 } },
  { ...base, id: 'early', description: 'First capture', date: '2026-08-01', pin: { x: .1, y: .1 } },
  { ...base, id: 'early-tie', description: 'Same day capture', date: '2026-08-01', pin: { x: .2, y: .2 } },
  { ...base, id: 'undated-b', description: 'Unknown date B', pin: { x: .9, y: .9 } },
 ];
 const baseline = expectOk(await rig.renovation.read(rig.plan.id));
 expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(baseline, { renovation: { subjects: [], work: [], decisions: [], depth: { ...EMPTY_DEPTH, evidence: records } }, intended: undefined }, rig.runtime.structureTask.ledger)));
 rig.runtime.renovation.focus(rig.room.id, 'photos'); await settle(); const bytes = [...rig.stack.vault.entries];
 expect(rig.wrapper.findAll('[data-rp-evidence-photo]').map(row => row.attributes('data-rp-evidence-photo'))).toEqual(['early', 'early-tie', 'later', 'undated-a', 'undated-b']);
 const pins = expectDefined(rig.stage, 'stage').find<Konva.Group>('.evidence-pin'); expect(pins.map(pin => pin.findOne('Text')?.getAttr('text'))).toEqual(['1', '2', '3', '5']);
 expectDefined(pins[0], 'first date pin').fire('click'); await settle(); expect(rig.session.focusedId).toBe('early');
 rig.runtime.renovation.focus(rig.room.id, 'photos', 'undated-a'); await settle(); await editPhoto(rig, 'undated-a');
 expect(rig.wrapper.get<HTMLInputElement>('input[name="evidence-date"]').element.value).toBe('');
 await rig.wrapper.get('[data-rp-action="cancel"]').trigger('click'); await settle(); expect([...rig.stack.vault.entries]).toEqual(bytes);
});
it('refuses overwriting a peer date change from a captured native draft and retains the peer source', async () => {
 const { rig, record } = await savedPhoto(); await editPhoto(rig, record.id); await rig.wrapper.get('input[name="evidence-date"]').setValue('2026-08-29');
 const current = expectFound(await rig.stack.plans.getById(rig.plan.id)), renovation = expectDefined(current.entity.renovation, 'renovation'), depth = expectDefined(renovation.depth, 'depth');
 expectOk(await rig.stack.plans.save(expectOk(withPlanRenovation(current.entity, { ...renovation, depth: { ...depth, evidence: depth.evidence.map(item => item.id === record.id ? { ...item, date: '2026-08-30' } : item) } })), current.version));
 rig.changePlan(); await settle(); const bytes = [...rig.stack.vault.entries];
 await rig.wrapper.get('[data-rp-form="planning"]').trigger('submit'); await settle();
 expect(rig.wrapper.find('[data-rp-form="planning"]').exists()).toBe(true); expect(rig.wrapper.get<HTMLInputElement>('input[name="evidence-date"]').element.value).toBe('2026-08-29');
 expect(expectFound(await rig.stack.plans.getById(rig.plan.id)).entity.renovation?.depth?.evidence[0]?.date).toBe('2026-08-30'); expect([...rig.stack.vault.entries]).toEqual(bytes);
});

it('keeps retained gallery and pin numbering consistent when a peer date reorders a newer spatial snapshot while planning refresh fails', async () => {
 const rig = await renovationEditor(true); mounted.push(rig);
 const base = { roomId: rig.room.id, targetId: rig.room.id, workId: '', recordId: '', path: 'scan.png', subpath: '', type: 'photo' as const, phase: 'before' as const };
 const records: Evidence[] = [
  { ...base, id: 'dated-a', description: 'First capture', date: '2026-08-01', pin: { x: .2, y: .2 } },
  { ...base, id: 'dated-b', description: 'Second capture', date: '2026-08-02', pin: { x: .8, y: .8 } },
 ];
 const baseline = expectOk(await rig.renovation.read(rig.plan.id));
 expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(baseline, { renovation: { subjects: [], work: [], decisions: [], depth: { ...EMPTY_DEPTH, evidence: records } }, intended: undefined }, rig.runtime.structureTask.ledger)));
 rig.runtime.renovation.focus(rig.room.id, 'photos'); await settle();
 const planning = expectDefined(rig.deps.commands.planning, 'planning services');
 const failed = vi.spyOn(planning, 'read').mockResolvedValue(err({ category: 'Persistence', code: 'vault.read-failed', message: 'Temporarily unavailable' }));
 const current = expectFound(await rig.stack.plans.getById(rig.plan.id)), renovation = expectDefined(current.entity.renovation, 'renovation');
 expectOk(await rig.stack.plans.save(expectOk(withPlanRenovation(current.entity, { ...renovation, depth: { ...EMPTY_DEPTH, evidence: records.map(item => item.id === 'dated-a' ? { ...item, date: '2026-08-03' } : item) } })), current.version));
 rig.changePlan(); await settle();
 expect(rig.project.plan?.renovation?.depth?.evidence[0]?.date).toBe('2026-08-03'); expect(rig.runtime.planning.failed.value).toBe(true);
 expect(rig.wrapper.findAll('[data-rp-evidence-photo]').map(row => row.attributes('data-rp-evidence-photo'))).toEqual(['dated-a', 'dated-b']);
 const stage = expectDefined(rig.stage, 'stage'); numberedPin(stage, '1').fire('click'); await settle();
 expect(rig.session.focusedId).toBe('dated-a');
 const bytes = [...rig.stack.vault.entries]; failed.mockRestore(); await rig.runtime.refreshProjection(); await settle();
 expect(rig.wrapper.findAll('[data-rp-evidence-photo]').map(row => row.attributes('data-rp-evidence-photo'))).toEqual(['dated-b', 'dated-a']);
 numberedPin(stage, '1').fire('click'); await settle(); expect(rig.session.focusedId).toBe('dated-b'); expect([...rig.stack.vault.entries]).toEqual(bytes);
});

function numberedPin(stage: Konva.Stage, number: string): Konva.Group {
 return expectDefined(stage.find<Konva.Group>('.evidence-pin').find(pin => pin.findOne<Konva.Text>('Text')?.text() === number), 'displayed pin ' + number);
}
it('refuses a fresh Cost draft when successful planning and Project snapshots straddle a peer date-only change', async () => {
 const { rig, record } = await savedPhoto(); rig.runtime.renovation.focus(rig.room.id, 'costs'); await settle();
 const planning = expectDefined(rig.deps.commands.planning, 'planning services'), originalPlanning = planning.read.bind(planning), originalPlan = rig.deps.queries.getPlan.bind(rig.deps.queries);
 const planningEntered = defer<void>(), releasePlanning = defer<void>(), planEntered = defer<void>(), releasePlan = defer<void>();
 vi.spyOn(planning, 'read').mockImplementationOnce(async id => { const result = await originalPlanning(id); planningEntered.resolve(); await releasePlanning.promise; return result; });
 vi.spyOn(rig.deps.queries, 'getPlan').mockImplementationOnce(async (...args) => { planEntered.resolve(); await releasePlan.promise; return originalPlan(...args); });
 const refreshing = rig.runtime.refreshProjection();
 try {
  await Promise.all([planningEntered.promise, planEntered.promise]);
  const current = expectFound(await rig.stack.plans.getById(rig.plan.id)), renovation = expectDefined(current.entity.renovation, 'renovation'), depth = expectDefined(renovation.depth, 'depth');
  expectOk(await rig.stack.plans.save(expectOk(withPlanRenovation(current.entity, { ...renovation, depth: { ...depth, evidence: depth.evidence.map(item => item.id === record.id ? { ...item, date: '2026-08-30' } : item) } })), current.version));
  releasePlan.resolve(); await settleUntil(() => rig.project.plan?.renovation?.depth?.evidence[0]?.date === '2026-08-30', 'later Project date');
  releasePlanning.resolve(); await refreshing; await settle();
  expect(rig.runtime.planning.baseline.value?.plan.entity.renovation?.depth?.evidence[0]?.date).toBe('2026-08-28');
  const bytes = [...rig.stack.vault.entries], warning = vi.spyOn(notices, 'notifyOperationFailure').mockImplementation(() => undefined), run = vi.spyOn(rig.runtime.dispatcher, 'run');
  await rig.wrapper.get('[data-rp-new-cost]').trigger('click'); await settle();
  expect(rig.dialogs.current).toBeNull(); expect(warning).toHaveBeenCalledOnce(); expect(run).not.toHaveBeenCalled();
  expect(rig.runtime.planning.baseline.value?.plan.entity.renovation?.depth?.evidence[0]?.date).toBe('2026-08-30'); expect([...rig.stack.vault.entries]).toEqual(bytes);
 } finally { releasePlan.resolve(); releasePlanning.resolve(); await refreshing; }
});
