import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import { resolveChromiumExecutable } from './chromium.mjs';
import { resolveShots } from './entryShots.mjs';

/**
 * Headless capture of the browser harness — either the five fixed surfaces (the project
 * view's dark scheme, light scheme and `?phone`, plus the Plan Editor's dark and light
 * schemes) or, given an entry id, one named prototype or component in both schemes — for a
 * look nobody has to open a browser for. This is how a real layout defect was found earlier
 * in this plan (the view collapsing to 39px of a 700px pane): nothing in the suite could see
 * it because jsdom draws nothing, and a screenshot is the only artifact that shows it.
 *
 * What this is NOT: a test. It draws; it asserts no appearance, and there is no baseline
 * to diff against — the same reason `npm run harness` itself is outside `npm run check`.
 * It is deliberately absent from `npm run check` and from CI for that reason. It exits
 * non-zero on a page error or an uncaught console error, which is a narrower claim than
 * "the page looks right" — only that it did not fall over while being looked at.
 *
 * `playwright-core` and not `playwright`: the latter downloads browsers on `npm install`,
 * which this project's install must not do on a machine with no browser. So the browser has
 * to already be on disk, and finding it is `resolveChromiumExecutable` in `chromium.mjs` —
 * which asks playwright-core where it is rather than working it out, for reasons that
 * comment gives at length. It sits in its own file because `concept-shots.mjs` needs the
 * same answer, and two copies of it is the shape of the defect its history describes.
 */

const OUT_DIR = 'harness-shots';
const VIEWPORT = { width: 1280, height: 800 };
// Each surface's own mount point, which is what "the view has drawn" means here — not
// merely that the page loaded. Per shot rather than one constant, because the two
// surfaces draw different elements and a shot that waited for the WRONG one would time
// out on a page that had rendered perfectly.
const PROJECT_VIEW = '.renovation-planner-view';
const PLAN_EDITOR_VIEW = '.renovation-plan-editor-view';

const SHOTS = [
	{ name: 'dark', query: '', selector: PROJECT_VIEW },
	{ name: 'light', query: '?theme=light', selector: PROJECT_VIEW },
	{ name: 'phone', query: '?phone', selector: PROJECT_VIEW },
	// The Plan Editor in both schemes: it is the first surface with real content, and the
	// only place the layered Konva scene can be looked at outside a vault. No phone shot —
	// SDD §61 scopes the MVP to desktop, and a canvas editor is the least mobile of the
	// surfaces; add one when §61 changes.
	{ name: 'plan-editor-dark', query: '?view=plan-editor', selector: PLAN_EDITOR_VIEW },
	{ name: 'plan-editor-light', query: '?view=plan-editor&theme=light', selector: PLAN_EDITOR_VIEW },
];

/**
 * What "the entry has drawn" means — and it is NOT `.rp-harness-stage`.
 *
 * The stage element is mounted synchronously on the first paint, while the selected SFC is
 * still being imported. A capture waiting on the stage alone photographs "Pick an entry." and
 * exits 0: a successful, empty PNG. That is the worst thing this script can produce, because
 * the actor it exists for cannot see that the picture is blank — it would read a green exit
 * as "the mock looks like that".
 *
 * `IndexPage.vue` sets `data-entry` from `<Suspense>`'s `@resolve`, so it means the entry AND
 * every async component below it has settled — not merely that the outer module loaded, which
 * would still be a placeholder wherever a mock composes a real component. The node check waits
 * out the render tick after that and is belt and braces rather than the primary signal.
 *
 * Asked IN THE PAGE rather than as a CSS selector, deliberately. An id is built from a file
 * path, and a quote or a newline is a legal filename character on POSIX; interpolating one
 * into an attribute-value selector produces one that parses as something else or does not
 * parse at all, so the index could open an entry `harness-shot` could never capture.
 * Comparing `dataset.entry` as a STRING has no escaping question to get wrong — the class of
 * defect is removed rather than patched.
 *
 * `childNodes`, deliberately not the DOM's element-only equivalent. A template whose root is
 * TEXT — `<template>Coming soon</template>`, which is a perfectly good early mock — mounts a
 * text node and no element, so a check that required an ELEMENT child would time out on an
 * entry the index drew correctly and refuse a capture the guarantee promises. The marker is
 * what proves the screen settled; this is only the cheap sanity check that the stage is not
 * literally empty, and it must not be narrower than what a valid entry can render.
 */
