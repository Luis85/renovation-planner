/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { createPinia } from 'pinia';
import ViewRoot from '../../../src/presentation/views/ViewRoot.vue';
import PlanList from '../../../src/presentation/views/PlanList.vue';
import ProjectDetail from '../../../src/presentation/views/ProjectDetail.vue';
import ContinueRow from '../../../src/presentation/views/ContinueRow.vue';
import ProjectList from '../../../src/presentation/views/ProjectList.vue';
import AssetPriceList from '../../../src/presentation/views/AssetPriceList.vue';
import NewProjectForm from '../../../src/presentation/views/NewProjectForm.vue';
import { RENOVATION_PROJECT_CONTEXT, type RenovationProjectDeps, type ProjectSession } from '../../../src/presentation/views/RenovationProjectContext';
import { installObsidianDom } from '../../helpers/dom';
import { defaultRenovationProjectDeps, makeView } from '../../helpers/makeRenovationProjectView';
import { useDialogStore } from '../../../src/presentation/dialogs/dialog-store';
import { ok, err } from '../../../src/core/result/Result';
import { createMoney } from '../../../src/core/money/Money';
import type { AssetPriceRowDto } from '../../../src/application/queries/ListProjectAssetPrices';
import type { ProjectSummaryDto } from '../../../src/presentation/read-models/PlanDto';

const project: ProjectSummaryDto = { id: 'p1', name: 'Long project name', status: 'IDEA', currency: 'EUR', libraryOverlap: false, planCount: 0, lastWorked: null };
const plan = { id: 'plan1', name: 'Ground floor' };
const failure = err({ category: 'Persistence' as const, code: 'repository.read-failed', message: 'read failed' });
function session(): ProjectSession {
	return { query: '', completedOpen: false, focusedProjectId: null, scrollTop: 0, guidanceHidden: false };
}
const mounted: VueWrapper[] = [];
afterEach(() => { mounted.splice(0).forEach((wrapper) => wrapper.unmount()); });
function rig(over: Partial<RenovationProjectDeps> = {}) {
	const base = defaultRenovationProjectDeps();
	const pinia = createPinia();
	const context: RenovationProjectDeps = {
		...base, session: session(), navigate: vi.fn<RenovationProjectDeps['navigate']>(), rememberContinue: vi.fn<RenovationProjectDeps['rememberContinue']>(), openPlan: vi.fn<RenovationProjectDeps['openPlan']>(() => Promise.resolve('opened' as const)),
		queries: { ...base.queries, listProjects: () => Promise.resolve(ok({ projects: [project], unreadable: 0 })), getProject: () => Promise.resolve(ok(project)), listPlansByProject: () => Promise.resolve(ok({ plans: [plan], unreadable: 0 })) },
		...over,
	};
	const wrapper = mount(ViewRoot, { attachTo: document.body, global: { plugins: [pinia], provide: { [RENOVATION_PROJECT_CONTEXT as symbol]: context } } });
	mounted.push(wrapper);
	return { wrapper, context, dialogs: useDialogStore(pinia) };
}
function priceRow(): AssetPriceRowDto {
	const price = createMoney('12.00', 'EUR');
	if (!price.ok) throw new Error('fixture');
	return { assetId: 'a1', assetName: 'Paint', assetStatus: 'known', catalogue: price.value, override: null, overrideId: null, overrideVersion: null };
}

