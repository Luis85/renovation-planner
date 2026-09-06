// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { settle } from '../../helpers/editor';
import { expectDefined, expectOk } from '../../helpers/domain';
import { err, ok } from '../../../src/core/result/Result';
import type { Renovation } from '../../../src/domain/renovation/Renovation';

const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });
async function setup() {
 const rig = await renovationEditor(); mounted.push(rig);
 const roomId = rig.room.id;
 const value: Renovation = {
  subjects: [{ id: 'detail', roomId, targetId: 'wall-a', kind: 'wall', existing: { description: 'Cracked plaster', condition: 'damaged' }, planned: { change: 'modify', description: 'Repair plaster' } }],
  work: [
   { id: 'prepare', roomId, targetId: roomId, title: 'Prepare', description: '', order: 0, progress: 'pending', responsibility: 'diy', outcomes: ['detail'], dependencies: [] },
   { id: 'paint', roomId, targetId: roomId, title: 'Paint', description: '', order: 1, progress: 'in-progress', responsibility: 'unassigned', outcomes: [], dependencies: ['prepare'] },
  ],
  decisions: [{ id: 'colour', roomId, subjectId: 'detail', question: 'Choose colour', resolved: false, resolution: '' }],
 };
 const read = expectOk(await rig.renovation.read(rig.plan.id));
 expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(read, { renovation: value, intended: undefined }, rig.runtime.structureTask.ledger))); await settle();
 rig.runtime.renovation.focus(roomId, 'existing'); await settle(); return rig;
}
function panel(rig: Awaited<ReturnType<typeof setup>>) { return rig.wrapper.get('.rp-renovation-inspector'); }
async function button(rig: Awaited<ReturnType<typeof setup>>, text: string) {
 await expectDefined(panel(rig).findAll('button').find(item => item.text().includes(text)), text).trigger('click'); await settle();
}
async function cancel(rig: Awaited<ReturnType<typeof setup>>) { rig.dialogs.resolve('cancel'); await settle(); }

it('routes real inspector controls, canvas markers and source navigation to the same record', async () => {
 const rig = await setup();
 await panel(rig).get('[data-rp-record="detail"] > button').trigger('click'); await settle(); expect(rig.session.focusedId).toBe('detail');
 await panel(rig).get('[data-rp-action="edit-record"]').trigger('click'); await settle(); expect(rig.wrapper.get('textarea').element.value).toBe('Cracked plaster'); await cancel(rig);
 await panel(rig).get('[data-rp-action="plan-record"]').trigger('click'); await settle(); expect(rig.wrapper.get('textarea').element.value).toBe('Repair plaster'); await cancel(rig);
 await panel(rig).get('[data-rp-mode="planned"]').trigger('click'); await settle();
 await panel(rig).get('[data-rp-action="work-record"]').trigger('click'); await settle(); expect(rig.wrapper.get<HTMLInputElement>('input[name="title"]').element.value).toBe(''); await cancel(rig);
 await panel(rig).get('[data-rp-action="decision-record"]').trigger('click'); await settle(); expect(rig.wrapper.get<HTMLTextAreaElement>('textarea[name="question"]').element.value).toBe(''); await cancel(rig);
 await button(rig, 'See required work'); expect(rig.session.mode).toBe('work');
 await panel(rig).get('[data-rp-record="prepare"] > button').trigger('click'); await settle(); expect(rig.session.focusedId).toBe('prepare');
 await panel(rig).get('[data-rp-record="prepare"] [data-rp-action="work-record"]').trigger('click'); await settle(); expect(rig.wrapper.get<HTMLInputElement>('input[name="title"]').element.value).toBe('Prepare'); await cancel(rig);
 await button(rig, 'Creates planned outcomes:'); expect(rig.session.mode).toBe('planned');
 await button(rig, 'Existing source'); expect(rig.session.mode).toBe('existing');
 const open = vi.spyOn(rig.runtime, 'openPlanNote'); await button(rig, 'Open source note'); expect(open).toHaveBeenCalledOnce();
 const marker = expectDefined(rig.stage.findOne('.renovation-marker'), 'marker'); marker.fire('click'); await settle(); expect(rig.session.focusedId).toBe('detail');
 marker.fire('tap'); await settle(); expect(rig.selection.selectedIds).toEqual([rig.room.id]);
 rig.selection.select(['wall-a' as never]); await settle(); expect(rig.session.roomId).toBe(rig.room.id);
 rig.selection.select(['unrelated' as never]); await settle(); expect(panel(rig).text()).toContain('Select a room');
});

