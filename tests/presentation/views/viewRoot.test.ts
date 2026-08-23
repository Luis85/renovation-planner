/**
 * @vitest-environment jsdom
 *
 * The view's root component, in isolation.
 *
 * This file's EXISTENCE is one of the checks: without `@vitejs/plugin-vue` in
 * `vitest.config.ts`, importing an SFC fails at parse — before any assertion runs and
 * before coverage can measure anything — so the proof that the plugin is wired is that
 * this suite executes at all, not an assertion inside it.
 */
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import ViewRoot from '../../../src/presentation/views/ViewRoot.vue';

describe('the view root', () => {
	/**
	 * The one class `styles/view.css` keys off, and the one the view used to create itself
	 * before the component existed. Asserted here so a rename cannot silently strip the
	 * stylesheet's only entry point into this view.
	 */
	it('renders the element the stylesheet keys off', () => {
		const wrapper = mount(ViewRoot);

		expect(wrapper.classes()).toContain('renovation-planner-view');
	});
});
