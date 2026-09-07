// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { expectDefined, expectOk } from '../../helpers/domain';
import { settle, settleUntil } from '../../helpers/editor';
import { EMPTY_DEPTH, type CostRecord } from '../../../src/domain/renovation/PlanningDepth';
import { compare, of, type Money } from '../../../src/core/money/Money';
import { reconcileCosts } from '../../../src/domain/cost/reconcileCosts';
import { formatPlanningMoney } from '../../../src/presentation/i18n/planningFormat';
import { tr } from '../../../src/presentation/i18n/strings';

type Rig = Awaited<ReturnType<typeof renovationEditor>>;
const mounted: Rig[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); vi.restoreAllMocks(); });
async function setup() {
	const rig = await renovationEditor(true); mounted.push(rig);
	await rig.runtime.refreshProjection(); rig.runtime.renovation.focus(rig.room.id, 'materials'); await settle(); return rig;
}
async function savePlanning(rig: Rig) {
	rig.wrapper.get<HTMLButtonElement>('[data-rp-form="planning"] button[type="submit"]').element.click();
	await settleUntil(() => !rig.wrapper.find('[data-rp-form="planning"]').exists(), 'planning save');
}
async function addMaterial(rig: Rig) {
	rig.wrapper.get<HTMLButtonElement>('[data-rp-new-material]').element.click();
	await settleUntil(() => rig.wrapper.find('[data-rp-form="planning"]').exists(), 'material draft');
	const asset = expectDefined(expectOk(await rig.stack.assets.listAll()).loaded.find(item => item.entity.unit === 'm2'), 'area material').entity;
	await rig.wrapper.get('select[name="asset"]').setValue(asset.id); await savePlanning(rig);
	return expectDefined(expectOk(await rig.stack.requirements.listByZone(rig.room.id))[0], 'saved Requirement').entity;
}
function button(rig: Rig, label: string, scope = '.rp-renovation-inspector') {
	return expectDefined(rig.wrapper.findAll<HTMLButtonElement>(`${scope} button`).find(item => item.text() === label), label);
}
function money(value: Money, amount: string) { expect(expectOk(compare(value, of(amount, 'EUR')))).toBe(0); }

it('opens linked Documents from the automatic estimate using the Requirement identity without creating a Cost record', async () => {
	const rig = await setup(), requirement = await addMaterial(rig);
	rig.runtime.renovation.focus(rig.room.id, 'documents', requirement.id); await settle();
	rig.wrapper.get<HTMLButtonElement>('[data-rp-new-evidence]').element.click();
	await settleUntil(() => rig.wrapper.find('[data-rp-form="planning"]').exists(), 'linked document draft');
	expect(rig.wrapper.get<HTMLSelectElement>('select[name="record"]').element.value).toBe(requirement.id);
	await rig.wrapper.get('input[name="title"]').setValue('Estimate specification');
	await rig.wrapper.get('input[name="path"]').setValue('scan.pdf'); await savePlanning(rig);
	const evidence = expectDefined(rig.project.plan?.renovation?.depth?.evidence[0], 'saved document');
	expect(rig.project.plan?.renovation?.depth?.costs).toEqual([]);
	rig.runtime.renovation.focus(rig.room.id, 'costs', requirement.id); await settle();
	const bytes = [...rig.stack.vault.entries], row = `.rp-cost-row[data-rp-record="estimate:${requirement.id}"]`;
	button(rig, tr('renovation.documents'), row).element.click(); await settle();
	expect(rig.session).toMatchObject({ mode: 'documents', roomId: rig.room.id, targetId: requirement.source?.targetId, focusedId: requirement.id });
	expect(rig.selection.selectedIds).toEqual([rig.room.id]);
	expect(rig.wrapper.get(`[data-rp-record="${evidence.id}"]`).classes()).toContain('is-selected');
	expect(rig.wrapper.get(`[data-rp-record="${evidence.id}"]`).text()).toContain('Estimate specification');
	expect(rig.project.plan?.renovation?.depth?.costs).toEqual([]); expect([...rig.stack.vault.entries]).toEqual(bytes);
});

it('rejects native Shopping for a persisted stale material while reads remain healthy and leaves the existing note untouched', async () => {
	const rig = await setup(), requirement = await addMaterial(rig);
	const shopping = button(rig, tr('planning.shopping'));
	shopping.element.click();
	await settleUntil(() => [...rig.stack.vault.entries.keys()].some(path => path.includes('Shopping-')) && !shopping.element.disabled, 'original shopping note');
	const notePath = expectDefined([...rig.stack.vault.entries.keys()].find(path => path.includes('Shopping-')), 'shopping source');
	const originalNote = rig.stack.vault.entries.get(notePath), loaded = expectDefined(expectOk(await rig.stack.requirements.getById(requirement.id)), 'current material');
	expectOk(await rig.stack.requirements.save(expectOk(loaded.entity.markedStale()), loaded.version));
	await rig.runtime.refreshProjection(); await settle();
	const baseline = expectDefined(rig.runtime.planning.baseline.value, 'retained planning baseline');
	expect(baseline.materials.find(item => item.entity.id === requirement.id)?.entity.recalculationStatus).toBe('stale');
	expect(rig.runtime.planning.failed.value).toBe(false); expect(rig.runtime.planning.loading.value).toBe(false);
	expect(rig.runtime.writesBlocked.value).toBe(false); expect(shopping.element.disabled).toBe(false);
	expect(rig.wrapper.find('.rp-renovation-inspector [role="alert"]').exists()).toBe(false);
	const notes = vi.spyOn(rig.deps.commands, 'shoppingNote'), bytes = [...rig.stack.vault.entries];
	shopping.element.focus(); shopping.element.click(); await settle();
	expect(rig.wrapper.get('.rp-renovation-inspector [role="alert"]').text()).toBe(tr('planning.stale'));
	expect(notes).not.toHaveBeenCalled(); expect(rig.stack.vault.entries.get(notePath)).toBe(originalNote);
	expect([...rig.stack.vault.entries]).toEqual(bytes);
});

