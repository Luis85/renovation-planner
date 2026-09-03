/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import ProjectList from '../../../src/presentation/views/ProjectList.vue';
import type { ProjectSummaryDto } from '../../../src/presentation/read-models/PlanDto';

function project(name: string, over: Partial<ProjectSummaryDto> = {}): ProjectSummaryDto {
	return {
		id: name,
		name,
		status: 'IDEA',
		currency: 'EUR',
		libraryOverlap: false,
		planCount: 0,
		lastWorked: null,
		...over,
	};
}

const THREE = [project('Attic'), project('Bathroom'), project('Cellar')];

// `attachTo: document.body` because every case here reads `document.activeElement`, and a
// detached tree cannot hold focus at all — a case asserting a focus move against one passes or
// fails for reasons that have nothing to do with the code.
function list(projects = THREE) {
	return mount(ProjectList, { props: { projects, unreadable: 0 }, attachTo: document.body });
}

/**
 * A GENUINE focus move, never `.trigger('focus')`. VTU's `trigger` only dispatches a synthetic
 * event — for `focus` that does not move `document.activeElement` at all, since jsdom (like a
 * real browser) requires the native method for that. Every other case in `tests/presentation/`
 * that asserts on `document.activeElement` reaches for `.element.focus()` directly for the same
 * reason (`emptyStateOverlay.test.ts`, `newProjectForm.test.ts`, `dialogHost.test.ts`); a case
 * here that used `.trigger('focus')` instead read as passing while asserting on `<body>`, not on
 * the row or the field.
 */
function focus(wrapper: { element: Element }): void {
	(wrapper.element as HTMLElement).focus();
}

