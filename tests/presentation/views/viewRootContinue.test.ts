/**
 * @vitest-environment jsdom
 *
 * The Continue group, resolved by `ViewRoot` against the list this mount actually read — design
 * spec §7: "validation is a READ, not a subscription", and BOTH stored ids must resolve or the
 * group does not render at all.
 *
 * Every case mounts the REAL `ViewRoot` in the LIST state and drives a real gesture or reads the
 * real DOM, for the reason `viewRootProjectDetail.test.ts` states about its own file: "hydrate
 * was called" is equally true of a build that resolved nothing.
 */
import { describe, expect, it, vi } from 'vitest';
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import ViewRoot from '../../../src/presentation/views/ViewRoot.vue';
import {
	RENOVATION_PROJECT_CONTEXT,
	type RenovationProjectDeps,
} from '../../../src/presentation/views/RenovationProjectContext';
import type { RenovationProjectQueryServices } from '../../../src/presentation/read-models/renovationProjectQueries';
import type { PlanSummaryDto, ProjectSummaryDto } from '../../../src/presentation/read-models/PlanDto';
import type { ContinueContext } from '../../../src/application/continueContext';
import { err, ok } from '../../../src/core/result/Result';
import { defaultRenovationProjectDeps } from '../../helpers/makeRenovationProjectView';

const PROJECT: ProjectSummaryDto = {
	id: 'project-1',
	name: 'Kitchen renovation',
	status: 'DESIGN',
	currency: 'EUR',
	libraryOverlap: false,
	planCount: 1,
	lastWorked: '2026-08-14T00:00:00.000Z',
};

const PLAN: PlanSummaryDto = { id: 'plan-1', name: 'Ground floor' };

interface Overrides {
	projects?: readonly ProjectSummaryDto[];
	continueContext?: () => Promise<ContinueContext | null>;
	listPlansByProject?: RenovationProjectQueryServices['listPlansByProject'];
	navigate?: (projectId: string | null) => void;
	openPlan?: (planId: string) => Promise<void>;
	rememberContinue?: (context: ContinueContext) => void;
}

/**
 * A `RenovationProjectDeps` for one case, over `defaultRenovationProjectDeps()` — the one place
 * this repository states what an honest default for each member is — mounted in the LIST state.
 * Each case overrides only what it is about; every override declared here is CONSUMED.
 */
function mountList(over: Overrides): VueWrapper {
	const base = defaultRenovationProjectDeps();
	const context: RenovationProjectDeps = {
		...base,
		projectId: null,
		navigate: over.navigate ?? base.navigate,
		openPlan: over.openPlan ?? base.openPlan,
		rememberContinue: over.rememberContinue ?? base.rememberContinue,
		continueContext: over.continueContext ?? base.continueContext,
		queries: {
			...base.queries,
			listProjects: () => Promise.resolve(ok({ projects: over.projects ?? [], unreadable: 0 })),
			listPlansByProject: over.listPlansByProject ?? base.queries.listPlansByProject,
		},
	};
	setActivePinia(createPinia());
	return mount(ViewRoot, {
		global: { provide: { [RENOVATION_PROJECT_CONTEXT as symbol]: context } },
	});
}

