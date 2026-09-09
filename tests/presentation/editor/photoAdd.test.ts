// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import { ref } from 'vue';
import PlanningForm from '../../../src/presentation/editor/planning/PlanningForm.vue';
import EvidenceFileSearch from '../../../src/presentation/editor/planning/EvidenceFileSearch.vue';
import { planningDraft } from '../../../src/presentation/editor/planning/planningDraft';
import { planningStack } from '../../helpers/planning';
import { tr } from '../../../src/presentation/i18n/strings';
import { expectDefined, expectOk } from '../../helpers/domain';
import { defer, settle } from '../../helpers/async';
import { err, ok } from '../../../src/core/result/Result';
import type { EvidenceFiles } from '../../../src/application/ports/EvidenceFiles';
import type { DispatchResult } from '../../../src/application/commands/DispatchOutcome';

const wrappers: VueWrapper[] = [];
afterEach(() => { for (const wrapper of wrappers.splice(0)) wrapper.unmount(); vi.useRealTimers(); });
const failure = { category: 'Persistence' as const, code: 'test.file-missing', message: 'Missing' };
async function setup() {
	const rig = await planningStack(), baseline = expectOk(await rig.read()), draft = planningDraft('evidence', baseline, rig.roomId, '', 'work-sand');
	draft.type = 'photo';
	const files: EvidenceFiles = { list: () => ['Photos/before.png', 'Notes/room.md'], resolve: link => link ? ok({ path: link, subpath: '', image: link.endsWith('.png') ? 'app://photo' : null }) : err(failure),
		open: () => Promise.resolve(ok(undefined)), createNote: () => Promise.resolve(ok('note.md')), importFile: () => Promise.resolve(ok('Photos/imported.png')) };
	const dispatch = vi.fn<(value: unknown) => Promise<DispatchResult>>().mockResolvedValue(ok('wrote'));
	const wrapper = mount(PlanningForm, { attachTo: document.body, props: { draft, baseline, busy: ref(false), paused: ref(false), files, dispatch } }); wrappers.push(wrapper);
	return { ...rig, draft, wrapper, files, dispatch };
}

it('adds a selected image with an optional caption while keeping contextual metadata under Details', async () => {
	const rig = await setup(), w = rig.wrapper;
	expect(w.get('.rp-photo-details').attributes('open')).toBeUndefined();
	expect(w.get('[name="path"]').element.closest('details')).toBeNull();
	expect(w.get('[name="title"]').element.closest('details')).toBeNull();
	expect(w.get('[name="target"]').element.closest('details')).toBe(w.get('.rp-photo-details').element);
	expect(w.get('[data-rp-planning-apply]').text()).toBe('Add photo');
	expect(w.findAll('datalist option').map(option => option.attributes('value'))).toEqual(['Photos/before.png']);
	await w.get('[name="path"]').setValue('Photos/before.png'); await w.trigger('submit');
	expect(rig.dispatch).toHaveBeenCalledOnce();
	expect(rig.dispatch).toHaveBeenCalledWith(expect.objectContaining({ renovation: expect.objectContaining({ depth: expect.objectContaining({ evidence: [expect.objectContaining({ description: 'before.png', type: 'photo', path: 'Photos/before.png', roomId: rig.roomId, workId: 'work-sand' })] }) }) }));
	expect(rig.draft.path).toBe('');
});

it('refuses a document as a photo and never imports a non-image through the image picker', async () => {
	const rig = await setup(), w = rig.wrapper, imported = vi.spyOn(rig.files, 'importFile');
	await w.get('[name="path"]').setValue('Notes/room.md'); await w.trigger('submit');
	expect(rig.dispatch).not.toHaveBeenCalled(); expect(w.text()).toContain('Choose a PNG');
	const input = w.get('input[type="file"]');
	Object.defineProperty(input.element, 'files', { value: [new File(['document'], 'document.pdf')] });
	await input.trigger('change'); await settle();
	expect(imported).not.toHaveBeenCalled();
});

