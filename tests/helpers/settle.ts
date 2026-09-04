/**
 * `settle()`/`settleUntil()` — the suite's own async-flush helpers — pulled out of
 * `tests/helpers/editor.ts` so a caller that needs only THESE can have them without the rest
 * of that file's imports.
 *
 * That split is not tidiness: `tests/helpers/editor.ts` imports Konva, Pinia, `@vue/test-utils`
 * and `tests/helpers/canvas.ts` (which imports `@napi-rs/canvas`, a NATIVE binding). Those are
 * fine inside a jsdom test process, and they are not importable at all inside the browser
 * harness — `tests/harness/planEditor.ts` is served to a real page by Vite's dev server
 * (`npm run harness`/`npm run harness-shot`), and Vite's dependency optimizer tried to bundle
 * `@napi-rs/canvas`'s platform `.node` binary as a JS module the one time this file's two
 * functions were imported from `editor.ts` there instead of from here — "stream did not
 * contain valid UTF-8", failing the optimizer outright and timing out every single fixed shot,
 * not only the Plan Editor's, because `page.ts` imports `planEditor.ts` for every route. This
 * module has no import of its own beyond `Promise`/`Date`/`setTimeout`, so nothing that reaches
 * it can drag a Node-only native binding into a browser bundle.
 *
 * `tests/helpers/editor.ts` re-exports both names, so its 48 existing importers see no change.
 */

/**
 * Two ticks, not one. Hydration awaits two query promises before it sets `ready`, and Vue
 * then needs its own flush to mount the canvas that appears as a result — a single
 * `nextTick` resolves before the second query and the canvas is not there yet.
 */
export async function settle(): Promise<void> {
	for (let index = 0; index < 4; index += 1) await Promise.resolve();
	await new Promise((resolve) => {
		setTimeout(resolve, 0);
	});
}

/**
 * How long `settleUntil` will wait before giving up.
 *
 * **A DEADLINE and not a round count, which is the whole fix**; the number below is chosen to
 * sit under vitest's 5000 ms default so a genuine regression still fails as this helper's own
 * named error rather than as an anonymous test timeout — the property the round bound was
 * really protecting.
 */
const SETTLE_BUDGET_MS = 4_000;

/**
 * `settle()` until something is TRUE, rather than a fixed number of times.
 *
 * `settle()` alone is a fixed four microtasks and one macrotask, which is enough for Vue
 * and for a resolved query but NOT for a real image decode: `tests/helpers/canvas.ts` puts
 * `@napi-rs/canvas` behind `<img>.decode()`, so a background landing is real work whose
 * duration depends on the machine. That made "the fast load has landed" a race — it failed
 * once in a full-suite run while a PDF test was rasterizing two million pixels beside it,
 * and passed on every isolated run, which is the signature of a fixed-tick wait rather than
 * of a defect in the code under test.
 *
 * Bounded and NAMED on failure, both deliberately: an unbounded loop turns a real
 * regression into a hung suite, and "condition never held" with no subject is the least
 * useful failure a test can produce.
 *
 * **The bound was a round COUNT for four slices, and a count is the same mistake this
 * function exists to correct, moved up one level.** A round is four microtasks and one
 * `setTimeout(0)`, which Node clamps to about a millisecond — so fifty rounds is roughly
 * fifty milliseconds of wall clock, whatever the machine, while the work being waited on is
 * a cold Vite transform whose duration is entirely the machine's business. Measured rather
 * than reasoned: `openIndex('entry=prototype:ZonePanel')` settles in four to six rounds
 * locally, which reads as a tenfold margin and is nothing of the sort — it is five
 * milliseconds against fifty, and `verify (ubuntu-latest, 26)` spent all fifty and failed
 * while the three prototypes scanned before it passed.
 *
 * **Warming the entry module first was tried and is NOT sufficient**, which is what settled
 * the fix as a deadline rather than a pre-load. `HarnessEntry.component` is a real loader, so
 * awaiting it moves that one transform out of the polled window — and with the budget starved
 * to a single round `ZonePanel` still failed, because it is a template-only mock composing a
 * real `<StatusBar />` that the index registers through `defineAsyncComponent`. The nested
 * component resolves lazily, INSIDE the window, and no list of things to warm stays correct as
 * mocks compose more of them. A deadline needs no such list.
 *
 * `Date.now()` rather than `performance.now()`: this is a coarse bound on real work, the
 * numbers are milliseconds apart from each other, and jsdom gives the former unconditionally.
 */
export async function settleUntil(
	condition: () => boolean | Promise<boolean>,
	what: string,
): Promise<void> {
	// The predicate may be ASYNC: the slice-8 e2e rig waits on vault reads, and it grew its
	// own second copy of this loop — with a different budget and different failure
	// text — because the signature did not allow one. A flake fixed by raising the budget
	// here has to reach every caller, so there is one budget.
	const deadline = Date.now() + SETTLE_BUDGET_MS;
	for (;;) {
		// Asked BEFORE the deadline test, so a condition that became true during the final
		// `settle()` still returns rather than being thrown away by the clock — the same
		// re-check the round-bounded version made after its loop.
		if (await condition()) return;
		if (Date.now() >= deadline) {
			throw new Error(`Timed out after ${SETTLE_BUDGET_MS}ms waiting for: ${what}`);
		}
		await settle();
	}
}
