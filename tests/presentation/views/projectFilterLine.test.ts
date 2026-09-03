/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import ProjectFilter from '../../../src/presentation/views/ProjectFilter.vue';
import ProjectList from '../../../src/presentation/views/ProjectList.vue';
import type { ProjectSummaryDto } from '../../../src/presentation/read-models/PlanDto';

function line(props: { query?: string; shown?: number; total?: number } = {}) {
	return mount(ProjectFilter, {
		props: { query: '', shown: 4, total: 4, ...props },
	});
}

describe('ProjectFilter', () => {
	it('states the vault’s own count at rest', () => {
		// The teletext discipline: at rest the field IS the pane's count line. A launcher whose
		// field says nothing when empty is furniture, and two projects is exactly the vault
		// size that risk was recorded against.
		expect(line().find('.rp-project-filter__count').text()).toBe('4 projects');
	});

	/**
	 * `t` has no plural machinery, so the count is picked at the component — and the English
	 * singular SPELLS THE NUMERAL OUT (`One project`, not `1 project`), which `en.ts` records
	 * the lint reason for at the key. The brief's own draft of this case asserted `1 project`
	 * against a key that has never held that string.
	 */
	it('picks the singular count key at one, because t has no plural machinery', () => {
		expect(line({ shown: 1, total: 1 }).find('.rp-project-filter__count').text()).toBe('One project');
	});

	it('turns the count into a ratio while filtering', () => {
		expect(line({ query: 'ki', shown: 2, total: 4 }).find('.rp-project-filter__count').text()).toBe(
			'2 of 4',
		);
	});

	it('announces politely through a region separate from the visible count', () => {
		const wrapper = line();

		expect(wrapper.find('.rp-project-filter__announcement').attributes('role')).toBe('status');
		// The visible count is NOT the live region: two elements announcing one number makes a
		// screen reader say it twice.
		expect(wrapper.find('.rp-project-filter__count').attributes('aria-hidden')).toBe('true');
	});

	it('updates the VISIBLE count immediately, without waiting for the debounce', async () => {
		// The count is the pane's state line — §3's teletext discipline and the whole reason the
		// filter is not furniture. Rows filter immediately, so a debounced visible count would
		// read `4 projects` above two rows, indefinitely while the user keeps typing.
		vi.useFakeTimers();
		const wrapper = line();

		await wrapper.setProps({ query: 'ki', shown: 2, total: 4 });

		expect(wrapper.find('.rp-project-filter__count').text()).toBe('2 of 4');
		expect(wrapper.find('.rp-project-filter__announcement').text()).toBe('4 projects');
		vi.useRealTimers();
	});

	it('gives the input a real accessible name through a label, not a placeholder', () => {
		const wrapper = line();
		const input = wrapper.find('input');
		const label = wrapper.find('label');

		// A placeholder is not a label and does not become one.
		expect(label.text()).toBe('Filter projects');
		expect(label.attributes('for')).toBe(input.attributes('id'));
		expect(input.attributes('placeholder')).toBeUndefined();
	});

	/**
	 * No autofocus: a pane that takes focus on open hijacks whatever the user was typing.
	 *
	 * **ATTACHED, and that is the whole of what makes the second assertion mean anything.**
	 * `document.activeElement` is `<body>` for any mount outside the document, so the unattached
	 * version of this case is true of every build ever written — including one that focuses its
	 * input on mount. Measured both ways rather than reasoned: against a component given a
	 * template ref and `onMounted(() => input.focus())`, this case goes RED attached and stays
	 * GREEN unattached.
	 *
	 * The first assertion discriminates either way, but it refuses only the ATTRIBUTE — jsdom
	 * does not act on `autofocus` — so it is the check about the markup and the second one is
	 * the check about the behaviour. `unmount` because an attached mount outlives the case.
	 */
	it('does not steal the caret on mount', () => {
		const wrapper = mount(ProjectFilter, {
			props: { query: '', shown: 4, total: 4 },
			attachTo: document.body,
		});

		expect(wrapper.find('input').attributes('autofocus')).toBeUndefined();
		expect(document.activeElement?.tagName).not.toBe('INPUT');
		wrapper.unmount();
	});

	it('emits every keystroke', async () => {
		const wrapper = line();

		await wrapper.find('input').setValue('kit');

		expect(wrapper.emitted('update:query')).toEqual([['kit']]);
	});

	it('emits cancel on Escape, and never clears the field itself', async () => {
		// The list owns what Escape MEANS — clear a query, or hand focus back to the first row
		// when there is none — because only it knows whether there is a row to hand focus to.
		const wrapper = line({ query: 'kit' });

		await wrapper.find('input').trigger('keydown', { key: 'Escape' });

		expect(wrapper.emitted('cancel')).toHaveLength(1);
		expect(wrapper.emitted('update:query')).toBeUndefined();
	});

	it('debounces the announcement so a five-character query announces once', async () => {
		vi.useFakeTimers();
		const wrapper = line();

		for (const value of ['c', 'ce', 'cel', 'cell', 'cella']) {
			await wrapper.setProps({ query: value, shown: 1, total: 4 });
		}
		const announced = wrapper.find('.rp-project-filter__announcement').text();
		vi.advanceTimersByTime(1000);
		await wrapper.vm.$nextTick();

		// Before the debounce settles the live region still holds the PREVIOUS text, so a
		// screen reader is not read five ratios for one word. The VISIBLE count moved on the
		// first keystroke and is already correct — that is the case above.
		expect(announced).toBe('4 projects');
		expect(wrapper.find('.rp-project-filter__announcement').text()).toBe('1 of 4');
		vi.useRealTimers();
	});

	/**
	 * A timer outliving its component is a leak with behaviour attached, and this view remounts
	 * per navigation — so one is created and abandoned on every one of them. Asserted on the
	 * TIMER COUNT rather than on a rendered value, because the announcement of an unmounted
	 * component is unobservable: a build that dropped the `onBeforeUnmount` renders identically
	 * and this is the only instrument that sees it.
	 */
	it('clears its pending announcement when it unmounts', async () => {
		vi.useFakeTimers();
		const wrapper = line();

		await wrapper.setProps({ query: 'ki', shown: 2, total: 4 });
		expect(vi.getTimerCount()).toBe(1);
		wrapper.unmount();

		expect(vi.getTimerCount()).toBe(0);
		vi.useRealTimers();
	});
});

