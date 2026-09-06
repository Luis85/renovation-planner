// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { renovationEditor } from '../../helpers/renovationEditor';
import { expectOk } from '../../helpers/domain';
import { settle } from '../../helpers/editor';
import { EMPTY_DEPTH, type Evidence } from '../../../src/domain/renovation/PlanningDepth';
import { EDITOR_RUNTIME } from '../../../src/presentation/editor/runtime';
import SharedRecordContexts from '../../../src/presentation/editor/renovation/SharedRecordContexts.vue';
import { createPinia, setActivePinia } from 'pinia';
import { useRenovationContextLabel } from '../../../src/presentation/editor/renovation/renovationContextLabel';
import { tr } from '../../../src/presentation/i18n/strings';

it('labels externally missing context identities as unknown instead of inventing Room or element names', () => {
	setActivePinia(createPinia());
	const label = useRenovationContextLabel(), unknown = tr('editor.selection.unknown');
	expect(label({ roomId: 'missing-room', targetId: 'missing-room' })).toBe(unknown);
	expect(label({ roomId: 'missing-room', targetId: 'missing-wall' })).toBe(`${unknown} · ${unknown}`);
});

it('unlinks only the named secondary evidence context, preserving its file, owner, other links and undo history', async () => {
	const rig = await renovationEditor(true), roomId = rig.room.id;
	const item: Evidence = { id: 'evidence-walls', roomId, targetId: roomId, workId: '', recordId: '', path: 'Notes/walls.md', subpath: '#Condition', description: 'Wall survey', type: 'note', phase: 'before', pin: { x: 0.5, y: 0.6 }, links: [{ roomId, targetId: 'wall-a' }, { roomId, targetId: 'wall-b' }] };
	const other: Evidence = { ...item, id: 'evidence-other', links: [] };
	const work = { id: 'work-retained', roomId, targetId: roomId, title: 'Retained work', description: '', order: 0, progress: 'pending' as const, responsibility: 'unassigned' as const, outcomes: [], dependencies: [] };
	const input = { renovation: { subjects: [], work: [work], decisions: [], depth: { ...EMPTY_DEPTH, evidence: [item, other] } }, intended: undefined };
	expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(expectOk(await rig.renovation.read(rig.plan.id)), input, rig.runtime.structureTask.ledger)));
	const wrapper = mount(SharedRecordContexts, { props: { item }, global: { plugins: [rig.pinia], provide: { [EDITOR_RUNTIME as symbol]: rig.runtime } } });
	try {
		expect(wrapper.text()).toContain('Studio'); expect(wrapper.findAll('button')).toHaveLength(2);
		await wrapper.findAll('button')[0].trigger('click'); await settle();
		expect(rig.wrapper.get('.rp-dialog').text()).toContain('Studio · Wall 1'); rig.dialogs.resolve('confirm'); await settle();
		expect(rig.project.plan?.renovation?.depth?.evidence).toEqual([{ ...item, links: [{ roomId, targetId: 'wall-b' }] }, other]);
		expect(rig.project.plan?.renovation?.work).toEqual([work]);
		expectOk(await rig.runtime.dispatcher.undo()); await settle(); expect(rig.project.plan?.renovation?.depth?.evidence).toEqual([item, other]);
	} finally { wrapper.unmount(); rig.unmount(); }
});
