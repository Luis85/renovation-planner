/**
 * @vitest-environment jsdom
 *
 * The counted strip, driven through the whole state rather than against `ProjectDetail`'s prop:
 * the count has to survive the port, the query, the read-model seam, the store and the binding,
 * and a component-level case would pass with the store field wired to nothing.
 *
 * Its own file rather than a fourth describe in `viewRootProjectDetail.test.ts`, because that
 * file had reached 440 of its 450 counted lines and the cap exists to force exactly this split —
 * by subject, before a file becomes the place tests go to hide. The subject here is one region
 * and one number: how many plan notes refused, and what happens to that number when the read
 * that produced it is replaced.
 */
import { describe, expect, it } from 'vitest';
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import ViewRoot from '../../../src/presentation/views/ViewRoot.vue';
import {
	RENOVATION_PROJECT_CONTEXT,
	type RenovationProjectDeps,
} from '../../../src/presentation/views/RenovationProjectContext';
import type { RenovationProjectQueryServices } from '../../../src/presentation/read-models/renovationProjectQueries';
import type { PlanSummaryDto, ProjectSummaryDto } from '../../../src/presentation/read-models/PlanDto';
import type { RepositoryError } from '../../../src/application/ports/repositoryErrors';
import { err, ok } from '../../../src/core/result/Result';
import { t } from '../../../src/presentation/i18n/strings';
import { defaultRenovationProjectDeps } from '../../helpers/makeRenovationProjectView';
import { installObsidianDom } from '../../helpers/dom';

const PROJECT: ProjectSummaryDto = {
	id: 'project-1',
	name: 'Hallway',
	status: 'IDEA',
	currency: 'EUR',
	libraryOverlap: false,
	planCount: 0,
	lastWorked: null,
};

installObsidianDom();

type Listing = Awaited<ReturnType<RenovationProjectQueryServices['listPlansByProject']>>;

/**
 * The detail state on `PROJECT`, over `defaultRenovationProjectDeps()` for that factory's own
 * stated reason: it is the one place an honest default per member is written down, so a widened
 * `RenovationProjectDeps` reaches this file the day it is written.
 *
 * `listing` is read on EVERY call rather than captured once, which is what lets a case move what
 * the next listing answers; the returned `replan` is the only re-hydration trigger these cases
 * need, and it is the real `onPlansChanged` listener rather than a call into the store.
 */
function mountDetail(listing: () => Listing): { wrapper: VueWrapper; replan: () => void } {
	let replan!: () => void;
	const base = defaultRenovationProjectDeps();
	const context: RenovationProjectDeps = {
		...base,
		projectId: PROJECT.id,
		onPlansChanged: (_projectId, listener) => {
			replan = listener;
			return () => undefined;
		},
		queries: {
			...base.queries,
			getProject: () => Promise.resolve(ok(PROJECT)),
			listPlansByProject: () => Promise.resolve(listing()),
		},
	};
	setActivePinia(createPinia());
	const wrapper = mount(ViewRoot, {
		global: { provide: { [RENOVATION_PROJECT_CONTEXT as symbol]: context } },
	});
	return { wrapper, replan: () => replan() };
}

const PLANS: readonly PlanSummaryDto[] = [
	{ id: 'plan-1', name: 'Ground floor', kind: 'floor' },
	{ id: 'plan-2', name: 'First floor', kind: 'floor' },
];

describe('the project detail state reports plans it could not read', () => {
	it('draws a counted notice when some plan notes refused', async () => {
		const { wrapper } = mountDetail(() => ok({ plans: [PLANS[0] as PlanSummaryDto], unreadable: 1 }));
		await flushPromises();

		expect(wrapper.get('.rp-view-notice').text()).toBe(
			t('en', 'view.project.some-plans-unreadable', { count: '1' }),
		);
	});

	it('draws none when every plan note was read', async () => {
		const { wrapper } = mountDetail(() => ok({ plans: [PLANS[0] as PlanSummaryDto], unreadable: 0 }));
		await flushPromises();

		expect(wrapper.find('.rp-view-notice').exists()).toBe(false);
	});

	it('draws the plans it CAN read beside the notice, never instead of them', async () => {
		// The defect this whole increment exists for: before it, one bad plan note took the
		// listing down and this state drew its failure screen with no plans at all. Both
		// assertions together are the claim — the notice alone is equally true of that screen.
		const { wrapper } = mountDetail(() => ok({ plans: PLANS, unreadable: 1 }));
		await flushPromises();

		expect(wrapper.findAll('.rp-plan-list__row')).toHaveLength(2);
		expect(wrapper.find('.rp-view-notice').exists()).toBe(true);
		expect(wrapper.find('.rp-view-failure').exists()).toBe(false);
	});

	/**
	 * The count describes the read that produced it, so a LATER read that refuses has to take it
	 * with it. Before this, the `isErr(listed)` arm set `plansError` and left `plans` and
	 * `unreadablePlans` where the previous read put them, and the two notices drew together: a
	 * sentence saying the plans could not be listed, beside a count of how many of the plans it
	 * did not list could not be read.
	 */
	it('clears the count when a later listing refuses outright', async () => {
		const refusal: RepositoryError = {
			category: 'Persistence',
			code: 'plan.frontmatter-invalid',
			message: 'developer English',
		};
		let listing: Listing = ok({ plans: [PLANS[0] as PlanSummaryDto], unreadable: 2 });
		const { wrapper, replan } = mountDetail(() => listing);
		await flushPromises();
		expect(wrapper.findAll('.rp-view-notice')).toHaveLength(1);

		listing = err(refusal);
		replan();
		await flushPromises();

		const notices = wrapper.findAll('.rp-view-notice');
		expect(notices).toHaveLength(1);
		expect(notices[0]?.text()).not.toContain(
			t('en', 'view.project.some-plans-unreadable', { count: '2' }),
		);
	});
});
