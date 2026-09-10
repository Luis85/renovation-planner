/**
 * @vitest-environment jsdom
 *
 * P03 inside the detail state, and the two leaf-local facts that travel with it: where the caret
 * lands on arrival, and what the body scroller remembers.
 *
 * Its own file rather than more cases in `viewRootProjectDetail.test.ts`, which is at its
 * 450-line cap — and the seam is a real one rather than a budget's accident: every case here is
 * about what a NAVIGATION into a project does, where that file is about what the state draws and
 * dispatches once it is there.
 *
 * Driven through `ViewRoot` rather than by mounting `ProjectDetail` with props, because the fact
 * P03 turns on is one the STATE derives — the stored continue context, re-read on every hydrate
 * and compared against the plan list the same hydrate just read. `projectDetail.test.ts` is where
 * the component is driven bare.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { createPinia } from 'pinia';
import ViewRoot from '../../../src/presentation/views/ViewRoot.vue';
import {
	RENOVATION_PROJECT_CONTEXT,
	type ProjectSession,
	type RenovationProjectDeps,
} from '../../../src/presentation/views/RenovationProjectContext';
import { installObsidianDom } from '../../helpers/dom';
import { defaultRenovationProjectDeps } from '../../helpers/makeRenovationProjectView';
import { ok } from '../../../src/core/result/Result';
import { t } from '../../../src/presentation/i18n/strings';
import type { PlanSummaryDto, ProjectSummaryDto } from '../../../src/presentation/read-models/PlanDto';

installObsidianDom();

const PROJECT: ProjectSummaryDto = {
	id: 'project-1',
	name: 'Maple Street',
	status: 'IDEA',
	currency: 'EUR',
	libraryOverlap: false,
	planCount: 0,
	lastWorked: null,
};
const PLAN: PlanSummaryDto = { id: 'plan-1', name: 'Ground floor' };

const session = (): ProjectSession => ({ query: '', completedOpen: false, focusedProjectId: null, scrollTop: 7, guidanceHidden: false });

const mounted: VueWrapper[] = [];
afterEach(() => { mounted.splice(0).forEach((wrapper) => wrapper.unmount()); });

interface Rig {
	autoFocus?: boolean;
	session?: ProjectSession;
	plans?: readonly PlanSummaryDto[];
	unreadablePlans?: number;
	continueContext?: RenovationProjectDeps['continueContext'];
}

/**
 * The detail state over one project, ATTACHED — `document.activeElement` is `<body>` for a tree
 * that is not in the document at all, so a detached mount would pass every focus assertion here
 * for a build that focused nothing.
 */
function rig(over: Rig): VueWrapper {
	const base = defaultRenovationProjectDeps();
	const context: RenovationProjectDeps = {
		...base,
		projectId: PROJECT.id,
		autoFocus: over.autoFocus ?? false,
		session: over.session ?? session(),
		continueContext: over.continueContext ?? base.continueContext,
		queries: {
			...base.queries,
			getProject: () => Promise.resolve(ok(PROJECT)),
			listPlansByProject: () =>
				Promise.resolve(ok({ plans: [...(over.plans ?? [])], unreadable: over.unreadablePlans ?? 0 })),
		},
	};
	const wrapper = mount(ViewRoot, {
		attachTo: document.body,
		global: { plugins: [createPinia()], provide: { [RENOVATION_PROJECT_CONTEXT as symbol]: context } },
	});
	mounted.push(wrapper);
	return wrapper;
}

describe('arriving in a project', () => {
	/**
	 * **Focus moves on a NAVIGATION and on nothing else** — `states-and-navigation.md`'s pair of
	 * rules, which pull in opposite directions: "no initial autofocus when opening a view beside a
	 * note" and "user-triggered navigation moves focus meaningfully to the new heading".
	 * `RenovationProjectView` answers which of the two a mount is (a mount replacing a live one is
	 * a navigation); this asks that the answer is actually acted on, at the moment the first
	 * hydrate settles rather than at mount, when `missingPlan` is not yet resolved.
	 */
	it.each([
		{ what: 'a navigation', autoFocus: true, focused: true },
		{ what: 'a leaf opened or restored', autoFocus: false, focused: false },
	])('moves focus to the project heading for $what', async ({ autoFocus, focused }) => {
		// The trees these cases attach stay in the document, and so does the caret one of them
		// took — an assertion about where focus IS has to start from a known place or it reads
		// the previous case's answer.
		(document.activeElement as HTMLElement | null)?.blur();
		const wrapper = rig({ autoFocus });
		await flushPromises();
		await nextTick();

		expect(document.activeElement === wrapper.get('.rp-project-detail__name').element).toBe(focused);
		wrapper.unmount();
	});

	/**
	 * **The detail body's scroll offset is in the leaf-local snapshot**, and in its OWN field.
	 * `ProjectSession.scrollTop` is the LAUNCHER's, so one number for both surfaces would restore
	 * the list to wherever a project's plans had been left. Both directions, because a value
	 * written by nothing and a value read by nothing look identical from either end alone.
	 */
	it('saves the detail body scroll into the session and restores it on a remount', async () => {
		const state = session();
		const first = rig({ session: state, plans: [PLAN] });
		await flushPromises();
		const body = first.get('.rp-project-detail__body');
		body.element.scrollTop = 240;
		await body.trigger('scroll');

		expect(state.detailScrollTop).toBe(240);
		// Untouched: the launcher's own offset is a different surface's answer to a different
		// question, and sharing the field is the defect this separation exists for.
		expect(state.scrollTop).toBe(7);

		first.unmount();
		const again = rig({ session: state, plans: [PLAN] });
		await flushPromises();

		expect(again.get('.rp-project-detail__body').element.scrollTop).toBe(240);
	});

	/**
	 * P03 end to end inside the detail state: the stored context names a plan of THIS project that
	 * a successful, complete read does not hold, so the recovery region draws and the caret lands
	 * on its heading rather than on the project's own. The fact is DERIVED from the persisted
	 * context on every hydrate rather than carried in the view state, so it survives the remount a
	 * navigation causes — which is what this case's route through `ViewRoot` exercises.
	 */
	it('draws the recovery region from the stored context and lands the caret on it', async () => {
		const wrapper = rig({
			autoFocus: true,
			plans: [PLAN],
			continueContext: () => Promise.resolve({ projectId: 'project-1', planId: 'plan-removed' }),
		});
		await flushPromises();
		await nextTick();

		expect(wrapper.find('.rp-recovery__warning').exists()).toBe(true);
		expect(document.activeElement).toBe(wrapper.get('.rp-recovery__title').element);
	});

	/**
	 * The other side of the same derivation, and P03 states it outright: "validation fails instead
	 * of confirming absence -> read error, not a missing-plan claim". A listing that skipped notes
	 * cannot confirm that the stored plan is gone — it may be one of the notes it skipped — so the
	 * unreadable notice draws and the recovery region does not.
	 */
	it('claims no missing plan when the listing could not read every note', async () => {
		const wrapper = rig({
			plans: [PLAN],
			unreadablePlans: 1,
			continueContext: () => Promise.resolve({ projectId: 'project-1', planId: 'plan-removed' }),
		});
		await flushPromises();

		expect(wrapper.find('.rp-recovery__warning').exists()).toBe(false);
		expect(wrapper.get('.rp-view-notice').text()).toBe(t('en', 'view.project.some-plans-unreadable'));
	});
});
