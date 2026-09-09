/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import ContinueRow from '../../../src/presentation/views/ContinueRow.vue';
import HostIcon from '../../../src/presentation/components/HostIcon.vue';
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

function row(planId: string | null = 'plan-1', plan = { id: 'plan-1', name: 'Kitchen' }) {
	// `planId` stays a PARAMETER here — it decides which `plan` this call passes — even though
	// the component itself takes no such prop: `fallow`'s unused-component-prop check found that
	// nothing inside `ContinueRow` ever reads an id, only the resolved `plan`, so the prop was
	// removed at the component. See `ContinueRow.vue`'s own docblock.
	return mount(ContinueRow, { props: { project: PROJECT, plan: planId === null ? null : plan } });
}

describe('ContinueRow', () => {
	/**
	 * **IT IS A CARD NOW, and this case is the reversal of the one it replaces.** That case
	 * asserted `.rp-project-list__row` and its comment said the row must never be "a different
	 * shape" — a raised card above a flat list being the composition that direction had not
	 * locked. P00 and P06 lock it: a bordered, tinted block with a leading glyph, the project on
	 * one line and the plan muted underneath.
	 *
	 * The class is asserted ABSENT rather than merely not asserted present, because
	 * `list-row.css` is keyed on it: a card still wearing it would take the flat row's padding,
	 * its hover and its edge-to-edge width, and would draw a card-shaped thing with a row's
	 * geometry inside it.
	 */
	it('is drawn as P00’s card rather than as another flat row', () => {
		const wrapper = row();

		expect(wrapper.find('.rp-continue').exists()).toBe(true);
		expect(wrapper.find('.rp-project-list__row').exists()).toBe(false);
	});

	/**
	 * P00'S LEADING GLYPH, through `HostIcon` so it reaches Obsidian's own `setIcon` — a plain
	 * `<span>` with the same class would draw nothing in a vault and satisfy a class assertion.
	 * `aria-hidden` at HostIcon's own root: a card is not a control and the glyph names nothing.
	 */
	it('carries P00’s leading glyph, decorative and unnamed', () => {
		const glyph = row().findComponent(HostIcon);

		expect(glyph.props('name')).toBe('house');
		expect(glyph.attributes('aria-hidden')).toBe('true');
	});

	/**
	 * **THE TWO ACTIONS SAY WHICH PROJECT THEY ACT ON, and before this they did not.** Both read
	 * only `Resume` and `Open project`, with the project's name in an unassociated sibling span
	 * under an `<h3>Resume</h3>` heading — so a screen reader heard "Resume, button" with no idea
	 * which project, on the one surface whose whole job is picking a project.
	 *
	 * `aria-labelledby` lists the BUTTON ITSELF first and then the name element, so the
	 * accessible name is the concatenation and the translated verb stays whatever the translator
	 * wrote. Asserted as the RESOLUTION — the ids are looked up in the document and their text
	 * joined — rather than as an attribute string, because an `aria-labelledby` pointing at an id
	 * that does not exist is the failure mode that matters and reads identically as an
	 * attribute.
	 */
	it('gives both actions an accessible name carrying the project', () => {
		const wrapper = row();

		// `wrapper.find` is given a template literal at every call site, never a variable: oxlint's
		// `unicorn/no-array-callback-reference` reads `find(x)` as `Array#find` and refuses a
		// bare identifier as its argument, which vue-test-utils' unrelated `find` is not.
		function nameOf(ids: string | undefined): string {
			const parts: string[] = [];

			for (const id of (ids ?? '').split(' ')) parts.push(wrapper.find(`#${id}`).text());
			return parts.join(' ');
		}

		expect(nameOf(wrapper.find('.rp-continue__resume').attributes('aria-labelledby')))
			.toBe('Resume House Renovation 2026');
		expect(nameOf(wrapper.find('.rp-continue__open').attributes('aria-labelledby')))
			.toBe('Open project House Renovation 2026');
	});

	it('names the project AND the plan it will resume', () => {
		// §7's diagram is `House Renovation 2026 · Kitchen › Work`. Without the plan half the
		// row cannot answer "which plan will this open" on a project that has several — which
		// is the question Continue exists to answer.
		const text = row().text();

		expect(text).toContain('House Renovation 2026');
		expect(text).toContain('Kitchen');
	});

	it('names the project alone when the context holds no plan', () => {
		// Absent, not blank: an empty slot renders nothing and its neighbours close up.
		expect(row(null).find('.rp-continue__plan').exists()).toBe(false);
	});

	/**
	 * **THE DATE AND THE STATUS WORD ARE GONE, and their absence is the assertion.** Both were
	 * drawn beside the two actions and neither is in P00's or P06's card: the group heading
	 * already says what this is, and the project's own row below repeats every fact this card
	 * was restating. The formatter moved to `ProjectRow`, which is where P00's `Last worked`
	 * column lives — a relocation, not a deletion, and `projectRow.test.ts` holds it now.
	 *
	 * Asserted as the card's WHOLE text rather than as two absences, because the defect this
	 * forbids is the facts coming back under any name at all — and a `not.toMatch(/2026/)` was
	 * the first attempt and could not work: the fixture project is literally called `House
	 * Renovation 2026`, so the year is in the name this card must draw. An exhaustive equality
	 * is the only reading that tells a restated fact from a legitimate one.
	 */
	it('restates neither the date nor the status the row below already carries', () => {
		expect(row().text()).toBe('House Renovation 2026KitchenResumeOpen project');
	});

	it('carries two actions, both ordinary controls', () => {
		const wrapper = row();

		expect(wrapper.find('.rp-continue__resume').text()).toBe('Resume');
		expect(wrapper.find('.rp-continue__open').text()).toBe('Open project');
		// Ordinary tab stops, not members of a roving group — which is the other half of why
		// this row sits outside the Projects list rather than at the top of it.
		expect(wrapper.find('.rp-continue__resume').attributes('tabindex')).toBeUndefined();
	});

	it('emits resume and open separately', async () => {
		const wrapper = row();

		await wrapper.find('.rp-continue__resume').trigger('click');
		await wrapper.find('.rp-continue__open').trigger('click');

		// Two different destinations: Continue restores where the user was, Open always goes to
		// the project's detail state. That distinction is what the usability script tests.
		expect(wrapper.emitted('resume')).toHaveLength(1);
		expect(wrapper.emitted('open')).toHaveLength(1);
	});

	it('opens the note from Open on the platform modifier, and on nothing else', async () => {
		const wrapper = row('plan-1');
		const open = wrapper.find('.rp-continue__open');

		await open.trigger('click', { ctrlKey: true });
		await open.trigger('auxclick', { button: 1 });
		// `Platform.isMacOS` is false in the mock, so `Meta` is the rejected key here — standing
		// for macOS's `Ctrl`, where the same fall-through would hijack the secondary click.
		await open.trigger('click', { metaKey: true });

		expect(wrapper.emitted('openNote')).toHaveLength(2);
		expect(wrapper.emitted('open')).toBeUndefined();
	});

	/**
	 * **The autoscroll widget is a default action of `mousedown`, not of `auxclick`** — by the
	 * time `auxclick` fires (on release) Chrome has already opened it, so `preventDefault()` there
	 * suppresses nothing. `ProjectRow` was fixed for exactly this and this row shipped the pre-fix
	 * shape three tasks later, with only the `auxclick` arm driven — so the case is written the
	 * same way its sibling is, dispatching by hand rather than through `.trigger()` because this
	 * needs the event object itself to read `defaultPrevented` back off it.
	 */
	it('suppresses the autoscroll widget at mousedown, where auxclick cannot reach it', () => {
		const wrapper = row();
		const pressed = new MouseEvent('mousedown', { button: 1, bubbles: true, cancelable: true });

		wrapper.find('.rp-continue__open').element.dispatchEvent(pressed);

		expect(pressed.defaultPrevented).toBe(true);
	});

	it('leaves every other button’s mousedown on Open alone', () => {
		const wrapper = row();
		const pressed = new MouseEvent('mousedown', { button: 0, bubbles: true, cancelable: true });

		wrapper.find('.rp-continue__open').element.dispatchEvent(pressed);

		expect(pressed.defaultPrevented).toBe(false);
	});

	it('ignores the secondary button on Open, which belongs to the context menu', async () => {
		const wrapper = row();

		await wrapper.find('.rp-continue__open').trigger('auxclick', { button: 2 });

		expect(wrapper.emitted('openNote')).toBeUndefined();
	});

	it('gives Continue no modifier gesture at all', async () => {
		// Resume restores a CONTEXT, and a note is not one. A modifier here would have to mean
		// something this row has never been asked to define, so it means nothing.
		const wrapper = row('plan-1');

		await wrapper.find('.rp-continue__resume').trigger('click', { ctrlKey: true });

		expect(wrapper.emitted('openNote')).toBeUndefined();
		expect(wrapper.emitted('resume')).toHaveLength(1);
	});

	it('still offers both actions when the context names no plan', () => {
		// Continue on a project is a real gesture: it goes to the detail state, same as Open,
		// and the row does not become a different shape for it.
		const wrapper = row(null);

		expect(wrapper.find('.rp-continue__resume').exists()).toBe(true);
		expect(wrapper.find('.rp-continue__open').exists()).toBe(true);
	});
});