const PROJECT: ProjectSummaryDto = {
	id: 'p1',
	name: 'Kitchen',
	status: 'IDEA',
	currency: 'EUR',
	libraryOverlap: false,
	planCount: 1,
	lastWorked: null,
};

const project = (overrides: Partial<ProjectSummaryDto>): ProjectSummaryDto => ({
	...PROJECT,
	...overrides,
});

const THREE = [
	project({ id: 'p1', name: 'Kitchen' }),
	project({ id: 'p2', name: 'Küche' }),
	project({ id: 'p3', name: 'Attic', status: 'COMPLETE' }),
];

const list = (props: { projects?: readonly ProjectSummaryDto[]; unreadable?: number } = {}) =>
	mount(ProjectList, { props: { projects: THREE, unreadable: 0, ...props } });

describe('the filter line inside ProjectList', () => {
	it('states the vault’s own total at rest, not the ordered list’s length', () => {
		expect(list().find('.rp-project-filter__count').text()).toBe('3 projects');
	});

	it('filters BOTH groups, not only the open one', async () => {
		const wrapper = list();

		await wrapper.find('.rp-project-filter__input').setValue('k');

		// `Kitchen` and `Küche` are the two the collator matches; `Attic` is in the collapsed
		// Completed group and must go, or the group's own count claims a row the filter excluded.
		expect(wrapper.findAll('.rp-project-list__name').map((el) => el.text())).toEqual([
			'Kitchen',
			'Küche',
		]);
		expect(wrapper.find('.rp-project-list__completed').exists()).toBe(false);
		expect(wrapper.find('.rp-project-filter__count').text()).toBe('2 of 3');
	});

	it('matches diacritics through the list’s own hoisted collator', async () => {
		// The whole reason `matchesQuery` takes a collator: a `toLowerCase` filter answers
		// nothing here, and the row that matches renders its umlaut rather than the query's
		// spelling.
		const wrapper = list();

		await wrapper.find('.rp-project-filter__input').setValue('kuche');

		expect(wrapper.findAll('.rp-project-list__name').map((el) => el.text())).toEqual(['Küche']);
		expect(wrapper.find('.rp-project-row__match').text()).toBe('Küche');
	});

	/**
	 * §9's own row: a vault whose every project note refused draws the header, the notice and
	 * no filter. `selectRenovationProjectEmptyState` answers `null` on `unreadable > 0` BEFORE
	 * it looks at the length, so `ProjectList` really is mounted with `projects: []` — and
	 * unguarded the line would state `0 projects` about a vault that demonstrably holds
	 * projects, directly contradicting the notice beside it.
	 */
	it('draws no filter over an empty list', () => {
		const wrapper = list({ projects: [], unreadable: 3 });

		expect(wrapper.find('.rp-project-filter').exists()).toBe(false);
		expect(wrapper.find('.rp-view-notice').exists()).toBe(true);
	});

	/**
	 * Task 7's no-match block is gated on the QUERY, not merely on an empty `matching` list —
	 * and this is the one production state where the two disagree: every project note refused,
	 * so `matching` is empty with NOTHING typed. Without the `query.trim().length > 0` half of
	 * the guard this would draw `No project matches ""` beside a notice already explaining why
	 * the vault looks empty, which is a second, wrong account of the same fact.
	 */
	it('draws no no-match block either, over the same empty-and-unread list', () => {
		const wrapper = list({ projects: [], unreadable: 3 });

		expect(wrapper.find('.rp-project-list__no-match').exists()).toBe(false);
	});

	/**
	 * ORDER, not mere presence — which is the whole reason region 6 moved out of `ViewRoot`.
	 * There it rendered AFTER the entire list, so the sentence saying some projects could not
	 * be read sat under thirty rows of the ones that could. A presence check is satisfied by
	 * either arrangement, which is exactly how it came to be in the wrong place.
	 */
	it('puts the partial-read notice above the first group and below the filter', () => {
		const html = list({ unreadable: 2 }).html();

		expect(html.indexOf('rp-project-filter')).toBeLessThan(html.indexOf('rp-view-notice'));
		expect(html.indexOf('rp-view-notice')).toBeLessThan(html.indexOf('rp-project-list__group'));
	});

	it('draws no notice when nothing refused', () => {
		expect(list().find('.rp-view-notice').exists()).toBe(false);
	});

	it('leaves Escape to a later task rather than clearing the query itself', async () => {
		// Task 8 is where Escape's two meanings are built. Until then the list hears `cancel`
		// and does nothing with it — asserted so that a build which quietly wires half of it
		// fails here rather than shipping one of the two meanings.
		const wrapper = list();
		await wrapper.find('.rp-project-filter__input').setValue('kitchen');

		await wrapper.find('.rp-project-filter__input').trigger('keydown', { key: 'Escape' });

		expect((wrapper.find('.rp-project-filter__input').element as HTMLInputElement).value).toBe(
			'kitchen',
		);
	});
});
