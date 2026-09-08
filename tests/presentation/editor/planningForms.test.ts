// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import { ref } from 'vue';
import EvidencePreview from '../../../src/presentation/editor/planning/EvidencePreview.vue';
import PlanningForm from '../../../src/presentation/editor/planning/PlanningForm.vue';
import { planningDraft } from '../../../src/presentation/editor/planning/planningDraft';
import { planningStack } from '../../helpers/planning';
import { expectOk } from '../../helpers/domain';
import { defer, settle } from '../../helpers/async';
import { err, ok } from '../../../src/core/result/Result';
import type { DispatchResult } from '../../../src/application/commands/DispatchOutcome';
import type { EvidenceFiles } from '../../../src/application/ports/EvidenceFiles';
const mounted: VueWrapper[] = [];
afterEach(() => { for (const wrapper of mounted.splice(0)) wrapper.unmount(); });
const failure = { category: 'Persistence' as const, code: 'test.offline', message: 'offline' };
async function setup(kind: 'material' | 'cost' | 'evidence' | 'procurement' = 'material') {
 const rig = await planningStack(), baseline = expectOk(await rig.read()), draft = planningDraft(kind, baseline, rig.roomId, '', 'work-sand');
 const files: EvidenceFiles = { list: () => ['photo.jpg'], resolve: link => link ? ok({ path: 'photo.jpg', subpath: '#Section', image: 'app://photo' }) : err(failure), open: () => Promise.resolve(ok(undefined)), createNote: () => Promise.resolve(ok('note.md')), importFile: () => Promise.resolve(ok('photo.jpg')) };
 const dispatch = vi.fn<(input: unknown) => Promise<DispatchResult>>().mockResolvedValue(ok('wrote')), busy = ref(false), paused = ref(false);
 const wrapper = mount(PlanningForm, { props: { draft, baseline, busy, paused, dispatch, files } }); mounted.push(wrapper);
 return { ...rig, wrapper, draft, baseline, files, dispatch, busy, paused };
}
async function set(wrapper: VueWrapper, name: string, value: string) { await wrapper.get(`[name="${name}"]`).setValue(value); }
describe('explicit planning form contracts', () => {
 it('previews wall coverage and packaging, preserves independent override, and emits contextual source fields only on Apply', async () => {
 const rig = await setup(), w = rig.wrapper;
 await w.get('button[type="button"]').trigger('click'); expect(w.text()).toContain('Check'); expect(rig.dispatch).not.toHaveBeenCalled();
 await w.get('input[name="waste"]').trigger('keydown', { key: 'Tab' }); await set(w, 'asset', rig.asset.id); await set(w, 'target', 'wall-a'); await set(w, 'work', 'work-sand'); await set(w, 'outcome', 'detail-floor'); await set(w, 'state', 'intended'); await set(w, 'rule', 'wall-net');
 await set(w, 'coverage', '2'); await set(w, 'lot', '2'); await set(w, 'minimum', '4'); await set(w, 'waste', '10'); await set(w, 'override', '8');
 await w.get('button[type="button"]').trigger('click'); expect(w.get('[role="status"]').text()).toContain('360.00 EUR'); expect(rig.dispatch).not.toHaveBeenCalled();
 await w.trigger('submit'); expect(rig.dispatch).toHaveBeenCalledWith(expect.objectContaining({ override: '8', waste: '0.1', source: expect.objectContaining({ state: 'intended', targetId: 'wall-a', coverage: '2', lot: '2', minimum: '4', outcomeId: 'detail-floor' }) })); expect(rig.draft.override).toBe('');
 });
 it('suppresses duplicate submissions, pauses fields, and ignores completion after disposal', async () => {
 const rig = await setup(), w = rig.wrapper, pending = defer<DispatchResult>(); await set(w, 'asset', rig.asset.id); rig.dispatch.mockReturnValue(pending.promise);
 rig.paused.value = true; await w.trigger('submit'); expect(rig.dispatch).not.toHaveBeenCalled(); rig.paused.value = false;
 await w.trigger('submit'); await w.trigger('submit'); expect(rig.dispatch).toHaveBeenCalledOnce(); expect(rig.busy.value).toBe(true);
 w.unmount(); pending.resolve(ok('wrote')); await settle(); expect(w.emitted('submit')).toBeUndefined();
 });
 it('keeps a failed draft retryable, including thrown reads and dispatch failures', async () => {
 const rig = await setup(), w = rig.wrapper; await set(w, 'asset', rig.asset.id); rig.dispatch.mockRejectedValueOnce(new Error('disk'));
 await w.trigger('submit'); await settle(); expect(w.get('[role="alert"]').text()).toContain('Could not'); expect(w.emitted('submit')).toBeUndefined();
 rig.dispatch.mockResolvedValueOnce(err(failure)); await w.trigger('submit'); await settle(); expect(w.text()).toContain('Your draft is retained'); await w.trigger('submit'); await settle(); expect(w.emitted('submit')).toHaveLength(1);
 });
 it('records manual labor budget and cancelled facts without treating cancellation as deletion', async () => {
 const rig = await setup('cost'), w = rig.wrapper; await set(w, 'title', 'Electrician'); await set(w, 'category', 'labor'); await set(w, 'planned', '1000'); await set(w, 'requirement', '');
 await w.get('[data-rp-add-fact]').trigger('click'); await set(w, 'amount', '300'); await set(w, 'fact-description', 'Replaced order'); await w.get('fieldset input[type="checkbox"]').setValue(true); await w.findAll('input[type="checkbox"]').at(-1)?.setValue(true);
 await w.trigger('submit'); expect(rig.dispatch).toHaveBeenCalledWith(expect.objectContaining({ renovation: expect.objectContaining({ depth: expect.objectContaining({ costs: [expect.objectContaining({ category: 'labor', cancelled: true, facts: [expect.objectContaining({ cancelled: true })] })] }) }) }));
 });
 it('links evidence using readable record choices and normalized subpaths, with finite pin coordinates', async () => {
 const rig = await setup('evidence'), w = rig.wrapper; await set(w, 'title', 'Before'); await set(w, 'type', 'photo'); await set(w, 'record', 'work-sand'); expect(w.get('select[name="record"]').text()).toContain('Sand');
 await w.trigger('submit'); expect(rig.dispatch).not.toHaveBeenCalled(); await set(w, 'path', 'photo.jpg#Section'); await w.get('input[type="checkbox"]').setValue(true);
 const coordinates = w.findAll('input[inputmode="decimal"]'); await coordinates[0].setValue('0.25'); await coordinates[1].setValue('0.75'); await w.trigger('submit');
 expect(rig.dispatch).toHaveBeenCalledWith(expect.objectContaining({ renovation: expect.objectContaining({ depth: expect.objectContaining({ evidence: [expect.objectContaining({ path: 'photo.jpg', subpath: '#Section', recordId: 'work-sand', pin: { x: 0.25, y: 0.75 } })] }) }) }));
 });
 it('imports bytes and handles failed note creation without losing the draft or writing a link', async () => {
 const rig = await setup('evidence'), w = rig.wrapper; const imported = vi.spyOn(rig.files, 'importFile');
 const file = new File(['image'], 'photo.jpg'); Object.defineProperty(file, 'arrayBuffer', { value: () => Promise.resolve(new Uint8Array([1, 2]).buffer) });
 const input = w.get('input[type="file"]'); await input.trigger('change'); Object.defineProperty(input.element, 'files', { value: [file] }); await input.trigger('change'); await settle(); expect(imported).toHaveBeenCalledWith(rig.plan.id, 'photo.jpg', new Uint8Array([1, 2]).buffer); expect(rig.dispatch).not.toHaveBeenCalled();
 await set(w, 'path', ''); vi.spyOn(rig.files, 'createNote').mockResolvedValueOnce(err(failure)).mockRejectedValueOnce(new Error('vault'));
 await w.get('button[type="button"]').trigger('click'); await settle(); expect(w.text()).toMatch(/Could not|file action failed/); await w.get('button[type="button"]').trigger('click'); await settle(); expect(w.text()).toMatch(/Could not|file action failed/);
 const pending = defer<Awaited<ReturnType<EvidenceFiles['createNote']>>>(); vi.spyOn(rig.files, 'createNote').mockReturnValue(pending.promise); await w.get('button[type="button"]').trigger('click'); w.unmount(); pending.resolve(ok('note.md')); await settle(); expect(rig.dispatch).not.toHaveBeenCalled();
 });
 it('lists current and intended openings, refuses invalid allocations and estimates, and handles an invalid preview number', async () => {
 const rig = await setup(), w = rig.wrapper;
 const structure = rig.baseline.geometry.document.structure;
 const opening = { id: 'door-current', hostId: 'wall-a', kind: 'door' as const, offset: 100, width: 900, height: 2000, sill: 0 };
 await w.setProps({ baseline: { ...rig.baseline, geometry: { ...rig.baseline.geometry, document: { ...rig.baseline.geometry.document, structure: { ...structure, walls: structure?.walls ?? [], boundaries: [], openings: [opening] }, intended: { walls: structure?.walls ?? [], openings: [{ ...opening, id: 'door-intended' }], boundaries: [] } } } } });
 expect(w.get('select[name="target"]').text()).toContain('door-intended'); await set(w, 'waste', 'invalid'); await w.get('button[type="button"]').trigger('click'); expect(w.text()).toContain('Check');
 await w.setProps({ baseline: { ...rig.baseline, geometry: { ...rig.baseline.geometry, document: { ...rig.baseline.geometry.document, structure: undefined } } } }); expect(w.get('select[name="target"]').findAll('option')).toHaveLength(1);
 const purchase = await setup('procurement'); await set(purchase.wrapper, 'purchased', '-1'); await set(purchase.wrapper, 'reserved', '2'); await purchase.wrapper.trigger('submit'); expect(purchase.dispatch).not.toHaveBeenCalled(); expect(purchase.wrapper.text()).toContain('Check');
 const cost = await setup('cost'); await set(cost.wrapper, 'title', 'Labor'); await set(cost.wrapper, 'planned', '20'); await set(cost.wrapper, 'work', ''); await cost.wrapper.trigger('submit'); expect(cost.dispatch).toHaveBeenCalledOnce();
 });
 it('refuses wrong record links and catches resolver errors while retaining the evidence draft', async () => {
 const rig = await setup('evidence'), w = rig.wrapper; await set(w, 'title', 'Picture'); await set(w, 'path', 'photo.jpg');
 vi.spyOn(rig.files, 'resolve').mockImplementationOnce(() => { throw new Error('cache'); }); await w.trigger('submit'); expect(rig.dispatch).not.toHaveBeenCalled(); expect(w.text()).toContain('Check');
 const invalid = { ...rig.draft, title: 'Missing source', path: 'photo.jpg', recordId: 'missing-record' };
 const other = mount(PlanningForm, { props: { draft: invalid, baseline: rig.baseline, busy: ref(false), paused: ref(false), dispatch: rig.dispatch, files: rig.files } }); mounted.push(other); await other.trigger('submit'); expect(rig.dispatch).not.toHaveBeenCalled();
 });

 it('renders host thumbnails and recovers to the labelled fallback on a resource failure', async () => {
 const rig = await setup('evidence'), item = { ...rig.evidence, type: 'photo' as const };
 const w = mount(EvidencePreview, { props: { item, files: rig.files, planId: rig.plan.id } }); mounted.push(w);
 expect(w.get('img').attributes('alt')).toBe(item.description); await w.get('img').trigger('error'); expect(w.find('img').exists()).toBe(false); expect(w.text()).toContain('Thumbnail unavailable');
 await w.setProps({ revision: 1 }); expect(w.get('img').attributes('loading')).toBe('lazy');
 expect(w.get('img').attributes('decoding')).toBe('async');
 await w.setProps({ metadataOnly: true }); expect(w.find('img').exists()).toBe(false); expect(w.text()).toContain(item.path); expect(w.text()).not.toContain('Thumbnail unavailable');
 await w.setProps({ metadataOnly: false });
 await w.get('img').trigger('error'); await w.setProps({ item: { ...item, path: 'Evidence/replacement.png' } });
 expect(w.find('img').exists()).toBe(true); expect(w.text()).toContain('Evidence/replacement.png');
 await w.setProps({ files: undefined }); expect(w.text()).toContain('missing');
 });

 it('accepts decimal commas without grouping and distinguishes a stale draft from a failed write', async () => {
 const rig = await setup(), w = rig.wrapper;
 await set(w, 'asset', rig.asset.id); await set(w, 'waste', '17,5'); await set(w, 'override', '8,5');
 await set(w, 'coverage', '2,5'); await set(w, 'lot', '2,5'); await set(w, 'minimum', '5,0');
 rig.dispatch.mockResolvedValueOnce(err({ category: 'Validation', code: 'undo.superseded', message: 'peer changed target' }));
 await w.trigger('submit'); await settle();
 expect(rig.dispatch).toHaveBeenCalledWith(expect.objectContaining({ waste: '0.175', override: '8.5', source: expect.objectContaining({ coverage: '2.5', lot: '2.5', minimum: '5.0' }) }));
 expect(w.text()).toContain('changed'); expect(w.get<HTMLInputElement>('[name="waste"]').element.value).toBe('17,5');
 const cost = await setup('cost'); await set(cost.wrapper, 'title', 'Labor'); await set(cost.wrapper, 'planned', '1000,50');
 await cost.wrapper.get('[data-rp-add-fact]').trigger('click'); await set(cost.wrapper, 'amount', '25,50');
 await cost.wrapper.trigger('submit'); await settle();
 expect(cost.dispatch).toHaveBeenCalledWith(expect.objectContaining({ renovation: expect.objectContaining({ depth: expect.objectContaining({ costs: [expect.objectContaining({ planned: expect.objectContaining({ amount: '1000.5', currency: 'EUR' }), facts: [expect.objectContaining({ amount: expect.objectContaining({ amount: '25.5', currency: 'EUR' }) })] })] }) }) }));
 });
 it('ignores a rejected submit after disposal', async () => {
 const rig = await setup(), pending = defer<void>(); await set(rig.wrapper, 'asset', rig.asset.id); rig.dispatch.mockReturnValueOnce(pending.promise.then(() => { throw new Error('late write'); }));
 await rig.wrapper.trigger('submit'); rig.wrapper.unmount(); pending.resolve(undefined); await settle(); expect(rig.wrapper.emitted('submit')).toBeUndefined();
 });
 it('rejects a queued file selection while note creation is busy and ignores its late failure', async () => {
 const rig = await setup('evidence'), pending = defer<void>(), imported = vi.spyOn(rig.files, 'importFile');
 vi.spyOn(rig.files, 'createNote').mockReturnValueOnce(pending.promise.then(() => { throw new Error('late file write'); })); await rig.wrapper.get('button[type="button"]').trigger('click');
 const input = rig.wrapper.get('input[type="file"]'); Object.defineProperty(input.element, 'files', { value: [new File(['image'], 'photo.jpg')] }); await input.trigger('change'); expect(imported).not.toHaveBeenCalled();
 rig.wrapper.unmount(); pending.resolve(undefined); await settle(); expect(rig.dispatch).not.toHaveBeenCalled();
 });

});
