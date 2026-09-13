// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import type { DOMWrapper } from '@vue/test-utils';
import { renovationEditor } from '../../helpers/renovationEditor';
import { settle, settleUntil } from '../../helpers/editor';
import { expectDefined, expectOk } from '../../helpers/domain';
import { EMPTY_DEPTH } from '../../../src/domain/renovation/PlanningDepth';
import type { Renovation } from '../../../src/domain/renovation/Renovation';
import type { RenovationMode } from '../../../src/presentation/editor/renovation/renovationSession';
import { tr } from '../../../src/presentation/i18n/strings';

const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); vi.restoreAllMocks(); });
type Rig = Awaited<ReturnType<typeof renovationEditor>>;
type Found = Omit<DOMWrapper<Element>, 'exists'>;
/** One record of every row kind on `wall-a`, which bounds no room, so none of them carries a `roomId` (ADR-0030). */
const border: Renovation = {
	subjects: [{ id: 'detail-wall', targetId: 'wall-a', kind: 'wall', existing: { description: 'Brick', condition: 'good' }, planned: { change: 'modify', description: 'Rendered' } }],
	work: [{ id: 'work-border', targetId: 'wall-a', title: 'Repoint', description: '', order: 0, progress: 'pending', responsibility: 'diy', outcomes: ['detail-wall'], dependencies: [] }],
	decisions: [{ id: 'decision-wall', subjectId: 'detail-wall', question: 'Which render?', resolution: '', resolved: false }],
	depth: { ...EMPTY_DEPTH, evidence: [{ id: 'note-wall', targetId: 'wall-a', workId: '', recordId: 'detail-wall', path: 'Notes/missing.md', subpath: '', description: 'Crack survey', type: 'note', phase: 'before', pin: null }] },
};
async function setup() {
	const rig = await renovationEditor(true); mounted.push(rig); rig.changePlan(); await settle();
	expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(expectOk(await rig.renovation.read(rig.plan.id)), { renovation: border, intended: undefined }, rig.runtime.structureTask.ledger)));
	rig.changePlan(); await rig.runtime.refreshProjection();
	await settleUntil(() => !!rig.runtime.planning.baseline.value?.plan.entity.renovation?.depth?.evidence.length, 'planning read');
	rig.selection.select(['wall-a' as never]); await settle();
	return rig;
}
async function mode(rig: Rig, next: RenovationMode) { rig.runtime.renovation.focus('', next); await settle(); }
const row = (rig: Rig, id: string) => rig.wrapper.get(`[data-rp-record="${id}"]`);
const labelled = (scope: Found, key: Parameters<typeof tr>[0]) => expectDefined(scope.findAll('button').find(item => item.text().startsWith(tr(key))), key);
async function click(button: Found) { await button.trigger('click'); await settle(); }
/** Opens a row's form, answers the dialog it opened, and cancels it so the next row action is not refused for an open dialog. */
async function formFrom(rig: Rig, opener: Found) {
	await opener.trigger('click');
	await settleUntil(() => rig.dialogs.current !== null, 'record form');
	const dialog = rig.dialogs.current;
	rig.dialogs.resolve('cancel'); await settle();
	return dialog;
}
const noRoom = { roomId: '', targetId: 'wall-a' };

it('focuses, edits and plans a room-less subject from its existing row with no room in the session', async () => {
	const rig = await setup(); await mode(rig, 'existing');
	await click(row(rig, 'detail-wall').get('.rp-record-title'));
	expect(rig.session).toMatchObject({ ...noRoom, mode: 'existing', focusedId: 'detail-wall' });
	expect(await formFrom(rig, row(rig, 'detail-wall').get('[data-rp-action="edit-record"]'))).toMatchObject({ kind: 'form', props: { draft: { kind: 'existing', subject: { id: 'detail-wall', targetId: 'wall-a' } } } });
	expect(await formFrom(rig, row(rig, 'detail-wall').get('[data-rp-action="plan-record"]'))).toMatchObject({ props: { draft: { kind: 'planned', subject: { id: 'detail-wall' } } } });
	expect(await formFrom(rig, rig.wrapper.get('[data-rp-action="new-record"]'))).toMatchObject({ props: { draft: { kind: 'existing', subject: { id: 'detail-wall' } } } });
	await click(labelled(row(rig, 'detail-wall'), 'renovation.materials'));
	expect(rig.session).toMatchObject({ ...noRoom, mode: 'materials', focusedId: 'detail-wall' });
});

