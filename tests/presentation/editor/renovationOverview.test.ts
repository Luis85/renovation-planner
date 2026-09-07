// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { settle } from '../../helpers/editor';
import { expectDefined, expectOk } from '../../helpers/domain';
import { resizeTo } from '../../helpers/layout';
import { EMPTY_DEPTH } from '../../../src/domain/renovation/PlanningDepth';
import type { Renovation } from '../../../src/domain/renovation/Renovation';
import { of } from '../../../src/core/money/Money';
import { tr } from '../../../src/presentation/i18n/strings';

const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });
async function setup(planning = true) { const rig = await renovationEditor(planning); mounted.push(rig); rig.changePlan(); await settle(); return rig; }

it('shows shared Work and missing Evidence findings in both linked Review rooms', async () => {
	const rig = await setup();
	const other = expectOk(await rig.deps.commands.createZone.execute({ planId: rig.plan.id, name: 'Hall', zoneType: 'Room',
		geometry: { points: [{ x: 6000, y: 0 }, { x: 9000, y: 0 }, { x: 9000, y: 2000 }, { x: 6000, y: 2000 }] } })).zone.entity;
	const roomId = rig.room.id, links = [{ roomId: other.id, targetId: other.id }];
	const value: Renovation = { subjects: [], decisions: [], work: [{ id: 'shared-work', roomId, targetId: roomId, links,
		title: 'Prepare both rooms', description: '', order: 0, progress: 'pending', responsibility: 'diy', outcomes: [], dependencies: [] }],
		depth: { ...EMPTY_DEPTH, evidence: [{ id: 'shared-evidence', roomId, targetId: roomId, links, workId: 'shared-work', recordId: '',
			path: 'Notes/missing-review.md', subpath: '', description: 'Shared missing evidence', type: 'document', phase: 'before', pin: null }] } };
	expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(expectOk(await rig.renovation.read(rig.plan.id)), { renovation: value, intended: undefined }, rig.runtime.structureTask.ledger)));
	rig.changePlan(); await settle(); await rig.runtime.renovation.perspective('review'); await settle();
	const markers = expectDefined(rig.stage, 'native stage').find('.review-room-marker');
	expect(markers).toHaveLength(2);
	for (const id of [roomId, other.id]) {
		const row = rig.wrapper.get(`[data-rp-review-room="${id}"]`);
		expect(row.text()).toContain('2 items need attention'); expect(row.text()).not.toContain('No findings');
		const marker = expectDefined(markers.find(item => item.getAttr('roomId') === id), 'shared Room marker');
		expect(String(marker.getAttr('number'))).toBe(row.attributes('data-rp-review-number'));
	}
});

it('distinguishes blocked Work sources that share the same dependency explanation', async () => {
	const rig = await setup(), roomId = rig.room.id;
	const value: Renovation = { subjects: [{ id: 'finish', roomId, targetId: roomId, kind: 'floor', existing: null,
		planned: { change: 'add', description: 'Finished room' } }], decisions: [],
		work: ['Base preparation', 'Paint walls', 'Install tiles'].map((title, order) => ({ id: `work-${order}`, roomId, targetId: roomId, title,
			description: '', order, progress: 'pending', responsibility: 'diy', outcomes: ['finish'], dependencies: order === 0 ? [] : ['work-0'] })) };
	expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(expectOk(await rig.renovation.read(rig.plan.id)), { renovation: value, intended: undefined }, rig.runtime.structureTask.ledger)));
	rig.changePlan(); await settle(); await rig.runtime.renovation.perspective('review'); await settle();
	expect(rig.wrapper.get('[data-rp-review-issue="work-1"]').attributes('aria-label')).toContain('Paint walls');
	expect(rig.wrapper.get('[data-rp-review-issue="work-2"]').attributes('aria-label')).toContain('Install tiles');
	expect(rig.wrapper.get('[data-rp-review-issue="work-1"]').text()).toContain('Paint walls');
	expect(rig.wrapper.get('[data-rp-review-issue="work-2"]').text()).toContain('Install tiles');
	for (const id of ['work-1', 'work-2']) expect(rig.wrapper.get(`[data-rp-review-issue="${id}"]`).text()).toContain('Base preparation');
});