describe('project experience', () => {
	it('opens a newly saved id exactly once, independently of matching names', async () => {
		const { wrapper, context } = rig();
		await flushPromises();
		await wrapper.get('.rp-project-list__create').trigger('click');
		const form = wrapper.getComponent(NewProjectForm);
		await form.get('input[data-field="name"]').setValue(project.name);
		await form.get('form').trigger('submit');
		await flushPromises();
		expect(context.navigate).toHaveBeenCalledTimes(1);
		const id = vi.mocked(context.navigate).mock.calls[0]?.[0];
		expect(id).toBeTypeOf('string');
		expect(id).not.toBe(project.id);
	});

	it('keeps guidance optional and core note, plan and price actions available', async () => {
		const state = session();
		const { wrapper, context } = rig({ projectId: project.id, session: state });
		await flushPromises();
		expect(wrapper.text()).toContain('What would you like to do next?');
		await wrapper.get('.rp-project-guidance__toggle').trigger('click');
		expect(state.guidanceHidden).toBe(true);
		expect(wrapper.text()).not.toContain('What would you like to do next?');
		expect(wrapper.find('.rp-project-detail__open-note').exists()).toBe(true);
		expect(wrapper.find('.rp-plan-list__row').exists()).toBe(true);
		await wrapper.get('.rp-project-prices-open').trigger('click');
		expect(context.navigate).toHaveBeenCalledWith(project.id, 'prices');
		await wrapper.get('.rp-project-guidance__toggle').trigger('click');
		expect(state.guidanceHidden).toBe(false);
	});

	it('preserves the last plan on same-project Open, and clears it on another project', async () => {
		const { wrapper, context } = rig({ continueContext: () => Promise.resolve({ projectId: project.id, planId: plan.id }) });
		await flushPromises();
		await wrapper.get('.rp-continue__open').trigger('click');
		expect(context.rememberContinue).toHaveBeenCalledWith({ projectId: project.id, planId: plan.id });
		wrapper.getComponent(ProjectList).vm.$emit('open', 'p2');
		expect(context.rememberContinue).toHaveBeenLastCalledWith({ projectId: 'p2', planId: null });
	});

	it('retains Resume when indexing, on read refusal and on failed opening', async () => {
		let indexed = false;
		const { wrapper, context } = rig({ continueContext: () => Promise.resolve({ projectId: project.id, planId: plan.id }), indexScanCompleted: () => indexed, openPlan: vi.fn<RenovationProjectDeps['openPlan']>(() => Promise.resolve('failed' as const)) });
		await flushPromises();
		expect(wrapper.text()).toContain('being indexed');
		indexed = true;
		await wrapper.get('.rp-resume-recovery button').trigger('click');
		await flushPromises();
		await wrapper.get('.rp-continue__resume').trigger('click');
		await flushPromises();
		expect(wrapper.text()).toContain('saved context is retained');
		expect(context.rememberContinue).not.toHaveBeenCalled();
	});

	it('offers the project when its plan disappeared; retries without a substitute plan', async () => {
		const base = defaultRenovationProjectDeps();
		const { wrapper, context } = rig({ continueContext: () => Promise.resolve({ projectId: project.id, planId: plan.id }), queries: { ...base.queries, listProjects: () => Promise.resolve(ok({ projects: [project], unreadable: 0 })), getProject: () => Promise.resolve(ok(project)), listPlansByProject: () => Promise.resolve(ok({ plans: [], unreadable: 0 })) } });
		await flushPromises();
		expect(wrapper.text()).toContain('last plan is no longer available');
		await wrapper.get('.rp-resume-recovery button:last-child').trigger('click');
		expect(context.navigate).toHaveBeenCalledWith(project.id);
		expect(context.openPlan).not.toHaveBeenCalled();
	});

	it('keeps project actions when plans cannot be read and retries the region', async () => {
		const base = defaultRenovationProjectDeps();
		const listPlansByProject = vi.fn<RenovationProjectDeps['queries']['listPlansByProject']>(base.queries.listPlansByProject).mockResolvedValueOnce(failure);
		const { wrapper } = rig({ projectId: project.id, queries: { ...base.queries, getProject: () => Promise.resolve(ok(project)), listPlansByProject } });
		await flushPromises();
		expect(wrapper.find('.rp-project-detail__open-note').exists()).toBe(true);
		expect(wrapper.find('.rp-empty-state').exists()).toBe(false);
		await wrapper.get('.rp-view-notice button').trigger('click');
		await flushPromises();
		expect(wrapper.find('.rp-empty-state').exists()).toBe(true);
	});

	it('guards dirty navigation with Stay/Discard, and blocks pending writes', async () => {
		const base = defaultRenovationProjectDeps();
		const { wrapper, context, dialogs } = rig({ projectId: project.id, section: 'prices', queries: { ...base.queries, getProject: () => Promise.resolve(ok(project)), listAssetPrices: () => Promise.resolve(ok([priceRow()])) } });
		await flushPromises();
		await wrapper.get('input').setValue('12,50');
		const stay = context.session?.canLeave?.();
		expect(dialogs.current?.kind).toBe('confirm');
		dialogs.resolve('cancel');
		expect(await stay).toBe(false);
		const discard = context.session?.canLeave?.();
		dialogs.resolve('confirm');
		expect(await discard).toBe(true);
		await flushPromises();
		expect((wrapper.get('input').element as HTMLInputElement).value).toBe('');
		wrapper.getComponent(AssetPriceList).vm.$emit('editState', 'a1', true, true);
		expect(await context.session?.canLeave?.()).toBe(false);
		wrapper.getComponent(AssetPriceList).vm.$emit('editState', 'a1', false, false);
		expect(await context.session?.canLeave?.()).toBe(true);
	});

	it('renders prices read-only on mobile and returns to the project', async () => {
		const base = defaultRenovationProjectDeps();
		const { wrapper, context } = rig({ projectId: project.id, section: 'prices', readOnly: true, queries: { ...base.queries, getProject: () => Promise.resolve(ok(project)), listAssetPrices: () => Promise.resolve(ok([priceRow()])) } });
		await flushPromises();
		expect(wrapper.find('input').exists()).toBe(false);
		expect(wrapper.text()).toContain('12.00 EUR');
		await wrapper.get('.rp-project-detail__back').trigger('click');
		expect(context.navigate).toHaveBeenCalledWith(project.id);
	});
	it('restores search, completed expansion, selected focus and scroll through host remounts', async () => {
		installObsidianDom();
		const base = defaultRenovationProjectDeps();
		const completed = { ...project, status: 'COMPLETE' as const };
		const deps = { ...base, queries: { ...base.queries, listProjects: () => Promise.resolve(ok({ projects: [completed], unreadable: 0 })), getProject: () => Promise.resolve(ok(completed)) } };
		const view = makeView(deps);
		document.body.appendChild(view.containerEl);
		await view.onOpen();
		await flushPromises();
		const input = view.contentEl.querySelector('input') as HTMLInputElement;
		input.value = 'Long'; input.dispatchEvent(new Event('input', { bubbles: true }));
		await flushPromises();
		const details = view.contentEl.querySelector('details') as HTMLDetailsElement;
		details.open = true; details.dispatchEvent(new Event('toggle'));
		(view.contentEl.querySelector('[data-project-id]') as HTMLElement).focus();
		const scroller = view.contentEl.querySelector('.rp-project-overview') as HTMLElement;
		scroller.scrollTop = 120;
		await view.setState({ projectId: project.id }, { history: false });
		await flushPromises();
		await view.setState({ projectId: '' }, { history: false });
		await flushPromises();
		expect((view.contentEl.querySelector('input') as HTMLInputElement).value).toBe('Long');
		expect((view.contentEl.querySelector('details') as HTMLDetailsElement).open).toBe(true);
		expect((document.activeElement as HTMLElement).dataset.projectId).toBe(project.id);
		expect((view.contentEl.querySelector('.rp-project-overview') as HTMLElement).scrollTop).toBe(120);
		const other = makeView(deps); await other.onOpen(); await flushPromises();
		expect((other.contentEl.querySelector('input') as HTMLInputElement).value).toBe('');
		await other.onClose(); await view.onClose(); view.containerEl.remove();
	});

	it('restores focus to the filter if the selected row disappeared', async () => {
		const { wrapper, context } = rig({ session: { ...session(), focusedProjectId: 'deleted' } });
		await flushPromises();
		expect(document.activeElement).toBe(wrapper.get('input').element);
		await wrapper.get('input').setValue('Long');
		wrapper.unmount(); mounted.splice(mounted.indexOf(wrapper), 1);
		expect(context.session?.query).toBe('Long');
	});

	it('round-trips the price subsection through host history and ignores unknown sections', async () => {
		installObsidianDom();
		const view = makeView();
		const result = { history: false };
		await view.setState({ projectId: project.id, section: 'prices' }, result);
		expect(result).toEqual({ history: true });
		expect(view.getState()).toEqual({ projectId: project.id, section: 'prices' });
		await view.setState({ projectId: project.id, section: 'unknown' }, { history: false });
		expect(view.getState()).toEqual({ projectId: project.id });
	});

	it('does not replace the last target when detail editor opening fails', async () => {
		const { wrapper, context } = rig({ projectId: project.id, openPlan: vi.fn<RenovationProjectDeps['openPlan']>(() => Promise.resolve('failed' as const)) });
		await flushPromises();
		await wrapper.get('.rp-plan-list__row').trigger('click'); await flushPromises();
		expect(context.rememberContinue).not.toHaveBeenCalled();
	});

	it.each(['project-error', 'project-missing', 'plan-error', 'plan-unreadable'] as const)('keeps the saved target recoverable for %s', async (problem) => {
		const base = defaultRenovationProjectDeps();
		const { wrapper, context } = rig({ continueContext: () => Promise.resolve({ projectId: project.id, planId: plan.id }), queries: {
			...base.queries, listProjects: () => Promise.resolve(ok({ projects: [project], unreadable: 0 })),
			getProject: () => Promise.resolve(problem === 'project-error' ? failure : ok(problem === 'project-missing' ? null : project)),
			listPlansByProject: () => Promise.resolve(problem === 'plan-error' ? failure : ok({ plans: [], unreadable: 1 })),
		} });
		await flushPromises();
		expect(wrapper.find('.rp-resume-recovery').exists()).toBe(true);
		expect(wrapper.find('.rp-continue__resume').exists()).toBe(false);
		expect(context.rememberContinue).not.toHaveBeenCalled();
		expect(wrapper.text()).toContain(problem === 'project-missing' ? 'last project is no longer available' : 'saved context is retained');
	});

	it('ignores a slow Resume opening after another project is selected', async () => {
		let release!: (outcome: 'opened') => void;
		const { wrapper, context } = rig({ continueContext: () => Promise.resolve({ projectId: project.id, planId: plan.id }), openPlan: () => new Promise((resolve) => { release = resolve; }) });
		await flushPromises();
		await wrapper.get('.rp-continue__resume').trigger('click'); await flushPromises();
		wrapper.getComponent(ProjectList).vm.$emit('open', 'p2');
		release('opened'); await flushPromises();
		expect(context.rememberContinue).toHaveBeenCalledExactlyOnceWith({ projectId: 'p2', planId: null });
	});

	it('ignores a late detail opening after unmount', async () => {
		let release!: (outcome: 'opened') => void;
		const { wrapper, context } = rig({ projectId: project.id, openPlan: () => new Promise((resolve) => { release = resolve; }) });
		await flushPromises(); await wrapper.get('.rp-plan-list__row').trigger('click'); await flushPromises();
		wrapper.unmount(); mounted.splice(mounted.indexOf(wrapper), 1);
		release('opened'); await flushPromises();
		expect(context.rememberContinue).not.toHaveBeenCalled();
	});

	it('blocks mobile editor and creation intents while preserving project navigation', async () => {
		const { wrapper, context } = rig({ readOnly: true, continueContext: () => Promise.resolve({ projectId: project.id, planId: plan.id }) });
		await flushPromises();
		expect(wrapper.get('.rp-continue__resume').attributes('disabled')).toBeDefined();
		expect(wrapper.find('.rp-project-list__create').exists()).toBe(false);
		wrapper.getComponent(ContinueRow).vm.$emit('resume');
		wrapper.getComponent(ProjectList).vm.$emit('create', 'New');
		wrapper.getComponent(ProjectList).vm.$emit('createAsset');
		await flushPromises();
		expect(wrapper.findComponent(NewProjectForm).exists()).toBe(false);
		expect(context.openPlan).not.toHaveBeenCalled();
		await wrapper.get('.rp-continue__open').trigger('click');
		expect(context.navigate).toHaveBeenCalledWith(project.id);
		const detailRig = rig({ projectId: project.id, readOnly: true });
		await flushPromises();
		expect(detailRig.wrapper.get('.rp-plan-list__row').attributes('disabled')).toBeDefined();
		detailRig.wrapper.getComponent(PlanList).vm.$emit('open', plan.id);
		detailRig.wrapper.getComponent(ProjectDetail).vm.$emit('createPlan');
		await flushPromises();
		expect(detailRig.context.openPlan).not.toHaveBeenCalled();
		expect(detailRig.dialogs.current).toBeNull();
	});

	it('keeps host history and the draft unchanged on Stay, then accepts Discard', async () => {
		installObsidianDom();
		const base = defaultRenovationProjectDeps();
		const view = makeView({ ...base, queries: { ...base.queries, getProject: () => Promise.resolve(ok(project)), listAssetPrices: () => Promise.resolve(ok([priceRow()])) } });
		document.body.appendChild(view.containerEl);
		await view.setState({ projectId: project.id, section: 'prices' }, { history: false });
		await view.onOpen(); await flushPromises();
		const input = view.contentEl.querySelector('input') as HTMLInputElement;
		input.value = '18,25'; input.dispatchEvent(new Event('input', { bubbles: true }));
		await flushPromises();
		const refused = { history: false };
		const first = view.setState({ projectId: project.id }, refused);
		await flushPromises();
		(view.contentEl.querySelector('.rp-dialog-actions button:first-child') as HTMLButtonElement).click();
		await first; await flushPromises();
		expect(refused.history).toBe(false);
		expect(view.getState()).toEqual({ projectId: project.id, section: 'prices' });
		expect(input.value).toBe('18,25');
		const accepted = { history: false };
		const second = view.setState({ projectId: project.id }, accepted);
		await flushPromises();
		(view.contentEl.querySelector('.rp-dialog-actions button:last-child') as HTMLButtonElement).click();
		await second; await flushPromises();
		expect(accepted.history).toBe(true);
		expect(view.getState()).toEqual({ projectId: project.id });
		await view.onClose(); view.containerEl.remove();
	});

	it.each(['project', 'plan'])('ignores a stale Resume %s read after project selection', async (stage) => {
		let release!: () => void;
		const hold = new Promise<void>((resolve) => { release = resolve; });
		const base = defaultRenovationProjectDeps();
		const { wrapper, context } = rig({ continueContext: () => Promise.resolve({ projectId: project.id, planId: plan.id }), queries: {
			...base.queries, listProjects: () => Promise.resolve(ok({ projects: [project], unreadable: 0 })),
			getProject: async () => { if (stage === 'project') await hold; return ok(project); },
			listPlansByProject: async () => { if (stage === 'plan') await hold; return ok({ plans: [plan], unreadable: 0 }); },
		} });
		await flushPromises();
		wrapper.getComponent(ProjectList).vm.$emit('open', 'p2');
		release(); await flushPromises();
		expect(context.rememberContinue).toHaveBeenCalledExactlyOnceWith({ projectId: 'p2', planId: null });
		expect(wrapper.find('.rp-continue__resume').exists()).toBe(false);
	});

	it('does not open the old Resume target when revalidation reads newer context', async () => {
		let target: { projectId: string; planId: string | null } = { projectId: project.id, planId: plan.id };
		const { wrapper, context } = rig({ continueContext: () => Promise.resolve(target) });
		await flushPromises(); target = { projectId: 'p2', planId: null };
		await wrapper.get('.rp-continue__resume').trigger('click'); await flushPromises();
		expect(context.openPlan).not.toHaveBeenCalled();
		expect(context.rememberContinue).not.toHaveBeenCalled();
	});

});
