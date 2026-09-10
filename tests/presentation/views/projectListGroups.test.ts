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
		expect(details.find('summary').text()).toContain('Completed projects (2)');
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
	 * **A SEARCH REVEALS MATCHING COMPLETED PROJECTS** (P00's layout item 5), and the defect this
	 * closes was silent and complete: `completedOpen` was seeded from the session and nothing
	 * watched the query, so a query matching only a completed project rendered a COLLAPSED group,
	 * no rows and no explanation — while the filter line beside it read `1 of 4`. The one state
	 * the pane was telling the truth about was the one the user could not see.
	 *
	 * Driven through the real input rather than by setting a ref, because `query` is this
	 * component's own internal state written only by `ProjectFilter`'s `@update:query`.
	 */
	it('reveals matching completed projects during a search', async () => {
		const wrapper = mount(ProjectList, { props: { projects: MIXED, unreadable: 0 } });

		expect(wrapper.get('.rp-project-list__completed').attributes('open')).toBeUndefined();

		await wrapper.get('.rp-project-filter__input').setValue('Attic');

		const details = wrapper.get('.rp-project-list__completed');

		expect(details.attributes('open')).toBeDefined();
		expect(details.findAll('.rp-project-list__name').map((el) => el.text())).toEqual(['Attic']);
		// The contrast that makes the reveal worth anything: the group the query narrowed to
		// nothing is gone, so the only rows on screen are the ones inside the disclosure.
		expect(wrapper.find('.rp-project-list__group--projects').exists()).toBe(false);
	});

	/**
	 * **THE REVEAL DOES NOT WRITE THE PREFERENCE, which is the half a naive fix loses.** Binding
	 * `:open` to `completedOpen || queryIsNonEmpty` is easy; the trap is that the `<details>`
	 * element fires `toggle` when that binding changes under it, indistinguishably from a user's
	 * click — so a handler that recorded every toggle would leave the group expanded forever
	 * after one search, on a preference the user never expressed and which the session then
	 * persists across remounts.
	 *
	 * Asserted on `completedOpen` — the ref the session snapshot is taken from — rather than on
	 * the element, because the element is SUPPOSED to be open here. The two disagreeing is the
	 * whole point of there being two.
	 */
	it('reveals without recording a preference the user never expressed', async () => {
		const wrapper = mount(ProjectList, { props: { projects: MIXED, unreadable: 0 } });
		const open = (): boolean => (wrapper.vm as unknown as { completedOpen: boolean }).completedOpen;

		await wrapper.get('.rp-project-filter__input').setValue('Attic');
		await wrapper.get('.rp-project-list__completed').trigger('toggle');

		expect(wrapper.get('.rp-project-list__completed').attributes('open')).toBeDefined();
		expect(open()).toBe(false);

		// And clearing the query puts it back where the preference says, rather than leaving the
		// reveal behind as a sticky expansion.
		await wrapper.get('.rp-project-filter__input').setValue('');

		expect(wrapper.get('.rp-project-list__completed').attributes('open')).toBeUndefined();
	});

	/**
	 * `focusFirstRow` READS THE REVEAL, not the preference, and the two differ during a search.
	 * Arrowing down from the filter fell through to `return false` while the rows it would have
	 * reached were on screen — so the key did nothing, which is the worst of the three possible
	 * behaviours because it looks like the surface has no keyboard model at all.
	 */
	it('arrows from the filter into the revealed completed rows', async () => {
		const wrapper = mount(ProjectList, { props: { projects: MIXED, unreadable: 0 }, attachTo: document.body });

		await wrapper.get('.rp-project-filter__input').setValue('Attic');
		await wrapper.get('.rp-project-filter__input').trigger('keydown', { key: 'ArrowDown' });

		expect((document.activeElement as HTMLElement).dataset.projectId).toBe('Attic');
		wrapper.unmount();
	});

	/**
	 * P00'S COLUMN HEADING STRIP, and the two things it must NOT become. It is presentational
	 * chrome above the rows: `aria-hidden` keeps it out of the accessibility tree (each row's
	 * accessible name already carries its own facts, and a heading read before every row is
	 * noise), and it adds no focusable element, because P00's own image clarifications refuse a
	 * new table/keyboard model — §7's roving tabindex over `<button>`s in a `<ul>` is the model.
	 *
	 * Both halves, and the count: five headings for the five named tracks, which is what the
	 * shared `--rp-project-columns` track list is built around.
	 */
	it('heads the wide columns without becoming a table or a focus stop', () => {
		const wrapper = mount(ProjectList, { props: { projects: MIXED, unreadable: 0 } });
		const strip = wrapper.get('.rp-project-list__columns');

		expect(strip.attributes('aria-hidden')).toBe('true');
		expect(strip.findAll('.rp-project-list__column').map((el) => el.text()))
			.toEqual(['Project', 'Plans', 'Currency', 'Status', 'Last worked']);
		expect(strip.findAll('button, a, input, [tabindex]')).toHaveLength(0);
		// The rows stay buttons in a list — no `<table>` and no `role="grid"` came with it.
		expect(wrapper.findAll('table')).toHaveLength(0);
		expect(wrapper.get('.rp-project-list__group--projects .rp-project-list').element.tagName).toBe('UL');
	});

	/**
	 * **The Continue group is not filtered.** It is an ACTION rather than a member of the
	 * index, so a query that excludes its project still leaves it offered — and its own row
	 * says which project it is, so nothing is ambiguous. The opposite is the reflex, so this
	 * pins it rather than leaving it to be assumed.
	 *
	 * The filter has to actually be DRIVEN, not merely absent from the mount: `query` is this
	 * component's own internal `ref('')`, written only by `ProjectFilter`'s `@update:query`, so
	 * a case that never types anything leaves `matchesQuery` passing everything and would read
	 * identically whether or not the Continue group were filtered — pinning nothing. `zzzz`
	 * matches none of `MIXED`, which is what makes `Projects` empty the CONTRAST this case is
	 * about: Continue stands while the index-backed group it sits beside does not.
	 */
	it('offers the Continue row regardless of the filter', async () => {
		const wrapper = mount(ProjectList, {
			props: {
				projects: MIXED,
				unreadable: 0,
				continueProject: { project: MIXED[1], planId: null, plan: null },
			},
		});

		await wrapper.get('.rp-project-filter__input').setValue('zzzz');

		expect(wrapper.find('.rp-project-list__continue').exists()).toBe(true);
		expect(wrapper.find('.rp-project-list__group--projects').exists()).toBe(false);
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