it('shows concrete linked-record impacts and refuses dangling deletes; explicit Decision deletion updates Review', async () => {
 const rig = await setup();
 await button(rig, 'Delete'); expect(rig.wrapper.get('.rp-dialog').text()).toContain('Prepare'); expect(rig.wrapper.get('.rp-dialog').text()).toContain('Choose colour');
 rig.dialogs.resolve('confirm'); await settle(); expect(rig.project.plan?.renovation?.subjects).toHaveLength(1);
 await panel(rig).get('[data-rp-mode="planned"]').trigger('click'); await settle();
 await button(rig, 'Discard'); await cancel(rig); expect(rig.project.plan?.renovation?.subjects[0].planned).not.toBeNull();
 await panel(rig).get('[data-rp-record="colour"] [data-rp-action="decision-record"]').trigger('click'); await settle(); expect(rig.wrapper.get<HTMLTextAreaElement>('textarea[name="question"]').element.value).toBe('Choose colour'); await cancel(rig);
 await panel(rig).get('[data-rp-record="colour"] button:last-child').trigger('click'); await settle(); rig.dialogs.resolve('confirm'); await settle(); expect(rig.project.plan?.renovation?.decisions).toEqual([]);
 await panel(rig).get('[data-rp-mode="work"]').trigger('click'); await settle();
 await panel(rig).get('[data-rp-record="prepare"] button:last-child').trigger('click'); await settle(); expect(rig.wrapper.get('.rp-dialog').text()).toContain('Paint'); await cancel(rig);
});

it('opens each Review finding and marker in its intended record context, and restores Renovate context', async () => {
 const rig = await setup();
 for (const text of ['incomplete dependencies', 'no planned outcome', 'decision']) {
  await rig.runtime.renovation.perspective('review'); await settle();
  const rows = panel(rig).findAll('li');
  const row = expectDefined(rows.find(item => item.text().toLowerCase().includes(text.toLowerCase())), text);
  await row.get('button').trigger('click'); await settle(); expect(rig.session.perspective).toBe('renovate');
  expect(rig.session.mode).toBe(text === 'decision' ? 'planned' : 'work');
  expect(rig.wrapper.findAll<HTMLTextAreaElement>('textarea[name="question"]').map(field => field.element.value)).toEqual(text === 'decision' ? ['Choose colour'] : []);
  if (text === 'decision') await cancel(rig);
 }
 await rig.runtime.renovation.perspective('review'); await settle();
 for (const marker of rig.stage.find('.renovation-marker')) {
  marker.fire('click'); await settle(); if (rig.dialogs.current) await cancel(rig);
  await rig.runtime.renovation.perspective('review'); await settle();
 }
 await button(rig, 'Back to'); expect(rig.session.perspective).toBe('renovate');
});

it('keeps review generation recoverable after returned and thrown failures, gates duplicates, and ignores a disposed completion', async () => {
 const rig = await setup(); await rig.runtime.renovation.perspective('review'); await settle();
 const fault = { category: 'Persistence' as const, code: 'review.human-edited', message: 'Edited' };
 const write = vi.spyOn(rig.deps.commands, 'reviewNote').mockResolvedValueOnce(err(fault)).mockRejectedValueOnce(new Error('disk'));
 const generate = () => panel(rig).get('[data-rp-action="review-note"]').trigger('click');
 await generate(); await settle(); expect(panel(rig).find('[role="alert"]').exists()).toBe(true);
 await generate(); await settle(); expect(panel(rig).find('[role="alert"]').exists()).toBe(true);
 await generate(); await settle(); expect(panel(rig).find('[role="alert"]').exists()).toBe(false);
 let resolve!: (value: ReturnType<typeof ok<void>>) => void;
 write.mockImplementationOnce(() => new Promise(_resolve => { resolve = _resolve; }));
 await generate(); await generate(); expect(write).toHaveBeenCalledTimes(4);
 rig.unmount(); resolve(ok(undefined)); await settle(); expect(rig.dialogs.current).toBeNull();
});