const entryHasDrawn = (id) => {
	const stage = document.querySelector('.rp-harness-stage');

	return stage instanceof HTMLElement && stage.dataset.entry === id && stage.childNodes.length > 0;
};

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
 */
async function describeFailure(page, entry, fallback) {
	if (entry === undefined) return fallback;

	const text = await page.textContent('.rp-harness-failure').catch(() => null);

	if (text) return `${entry}: ${text}`;
	return fallback ?? `${entry} rendered nothing and left no failure text to explain why`;
}

/**
 * The fixed shots name a selector; a named entry names itself, and is compared as a string
 * in the page because a CSS attribute selector built from a file path is a quoting bug
 * waiting for the first filename with a `"` in it.
 */
async function waitUntilReady(page, selector, entry) {
	if (entry === undefined) await page.waitForSelector(selector, { state: 'attached' });
	else await page.waitForFunction(entryHasDrawn, entry);
}

/**
 * The wait can pass and still lie. `IndexPage.vue`'s `settle()` documents a window it cannot
 * close from its own side: a defect first raised AFTER `<Suspense>` resolved clears
 * `data-entry` on a MICROTASK, so `entryHasDrawn` can be true when the wait resolves and
 * false again by the time a screenshot is taken. Re-asking the identical question after the
 * screenshot is the only way to see that — a screenshot is not proof that what it captured is
 * still what the wait certified.
 *
 * A no-op for a fixed shot (no `entry`): `waitForSelector`'s contract is presence, not "and
 * stays clean", and none of today's five fixed surfaces ever clears itself the way an
 * entry's Suspense boundary can.
 */
async function reportIfNoLongerDrawn(page, entry, name, errors) {
	if (entry === undefined) return;
	if (await page.evaluate(entryHasDrawn, entry)) return;

	errors.push(`[${name}] captured a failure card, not the entry: ${await describeFailure(page, entry)}`);
}

/** One capture: navigate, wait for the real view to mount, screenshot, report any page or
 * console error back onto the shared list rather than throwing — one bad shot should not
 * cost the rest of the run its PNGs. */
async function captureOne(browser, baseUrl, { name, query, selector, entry }, errors) {
	const page = await browser.newPage({ viewport: VIEWPORT });

	page.on('pageerror', (error) => errors.push(`[${name}] page error: ${error.message}`));
	page.on('console', (msg) => {
		if (msg.type() === 'error') errors.push(`[${name}] console error: ${msg.text()}`);
	});
	// `console.warn` is deliberately NOT recorded here. `IndexPage.vue`'s `warnHandler` sends
	// EVERY Vue warning there unconditionally (attributed or not, late or not) — it is the one
	// channel a warning always reaches, on top of whatever else it does — so treating it as a
	// failure signal would fail a shot on a warning that never touched the entry on stage at
	// all, which is the false positive `warnHandler`'s own header goes out of its way to avoid
	// (`console.error` is its channel for that; see "Not dropped" there). The late-clear window
	// this file exists to close is closed by re-asking `entryHasDrawn` after the screenshot
	// (`reportIfNoLongerDrawn`), which reads the one thing that actually failed rather than a
	// channel carrying both real defects and noise.

	try {
		// 'load', not 'networkidle': Vite's dev server keeps an HMR websocket open, which
		// networkidle waits forever for.
		await page.goto(`${baseUrl}/${query}`, { waitUntil: 'load' });
		await waitUntilReady(page, selector, entry);

		const file = path.join(OUT_DIR, `${name}.png`);

		await page.screenshot({ path: file, fullPage: true });
		await reportIfNoLongerDrawn(page, entry, name, errors);

		console.log(`wrote ${file}`);
	} catch (error) {
		const reason = error instanceof Error ? error.message : String(error);

		errors.push(`[${name}] ${await describeFailure(page, entry, reason)}`);
	} finally {
		await page.close();
	}
}

