/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import ProjectRow from '../../../src/presentation/views/ProjectRow.vue';
import type { ProjectSummaryDto } from '../../../src/presentation/read-models/PlanDto';

const PROJECT: ProjectSummaryDto = {
	id: 'p1',
	name: 'House Renovation 2026',
	status: 'DESIGN',
	currency: 'EUR',
	libraryOverlap: false,
	planCount: 2,
	lastWorked: '2026-08-14T00:00:00.000Z',
};

function row(overrides: Partial<ProjectSummaryDto> = {}) {
	return mount(ProjectRow, { props: { project: { ...PROJECT, ...overrides } } });
}

describe('ProjectRow', () => {
	it('names the project and carries the full name in title, so a truncated one is readable', () => {
		const wrapper = row();

		expect(wrapper.find('.rp-project-list__name').text()).toBe('House Renovation 2026');
		expect(wrapper.find('.rp-project-list__name').attributes('title')).toBe('House Renovation 2026');
	});

	it('states the plan count and the currency in the facts slot', () => {
		expect(row().find('.rp-project-row__facts').text()).toContain('2 plans');
		expect(row().find('.rp-project-row__facts').text()).toContain('EUR');
	});

	/**
	 * `t` has no plural machinery, so the count is picked at the component — and the English
	 * singular SPELLS THE NUMERAL OUT (`One plan`, not `1 plan`), which is the shape
	 * `view.project.plans-one` actually has and the reason this assertion is not the obvious
	 * one. `en.ts` records why at the key: `obsidianmd/ui/sentence-case-locale-module` reads a
	 * leading bare digit as non-content and then demands a capital on the noun after it.
	 *
	 * Asserted against the literal rather than against `en[...]` deliberately: a regression to
	 * `plans-many` would render `1 plan` and pass a comparison sourced from whichever key the
	 * component happened to reach.
	 */
	it('picks the singular plan key at one, because t has no plural machinery', () => {
		expect(row({ planCount: 1 }).find('.rp-project-row__facts').text()).toContain('One plan');
	});

	it('renders nothing at all for a slot with nothing in it', () => {
		// The governing content rule: the row must look complete today, not like a card with
		// holes. No dash, no em-dash, no skeleton, no "not yet calculated".
		const text = row({ planCount: 0 }).find('.rp-project-row__facts').text();

		expect(text).not.toContain('0 plans');
		expect(text).not.toContain('—');
		// And the neighbours close up rather than leaving the separator behind: `· EUR` is what
		// a slot that renders nothing but still joins would produce, and it reads as a hole.
		expect(text).toBe('EUR');
	});

	it('draws the status word and marks the cells up to its stage', () => {
		const wrapper = row();

		expect(wrapper.find('.rp-project-row__status').text()).toContain('Design');
		expect(wrapper.findAll('.rp-project-row__tick')).toHaveLength(10);
		// DESIGN is stage 2, so three cells are reached — up to AND INCLUDING the current one.
		expect(wrapper.findAll('.rp-project-row__tick--reached')).toHaveLength(3);
	});

	it('hides the strip from assistive technology, leaving the word as the whole name', () => {
		expect(row().find('.rp-project-row__ticks').attributes('aria-hidden')).toBe('true');
		expect(row().find('.rp-project-row__ticks').text()).toBe('');
	});

	it('draws no strip for a status this build cannot place', () => {
		// A strip at stage 0 would say IDEA about a project nobody established a stage for.
		const wrapper = row({ status: 'PLANNING' });

		expect(wrapper.find('.rp-project-row__status').text()).toContain('PLANNING');
		expect(wrapper.find('.rp-project-row__ticks').exists()).toBe(false);
	});

	it('keeps the §83 marker after the status', () => {
		const wrapper = row({ libraryOverlap: true });
		const html = wrapper.html();

		expect(wrapper.find('.rp-project-list__overlap').exists()).toBe(true);
		expect(html.indexOf('rp-project-list__status')).toBeLessThan(html.indexOf('rp-project-list__overlap'));
	});

	it('emits open with its own id', async () => {
		const wrapper = row();

		await wrapper.find('.rp-project-list__row').trigger('click');

		expect(wrapper.emitted('open')).toEqual([['p1']]);
	});
});
