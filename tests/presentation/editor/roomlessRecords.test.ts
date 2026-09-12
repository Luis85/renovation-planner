// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { settle, settleUntil } from '../../helpers/editor';
import { expectDefined, expectOk } from '../../helpers/domain';
import { makeAsset } from '../../helpers/entities';
import { EMPTY_DEPTH } from '../../../src/domain/renovation/PlanningDepth';
import type { Renovation } from '../../../src/domain/renovation/Renovation';
import { of } from '../../../src/core/money/Money';
import { renovationCostSummary } from '../../../src/presentation/editor/renovation/renovationCostSummary';

const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });
async function setup() { const rig = await renovationEditor(true); mounted.push(rig); rig.changePlan(); await settle(); return rig; }
type Rig = Awaited<ReturnType<typeof setup>>;
const border: Renovation = { subjects: [], decisions: [],
	work: [{ id: 'work-border', targetId: 'wall-a', title: 'Repoint the border wall', description: '', order: 0, progress: 'pending', responsibility: 'diy', outcomes: [], dependencies: [] }],
	depth: { ...EMPTY_DEPTH, costs: [{ id: 'cost-border', targetId: 'wall-a', workId: 'work-border', title: 'Mortar', category: 'other', requirementId: '', planned: of('40', 'EUR'), facts: [], cancelled: false }] } };
async function saveBorder(rig: Rig) {
	expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(expectOk(await rig.renovation.read(rig.plan.id)), { renovation: border, intended: undefined }, rig.runtime.structureTask.ledger)));
	rig.changePlan(); await settle();
}

it('saves Work and a cost on a wall that bounds no room and counts that cost once on the floor', async () => {
	const rig = await setup(); await saveBorder(rig);
	const baseline = expectOk(await expectDefined(rig.deps.commands.planning, 'planning services').read(rig.plan.id));
	expect(renovationCostSummary(baseline).count).toBe(1);
	expect(renovationCostSummary(baseline, '', 'wall-a').count).toBe(1);
	expect(renovationCostSummary(baseline, rig.room.id).count).toBe(0);
	expect(renovationCostSummary(baseline).totals).not.toBeNull();
});

it('focuses a room-less record with no room in the session and its wall selected', async () => {
	const rig = await setup(); await saveBorder(rig);
	rig.runtime.renovation.focus('', 'work', 'work-border'); await settle();
	expect(rig.session.roomId).toBe(''); expect(rig.session.targetId).toBe('wall-a');
	expect(rig.selection.selectedIds).toEqual(['wall-a']);
});

it('gives a wall that bounds no room its details, New buttons and a No room choice', async () => {
	const rig = await setup(); rig.selection.select(['wall-a' as never]); await settle();
	const entry = rig.wrapper.get('.rp-structure-renovation-entry');
	expect(entry.get<HTMLSelectElement>('select').element.value).toBe('');
	expect(entry.get('option[value=""]').text()).toBe('No room');
	expect(entry.text()).not.toContain('Choose a room');
	rig.runtime.renovation.focus('', 'work'); await settle();
	await rig.wrapper.get('[data-rp-action="new-record"]').trigger('click'); await settle();
	await rig.wrapper.get('[data-rp-form="renovation"] input[name="title"]').setValue('Repoint the border wall');
	const form = rig.wrapper.get('[data-rp-form="renovation"]');
	await form.trigger('submit'); await form.trigger('submit'); await settle();
	const saved = expectDefined(rig.project.plan?.renovation?.work[0], 'saved Work');
	expect(saved).toMatchObject({ targetId: 'wall-a', title: 'Repoint the border wall' });
	expect(saved.roomId).toBeUndefined();
});

it('gives an Area the same renovation details a Room gets', async () => {
	const rig = await setup();
	const garden = expectOk(await rig.deps.commands.createZone.execute({ planId: rig.plan.id, name: 'Garden', zoneType: 'Garden', geometry: { points: [{ x: 5000, y: 0 }, { x: 7000, y: 0 }, { x: 7000, y: 2000 }, { x: 5000, y: 2000 }] } })).zone.entity;
	await rig.runtime.refreshProjection(); rig.selection.select([garden.id]); await settle();
	expect(rig.session.roomId).toBe(garden.id);
	expect(rig.wrapper.find('[data-rp-mode="existing"]').exists()).toBe(true);
});

