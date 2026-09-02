/**
 * @vitest-environment jsdom
 *
 * One project's detail state (design slice 21) — who it is, a way back, a way to its own
 * note, and its plans. It draws only what it is given and emits intents; `ViewRoot` owns
 * every handler.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import ProjectDetail from '../../../src/presentation/views/ProjectDetail.vue';
import type { ProjectSummaryDto } from '../../../src/presentation/read-models/PlanDto';
import { t } from '../../../src/presentation/i18n/strings';
import { ok } from '../../../src/core/result/Result';
import { recorder } from '../../helpers/logger';

// See `projectDetailStore.test.ts` for why this is stated and why it is `false`.
const PROJECT: ProjectSummaryDto = {
	id: 'project-1',
	name: 'Hallway',
	status: 'IDEA',
	currency: 'EUR',
	libraryOverlap: false,
};

/**
 * The four price-section props every mount here needs and no case in this file is ABOUT.
 *
 * Stated once rather than per case, and the rows are EMPTY on purpose: this file is about the
 * header, the plans region and the heading levels, so the section draws its own empty state and
 * contributes nothing for these assertions to trip over. `assetPriceList.test.ts` is where the
 * section itself is driven.
 */
const PRICE_PROPS = {
	assetPrices: [],
	assetPricesFailure: null,
	commitAssetPrice: () => Promise.resolve({ dispatch: ok('no-write' as const), settled: null }),
	logger: recorder,
};