it('creates material from the native Existing-only subject route without inventing Planned or Work relationships', async () => {
	const rig = await setup(); rig.runtime.renovation.focus(rig.room.id, 'existing'); await settle();
	rig.wrapper.get<HTMLButtonElement>('[data-rp-action="new-record"]').element.click();
	await settleUntil(() => rig.wrapper.find('[data-rp-form="renovation"]').exists(), 'Existing draft');
	const form = rig.wrapper.get('[data-rp-form="renovation"]'); await form.get('textarea[name="description"]').setValue('Sound timber floor');
	form.get<HTMLButtonElement>('button[type="submit"]').element.click(); await settle();
	form.get<HTMLButtonElement>('button[type="submit"]').element.click();
	await settleUntil(() => !rig.wrapper.find('[data-rp-form="renovation"]').exists(), 'Existing save');
	const before = expectOk(await rig.renovation.read(rig.plan.id)), subject = expectDefined(before.plan.entity.renovation?.subjects[0], 'Existing subject');
	expect(subject.planned).toBeNull(); expect(subject.existing?.description).toBe('Sound timber floor');
	button(rig, tr('renovation.materials'), `[data-rp-record="${subject.id}"]`).element.click(); await settle();
	expect(rig.session.focusedId).toBe(subject.id);
	const requirement = await addMaterial(rig), after = expectOk(await rig.renovation.read(rig.plan.id));
	expect(requirement.source).toMatchObject({ targetId: subject.targetId, workId: '', outcomeId: '', state: 'current' });
	expect(requirement.origin.zoneId).toBe(rig.room.id); expect(rig.selection.selectedIds).toEqual([rig.room.id]);
	expect(after.plan.entity.renovation).toEqual(before.plan.entity.renovation);
	expect(after.geometry.document).toEqual(before.geometry.document);
});

it('cancels only an actual payment, reopens its commitment and undoes the change with original fact identities and amounts', async () => {
	const rig = await setup(), baseline = expectOk(await rig.renovation.read(rig.plan.id));
	const cost: CostRecord = { id: 'cost-active-obligation', roomId: rig.room.id, targetId: rig.room.id, workId: '', title: 'Wall preparation', category: 'labor',
		requirementId: '', planned: of('120', 'EUR'), cancelled: false, facts: [
			{ id: 'fact-order', stage: 'committed', amount: of('100', 'EUR'), description: 'Accepted order', commitmentId: '', cancelled: false },
			{ id: 'fact-deposit', stage: 'actual', amount: of('40', 'EUR'), description: 'Recorded deposit', commitmentId: 'fact-order', cancelled: false },
		] };
	expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(baseline, { renovation: { subjects: [], work: [], decisions: [], depth: { ...EMPTY_DEPTH, costs: [cost] } },
		intended: baseline.geometry.document.intended }, rig.runtime.structureTask.ledger)));
	rig.runtime.renovation.focus(rig.room.id, 'costs', cost.id); await settle();
	const initial = expectOk(reconcileCosts(cost, null, 'EUR')); money(initial.actual, '40'); money(initial.openCommitment, '60'); money(initial.remaining, '20');
	const row = `.rp-cost-row[data-rp-record="${cost.id}"]`;
	button(rig, tr('renovation.edit'), row).element.click();
	await settleUntil(() => rig.wrapper.find('[data-rp-form="planning"]').exists(), 'cost edit');
	const form = rig.wrapper.get('[data-rp-form="planning"]');
	const actual = expectDefined(form.findAll('.rp-planning-fact').find(fact => fact.get<HTMLInputElement>('input[name="fact-description"]').element.value === 'Recorded deposit'), 'actual payment fieldset');
	actual.get<HTMLInputElement>('input[type="checkbox"]').element.click(); await settle(); await savePlanning(rig);
	const changed = expectDefined(rig.project.plan?.renovation?.depth?.costs.find(item => item.id === cost.id), 'active obligation');
	expect(changed.cancelled).toBe(false); expect(changed.facts.map(fact => fact.id)).toEqual(cost.facts.map(fact => fact.id));
	expect(changed.facts.map(fact => fact.cancelled)).toEqual([false, true]);
	money(changed.facts[0].amount, '100'); money(changed.facts[1].amount, '40');
	expect(changed.facts[1].commitmentId).toBe('fact-order');
	const totals = expectOk(reconcileCosts(changed, null, 'EUR')); money(totals.actual, '0'); money(totals.openCommitment, '100'); money(totals.remaining, '20');
	expect(rig.wrapper.get(`${row} [data-rp-stage="actual"] dd`).text()).toBe(formatPlanningMoney(totals.actual));
	expect(rig.wrapper.get(`${row} [data-rp-stage="openCommitment"] dd`).text()).toBe(formatPlanningMoney(totals.openCommitment));
	expect(rig.wrapper.get(row).text()).toContain(tr('planning.cancelled'));
	rig.wrapper.get<HTMLButtonElement>('[data-rp-action="undo"]').element.click();
	await settleUntil(() => rig.project.plan?.renovation?.depth?.costs.find(item => item.id === cost.id)?.facts[1]?.cancelled === false, 'fact cancellation Undo');
	expect(rig.project.plan?.renovation?.depth?.costs.find(item => item.id === cost.id)).toEqual(cost);
	expect(expectOk(await rig.geometry.read(rig.plan.id)).document).toEqual(baseline.geometry.document);
});