describe('ProjectList keyboard', () => {
	it('costs ONE tab stop for a list of any length', () => {
		const rows = list().findAll('.rp-project-list__row');

		// Roving: exactly one row is tabbable and the rest are reachable by arrow. Thirty
		// projects must not cost thirty tabs to walk past — that is what roving is FOR, and it
		// is applied to the row lists and to nothing else on this surface.
		expect(rows.filter((row) => row.attributes('tabindex') !== '-1')).toHaveLength(1);
		expect(rows[0].attributes('tabindex')).toBe('0');
	});

	it('moves focus down and up through the rows', async () => {
		const wrapper = list();
		const rows = wrapper.findAll('.rp-project-list__row');
		focus(rows[0]);

		await rows[0].trigger('keydown', { key: 'ArrowDown' });
		expect(document.activeElement).toBe(rows[1].element);

		await rows[1].trigger('keydown', { key: 'ArrowUp' });
		expect(document.activeElement).toBe(rows[0].element);
	});

	it('stops at the ends rather than wrapping', async () => {
		// A wrap makes ArrowUp at the top jump to the bottom of a thirty-row list, which reads
		// as the pane having scrolled somewhere the user did not ask to go.
		const wrapper = list();
		const rows = wrapper.findAll('.rp-project-list__row');
		focus(rows[0]);

		await rows[0].trigger('keydown', { key: 'ArrowUp' });

		expect(document.activeElement).toBe(rows[0].element);
	});

	it('opens the project the row is for when it is activated', async () => {
		const wrapper = list();

		await wrapper.findAll('.rp-project-list__row')[1].trigger('click');

		expect(wrapper.emitted('open')).toEqual([['Bathroom']]);
	});

	/**
	 * **Bare Enter is NOT asserted here, and adding a handler for it would be a defect.** A row
	 * is a `<button>`, so the browser activates it on Enter natively — but VTU's
	 * `trigger('keydown')` dispatches the event and performs no native activation, which is the
	 * same jsdom limitation `platformModifier.test.ts` records for `Mod+↵`. Handling bare Enter
	 * in `onKeydown` would fire beside the native activation in a real browser and open the row
	 * twice.
	 *
	 * The click above covers the wiring; bare Enter is the manual case's, where a real browser
	 * is doing the activating.
	 */
	it('seeds the filter from a printable character typed at the list', async () => {
		const wrapper = list();
		const rows = wrapper.findAll('.rp-project-list__row');
		focus(rows[0]);

		await rows[0].trigger('keydown', { key: 'c' });

		const input = wrapper.find('.rp-project-filter__input');
		expect(document.activeElement).toBe(input.element);
		// SEEDS it, rather than only focusing: a user typing `cellar` at the list must not lose
		// the `c`. That is the launcher's keyboard entry, and it is why no autofocus is needed.
		expect((input.element as HTMLInputElement).value).toBe('c');
	});

	it('ignores a modified keystroke, which belongs to the host', async () => {
		const wrapper = list();
		const rows = wrapper.findAll('.rp-project-list__row');
		focus(rows[0]);

		await rows[0].trigger('keydown', { key: 'p', ctrlKey: true });

		// Ctrl+P is Obsidian's command palette. Seeding the filter from it would swallow every
		// host shortcut a user presses while a row has focus.
		expect(document.activeElement).toBe(rows[0].element);
	});

	it('leaves Space to the button it was pressed on', async () => {
		const wrapper = list();
		const rows = wrapper.findAll('.rp-project-list__row');
		focus(rows[0]);

		await rows[0].trigger('keydown', { key: ' ' });

		// `' '.length === 1`, so Space passes a bare printable-character test — and a row is a
		// `<button>`, whose native activation is Enter AND Space. Seeding from it would either
		// suppress that activation or do both at once: open the project and leave a space in
		// the field. Nothing is lost, because a query never usefully begins with a space.
		expect(document.activeElement).toBe(rows[0].element);
		expect((wrapper.find('.rp-project-filter__input').element as HTMLInputElement).value).toBe('');
	});

	it('enters the results with ArrowDown from the filter', async () => {
		// §7's table says the arrows work from `filter or list`. Bound to the list alone, a
		// keyboard user reaches the field and cannot get out of it into the rows.
		const wrapper = list();
		const input = wrapper.find('.rp-project-filter__input');
		focus(input);

		await input.trigger('keydown', { key: 'ArrowDown' });

		expect(document.activeElement).toBe(wrapper.findAll('.rp-project-list__row')[0].element);
	});

	/**
	 * Both `<details>`/`<summary>` cases below expand the group by hand — `.open = true` then a
	 * `toggle` trigger — rather than clicking the `<summary>`. jsdom really does flip `open` on a
	 * dispatched click (measured directly against the real element), but the `toggle` EVENT it
	 * queues is a genuine task, not a microtask: `await wrapper.trigger('click')` only flushes
	 * Vue's microtask-based `nextTick`, so a click-only version of this case would leave
	 * `completedOpen` still `false` when the assertion runs — flaky by construction rather than
	 * by anything these two cases are about. `projectListGroups.test.ts`'s own disclosure case
	 * already established the set-then-trigger pattern for the identical reason.
	 */
	it('enters an EXPANDED Completed group when there are no active rows', async () => {
		// A vault whose projects are all finished, or a query matching only completed ones.
		// Returning whenever `active` is empty leaves those visible results unreachable by
		// keyboard — the only way in, for that vault, is this fall-through.
		const wrapper = mount(ProjectList, {
			props: { projects: [project('Attic', { status: 'COMPLETE' })], unreadable: 0 },
			attachTo: document.body,
		});
		const details = wrapper.get('.rp-project-list__completed');
		(details.element as HTMLDetailsElement).open = true;
		await details.trigger('toggle');
		const input = wrapper.find('.rp-project-filter__input');
		focus(input);

		await input.trigger('keydown', { key: 'ArrowDown' });

		expect(document.activeElement).toBe(
			wrapper.findAll('.rp-project-list__completed .rp-project-list__row')[0].element,
		);
	});

	it('hands Escape to an expanded Completed group when there are no active rows', async () => {
		// The sibling of the ArrowDown case above, and the one the first fix missed: Escape in
		// an already-empty filter asked `active` alone, so on a vault of only completed
		// projects the arrows worked and Escape did nothing.
		const wrapper = mount(ProjectList, {
			props: { projects: [project('Attic', { status: 'COMPLETE' })], unreadable: 0 },
			attachTo: document.body,
		});
		const details = wrapper.get('.rp-project-list__completed');
		(details.element as HTMLDetailsElement).open = true;
		await details.trigger('toggle');
		const input = wrapper.find('.rp-project-filter__input');
		focus(input);

		await input.trigger('keydown', { key: 'Escape' });

		expect(document.activeElement).toBe(
			wrapper.findAll('.rp-project-list__completed .rp-project-list__row')[0].element,
		);
	});

	it('does NOT enter a collapsed Completed group', async () => {
		// Moving focus onto a row the user cannot see is worse than not moving. The summary is
		// an ordinary tab stop and opening it is the gesture that makes those rows reachable.
		const wrapper = mount(ProjectList, {
			props: { projects: [project('Attic', { status: 'COMPLETE' })], unreadable: 0 },
			attachTo: document.body,
		});
		const input = wrapper.find('.rp-project-filter__input');
		focus(input);

		await input.trigger('keydown', { key: 'ArrowDown' });

		expect(document.activeElement).toBe(input.element);
	});

	it('costs ONE tab stop for the Completed list too', async () => {
		const wrapper = mount(ProjectList, {
			props: {
				projects: [
					project('Attic', { status: 'COMPLETE' }),
					project('Bathroom', { status: 'COMPLETE' }),
					project('Cellar', { status: 'AS_BUILT' }),
				],
				unreadable: 0,
			},
			attachTo: document.body,
		});
		const details = wrapper.get('.rp-project-list__completed');
		(details.element as HTMLDetailsElement).open = true;
		await details.trigger('toggle');

		const rows = wrapper.findAll('.rp-project-list__completed .rp-project-list__row');

		// Its own controller, not the Projects one. Without it every completed project keeps
		// `tabindex="0"` — the exact cost roving exists to remove, in the group most likely to
		// be long, and the group §7's sequence names as one stop.
		expect(rows.filter((row) => row.attributes('tabindex') !== '-1')).toHaveLength(1);
	});

	it('clamps each group against ITS OWN rows, not the filter’s total', async () => {
		// One active row and two completed rows match while the active cursor sits at 2:
		// clamping against `matching.length` (3) does nothing, and the sole active row is left
		// at `tabindex="-1"` — so Tab skips the Projects group entirely, silently.
		const wrapper = mount(ProjectList, {
			props: {
				projects: [
					project('Match one'),
					project('Match two', { status: 'COMPLETE' }),
					project('Match three', { status: 'AS_BUILT' }),
					project('Other'),
					project('Another'),
				],
				unreadable: 0,
			},
			attachTo: document.body,
		});
		const rows = wrapper.findAll('.rp-project-list__group--projects .rp-project-list__row');
		focus(rows[0]);
		await rows[0].trigger('keydown', { key: 'ArrowDown' });
		await rows[1].trigger('keydown', { key: 'ArrowDown' });

		await wrapper.find('.rp-project-filter__input').setValue('Match');

		const active = wrapper.findAll('.rp-project-list__group--projects .rp-project-list__row');
		expect(active).toHaveLength(1);
		expect(active[0].attributes('tabindex')).toBe('0');
	});

	it('clears a query on Escape and keeps the caret in the field', async () => {
		const wrapper = list();
		const input = wrapper.find('.rp-project-filter__input');
		await input.setValue('cel');
		focus(input);

		await input.trigger('keydown', { key: 'Escape' });

		expect((input.element as HTMLInputElement).value).toBe('');
		expect(document.activeElement).toBe(input.element);
	});

	it('hands focus to the first row on Escape in an empty field', async () => {
		const wrapper = list();
		const input = wrapper.find('.rp-project-filter__input');
		focus(input);

		await input.trigger('keydown', { key: 'Escape' });

		expect(document.activeElement).toBe(wrapper.findAll('.rp-project-list__row')[0].element);
	});

	/**
	 * **Rewritten from the brief's own version, which could not pass for a reason worth
	 * recording.** It set the field to `'zzz'` (matching nothing) and pressed Escape TWICE,
	 * expecting focus to stay on the field both times — but `onFilterCancel`'s FIRST rule
	 * (`query.value.length > 0` → clear it, unconditionally) fires on the first press
	 * regardless of whether the query matched anything, un-filtering the list back to its
	 * three real rows. The SECOND press then finds an EMPTY field with rows to reach and
	 * correctly moves focus to the first one — which is `focusFirstRow`'s own SUCCESS path,
	 * not the no-op this case exists to cover, and asserting the field kept focus for it is
	 * asserting a `false` for `true`.
	 *
	 * The genuinely unreachable pair — an empty field AND no row to hand focus to — needs the
	 * field to be empty from the start, which only leaves the case `focusFirstRow`'s own
	 * docblock names: no ACTIVE rows (a vault whose only project is `COMPLETE`) with the
	 * `Completed` disclosure still collapsed by default. An empty VAULT cannot exercise this at
	 * all: `ProjectFilter` itself is gated on `projects.length > 0`, so a vault with zero
	 * projects has no field to press Escape in.
	 */
	it('survives Escape with an empty field and no rows to hand focus to', async () => {
		const wrapper = mount(ProjectList, {
			props: { projects: [project('Attic', { status: 'COMPLETE' })], unreadable: 0 },
			attachTo: document.body,
		});
		const input = wrapper.find('.rp-project-filter__input');
		focus(input);

		await input.trigger('keydown', { key: 'Escape' });

		expect(document.activeElement).toBe(input.element);
	});

	/**
	 * **Not one of the brief's own cases, and needed to make its own mutation check
	 * (Step 7) mean anything.** Every case the brief specified passes unchanged with
	 * `reconcile` reduced to the index-only clamp it started as — none of them narrows a
	 * filter to a SURVIVING row at a DIFFERENT index, which is the one case `Math.min`/
	 * `Math.max` alone gets wrong: `[Alpha, Sub Beta, Sub Gamma]` with `Sub Beta` active at
	 * index 1, filtered to `[Sub Beta, Sub Gamma]`, leaves index 1 in range (`1 <= 2 - 1`) —
	 * so an index-only clamp does nothing and the SECOND row, `Sub Gamma`, silently becomes
	 * the tab stop while `Sub Beta` is the one the user was on. `useRovingFocus.ts` follows
	 * the id instead. Watched red against the index-only clamp before this test existed.
	 */
	it('keeps the tab stop on the SAME ROW, not the same index, when the filter narrows around it', async () => {
		const wrapper = mount(ProjectList, {
			props: {
				projects: [project('Alpha'), project('Sub Beta'), project('Sub Gamma')],
				unreadable: 0,
			},
			attachTo: document.body,
		});
		const rows = wrapper.findAll('.rp-project-list__row');
		focus(rows[1]); // "Sub Beta", not "Alpha"

		await wrapper.find('.rp-project-filter__input').setValue('Sub');

		const left = wrapper.findAll('.rp-project-list__row');
		expect(left.map((row) => row.attributes('data-project-id'))).toEqual(['Sub Beta', 'Sub Gamma']);
		expect(left[0].attributes('tabindex')).toBe('0');
		expect(left[1].attributes('tabindex')).toBe('-1');
	});

	it('keeps the active row in range when the filter shortens the list', async () => {
		const wrapper = list();
		const rows = wrapper.findAll('.rp-project-list__row');
		focus(rows[0]);
		await rows[0].trigger('keydown', { key: 'ArrowDown' });
		await rows[1].trigger('keydown', { key: 'ArrowDown' });

		await wrapper.find('.rp-project-filter__input').setValue('Attic');

		// Index 2 does not exist any more. Without a clamp the roving group has NO tabbable
		// member and the list becomes unreachable by Tab — silently, for the rest of the mount.
		const left = wrapper.findAll('.rp-project-list__row');
		expect(left).toHaveLength(1);
		expect(left[0].attributes('tabindex')).toBe('0');
	});
});
