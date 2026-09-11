// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import { ref } from 'vue';
import { planningStack } from '../../helpers/planning';
import { expectDefined, expectOk } from '../../helpers/domain';
import { settle } from '../../helpers/editor';
import { defer } from '../../helpers/async';
import { err, ok } from '../../../src/core/result/Result';
import RenovationBatchForm from '../../../src/presentation/editor/renovation/RenovationBatchForm.vue';
import type { BatchKind } from '../../../src/presentation/editor/renovation/renovationBatch';
import type { RenovationInput } from '../../../src/application/commands/renovation/RenovationCommand';
import type { DispatchResult } from '../../../src/application/commands/DispatchOutcome';
import type { EvidenceFiles } from '../../../src/application/ports/EvidenceFiles';
import { withPlanRenovation } from '../../../src/domain/plan/Plan';

const mounted: VueWrapper[] = [];
afterEach(() => { for (const wrapper of mounted.splice(0)) wrapper.unmount(); });
async function setup(kind: BatchKind = 'work') {
	const rig = await planningStack(), baseline = expectOk(await rig.read()), busy = ref(false), paused = ref(false);
	const dispatch = vi.fn<(input: RenovationInput) => Promise<DispatchResult>>(() => Promise.resolve(ok('wrote')));
	const files = { list: () => ['Notes/walls.md'], resolve: vi.fn<EvidenceFiles['resolve']>(() => ok({ path: 'Notes/walls.md', subpath: '', image: null })), open: vi.fn<EvidenceFiles['open']>(() => Promise.resolve(ok(undefined))), createNote: vi.fn<EvidenceFiles['createNote']>(() => Promise.resolve(ok('Notes/new.md'))), importFile: vi.fn<EvidenceFiles['importFile']>(() => Promise.resolve(ok('Attachments/file.pdf'))) };
	const wrapper = mount(RenovationBatchForm, { attachTo: document.body, props: { kind, baseline, targets: ['wall-a', 'wall-b'].map(targetId => ({ roomId: rig.roomId, targetId, name: targetId, kind: 'wall' as const })), busy, paused, dispatch, files } });
	mounted.push(wrapper); return { ...rig, wrapper, dispatch, files, busy, paused };
}
it('requires a description, invalidates the preview after edits and cannot submit while paused', async () => {
	const rig = await setup(); await rig.wrapper.get('form').trigger('submit'); expect(rig.wrapper.get('[role="alert"]').text()).not.toBe('');
	await rig.wrapper.get('input').setValue('Shared repair'); await rig.wrapper.get('form').trigger('submit'); expect(rig.dispatch).not.toHaveBeenCalled();
	await rig.wrapper.get('input').setValue('Revised repair'); await rig.wrapper.get('form').trigger('submit'); expect(rig.dispatch).not.toHaveBeenCalled();
	rig.paused.value = true; await settle(); await rig.wrapper.get('form').trigger('submit'); expect(rig.dispatch).not.toHaveBeenCalled();
	rig.paused.value = false; await settle(); await rig.wrapper.get('form').trigger('submit'); expect(rig.dispatch).toHaveBeenCalledOnce();
});
it('validates a real vault file before creating shared evidence', async () => {
	const rig = await setup('evidence'); await rig.wrapper.get('input').setValue('Wall note');
	rig.files.resolve.mockReturnValueOnce(err({ category: 'Persistence', code: 'test.missing', message: 'Missing' }));
	await rig.wrapper.get('form').trigger('submit'); expect(rig.wrapper.get('[role="alert"]').text()).toContain('Choose an available file');
	await rig.wrapper.findAll('select')[1].setValue('Notes/walls.md'); await rig.wrapper.findAll('select')[2].setValue('photo'); await rig.wrapper.get('form').trigger('keydown', { key: 'x' }); await rig.wrapper.get('form').trigger('submit'); await rig.wrapper.get('form').trigger('submit');
	expect(rig.dispatch).toHaveBeenCalledOnce();
	expect(expectDefined(rig.dispatch.mock.calls[0][0].renovation, 'renovation').depth?.evidence[0].type).toBe('photo');
});
it('retains native focus, preview and normalized evidence subpath during a pending batch save', async () => {
	const rig = await setup('evidence'), w = rig.wrapper, pending = defer<DispatchResult>();
	await w.get('input').setValue('Wall note'); await w.findAll('select')[1].setValue('Notes/walls.md');
	rig.files.resolve.mockReturnValue(ok({ path: 'Notes/walls.md', subpath: '#Survey', image: null }));
	await w.trigger('submit'); rig.dispatch.mockReturnValueOnce(pending.promise);
	const submit = w.get<HTMLButtonElement>('button[type="submit"]'); submit.element.focus(); await submit.trigger('click'); await settle();
	expect(submit.element.disabled).toBe(false); expect(document.activeElement).toBe(submit.element);
	const path = w.findAll<HTMLSelectElement>('select')[1]; path.element.focus(); await path.setValue('');
	expect(path.element.value).toBe('Notes/walls.md'); expect(document.activeElement).toBe(path.element);
	expect(submit.text()).toBe('Apply'); expect(w.get<HTMLInputElement>('input').element.readOnly).toBe(true);
	await submit.trigger('click'); expect(rig.dispatch).toHaveBeenCalledOnce();
	expect(expectDefined(rig.dispatch.mock.calls[0][0].renovation, 'renovation').depth?.evidence[0].subpath).toBe('#Survey');
	pending.resolve(ok('wrote')); await settle(); expect(w.emitted('submit')).toHaveLength(1);
});
it('attaches an existing Work record once while retaining its identity and facts', async () => {
	const rig = await setup(); await rig.wrapper.get('select').setValue('work-sand');
	await rig.wrapper.get('form').trigger('submit'); await rig.wrapper.get('form').trigger('submit');
	expect(rig.dispatch).toHaveBeenCalledOnce();
	const input = rig.dispatch.mock.calls[0][0], inputRenovation = expectDefined(input.renovation, 'input renovation');
	expect(inputRenovation.work).toHaveLength(1); expect(inputRenovation.work[0]).toMatchObject({ id: 'work-sand', title: 'Sand floor' }); expect(inputRenovation.work[0].links).toHaveLength(2);
});
it.each(['refusal', 'throw'] as const)('retains a failed batch draft and freezes further submission after %s', async failure => {
	const rig = await setup(); await rig.wrapper.get('input').setValue('Keep this work');
	if (failure === 'throw') rig.dispatch.mockRejectedValueOnce(new Error('offline'));
	else rig.dispatch.mockResolvedValueOnce(err({ category: 'Persistence', code: 'undo.superseded', message: 'Peer edit' }));
	await rig.wrapper.get('form').trigger('submit'); await rig.wrapper.get('form').trigger('submit'); await settle();
	expect(rig.wrapper.get<HTMLInputElement>('input').element.value).toBe('Keep this work'); expect(rig.wrapper.get('[role="alert"]').text()).not.toBe('');
	await rig.wrapper.get('form').trigger('submit'); expect(rig.dispatch).toHaveBeenCalledOnce();
});
it.each(['resolve', 'reject'] as const)('does not emit a late %s completion into a closed editor', async outcome => {
	const rig = await setup(), pending = defer<DispatchResult>();
	rig.dispatch.mockReturnValueOnce(outcome === 'resolve' ? pending.promise : pending.promise.then(() => { throw new Error('late failure'); }));
	await rig.wrapper.get('input').setValue('Shared work'); await rig.wrapper.get('form').trigger('submit'); await rig.wrapper.get('form').trigger('submit');
	rig.wrapper.unmount(); pending.resolve(ok('wrote'));
	await settle(); expect(rig.wrapper.emitted('submit')).toBeUndefined();
});
it('attaches an existing evidence record without requiring its file to be chosen again', async () => {
	const rig = await setup('evidence');
	const baseline = expectOk(await rig.read());
	rig.wrapper.unmount();
	const wrapper = mount(RenovationBatchForm, { attachTo: document.body, props: { kind: 'evidence', baseline: { ...baseline, plan: { ...baseline.plan, entity: expectOk(withPlanRenovation(baseline.plan.entity, { ...rig.value, depth: rig.depth })) } }, targets: [{ roomId: rig.roomId, targetId: 'wall-a', name: 'Wall', kind: 'wall' }], busy: rig.busy, paused: rig.paused, dispatch: rig.dispatch } });
	mounted.push(wrapper);
	await wrapper.get('select').setValue(rig.evidence.id); await wrapper.get('form').trigger('submit'); await wrapper.get('form').trigger('submit');
	expect(expectDefined(rig.dispatch.mock.calls[0][0].renovation, 'renovation').depth?.evidence[0]).toMatchObject({ id: rig.evidence.id, path: rig.evidence.path, links: [{ roomId: rig.roomId, targetId: 'wall-a' }] });
});
it('explains affected hosted openings and linked records in the removal preview', async () => {
	const rig = await setup('remove'), baseline = expectOk(await rig.read());
	rig.wrapper.unmount();
	const target = { roomId: rig.roomId, targetId: rig.roomId, name: 'Kitchen', kind: 'other' as const };
	const opening = { id: 'opening-door', hostId: 'wall-a', kind: 'door' as const, offset: 100, width: 900, height: 2000, sill: 0 };
	const wrapper = mount(RenovationBatchForm, { attachTo: document.body, props: { kind: 'remove', baseline: { ...baseline, geometry: { ...baseline.geometry, document: { ...baseline.geometry.document, structure: { walls: baseline.geometry.document.structure?.walls ?? [], boundaries: [], openings: [opening] } } } }, targets: [target, { ...target, targetId: 'wall-a', name: 'Wall', kind: 'wall' }], busy: rig.busy, paused: rig.paused, dispatch: rig.dispatch } });
	mounted.push(wrapper);
	await wrapper.get('form').trigger('submit'); expect(wrapper.text()).toContain('Sand floor'); expect(wrapper.text()).toContain('1');
	await wrapper.get('form').trigger('submit'); expect(rig.dispatch).toHaveBeenCalledOnce();
});