async function apply(rig: Awaited<ReturnType<typeof setup>>) {
 const form = rig.wrapper.get('[data-rp-form="renovation"]'); await form.trigger('submit'); await form.trigger('submit'); await settle();
}
it('persists keyboard-editable Work ordering, progress, responsibility and links while refusing a dependency cycle', async () => {
 const rig = await setup(); rig.runtime.renovation.focus(rig.room.id, 'work');
 let pending = rig.runtime.renovation.edit('work', rig.room.id, 'prepare'); await settle();
 await rig.wrapper.get('.rp-dialog input[value="paint"]').setValue(true);
 await rig.wrapper.get('.rp-dialog form').trigger('submit'); expect(rig.wrapper.get('[role="alert"]').text()).toContain('cycle');
 await cancel(rig); await pending;
 pending = rig.runtime.renovation.edit('work', rig.room.id, 'paint'); await settle();
 await rig.wrapper.get('.rp-dialog textarea').setValue('Use a roller');
 await rig.wrapper.get<HTMLInputElement>('input[name="order"]').setValue('0');
 await rig.wrapper.findAll('.rp-dialog select')[0].setValue('complete'); await rig.wrapper.findAll('.rp-dialog select')[1].setValue('diy');
 await rig.wrapper.get('.rp-dialog input[value="detail"]').setValue(true); await rig.wrapper.get('.rp-dialog input[value="prepare"]').setValue(false);
 await apply(rig); await pending;
 expect(rig.project.plan?.renovation?.work.find(item => item.id === 'paint')).toMatchObject({ order: 0, description: 'Use a roller', progress: 'complete', responsibility: 'diy', outcomes: ['detail'], dependencies: [] });
 expect(panel(rig).findAll('li')[0].text()).toContain('Paint');
});
it('creates a wall observation via the ordinary Room entry and form, then keeps its source through unchanged/remove proposals', async () => {
 const rig = await renovationEditor(); mounted.push(rig);
 await rig.wrapper.get('[data-rp-mode="existing"]').trigger('click'); await settle();
 await panel(rig).get('[data-rp-action="new-record"]').trigger('click'); await settle();
 const selects = rig.wrapper.findAll('.rp-dialog select'); await selects[0].setValue('wall'); await selects[1].setValue('wall-a'); await selects[2].setValue('investigate');
 expect(selects[1].text()).toContain('Straight wall 1'); expect(selects[1].text()).not.toContain('wall-a');
 await rig.wrapper.get<HTMLTextAreaElement>('textarea[name="description"]').setValue('Inspect crack'); await apply(rig);
 const subject = expectDefined(rig.project.plan?.renovation?.subjects[0], 'detail'); expect(subject).toMatchObject({ kind: 'wall', targetId: 'wall-a', existing: { condition: 'investigate' } });
 for (const change of ['unchanged', 'remove']) {
  const pending = rig.runtime.renovation.edit('planned', rig.room.id, subject.id); await settle();
  await rig.wrapper.get('select[name="classification"]').setValue(change); await apply(rig); await pending;
  expect(rig.project.plan?.renovation?.subjects[0].existing?.description).toBe('Inspect crack');
  expect(rig.project.plan?.renovation?.subjects[0].planned?.change).toBe(change);
 }
 expect(rig.project.structure.walls).toHaveLength(4); expect(rig.project.intended?.walls).toHaveLength(3);
});
it('validates opening measurements, persists a hosted proposed window and renders its comparison', async () => {
 const rig = await setup(); rig.runtime.renovation.focus(rig.room.id, 'planned');
 const pending = rig.runtime.renovation.edit('planned', rig.room.id); await settle();
 await rig.wrapper.get<HTMLTextAreaElement>('textarea[name="description"]').setValue('New window');
 await rig.wrapper.findAll('.rp-dialog select')[2].setValue('opening');
 const selects = rig.wrapper.findAll('.rp-dialog select'); await selects[3].setValue('wall-b'); await selects[4].setValue('window');
 await rig.wrapper.get<HTMLInputElement>('input[name="offset"]').setValue('bad'); await rig.wrapper.get('.rp-dialog form').trigger('submit'); expect(rig.wrapper.find('[role="alert"]').exists()).toBe(true);
 await rig.wrapper.get<HTMLInputElement>('input[name="offset"]').setValue('0.1'); await rig.wrapper.get<HTMLInputElement>('input[name="sill"]').setValue('0.5'); await rig.wrapper.get<HTMLInputElement>('input[name="height"]').setValue('1.2'); await apply(rig); await pending;
 expect(rig.project.intended?.openings[0]).toMatchObject({ kind: 'window', hostId: 'wall-b', offset: 100, sill: 500 }); expect(rig.project.structure.openings).toEqual([]);
 expect(rig.stage.find('.renovation').length).toBe(1);
 const decision = rig.runtime.renovation.edit('decision', rig.room.id, 'colour'); await settle();
 await rig.wrapper.get('.rp-dialog select').setValue(rig.project.plan?.renovation?.subjects[1].id);
 await rig.wrapper.get<HTMLInputElement>('input[name="resolved"]').setValue(true); await rig.wrapper.get('.rp-dialog form').trigger('submit'); expect(rig.wrapper.find('[role="alert"]').exists()).toBe(true);
 await rig.wrapper.get<HTMLTextAreaElement>('textarea[name="resolution"]').setValue('White'); await apply(rig); await decision;
 expect(rig.project.plan?.renovation?.decisions[0]).toMatchObject({ resolved: true, resolution: 'White', subjectId: rig.project.plan?.renovation?.subjects[1].id });
});
it('guards linked Room deletion using fresh persistence and abandons a late read after disposal', async () => {
 const rig = await setup(); await rig.runtime.renovation.perspective('plan');
 const deleting = rig.runtime.deleteZone(rig.room.id, rig.room.name); await settle(); expect(rig.wrapper.get('.rp-dialog').text()).toContain('Cracked plaster'); rig.dialogs.resolve('confirm'); await deleting; expect(rig.project.zones.has(rig.room.id)).toBe(true);
 const fault = { category: 'Persistence' as const, code: 'renovation.read-failed', message: 'Unavailable' };
 vi.spyOn(rig.renovation, 'read').mockResolvedValueOnce(err(fault)); await rig.runtime.deleteZone(rig.room.id, rig.room.name); expect(rig.dialogs.current).toBeNull();
 const baseline = expectOk(await rig.renovation.read(rig.plan.id)); let resolve!: (value: ReturnType<typeof ok<typeof baseline>>) => void;
 vi.spyOn(rig.renovation, 'read').mockImplementationOnce(() => new Promise(_resolve => { resolve = _resolve; }));
 const late = rig.runtime.deleteZone(rig.room.id, rig.room.name); rig.unmount(); resolve(ok(baseline)); await late; expect(rig.dialogs.current).toBeNull();
});

