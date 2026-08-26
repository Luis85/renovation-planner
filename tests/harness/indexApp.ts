import { defineAsyncComponent, type Component } from 'vue';
import VueKonva from 'vue-konva';
import { harnessEditorContext, seedFixture } from './fixture';
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
