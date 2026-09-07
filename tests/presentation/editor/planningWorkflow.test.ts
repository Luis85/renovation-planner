// @vitest-environment jsdom
import { withPlanRenovation } from '../../../src/domain/plan/Plan';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { settle } from '../../helpers/editor';
import { expectDefined, expectOk } from '../../helpers/domain';
import { resizeTo } from '../../helpers/layout';
import { defer } from '../../helpers/async';
import { of } from '../../../src/core/money/Money';
import PlanningForm from '../../../src/presentation/editor/planning/PlanningForm.vue';
import { materialInput } from '../../../src/presentation/editor/planning/planningDraft';
import MaterialRow from '../../../src/presentation/editor/planning/MaterialRow.vue';
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
function evidenceSelected(rig: Awaited<ReturnType<typeof setup>>, id: string, selected: boolean): void {
 const row = rig.wrapper.get(`[data-rp-record="${id}"]`), title = row.get('button');
 expect(row.classes('is-selected')).toBe(selected);
 expect(title.attributes('aria-current')).toBe(selected ? 'true' : undefined);
 expect(title.text().includes('Selected')).toBe(selected);
}
describe('connected planning editor', () => {
 it('groups scoped cost obligations by Work and reveals a collapsed exact source before returning focus', async () => {
 const rig = await setup(), requirement = await material(rig), before = expectDefined(expectOk(await rig.stack.plans.getById(rig.plan.id)), 'Plan');
 const roomId = rig.room.id;
 const work = { id: 'cost-group-work', roomId, targetId: roomId, links: [{ roomId, targetId: 'wall-a' }], title: 'Prepare walls', description: '', order: 0, progress: 'pending' as const, responsibility: 'diy' as const, outcomes: [], dependencies: [] };
 const common = { roomId, targetId: roomId, workId: work.id, category: 'labor' as const, requirementId: '', facts: [], cancelled: false };
 const costs = [{ ...common, id: 'labor-first', title: 'Preparation', planned: of('25', 'EUR') }, { ...common, id: 'labor-second', title: 'Painting', planned: of('50', 'EUR') }];
 expectOk(await rig.stack.plans.save(expectOk(withPlanRenovation(before.entity, { subjects: [], work: [work], decisions: [], depth: { costs, procurement: [], evidence: [] } })), before.version)); rig.changePlan(); await settle();
 rig.runtime.renovation.focus(roomId, 'costs'); await settle();
 const groups = rig.wrapper.findAll<HTMLDetailsElement>('.rp-cost-group'); expect(groups).toHaveLength(2);
 const workGroup = expectDefined(groups.find(group => group.get('summary').text().includes(work.title)), 'Work group');
 expect(workGroup.get('summary').text()).toContain('75.00 EUR'); expect(workGroup.findAll('.rp-cost-row')).toHaveLength(2);
 const editor = useEditorStore(rig.pinia), selection = [...rig.selection.selectedIds], viewport = { ...editor.viewport }, totals = rig.wrapper.get('.rp-cost-totals').text();
 expect(rig.session.focusedId).toBe(''); expect(rig.stage?.find('.cost-work-source')).toHaveLength(0);
 workGroup.element.open = true; await workGroup.trigger('toggle'); expect(rig.session.focusedId).toBe('');
 workGroup.element.open = false; await workGroup.get('summary').trigger('click'); await settle();
 expect(rig.session.focusedId).toBe(work.id); expect(workGroup.get('summary').attributes('aria-current')).toBe('true');
 expect(rig.selection.selectedIds).toEqual(selection); expect(editor.viewport).toEqual(viewport); expect(rig.wrapper.get('.rp-cost-totals').text()).toBe(totals);
 const outlines = rig.stage?.find('.cost-work-source'); expect(outlines).toHaveLength(2);
 expect(outlines?.map(outline => outline.getAttr('closed'))).toEqual([true, false]);
 expect(outlines?.[0].getAttr('points')).toEqual(rig.room.geometry.points.flatMap(point => [point.x, point.y]));
 workGroup.element.open = true; await workGroup.get('summary').trigger('click'); expect(rig.session.focusedId).toBe(work.id);
 workGroup.element.open = false;
 rig.runtime.renovation.focus(roomId, 'costs', 'labor-second'); await settle();
 expect(workGroup.element.open).toBe(true); expect(rig.wrapper.get('[data-rp-record="labor-second"]').element.contains(document.activeElement)).toBe(true);
 expect(rig.stage?.find('.cost-work-source')).toHaveLength(0);
 const unassigned = expectDefined(groups.find(group => group !== workGroup && group.get('summary').text().includes('Unassigned')), 'Unassigned group');
 unassigned.element.open = false; await unassigned.get('summary').trigger('click'); expect(rig.session.focusedId).toBe('labor-second');
 rig.runtime.renovation.focus(roomId, 'costs', requirement.id); await settle();
 expect(rig.wrapper.get(`[data-rp-record="estimate:${requirement.id}"]`).element.contains(document.activeElement)).toBe(true);
 });
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
 rig.runtime.renovation.focus(rig.room.id, 'costs', cost.id); await settle();
 await action(rig, 'Documents', `[data-rp-record="${cost.id}"]`);
 expect(rig.session.focusedId).toBe(cost.id); evidenceSelected(rig, evidence.id, true);
 await action(rig, 'Open in vault'); await action(rig, 'Unlink'); rig.dialogs.resolve('confirm'); await settle(); expect(rig.stack.vault.entries.has('scan.pdf')).toBe(true);
 await rig.runtime.dispatcher.undo(); rig.changePlan(); await settle(); expect(rig.project.plan?.renovation?.depth?.evidence[0].id).toBe(evidence.id);
 rig.stack.vault.entries.delete('scan.pdf'); rig.changeFile('scan.pdf'); await settle(); expect(rig.wrapper.text()).toContain('missing'); await rig.runtime.renovation.perspective('review'); await settle(); expect(rig.wrapper.text()).toContain('Invoice');
 const finding = rig.wrapper.findAll('button').find(button => button.text().includes('Invoice')); await expectDefined(finding, 'missing-file route').trigger('click'); await settle(); expect(rig.session.focusedId).toBe(evidence.id);
 });
 it('keeps idle evidence unselected and announces direct and material-linked selection consistently', async () => {
 const rig = await setup(), requirement = await material(rig), before = expectDefined(expectOk(await rig.stack.plans.getById(rig.plan.id)), 'Plan');
 const common = { roomId: rig.room.id, targetId: rig.room.id, workId: '', path: 'scan.pdf', subpath: '', type: 'document' as const, phase: 'before' as const, pin: null };
 const evidence = [{ ...common, id: 'product-sheet', recordId: requirement.id, description: 'Product sheet' }, { ...common, id: 'site-document', recordId: '', description: 'Site document' }];
 expectOk(await rig.stack.plans.save(expectOk(withPlanRenovation(before.entity, { subjects: [], work: [], decisions: [], depth: { costs: [], procurement: [], evidence } })), before.version)); rig.changePlan(); await settle();
 rig.runtime.renovation.focus(rig.room.id, 'documents'); await settle();
 evidenceSelected(rig, 'product-sheet', false); evidenceSelected(rig, 'site-document', false);
 rig.runtime.renovation.focus(rig.room.id, 'materials', requirement.id); await settle();
 await action(rig, 'Documents', `[data-rp-record="${requirement.id}"]`);
 expect(rig.session.focusedId).toBe(requirement.id);
 evidenceSelected(rig, 'product-sheet', true); evidenceSelected(rig, 'site-document', false);
 await rig.wrapper.get('[data-rp-record="site-document"] > button').trigger('click'); await settle();
 evidenceSelected(rig, 'product-sheet', false); evidenceSelected(rig, 'site-document', true);
 await rig.wrapper.get('[data-rp-record="product-sheet"] > button').trigger('click'); await settle();
 evidenceSelected(rig, 'product-sheet', true); evidenceSelected(rig, 'site-document', false);
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
 rig.runtime.renovation.focus(rig.room.id, 'photos'); await settle(); await rig.wrapper.get('[data-rp-new-evidence]').trigger('click'); await settle(); await rig.wrapper.get('input[name="title"]').setValue('Floor before'); await rig.wrapper.get('input[name="path"]').setValue('scan.png'); await apply(rig);
 await rig.wrapper.get('.rp-evidence-gallery img').trigger('error'); expect(rig.wrapper.text()).toContain('Thumbnail unavailable'); expect(rig.stack.vault.entries.has(path)).toBe(true);
 const photo = rig.wrapper.get('[data-rp-evidence-photo]'), photoId = photo.attributes('data-rp-evidence-photo');
 rig.session.focusedId = ''; await settle(); expect(photo.attributes('aria-current')).toBeUndefined(); expect(rig.wrapper.get(`[data-rp-record="${photoId}"]`).isVisible()).toBe(false);
 await photo.trigger('click'); await settle(); expect(photo.attributes('aria-current')).toBe('true'); expect(rig.session.focusedId).toBe(photoId); expect(rig.wrapper.get(`[data-rp-record="${photoId}"]`).isVisible()).toBe(true);
 });
 it('surfaces read/write failures, retries, and refuses a late peer edit while retaining the draft', async () => {
 const rig = await setup(), services = expectDefined(rig.deps.commands.planning, 'planning');
 vi.spyOn(services, 'read').mockResolvedValueOnce(err({ category: 'Persistence', code: 'test.read', message: 'offline' })); rig.changePlan(); await settle(); expect(rig.wrapper.text()).toContain('could not'); await rig.wrapper.get('[data-rp-warning="stale"] [data-rp-action="retry"] ').trigger('click'); await settle();
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
 const receipt = rig.wrapper.get('.rp-renovation-list > [data-rp-record] > button'); expect(receipt.text()).toContain('Receipt'); expect(receipt.attributes('aria-current')).toBe('true'); await receipt.trigger('click'); await settle();
 await action(rig, 'Edit'); await rig.wrapper.get('input[name="title"]').setValue('Paid receipt'); await apply(rig); expect(rig.wrapper.text()).toContain('Paid receipt');
 const linked = rig.wrapper.findAll('.rp-renovation-inspector button').find(button => button.text().startsWith('Related record')); await expectDefined(linked, 'source link').trigger('click'); await settle(); expect(rig.session.mode).toBe('materials'); expect(rig.session.focusedId).toBe(requirement.id); expect(rig.selection.selectedIds).toEqual(selection);
 await action(rig, 'Costs', '.rp-planning-actions'); await rig.wrapper.get('[data-rp-new-cost]').trigger('click'); await settle(); await rig.wrapper.get('input[name="title"]').setValue('Labor'); await rig.wrapper.get('select[name="category"]').setValue('labor'); await rig.wrapper.get('input[name="planned"]').setValue('100'); await apply(rig);
 rig.session.focusedId = ''; await settle(); expect(rig.wrapper.find('.rp-renovation-list > [aria-current="true"]').exists()).toBe(false);
 await action(rig, 'Documents', '.rp-planning-actions'); const phase = rig.wrapper.get('[data-rp-evidence-phase="after"]'); await phase.trigger('click'); expect(phase.attributes('aria-pressed')).toBe('true'); expect(rig.wrapper.text()).not.toContain('Paid receipt'); expect(rig.selection.selectedIds).toEqual(selection); await rig.wrapper.get('[data-rp-evidence-phase=""]').trigger('click'); expect(phase.attributes('aria-pressed')).toBe('false');
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
 const evidence = [work.id, decision.id, cost.id, subject.id].map((recordId, index) => ({ id: `file-${index}`, roomId, targetId: roomId, workId: work.id, recordId, description: `Evidence ${index}`, path: 'scan.pdf', subpath: '', type: 'document' as const, phase: 'during' as const, pin: null }));
 expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(baseline, { renovation: { subjects: [subject], work: [work], decisions: [decision], depth: { procurement: [], costs: [cost], evidence } }, intended: undefined }, rig.runtime.structureTask.ledger))); rig.changePlan(); await settle();
 for (const [index, mode] of ['work', 'planned', 'costs'].entries()) { rig.runtime.renovation.focus(roomId, 'documents'); await settle(); await rig.wrapper.get(`[data-rp-record="file-${index}"] > p > button`).trigger('click'); await settle(); expect(rig.session.mode).toBe(mode); }
 expect(rig.wrapper.text()).toContain('Cancelled'); expect(rig.wrapper.text()).toContain('Finish');
 rig.runtime.renovation.focus(roomId, 'documents'); await settle(); await rig.wrapper.get('[data-rp-record="file-3"] > p > button').trigger('click'); await settle();
 expect(rig.session.mode).toBe('existing'); expect(rig.wrapper.get('[data-rp-record="source-subject"]').text()).toContain('Timber');
 rig.runtime.renovation.focus(roomId, 'work', work.id); await settle(); const remove = rig.wrapper.findAll('[data-rp-record="source-work"] button').find(button => button.text() === 'Delete record'); await expectDefined(remove, 'remove Work').trigger('click'); await settle(); expect(rig.wrapper.get('.rp-dialog').text()).toContain('Manual labor'); expect(rig.wrapper.get('.rp-dialog').text()).toContain('Evidence 0'); rig.dialogs.resolve('cancel');
 });

 it('reports failed deletion, ignores duplicate deletion while confirmation is open, and ignores late shopping completion', async () => {
 const rig = await setup(), requirement = await material(rig), row = rig.wrapper.getComponent(MaterialRow);
 await action(rig, 'Delete record'); row.vm.$emit('remove', requirement.id); await settle();
 vi.spyOn(rig.stack.requirements, 'delete').mockResolvedValueOnce(err({ category: 'Persistence', code: 'test.delete', message: 'offline' })); rig.dialogs.resolve('confirm'); await settle(); expect(rig.wrapper.text()).toContain('Could not save');
 const pending = defer<Awaited<ReturnType<NonNullable<typeof rig.deps.commands.shoppingNote>>>>(); const generate = vi.spyOn(rig.deps.commands, 'shoppingNote').mockReturnValueOnce(pending.promise);
 await action(rig, 'Create or open shopping list'); await action(rig, 'Create or open shopping list'); expect(generate).toHaveBeenCalledOnce(); rig.unmount(); pending.resolve(err({ category: 'Persistence', code: 'test.write', message: 'offline' })); await settle();
 });
 it('keeps planned-outcome context, exposes its materials route, and guards proposal removal with linked evidence', async () => {
 const rig = await setup(), baseline = expectOk(await rig.renovation.read(rig.plan.id));
 const subject = { id: 'finish-proposal', roomId: rig.room.id, targetId: rig.room.id, kind: 'floor' as const, existing: null, planned: { change: 'add' as const, description: 'New finish' } };
 const evidence = { id: 'proposal-note', roomId: rig.room.id, targetId: rig.room.id, workId: '', recordId: subject.id, path: 'scan.pdf', subpath: '', description: 'Finish specification', type: 'document' as const, phase: 'before' as const, pin: null };
 expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(baseline, { renovation: { subjects: [subject], work: [], decisions: [], depth: { costs: [], procurement: [], evidence: [evidence] } }, intended: undefined }, rig.runtime.structureTask.ledger))); rig.changePlan(); await settle(); rig.runtime.renovation.focus(rig.room.id, 'planned', subject.id); await settle();
 await action(rig, 'Edit', '.rp-renovation-row-actions'); expect(rig.wrapper.get('[name="description"]').element).toHaveProperty('value', 'New finish'); rig.dialogs.resolve('cancel'); await settle();
 await action(rig, 'Materials', `[data-rp-record="${subject.id}"]`); const requirement = await material(rig); expect(requirement.source?.outcomeId).toBe(subject.id);
 rig.runtime.renovation.focus(rig.room.id, 'planned', subject.id); await settle(); await action(rig, 'Discard proposal', '.rp-renovation-row-actions'); expect(rig.wrapper.get('.rp-dialog').text()).toContain('Finish specification'); expect(rig.wrapper.get('.rp-dialog').text()).toContain('Oak floor'); rig.dialogs.resolve('cancel');
 });
 it('shows missing material prices and cancelled cost facts, and edits a persisted obligation', async () => {
 const rig = await setup(), requirement = await material(rig), services = expectDefined(rig.deps.commands.planning, 'planning'), baseline = expectOk(await services.read(rig.plan.id));
 vi.spyOn(services, 'read').mockResolvedValueOnce(ok({ ...baseline, catalogue: [] })); rig.changePlan(); await settle(); expect(rig.wrapper.text()).toContain('refused');
 rig.changePlan(); await settle(); rig.runtime.renovation.focus(rig.room.id, 'costs', requirement.id); await settle(); await action(rig, 'Edit'); await rig.wrapper.get('input[name="title"]').setValue('Supply'); await rig.wrapper.get('[data-rp-add-fact]').trigger('click'); await rig.wrapper.get('input[name="amount"]').setValue('50'); await rig.wrapper.get('input[name="fact-description"]').setValue('Withdrawn quote'); await rig.wrapper.get('fieldset input[type="checkbox"]').setValue(true); await apply(rig); expect(rig.wrapper.text()).toContain('Cancelled');
 await action(rig, 'Edit'); expect(rig.wrapper.get('input[name="title"]').element).toHaveProperty('value', 'Supply'); rig.dialogs.resolve('cancel');
 });
 it('shows a failed Review refresh and refuses a Room deletion when material links cannot be read', async () => {
 const rig = await setup(), services = expectDefined(rig.deps.commands.planning, 'planning'); await rig.runtime.renovation.perspective('review'); await settle();
 vi.spyOn(services, 'read').mockResolvedValueOnce(err({ category: 'Persistence', code: 'test.read', message: 'offline' })); rig.changePlan(); await settle(); expect(rig.wrapper.text()).toContain('could not');
 rig.changePlan(); await settle(); await rig.runtime.renovation.perspective('plan'); await settle(); rig.selection.select([rig.room.id]); vi.spyOn(services, 'read').mockResolvedValueOnce(err({ category: 'Persistence', code: 'test.read', message: 'offline' })); await rig.runtime.deleteZone(rig.room.id, rig.room.name); expect(rig.dialogs.current).toBeNull(); expect(rig.project.zones.has(rig.room.id)).toBe(true);
 });

 it('refuses a captured form submission after leaf disposal', async () => {
 const rig = await setup(); await rig.wrapper.get('[data-rp-new-material]').trigger('click'); await settle();
 const form = rig.wrapper.getComponent(PlanningForm), dispatch = form.props('dispatch'), input = materialInput(form.props('draft'));
 rig.unmount(); expect((await dispatch(input)).ok).toBe(false); expect(expectOk(await rig.stack.requirements.listByZone(rig.room.id))).toHaveLength(0);
 });
 it.each(['room', 'wall'] as const)('ignores delayed %s referential previews after disposal', async kind => {
 const rig = await setup(), services = expectDefined(rig.deps.commands.planning, 'planning'), baseline = await services.read(rig.plan.id), pending = defer<typeof baseline>();
 vi.spyOn(services, 'read').mockReturnValueOnce(pending.promise);
 const deletion = kind === 'room' ? rig.runtime.deleteZone(rig.room.id, rig.room.name) : rig.runtime.structureActions.remove('wall-a'); await settle(); rig.unmount(); pending.resolve(baseline); await deletion; expect(rig.dialogs.current).toBeNull();
 });

 it('withholds the Review all-clear while planning is loading, failed or carries a finding, in the panel and in the note', async () => {
 const rig = await setup(), services = expectDefined(rig.deps.commands.planning, 'planning'), baseline = expectOk(await rig.renovation.read(rig.plan.id)), roomId = rig.room.id;
 await rig.runtime.renovation.perspective('review'); await settle(); const panel = () => rig.wrapper.get('.rp-renovation-inspector').text(); expect(panel()).toContain('No gaps');
 const loaded = await services.read(rig.plan.id), pending = defer<typeof loaded>(), read = vi.spyOn(services, 'read').mockReturnValueOnce(pending.promise);
 rig.changePlan(); await settle(); expect(panel()).not.toContain('No gaps'); pending.resolve(loaded); await settle(); expect(panel()).toContain('No gaps');
 read.mockResolvedValueOnce(err({ category: 'Persistence', code: 'test.read', message: 'offline' })); rig.changePlan(); await settle(); expect(panel()).toContain('could not'); expect(panel()).not.toContain('No gaps');
 const evidence = { id: 'lost', roomId, targetId: roomId, workId: '', recordId: 'removed-record', path: 'nowhere.pdf', subpath: '', description: 'Lost receipt', type: 'document' as const, phase: 'before' as const, pin: null };
 expectOk(await rig.stack.plans.save(expectOk(withPlanRenovation(baseline.plan.entity, { subjects: [], work: [], decisions: [], depth: { costs: [], procurement: [], evidence: [evidence] } })), baseline.plan.version)); rig.changePlan(); await settle();
 expect(panel()).toContain('Lost receipt'); expect(panel()).not.toContain('No gaps');
 const write = vi.spyOn(rig.deps.commands, 'reviewNote'); await rig.wrapper.get('[data-rp-action="review-note"]').trigger('click'); await settle();
 expect(write.mock.calls[0][1]).toContain('Lost receipt'); expect(write.mock.calls[0][1]).not.toContain('No gaps');
 });

 it('refreshes linked evidence by stored or resolved path without re-reading planning and coalesces entity events', async () => {
 const rig = await setup(), services = expectDefined(rig.deps.commands.planning, 'planning'), baseline = expectOk(await rig.renovation.read(rig.plan.id)), roomId = rig.room.id;
 const folder = expectDefined(rig.stack.index.getPath(rig.plan.id), 'plan note').replace(/[^/]*$/, ''); rig.stack.vault.entries.set(`${folder}receipt.pdf`, 'PDF fixture');
 const link = (id: string, path: string) => ({ id, roomId, targetId: roomId, workId: '', recordId: 'removed-record', path, subpath: '', description: id, type: 'document' as const, phase: 'before' as const, pin: null });
 expectOk(await rig.stack.plans.save(expectOk(withPlanRenovation(baseline.plan.entity, { subjects: [], work: [], decisions: [], depth: { costs: [], procurement: [], evidence: [link('scan', 'scan.pdf'), link('receipt', 'receipt.pdf')] } })), baseline.plan.version)); rig.changePlan(); await settle();
 const read = vi.spyOn(services, 'read');
 rig.changeFile('Notes/Unrelated.md'); rig.changeFile(`${folder}scan.pdf`); await settle(); expect(read).not.toHaveBeenCalled();
 const revision = rig.runtime.planning.evidenceRevision.value;
 rig.changeFile('scan.pdf'); await settle(); expect(read).not.toHaveBeenCalled();
 rig.changeFile(`${folder}receipt.pdf`); await settle(); expect(read).not.toHaveBeenCalled();
 expect(rig.runtime.planning.evidenceRevision.value).toBe(revision + 2);
 rig.changeRequirementFigures('any'); rig.changeCatalogue(); rig.changeProjectPrices(); await settle(); expect(read).toHaveBeenCalledTimes(1);
 });

 it('shows unavailable estimates and readable fallback links after externally removed records', async () => {
 const rig = await setup(), baseline = expectOk(await rig.renovation.read(rig.plan.id)), roomId = rig.room.id;
 const cost = { id: 'orphan-cost', roomId, targetId: roomId, workId: '', title: 'Orphan supply', category: 'material' as const, requirementId: 'removed-material', planned: null, facts: [], cancelled: false };
 const evidence = { id: 'orphan-evidence', roomId, targetId: roomId, workId: '', recordId: 'removed-record', path: 'scan.pdf', subpath: '', description: 'Old invoice', type: 'document' as const, phase: 'before' as const, pin: null };
 const edited = expectOk(withPlanRenovation(baseline.plan.entity, { subjects: [], work: [], decisions: [], depth: { costs: [cost], procurement: [], evidence: [evidence] } })); expectOk(await rig.stack.plans.save(edited, baseline.plan.version)); rig.changePlan(); await settle();
 rig.runtime.renovation.focus(roomId, 'costs'); await settle(); expect(rig.wrapper.get('[data-rp-record="orphan-cost"]').text()).toContain('Totals unavailable until stale or incompatible records are resolved.');
 await rig.runtime.renovation.perspective('review'); await settle(); expect(rig.wrapper.text()).toContain('Orphan supply');
 rig.runtime.renovation.focus(roomId, 'documents'); await settle(); expect(rig.wrapper.get('[data-rp-record="orphan-evidence"] > p > button').text()).toContain('removed-record');
 });

});
