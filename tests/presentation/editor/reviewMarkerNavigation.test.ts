// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import type Konva from 'konva';
import { renovationEditor } from '../../helpers/renovationEditor';
import { expectDefined, expectOk } from '../../helpers/domain';
import { settle, settleUntil } from '../../helpers/editor';
import type { Renovation } from '../../../src/domain/renovation/Renovation';
import { tr } from '../../../src/presentation/i18n/strings';

type Rig = Awaited<ReturnType<typeof renovationEditor>>;
const mounted: Rig[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });

async function setup() {
	const rig = await renovationEditor(true); mounted.push(rig);
	const roomId = rig.room.id;
	const renovation: Renovation = {
		subjects: [{ id: 'remove-floor', roomId, targetId: roomId, kind: 'floor', existing: { description: 'Damaged floor boards', condition: 'damaged' }, planned: { change: 'remove', description: '' } }],
		work: [
			{ id: 'prepare-floor', roomId, targetId: roomId, title: 'Clear room', description: '', order: 0, progress: 'pending', responsibility: 'diy', outcomes: ['remove-floor'], dependencies: [] },
			{ id: 'dispose-floor', roomId, targetId: roomId, title: 'Dispose boards', description: '', order: 1, progress: 'pending', responsibility: 'diy', outcomes: [], dependencies: ['prepare-floor'] },
		],
		decisions: [{ id: 'reuse-boards', roomId, subjectId: 'remove-floor', question: 'Can any boards be reused?', resolution: '', resolved: false }],
	};
	const read = expectOk(await rig.renovation.read(rig.plan.id));
	expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(read, { renovation, intended: undefined }, rig.runtime.structureTask.ledger)));
	await rig.runtime.refreshProjection();
	rig.runtime.renovation.focus(roomId, 'planned'); await settle();
	return rig;
}

async function openFinding(kind: 'blocked' | 'missing-outcome' | 'decision') {
	const rig = await setup(), bytes = [...rig.stack.vault.entries];
	await rig.runtime.renovation.perspective('review'); await settle();
	const markers = rig.stage.find<Konva.Group>('.renovation-marker');
	expect(markers).toHaveLength(3);
	const marker = expectDefined(markers.find(item => item.findOne<Konva.Text>('Text')?.text().includes(tr(`renovation.finding.${kind}`))), kind);
	marker.fire(kind === 'decision' ? 'tap' : 'click');
	await settleUntil(() => rig.session.perspective === 'renovate', 'Review marker navigation');
	expect(rig.session.roomId).toBe(rig.room.id);
	expect(rig.session.targetId).toBe(rig.room.id);
	expect(rig.selection.selectedIds).toEqual([rig.room.id]);
	expect(rig.session.mode).toBe(kind === 'decision' ? 'planned' : 'work');
	expect(rig.session.focusedId).toBe(kind === 'decision' ? 'reuse-boards' : 'dispose-floor');
	return { rig, bytes };
}

it.each(['blocked', 'missing-outcome'] as const)('opens a fresh %s Review marker in its canonical Work context without writing', async kind => {
	const { rig, bytes } = await openFinding(kind);
	expect(rig.dialogs.current).toBeNull();
	expect(rig.wrapper.get('[data-rp-record="dispose-floor"]').text()).toContain('Dispose boards');
	expect([...rig.stack.vault.entries]).toEqual(bytes);
});

it('opens the unresolved Decision on marker tap and cancels without writing', async () => {
	const { rig, bytes } = await openFinding('decision');
	await settleUntil(() => rig.wrapper.find('textarea[name="question"]').exists(), 'Decision dialog');
	expect(rig.wrapper.get<HTMLTextAreaElement>('textarea[name="question"]').element.value).toBe('Can any boards be reused?');
	rig.dialogs.resolve('cancel'); await settle();
	expect([...rig.stack.vault.entries]).toEqual(bytes);
});

it('labels a planned removal with the existing fact and selects the same subject on tap', async () => {
	const rig = await setup(), bytes = [...rig.stack.vault.entries];
	const markers = rig.stage.find<Konva.Group>('.renovation-marker');
	expect(markers).toHaveLength(1);
	expect(markers[0].findOne('Text')?.getAttr('text')).toContain('Damaged floor boards');
	expect(markers[0].findOne('Text')?.getAttr('text')).toContain(tr('renovation.change.remove'));
	markers[0].fire('tap'); await settle();
	expect(rig.session.focusedId).toBe('remove-floor');
	expect(rig.session.mode).toBe('planned');
	expect(rig.wrapper.get('[data-rp-record="remove-floor"]').text()).toContain('Damaged floor boards');
	expect([...rig.stack.vault.entries]).toEqual(bytes);
});
