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
		const wrapper = mount(ProjectList, { props: { projects: MIXED, unreadable: 0 } });
		const names = wrapper
			.findAll('.rp-project-list__group--projects .rp-project-list__name')
			.map((el) => el.text());

		expect(names).toEqual(['Bathroom', 'Kitchen']);
	});

	it('files the two terminal stages into a collapsed group with its count', () => {
		const wrapper = mount(ProjectList, { props: { projects: MIXED, unreadable: 0 } });
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
		const wrapper = mount(ProjectList, { props: { projects: [project({ name: 'Only' })], unreadable: 0 } });

		expect(wrapper.find('.rp-project-list__completed').exists()).toBe(false);
	});

	it('omits the Projects group when every project is completed', () => {
		const wrapper = mount(ProjectList, {
			props: { projects: [project({ name: 'Done', status: 'COMPLETE' })], unreadable: 0 },
		});

		expect(wrapper.find('.rp-project-list__group--projects').exists()).toBe(false);
		expect(wrapper.find('.rp-project-list__completed').exists()).toBe(true);
	});

	it('titles each group at h3, the level the detail state already uses', () => {
		const wrapper = mount(ProjectList, { props: { projects: MIXED, unreadable: 0 } });

		// Heading order is what the accessibility scan checks, and the pane's own `<h2>` is the
		// only title it has — the leaf's own header is hidden for this view type.
		expect(wrapper.find('.rp-project-list__title').element.tagName).toBe('H2');
		expect(wrapper.find('.rp-project-list__group--projects h3').exists()).toBe(true);
	});

	it('emits open with a completed row’s own id, same as an active one', async () => {
		// The completed group's `<ProjectRow>` re-emits through its own template arrow, a
		// separate binding from the active group's — this is what exercises it rather than
		// leaving it reachable only in principle.
		const wrapper = mount(ProjectList, { props: { projects: MIXED, unreadable: 0 } });

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
		const wrapper = mount(ProjectList, { props: { projects: MIXED, unreadable: 0 } });
		const details = wrapper.get('.rp-project-list__completed');
		expect((wrapper.vm as unknown as { completedOpen: boolean }).completedOpen).toBe(false);

		(details.element as HTMLDetailsElement).open = true;
		await details.trigger('toggle');

		expect((wrapper.vm as unknown as { completedOpen: boolean }).completedOpen).toBe(true);
	});

	/**
	 * **The Continue group is not filtered.** It is an ACTION rather than a member of the
	 * index, so a query that excludes its project still leaves it offered — and its own row
	 * says which project it is, so nothing is ambiguous. The opposite is the reflex, so this
	 * pins it rather than leaving it to be assumed.
	 */
	it('offers the Continue row regardless of the filter', () => {
		const wrapper = mount(ProjectList, {
			props: {
				projects: MIXED,
				unreadable: 0,
				continueProject: { project: MIXED[1], planId: null, plan: null },
			},
		});

		expect(wrapper.find('.rp-project-list__continue').exists()).toBe(true);
	});

	it('renders the Continue row INSIDE a .rp-project-list, like every other row', () => {
		const wrapper = mount(ProjectList, {
			props: {
				projects: MIXED,
				unreadable: 0,
				continueProject: { project: MIXED[1], planId: null, plan: null },
			},
		});

		// Every shared row declaration is scoped `.rp-project-list .rp-project-list__row` — the
		// descendant selector that beats Obsidian's own `button:not(.clickable-icon)`. Outside
		// that ancestor the row gets no flex, no width, no padding and no 24px floor, and the
		// "same armature" claim is false in the one place it is made. jsdom resolves no CSS, so
		// this asserts the STRUCTURE the selector needs rather than the result.
		//
		// `wrapper.element.querySelector`, deliberately not `wrapper.find`: `ProjectList` has
		// SEVERAL top-level template elements, so VTU treats each as its own root and runs
		// `querySelectorAll` scoped to it — and jsdom's selector engine cannot resolve a
		// three-compound descendant chain (`.a .b .c`) when the first compound is the scope root
		// itself, dropping to zero matches even though the same selector run against the whole
		// mounted container (or a real browser) finds the row. Measured directly: a two-compound
		// version of the identical shape (`.rp-project-list__group--projects .rp-project-list__name`,
		// used elsewhere in this file) resolves fine, and a minimal three-element reproduction
		// outside this component reproduces the same drop to zero. `wrapper.element` is the whole
		// mounted container for a multi-root component, so a query against it is not scoped to any
		// one fragment root and sidesteps the engine limitation rather than working around it with
		// a weaker selector.
		expect(
			wrapper.element.querySelector('.rp-project-list__continue .rp-project-list .rp-continue'),
		).not.toBeNull();
	});
});