it('waits for image import before Add and keeps the caption editable during the copy', async () => {
	const rig = await setup(), w = rig.wrapper, pending = defer<Awaited<ReturnType<EvidenceFiles['importFile']>>>();
	vi.spyOn(rig.files, 'importFile').mockReturnValue(pending.promise);
	const file = new File(['image'], 'imported.png');
	Object.defineProperty(file, 'arrayBuffer', { value: () => Promise.resolve(new Uint8Array([1, 2]).buffer) });
	Object.defineProperty(w.get('input[type="file"]').element, 'files', { value: [file] });
	await w.get('input[type="file"]').trigger('change'); await settle();
	await w.get('[name="title"]').setValue('Before the work');
	expect(w.get('[data-rp-planning-apply]').attributes('aria-disabled')).toBe('true');
	await w.trigger('submit'); expect(rig.dispatch).not.toHaveBeenCalled();
	pending.resolve(ok('Photos/imported.png')); await settle(); await w.trigger('submit');
	expect(rig.dispatch).toHaveBeenCalledOnce();
	expect(rig.dispatch).toHaveBeenCalledWith(expect.objectContaining({ renovation: expect.objectContaining({ depth: expect.objectContaining({ evidence: [expect.objectContaining({ description: 'Before the work', path: 'Photos/imported.png' })] }) }) }));
});

it('caps suggestion DOM even for a legacy provider and debounces search independently from other renders', async () => {
	vi.useFakeTimers();
	const list = vi.fn<() => string[]>(() => [...Array.from({ length: 2000 }, (_, n) => `Images/${n}.png`), 'Notes/room.md']);
	const w = mount(EvidenceFileSearch, { props: { modelValue: '', imagesOnly: true, paused: false, files: { list, resolve: () => err(failure), open: () => Promise.resolve(ok(undefined)), createNote: () => Promise.resolve(err(failure)), importFile: () => Promise.resolve(err(failure)) } } }); wrappers.push(w);
	expect(w.findAll('option')).toHaveLength(20);
	await w.setProps({ modelValue: 'Images/12' }); await w.setProps({ modelValue: 'Images/123' });
	expect(list).toHaveBeenCalledTimes(1);
	await vi.advanceTimersByTimeAsync(150);
	expect(list).toHaveBeenCalledTimes(2);
	expect(list).toHaveBeenLastCalledWith({ imagesOnly: true, query: 'images/123', limit: 20 });
	await w.setProps({ paused: true }); expect(list).toHaveBeenCalledTimes(2);
	expect(w.findAll('option').length).toBeLessThanOrEqual(20);
});


it('keeps native type-control focus when switching between photo Details and other evidence', async () => {
	const { wrapper: w } = await setup();
	const detail = w.get('.rp-photo-details').element as HTMLDetailsElement;
	detail.open = true;
	(w.get('[name="type"]').element as HTMLElement).focus();
	await w.get('[name="type"]').setValue('document'); await settle();
	expect(document.activeElement).toBe(w.get('[name="type"]').element);
	await w.get('[name="type"]').setValue('photo'); await settle();
	expect(w.get('.rp-photo-details').element).toHaveProperty('open', true);
	expect(document.activeElement).toBe(w.get('[name="type"]').element);
});

it('leaves a cancelled file picker inert in either evidence mode and creates an untitled vault note with its default heading', async () => {
	const rig = await setup(), w = rig.wrapper, imported = vi.spyOn(rig.files, 'importFile'), note = vi.spyOn(rig.files, 'createNote');
	let file = w.get('input[type="file"]'); Object.defineProperty(file.element, 'files', { value: [], configurable: true });
	await file.trigger('click'); await file.trigger('change'); await settle();
	expect(imported).not.toHaveBeenCalled(); expect(w.get('[name="path"]').element).toHaveProperty('value', '');
	await w.get('.rp-photo-details summary').trigger('click'); await w.get('[name="type"]').setValue('document'); await settle();
	file = w.get('input[type="file"]'); Object.defineProperty(file.element, 'files', { value: [], configurable: true });
	await file.trigger('click'); await file.trigger('change'); expect(imported).not.toHaveBeenCalled();
	const create = expectDefined(w.findAll('button').find(button => button.text() === tr('planning.create-note')), 'Create note');
	await create.trigger('click'); await settle();
	expect(note).toHaveBeenCalledWith(rig.plan.id, rig.draft.id, expect.stringContaining(`# ${tr('planning.note')}\n\n`));
	expect(w.get('[name="path"]').element).toHaveProperty('value', 'note.md'); expect(w.get('[name="type"]').element).toHaveProperty('value', 'note');
	expect(rig.dispatch).not.toHaveBeenCalled();
});

it('keeps manual file text and an empty suggestion list when no catalogue capability is available', async () => {
	vi.useFakeTimers();
	const w = mount(EvidenceFileSearch, { props: { modelValue: '', imagesOnly: true, paused: false } }); wrappers.push(w);
	expect(w.findAll('option')).toHaveLength(0);
	await w.setProps({ modelValue: 'Photos/known.png' }); await vi.advanceTimersByTimeAsync(150);
	expect(w.get('input').element).toHaveProperty('value', 'Photos/known.png'); expect(w.findAll('option')).toHaveLength(0);
});