it.each([false, true])('shows unavailable linked sections only without connected planning (%s)', async planning => {
	const rig = await setup(planning); await rig.runtime.renovation.perspective('plan'); await settle();
	expect(rig.wrapper.find('.rp-linked-content').exists()).toBe(!planning);
	expect(rig.wrapper.find('[data-rp-mode="costs"]').exists()).toBe(planning);
});
it('opens connected Costs from Plan while retaining the Room', async () => {
	const rig = await setup(); await rig.runtime.renovation.perspective('plan'); await settle();
	await rig.wrapper.get('[data-rp-mode="costs"]').trigger('click'); await settle();
	expect(rig.session.mode).toBe('costs'); expect(rig.selection.selectedIds).toEqual([rig.room.id]);
});

it('opens Room name and outline editing from Overview while retaining the selected Room', async () => {
	const rig = await setup(); await rig.runtime.renovation.perspective('renovate'); await settle();
	await rig.wrapper.get('[data-rp-action="rename-room"]').trigger('click'); await settle();
	expect(rig.dialogs.current?.kind).toBe('form'); rig.dialogs.resolve('cancel'); await settle();
	await rig.wrapper.get('[data-rp-action="edit-outline"]').trigger('click'); await settle();
	expect(rig.wrapper.find('[data-rp-form="outline-points"]').exists()).toBe(true);
	rig.dialogs.resolve('cancel'); await settle(); expect(rig.selection.selectedIds).toEqual([rig.room.id]);
	expect(rig.session.mode).toBe('overview');
});

it('retains keyboard focus through Room views and returns it to Details when Overview removes its trigger', async () => {
	const rig = await setup(); await rig.runtime.renovation.perspective('renovate'); await settle();
	const nav = rig.wrapper.get('.rp-room-navigation').element;
	for (const mode of ['existing', 'planned', 'work'] as const) {
		const button = rig.wrapper.get<HTMLButtonElement>(`[data-rp-mode="${mode}"]`);
		button.element.focus(); expect(document.activeElement).toBe(button.element);
		await button.trigger('click'); await settle();
		expect(rig.wrapper.get('.rp-room-navigation').element).toBe(nav);
		expect(document.activeElement).toBe(rig.wrapper.get('[data-rp-room-navigation]').element);
		expect(rig.wrapper.get('.rp-room-navigation').isVisible()).toBe(false);
		await rig.wrapper.get('[data-rp-room-navigation]').trigger('click');
		expect(rig.wrapper.get('.rp-room-navigation').isVisible()).toBe(true);
		expect(rig.selection.selectedIds).toEqual([rig.room.id]);
	}
	await rig.wrapper.get('[data-rp-mode="overview"]').trigger('click'); await settle();
	expect(rig.wrapper.get('.rp-room-navigation').element).toBe(nav);
	expect(document.activeElement).toBe(rig.wrapper.get('[data-rp-region="inspector"]').element);
	expect(rig.selection.selectedIds).toEqual([rig.room.id]);
});
it('shows an honest overview, continues to capture facts and returns to a real floor summary', async () => {
	const rig = await setup(); await rig.runtime.renovation.perspective('renovate'); await settle();
	expect(rig.wrapper.get('.rp-transformation-summary').text()).toContain('Not recorded yet');
	expect(rig.wrapper.get('[data-rp-stat="renovation-cost"]').text()).toBe('0.00 EUR');
	await rig.wrapper.get('[data-rp-action="continue-renovation"]').trigger('click'); await settle(); expect(rig.session.mode).toBe('existing');
	rig.selection.clear(); await settle(); expect(rig.wrapper.find('.rp-floor-inspector').exists()).toBe(true); expect(rig.wrapper.find('[data-rp-stat="renovation-cost"]').exists()).toBe(true);
});

it('does not return navigation focus into a disposed editor leaf', async () => {
	const rig = await setup(); await rig.runtime.renovation.perspective('renovate'); await settle();
	const button = rig.wrapper.get<HTMLButtonElement>('[data-rp-mode="existing"]');
	button.element.focus();
	const navigation = button.trigger('click'); rig.unmount(); await navigation; await settle();
	expect(document.activeElement?.closest('.renovation-plan-editor')).toBeNull();
});

