/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import ProjectRow from '../../../src/presentation/views/ProjectRow.vue';
import HostIcon from '../../../src/presentation/components/HostIcon.vue';
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

	/**
	 * P00 GIVES PLANS AND CURRENCY THEIR OWN COLUMNS, under their own headings, so they are two
	 * elements rather than one joined string. The old single facts slot could not be headed: a
	 * `Plans` and a `Currency` heading over one cell reading `2 plans · EUR` is a table
	 * pretending to have two columns.
	 */
	it('states the plan count and the currency in their own columns', () => {
		expect(row().find('.rp-project-row__plans').text()).toBe('2 plans');
		expect(row().find('.rp-project-row__currency').text()).toBe('EUR');
	});

	/**
	 * P00'S `Last worked` COLUMN. `ProjectSummaryDto.lastWorked` is a required index fact and
	 * P00's data contract lists it; the row drew it nowhere. It is LAST WORKED and not "last
	 * opened", which that contract states in so many words.
	 *
	 * Asserted as "contains the year" rather than against a formatted string, because
	 * `Intl.DateTimeFormat`'s medium style is an ICU detail that moves between Node versions and
	 * between the four CI legs — pinning the exact rendering would make this a test of the
	 * platform's date tables. What it holds is that the row draws that date at all, from that
	 * field, through a locale formatter.
	 */
	it('draws the last-worked date from the index fact P00 names', () => {
		expect(row().find('.rp-project-row__worked').text()).toContain('2026');
	});

	/**
	 * EMPTY rather than a dash when the index has no date, per the content rule below. The
	 * element STAYS — unlike the plan count, nothing reads its absence, and a wide row's `Last
	 * worked` column with one blank cell is honest where a dash would be an invented value.
	 */
	it('leaves the date blank rather than inventing one', () => {
		expect(row({ lastWorked: null }).find('.rp-project-row__worked').text()).toBe('');
	});

	/**
	 * **A DATE THIS CANNOT READ MUST NOT TAKE THE LIST DOWN WITH IT.**
	 * `Intl.DateTimeFormat.format` THROWS a `RangeError` on an invalid date, and this row's
	 * formatter is a computed inside a `v-for` — so an unreadable value does not blank one cell,
	 * it kills the render of the whole list and draws an empty pane.
	 *
	 * Found rather than imagined: a `ViewRoot` test double supplying `{ id, name, status }` and
	 * no `lastWorked` at all turned SEVEN unrelated cases red with `Unhandled error during
	 * execution of render function`, in files that assert nothing about a date.
	 *
	 * Both arms, because they reach the guard by different routes: `undefined` is a field the
	 * type says is always present and a fake may still omit, and a non-date STRING is a value
	 * that is present and unparseable — which no type can rule out, since it arrives from the
	 * vault's own file stats through the index. The cast is what lets a case ask the first
	 * question at all, and it is the point: this is about what happens when the declared type is
	 * not what arrived.
	 */
	it('survives a date it cannot read, rather than blanking the pane', () => {
		for (const lastWorked of [undefined, 'not a date']) {
			const wrapper = row({ lastWorked } as Partial<ProjectSummaryDto>);

			expect(wrapper.find('.rp-project-row__worked').text()).toBe('');
			// The rest of the row still drew, which is the guarantee — not merely that the cell
			// is empty, but that nothing else was lost with it.
			expect(wrapper.find('.rp-project-list__name').text()).toBe('House Renovation 2026');
		}
	});

	/**
	 * **THE SAME SHAPE ON THE PLAN COUNT, and it is why that test is `> 0` and not `!== 0`.**
	 * The two spellings differ on exactly one input — a count that is not a number — and the
	 * strict one draws `undefined plans` under the `Plans` heading where this one draws no
	 * element at all. The harm is smaller than the date's (nothing throws), which is precisely
	 * why it needs a case: an unnecessary-looking `!(x > 0)` is the kind of thing a later reader
	 * tidies into `x !== 0`, and nothing else here would notice.
	 */
	it('draws no plan count for a count that is not a number', () => {
		const wrapper = row({ planCount: undefined } as Partial<ProjectSummaryDto>);

		expect(wrapper.find('.rp-project-row__plans').exists()).toBe(false);
		expect(wrapper.find('.rp-project-row__currency').text()).toBe('EUR');
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
		expect(row({ planCount: 1 }).find('.rp-project-row__plans').text()).toBe('One plan');
	});

	/**
	 * **THE SLOT IS ABSENT, NOT EMPTY, and the difference is what the narrow sheet reads.** The
	 * governing content rule is unchanged — the row must look complete today, not like a card
	 * with holes, so no dash, no em-dash, no skeleton, no "not yet calculated". What changed is
	 * that `v-if` rather than an empty string is now load-bearing beyond appearance:
	 * `project-list-narrow.css` moves the currency into the count's track with
	 * `.rp-project-list__name + .rp-project-row__currency`, which matches only when this element
	 * does not exist. An empty span would draw the same picture at wide width and leave `EUR`
	 * indented behind a blank column at narrow, where there is no heading to explain it.
	 */
	it('renders no plan-count element at all rather than an empty one', () => {
		const wrapper = row({ planCount: 0 });

		expect(wrapper.find('.rp-project-row__plans').exists()).toBe(false);
		expect(wrapper.find('.rp-project-row__currency').text()).toBe('EUR');
	});

	/**
	 * **THE STATUS IS A PILL AND THE WORD IS THE WHOLE ACCESSIBLE NAME.** The ten-cell tick strip
	 * it replaces was an enhancement over a channel that was already complete; the pill is the
	 * same arrangement — a decorative dot beside a translated word — so the guarantee SDD §85 and
	 * PRD's accessibility section both make is unchanged: a status is never carried by colour.
	 */
	it('draws the status as a pill whose word is the whole accessible name', () => {
		const wrapper = row();

		expect(wrapper.find('.rp-project-row__pill').text()).toBe('Design');
		expect(wrapper.find('.rp-project-row__dot').attributes('aria-hidden')).toBe('true');
		expect(wrapper.find('.rp-project-row__dot').text()).toBe('');
	});

	/**
	 * **ONE DOT, EVERY STATUS — the strip's ten cells are gone and nothing replaced them with a
	 * per-status palette.** A status-to-colour mapping is a mapping this design package does not
	 * define, so inventing one would be a claim about what each of ten stages MEANS that no
	 * document backs. This case is what stops one arriving as a polish pass: every project draws
	 * exactly one dot whatever its status, carrying no modifier class a palette could hang off,
	 * so a build that added one fails here rather than in a capture nobody takes.
	 */
	it('gives every status the same single dot, never a per-status palette', () => {
		const drawn = ['IDEA', 'DESIGN', 'AS_BUILT', 'PLANNING']
			.map((status) => row({ status }).findAll('.rp-project-row__dot').map((dot) => dot.classes()));

		// One dot per row, and its class list is the bare name — nothing a palette could hang a
		// modifier off. Compared as a whole so the failure names the status that grew one.
		expect(drawn).toEqual(Array.from({ length: 4 }, () => [['rp-project-row__dot']]));
	});

	/**
	 * A STATUS THIS BUILD CANNOT PLACE still gets a pill, where the strip used to draw nothing at
	 * all. That asymmetry went with the strip: a strip at stage 0 would have said IDEA about a
	 * project nobody established a stage for, and a pill makes no positional claim — it carries
	 * the raw value as its word, which is what `statusLabel` already answers for one.
	 */
	it('draws a pill for a status this build cannot place, carrying the raw value', () => {
		expect(row({ status: 'PLANNING' }).find('.rp-project-row__pill').text()).toBe('PLANNING');
	});

	/**
	 * P00'S TWO DECORATIVE GLYPHS, and the claim that matters about both is that they add NOTHING
	 * to the row: the chevron in particular must not become a second focus stop, because the row
	 * is already one `<button>` and a control inside a control is the composite §7 refuses.
	 *
	 * Asserted through `HostIcon` rather than by class, because a plain `<span>` wearing the same
	 * class would draw no icon in a vault and pass a class-only assertion — `HostIcon` is what
	 * reaches Obsidian's `setIcon`, and it is also what carries the `aria-hidden`.
	 */
	it('adds two decorative glyphs and no second focus stop', () => {
		const wrapper = row();
		const glyphs = wrapper.findAllComponents(HostIcon);

		expect(glyphs.map((glyph) => glyph.props('name'))).toEqual(['house', 'chevron-right']);
		for (const glyph of glyphs) expect(glyph.attributes('aria-hidden')).toBe('true');
		// One button, and it is the row itself.
		expect(wrapper.findAll('button')).toHaveLength(1);
		expect(wrapper.findAll('[tabindex]')).toHaveLength(1);
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
