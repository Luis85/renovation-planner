/**
 * The re-check's own machinery, pulled out of `harness-shot.mjs` for the same reason
 * `entryShots` was pulled into `entryShots.mjs`: that file runs its capture at module scope
 * the moment it is imported, so nothing defined inside it can be called from a test without a
 * live Playwright browser. `reportIfNoLongerDrawn` — the post-screenshot re-check that closes
 * the exit-0 window a stale PNG could otherwise slip through — shipped with exactly that
 * problem: ten source-text pins covered the rest of this file's contract and this function had
 * none, because there was nowhere to import it FROM.
 *
 * `describeFailure` and `reportIfNoLongerDrawn` need only `page.textContent` and a caller-
 * supplied readiness predicate run through `page.evaluate` — neither needs a real page, a real
 * browser or `document`, so a plain object standing in for `page` is enough for a test to call
 * the real functions and observe what they actually do, the same shape `entryShots.test.ts`
 * uses for the filename contract.
 */

/**
 * What actually went wrong with a named entry, read from the page rather than guessed.
 *
 * `.rp-harness-failure` carries the real reason for all four ways an entry can fail —
 * `IndexPage.vue`'s `reportDefects`, the "no entry named …" check and the two `failure.value`
 * assignments in `open()` all write into it before this function's caller would ever be
 * waiting on it. Reading it is strictly more informative than the `Timeout 30000ms exceeded`
 * a bare `waitForFunction`/`waitForSelector` rejection gives, which says nothing about WHICH
 * of those four happened.
 *
 * A fixed shot (no `entry`) has no such card to read, so `fallback` — whatever the caller
 * already knows — is returned as-is. For a named entry, `fallback` is the last resort too:
 * the one case the card cannot cover, where the entry never loaded far enough to render
 * anything, including the failure branch.
 *
 * The read itself carries an explicit, short timeout rather than Playwright's 30-second
 * default: by the time anything calls this, the entry has already either failed (the card is
 * there now, or never will be) or the caller already has its own `fallback` reason from a
 * real timeout elsewhere. Waiting another 30 seconds for a card that a genuinely absent-without-
 * a-card failure will never produce would double the cost of every such shot for no gain in
 * what gets reported.
 */
export async function describeFailure(page, entry, fallback) {
	if (entry === undefined) return fallback;

	const text = await page.textContent('.rp-harness-failure', { timeout: 2000 }).catch(() => null);

	if (text) return `${entry}: ${text}`;
	return fallback ?? `${entry} rendered nothing and left no failure text to explain why`;
}

/**
 * The wait can pass and still lie. `IndexPage.vue`'s `settle()` documents a window it cannot
 * close from its own side: a defect first raised AFTER `<Suspense>` resolved clears
 * `data-entry` on a MICROTASK, so the readiness predicate can be true when the wait resolves
 * and false again by the time a screenshot is taken. Re-asking the identical question right
 * after the screenshot closes exactly that window — a clear observed within the screenshot's
 * own round-trip, and no wider a claim than that.
 *
 * What this does NOT close, stated rather than left implicit: a defect that arrives AFTER this
 * function has already run and returned true. The page was genuinely correct when this asked,
 * the PNG on disk is a true capture of that correct state, and the process still exits 0 — a
 * failure that shows up later is simply not something anything in this script is still looking
 * at. That is a different window from the one `settle()`'s own docstring describes: `settle()`
 * documents a defect landing BEFORE the wait resolves; this residual is a defect landing AFTER
 * this re-check has already resolved. Neither file closes it, and this paragraph is the one
 * place either says so.
 *
 * A no-op for a fixed shot (no `entry`): `waitForSelector`'s contract is presence, not "and
 * stays clean", and none of today's five fixed surfaces ever clears itself the way an
 * entry's Suspense boundary can.
 *
 * `hasDrawn` is the caller's readiness predicate (`entryHasDrawn` in `harness-shot.mjs`),
 * passed in rather than imported here: this function only ever calls it through
 * `page.evaluate` and reads the boolean back, so it has no dependency on the DOM-shaped code
 * the predicate itself contains — which is what lets a fake `page` drive this with no browser
 * and no `document` at all.
 */
export async function reportIfNoLongerDrawn(page, entry, name, errors, hasDrawn) {
	if (entry === undefined) return;
	if (await page.evaluate(hasDrawn, entry)) return;

	errors.push(`[${name}] captured a failure card, not the entry: ${await describeFailure(page, entry)}`);
}
