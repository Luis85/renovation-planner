// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { settle } from '../../helpers/editor';
import { expectDefined, expectOk } from '../../helpers/domain';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';
import { resizeTo } from '../../helpers/layout';

const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });
async function setup() { const rig = await renovationEditor(); mounted.push(rig); return rig; }
async function apply(rig: Awaited<ReturnType<typeof setup>>) { await rig.wrapper.get('[data-rp-form="renovation"]').trigger('submit'); await rig.wrapper.get('[data-rp-form="renovation"]').trigger('submit'); await settle(); }
describe('connected Room renovation inspector', () => {
	it('frames a Review room without writing and restores the previous Renovate context', async () => {
		const rig = await setup(), actions = rig.runtime.renovation;
		const other = expectOk(await rig.deps.commands.createZone.execute({ planId: rig.plan.id, name: 'Hall', zoneType: 'Room',
			geometry: { points: [{ x: 6000, y: 0 }, { x: 9000, y: 0 }, { x: 9000, y: 2000 }, { x: 6000, y: 2000 }] } })).zone.entity;
		rig.changePlan(); await settle();
		actions.focus(rig.room.id, 'overview'); await settle();
		const viewport = { ...useEditorStore(rig.pinia).viewport }, saved = [...rig.stack.vault.entries];
		await actions.perspective('review'); await settle();
		await rig.wrapper.get(`[data-rp-review-room="${other.id}"]`).trigger('click'); await settle();
		expect(rig.session.perspective).toBe('review'); expect(rig.selection.selectedIds).toEqual([other.id]);
		expect(rig.wrapper.get(`[data-rp-review-room="${other.id}"]`).attributes('aria-pressed')).toBe('true');
		expect(rig.wrapper.get('[data-rp-action="review-open-room"]').text()).toContain('Hall');
		expect([...rig.stack.vault.entries]).toEqual(saved);
		await actions.perspective('renovate'); await settle();
		expect(rig.selection.selectedIds).toEqual([rig.room.id]); expect(useEditorStore(rig.pinia).viewport).toEqual(viewport);
		expect([...rig.stack.vault.entries]).toEqual(saved);
	});
	it('captures facts, proposes an outcome, links work and a Decision, resolves it and returns from Review', async () => {
		const rig = await setup(), actions = rig.runtime.renovation;
		actions.focus(rig.room.id, 'existing'); await settle();
		let pending = actions.edit('existing', rig.room.id); await settle();
		await rig.wrapper.get('textarea[name="description"]').setValue('Worn oak boards'); await apply(rig); await pending;
		const subject = expectDefined(rig.project.plan?.renovation?.subjects[0], 'existing detail');
		expect(rig.wrapper.get('.rp-renovation-inspector').text()).toContain('Worn oak boards');
		pending = actions.edit('planned', rig.room.id, subject.id); await settle();
		await rig.wrapper.get('textarea[name="description"]').setValue('Repair and oil boards'); await apply(rig); await pending;
		actions.focus(rig.room.id, 'planned', subject.id); await settle();
		expect(rig.wrapper.get('.rp-renovation-inspector').text()).toContain('Repair and oil boards');
		pending = actions.edit('work', rig.room.id, subject.id); await settle();
		await rig.wrapper.get('input[name="title"]').setValue('Repair the floor'); await apply(rig); await pending;
		const work = expectDefined(rig.project.plan?.renovation?.work[0], 'work'); expect(work.outcomes).toEqual([subject.id]);
		pending = actions.edit('decision', rig.room.id, subject.id); await settle();
		await rig.wrapper.get('textarea[name="question"]').setValue('Which oil?'); await apply(rig); await pending;
		const decision = expectDefined(rig.project.plan?.renovation?.decisions[0], 'decision');
		actions.focus(rig.room.id, 'work', work.id); await settle();
		expect(rig.selection.selectedIds).toEqual([rig.room.id]);
		const viewport = { ...useEditorStore(rig.pinia).viewport };
		await actions.perspective('review'); await settle();
		expect(rig.wrapper.find('[data-rp-action="add"]').exists()).toBe(false);
		expect(rig.wrapper.get('.rp-renovation-inspector').text()).toContain('Which oil?');
		expect(rig.wrapper.get('.rp-review-findings button').attributes('aria-label')).toContain('Which oil?');
		expect(rig.wrapper.get(`[data-rp-review-room="${rig.room.id}"]`).text()).toContain('Items needing attention: 1');
		expect(rig.wrapper.get('.rp-review-summary .rp-transformation-summary').text()).toContain('Worn oak boards');
		expect(rig.wrapper.get('.rp-review-summary .rp-transformation-summary').text()).toContain('Repair and oil boards');
		expect(rig.wrapper.get('.rp-review-summary .rp-transformation-summary').text()).toContain('0/1 complete');
		const generate = rig.wrapper.findAll('.rp-renovation-inspector button').find(button => button.text().includes('review note'));
		await expectDefined(generate, 'generate button').trigger('click'); await settle(); expect([...rig.stack.vault.entries.values()].some(text => text.includes('# Review'))).toBe(true);
		await actions.perspective('renovate'); await settle(); expect(rig.session.focusedId).toBe(work.id); expect(useEditorStore(rig.pinia).viewport).toEqual(viewport);
		pending = actions.edit('decision', rig.room.id, decision.id); await settle();
		await rig.wrapper.get('.rp-dialog input[type="checkbox"]').setValue(true);
		await rig.wrapper.findAll('.rp-dialog textarea')[1].setValue('Hardwax oil'); await apply(rig); await pending;
		expect(rig.project.plan?.renovation?.decisions[0]).toMatchObject({ resolved: true, resolution: 'Hardwax oil' });
		expect(rig.project.plan?.renovation?.subjects[0].existing?.description).toBe('Worn oak boards');
		await actions.perspective('review'); await settle(); expect(rig.wrapper.get('.rp-renovation-inspector').text()).toContain('No gaps found');
		expect(rig.wrapper.get(`[data-rp-review-room="${rig.room.id}"]`).text()).toContain('No findings in this review scope');
		const saved = [...rig.stack.vault.entries];
		(rig.wrapper.get('[data-rp-action="review-open-room"]').element as HTMLButtonElement).focus();
		await rig.wrapper.get('[data-rp-action="review-open-room"]').trigger('click'); await settle();
		expect(rig.session.perspective).toBe('renovate'); expect(rig.selection.selectedIds).toEqual([rig.room.id]);
		expect(document.activeElement).toBe(rig.wrapper.get('[data-rp-region="inspector"]').element);
		expect([...rig.stack.vault.entries]).toEqual(saved);
	});
	it('retains a root dialog draft across constrained layout, cancels without writes, and toggles only marker visibility', async () => {
		const rig = await setup(), actions = rig.runtime.renovation; actions.focus(rig.room.id, 'existing');
		const bytes = [...rig.stack.vault.entries], pending = actions.edit('existing', rig.room.id); await settle();
		const field = rig.wrapper.get<HTMLTextAreaElement>('textarea[name="description"]'); await field.setValue('Keep this draft'); field.element.focus();
		resizeTo(rig.rootEl, 460, 900); await settle(); expect(document.activeElement).toBe(field.element); expect(field.element.value).toBe('Keep this draft');
		await actions.perspective('review'); expect(rig.session.perspective).toBe('renovate');
		rig.dialogs.resolve('cancel'); await pending; expect([...rig.stack.vault.entries]).toEqual(bytes);
		rig.session.visible = false; await settle(); expect(rig.stage?.findOne('.renovation')?.visible()).toBe(false); expect([...rig.stack.vault.entries]).toEqual(bytes);
	});
	it('creates a new proposed wall with no Existing predecessor and keeps the current structure intact', async () => {
		const rig = await setup(), actions = rig.runtime.renovation; actions.focus(rig.room.id, 'planned');
		const before = expectOk(await rig.geometry.read(rig.plan.id)), pending = actions.edit('planned', rig.room.id); await settle();
		await rig.wrapper.get('textarea[name="description"]').setValue('New partition');
		await rig.wrapper.findAll('.rp-dialog select')[2].setValue('wall');
		for (const [name, value] of Object.entries({ x: '5', y: '0', endX: '5', endY: '3' })) await rig.wrapper.get(`input[name="${name}"]`).setValue(value);
		await apply(rig); await pending;
		const saved = expectOk(await rig.geometry.read(rig.plan.id)); expect(saved.document.structure).toEqual(before.document.structure); expect(saved.document.intended?.walls).toHaveLength(5);
		expect(rig.project.plan?.renovation?.subjects[0]).toMatchObject({ existing: null, planned: { change: 'add', description: 'New partition' } });
		await rig.runtime.dispatcher.undo(); await settle(); expect(rig.project.intended).toBeUndefined();
	});
});
