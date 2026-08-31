/**
 * @vitest-environment jsdom
 *
 * PRD §83's third enforcement site, which is the one with no door.
 *
 * A library folder and a project folder may neither be equal nor contain one another. Two
 * places can REFUSE — the library-folder setting and project creation — and the third cannot:
 * ADR-0013 derives a project's folder from where its own `Project.md` sits, so a user moves a
 * project by dragging a folder in Obsidian's file explorer, and no command is dispatched for
 * anything to decline. Deleting a project deletes its folder, so a project folder that has
 * come to contain the library would take every project's shared catalogues with it. This
 * marker is the whole of what the user is told, which is why it is graded here rather than
 * left to the row's existing cases.
 *
 * TWO contracts, and a green on one of them says nothing about the other:
 *
 * - SDD §85 refuses status carried by COLOUR alone, and
 *   `docs/components/Save-state indicator.md` puts it harder — "A mark and a word. Both,
 *   always, never one", recording that a coloured dot "works perfectly for the author who
 *   built it". A word alone is that same trade made in the other direction, so both halves
 *   are asserted: the WORD in the DOM (jsdom resolves no CSS, so that is the half a mounted
 *   component can answer) and the MARK in the assembled stylesheet.
 * - The stylesheet half asserts a LOAD-BEARING declaration rather than the selector's
 *   existence. A rule declaring nothing but `content: ''` satisfies "the stylesheet declares
 *   this class" while drawing NOTHING at all — the first draft of that block was exactly
 *   that, and the row would have shipped as a styled word. `border-bottom` is what gives the
 *   pseudo-element a box, so it is what is asserted; watched red by reducing the rule to
 *   `content: ''`.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import ProjectList from '../../../src/presentation/views/ProjectList.vue';
import { en } from '../../../src/presentation/i18n/locales/en';
import type { ProjectSummaryDto } from '../../../src/presentation/read-models/PlanDto';

const KITCHEN: ProjectSummaryDto = { id: 'p1', name: 'Kitchen', status: 'IDEA', libraryOverlap: false };

const listOf = (...projects: readonly ProjectSummaryDto[]) => mount(ProjectList, { props: { projects } });

describe('the §83 library-overlap marker on a project row', () => {
	it('marks a row whose project overlaps the library', () => {
		const list = listOf({ ...KITCHEN, libraryOverlap: true });

		expect(list.find('.rp-project-list__overlap').exists()).toBe(true);
	});

	it('leaves an ordinary row unmarked', () => {
		const list = listOf(KITCHEN);

		expect(list.find('.rp-project-list__overlap').exists()).toBe(false);
	});

	/**
	 * The WORD half. Asserted against `en` rather than against a literal typed here, so a
	 * marker rendering some other key — or the raw key itself — fails rather than passing on
	 * a string that merely happens to be non-empty.
	 */
	it('carries a word beside the mark, not a colour alone', () => {
		const list = listOf({ ...KITCHEN, libraryOverlap: true });

		expect(list.get('.rp-project-list__overlap').text()).toBe(en['view.project.library-overlap']);
	});

	/**
	 * Only the row that overlaps is marked. A `v-if` accidentally written outside the `v-for`
	 * — or bound to something the whole list shares — would still satisfy both cases above.
	 */
	it('marks the overlapping row and not its neighbour', () => {
		const list = listOf(KITCHEN, { id: 'p2', name: 'Bathroom', status: 'IDEA', libraryOverlap: true });

		const rows = list.findAll('.rp-project-list__row');

		expect(rows[0].find('.rp-project-list__overlap').exists()).toBe(false);
		expect(rows[1].find('.rp-project-list__overlap').exists()).toBe(true);
	});
});

/**
 * jsdom resolves no CSS, so a class the template interpolates and no stylesheet declares
 * renders as an unstyled word with every mounted case still green — the hole
 * `saveStateIndicator.test.ts` closes for the save-state mark, closed here for this one.
 */
describe('the mark the §85 contract requires beside the word', () => {
	const css = readFileSync('styles/project-list-overlap.css', 'utf8');

	it('declares the marker class the template reaches for', () => {
		expect(css).toContain('.rp-project-list__overlap {');
	});

	it('draws a mark, not only a styled word', () => {
		const glyph = css.slice(css.indexOf('.rp-project-list__overlap::before'));

		// `border-bottom` is what makes the triangle visible: without it the pseudo-element
		// is a zero-sized box with empty content and draws nothing at all, which is what a
		// bare `content: ''` rule would ship while satisfying the case above.
		expect(glyph).toMatch(/border-bottom:/);
	});

	/**
	 * SDD §84: a themed vault stays themed. The assembler already fails the build on a
	 * literal colour, so this asserts the positive — that the mark takes its colour from an
	 * Obsidian variable — rather than restating a gate that already exists.
	 */
	it('takes its colour from an Obsidian variable', () => {
		expect(css).toContain('var(--text-warning)');
	});

	/**
	 * The marker is a THIRD flex item on a `space-between` row, which redistributes the status
	 * label away from the right edge unless the name takes the slack — so marked rows put their
	 * status wherever their own name length left it, and no two rows in the list agreed. Found
	 * by capturing the page and looking at it (`npm run harness-shot`), which is the only
	 * instrument here that can see a position; asserted as TEXT because jsdom lays nothing out,
	 * so this pins the rule against a silent removal rather than measuring the layout.
	 */
	it('lets the name take the slack, so a marked row does not move the status', () => {
		const forms = readFileSync('styles/forms.css', 'utf8');

		expect(forms.slice(forms.indexOf('.rp-project-list__name {'))).toMatch(/flex-grow: 1;/);
	});

	it('is assembled into the shipped sheet', () => {
		expect(readFileSync('styles/index.css', 'utf8')).toContain('project-list-overlap.css');
	});
});
