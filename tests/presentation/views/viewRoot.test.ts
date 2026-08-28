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
import {
	RENOVATION_PROJECT_CONTEXT,
	useRenovationProjectContext,
} from '../../../src/presentation/views/RenovationProjectContext';
import { ok } from '../../../src/core/result/Result';
import { unavailableRenovationProjectCommands } from '../../../src/presentation/views/renovationProjectCommands';
import type { RenovationProjectDeps } from '../../../src/presentation/views/RenovationProjectContext';

/**
 * A context this file's cases can mount against, answering an empty list with nothing refused
 * (`ok({ projects: [], unreadable: 0 })`): neither case here is about the project list or its
 * empty state (that is `tests/presentation/views/renovationProjectEmptyState.test.ts`'s job)
 * — it is about `DialogHost` and the stylesheet hook, so the list only needs to be SOMETHING
 * the view can hydrate against without throwing. `commands` and `openProject` are the same
 * refusal bundle and no-op neither case here dispatches through.
 */
const deps: RenovationProjectDeps = {
	queries: { listProjects: () => Promise.resolve(ok({ projects: [], unreadable: 0 })) },
	commands: unavailableRenovationProjectCommands(),
	openProject: () => Promise.resolve(),
};

describe('the view root', () => {
	/**
	 * The one class `styles/view.css` keys off, and the one the view used to create itself
	 * before the component existed. Asserted here so a rename cannot silently strip the
	 * stylesheet's only entry point into this view.
	 *
	 * Mounted with a Pinia now too: `DialogHost` (slice 15) lives in this tree and reads
	 * `useDialogStore()` on setup, which throws with no active Pinia to find. Design slice
	 * 14 adds the second requirement this mount has to satisfy: `useRenovationProjectContext`
	 * throws with no provided context, so `global.provide` supplies one here.
	 */
	it('renders the element the stylesheet keys off', () => {
		const wrapper = mount(ViewRoot, {
			global: { plugins: [createPinia()], provide: { [RENOVATION_PROJECT_CONTEXT as symbol]: deps } },
		});

		expect(wrapper.classes()).toContain('renovation-planner-view');
	});

	/**
	 * Slice 15's host, mounted in THIS app too, not only the Plan Editor's. `noProjects`
	 * ships with no action button (slice 14's Amendment 1), so there is no click here to
	 * open a dialog with yet — this asserts the host is reachable at all, ahead of the later
	 * slice whose creation form will be its first caller in this tree.
	 */
	it('mounts a dialog host that the view can open a dialog through', async () => {
		const pinia = createPinia();
		const wrapper = mount(ViewRoot, {
			global: { plugins: [pinia], provide: { [RENOVATION_PROJECT_CONTEXT as symbol]: deps } },
		});
		const store = useDialogStore(pinia);

		void store.openDialog({ kind: 'confirm', title: 'T', message: 'M' });
		await nextTick();

		expect(wrapper.find('.rp-dialog').exists()).toBe(true);
	});
});

/**
 * `useRenovationProjectContext` mirrors `usePlanEditorContext`'s guard (see
 * `tests/presentation/editor/units.test.ts`'s "the editor context guard"): there is no
 * sensible degraded behaviour for a view with no query services, so it throws rather than
 * mounting a plausible-looking empty pane over a composition mistake.
 */
describe('the renovation project context guard', () => {
	it('throws rather than mounting a view with nothing behind it', () => {
		expect(() => useRenovationProjectContext()).toThrow(/RenovationProjectContext/);
	});
});
