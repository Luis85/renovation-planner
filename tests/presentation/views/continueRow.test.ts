/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import ContinueRow from '../../../src/presentation/views/ContinueRow.vue';
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
	it('is drawn in the same armature as every other row', () => {
		// Distinguished by its group heading and its second action, NEVER by being a different
		// shape. A raised card above a flat list is the composition this direction did not lock.
		expect(row().find('.rp-project-list__row').exists()).toBe(true);
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

	it('dates itself by lastWorked', () => {
		const text = row().text();

		// An ABSOLUTE short date, not a relative time: relative needs a live ticker and makes
		// every test time-dependent.
		expect(text).toMatch(/2026/);
	});

	it('carries two actions, both ordinary controls', () => {
		const wrapper = row();

		expect(wrapper.find('.rp-continue__resume').text()).toBe('Continue');
		expect(wrapper.find('.rp-continue__open').text()).toBe('Open');
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
