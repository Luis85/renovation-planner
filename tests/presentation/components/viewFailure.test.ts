/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import ViewFailure from '../../../src/presentation/components/ViewFailure.vue';

describe('ViewFailure', () => {
	it('renders the headline and body it is given', () => {
		const wrapper = mount(ViewFailure, {
			props: { headline: 'Projects could not be loaded', body: 'The vault refused the read.' },
		});

		expect(wrapper.find('.rp-view-failure__headline').text()).toBe(
			'Projects could not be loaded',
		);
		expect(wrapper.find('.rp-view-failure__body').text()).toBe('The vault refused the read.');
	});

	it('renders no action button when it has no label', () => {
		// Absent, never an empty string: `''` renders a nameless button, which is both a live
		// control that does nothing and an axe `button-name` violation. Same rule
		// `resolveEmptyState` already keeps for the empty state's own action.
		const wrapper = mount(ViewFailure, { props: { headline: 'h', body: 'b' } });

		expect(wrapper.find('.rp-view-failure__action').exists()).toBe(false);
	});

	it('emits action when its button is pressed', async () => {
		const wrapper = mount(ViewFailure, {
			props: { headline: 'h', body: 'b', actionLabel: 'Try again' },
		});

		await wrapper.find('.rp-view-failure__action').trigger('click');

		expect(wrapper.emitted('action')).toHaveLength(1);
	});

	it('is not an empty state, structurally', () => {
		// The slice document's rule is that a failure must NEVER read as legitimately-absent
		// data — "create your first project" shown because a vault read failed is actively
		// misleading. Two components rather than one mode of one makes that a fact about the
		// markup instead of a convention about the copy, and keeps every assertion and the axe
		// case that key on `.rp-empty-state` meaning what they mean.
		const wrapper = mount(ViewFailure, { props: { headline: 'h', body: 'b' } });

		expect(wrapper.find('.rp-empty-state').exists()).toBe(false);
		expect(wrapper.find('.rp-view-failure').exists()).toBe(true);
	});

	it('announces itself, because it replaces content the user did not ask to lose', () => {
		const wrapper = mount(ViewFailure, { props: { headline: 'h', body: 'b' } });

		expect(wrapper.find('.rp-view-failure').attributes('role')).toBe('alert');
	});
});
