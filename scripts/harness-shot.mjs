import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';

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
 * which this project's install must not do on a machine with no browser. This resolves an
 * already-installed Chromium from `PLAYWRIGHT_BROWSERS_PATH` (or the same default cache
 * playwright-core itself uses) rather than hard-coding a version directory — the revision
 * folder name changes with every Playwright bump, and this repository's pinned
 * `playwright-core` does not necessarily match whatever got installed on this machine.
 */

const OUT_DIR = 'harness-shots';
const VIEWPORT = { width: 1280, height: 800 };
// The view's own mount point (`RenovationProjectView`'s `contentEl.createDiv`), which is
// what "the view has drawn" means here — not merely that the page loaded.
const VIEW_SELECTOR = '.renovation-planner-view';

const SHOTS = [
	{ name: 'dark', query: '' },
	{ name: 'light', query: '?theme=light' },
	{ name: 'phone', query: '?phone' },
];

/** Where a Playwright install puts its browsers when nothing overrides it — mirrored here
 * rather than imported, because asking `playwright-core` to resolve a browser missing from
 * disk throws instead of returning a path this function could report on. */
function defaultBrowsersRoot() {
	const home = os.homedir();

	if (process.platform === 'win32') return path.join(home, 'AppData', 'Local', 'ms-playwright');
	if (process.platform === 'darwin') return path.join(home, 'Library', 'Caches', 'ms-playwright');
	return path.join(home, '.cache', 'ms-playwright');
}

/** The binary inside one `chromium-<revision>` directory, per platform — Playwright's own
 * install layout, not this project's choice. */
function chromiumBinaryIn(dir) {
	if (process.platform === 'win32') return path.join(dir, 'chrome-win', 'chrome.exe');
	if (process.platform === 'darwin') return path.join(dir, 'chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium');
	return path.join(dir, 'chrome-linux', 'chrome');
}

/** Every `chromium-<revision>` directory name under the browsers root, newest first —
 * there can be more than one once a machine has upgraded Playwright without clearing its
 * cache, and the newest is the one worth trying first. */
function chromiumRevisionsIn(root) {
	return readdirSync(root, { withFileTypes: true })
		.filter((entry) => entry.isDirectory() && /^chromium-\d+$/.test(entry.name))
		.map((entry) => Number(entry.name.slice('chromium-'.length)))
		.toSorted((a, b) => b - a);
}

/** The first revision under `root` that actually has a binary on disk, or `undefined`. A
 * revision DIRECTORY existing is not the same as the browser being installed in it — an
 * interrupted `playwright install` can leave an empty one. */
function findInstalledChromium(root) {
	for (const revision of chromiumRevisionsIn(root)) {
		const bin = chromiumBinaryIn(path.join(root, `chromium-${revision}`));

		if (existsSync(bin)) return bin;
	}

	return undefined;
}

/**
 * Find an installed Chromium without hard-coding a revision. `chromium-1194` is what this
 * environment happens to have; the number changes with every Playwright browser release,
 * so this globs `chromium-<digits>` under the browsers root and takes the newest, rather
 * than trusting `playwright-core`'s own resolver — which is pinned to the revision its
 * `browsers.json` names and throws when the installed one is a different number, which is
 * exactly the mismatch a machine with an older or newer browser install would hit.
 */
function resolveChromiumExecutable() {
	const root = process.env.PLAYWRIGHT_BROWSERS_PATH || defaultBrowsersRoot();
	const bin = existsSync(root) ? findInstalledChromium(root) : undefined;

	if (bin) return bin;

	throw new Error(
		`No Chromium build found for headless capture (looked under ${root}).\n\n` +
			'Install one with:\n' +
			'  npx playwright install chromium\n\n' +
			'Set PLAYWRIGHT_BROWSERS_PATH first if browsers should not live in the default cache.',
	);
}

/** One capture: navigate, wait for the real view to mount, screenshot, report any page or
 * console error back onto the shared list rather than throwing — one bad shot should not
 * cost the other two their PNGs. */
async function captureOne(browser, baseUrl, { name, query }, errors) {
	const page = await browser.newPage({ viewport: VIEWPORT });

	page.on('pageerror', (error) => errors.push(`[${name}] page error: ${error.message}`));
	page.on('console', (msg) => {
		if (msg.type() === 'error') errors.push(`[${name}] console error: ${msg.text()}`);
	});

	try {
		// 'load', not 'networkidle': Vite's dev server keeps an HMR websocket open, which
		// networkidle waits forever for.
		await page.goto(`${baseUrl}/${query}`, { waitUntil: 'load' });
		await page.waitForSelector(VIEW_SELECTOR, { state: 'attached' });

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
