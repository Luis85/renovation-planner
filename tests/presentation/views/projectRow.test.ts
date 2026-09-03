/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import ProjectRow from '../../../src/presentation/views/ProjectRow.vue';
import { nameCollator } from '../../../src/presentation/views/projectOrder';
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

/**
 * The collator is handed IN rather than built here, which is what the component requires: it is
 * a required prop precisely so that thirty rows share the one `ProjectList` hoists rather than
 * constructing thirty per keystroke.
 */
const collator = nameCollator('en');

function row(overrides: Partial<ProjectSummaryDto> = {}, query?: string) {
	return mount(ProjectRow, { props: { project: { ...PROJECT, ...overrides }, collator, query } });
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

	/**
	 * WEIGHT, never colour — `.rp-project-row__match` carries `--font-semibold` and no colour of
	 * its own, which `projectListStyles.test.ts` asserts at the sheet. Here the claim is about
	 * the RUNS: the marked one holds the name's own characters, umlaut and all, even though the
	 * query that found it had none.
	 */
	it('marks the matched run by weight, keeping the name’s own characters', () => {
		const wrapper = mount(ProjectRow, {
			props: { project: { ...PROJECT, name: 'Küche' }, collator: nameCollator('de'), query: 'kuche' },
		});

		expect(wrapper.find('.rp-project-row__match').text()).toBe('Küche');
		expect(wrapper.find('.rp-project-list__name').text()).toBe('Küche');
	});

	/**
	 * The runs must not GAIN a character either. Vue's default `whitespace: 'condense'` drops
	 * whitespace between two elements when it contains a newline, which is why the `<span>`s are
	 * written with none between their tags — this is the `ZonePanelprototype` defect read from
	 * the other side.
	 *
	 * `element.textContent` rather than `.text()`, and that is the whole reason the case can see
	 * anything: vue-test-utils TRIMS, so the run `'House '` reads as `'House'` and a rendering
	 * that dropped the separating space would pass. Measured — the first draft of this case did
	 * exactly that.
	 */
	it('splits a mid-name match into three runs without moving a character', () => {
		const wrapper = row({ name: 'House Renovation' }, 'reno');

		expect(
			wrapper.findAll('.rp-project-list__name > span').map((el) => el.element.textContent),
		).toEqual(['House ', 'Reno', 'vation']);
		expect(wrapper.find('.rp-project-list__name').element.textContent).toBe('House Renovation');
	});

	it('renders the whole name as one unmarked run with no query', () => {
		expect(row().findAll('.rp-project-row__match')).toHaveLength(0);
		expect(row().find('.rp-project-list__name').text()).toBe('House Renovation 2026');
	});

	it('emits open with its own id', async () => {
		const wrapper = row();

		await wrapper.find('.rp-project-list__row').trigger('click');

		expect(wrapper.emitted('open')).toEqual([['p1']]);
	});

	/**
	 * §7's second destination — the project's own note — and its three accelerators (Task 8).
	 * `Platform.isMacOS` is `false` in the mock throughout this block, so `Ctrl` is the
	 * modifier `opensNote` answers to; `platformModifier.test.ts` covers the macOS mirror.
	 */
	it('opens the note on Mod+Enter, and navigates on a bare Enter', async () => {
		const wrapper = row();

		await wrapper.find('.rp-project-list__row').trigger('keydown', { key: 'Enter', ctrlKey: true });

		expect(wrapper.emitted('openNote')).toEqual([['p1']]);
		// A bare Enter is the button's own native activation — reaching `click`, not this
		// handler — so nothing here must emit for it.
		expect(wrapper.emitted('open')).toBeUndefined();
	});

	it('opens the note on a middle click, which fires auxclick and never click', async () => {
		const wrapper = row();

		await wrapper.find('.rp-project-list__row').trigger('auxclick', { button: 1 });

		expect(wrapper.emitted('openNote')).toEqual([['p1']]);
	});

	/**
	 * **The autoscroll widget is a default action of `mousedown`, not of `auxclick`** — by the
	 * time `auxclick` fires (on release) Chrome has already opened it, so `preventDefault()`
	 * there suppresses nothing. Dispatched by hand rather than through `.trigger()`, which
	 * returns `nextTick()` and not the event: this needs the event object itself, to read
	 * `defaultPrevented` back off it, the same way `emptyStateOverlay.test.ts` does for its own
	 * `preventDefault` case.
	 */
	it('suppresses the autoscroll widget at mousedown, where auxclick cannot reach it', () => {
		const wrapper = row();
		const pressed = new MouseEvent('mousedown', { button: 1, bubbles: true, cancelable: true });

		wrapper.find('.rp-project-list__row').element.dispatchEvent(pressed);

		expect(pressed.defaultPrevented).toBe(true);
	});

	it('leaves every other button’s mousedown alone', () => {
		const wrapper = row();
		const pressed = new MouseEvent('mousedown', { button: 0, bubbles: true, cancelable: true });

		wrapper.find('.rp-project-list__row').element.dispatchEvent(pressed);

		expect(pressed.defaultPrevented).toBe(false);
	});

	it('ignores the secondary button, which belongs to the context menu', async () => {
		const wrapper = row();

		await wrapper.find('.rp-project-list__row').trigger('auxclick', { button: 2 });

		expect(wrapper.emitted('openNote')).toBeUndefined();
	});

	it('opens the note on a modifier click and navigates on a plain one', async () => {
		const wrapper = row();

		await wrapper.find('.rp-project-list__row').trigger('click', { ctrlKey: true });
		await wrapper.find('.rp-project-list__row').trigger('click');

		expect(wrapper.emitted('openNote')).toEqual([['p1']]);
		expect(wrapper.emitted('open')).toEqual([['p1']]);
	});

	it('does NEITHER for a modifier this door does not claim', async () => {
		// `Platform.isMacOS` is false in the mock, so `Meta` is the key `opensNote` rejects here.
		// The gesture that matters is its mirror image: on macOS `Ctrl+click` is the secondary
		// click, and falling through to `open` would move the user into a project they were
		// asking a context menu about. `Alt` and `Shift` are refused for the same reason —
		// this surface claims neither.
		const wrapper = row();

		await wrapper.find('.rp-project-list__row').trigger('click', { metaKey: true });
		await wrapper.find('.rp-project-list__row').trigger('click', { altKey: true });
		await wrapper.find('.rp-project-list__row').trigger('click', { shiftKey: true });

		expect(wrapper.emitted('openNote')).toBeUndefined();
		expect(wrapper.emitted('open')).toBeUndefined();
	});

	/**
	 * §7: "a press carrying any OTHER modifier does neither thing" — `Ctrl` chorded with
	 * `Shift` is still some OTHER modifier held alongside the platform key, on both the click
	 * and the `Mod+↵` keydown door. `opensNote`'s first version checked only `ctrlKey`/`metaKey`
	 * and never asked about `Shift` at all, so this chord opened the note on both doors.
	 */
	it('does NEITHER for the platform key chorded with Shift', async () => {
		const wrapper = row();

		await wrapper.find('.rp-project-list__row').trigger('click', { ctrlKey: true, shiftKey: true });
		await wrapper
			.find('.rp-project-list__row')
			.trigger('keydown', { key: 'Enter', ctrlKey: true, shiftKey: true });

		expect(wrapper.emitted('openNote')).toBeUndefined();
		expect(wrapper.emitted('open')).toBeUndefined();
	});

	describe('tabbable', () => {
		it('is the roving group’s one tab stop by default', () => {
			expect(row().find('.rp-project-list__row').attributes('tabindex')).toBe('0');
		});

		it('drops out of the tab sequence when `tabbable` is false', () => {
			const wrapper = mount(ProjectRow, {
				props: { project: PROJECT, collator, tabbable: false },
			});

			expect(wrapper.find('.rp-project-list__row').attributes('tabindex')).toBe('-1');
		});
	});
});