describe('ProjectDetail', () => {
	it('names the project and renders its status through the shared label', () => {
		const wrapper = mount(ProjectDetail, { props: { project: PROJECT, plans: [], unreadablePlans: 0, emptyState: null, ...PRICE_PROPS } });

		expect(wrapper.get('.rp-project-detail__name').text()).toBe('Hallway');
		expect(wrapper.get('.rp-project-detail__status').text()).toBe(t('en', 'form.new-project.status.idea'));
	});

	it('emits back, openNote and createPlan from the header', async () => {
		const wrapper = mount(ProjectDetail, { props: { project: PROJECT, plans: [], unreadablePlans: 0, emptyState: null, ...PRICE_PROPS } });

		await wrapper.get('.rp-project-detail__back').trigger('click');
		await wrapper.get('.rp-project-detail__open-note').trigger('click');
		await wrapper.get('.rp-plan-list__create').trigger('click');

		expect(wrapper.emitted('back')).toHaveLength(1);
		expect(wrapper.emitted('openNote')).toHaveLength(1);
		expect(wrapper.emitted('createPlan')).toHaveLength(1);
	});

	/**
	 * **The heading LEVEL, in the branch a just-created project always lands in.** Task 7 added
	 * a heading-order case for the POPULATED branch — `Plans` is an `<h3>` under the project's
	 * `<h2>` — and the empty branch was left drawing `EmptyState`'s hard-coded `<h2>`, which
	 * announces "No plans yet" as a PEER of the project rather than as content of its plans
	 * region. A check written for the case its author had in mind, with the defect in the one
	 * beside it; reported by a review bot.
	 *
	 * Asserted as the TAG, and it is the ONLY instrument for this decision rather than the
	 * smaller of two. This case first said Task 10's axe scan "would catch it, three tasks
	 * later, as a heading-order violation"; Task 10 measured that false. axe's `heading-order`
	 * reports a SKIPPED level, and the defect here is a PEER one — `<h2>` under `<h2>` — so
	 * with `:heading-level="3"` deleted from `ProjectDetail`, every case in
	 * `tests/harness/accessibility.test.ts` stays green, including the two that scan this
	 * component's own two branches. A claim about what another check will catch is worth
	 * exactly as much as the run that measured it.
	 */
	it('gives the no-plans empty state the plans subsection heading level', () => {
		const wrapper = mount(ProjectDetail, {
			props: { project: PROJECT, plans: [], unreadablePlans: 0, emptyState: { headline: 'h', body: 'b', actionLabel: 'a' }, ...PRICE_PROPS },
		});

		expect(wrapper.get('.rp-empty-state__headline').element.tagName).toBe('H3');
		expect(wrapper.get('.rp-project-detail__name').element.tagName).toBe('H2');
	});

	/**
	 * **The header survives an empty project**, which is every project a user has just
	 * created. Back and Open note live here and nowhere else, so an empty state drawn in
	 * PLACE of this component would fail criteria 5 and 11 on the most common detail state
	 * there is. Reported by a review bot against the plan.
	 */
	it('keeps back and open note when the project has no plans', () => {
		const wrapper = mount(ProjectDetail, {
			props: { project: PROJECT, plans: [], unreadablePlans: 0, emptyState: { headline: 'h', body: 'b', actionLabel: 'a' }, ...PRICE_PROPS },
		});

		expect(wrapper.find('.rp-project-detail__back').exists()).toBe(true);
		expect(wrapper.find('.rp-project-detail__open-note').exists()).toBe(true);
		expect(wrapper.find('.rp-empty-state').exists()).toBe(true);
		expect(wrapper.find('.rp-plan-list').exists()).toBe(false);
	});

	/**
	 * The empty state's action is the SAME intent the plan list's header button carries, so a
	 * project with no plans is not a project with no way to make one. Asserted on the emit
	 * rather than on the button's presence: a rendered action wired to nothing is exactly the
	 * "live control that does nothing" slice 14's amendment refuses.
	 */
	it('emits createPlan from the empty state’s own action', async () => {
		const wrapper = mount(ProjectDetail, {
			props: { project: PROJECT, plans: [], unreadablePlans: 0, emptyState: { headline: 'h', body: 'b', actionLabel: 'a' }, ...PRICE_PROPS },
		});

		await wrapper.get('.rp-empty-state__action').trigger('click');

		expect(wrapper.emitted('createPlan')).toHaveLength(1);
	});

	/**
	 * The re-emit is what criterion 2 travels through: `PlanList` emits an id, this component
	 * carries it up, and `ViewRoot` calls `context.openPlan`. A component that swallowed it
	 * would compile and do nothing.
	 */
	it('carries a plan row’s id up from PlanList', async () => {
		const wrapper = mount(ProjectDetail, {
			props: { project: PROJECT, plans: [{ id: 'plan-1', name: 'Ground floor' }], unreadablePlans: 0, emptyState: null, ...PRICE_PROPS },
		});

		await wrapper.get('.rp-plan-list__row').trigger('click');

		expect(wrapper.emitted('openPlan')).toEqual([['plan-1']]);
	});

	it('says which currency the project is priced in, beside its status', () => {
		const wrapper = mount(ProjectDetail, {
			props: { project: { ...PROJECT, currency: 'GBP' }, plans: [], unreadablePlans: 0, emptyState: null, ...PRICE_PROPS },
		});

		expect(wrapper.get('.rp-project-detail__currency').text()).toBe(
			t('en', 'view.project.currency', { currency: 'GBP' }),
		);
	});

	/**
	 * The sibling of `planList.test.ts`'s own case, and the same hole: jsdom resolves no CSS,
	 * so a class this template emits and `styles/project-detail.css` never declares draws
	 * nothing while every assertion above stays green. Harvested from the DOM, never
	 * transcribed.
	 */
	it('declares a rule for every class it actually emits', () => {
		const css = readFileSync('styles/project-detail.css', 'utf8');
		const wrapper = mount(ProjectDetail, {
			props: { project: PROJECT, plans: [{ id: 'plan-1', name: 'Ground floor' }], unreadablePlans: 0, emptyState: null, ...PRICE_PROPS },
		});

		const emitted = new Set(
			wrapper
				.findAll('[class]')
				.flatMap((el) => [...el.element.classList])
				.filter((name) => name.startsWith('rp-project-detail')),
		);

		expect(emitted.size).toBeGreaterThan(4);
		// A trailing boundary, not `toContain`: every class here is a PREFIX of a longer one, so
		// a plain substring test would credit `.rp-x` to a sheet declaring only `.rp-x__row`.
		for (const name of emitted) expect(css).toMatch(new RegExp(`\\.${name}(?![\\w-])`));
	});
});
