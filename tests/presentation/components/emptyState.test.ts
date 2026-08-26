/**
 * @vitest-environment jsdom
 *
 * The empty state's component contract (design slice 14, DoD 1).
 *
 * Presentation behaviour only: what renders, what is conditional, what one click emits.
 * Nothing here asserts WHICH empty state applies — that is `selectors.test.ts`'s, in node,
 * and asking a screen for it would waste the whole point of keeping the rule pure.
 */
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import EmptyState from '../../../src/presentation/components/EmptyState.vue';

const PROPS = { headline: 'No zones yet', body: 'Draw the first zone.' };

describe('EmptyState', () => {
	it('renders the headline as an h2 and the body', () => {
		const wrapper = mount(EmptyState, { props: PROPS });

		// h2, not h1 or h3: it is the level every other panel and dialog here uses
		// (InspectorPanel, LayersPanel, all four dialogs), and a skip is an axe
		// `heading-order` violation.
		expect(wrapper.find('h2.rp-empty-state__headline').text()).toBe('No zones yet');
		expect(wrapper.find('.rp-empty-state__body').text()).toBe('Draw the first zone.');
	});

	it('renders no button when there is no action label', () => {
		const wrapper = mount(EmptyState, { props: PROPS });

		expect(wrapper.find('button').exists()).toBe(false);
	});

	it('renders a named button when there is one, and emits once per click', async () => {
		const wrapper = mount(EmptyState, { props: { ...PROPS, actionLabel: 'Draw a zone' } });

		const button = wrapper.find('button.rp-empty-state__action');
		expect(button.text()).toBe('Draw a zone');

		await button.trigger('click');

		expect(wrapper.emitted('action')).toHaveLength(1);
	});

	/**
	 * The block form is the whole pane (the project view); the overlay form floats over a
	 * live Konva canvas. One class is the difference, and `styles/empty-state.css` hangs the
	 * `pointer-events` pair off it — so a missing modifier is a pointer trap over a canvas
	 * the user is trying to draw on.
	 */
	it('adds the overlay modifier only when asked', () => {
		expect(mount(EmptyState, { props: PROPS }).classes()).not.toContain('rp-empty-state--overlay');
		expect(mount(EmptyState, { props: { ...PROPS, overlay: true } }).classes()).toContain(
			'rp-empty-state--overlay',
		);
	});

	it('passes the icon slot through untouched', () => {
		const wrapper = mount(EmptyState, {
			props: PROPS,
			slots: { icon: '<svg data-test="given"></svg>' },
		});

		expect(wrapper.find('.rp-empty-state__icon [data-test="given"]').exists()).toBe(true);
	});

	/**
	 * The slot renders nothing on its own, deliberately. `CLAUDE.md`'s "Deliberately absent"
	 * list keeps icon rendering (`setIcon`) waiting for its first real caller, and none of
	 * this slice's three registry entries passes anything in — adding one here would be that
	 * trigger arriving as a side effect of an unrelated slice.
	 */
	it('draws nothing of its own in the icon slot', () => {
		const wrapper = mount(EmptyState, { props: PROPS });

		expect(wrapper.find('.rp-empty-state__icon').element.children).toHaveLength(0);
	});
});