it('adds a material to a wall that bounds no room as a plan-origin requirement', async () => {
	const rig = await setup();
	const asset = expectOk(await rig.stack.assets.save(makeAsset({ name: 'Render', unit: 'm2' }), 'absent')).entity;
	rig.selection.select(['wall-a' as never]); await settle();
	rig.runtime.renovation.focus('', 'materials'); await rig.runtime.refreshProjection(); await settle();
	await settleUntil(() => rig.runtime.planning.baseline.value?.catalogue.some(item => item.asset.id === asset.id) === true, 'catalogue read');
	await rig.wrapper.get('[data-rp-new-material]').trigger('click'); await settle();
	const form = rig.wrapper.get('[data-rp-form="planning"]');
	await form.get('select[name="asset"]').setValue(asset.id); await form.get('select[name="rule"]').setValue('wall-net');
	await form.trigger('submit');
	await settleUntil(async () => expectOk(await rig.stack.requirements.listByPlanOrigin(rig.plan.id)).length === 1, 'material saved');
	const saved = expectOk(await rig.stack.requirements.listByPlanOrigin(rig.plan.id))[0].entity;
	expect(saved.origin).toEqual({ kind: 'plan', planId: rig.plan.id }); expect(saved.source?.targetId).toBe('wall-a');
});

it('sets a wall material from the Inspector and shows its name', async () => {
	const rig = await setup();
	const brick = expectOk(await rig.stack.assets.save(makeAsset({ name: 'Clinker brick', unit: 'm2', category: 'material' }), 'absent')).entity;
	await rig.runtime.refreshProjection();
	await settleUntil(() => rig.runtime.planning.baseline.value?.catalogue.some(item => item.asset.id === brick.id) === true, 'catalogue read');
	rig.selection.select(['wall-a' as never]); await settle();
	await rig.wrapper.get('[data-rp-action="set-material"]').trigger('click'); await settle();
	const form = rig.wrapper.get('[data-rp-form="renovation"]');
	const materialSelect = form.get<HTMLSelectElement>('select[name="material"]');
	expect(materialSelect.element.closest('label')?.textContent).toContain('Material');
	await materialSelect.setValue(brick.id);
	expect(form.get<HTMLTextAreaElement>('textarea[name="description"]').element.value).toBe('Clinker brick');
	await form.trigger('submit'); await form.trigger('submit');
	await settleUntil(() => rig.project.plan?.renovation?.subjects[0]?.existing?.assetId === brick.id, 'material saved');
	expect(rig.wrapper.get('.rp-structure-inspector').text()).toContain('Clinker brick');
});

it('clears a subject\'s material when its kind stops being wall, door or window', async () => {
	const rig = await setup();
	const brick = expectOk(await rig.stack.assets.save(makeAsset({ name: 'Clinker brick', unit: 'm2', category: 'material' }), 'absent')).entity;
	await rig.runtime.refreshProjection();
	await settleUntil(() => rig.runtime.planning.baseline.value?.catalogue.some(item => item.asset.id === brick.id) === true, 'catalogue read');
	rig.selection.select(['wall-a' as never]); await settle();
	await rig.wrapper.get('[data-rp-action="set-material"]').trigger('click'); await settle();
	const setup1 = rig.wrapper.get('[data-rp-form="renovation"]');
	await setup1.get('select[name="material"]').setValue(brick.id);
	await setup1.trigger('submit'); await setup1.trigger('submit');
	await settleUntil(() => rig.project.plan?.renovation?.subjects[0]?.existing?.assetId === brick.id, 'material saved');

	await rig.wrapper.get('[data-rp-action="set-material"]').trigger('click'); await settle();
	const form = rig.wrapper.get('[data-rp-form="renovation"]');
	await form.findAll('select')[0].setValue('other');
	await form.trigger('submit'); await form.trigger('submit');
	await settleUntil(() => rig.project.plan?.renovation?.subjects[0]?.kind === 'other', 'kind changed');
	const subject = expectDefined(rig.project.plan?.renovation?.subjects[0], 'subject');
	expect(subject.existing?.assetId).toBeUndefined();
	expect(subject.planned?.assetId).toBeUndefined();
	expect(rig.wrapper.find('[data-rp-form="renovation"] [role="alert"]').exists()).toBe(false);
});
