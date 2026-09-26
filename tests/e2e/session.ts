import { readFileSync } from 'node:fs';
import path from 'node:path';
import { remote } from 'webdriverio';
import ObsidianWorkerService, { launcher, type startWdioSession } from 'wdio-obsidian-service';
import { SessionLifecycle } from './sessionLifecycle';

export type NativeBrowser = Awaited<ReturnType<typeof startWdioSession>>;
type SessionConfig = Parameters<typeof startWdioSession>[0];

/**
 * The earliest PUBLIC 1.13 build: `minAppVersion` is 1.13.0, which shipped to Insiders only and
 * cannot be downloaded without an account. Its own constant so `tests/gates/e2e-wiring.test.ts`
 * can hold it against the workflow's matrix; CI also runs `latest`.
 */
const BASELINE_VERSION = '1.13.7';
export const requestedVersion = process.env.OBSIDIAN_VERSION ?? BASELINE_VERSION;
export const mobileEmulation = process.env.OBSIDIAN_UI === 'mobile-emulation';

/** Read from the manifest rather than spelled here: it prefixes every command id and names the plugin folder. */
export const PLUGIN_ID = (JSON.parse(readFileSync('manifest.json', 'utf8')) as { id: string }).id;

/**
 * The installed plugin folder `scripts/e2e.mjs` stages from `dist/` and `manifest.json` —
 * `dist/` alone carries no manifest, and Obsidian loads the three files by name.
 */
const PLUGIN_DIR = path.resolve('node_modules/.cache/e2e', PLUGIN_ID);

export function createNativeSession(
	afterReady: (browser: NativeBrowser) => Promise<void> = () => Promise.resolve(),
): SessionLifecycle<NativeBrowser> {
	// An assertion rather than an annotation: `goog:loggingPrefs` is Chromedriver's, and
	// WebdriverIO's `Capabilities` type does not declare it.
	const capabilities = {
		browserName: 'obsidian',
		'wdio:obsidianOptions': {
			appVersion: requestedVersion,
			installerVersion: 'latest',
			plugins: [PLUGIN_DIR],
			vault: path.resolve('tests/e2e/vault'),
			copy: true,
			emulateMobile: mobileEmulation,
		},
		// The renderer's console, so a case can assert what a plugin unload leaves behind.
		'goog:loggingPrefs': { browser: 'ALL' },
		// English whatever the machine's locale, so a text assertion means the same thing everywhere.
		'goog:chromeOptions': {
			args: ['--lang=en'],
			...(mobileEmulation ? { mobileEmulation: { deviceMetrics: { width: 390, height: 844, touch: false } } } : {}),
		},
	} as WebdriverIO.Capabilities;
	// Under `node_modules/`, which every linter and walker in this repository already ignores:
	// the cache holds whole Obsidian builds, and `eslint .` reads no `.gitignore`.
	const config: SessionConfig = {
		capabilities,
		cacheDir: path.resolve('node_modules/.cache/obsidian'),
		logLevel: 'warn',
		waitforTimeout: 10_000,
		waitforInterval: 100,
		connectionRetryTimeout: 30_000,
		connectionRetryCount: 0,
	};
	// The same sequence as `startWdioSession()`, keeping the service so `afterSession()` runs on
	// success AND on partial failure. These exported hooks are a version-pinned seam, not a
	// Vitest WDIO adapter.
	const preparation = new launcher({}, capabilities, config);
	const worker = new ObsidianWorkerService({}, capabilities, config);
	return new SessionLifecycle({
		async prepare() {
			await preparation.onPrepare(config, [capabilities]);
			await worker.beforeSession(config, capabilities);
		},
		connect: () => remote(config),
		async initialize(browser) {
			await worker.before(capabilities, [], browser);
			await afterReady(browser);
		},
		disconnect: (browser) => browser.deleteSession(),
		cleanup: () => worker.afterSession(),
	});
}
