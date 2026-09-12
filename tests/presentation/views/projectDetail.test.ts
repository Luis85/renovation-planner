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
import { classesNamed, propertyOf, show, stylesheetRules } from '../../helpers/selectors';

// See `projectDetailStore.test.ts` for why this is stated and why it is `false`.
const PROJECT: ProjectSummaryDto = {
	id: 'project-1',
	name: 'Hallway',
	status: 'IDEA',
	currency: 'EUR',
	libraryOverlap: false,
	planCount: 0,
	lastWorked: null,
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
	 * **P01's "compact empty plan row", and the large centred card it replaced.**
	 *
	 * §6 refuses the card by name — "no duplicate large empty card below the same creation
	 * action. A compact empty plan row is sufficient" — because the guidance region directly above
	 * already offers `Create first plan`. What is left is the section's own heading and one muted
	 * line, so the region states the fact and stops.
	 *
	 * The heading LEVEL is asserted with it, and this is the ONLY instrument for that decision.
	 * The card's own headline was an `<h2>` — announcing "No plans yet" as a PEER of the project —
	 * until `:heading-level="3"` was passed; the disclosure's `<h3>` carries it now. This case
	 * first said an axe scan "would catch it, as a heading-order violation", and that was measured
	 * false: axe's `heading-order` reports a SKIPPED level, and `<h2>` under `<h2>` is a peer. A
	 * claim about what another check will catch is worth exactly as much as the run that measured
	 * it.
	 */
	it('draws a compact empty plan row rather than a second creation card', () => {
		const wrapper = mount(ProjectDetail, {
			props: { project: PROJECT, plans: [], unreadablePlans: 0, emptyState: { headline: 'h', body: 'b', actionLabel: 'a' }, ...PRICE_PROPS },
		});

		expect(wrapper.find('.rp-empty-state').exists()).toBe(false);
		expect(wrapper.get('.rp-plan-list__empty').text()).toBe('b');
		expect(wrapper.get('.rp-plan-list__title').element.tagName).toBe('H3');
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
		expect(wrapper.find('.rp-plan-list__empty').exists()).toBe(true);
		expect(wrapper.findAll('.rp-plan-list__row')).toHaveLength(0);
	});

	/**
	 * P12: on `readOnly` (mobile) a zero-plan project used to suppress its empty region ENTIRELY —
	 * `planEmpty` folded `readOnly` into the same null as a failed read — so a mobile project with
	 * no plans drew a bare `Plans` heading and nothing else.
	 *
	 * **The ACTION then stopped being dropped too**, which is the mobile task's own extension 4a:
	 * a label that disappears on one device reads as a state with nothing to do rather than as a
	 * refusal, so it stays drawn, disabled, and pointing at the surface's one notice. Since the
	 * compact row replaced the card, that action is the plan section's own `New plan` — the same
	 * intent the card's button carried.
	 */
	it('keeps the empty plan line and its refused action on a read-only surface', () => {
		const wrapper = mount(ProjectDetail, {
			props: { project: PROJECT, plans: [], unreadablePlans: 0, readOnly: true, readOnlyReasonId: 'rp-1-0', emptyState: { headline: 'h', body: 'b', actionLabel: 'a' }, ...PRICE_PROPS },
		});

		expect(wrapper.find('.rp-plan-list__empty').exists()).toBe(true);
		expect(wrapper.get('.rp-plan-list__create').attributes('disabled')).toBeDefined();
		expect(wrapper.get('.rp-plan-list__create').attributes('aria-describedby')).toBe('rp-1-0');
	});

	/**
	 * A project with no plans is not a project with no way to make one. Asserted on the emit
	 * rather than on the button's presence: a rendered action wired to nothing is exactly the
	 * "live control that does nothing" slice 14's amendment refuses.
	 */
	it('emits createPlan from the plan section’s own action', async () => {
		const wrapper = mount(ProjectDetail, {
			props: { project: PROJECT, plans: [], unreadablePlans: 0, emptyState: { headline: 'h', body: 'b', actionLabel: 'a' }, ...PRICE_PROPS },
		});

		await wrapper.get('.rp-plan-list__create').trigger('click');

		expect(wrapper.emitted('createPlan')).toHaveLength(1);
	});

	/**
	 * The re-emit is what criterion 2 travels through: `PlanList` emits an id, this component
	 * carries it up, and `ViewRoot` calls `context.openPlan`. A component that swallowed it
	 * would compile and do nothing.
	 */
	it('carries a plan row’s id up from PlanList', async () => {
		const wrapper = mount(ProjectDetail, {
			props: { project: PROJECT, plans: [{ id: 'plan-1', name: 'Ground floor', kind: 'floor' as const }], unreadablePlans: 0, emptyState: null, ...PRICE_PROPS },
		});

		await wrapper.get('.rp-plan-list__row').trigger('click');

		expect(wrapper.emitted('openPlan')).toEqual([['plan-1']]);
	});

	/**
	 * **The bare code is what the mockups draw and the sentence is what the accessible name
	 * needs**, so both are rendered and only one is read: the visible half is `aria-hidden` and
	 * the `view.project.currency` sentence is off-screen. "EUR" alone is a word rather than a
	 * fact about this project; "Priced in EUR" beside a name at display size is a caption where
	 * the design asks for a code.
	 */
	it('shows the bare currency code and names it fully for a screen reader', () => {
		const wrapper = mount(ProjectDetail, {
			props: { project: { ...PROJECT, currency: 'GBP' }, plans: [], unreadablePlans: 0, emptyState: null, ...PRICE_PROPS },
		});

		const currency = wrapper.get('.rp-project-detail__currency');
		expect(currency.get('[aria-hidden="true"]').text()).toBe('GBP');
		expect(currency.get('.rp-visually-hidden').text()).toBe(
			t('en', 'view.project.currency', { currency: 'GBP' }),
		);
	});

	/**
	 * **A read that kept nothing and refused something is not an empty project**, which the state
	 * matrix forbids outright ("All plans unreadable | Explain unreadability | Pretending
	 * confirmed emptiness"). A notice saying SOME notes refused, over a list with no rows, says
	 * exactly that: the readable plans it points at do not exist.
	 */
	it.each([
		{ what: 'every plan note refused', rows: [] as { id: string; name: string; kind: 'floor' }[], key: 'view.project.all-plans-unreadable' as const },
		{ what: 'some refused', rows: [{ id: 'plan-1', name: 'Ground floor', kind: 'floor' as const }], key: 'view.project.some-plans-unreadable' as const },
	])('says which unreadable-plan case it is when $what', ({ rows, key }) => {
		const wrapper = mount(ProjectDetail, {
			props: { project: PROJECT, plans: rows, unreadablePlans: 2, emptyState: null, ...PRICE_PROPS },
		});

		expect(wrapper.get('.rp-view-notice').text()).toBe(t('en', key));
	});

	/**
	 * **The retry sits OUTSIDE the live region.** `role="status"` on the wrapper re-announced the
	 * control with the sentence on every re-render; only the sentence changes, so only the
	 * sentence is in the region.
	 */
	it('keeps the plan-read retry out of the live region', () => {
		const wrapper = mount(ProjectDetail, {
			props: { project: PROJECT, plans: [], unreadablePlans: 0, plansFailure: 'nope', emptyState: null, ...PRICE_PROPS },
		});

		expect(wrapper.get('.rp-view-notice p').attributes('role')).toBe('status');
		// The WRAPPER carries no role of its own — which is where it was, and is why the button
		// was re-announced with the sentence on every render.
		expect(wrapper.get('.rp-view-notice').attributes('role')).toBeUndefined();
		expect(wrapper.find('.rp-view-notice button').exists()).toBe(true);
	});

	/**
	 * **The warning is ABOVE the guidance**, which the state matrix requires by name ("Some plans
	 * unreadable | Readable plans plus warning | Guidance concealing warning"). At 460px the three
	 * stacked entry cards push a warning drawn after them below the fold, so the region the user is
	 * told about is the one they cannot see. Asserted as document ORDER rather than as presence,
	 * because presence was already true when the defect existed.
	 */
	it('draws the partial-read warning above the guidance region', () => {
		const wrapper = mount(ProjectDetail, {
			props: { project: PROJECT, plans: [{ id: 'plan-1', name: 'Ground floor', kind: 'floor' as const }], unreadablePlans: 1, emptyState: null, ...PRICE_PROPS },
		});

		const notice = wrapper.get('.rp-view-notice').element;
		const guidance = wrapper.get('.rp-project-guidance').element;
		expect(notice.compareDocumentPosition(guidance) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
	});

	/**
	 * P03 in the detail state: the warning names the miss with an ICON and text rather than with
	 * colour, and the recovery heading is what focus moves to — before it existed the element that
	 * had focus was unmounted by the navigation and the caret fell to `<body>`.
	 */
	it('draws the recovery warning with an icon beside its text', () => {
		const wrapper = mount(ProjectDetail, {
			props: { project: PROJECT, plans: [{ id: 'plan-1', name: 'Ground floor', kind: 'floor' as const }], unreadablePlans: 0, missingPlan: true, emptyState: null, ...PRICE_PROPS },
		});

		expect(wrapper.get('.rp-recovery__warning').text()).toContain(t('en', 'view.project.resume-missing-plan'));
		expect(wrapper.get('.rp-recovery__warning .rp-host-icon').attributes('aria-hidden')).toBe('true');
		expect(wrapper.get('.rp-recovery__title').text()).toBe(t('en', 'view.project.recovery-title'));
	});

	/**
	 * **Focus is CALLED rather than taken at mount**, which is a timing fact rather than a style
	 * one: `missingPlan` is resolved after the store's status reaches `'ready'`, so an
	 * `onMounted` here read it as `false` every time — measured in the recovery capture, which
	 * showed the ring on the project's name. `ProjectDetailState` calls this once its first
	 * hydrate has settled, and only for a navigation.
	 *
	 * Both targets, because the recovery heading outranking the project's own is the whole of
	 * P03's "focus explanation/heading meaningfully, not an unrelated button".
	 */
	it.each([
		{ what: 'the recovery heading after a failed resumption', missingPlan: true, selector: '.rp-recovery__title' },
		{ what: 'the project heading otherwise', missingPlan: false, selector: '.rp-project-detail__name' },
	])('moves focus to $what', ({ missingPlan, selector }) => {
		const wrapper = mount(ProjectDetail, {
			attachTo: document.body,
			props: { project: PROJECT, plans: [{ id: 'plan-1', name: 'Ground floor', kind: 'floor' as const }], unreadablePlans: 0, missingPlan, emptyState: null, ...PRICE_PROPS },
		});
		expect(document.activeElement).toBe(document.body);

		(wrapper.vm as unknown as { focusEntry: () => void }).focusEntry();

		expect(document.activeElement).toBe(wrapper.get(selector).element);
		wrapper.unmount();
	});

	/**
	 * The body scroller's offset travels through the leaf-local session, so a `rebind` remount or
	 * a details/prices round trip does not drop the user to the top. Both halves, because a
	 * restore with nothing saving it is a value nothing writes.
	 */
	it('restores the body scroll it was given and reports every change', async () => {
		const wrapper = mount(ProjectDetail, {
			props: { project: PROJECT, plans: [], unreadablePlans: 0, initialScroll: 120, emptyState: null, ...PRICE_PROPS },
		});
		const body = wrapper.get('.rp-project-detail__body');

		expect(body.element.scrollTop).toBe(120);
		body.element.scrollTop = 45;
		await body.trigger('scroll');

		expect(wrapper.emitted('scrolled')).toEqual([[45]]);
	});

	/**
	 * P02's stated sequence is header then question then three entries then the expanded plan
	 * list, and these two sat between the entries and the plans. Both stay reachable; they are
	 * one region later.
	 */
	it('puts the schedule and quote doors below the plan list', () => {
		const wrapper = mount(ProjectDetail, {
			props: { project: PROJECT, plans: [{ id: 'plan-1', name: 'Ground floor', kind: 'floor' as const }], unreadablePlans: 0, emptyState: null, ...PRICE_PROPS },
		});

		const plans = wrapper.get('.rp-plan-list__section').element;
		const downstream = wrapper.get('.rp-project-detail__body > .rp-project-detail__entry-row').element;
		expect(plans.compareDocumentPosition(downstream) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
		expect(wrapper.findAll('.rp-project-detail__body > .rp-project-detail__entry-row button')).toHaveLength(2);
	});

	/**
	 * The sibling of `planList.test.ts`'s own case, and the same hole: jsdom resolves no CSS,
	 * so a class this template emits and `styles/project-detail.css` never declares draws
	 * nothing while every assertion above stays green. Harvested from the DOM, never
	 * transcribed.
	 */
	it('declares a rule for every class it actually emits', () => {
		// BOTH partials, because the entry-path rules live in `project-entry.css` — a scan that
		// reads one of an element's two homes reports a missing rule for every class in the other.
		const css = [readFileSync('styles/project-detail.css', 'utf8'), readFileSync('styles/project-entry.css', 'utf8')].join('\n');
		const wrapper = mount(ProjectDetail, {
			props: { project: PROJECT, plans: [{ id: 'plan-1', name: 'Ground floor', kind: 'floor' as const }], unreadablePlans: 0, emptyState: null, ...PRICE_PROPS },
		});

		const emitted = new Set(
			wrapper
				.findAll('[class]')
				.flatMap((el) => [...el.element.classList])
				.filter((name) => name.startsWith('rp-project-detail')),
		);

		expect(emitted.size).toBeGreaterThan(4);
		// Asked of the parsed sheet's selectors: a class is a node there, so `.rp-x` is not
		// credited to a sheet declaring only `.rp-x__row`. Reported as the names the sheet lacks.
		const declared = classesNamed(css);

		expect([...emitted].filter((name) => !declared.has(name))).toEqual([]);
	});

	/**
	 * **The BODY owns the scroll, and it is the ONLY region that does.**
	 *
	 * Held by an assertion over the PARSED partial's declarations rather than by the class merely
	 * existing, which is all the harvest case above can say: jsdom resolves no CSS, so a rule one
	 * word off draws wrong with every other case green — this repository has already shipped that
	 * defect once (`rp-save-state-error` against an emitted `rp-save-state-save-error`).
	 *
	 * What it pins was found by CAPTURING the page and looking at it, which is the only
	 * instrument here that can see a position. `.rp-plan-list` used to carry this block because
	 * it was the shell's last child; with the price section after it the shell overflowed and the
	 * last price row was drawn below the pane, clipped, with no scrollbar and no gesture that
	 * reached it. Both halves are asserted, because a build that gave the body the scroll and
	 * left it on the plan list too would have two regions each claiming half the pane's slack —
	 * three plans in a tall empty box above a forty-row list in a short one.
	 *
	 * `min-height: 0` is asserted beside `overflow-y` deliberately: a flex item's default minimum
	 * is its content, so `overflow-y` on its own would be inert and the block would read as
	 * present while doing nothing.
	 */
	it('gives the scroll to the body and to nothing else', () => {
		const rules = stylesheetRules(readFileSync('styles/project-detail.css', 'utf8'));
		const rulesFor = (selector: string) => rules.filter((rule) => rule.selectors.map(show).includes(selector));
		const declared = (selector: string, property: string) =>
			rulesFor(selector).flatMap((rule) => rule.declarations).find((declaration) => propertyOf(declaration) === property);

		expect(rulesFor('.rp-project-detail__body')).toHaveLength(1);
		// `flex: 1` is what the parser reads as grow 1, shrink 1, basis 0%.
		expect(declared('.rp-project-detail__body', 'flex')?.value).toMatchObject({ grow: 1, shrink: 1 });
		expect(declared('.rp-project-detail__body', 'min-height')?.value).toEqual({ type: 'length-percentage', value: { type: 'dimension', value: { unit: 'px', value: 0 } } });
		expect(declared('.rp-project-detail__body', 'overflow-y')?.value).toBe('auto');
		// The plan list's own rules — every block whose selector is exactly `.rp-plan-list`, never
		// a descendant rule's declarations read as if they were this one's.
		expect(rulesFor('.rp-plan-list')).not.toHaveLength(0);
		expect(rulesFor('.rp-plan-list').flatMap((rule) => rule.declarations.map(propertyOf)).filter((property) => property === 'overflow-y' || property === 'flex')).toEqual([]);
	});
});
