/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import ProjectList from '../../../src/presentation/views/ProjectList.vue';
import type { ProjectSummaryDto } from '../../../src/presentation/read-models/PlanDto';

function project(over: Partial<ProjectSummaryDto>): ProjectSummaryDto {
	return {
		id: over.name ?? 'x',
		name: 'x',
		status: 'IDEA',
		currency: 'EUR',
		libraryOverlap: false,
		planCount: 0,
		lastWorked: null,
		...over,
	};
}

const MIXED = [
	project({ name: 'Attic', status: 'COMPLETE' }),
	project({ name: 'Kitchen', status: 'DESIGN', lastWorked: '2026-08-01T00:00:00.000Z' }),
	project({ name: 'Cellar', status: 'AS_BUILT' }),
	project({ name: 'Bathroom', status: 'IDEA', lastWorked: '2026-08-14T00:00:00.000Z' }),
];

describe('ProjectList groups', () => {
	it('draws active projects most recently worked first', () => {
		const wrapper = mount(ProjectList, { props: { projects: MIXED } });
		const names = wrapper
			.findAll('.rp-project-list__group--projects .rp-project-list__name')
			.map((el) => el.text());

		expect(names).toEqual(['Bathroom', 'Kitchen']);
	});

	it('files the two terminal stages into a collapsed group with its count', () => {
		const wrapper = mount(ProjectList, { props: { projects: MIXED } });
		const details = wrapper.find('.rp-project-list__completed');

		// A native `<details>`/`<summary>`, so disclosure state is announced by the HOST rather
		// than reimplemented with ARIA — and it is collapsed by default.
		expect(details.element.tagName).toBe('DETAILS');
		expect(details.attributes('open')).toBeUndefined();
		expect(details.find('summary').text()).toContain('Completed (2)');
		// §11 asks for an `<h3>` per group heading. Without one this group is absent from
		// assistive-technology heading navigation while its two siblings are listed — the one
		// group whose contents are hidden by default being also the one nobody can navigate to.
		expect(details.find('summary h3').exists()).toBe(true);
	});

	it('omits a group entirely when it holds nothing', () => {
		const wrapper = mount(ProjectList, { props: { projects: [project({ name: 'Only' })] } });

		expect(wrapper.find('.rp-project-list__completed').exists()).toBe(false);
	});

	it('omits the Projects group when every project is completed', () => {
		const wrapper = mount(ProjectList, {
			props: { projects: [project({ name: 'Done', status: 'COMPLETE' })] },
		});

		expect(wrapper.find('.rp-project-list__group--projects').exists()).toBe(false);
		expect(wrapper.find('.rp-project-list__completed').exists()).toBe(true);
	});

	it('titles each group at h3, the level the detail state already uses', () => {
		const wrapper = mount(ProjectList, { props: { projects: MIXED } });

		// Heading order is what the accessibility scan checks, and the pane's own `<h2>` is the
		// only title it has — the leaf's own header is hidden for this view type.
		expect(wrapper.find('.rp-project-list__title').element.tagName).toBe('H2');
		expect(wrapper.find('.rp-project-list__group--projects h3').exists()).toBe(true);
	});

	it('emits open with a completed row’s own id, same as an active one', async () => {
		// The completed group's `<ProjectRow>` re-emits through its own template arrow, a
		// separate binding from the active group's — this is what exercises it rather than
		// leaving it reachable only in principle.
		const wrapper = mount(ProjectList, { props: { projects: MIXED } });

		await wrapper.get('.rp-project-list__completed .rp-project-list__row').trigger('click');

		expect(wrapper.emitted('open')).toEqual([['Attic']]);
	});

	/**
	 * `completedOpen` is declared here rather than in Task 8, which is what actually reads it
	 * for roving focus — so this task's own case is the one exercising the `@toggle` handler
	 * that writes it. `details.element.open = true` first, because that is what the BROWSER
	 * does before dispatching `toggle` on a real disclosure gesture; the handler then reads
	 * that state off `$event.target`.
	 */
	it('tracks the Completed group’s disclosure state on toggle', async () => {
		const wrapper = mount(ProjectList, { props: { projects: MIXED } });
		const details = wrapper.get('.rp-project-list__completed');
		expect((wrapper.vm as unknown as { completedOpen: boolean }).completedOpen).toBe(false);

		(details.element as HTMLDetailsElement).open = true;
		await details.trigger('toggle');

		expect((wrapper.vm as unknown as { completedOpen: boolean }).completedOpen).toBe(true);
	});
});
