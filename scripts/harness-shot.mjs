import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import { resolveChromiumExecutable } from './chromium.mjs';

/**
 * Headless capture of the browser harness — the dark scheme, the light scheme and `?phone`
 * — for a look nobody has to open a browser for. This is how a real layout defect was
 * found earlier in this plan (the view collapsing to 39px of a 700px pane): nothing in the
 * suite could see it because jsdom draws nothing, and a screenshot is the only artifact
 * that shows it.
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

/** One capture: navigate, wait for the real view to mount, screenshot, report any page or
 * console error back onto the shared list rather than throwing — one bad shot should not
 * cost the other two their PNGs. */
async function captureOne(browser, baseUrl, { name, query, selector }, errors) {
	const page = await browser.newPage({ viewport: VIEWPORT });

	page.on('pageerror', (error) => errors.push(`[${name}] page error: ${error.message}`));
	page.on('console', (msg) => {
		if (msg.type() === 'error') errors.push(`[${name}] console error: ${msg.text()}`);
	});

	try {
		// 'load', not 'networkidle': Vite's dev server keeps an HMR websocket open, which
		// networkidle waits forever for.
		await page.goto(`${baseUrl}/${query}`, { waitUntil: 'load' });
		await page.waitForSelector(selector, { state: 'attached' });

		const file = path.join(OUT_DIR, `${name}.png`);

		await page.screenshot({ path: file, fullPage: true });
		console.log(`wrote ${file}`);
	} catch (error) {
		errors.push(`[${name}] ${error instanceof Error ? error.message : String(error)}`);
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

/** All three shots, and the errors any of them raised — collected rather than thrown, so
 * one bad shot does not cost the other two their PNGs. */
async function captureAll(browser, baseUrl) {
	const errors = [];

	for (const shot of SHOTS) await captureOne(browser, baseUrl, shot, errors);
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
			reportErrors(await captureAll(browser, baseUrl));
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
