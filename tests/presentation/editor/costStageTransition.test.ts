// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { planningStack } from '../../helpers/planning';
import { expectOk } from '../../helpers/domain';
import CostFields from '../../../src/presentation/editor/planning/CostFields.vue';
import { planningDraft, planningInput } from '../../../src/presentation/editor/planning/planningDraft';

it('clears the hidden settlement link atomically when an actual fact becomes committed and saves successfully', async () => {
	const rig = await planningStack(); expectOk(await rig.planning.material(expectOk(await rig.read()), rig.input, rig.ledger).execute());
	expectOk(await rig.renovation.command(expectOk(await rig.read()), { renovation: { ...rig.value, depth: rig.depth }, intended: undefined }, rig.ledger).execute());
	const baseline = expectOk(await rig.read()), draft = planningDraft('cost', baseline, rig.roomId, rig.cost.id);
	const wrapper = mount(CostFields, { props: { baseline, draft, paused: false } });
	try {
		expect(draft.facts[1].commitmentId).toBe('order');
		await wrapper.findAll('select[name="stage"]')[1].setValue('committed');
		expect(draft.facts[1]).toMatchObject({ stage: 'committed', commitmentId: '', amount: '200' });
		expect(wrapper.find('select[name="settles"]').exists()).toBe(false);
		expectOk(await rig.renovation.command(baseline, planningInput(draft, baseline), rig.ledger).execute());
		expect(expectOk(await rig.read()).plan.entity.renovation?.depth?.costs[0].facts[1].commitmentId).toBe('');
		await wrapper.findAll('select[name="stage"]')[1].setValue('actual'); expect(wrapper.find('select[name="settles"]').exists()).toBe(true);
		const stage = wrapper.findAll<HTMLSelectElement>('select[name="stage"]')[1];
		stage.element.value = ''; await stage.trigger('change'); expect(draft.facts[1].stage).toBe('actual');
		// `dispatchEvent` rather than `trigger`: test-utils skips a DISABLED element, so the
		// paused select would never reach `changeStage` and the guard would pass unexercised.
		await wrapper.setProps({ paused: true }); stage.element.value = 'committed'; stage.element.dispatchEvent(new Event('change')); await nextTick(); expect(draft.facts[1].stage).toBe('actual');
	} finally { wrapper.unmount(); }
});
