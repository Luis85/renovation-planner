// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { expectDefined, expectErr, expectOk } from '../../helpers/domain';
import { settle } from '../../helpers/editor';
import { defer } from '../../helpers/async';
import PlanningForm from '../../../src/presentation/editor/planning/PlanningForm.vue';
import type { DispatchResult } from '../../../src/application/commands/DispatchOutcome';
import { elementInput } from '../../../src/presentation/editor/elements/elementInput';

const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });
async function setup() {
	const rig = await renovationEditor(true); mounted.push(rig);
	rig.changePlan(); await settle();
	return rig;
}

describe('planning dialogs retire their callbacks with the editor leaf', () => {
	it.each(['material', 'cost'] as const)('finishes an authorized %s save after disposal, then refuses its captured dispatch', async kind => {
		const rig = await setup();
		rig.runtime.renovation.focus(rig.room.id, kind === 'material' ? 'materials' : 'costs'); await settle();
		await rig.wrapper.get(`[data-rp-new-${kind}]`).trigger('click'); await settle();
		const component = rig.wrapper.getComponent(PlanningForm), form = rig.wrapper.get('[data-rp-form="planning"]');
		const dispatch = component.props('dispatch'), entered = defer<void>(), release = defer<void>();
		if (kind === 'material') {
			const asset = expectDefined(expectOk(await rig.stack.assets.listAll()).loaded.find(item => item.entity.unit === 'piece'), 'count material').entity;
			await form.get('[name="asset"]').setValue(asset.id); await form.get('[name="rule"]').setValue('manual'); await form.get('[name="manual"]').setValue('3');
			const save = rig.stack.requirements.save.bind(rig.stack.requirements);
			vi.spyOn(rig.stack.requirements, 'save').mockImplementationOnce(async (...args) => { entered.resolve(undefined); await release.promise; return save(...args); });
		} else {
			await form.get('[name="title"]').setValue('Retained labor'); await form.get('[name="category"]').setValue('labor'); await form.get('[name="planned"]').setValue('120');
			const save = rig.stack.plans.save.bind(rig.stack.plans);
			vi.spyOn(rig.stack.plans, 'save').mockImplementationOnce(async (...args) => { entered.resolve(undefined); await release.promise; return save(...args); });
		}
		const materialCommand = vi.spyOn(expectDefined(rig.deps.commands.planning, 'planning services'), 'material');
		const renovationCommand = vi.spyOn(rig.renovation, 'command');
		const run = vi.spyOn(rig.runtime.dispatcher, 'run');
		await form.trigger('submit'); await entered.promise;
		expect(form.get('button[type="submit"]').attributes('aria-disabled')).toBe('true');
		const input = expectDefined(kind === 'material' ? materialCommand.mock.calls[0]?.[1] : renovationCommand.mock.calls[0]?.[1], 'submitted input');
		if ('deleteId' in input) throw new Error('Expected creation, not deletion');
		rig.unmount();
		const outside = document.createElement('button'); outside.textContent = 'Other leaf'; document.body.append(outside); outside.focus();
		try {
			release.resolve(undefined); expectOk(await run.mock.results[0].value as DispatchResult); await settle();
			const saved = kind === 'material' ? expectOk(await rig.stack.requirements.listByZone(rig.room.id))[0].entity.source?.manual
				: expectOk(await rig.renovation.read(rig.plan.id)).plan.entity.renovation?.depth?.costs[0].title;
			expect(saved).toBe(kind === 'material' ? '3' : 'Retained labor');
			expect(rig.dialogs.current).toBeNull(); expect(component.emitted('submit')).toBeUndefined(); expect(document.activeElement).toBe(outside);
			const bytes = [...rig.stack.vault.entries];
			expect(expectErr(await dispatch(input)).code).toBe('undo.superseded');
			expect(run).toHaveBeenCalledOnce(); expect([...rig.stack.vault.entries]).toEqual(bytes);
		} finally { outside.remove(); }
	});
	it('uses the persisted generic element name in Existing and retains its exact target after save', async () => {
		const rig = await setup(), before = expectOk(await rig.renovation.read(rig.plan.id));
		const element = { id: 'element-fence', kind: 'fence' as const, name: 'Fence by the terrace', points: [{ x: 0, y: 0 }, { x: 3000, y: 0 }] };
		expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(before, elementInput(before, element), rig.runtime.structureTask.ledger)));
		await rig.runtime.refreshProjection(); rig.runtime.renovation.focus(rig.room.id, 'existing'); await settle();
		const pending = rig.runtime.renovation.edit('existing', rig.room.id); await settle();
		const form = rig.wrapper.get('[data-rp-form="renovation"]');
		const option = form.get(`option[value="${element.id}"]`); expect(option.text()).toBe(element.name);
		const target = form.findAll('select').find(select => select.find(`option[value="${element.id}"]`).exists());
		await expectDefined(target, 'target select').setValue(element.id);
		await form.get('[name="description"]').setValue('Sound posts, weathered panels');
		await form.trigger('submit'); await form.trigger('submit'); await pending;
		const saved = expectOk(await rig.renovation.read(rig.plan.id));
		expect(saved.plan.entity.renovation?.subjects[0]).toMatchObject({ roomId: rig.room.id, targetId: element.id, existing: { description: 'Sound posts, weathered panels' } });
		expect(saved.geometry.document.structure?.elements?.[0].points).toEqual(element.points);
	});
});


it('admits only one planning dialog when a native Add action is activated twice in the same turn', async () => {
	const rig = await setup(); rig.runtime.renovation.focus(rig.room.id, 'costs'); await settle();
	const open = vi.spyOn(rig.dialogs, 'openDialog'), before = [...rig.stack.vault.entries];
	const button = rig.wrapper.get<HTMLButtonElement>('[data-rp-new-cost]').element;
	button.click(); button.click(); await settle();
	expect(open).toHaveBeenCalledOnce(); expect(rig.wrapper.findAll('[data-rp-form="planning"]')).toHaveLength(1);
	rig.dialogs.resolve('cancel'); await settle(); expect([...rig.stack.vault.entries]).toEqual(before);
});