it('uses the Room selected in Plan when entering renovation instead of the last inspected wall', async () => {
	const rig = await setup(); await rig.runtime.renovation.perspective('renovate'); await settle();
	rig.selection.select(['wall-a' as never]); await settle(); expect(rig.session.targetId).toBe('wall-a');
	await rig.runtime.renovation.perspective('plan'); await settle();
	await rig.runtime.selectAndFrame(rig.room.id); await settle();
	expect(rig.session.targetId).toBe('wall-a');
	await rig.wrapper.get('[data-rp-mode="existing"]').trigger('click'); await settle();
	expect(rig.selection.selectedIds).toEqual([rig.room.id]); expect(rig.session.targetId).toBe(rig.room.id); expect(rig.session.roomId).toBe(rig.room.id);
});
it('keeps a wall selected while capturing its own finish and opening its existing record for change', async () => {
	const rig = await setup(); rig.selection.select(['wall-a' as never]); await settle();
	await rig.wrapper.get('.rp-structure-renovation-entry select').setValue(rig.room.id);
	await rig.wrapper.get('.rp-structure-renovation-entry button').trigger('click'); await settle();
	expect(rig.session.targetId).toBe('wall-a'); expect(rig.selection.selectedIds).toEqual(['wall-a']);
	await rig.wrapper.get('[data-rp-mode="existing"]').trigger('click'); await settle();
	await rig.wrapper.get('[data-rp-action="new-record"]').trigger('click'); await settle();
	await rig.wrapper.get('textarea[name="description"]').setValue('Original brickwork');
	await rig.wrapper.get('[data-rp-form="renovation"]').trigger('submit'); await rig.wrapper.get('[data-rp-form="renovation"]').trigger('submit'); await settle();
	expect(rig.project.plan?.renovation?.subjects[0].targetId).toBe('wall-a');
	await rig.wrapper.get('[data-rp-mode="planned"]').trigger('click'); await settle(); await rig.wrapper.get('[data-rp-action="new-record"]').trigger('click'); await settle();
	expect(rig.wrapper.get('textarea').element.value).toBe('Original brickwork'); rig.dialogs.resolve('cancel'); await settle();
});
it('previews one shared work item, retains its draft through reflow and undoes all links together', async () => {
	const rig = await setup(); rig.selection.select(['wall-a', 'wall-b'] as never[]); await settle();
	await rig.wrapper.get('.rp-batch-actions select').setValue(rig.room.id);
	await rig.wrapper.get('[data-rp-batch="work"]').trigger('click'); await settle();
	await rig.wrapper.get('input[name="batch-title"]').setValue('Repair both walls');
	resizeTo(rig.rootEl, 460, 900); await settle();
	expect(rig.wrapper.get<HTMLInputElement>('input[name="batch-title"]').element.value).toBe('Repair both walls');
	await rig.wrapper.get('[data-rp-form="renovation-batch"]').trigger('submit'); await settle(); expect(rig.project.plan?.renovation?.work ?? []).toHaveLength(0);
	await rig.wrapper.get('[data-rp-form="renovation-batch"]').trigger('submit'); await settle();
	const saved = rig.project.plan?.renovation?.work ?? []; expect(saved).toHaveLength(1); expect(saved[0].links).toEqual([{ roomId: rig.room.id, targetId: 'wall-b' }]);
	expect(rig.selection.selectedIds).toEqual(['wall-a', 'wall-b']);
	expectOk(await rig.runtime.dispatcher.undo()); await settle(); expect(rig.project.plan?.renovation?.work ?? []).toHaveLength(0);
	expectOk(await rig.runtime.dispatcher.redo()); await settle();
	resizeTo(rig.rootEl, 1280, 900); rig.selection.select(['wall-a' as never]); await settle();
	rig.runtime.renovation.focus(rig.room.id, 'work'); await settle();
	expect(rig.wrapper.get('.rp-shared-contexts').text()).toContain('Studio · Wall 2');
	await rig.wrapper.get('.rp-shared-contexts button').trigger('click'); await settle();
	expect(rig.wrapper.get('.rp-dialog').text()).toContain('Studio · Wall 2'); rig.dialogs.resolve('confirm'); await settle();
	expect(rig.project.plan?.renovation?.work).toHaveLength(1); expect(rig.project.plan?.renovation?.work[0].links).toEqual([]);
	expectOk(await rig.runtime.dispatcher.undo()); await settle(); expect(rig.project.plan?.renovation?.work[0].links).toHaveLength(1);
	const remove = expectDefined(rig.wrapper.get(`[data-rp-record="${saved[0].id}"]`).findAll('button').find(button => button.text() === tr('renovation.delete')), 'shared Work delete');
	await remove.trigger('click'); await settle(); expect(rig.wrapper.get('.rp-dialog').text()).toContain('Studio · Wall 2');
	rig.dialogs.resolve('cancel'); await settle(); expect(rig.project.plan?.renovation?.work).toHaveLength(1);
	await remove.trigger('click'); await settle(); rig.dialogs.resolve('confirm'); await settle();
	expect(rig.project.plan?.renovation?.work).toHaveLength(0);
	expectOk(await rig.runtime.dispatcher.undo()); await settle(); expect(rig.project.plan?.renovation?.work[0]).toEqual(saved[0]);
});
it('deletes compatible current walls atomically only after confirmation and restores them with undo', async () => {
	const rig = await setup(); rig.selection.select(['wall-a', 'wall-b'] as never[]); await settle();
	const pending = rig.runtime.structureActions.remove(['wall-a', 'wall-b']); await settle();
	expect(rig.wrapper.get('.rp-dialog').text()).toContain('Wall 1, Wall 2'); expect(rig.project.structure.walls).toHaveLength(4);
	rig.dialogs.resolve('confirm'); await pending; await settle(); expect(rig.project.structure.walls).toHaveLength(2);
	expectOk(await rig.runtime.dispatcher.undo()); await settle(); expect(rig.project.structure.walls).toHaveLength(4);
});
it.each(['Oiled boards', ''])('connects recorded outcomes (%s), an unresolved decision and real evidence counts without losing selection', async plannedDescription => {
	const rig = await setup(), roomId = rig.room.id;
	const value: Renovation = { subjects: [{ id: 'detail-floor', roomId, targetId: roomId, kind: 'floor', existing: { description: 'Original boards', condition: 'worn' }, planned: { change: plannedDescription ? 'modify' : 'remove', description: plannedDescription } }],
		work: [{ id: 'work-floor', roomId, targetId: roomId, title: 'Prepare boards', description: '', order: 0, progress: 'complete', responsibility: 'diy', outcomes: ['detail-floor'], dependencies: [] }],
		decisions: [{ id: 'decision-oil', roomId, subjectId: 'detail-floor', question: 'Choose finish', resolved: false, resolution: '' }],
		depth: { ...EMPTY_DEPTH, costs: [{ id: 'cost-oil', roomId, targetId: roomId, title: 'Oil', workId: 'work-floor', category: 'material', requirementId: '', planned: of('125', 'EUR'), facts: [], cancelled: false }],
			evidence: (['document', 'photo', 'note'] as const).map(type => ({ id: `evidence-${type}`, roomId, targetId: roomId, workId: '', recordId: '', path: 'Notes/boards.md', subpath: '', description: `Board ${type}`, type, phase: 'before', pin: null })) } };
	expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(expectOk(await rig.renovation.read(rig.plan.id)), { renovation: value, intended: undefined }, rig.runtime.structureTask.ledger)));
	rig.changePlan(); rig.runtime.renovation.focus(roomId, 'overview'); await settle();
	const overview = rig.wrapper.get('.rp-transformation-summary');
	expect(overview.text()).toContain('Original boards'); expect(overview.text()).toContain('Prepare boards');
	expect(overview.get('.rp-transformation-summary__stages > div:last-child').text()).toContain(plannedDescription || 'Original boards');
	expect(rig.wrapper.get('[data-rp-stat="renovation-cost"]').text()).toBe('125.00 EUR');
	for (const mode of ['costs', 'documents', 'photos', 'notes'] as const) {
		expect(rig.wrapper.get(`[data-rp-linked="${mode}"]`).text()).toContain('1');
		await rig.wrapper.get(`[data-rp-linked="${mode}"]`).trigger('click'); await settle(); expect(rig.session.mode).toBe(mode); expect(rig.selection.selectedIds).toEqual([roomId]);
		rig.runtime.renovation.focus(roomId, 'overview'); await settle();
	}
	await rig.wrapper.get('[data-rp-action="continue-renovation"]').trigger('click'); await settle();
	expect(rig.wrapper.get<HTMLTextAreaElement>('textarea[name="question"]').element.value).toBe('Choose finish'); rig.dialogs.resolve('cancel'); await settle();
	rig.runtime.renovation.focus(roomId, 'overview'); rig.project.unreadableZones = 1; await settle();
	expect(rig.wrapper.find('[data-rp-stat="renovation-cost"]').exists()).toBe(false);
	expect(rig.wrapper.get('.rp-renovation-linked-summary [role="status"]').text()).not.toBe('');
	expect(rig.wrapper.get('[data-rp-linked="costs"]').text()).not.toContain('1');
});