it('reaches Work, the source, a new Work item and a decision from a room-less planned row', async () => {
	const rig = await setup(); await mode(rig, 'planned');
	await click(labelled(row(rig, 'detail-wall'), 'renovation.required-work'));
	expect(rig.session).toMatchObject({ ...noRoom, mode: 'work', focusedId: 'detail-wall' });
	await mode(rig, 'planned'); await click(labelled(row(rig, 'detail-wall'), 'renovation.source'));
	expect(rig.session).toMatchObject({ ...noRoom, mode: 'existing', focusedId: 'detail-wall' });
	await mode(rig, 'planned');
	expect(await formFrom(rig, row(rig, 'detail-wall').get('[data-rp-action="work-record"]'))).toMatchObject({ props: { draft: { kind: 'work', work: { targetId: 'wall-a', outcomes: ['detail-wall'] } } } });
	expect(await formFrom(rig, row(rig, 'detail-wall').get('[data-rp-action="decision-record"]'))).toMatchObject({ props: { draft: { kind: 'decision', decision: { subjectId: 'detail-wall' } } } });
	expect(await formFrom(rig, row(rig, 'decision-wall').get('[data-rp-action="decision-record"]'))).toMatchObject({ props: { draft: { kind: 'decision', decision: { id: 'decision-wall', question: 'Which render?' } } } });
	expect(rig.project.plan?.renovation?.decisions[0]?.roomId).toBeUndefined();
});

it('focuses, edits and follows a room-less Work row to its outcome and its materials', async () => {
	const rig = await setup(); await mode(rig, 'work');
	await click(row(rig, 'work-border').get('.rp-record-title'));
	expect(rig.session).toMatchObject({ ...noRoom, mode: 'work', focusedId: 'work-border' });
	expect(await formFrom(rig, row(rig, 'work-border').get('[data-rp-action="work-record"]'))).toMatchObject({ props: { draft: { kind: 'work', work: { id: 'work-border', title: 'Repoint' } } } });
	await click(labelled(row(rig, 'work-border'), 'renovation.outcomes'));
	expect(rig.session).toMatchObject({ ...noRoom, mode: 'planned', focusedId: 'detail-wall' });
	await mode(rig, 'work'); await click(labelled(row(rig, 'work-border'), 'renovation.materials'));
	expect(rig.session).toMatchObject({ ...noRoom, mode: 'materials', focusedId: 'work-border' });
});

it('counts a room-less wall\'s linked evidence in its overview and follows the link with no room (spec §4.2)', async () => {
	const rig = await setup(); await mode(rig, 'overview');
	const notes = rig.wrapper.get('[data-rp-linked="notes"]');
	expect(notes.text()).toContain('1');
	await click(notes);
	expect(rig.session).toMatchObject({ ...noRoom, mode: 'notes' });
	expect(rig.selection.selectedIds).toEqual(['wall-a']);
});

it('lists a room-less note on its wall and focuses it from its title', async () => {
	const rig = await setup(); await mode(rig, 'notes');
	const title = row(rig, 'note-wall').get('.rp-record-title');
	expect(title.text()).toContain('Crack survey');
	await click(title);
	expect(rig.session).toMatchObject({ ...noRoom, mode: 'notes', focusedId: 'note-wall' });
	await click(labelled(row(rig, 'note-wall'), 'planning.linked-record'));
	expect(rig.session).toMatchObject({ ...noRoom, mode: 'planned', focusedId: 'detail-wall' });
});

it('names a room-less finding No room, writes it into the review note, and opens its decision', async () => {
	const rig = await setup();
	await rig.runtime.renovation.perspective('review'); await settle();
	await settleUntil(() => rig.wrapper.find('[data-rp-review-issue="note-wall"]').exists(), 'planning findings');
	expect(rig.wrapper.get('[data-rp-review-issue="note-wall"]').attributes('aria-label')).toMatch(/^No room · .*: Crack survey$/);
	const decision = rig.wrapper.get('[data-rp-review-issue="decision-wall"]');
	expect(decision.attributes('aria-label')).toMatch(/^No room · /);
	const write = vi.spyOn(rig.deps.commands, 'reviewNote');
	await rig.wrapper.get('[data-rp-action="review-note"]').trigger('click');
	await settleUntil(() => write.mock.calls.length === 1, 'review note written');
	expect(expectDefined(write.mock.calls[0], 'review note')[1]).toMatch(/^- No room: .*\(decision-wall\)$/m);
	await decision.trigger('click');
	await settleUntil(() => rig.dialogs.current !== null, 'decision form');
	expect(rig.session).toMatchObject({ ...noRoom, perspective: 'renovate', mode: 'planned', focusedId: 'decision-wall' });
	expect(rig.dialogs.current).toMatchObject({ props: { draft: { kind: 'decision', decision: { id: 'decision-wall' } } } });
	rig.dialogs.resolve('cancel'); await settle();
});