it('changes perspective and marker visibility through the context and layer controls without writing', async () => {
 const rig = await setup(), bytes = [...rig.stack.vault.entries];
 for (const perspective of ['review', 'renovate', 'plan']) {
  await rig.wrapper.get(`[data-rp-perspective="${perspective}"]`).trigger('click'); await settle(); expect(rig.session.perspective).toBe(perspective);
 }
 const visibility = rig.wrapper.findAll('label').find(label => label.text().includes('renovation markers'));
 await expectDefined(visibility, 'visibility').get('input').setValue(false); await settle(); expect(rig.session.visible).toBe(false); expect([...rig.stack.vault.entries]).toEqual(bytes);
});

it('captures an actual existing opening while excluding proposed-only openings from current-state choices', async () => {
 const rig = await setup(), read = expectOk(await rig.geometry.read(rig.plan.id));
 const current = expectDefined(read.document.structure, 'current structure');
 const door = { id: 'opening-current', kind: 'door' as const, hostId: 'wall-b', offset: 100, width: 900, height: 2000, sill: 0 };
 const window = { ...door, id: 'opening-intended', kind: 'window' as const, hostId: 'wall-c' };
 expectOk(await rig.geometry.write(rig.plan.id, { ...read.document, structure: { ...current, openings: [door] }, intended: { ...current, openings: [door, window] } }, read.version));
 await rig.runtime.refreshProjection(); rig.runtime.renovation.focus(rig.room.id, 'existing');
 const pending = rig.runtime.renovation.edit('existing', rig.room.id); await settle();
 const fields = rig.wrapper.findAll('.rp-dialog select'), targets = fields[1].findAll('option').map(option => option.attributes('value'));
 expect(targets).toContain(door.id); expect(targets).not.toContain(window.id);
 await fields[0].setValue('door'); await fields[1].setValue(door.id); await rig.wrapper.get<HTMLTextAreaElement>('textarea[name="description"]').setValue('Original timber door');
 await rig.wrapper.get('.rp-dialog form').trigger('keydown', { key: 'a' });
 await apply(rig); await pending;
 expect(rig.project.plan?.renovation?.subjects[1]).toMatchObject({ targetId: door.id, existing: { description: 'Original timber door' }, planned: null });
});

