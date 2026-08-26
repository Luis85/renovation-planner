// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import IndexPage from './IndexPage.vue';
import { prototypeEntries } from './entries';
import { indexAppConfig } from './indexApp';
import { installEditorEnvironment, settleUntil } from '../helpers/editor';

/**
 * The index driving the REAL tree: the real `import.meta.glob`, the real component registry,
 * real prototypes and real components — no `vi.mock`, no fixture entry, nothing stubbed.
 *
 * `indexPage.test.ts` is the sibling and the split is by SUBJECT: that file mocks `./entries`
 * file-wide so it can plant a module that rejects, a component that throws and a warning
 * raised after the reader navigated away — none of which a glob over the tree can produce.
 * This file is the other half, where what is under test is precisely that the tree, the
 * registry and the shared fixture work together on a real file.
 *
 * The split was also forced, and the number is worth recording because a review round got it
 * backwards. `eslint.config.mjs`'s `files: [`${TESTS}/*.ts`]` block caps a test file at 450
 * lines (blank and comment lines skipped), `TESTS` is `**\/tests/**`, and that pattern DOES
 * reach `tests/harness/` — asked of ESLint's own `calculateConfigForFile`, not read off the
 * glob. `indexPage.test.ts` measured 449 of its 450 lines the day this landed, so the two
 * cases below could not be added to it and the registry fix could not be either.
 *
 * **What the first case here holds is the feature's headline workflow, and until this file
 * existed nothing held it at all**: `registrableComponents` was unit-tested as a pure
 * function, the `app.component` loop in `page.ts` was covered by a source scan, and no test
 * anywhere mounted a prototype that COMPOSED anything. The gap was not academic — see
 * `indexApp.ts` for what adding one correct prototype did to the suite before it was closed.
 */

/**
 * The index at a URL, with `page.ts`'s own app config. No `?entry=` handling of its own:
 * `IndexPage` reads `window.location` in `setup()`, so the URL has to be set before the mount.
 */
async function openEntry(id: string): Promise<VueWrapper> {
	window.history.replaceState({}, '', `/?entry=${encodeURIComponent(id)}`);

	const host = document.createElement('div');

	document.body.appendChild(host);

	const wrapper = mount(IndexPage, { attachTo: host, global: indexAppConfig() });

	// The OUTCOME rather than a tick count. A real entry's `component()` is a genuine dynamic
	// `import()` through the module runner — real I/O whose duration this file does not
	// control — and a composing prototype waits on a second one for each tag it resolves. So
	// this waits for the stage to name what it rendered or for a failure card to appear, which
	// is what `settleUntil` is for (`tests/helpers/editor.ts`, written for a real image decode).
	await settleUntil(
		() =>
			wrapper.find('.rp-harness-stage').attributes('data-entry') !== undefined ||
			wrapper.find('.rp-harness-failure').exists(),
		`${id} to settle`,
	);

	return wrapper;
}

beforeEach(() => {
	installEditorEnvironment();
	document.body.replaceChildren();
});

describe('a template-only prototype composing what it cannot import', () => {
	/**
	 * `src/prototypes/ZonePanel.vue` is a `<template>` and nothing else — no script block, so
	 * no imports are even possible — and it writes `<StatusBar />` (a REAL component, from
	 * `src/presentation/editor/shell/`) beside `<ZoneSummary />` (the mock next to it). Both
	 * tags resolve only because the app carries the registry `indexAppConfig()` builds, and
	 * both KINDS are asserted because `page.ts` registers both and a registry built from
	 * components alone would leave `<ZoneSummary />` unresolved — half the main flow.
	 *
	 * The three assertions are three different claims and none implies another. `data-entry`
	 * says the whole subtree resolved CLEANLY: `IndexPage.vue` classifies every Vue warning as
	 * a defect and clears the marker for one, and `Failed to resolve component` is a warning —
	 * so an unregistered tag makes this absent rather than merely rendering less. The plan name
	 * is the shared fixture reaching a real component with no per-entry setup (criterion 6),
	 * and it is a value only the seeded store can produce. The mock's own text is the sibling
	 * half of the registry.
	 */
	it('resolves a real component and a sibling mock through the app registry', async () => {
		const page = await openEntry('prototype:ZonePanel');

		expect(page.find('.rp-harness-failure').exists()).toBe(false);
		expect(page.find('.rp-harness-stage').attributes('data-entry')).toBe('prototype:ZonePanel');
		// `StatusBar` renders `plan.name` — `HARNESS_PLAN`'s, through the seeded fixture.
		expect(page.text()).toContain('Ground floor');
		// `ZoneSummary`'s own markup, which is what says the PROTOTYPE half of the registry works.
		expect(page.text()).toContain('Kitchen');

		page.unmount();
	});
});

