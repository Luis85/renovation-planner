// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import { ref } from 'vue';
import PlanningForm from '../../../src/presentation/editor/planning/PlanningForm.vue';
import RenovationForm from '../../../src/presentation/editor/renovation/RenovationForm.vue';
import { planningDraft } from '../../../src/presentation/editor/planning/planningDraft';
import { renovationDraft } from '../../../src/presentation/editor/renovation/renovationDraft';
import type { DispatchResult } from '../../../src/application/commands/DispatchOutcome';
import type { MaterialInput } from '../../../src/application/commands/renovation/PlanningServices';
import type { RenovationInput } from '../../../src/application/commands/renovation/RenovationCommand';
import { planningStack } from '../../helpers/planning';
import { expectOk } from '../../helpers/domain';
import { defer, settle } from '../../helpers/async';
import { err } from '../../../src/core/result/Result';

const mounted: VueWrapper[] = [];
afterEach(() => { for (const wrapper of mounted.splice(0)) wrapper.unmount(); });
const failure = { category: 'Persistence' as const, code: 'test.offline', message: 'offline' };
async function setup(kind: 'material' | 'cost' | 'existing' | 'work') {
	const rig = await planningStack(), baseline = expectOk(await rig.read()), pending = defer<DispatchResult>();
	const dispatch = vi.fn<(input: MaterialInput | RenovationInput) => Promise<DispatchResult>>(input => 'renovation' in input
		? rig.renovation.command(baseline, input, rig.ledger).execute()
		: rig.planning.material(baseline, input, rig.ledger).execute()).mockReturnValueOnce(pending.promise);
	const shared = { baseline, busy: ref(false), paused: ref(false), dispatch };
	const wrapper = kind === 'material' || kind === 'cost'
		? mount(PlanningForm, { attachTo: document.body, props: { ...shared, draft: planningDraft(kind, baseline, rig.roomId) } })
		: mount(RenovationForm, { attachTo: document.body, props: { ...shared, draft: renovationDraft(kind, rig.roomId, kind === 'work' ? 'work-sand' : 'detail-floor', rig.value) } });
	mounted.push(wrapper);
	return { ...rig, wrapper, pending, dispatch };
}

describe('focusable inoperative planning controls', () => {
	it('keeps the material target focused and restores queued target and asset changes during Apply', async () => {
		const rig = await setup('material'), w = rig.wrapper;
		await w.get('[name="asset"]').setValue(rig.asset.id);
		const target = w.get<HTMLSelectElement>('[name="target"]'); target.element.focus();
		await w.trigger('submit'); expect(target.element.disabled).toBe(false); expect(document.activeElement).toBe(target.element);
		await target.setValue('wall-a'); await w.get('[name="asset"]').setValue('');
		expect(target.element.value).toBe(rig.roomId); expect(w.get<HTMLSelectElement>('[name="asset"]').element.value).toBe(rig.asset.id);
		await w.get('[data-rp-planning-apply]').trigger('click'); expect(rig.dispatch).toHaveBeenCalledOnce();
		rig.pending.resolve(err(failure)); await settle(); await w.trigger('submit'); await settle();
		expectOk(await rig.dispatch.mock.results[1].value);
		expect(expectOk(await rig.read()).materials[0].entity.source?.targetId).toBe(rig.roomId);
	});
	it('refuses cost stage, cancellation and add-fact changes while saving, then persists the retained facts', async () => {
		const rig = await setup('cost'), w = rig.wrapper;
		await w.get('[name="title"]').setValue('Labor'); await w.get('[name="planned"]').setValue('100');
		await w.get('[data-rp-add-fact]').trigger('click'); await w.get('[name="amount"]').setValue('25');
		const stage = w.get<HTMLSelectElement>('[name="stage"]'); stage.element.focus(); await w.trigger('submit');
		expect(stage.element.disabled).toBe(false); expect(document.activeElement).toBe(stage.element);
		await stage.setValue('actual'); await w.get('fieldset input[type="checkbox"]').setValue(true); await w.get('[data-rp-add-fact]').trigger('click');
		expect(stage.element.value).toBe('committed'); expect(w.get<HTMLInputElement>('fieldset input[type="checkbox"]').element.checked).toBe(false);
		expect(w.findAll('fieldset')).toHaveLength(1);
		rig.pending.resolve(err(failure)); await settle(); await w.trigger('submit'); await settle(); expectOk(await rig.dispatch.mock.results[1].value);
		expect(expectOk(await rig.read()).plan.entity.renovation?.depth?.costs[0].facts).toMatchObject([{ stage: 'committed', cancelled: false }]);
	});
	it('keeps the Existing kind focused through Preview and Apply and rejects a queued kind change', async () => {
		const rig = await setup('existing'), w = rig.wrapper, kind = w.get<HTMLSelectElement>('select');
		kind.element.focus(); const value = kind.element.value; await w.trigger('submit'); await w.trigger('submit');
		expect(kind.element.disabled).toBe(false); expect(document.activeElement).toBe(kind.element);
		await kind.setValue('wall'); expect(kind.element.value).toBe(value);
		rig.pending.resolve(err(failure)); await settle(); await w.trigger('submit'); await settle(); expectOk(await rig.dispatch.mock.results[1].value);
		expect(expectOk(await rig.read()).plan.entity.renovation?.subjects[0].kind).toBe(value);
	});
	it('restores selected outcome checkboxes without dropping Work links during a pending write', async () => {
		const rig = await setup('work'), w = rig.wrapper, outcome = w.get<HTMLInputElement>('fieldset input[type="checkbox"]');
		expect(outcome.element.checked).toBe(true); outcome.element.focus(); await w.trigger('submit'); await w.trigger('submit');
		expect(outcome.element.disabled).toBe(false); expect(document.activeElement).toBe(outcome.element);
		await outcome.setValue(false); expect(outcome.element.checked).toBe(true);
		rig.pending.resolve(err(failure)); await settle(); await w.trigger('submit'); await settle(); expectOk(await rig.dispatch.mock.results[1].value);
		expect(expectOk(await rig.read()).plan.entity.renovation?.work[0].outcomes).toEqual(['detail-floor']);
	});
});
