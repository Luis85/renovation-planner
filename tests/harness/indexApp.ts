import type { App } from 'vue';
import { mount, type VueWrapper } from '@vue/test-utils';
import VueKonva from 'vue-konva';
import IndexPage from './IndexPage.vue';
import { harnessEditorContext, seedFixture } from './fixture';
import { settle, settleUntil } from '../helpers/editor';
import { PLAN_EDITOR_CONTEXT } from '../../src/presentation/editor/PlanEditorContext';
import { componentEntries, prototypeEntries, registerEntries, registrableComponents } from './entries';

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
} {
	// BOTH kinds, exactly as `page.ts` does it, and through the same function: a top-level
	// prototype composes the mocks written beside it as well as the real components, and a
	// template-only file can import neither.
	const { byTag } = registrableComponents([...componentEntries(), ...prototypeEntries()]);

	return {
		plugins: [
			seedFixture(),
			VueKonva,
			// A PLUGIN rather than `global.components`, and installed after VueKonva, so this is
			// the same call in the same order the browser makes: `registerEntries` is what
			// refuses a tag a plugin already holds, and a `components` map would have gone in
			// through a different door and never met that refusal. `defineAsyncComponent` lives
			// in there too — see its own header for why resolving here would take the readiness
			// question this page is built around out of the tests entirely.
			{ install: (app: App) => void registerEntries(app, byTag) },
		],
		provide: { [PLAN_EDITOR_CONTEXT as symbol]: harnessEditorContext() },
	};
}

/**
 * Do the entry's cold Vite transform under a real `await`, BEFORE the page starts polling for
 * it.
 *
 * `settleUntil` below is bounded in ROUNDS, and a round is four microtasks and one
 * `setTimeout(0)` — so fifty of them are tens of milliseconds of wall clock, while
 * transforming a `.vue` file for the first time in a worker is tens of milliseconds too.
 * That margin is not a safety margin, it is a coin toss, and CI is where it lands badly:
 * `verify (ubuntu-latest, 26)` failed on `prototype:ZonePanel` while the three prototypes
 * scanned before it passed, which is what says the cost is per-MODULE and that no ordering
 * makes one of them "the cold one".
 *
 * `settle()`'s own docblock states the rule this applies: use it where the code under test is
 * detached and there is no promise to await, and where there IS one, await that instead. The
 * loader on `HarnessEntry` is exactly that promise, and the module registry is per worker, so
 * warming it here is the same module the page's `defineAsyncComponent` then resolves —
 * instantly. What remains inside the polled window is Vue rendering an already-loaded
 * component, which is what a round budget can honestly cover.
 *
 * **A WARM-UP, never the load**, which is why the rejection is swallowed. The page owns what
 * happens to a module that will not import — it renders a named failure card, and cases assert
 * on it. Letting this throw would replace that card with an exception out of the helper, so a
 * broken prototype would stop being a reported failure and become a crashed test.
 *
 * An unknown id warms nothing and falls through to the same failure card, which is what the
 * `?entry=does-not-exist` case drives.
 */
async function warmEntryModule(entryId: string | null): Promise<void> {
	if (entryId === null) return;
	const entry = [...prototypeEntries(), ...componentEntries()].find((one) => one.id === entryId);
	await entry?.component().catch(() => undefined);
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

	await warmEntryModule(new URLSearchParams(window.location.search).get('entry'));

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
	 * `settleUntil` is the shared loop and the shared round budget, which is the point of it
	 * having a home in `tests/helpers/editor.ts` — a hand-rolled version here (this function
	 * had one for an hour) is a second budget and a second failure message for the same wait.
	 * `indexRealEntries.test.ts` waits on exactly this condition through the same helper.
	 */
	if (new URLSearchParams(window.location.search).has('entry')) {
		await settleUntil(
			() =>
				wrapper.find('.rp-harness-stage').attributes('data-entry') !== undefined ||
				wrapper.find('.rp-harness-failure').exists(),
			`${query} to settle`,
		);
	} else {
		await settle();
	}

	return wrapper;
}
