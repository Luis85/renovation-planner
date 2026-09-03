/**
 * The 320px unsupported-width shell's own overflow question, split into a page-side read and a
 * Node-side judgement — R13, closing "Unsupported width has no horizontal-overflow check".
 * jsdom lays nothing out, so `tests/presentation/editor/shell/responsiveShell.test.ts` can
 * assert the layout MODE at 320px and nothing about whether the rendered shell actually fits it;
 * this pair is what a real browser answers instead, through `harness-shot.mjs`'s `measure`
 * field on the `plan-editor-unsupported` shot.
 */

/**
 * What the page is asked, serialised into the browser by `page.evaluate` — self-contained, with
 * no reference to anything outside this function, because Playwright stringifies it and sends
 * it across the wire rather than calling it in this process. `null` for a shell that is not
 * there to measure, which `overflowFinding` below turns into its own named failure rather than
 * letting a `null.scrollWidth` read throw a TypeError with no shot name attached to it.
 */
export function shellMetrics(selector) {
	const el = document.querySelector(selector);
	return el === null ? null : { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth };
}

/**
 * The rule itself, judged in Node rather than in the page: `tests/build/captureMeasures.test.ts`
 * can drive every branch with a plain object and no browser, where the page-side half above has
 * nothing left to unit-test once it is known to call `document.querySelector` and read two
 * properties back.
 *
 * `null` is the finding for a shell that fits — the ordinary, expected outcome for every run
 * that is not reproducing the regression this measurement exists to catch.
 */
export function overflowFinding(name, metrics) {
	if (metrics === null) return `[${name}] no .rp-editor-shell to measure`;
	if (metrics.scrollWidth <= metrics.clientWidth) return null;
	return `[${name}] .rp-editor-shell scrolls horizontally: scrollWidth ${metrics.scrollWidth} > clientWidth ${metrics.clientWidth}`;
}
