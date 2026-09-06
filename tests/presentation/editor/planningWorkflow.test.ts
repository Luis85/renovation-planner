// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { settle } from '../../helpers/editor';
import { expectDefined, expectOk } from '../../helpers/domain';
import { resizeTo } from '../../helpers/layout';
import { defer } from '../../helpers/async';
import { of } from '../../../src/core/money/Money';
import { err, ok } from '../../../src/core/result/Result';
const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });
async function setup() { const rig = await renovationEditor(true); mounted.push(rig); rig.changePlan(); await settle(); rig.runtime.renovation.focus(rig.room.id, 'materials'); await settle(); return rig; }
async function apply(rig: Awaited<ReturnType<typeof setup>>) { await rig.wrapper.get('[data-rp-form="planning"]').trigger('submit'); await settle(); }
async function material(rig: Awaited<ReturnType<typeof setup>>) {
 await rig.wrapper.get('[data-rp-new-material]').trigger('click'); await settle();
 const asset = expectOk(await rig.stack.assets.listAll()).loaded.find(item => item.entity.unit === 'm2');
 await rig.wrapper.get('select[name="asset"]').setValue(expectDefined(asset, 'area material').entity.id); await apply(rig);
 return expectOk(await rig.stack.requirements.listByZone(rig.room.id))[0].entity;
}
async function action(rig: Awaited<ReturnType<typeof setup>>, text: string, scope = '.rp-renovation-inspector') {
 const button = rig.wrapper.findAll(`${scope} button`).find(candidate => candidate.text() === text); await expectDefined(button, text).trigger('click'); await settle();
}
describe('connected planning editor', () => {
 it('adds material, updates allocations, records a partial payment, links evidence, and follows Review back', async () => {
 const rig = await setup(), requirement = await material(rig);
 expect(rig.wrapper.text()).toContain('13.2'); await action(rig, 'Purchase quantities');
 await rig.wrapper.get('input[name="purchased"]').setValue('2'); await rig.wrapper.get('input[name="reserved"]').setValue('1'); await apply(rig); expect(rig.wrapper.text()).toContain('10.2');
 rig.runtime.renovation.focus(rig.room.id, 'costs', requirement.id); await settle(); await action(rig, 'Edit');
 await rig.wrapper.get('input[name="title"]').setValue('Floor supply'); await rig.wrapper.get('[data-rp-add-fact]').trigger('click');
 await rig.wrapper.get('input[name="amount"]').setValue('500'); await rig.wrapper.get('input[name="fact-description"]').setValue('Order'); await rig.wrapper.get('[data-rp-add-fact]').trigger('click');
 await rig.wrapper.findAll('select[name="stage"]')[1].setValue('actual'); await rig.wrapper.findAll('input[name="amount"]')[1].setValue('200');
 const order = rig.wrapper.get('select[name="settles"] option:nth-child(2)').attributes('value'); await rig.wrapper.get('select[name="settles"]').setValue(order); await apply(rig);
 expect(rig.project.plan?.renovation?.depth?.costs[0].facts).toHaveLength(2); expect(rig.wrapper.text()).toContain('94');
 const cost = expectDefined(rig.project.plan?.renovation?.depth?.costs[0], 'cost'); rig.runtime.renovation.focus(rig.room.id, 'documents', cost.id); await settle(); await rig.wrapper.get('[data-rp-new-evidence]').trigger('click'); await settle();
 await rig.wrapper.get('input[name="title"]').setValue('Invoice'); await rig.wrapper.get('input[name="path"]').setValue('scan.pdf'); await rig.wrapper.get('select[name="phase"]').setValue('during'); await apply(rig);
 const evidence = expectDefined(rig.project.plan?.renovation?.depth?.evidence[0], 'evidence'); expect(evidence.recordId).toBe(cost.id); expect(evidence.path).toBe('scan.pdf');
 await action(rig, 'Open in vault'); await action(rig, 'Unlink'); rig.dialogs.resolve('confirm'); await settle(); expect(rig.stack.vault.entries.has('scan.pdf')).toBe(true);
 await rig.runtime.dispatcher.undo(); rig.changePlan(); await settle(); expect(rig.project.plan?.renovation?.depth?.evidence[0].id).toBe(evidence.id);
 rig.stack.vault.entries.delete('scan.pdf'); rig.changeFile('scan.pdf'); await settle(); expect(rig.wrapper.text()).toContain('missing'); await rig.runtime.renovation.perspective('review'); await settle(); expect(rig.wrapper.text()).toContain('Invoice');
 const finding = rig.wrapper.findAll('button').find(button => button.text().includes('Invoice')); await expectDefined(finding, 'missing-file route').trigger('click'); await settle(); expect(rig.session.focusedId).toBe(evidence.id);
 });
 it('keeps explicit drafts across reflow and cancels without writes', async () => {
 const rig = await setup(), bytes = [...rig.stack.vault.entries]; await rig.wrapper.get('[data-rp-new-material]').trigger('click'); await settle();
 const field = rig.wrapper.get<HTMLInputElement>('input[name="waste"]'); await field.setValue('17'); field.element.focus(); resizeTo(rig.rootEl, 460, 900); await settle(); expect(document.activeElement).toBe(field.element); expect(field.element.value).toBe('17');
 await apply(rig); expect(rig.wrapper.get('[role="alert"]').text()).toContain('Check'); expect([...rig.stack.vault.entries]).toEqual(bytes);
 rig.dialogs.resolve('cancel'); await settle(); expect([...rig.stack.vault.entries]).toEqual(bytes); expect(rig.wrapper.find('[data-rp-form="planning"]').exists()).toBe(false);
 });
 it('supports manual counts and contextual notes, pins, phases, image fallback, and shopping', async () => {
 const rig = await setup(); await material(rig); await action(rig, 'Create or open shopping list'); expect([...rig.stack.vault.entries.keys()].some(path => path.includes('Shopping-'))).toBe(true);
 await rig.wrapper.get('[data-rp-new-material]').trigger('click'); await settle(); const assets = expectOk(await rig.stack.assets.listAll()).loaded;
 await rig.wrapper.get('select[name="asset"]').setValue(expectDefined(assets.find(item => item.entity.unit === 'piece'), 'count').entity.id); await rig.wrapper.get('select[name="rule"]').setValue('manual'); await rig.wrapper.get('input[name="manual"]').setValue('3'); await apply(rig);
 expect(expectOk(await rig.stack.requirements.listByZone(rig.room.id))).toHaveLength(2);
 rig.runtime.renovation.focus(rig.room.id, 'notes'); await settle(); await rig.wrapper.get('[data-rp-new-evidence]').trigger('click'); await settle(); await rig.wrapper.get('input[name="title"]').setValue('Hidden pipe');
 await action(rig, 'Create contextual note', '.rp-dialog'); const path = (rig.wrapper.get('input[name="path"]').element as HTMLInputElement).value; expect(path).toContain('Evidence/Note-');
 await rig.wrapper.get('select[name="phase"]').setValue('hidden-services'); await rig.wrapper.get('.rp-dialog input[type="checkbox"]').setValue(true); await apply(rig);
 expect(rig.stage?.find('.evidence-pin')).toHaveLength(1); rig.stage?.findOne('.evidence-pin')?.fire('click'); rig.stage?.findOne('.evidence-pin')?.fire('tap'); await settle(); expect(rig.session.focusedId).toBe(rig.project.plan?.renovation?.depth?.evidence[0].id);
 rig.session.evidencePhase = 'after'; await settle(); expect(rig.stage?.find('.evidence-pin')).toHaveLength(0); rig.session.evidencePhase = ''; await settle();
 rig.runtime.renovation.focus(rig.room.id, 'photos'); await settle(); await rig.wrapper.get('[data-rp-new-evidence]').trigger('click'); await settle(); await rig.wrapper.get('input[name="title"]').setValue('Floor before'); await rig.wrapper.get('input[name="path"]').setValue('scan.png'); await apply(rig); expect(rig.wrapper.text()).toContain('Thumbnail unavailable'); expect(rig.stack.vault.entries.has(path)).toBe(true);
 });
 it('surfaces read/write failures, retries, and refuses a late peer edit while retaining the draft', async () => {
 const rig = await setup(), services = expectDefined(rig.deps.commands.planning, 'planning');
 vi.spyOn(services, 'read').mockResolvedValueOnce(err({ category: 'Persistence', code: 'test.read', message: 'offline' })); rig.changePlan(); await settle(); expect(rig.wrapper.text()).toContain('could not'); await action(rig, 'Retry');
 await rig.wrapper.get('[data-rp-new-material]').trigger('click'); await settle(); const asset = expectOk(await rig.stack.assets.listAll()).loaded[0].entity; await rig.wrapper.get('select[name="asset"]').setValue(asset.id);
 vi.spyOn(rig.stack.requirements, 'save').mockRejectedValueOnce(new Error('disk')); await apply(rig); expect(rig.wrapper.find('[data-rp-form="planning"]').exists()).toBe(true); await apply(rig); expect(rig.wrapper.find('[data-rp-form="planning"]').exists()).toBe(false);
 });
 it('follows material and cost source routes, edits quantities, and confirms removal with undo', async () => {
 const rig = await setup(), requirement = await material(rig);
 await action(rig, 'Oak floor'); expect(rig.session.focusedId).toBe(requirement.id); await action(rig, 'Edit'); await rig.wrapper.get('input[name="override"]').setValue('20'); await apply(rig); expect(rig.wrapper.text()).toContain('900');
 await action(rig, 'Costs', '.rp-planning-actions'); expect(rig.session.mode).toBe('costs'); await action(rig, 'Materials', '.rp-planning-actions'); expect(rig.session.focusedId).toBe(requirement.id);
 await action(rig, 'Documents', '.rp-planning-actions'); expect(rig.session.mode).toBe('documents'); rig.runtime.renovation.focus(rig.room.id, 'materials'); await settle();
 await action(rig, 'Delete record'); rig.dialogs.resolve('cancel'); await settle(); expect(expectOk(await rig.stack.requirements.listByZone(rig.room.id))).toHaveLength(1);
 await action(rig, 'Delete record'); rig.dialogs.resolve('confirm'); await settle(); expect(expectOk(await rig.stack.requirements.listByZone(rig.room.id))).toHaveLength(0); await rig.runtime.dispatcher.undo(); rig.changePlan(); await settle();
 await action(rig, 'Purchase quantities'); await rig.wrapper.get('input[name="reserved"]').setValue('2'); await apply(rig); await action(rig, 'Delete record'); expect(rig.wrapper.text()).toContain('Resolve'); expect(rig.dialogs.current).toBeNull();
 });
 it('edits evidence, follows linked material and cost records, and filters without replacing spatial selection', async () => {
 const rig = await setup(), requirement = await material(rig), selection = [...rig.selection.selectedIds]; await action(rig, 'Documents', '.rp-planning-actions'); await rig.wrapper.get('[data-rp-new-evidence]').trigger('click'); await settle();
 await rig.wrapper.get('input[name="title"]').setValue('Receipt'); await rig.wrapper.get('input[name="path"]').setValue('scan.pdf'); await apply(rig);
 await action(rig, '1. Receipt'); await action(rig, 'Edit'); await rig.wrapper.get('input[name="title"]').setValue('Paid receipt'); await apply(rig); expect(rig.wrapper.text()).toContain('Paid receipt');
 const linked = rig.wrapper.findAll('.rp-renovation-inspector button').find(button => button.text().startsWith('Related record')); await expectDefined(linked, 'source link').trigger('click'); await settle(); expect(rig.session.mode).toBe('materials'); expect(rig.session.focusedId).toBe(requirement.id); expect(rig.selection.selectedIds).toEqual(selection);
 await action(rig, 'Costs', '.rp-planning-actions'); await rig.wrapper.get('[data-rp-new-cost]').trigger('click'); await settle(); await rig.wrapper.get('input[name="title"]').setValue('Labor'); await rig.wrapper.get('select[name="category"]').setValue('labor'); await rig.wrapper.get('input[name="planned"]').setValue('100'); await apply(rig);
 await action(rig, 'Documents', '.rp-planning-actions'); const phase = rig.wrapper.get('.rp-renovation-inspector select'); await phase.setValue('after'); expect(rig.wrapper.text()).not.toContain('Paid receipt'); expect(rig.selection.selectedIds).toEqual(selection); await phase.setValue('');
 const files = expectDefined(rig.deps.commands.evidenceFiles, 'files'); vi.spyOn(files, 'open').mockResolvedValueOnce(err({ category: 'Persistence', code: 'test.open', message: 'offline' })); await action(rig, 'Open in vault'); expect(rig.wrapper.text()).toContain('file action failed');
 });
 it('shows failed shopping writes and stale quantity findings with a route back from Review', async () => {
 const rig = await setup(), requirement = await material(rig);
 vi.spyOn(rig.deps.commands, 'shoppingNote').mockResolvedValueOnce(err({ category: 'Persistence', code: 'test.write', message: 'offline' })); await action(rig, 'Create or open shopping list'); expect(rig.wrapper.text()).toContain('Could not save');
 const loaded = expectOk(await rig.stack.requirements.listByZone(rig.room.id))[0]; expectOk(await rig.stack.requirements.save(expectOk(loaded.entity.markedStale()), loaded.version)); rig.changePlan(); await settle(); await action(rig, 'Create or open shopping list'); expect(rig.wrapper.text()).toContain('Stale');
 await rig.runtime.renovation.perspective('review'); await settle(); const finding = rig.wrapper.findAll('button').find(button => button.text().includes('Oak floor')); await expectDefined(finding, 'stale route').trigger('click'); await settle(); expect(rig.session.focusedId).toBe(requirement.id); expect(rig.session.mode).toBe('materials');
 });

 it('refuses a fresh planning baseline paired with stale displayed geometry and ignores a late leaf read', async () => {
 const rig = await setup(), services = expectDefined(rig.deps.commands.planning, 'services'), baseline = expectOk(await services.read(rig.plan.id));
 const read = vi.spyOn(services, 'read'); read.mockResolvedValueOnce(ok({ ...baseline, geometry: { ...baseline.geometry, document: { ...baseline.geometry.document, objects: [] } } })); rig.changePlan(); await settle();
 await rig.wrapper.get('[data-rp-new-material]').trigger('click'); await settle(); expect(rig.wrapper.find('[data-rp-form="planning"]').exists()).toBe(false); expect(expectOk(await rig.stack.requirements.listByZone(rig.room.id))).toHaveLength(0);
 const pending = defer<Awaited<ReturnType<typeof services.read>>>(); read.mockReturnValueOnce(pending.promise); rig.changePlan(); await settle(); rig.unmount(); pending.resolve(ok(baseline)); await settle(); expect(rig.dialogs.current).toBeNull();
 });
 it('names material sources before wall deletion and reports a failed source read', async () => {
 const rig = await setup(); await rig.wrapper.get('[data-rp-new-material]').trigger('click'); await settle(); const asset = expectOk(await rig.stack.assets.listAll()).loaded.find(item => item.entity.unit === 'm2');
 await rig.wrapper.get('select[name="asset"]').setValue(expectDefined(asset, 'asset').entity.id); await rig.wrapper.get('select[name="target"]').setValue('wall-a'); await rig.wrapper.get('select[name="rule"]').setValue('wall-net'); await apply(rig);
 const before = expectOk(await rig.geometry.read(rig.plan.id)); const pending = rig.runtime.structureActions.remove('wall-a'); await settle(); expect(rig.wrapper.get('.rp-dialog').text()).toContain('Oak floor'); rig.dialogs.resolve('cancel'); await pending; expect(expectOk(await rig.geometry.read(rig.plan.id)).version).toEqual(before.version);
 const services = expectDefined(rig.deps.commands.planning, 'services'); vi.spyOn(services, 'read').mockResolvedValueOnce(err({ category: 'Persistence', code: 'test.read', message: 'offline' })); await rig.runtime.structureActions.remove('wall-a'); expect(rig.dialogs.current).toBeNull(); expect(expectOk(await rig.geometry.read(rig.plan.id)).version).toEqual(before.version);
 });

 it('carries Work context into materials and names its dependants before deleting Work', async () => {
 const rig = await setup(), read = expectOk(await rig.renovation.read(rig.plan.id));
 const work = { id: 'finish-work', roomId: rig.room.id, targetId: rig.room.id, title: 'Finish floor', description: '', order: 0, progress: 'pending' as const, responsibility: 'diy' as const, outcomes: [], dependencies: [] };
 expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(read, { renovation: { subjects: [], work: [work], decisions: [] }, intended: undefined }, rig.runtime.structureTask.ledger))); rig.changePlan(); await settle();
 rig.runtime.renovation.focus(rig.room.id, 'work', work.id); await settle(); const route = rig.wrapper.findAll('[data-rp-record="finish-work"] button').find(button => button.text() === 'Materials'); await expectDefined(route, 'Work materials').trigger('click'); await settle();
 const requirement = await material(rig); expect(requirement.source?.workId).toBe(work.id); await action(rig, 'What needs doing', '.rp-planning-actions'); expect(rig.session.focusedId).toBe(work.id);
 const remove = rig.wrapper.findAll('[data-rp-record="finish-work"] button').find(button => button.text() === 'Delete record'); await expectDefined(remove, 'delete Work').trigger('click'); await settle(); expect(rig.wrapper.get('.rp-dialog').text()).toContain('Oak floor'); rig.dialogs.resolve('confirm'); await settle(); expect(rig.project.plan?.renovation?.work).toHaveLength(1);
 });

 it('generates Review from stale records, reports failed reads and ignores a delayed read after disposal', async () => {
 const rig = await setup(); await material(rig); const loaded = expectOk(await rig.stack.requirements.listByZone(rig.room.id))[0]; expectOk(await rig.stack.requirements.save(expectOk(loaded.entity.markedStale()), loaded.version)); rig.changePlan(); await settle();
 await action(rig, 'Costs', '.rp-planning-actions'); expect(rig.wrapper.text()).toContain('Stale'); expect(rig.wrapper.text()).toContain('Totals'); await rig.runtime.renovation.perspective('review'); await settle();
 const generate = rig.wrapper.get('[data-rp-action="review-note"]'), write = vi.spyOn(rig.deps.commands, 'reviewNote'), services = expectDefined(rig.deps.commands.planning, 'services');
 await generate.trigger('click'); await settle(); expect(write).toHaveBeenCalledWith(rig.plan.id, expect.stringContaining('Oak floor'));
 vi.spyOn(services, 'read').mockResolvedValueOnce(err({ category: 'Persistence', code: 'test.read', message: 'offline' })); await generate.trigger('click'); await settle(); expect(write).toHaveBeenCalledOnce(); expect(rig.wrapper.text()).toContain('could not');
 const pending = defer<Awaited<ReturnType<typeof services.read>>>(), baseline = await services.read(rig.plan.id); vi.spyOn(services, 'read').mockReturnValueOnce(pending.promise); await generate.trigger('click'); rig.unmount(); pending.resolve(baseline); await settle(); expect(write).toHaveBeenCalledOnce();
 });

 it('routes evidence to Work, Decision and cost obligations and names linked costs/evidence before Work removal', async () => {
 const rig = await setup(), baseline = expectOk(await rig.renovation.read(rig.plan.id)), roomId = rig.room.id;
 const work = { id: 'source-work', roomId, targetId: roomId, title: 'Finish', description: '', order: 0, progress: 'pending' as const, responsibility: 'diy' as const, outcomes: [], dependencies: [] };
 const subject = { id: 'source-subject', roomId, targetId: roomId, kind: 'floor' as const, existing: { description: 'Timber', condition: 'good' as const }, planned: null };
 const decision = { id: 'source-decision', roomId, subjectId: subject.id, question: 'Finish choice', resolved: false, resolution: '' };
 const cost = { id: 'source-cost', roomId, targetId: roomId, workId: work.id, title: 'Manual labor', category: 'labor' as const, requirementId: '', planned: of('100', 'EUR'), facts: [], cancelled: true };
 const evidence = [work.id, decision.id, cost.id].map((recordId, index) => ({ id: `file-${index}`, roomId, targetId: roomId, workId: work.id, recordId, description: `Evidence ${index}`, path: 'scan.pdf', subpath: '', type: 'document' as const, phase: 'during' as const, pin: null }));
 expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(baseline, { renovation: { subjects: [subject], work: [work], decisions: [decision], depth: { procurement: [], costs: [cost], evidence } }, intended: undefined }, rig.runtime.structureTask.ledger))); rig.changePlan(); await settle();
 for (const [index, mode] of ['work', 'planned', 'costs'].entries()) { rig.runtime.renovation.focus(roomId, 'documents'); await settle(); await rig.wrapper.get(`[data-rp-record="file-${index}"] > p > button`).trigger('click'); await settle(); expect(rig.session.mode).toBe(mode); }
 expect(rig.wrapper.text()).toContain('Cancelled'); expect(rig.wrapper.text()).toContain('Finish');
 rig.runtime.renovation.focus(roomId, 'work', work.id); await settle(); const remove = rig.wrapper.findAll('[data-rp-record="source-work"] button').find(button => button.text() === 'Delete record'); await expectDefined(remove, 'remove Work').trigger('click'); await settle(); expect(rig.wrapper.get('.rp-dialog').text()).toContain('Manual labor'); expect(rig.wrapper.get('.rp-dialog').text()).toContain('Evidence 0'); rig.dialogs.resolve('cancel');
 });

});
