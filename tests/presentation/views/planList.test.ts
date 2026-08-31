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

describe('PlanList', () => {
	it('draws one row per plan', () => {
		const wrapper = mount(PlanList, {
			props: {
				plans: [
					{ id: 'plan-1', name: 'Ground floor' },
					{ id: 'plan-2', name: 'First floor' },
				],
			},
		});

		expect(wrapper.findAll('.rp-plan-list__row').map((row) => row.text())).toEqual([
			'Ground floor',
			'First floor',
		]);
	});

	it('emits the plan id a row was clicked for', async () => {
		const wrapper = mount(PlanList, { props: { plans: [{ id: 'plan-1', name: 'Ground floor' }] } });

		await wrapper.get('.rp-plan-list__row').trigger('click');

		expect(wrapper.emitted('open')).toEqual([['plan-1']]);
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
		const wrapper = mount(PlanList, { props: { plans: [{ id: 'plan-1', name: 'Ground floor' }] } });

		const row = wrapper.get('.rp-plan-list__row');
		expect(row.element.tagName).toBe('BUTTON');
		expect(row.attributes('type')).toBe('button');
	});

	/**
	 * `<h3>`, not `<h2>`: this list sits UNDER `ProjectDetail`'s own `<h2>`, and heading order
	 * is one of the five things `tests/harness/accessibility.test.ts` actually grades — so a
	 * second `<h2>` here is an axe `heading-order` violation found by a later task rather than
	 * by this one.
	 */
	it('titles itself one level below the detail header', () => {
		const wrapper = mount(PlanList, { props: { plans: [] } });

		expect(wrapper.get('.rp-plan-list__title').element.tagName).toBe('H3');
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
		const css = readFileSync('styles/project-detail.css', 'utf8');
		const wrapper = mount(PlanList, { props: { plans: [{ id: 'plan-1', name: 'Ground floor' }] } });

		const emitted = new Set(
			wrapper
				.findAll('[class]')
				.flatMap((el) => [...el.element.classList])
				.filter((name) => name.startsWith('rp-plan-list')),
		);

		expect(emitted.size).toBeGreaterThan(4);
		// A trailing boundary, not `toContain`: every class here is a PREFIX of a longer one, so
		// a plain substring test would credit `.rp-x` to a sheet declaring only `.rp-x__row`.
		for (const name of emitted) expect(css).toMatch(new RegExp(`\\.${name}(?![\\w-])`));
	});
});