/** Boot the harness's own dev server (`vite.harness.config.ts`) on a free port, the JS API
 * rather than spawning the CLI: `server: { open: false }` here overrides the config's own
 * `canOpenBrowser` unconditionally, so this never hits the `xdg-open ENOENT` the config's
 * comment describes for a display-less container — headless capture is exactly that case
 * on every platform, not only Linux.
 *
 * `host: '127.0.0.1'` is set explicitly rather than left to Vite's own default, which can
 * resolve `localhost` to `::1` first on a machine with IPv6-first resolution — the address
 * this function reports would then be a real, listening server that every `page.goto()`
 * below is refused by, since `chromiumBinaryIn`'s browser and this URL would be talking to
 * two different interfaces. Binding the host is simpler than reading `address.address` back
 * and bracket-quoting it for an IPv6 literal, and it means the reported port is always on
 * the same loopback interface the returned `baseUrl` names.
 *
 * Every exit out of this function past `createServer` succeeding closes the server it
 * opened — `server.listen()` throwing, or the port check below throwing, would otherwise
 * leave Vite's dev server listening with nothing left that can ever call `server.close()`,
 * which is a hang indistinguishable from `chromium.launch()` failing the same way (see
 * `run` below): the process never exits. */
async function startHarnessServer() {
	const server = await createServer({
		configFile: path.resolve('vite.harness.config.ts'),
		server: { open: false, port: 0, host: '127.0.0.1' },
	});

	try {
		await server.listen();
		const address = server.httpServer?.address();

		if (!address || typeof address === 'string') throw new Error('the harness dev server did not report a port');

		return { server, baseUrl: `http://127.0.0.1:${address.port}` };
	} catch (error) {
		await server.close();
		throw error;
	}
}

/** Every shot in the list — five for a bare run, two for a named entry — and the errors any
 * of them raised, collected rather than thrown, so one bad shot does not cost the rest of
 * the run its PNGs. */
async function captureAll(browser, baseUrl, shots) {
	const errors = [];

	for (const shot of shots) await captureOne(browser, baseUrl, shot, errors);
	return errors;
}

/** What every failed capture is told to the terminal, and the exit code that makes it
 * mean something: this process is meant to be checked by its status, not only read. */
function reportErrors(errors) {
	if (errors.length === 0) return;

	console.error('\nharness-shot found page errors:\n');
	for (const line of errors) console.error(` - ${line}`);
	process.exitCode = 1;
}

async function run() {
	const executablePath = resolveChromiumExecutable();

	// `node scripts/harness-shot.mjs prototype:ZoneSummary` — one entry, both schemes. The
	// argument is the entry's qualified id (`entries.ts`), not its basename: the index shows
	// the label, but the URL and this command both take the id, since a mock and the real
	// component it stands in for share a basename and need to stay reachable as two entries.
	// With no argument, the five fixed surfaces, exactly as before. `resolveShots` is what
	// actually reads `argv[2]` — lifted out of this line so a test can drive it directly
	// rather than reading this file's source text to check which index it uses.
	const shots = resolveShots(process.argv, SHOTS);

	mkdirSync(OUT_DIR, { recursive: true });

	const { server, baseUrl } = await startHarnessServer();

	// `chromium.launch()` is INSIDE this try, not before it: a browser present on disk but
	// unlaunchable (a missing shared library, an incompatible cached revision) rejects this
	// call, and if that rejection happened above a try whose `finally` is what closes the
	// dev server, the server would be left listening forever with nothing left to close it
	// — Node never exits, and `npm run harness-shot` hangs instead of failing. Every path
	// out of this function past `startHarnessServer` succeeding now closes the server.
	try {
		const browser = await chromium.launch({ executablePath, headless: true });

		try {
			reportErrors(await captureAll(browser, baseUrl, shots));
		} finally {
			await browser.close();
		}
	} finally {
		await server.close();
	}
}

try {
	await run();
} catch (error) {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
}
