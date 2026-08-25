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
import { createPinia } from 'pinia';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import ViewRoot from '../../../src/presentation/views/ViewRoot.vue';
import { useDialogStore } from '../../../src/presentation/dialogs/dialog-store';

describe('the view root', () => {
	/**
	 * The one class `styles/view.css` keys off, and the one the view used to create itself
	 * before the component existed. Asserted here so a rename cannot silently strip the
	 * stylesheet's only entry point into this view.
	 *
	 * Mounted with a Pinia now too: `DialogHost` (slice 15) lives in this tree and reads
	 * `useDialogStore()` on setup, which throws with no active Pinia to find.
	 */
	it('renders the element the stylesheet keys off', () => {
		const wrapper = mount(ViewRoot, { global: { plugins: [createPinia()] } });

		expect(wrapper.classes()).toContain('renovation-planner-view');
	});

	/**
	 * Slice 15's host, mounted in THIS app too, not only the Plan Editor's: slice 14's
	 * "Create a project" empty-state action opens a dialog from this view, and a host that
	 * only ever mounted beside a `PlanCanvas` would leave that click with nothing to open.
	 */
	it('mounts a dialog host that the view can open a dialog through', async () => {
		const pinia = createPinia();
		const wrapper = mount(ViewRoot, { global: { plugins: [pinia] } });
		const store = useDialogStore(pinia);

		void store.openDialog({ kind: 'confirm', title: 'T', message: 'M' });
		await nextTick();

		expect(wrapper.find('.rp-dialog').exists()).toBe(true);
	});
});
