import { defineAsyncComponent, type Component } from 'vue';
import { mount, type VueWrapper } from '@vue/test-utils';
import VueKonva from 'vue-konva';
import IndexPage from './IndexPage.vue';
import { harnessEditorContext, seedFixture } from './fixture';
import { settle } from '../helpers/editor';
import { PLAN_EDITOR_CONTEXT } from '../../src/presentation/editor/PlanEditorContext';
import { componentEntries, prototypeEntries, registrableComponents } from './entries';

/**
 * The app configuration `tests/harness/page.ts` gives the index, as ONE object two test files
 * mount through — so a test's `IndexPage` is configured the way the browser's is rather than
 * by whatever each file happened to need.
 *
 * It exists because the fourth step below was missing from the only version of this that
 * existed, and the omission was a live trap rather than a gap in coverage. `openIndex` in
 * `indexPage.test.ts` installed Pinia, VueKonva and `PLAN_EDITOR_CONTEXT` under a docblock
 * claiming it mirrored `page.ts` — and `page.ts` also registers every discovered component
 * and mock on the app. Adding `src/prototypes/ZonePanel.vue` (a template-only mock composing
 * `<StatusBar />`, which is the feature's headline workflow) turned that file's
 * `it.each(real.prototypeEntries())` loop RED against correct work, with Vue's
 * `Failed to resolve component: StatusBar` classified as `did not render cleanly` and the
 * message naming the prototype. `CLAUDE.md`: a fake must not be kinder than the real thing —
 * and not thinner either.
 *
 * The registry is the one step with no production twin to read it from: `PlanEditorView` does
 * the other three, so `tests/build/harness-shot.test.ts` pins those against production's own
 * source. This one is the index's own, which is why it is pinned against THIS file instead.
 *
 * What it deliberately does NOT mirror is `page.ts`'s console reporting of `shadowed` and
 * `ambiguous` tags. Those two lines tell a person at a browser which mock took which tag; under
 * test the consequence is what matters, and `IndexPage.vue` already turns an unresolved tag into
 * a named entry failure a case can assert on.
 *
 * Called per mount rather than built once: `seedFixture()` creates and installs a fresh Pinia,
 * and two mounts sharing one would share whatever the first left behind — the reproducibility
 * the fixture exists for.
 */
export function indexAppConfig(): {
	plugins: unknown[];
	provide: Record<symbol, unknown>;
	components: Record<string, Component>;
} {
	// BOTH kinds, exactly as `page.ts` does it, and through the same function: a top-level
	// prototype composes the mocks written beside it as well as the real components, and a
	// template-only file can import neither.
	const { byTag } = registrableComponents([...componentEntries(), ...prototypeEntries()]);

	return {
		plugins: [seedFixture(), VueKonva],
		provide: { [PLAN_EDITOR_CONTEXT as symbol]: harnessEditorContext() },
		// `defineAsyncComponent`, as `page.ts` registers them — not the resolved components.
		// That is not fidelity for its own sake: an async child is a dependency of the
		// `<Suspense>` boundary `IndexPage.vue` marks the stage from, so registering resolved
		// components would settle the subtree a tick earlier than the browser does and would
		// take the readiness question this page is built around out of the test entirely.
		components: Object.fromEntries(
			[...byTag].map(([tag, entry]) => [tag, defineAsyncComponent(entry.component as () => Promise<Component>)]),
		),
	};
}

/**
 * The index mounted at one URL, for the files that drive the REAL entry list.
 *
 * `?entry=` is read in `setup()`, so the URL has to be on `window.location` BEFORE the mount
 * rather than after it — which is why this is a function and not a fixture.
 *
 * `indexPage.test.ts` deliberately does NOT use this and keeps its own copy. That file stubs
 * the glob module with `vi.mock` and imports `IndexPage.vue` afterwards so the stub is what the
 * page discovers; a shared helper that imported the page at module scope would resolve it
 * before the mock was installed and hand that file the real entry list under a fake's name. The
 * duplication is the honest reading of two different jobs, not a copy nobody noticed.
 */
export async function openIndex(query: string): Promise<VueWrapper> {
	window.history.replaceState({}, '', query === '' ? '/' : `/?${query}`);

	const host = document.createElement('div');

	document.body.appendChild(host);

	const wrapper = mount(IndexPage, { attachTo: host, global: indexAppConfig() });

	/*
	 * Settled until the page has REACHED a state, not for a fixed number of flushes.
	 *
	 * `?entry=` opens through a real dynamic import of a real `.vue` file, and the first one in
	 * a worker is cold — Vite has to transform it. A fixed `await settle()` returned with the
	 * page still mid-`open()`: no stage marker, no failure card, `Pick an entry.` on screen. The
	 * caller then asserted about a page that had not finished loading, and the shape of the
	 * damage is worth naming because it is not a flake: whichever file happened to import that
	 * component EARLIER made the same helper work, so the same line passed in one suite and
	 * failed in another for reasons neither file could see.
	 *
	 * `settle()` is still what does the flushing; this only decides when to stop calling it.
	 * The bound is a real bound rather than a spin — a component that never resolves must fail
	 * the caller's own assertion, not hang the run.
	 */
	const wantsEntry = new URLSearchParams(window.location.search).has('entry');
	for (let flush = 0; flush < 50; flush += 1) {
		await settle();
		if (!wantsEntry) break;
		const resolved =
			wrapper.find('.rp-harness-stage').attributes('data-entry') !== undefined ||
			wrapper.find('.rp-harness-failure').exists();
		if (resolved) break;
	}

	return wrapper;
}
