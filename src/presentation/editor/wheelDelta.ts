/**
 * What a wheel event's delta MEANS in screen pixels — extracted from `PlanCanvas.vue` when
 * that file crossed its line cap, the same reason `pointerButtons.ts` exists, and kept apart
 * from it because this is a question about `deltaMode` rather than about buttons.
 */

/**
 * One wheel notch as SCREEN PIXELS, whatever unit the browser chose to report it in.
 *
 * `WheelEvent.deltaMode` says what the numbers mean — pixels (0), lines (1) or pages (2) —
 * and a line-mode notch reports `3`. Read as pixels that pans three of them, which looks
 * like a broken gesture rather than an absent one.
 *
 * **Where this actually bites, stated narrowly because the general claim would be wider than
 * the truth:** Obsidian is Electron and Chromium reports pixel mode, so the plugin is
 * unlikely ever to see anything else. `npm run harness` is the surface that can — it runs in
 * whatever browser a designer opens, and line mode is Firefox's historical default. Cheap
 * and tested beats resting the gesture on a host not changing its mind.
 *
 * The two constants are the conventional approximations rather than measurements: there is
 * no API for a line's height, and the browsers that report line mode use a comparable
 * figure. The ZOOM path deliberately does NOT go through here — its exponential sensitivity
 * was tuned against raw `deltaY` and shipped that way, and re-scaling it would change how
 * zoom feels for a case Obsidian does not produce.
 */
const WHEEL_LINE_PX = 16;
const WHEEL_PAGE_PX = 800;

export function wheelPixels(amount: number, deltaMode: number): number {
	if (deltaMode === 1) return amount * WHEEL_LINE_PX;
	if (deltaMode === 2) return amount * WHEEL_PAGE_PX;
	return amount;
}