/**
 * CRITERION 5's sixth route, and the one no source scan can see: a template can render a real
 * stylesheet `<link>` with no import and no build step at all.
 * `<component is="link" rel="stylesheet" href="…/concept.css" />` is valid Vue and produces a
 * genuine one, and `<component :is="tag">` with a computed value is not statically knowable
 * even in principle. `harness.test.ts`'s three cases all read SOURCE — the page's HTML, the
 * module graph, a sheet's own `@import`s — and none of them can see a node a render produces.
 *
 * So this asks the DOCUMENT instead, once an entry has mounted through the index — the only
 * place every route, thought of or not, converges on. **It does not replace the source scans**:
 * those catch a sheet in the edit loop, before anything runs, and they cover the whole of `src/`
 * and `tests/helpers/`, most of which nothing here ever mounts. This closes the category for the
 * entries a test actually drives; neither instrument subsumes the other, and the next reader
 * should not delete one for the other.
 *
 * Mounting through `IndexPage` rather than importing a component directly is what makes the
 * check mean anything: the question is what the PAGE ends up with, which is exactly what
 * `open()`'s async pipeline and `<Suspense>` decide — not what one component renders in
 * isolation.
 */

/** Module scope because it captures nothing per-call; `unicorn/consistent-function-scoping`. */
const cssNodes = (): number => document.querySelectorAll('link[rel~=stylesheet i], style').length;

describe('the harness index, the one-sheet claim over the rendered document', () => {
	/**
	 * The control. It proves the mounting path and the counting work, so the loop below is not
	 * silently doing nothing while the prototypes tree is empty — a reader who finds an
	 * `it.each` with zero iterations and no control has no way to tell "covers nothing today"
	 * from "broken". A COMPONENT rather than a prototype, and deliberately so: it cannot exercise
	 * the `<component is="link">` route at all (nothing here composes one into it), which is
	 * exactly why the loop beneath it — over real PROTOTYPES — is not redundant with this one.
	 *
	 * **The `data-entry` assertion is load-bearing, not decoration.** `openEntry` settles on
	 * EITHER the stage naming what it rendered OR a failure card — so an id that resolves to
	 * nothing, a module that fails to import, or one that throws would all still leave the CSS
	 * count unchanged and this test green, while silently proving nothing about a mount that
	 * actually happened. Asserting the id the stage actually rendered is what keeps this case
	 * failing when `component:editor/shell/StatusBar` stops resolving — a renamed file, a moved
	 * one, a broken glob — rather than degrading into "a failure card adds no stylesheet".
	 */
	it('adds no stylesheet to the document when a component mounts', async () => {
		const before = cssNodes();

		const page = await openEntry('component:editor/shell/StatusBar');

		expect(page.find('.rp-harness-stage').attributes('data-entry')).toBe('component:editor/shell/StatusBar');
		expect(cssNodes()).toBe(before);

		page.unmount();
	});

	/**
	 * The real ones, from the real glob — EMPTY when Task 5 ran, before any prototype existed.
	 * Today the tree holds two, `ZoneSummary.vue` and `ZonePanel.vue`, so this `it.each` has two
	 * iterations and covers both — stated here rather than left for a reader to wonder about.
	 * Neither landed with an edit to this loop: `prototypeEntries()` re-globs at file-load time,
	 * which is the same "the tree is the registration" property the whole feature is built on,
	 * turned on its own guard.
	 *
	 * **Carries the control's `data-entry` assertion too, and it is load-bearing here for the
	 * same reason** (see the control's own comment): without it, a prototype that fails to
	 * import or throws while rendering would still leave the CSS count unchanged and this case
	 * green, having never actually inspected what mounted. A round of review that added the
	 * control's assertion without this one found exactly that gap: a prototype planted to throw
	 * made the loop pass.
	 */
	it.each(prototypeEntries())('adds no stylesheet when $id mounts', async ({ id }) => {
		const before = cssNodes();

		const page = await openEntry(id);

		expect(page.find('.rp-harness-stage').attributes('data-entry')).toBe(id);
		expect(cssNodes()).toBe(before);

		page.unmount();
	});
});
