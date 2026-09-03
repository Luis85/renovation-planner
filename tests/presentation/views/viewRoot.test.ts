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
import { defaultRenovationProjectDeps } from '../../helpers/makeRenovationProjectView';
import type { RenovationProjectDeps } from '../../../src/presentation/views/RenovationProjectContext';

/**
 * A context this file's cases can mount against, answering an empty list with nothing refused
 * (`ok({ projects: [], unreadable: 0 })`): neither case here is about the project list or its
 * empty state (that is `tests/presentation/views/renovationProjectEmptyState.test.ts`'s job)
 * — it is about `DialogHost` and the stylesheet hook, so the list only needs to be SOMETHING
 * the view can hydrate against without throwing. `commands` is the refusal bundle neither
 * case here dispatches through.
 *
 * Everything this file has no opinion about is spread from `defaultRenovationProjectDeps()`
 * rather than restated — `openProject` answering `'opened'` (so a click nothing here makes
 * could not set off a re-read), and design slice 21's five navigation members, whose choices
 * are documented once at that factory. What is overridden is what this file actually varies.
 *
 * `getProject`/`listPlansByProject` ANSWER rather than refuse, for CLAUDE.md's fifth
 * fake-instance reason: `projectId` is `null` here, so neither door is reached, and a bundle
 * that refused what production answers would be a fake harsher than the real thing sitting
 * where the next case to touch the detail state will read it.
 */
const deps: RenovationProjectDeps = {
	...defaultRenovationProjectDeps(),
	queries: {
		listProjects: () => Promise.resolve(ok({ projects: [], unreadable: 0 })),
		getProject: () => Promise.resolve(ok(null)),
		listPlansByProject: () => Promise.resolve(ok({ plans: [], unreadable: 0 })),
		listAssetPrices: () => Promise.reject(new Error('not exercised')),
	},
	commands: unavailableRenovationProjectCommands(),
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
	 * Slice 15's host, mounted in THIS app too, not only the Plan Editor's. This opens a
	 * plain `confirm` descriptor directly through the store rather than through the empty
	 * state's own button (`viewRootCreateProject.test.ts` covers that click, since design
	 * slice 16 gave it a real hand-off) — this file's job is only that the host is reachable
	 * at all, independent of any one caller.
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