describe('ViewRoot, the Continue group', () => {
	it('renders when the stored context names a project the list holds', async () => {
		const wrapper = mountList({
			projects: [PROJECT],
			continueContext: () => Promise.resolve({ projectId: PROJECT.id, planId: null }),
		});
		await flushPromises();

		expect(wrapper.find('.rp-project-list__continue').exists()).toBe(true);
	});

	it('is absent with no stored context', async () => {
		const wrapper = mountList({ projects: [PROJECT] });
		await flushPromises();

		expect(wrapper.find('.rp-project-list__continue').exists()).toBe(false);
	});

	/**
	 * **The deleted PROJECT.** The list holds a DIFFERENT project — never empty, which would
	 * mask this behind the empty state's own `v-else` and pass for the wrong reason — so the
	 * only way this can go green is the `find` inside `continueProject` genuinely refusing a
	 * ghost id. Watched failing with that `find` widened to fall back to some project in the
	 * list, so it pins the resolution rather than merely the absence.
	 */
	it('is absent when the stored project is not in the list', async () => {
		const wrapper = mountList({
			projects: [PROJECT],
			continueContext: () => Promise.resolve({ projectId: 'ghost-project', planId: null }),
		});
		await flushPromises();

		expect(wrapper.find('.rp-project-list__continue').exists()).toBe(false);
		expect(wrapper.find('.rp-project-list__row').exists()).toBe(true);
	});

	/**
	 * **The deleted PLAN.** Watched failing with `storedPlan` hard-coded to a plan — the version
	 * this design shipped first, and every other case in this file passes against it. Asserted
	 * on `openPlan` NOT having been called rather than merely on the group's absence: a build
	 * that drew the group anyway and opened a dead editor is exactly what this case exists to
	 * refuse, and the group being absent is not itself proof that Continue would have refused to
	 * dispatch.
	 */
	it('is absent when the stored plan is not among the project’s plans, and never opens it', async () => {
		const openPlan = vi.fn<(planId: string) => Promise<void>>(() => Promise.resolve());
		const wrapper = mountList({
			projects: [PROJECT],
			continueContext: () => Promise.resolve({ projectId: PROJECT.id, planId: 'ghost-plan' }),
			listPlansByProject: () => Promise.resolve(ok({ plans: [PLAN], unreadable: 0 })),
			openPlan,
		});
		await flushPromises();

		expect(wrapper.find('.rp-project-list__continue').exists()).toBe(false);
		expect(openPlan).not.toHaveBeenCalled();
	});

	it('is absent when the plan read refuses', async () => {
		const wrapper = mountList({
			projects: [PROJECT],
			continueContext: () => Promise.resolve({ projectId: PROJECT.id, planId: PLAN.id }),
			listPlansByProject: () =>
				Promise.resolve(err({ category: 'Persistence', code: 'plan.read-failed', message: 'io' })),
		});
		await flushPromises();

		expect(wrapper.find('.rp-project-list__continue').exists()).toBe(false);
	});

	it('renders when the context names no plan at all, and never reads listPlansByProject', async () => {
		const listPlansByProject = vi.fn<RenovationProjectQueryServices['listPlansByProject']>(() =>
			Promise.resolve(ok({ plans: [], unreadable: 0 })),
		);
		const wrapper = mountList({
			projects: [PROJECT],
			continueContext: () => Promise.resolve({ projectId: PROJECT.id, planId: null }),
			listPlansByProject,
		});
		await flushPromises();

		expect(wrapper.find('.rp-project-list__continue').exists()).toBe(true);
		expect(listPlansByProject).not.toHaveBeenCalled();
	});

	it('Continue on a plan context opens the plan and never navigates', async () => {
		const navigate = vi.fn<(projectId: string | null) => void>();
		const openPlan = vi.fn<(planId: string) => Promise<void>>(() => Promise.resolve());
		const wrapper = mountList({
			projects: [PROJECT],
			continueContext: () => Promise.resolve({ projectId: PROJECT.id, planId: PLAN.id }),
			listPlansByProject: () => Promise.resolve(ok({ plans: [PLAN], unreadable: 0 })),
			navigate,
			openPlan,
		});
		await flushPromises();

		await wrapper.get('.rp-continue__resume').trigger('click');

		expect(openPlan).toHaveBeenCalledWith(PLAN.id);
		expect(navigate).not.toHaveBeenCalled();
	});

	it('Continue on a project context (no plan) navigates', async () => {
		const navigate = vi.fn<(projectId: string | null) => void>();
		const openPlan = vi.fn<(planId: string) => Promise<void>>(() => Promise.resolve());
		const wrapper = mountList({
			projects: [PROJECT],
			continueContext: () => Promise.resolve({ projectId: PROJECT.id, planId: null }),
			navigate,
			openPlan,
		});
		await flushPromises();

		await wrapper.get('.rp-continue__resume').trigger('click');

		expect(navigate).toHaveBeenCalledWith(PROJECT.id);
		expect(openPlan).not.toHaveBeenCalled();
	});

	/**
	 * `Open` always goes to the detail state, whether the context names a plan or not — the
	 * whole distinction between the two actions.
	 */
	it('Open always navigates, even when the context names a plan', async () => {
		const navigate = vi.fn<(projectId: string | null) => void>();
		const wrapper = mountList({
			projects: [PROJECT],
			continueContext: () => Promise.resolve({ projectId: PROJECT.id, planId: PLAN.id }),
			listPlansByProject: () => Promise.resolve(ok({ plans: [PLAN], unreadable: 0 })),
			navigate,
		});
		await flushPromises();

		await wrapper.get('.rp-continue__open').trigger('click');

		expect(navigate).toHaveBeenCalledWith(PROJECT.id);
	});

	/**
	 * `onOpenProject` — the ordinary row's own navigation — remembers the project BEFORE it
	 * navigates, which is the write half of Continue that has nothing to do with a plan.
	 */
	it('remembers the project before navigating from an ordinary row', async () => {
		const navigate = vi.fn<(projectId: string | null) => void>();
		const rememberContinue = vi.fn<(context: ContinueContext) => void>();
		const wrapper = mountList({ projects: [PROJECT], navigate, rememberContinue });
		await flushPromises();

		await wrapper.get('.rp-project-list__row').trigger('click');

		expect(rememberContinue).toHaveBeenCalledWith({ projectId: PROJECT.id, planId: null });
		expect(navigate).toHaveBeenCalledWith(PROJECT.id);
	});
});
