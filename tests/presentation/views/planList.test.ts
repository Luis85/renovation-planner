/**
 * @vitest-environment jsdom
 *
 * One project's plans (design slice 21). The component DRAWS and EMITS: it opens nothing and
 * dispatches nothing, so every case here asks what was rendered or what was emitted, never
 * what happened to a plan.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import PlanList from '../../../src/presentation/views/PlanList.vue';
import type { PlanSummaryDto } from '../../../src/presentation/read-models/PlanDto';
import { classesNamed } from '../../helpers/selectors';

describe('PlanList', () => {
	it('draws one row per plan', () => {
		const wrapper = mount(PlanList, {
			props: {
				plans: [
					{ id: 'plan-1', name: 'Ground floor', kind: 'floor' },
					{ id: 'plan-2', name: 'First floor', kind: 'floor' },
				],
			},
		});

		expect(wrapper.findAll('.rp-plan-list__row').map((row) => row.text())).toEqual([
			'Ground floor',
			'First floor',
		]);
	});

	it('emits the plan id a row was clicked for', async () => {
		const wrapper = mount(PlanList, { props: { plans: [{ id: 'plan-1', name: 'Ground floor', kind: 'floor' }] } });

		await wrapper.get('.rp-plan-list__row').trigger('click');

		expect(wrapper.emitted('open')).toEqual([['plan-1']]);
	});

	/**
	 * The row's Delete is a SECOND button in the item rather than anything inside the row: a
	 * button inside a button is a nested interactive element, which is the same rule that keeps
	 * `New plan` outside the `<summary>`.
	 */
	it('emits the plan a row Delete was clicked for, and never open', async () => {
		const wrapper = mount(PlanList, { props: { plans: [{ id: 'plan-1', name: 'Ground floor', kind: 'floor' }] } });

		await wrapper.get('.rp-plan-list__delete').trigger('click');

		expect(wrapper.emitted('delete')).toEqual([['plan-1', 'Ground floor']]);
		expect(wrapper.emitted('open')).toBeUndefined();
	});

	/**
	 * Icon-only, so the `aria-label` is its whole accessible name — and it NAMES THE PLAN,
	 * because a list of rows each announced as `Delete` gives a screen-reader user no way to
	 * tell which one the caret is on.
	 */
	it('names the plan in each Delete button accessible name', () => {
		const wrapper = mount(PlanList, {
			props: {
				plans: [
					{ id: 'plan-1', name: 'Ground floor', kind: 'floor' },
					{ id: 'plan-2', name: 'First floor', kind: 'floor' },
				],
			},
		});

		expect(wrapper.findAll('.rp-plan-list__delete').map((button) => button.attributes('aria-label')))
			.toEqual(['Delete plan Ground floor', 'Delete plan First floor']);
	});

	it('disables Delete on a read-only surface, beside the row it belongs to', () => {
		const wrapper = mount(PlanList, {
			props: { plans: [{ id: 'plan-1', name: 'Ground floor', kind: 'floor' }], readOnly: true, readOnlyReasonId: 'why' },
		});

		const button = wrapper.get('.rp-plan-list__delete');
		expect(button.attributes('disabled')).toBeDefined();
		expect(button.attributes('aria-describedby')).toBe('why');
	});

	it('emits create from its header button', async () => {
		const wrapper = mount(PlanList, { props: { plans: [] } });

		await wrapper.get('.rp-plan-list__create').trigger('click');

		expect(wrapper.emitted('create')).toHaveLength(1);
	});

	/**
	 * `ProjectList`'s own sibling case, for the same reason: a div with a click handler is
	 * neither focusable nor announced, and there is no href here, so a link would be wrong in
	 * the other direction.
	 */
	it('gives every row a real button, not a clickable div', () => {
		const wrapper = mount(PlanList, { props: { plans: [{ id: 'plan-1', name: 'Ground floor', kind: 'floor' }] } });

		const row = wrapper.get('.rp-plan-list__row');
		expect(row.element.tagName).toBe('BUTTON');
		expect(row.attributes('type')).toBe('button');
	});

	/**
	 * `<h3>`, not `<h2>`: this list sits UNDER `ProjectDetail`'s own `<h2>`, and the document
	 * outline is the reason — a plans list titled as a PEER of the project it belongs to
	 * misdescribes the page to anyone navigating by headings.
	 *
	 * **This assertion is the only instrument for it, and the sentence here used to promise a
	 * second one.** It said an `<h2>` would be "an axe `heading-order` violation found by a
	 * later task": measured false in two files on this branch — axe's `heading-order` reports
	 * a SKIPPED level (`h2` → `h4`), and an `<h2>` under an `<h2>` is a peer, so every case in
	 * `tests/harness/accessibility.test.ts` stays green with the level deleted. Naming a
	 * downstream check that cannot fire is worse than naming none: it reads as a second
	 * instrument and is a comment. Found by the whole-branch review, one round after
	 * `projectDetail.test.ts` recorded the measurement that refutes it.
	 */
	it('titles itself one level below the detail header', () => {
		const wrapper = mount(PlanList, { props: { plans: [] } });

		expect(wrapper.get('.rp-plan-list__title').element.tagName).toBe('H3');
	});

	/**
	 * **A native `<details>`, open by default** — P02's "Plans initially visible" and its optional
	 * "Collapse plans" in one element, with `aria-expanded`, keyboard operation and the open state
	 * supplied by the browser. `components/component-library.md` names the mechanism outright:
	 * "existing native details/summary is valid".
	 *
	 * `New plan` sits on the summary's line and OUTSIDE the `<summary>`, because a button inside
	 * one is the nested interactive element P02 forbids by name.
	 */
	it('is a native disclosure, open, with the create action outside its summary', () => {
		const wrapper = mount(PlanList, { props: { plans: [{ id: 'plan-1', name: 'Ground floor', kind: 'floor' }] } });

		const disclosure = wrapper.get<HTMLDetailsElement>('.rp-plan-list__disclosure');
		expect(disclosure.element.tagName).toBe('DETAILS');
		expect(disclosure.element.open).toBe(true);
		expect(wrapper.get('.rp-plan-list__summary').element.tagName).toBe('SUMMARY');
		expect(wrapper.find('.rp-plan-list__summary button').exists()).toBe(false);
		expect(wrapper.find('.rp-plan-list__section > .rp-plan-list__create').exists()).toBe(true);
	});

	/**
	 * The counted form once there is something to count and the bare noun otherwise — P02 draws
	 * `Plans (3)` and P01 draws `Plans`. "Plans (0)" states an emptiness the line under it already
	 * states.
	 */
	it.each([
		{ what: 'nothing', plans: [] as PlanSummaryDto[], title: 'Plans' },
		{ what: 'two plans', plans: [{ id: 'a', name: 'A', kind: 'floor' as const }, { id: 'b', name: 'B', kind: 'floor' as const }], title: 'Plans (2)' },
	])('heads the section for $what', ({ plans, title }) => {
		const wrapper = mount(PlanList, { props: { plans } });

		expect(wrapper.get('.rp-plan-list__title').text()).toBe(title);
	});

	/**
	 * **The hole jsdom cannot see, and this repository has already paid for once**
	 * (`rp-save-state-error` against a template emitting `rp-save-state-save-error`): jsdom
	 * resolves no CSS, so a class the template emits and no partial declares renders unstyled
	 * with every other case still green.
	 *
	 * The class list is HARVESTED from the mounted DOM rather than transcribed, so renaming one
	 * in the template fails here instead of quietly shipping an unstyled row.
	 */
	it('declares a rule for every class it actually emits', () => {
		// `plan-list.css`, not `project-detail.css`: the rules moved into their own partial when
		// the row's Delete took that file past the assembler's 400-line cap, and this read is the
		// one thing that would have gone on passing against the file they left.
		const css = readFileSync('styles/plan-list.css', 'utf8');
		const wrapper = mount(PlanList, { props: { plans: [{ id: 'plan-1', name: 'Ground floor', kind: 'floor' }] } });

		const emitted = new Set(
			wrapper
				.findAll('[class]')
				.flatMap((el) => [...el.element.classList])
				.filter((name) => name.startsWith('rp-plan-list')),
		);

		expect(emitted.size).toBeGreaterThan(4);
		// Asked of the parsed sheet's selectors: a class is a node there, so `.rp-x` is not
		// credited to a sheet declaring only `.rp-x__row`. Reported as the names the sheet lacks.
		const declared = classesNamed(css);

		expect([...emitted].filter((name) => !declared.has(name))).toEqual([]);
	});
});