it('labels a removal outcome with its independently retained Existing source when navigating from Work', async () => {
 const rig = await setup(), pending = rig.runtime.renovation.edit('planned', rig.room.id, 'detail'); await settle();
 await rig.wrapper.get('select[name="classification"]').setValue('remove'); await apply(rig); await pending;
 rig.runtime.renovation.focus(rig.room.id, 'work'); await settle();
 await button(rig, 'Creates planned outcomes: Cracked plaster');
 expect(rig.session.mode).toBe('planned'); expect(rig.session.focusedId).toBe('detail');
 expect(rig.project.plan?.renovation?.subjects[0]).toMatchObject({ existing: { description: 'Cracked plaster' }, planned: { change: 'remove', description: '' } });
});

it('generates an explicitly scoped empty review and ignores a late rejected generation', async () => {
 const rig = await renovationEditor(); mounted.push(rig);
 await rig.runtime.renovation.perspective('review'); await settle();
 const write = vi.spyOn(rig.deps.commands, 'reviewNote');
 await panel(rig).get('[data-rp-action="review-note"]').trigger('click'); await settle();
 expect(write).toHaveBeenCalledOnce(); expect(write.mock.calls[0][1]).toContain('No gaps');
 let reject!: (cause: Error) => void;
 write.mockImplementationOnce(() => new Promise((_resolve, _reject) => { void _resolve; reject = _reject; }));
 await panel(rig).get('[data-rp-action="review-note"]').trigger('click'); rig.unmount(); reject(new Error('Late')); await settle();
 expect(rig.dialogs.current).toBeNull();
});

it('keeps missing-Room review causes readable while suppressing markers without a spatial anchor', async () => {
 const rig = await setup(); rig.project.zones = new Map();
 await rig.runtime.renovation.perspective('review'); await settle();
 expect(rig.stage.find('.renovation-marker')).toHaveLength(0);
 const write = vi.spyOn(rig.deps.commands, 'reviewNote');
 await panel(rig).get('[data-rp-action="review-note"]').trigger('click'); await settle();
 expect(write.mock.calls[0][1]).toContain(rig.room.id); expect(write.mock.calls[0][1]).toContain('Choose colour');
});

it('names removal outcomes in the Work and Decision forms from their Existing source', async () => {
 const rig = await setup(), pending = rig.runtime.renovation.edit('planned', rig.room.id, 'detail'); await settle();
 await rig.wrapper.get('select[name="classification"]').setValue('remove'); await apply(rig); await pending;
 for (const kind of ['work', 'decision'] as const) {
  const editing = rig.runtime.renovation.edit(kind, rig.room.id); await settle();
  expect(rig.wrapper.get('.rp-dialog').text()).toContain('Cracked plaster');
  await cancel(rig); await editing;
 }
});

it('offers current-state capture on a legacy Room plan without a structure or review-note service', async () => {
 const rig = await renovationEditor(); mounted.push(rig);
 const before = expectOk(await rig.geometry.read(rig.plan.id));
 expectOk(await rig.geometry.write(rig.plan.id, { ...before.document, structure: undefined }, before.version));
 await rig.runtime.refreshProjection(); rig.runtime.renovation.focus(rig.room.id, 'existing');
 const editing = rig.runtime.renovation.edit('existing', rig.room.id); await settle();
 expect(rig.wrapper.findAll('.rp-dialog select')[1].findAll('option')).toHaveLength(1);
 await rig.wrapper.get<HTMLTextAreaElement>('textarea[name="description"]').setValue('Existing concrete floor'); await apply(rig); await editing;
 expect(rig.project.plan?.renovation?.subjects[0].existing?.description).toBe('Existing concrete floor');
 Object.defineProperty(rig.deps.commands, 'reviewNote', { value: undefined });
 await rig.runtime.renovation.perspective('review'); await settle();
 expect(panel(rig).find('[data-rp-action="review-note"]').exists()).toBe(false);
 expect(panel(rig).text()).toContain('No gaps');
});
