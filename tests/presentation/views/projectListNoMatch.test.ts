/**
 * @vitest-environment jsdom
 *
 * The signature interaction (design spec §3, §7's `Filtered to nothing` row): a query that
 * matches no project offers to BECOME the project the user was looking for, rather than
 * dead-ending in a bare "no results" line.
 */
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import ProjectList from '../../../src/presentation/views/ProjectList.vue';
import type { ProjectSummaryDto } from '../../../src/presentation/read-models/PlanDto';

const PROJECTS: ProjectSummaryDto[] = [
	{
		id: 'p1',
		name: 'Kitchen',
		status: 'IDEA',
		currency: 'EUR',
		libraryOverlap: false,
		planCount: 1,
		lastWorked: null,
	},
];

async function filteredToNothing() {
	const wrapper = mount(ProjectList, { props: { projects: PROJECTS, unreadable: 0 } });
	await wrapper.find('.rp-project-filter__input').setValue('Cellar conversion');
	return wrapper;
}

describe('ProjectList filtered to nothing', () => {
	it('says so, naming the query', async () => {
		const wrapper = await filteredToNothing();

		expect(wrapper.find('.rp-project-list__no-match').text()).toContain(
			'No project matches “Cellar conversion”.',
		);
	});

	it('draws no group at all rather than an empty one', async () => {
		const wrapper = await filteredToNothing();

		expect(wrapper.find('.rp-project-list__group--projects').exists()).toBe(false);
		expect(wrapper.findAll('.rp-project-list__row')).toHaveLength(0);
	});

	it('is NEVER the empty state', async () => {
		const wrapper = await filteredToNothing();

		// `renovationProject.noProjects` says "create your first project" and this vault has
		// one. The empty state is a claim about the VAULT; this is a claim about the QUERY.
		expect(wrapper.find('.rp-empty-state').exists()).toBe(false);
	});

	it('offers to become the project the query names', async () => {
		const wrapper = await filteredToNothing();

		expect(wrapper.find('.rp-project-list__create-named').text()).toBe(
			'New project named “Cellar conversion”',
		);
	});

	it('emits create carrying the typed text, so the form opens pre-filled', async () => {
		const wrapper = await filteredToNothing();

		await wrapper.find('.rp-project-list__create-named').trigger('click');

		// The signature interaction: the dead end becomes the fastest path to the thing the
		// user was looking for and did not have.
		expect(wrapper.emitted('create')).toEqual([['Cellar conversion']]);
	});

	it('clears the filter and restores every row', async () => {
		const wrapper = await filteredToNothing();

		await wrapper.find('.rp-project-list__clear-filter').trigger('click');

		expect(wrapper.findAll('.rp-project-list__row')).toHaveLength(1);
		expect(wrapper.find('.rp-project-list__no-match').exists()).toBe(false);
	});

	it('emits an empty name from the header button, which opens an empty form', async () => {
		const wrapper = mount(ProjectList, { props: { projects: PROJECTS, unreadable: 0 } });

		await wrapper.find('.rp-project-list__create').trigger('click');

		expect(wrapper.emitted('create')).toEqual([['']]);
	});
});
