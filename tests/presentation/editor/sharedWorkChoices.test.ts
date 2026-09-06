// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import { planningStack } from '../../helpers/planning';
import { expectOk } from '../../helpers/domain';
import { ok } from '../../../src/core/result/Result';
import WorkFields from '../../../src/presentation/editor/renovation/WorkFields.vue';
import PlanningForm from '../../../src/presentation/editor/planning/PlanningForm.vue';
import { renovationDraft, type EditableRenovationDraft } from '../../../src/presentation/editor/renovation/renovationDraft';
import { planningDraft } from '../../../src/presentation/editor/planning/planningDraft';
import { withPlanRenovation } from '../../../src/domain/plan/Plan';

it('offers linked-Room outcomes and shared Work in real form controls while excluding unrelated Rooms', async () => {
	const rig = await planningStack(), original = expectOk(await rig.read());
	const secondary = { ...rig.value.subjects[0], id: 'detail-secondary', roomId: 'secondary', targetId: 'secondary' };
	const unrelated = { ...secondary, id: 'detail-unrelated', roomId: 'unrelated', targetId: 'unrelated' };
	const shared = { ...rig.value.work[0], links: [{ roomId: 'secondary', targetId: 'secondary' }] };
	const value = { ...rig.value, subjects: [...rig.value.subjects, secondary, unrelated], work: [shared] };
	const draft = structuredClone(renovationDraft('work', rig.roomId, shared.id, value)) as EditableRenovationDraft;
	const work = mount(WorkFields, { props: { draft, value, frozen: false } });
	const baseline = { ...original, plan: { ...original.plan, entity: expectOk(withPlanRenovation(original.plan.entity, value)) } };
	const planning = mount(PlanningForm, { props: { baseline, draft: planningDraft('cost', baseline, 'secondary'), busy: ref(false), paused: ref(false), dispatch: () => Promise.resolve(ok('wrote' as const)) } });
	try {
		expect(work.find(`input[value="${secondary.id}"]`).exists()).toBe(true); expect(work.find(`input[value="${unrelated.id}"]`).exists()).toBe(false);
		await work.get(`input[value="${secondary.id}"]`).setValue(true); expect(draft.work.outcomes).toContain(secondary.id);
		expect(planning.get('select[name="work"]').text()).toContain(shared.title);
		await planning.get('select[name="work"]').setValue(shared.id); expect(planning.get<HTMLSelectElement>('select[name="work"]').element.value).toBe(shared.id);
	} finally { work.unmount(); planning.unmount(); }
});
