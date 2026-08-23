import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO } from '../helpers/oxlint';

/**
 * The headless capture script's wiring — the shape `lint-edited.test.ts` checks for the
 * edit-loop hook, applied to `scripts/harness-shot.mjs`: an npm script names a file that
 * exists, and the devDependency the file needs is declared, and declared as the browserless
 * package rather than the one that downloads a browser on every `npm install`.
 *
 * What this deliberately does NOT do: launch a browser, start the harness's dev server, or
 * assert anything about a screenshot. `scripts/harness-shot.mjs` draws; there is no
 * baseline to diff a PNG against, and driving Playwright here would trade this suite's
 * speed for a check `npm run harness-shot`, run by hand, already gives a developer directly.
 */

const PACKAGE_JSON = path.join(REPO, 'package.json');
const SCRIPT = path.join(REPO, 'scripts', 'harness-shot.mjs');
// Where the browser resolution actually lives, since `concept-shots.mjs` needs the same
// answer and two copies of it is the shape of the defect the block below describes.
const RESOLVER = path.join(REPO, 'scripts', 'chromium.mjs');
// Every file that can name a Chromium. The literal ban applies to all of them, not only to
// the one that happens to own the resolver today — a re-mirrored layout is just as wrong in
// a caller as in the callee.
const CHROMIUM_FILES = [RESOLVER, SCRIPT, path.join(REPO, 'scripts', 'concept-shots.mjs')];

const pkg = JSON.parse(readFileSync(PACKAGE_JSON, 'utf8')) as {
	scripts: Record<string, string>;
	devDependencies: Record<string, string>;
};

describe('the headless harness capture script', () => {
	it('is wired as an npm script pointing at a file that exists', () => {
		const command = pkg.scripts['harness-shot'];

		expect(command).toBeDefined();

		// `node scripts/harness-shot.mjs` — resolved against the repository root the same
		// way every script here resolves its own paths, not against this test file's
		// location.
		const named = command.replace(/^node\s+/, '').trim();

		expect(existsSync(path.join(REPO, named))).toBe(true);
	});

	it('declares playwright-core, not the full playwright package that downloads browsers on install', () => {
		expect(pkg.devDependencies['playwright-core']).toBeDefined();
		expect(pkg.devDependencies.playwright).toBeUndefined();
	});

	it('is absent from npm run check — it draws and asserts no appearance, so there is nothing for the gate to verify', () => {
		expect(pkg.scripts.check).not.toContain('harness-shot');
	});

	/*
	 * Where the browser comes from. This one is a real defect caught late: the script used to
	 * BUILD the executable's path itself, mirroring Playwright's per-platform layout —
	 * `chrome-win/chrome.exe`, `chrome-linux/chrome`, `chrome-mac/Chromium.app/…`. Playwright
	 * moved to Chrome-for-Testing builds and renamed every one of those directories, so the
	 * mirrored table was wrong on four of its five platforms and `npm run harness-shot` failed
	 * on this repository's own Windows leg with "No Chromium build found".
	 *
	 * The layout is Playwright's to know, so it is asked rather than mirrored. These two check
	 * that, and they are deliberately machine-independent: asserting the RESOLVED path would
	 * need a Chromium installed, and CI has none — this script is outside `npm run check` for
	 * exactly that reason. So the invariant checked is the one that caused the defect: no
	 * browser-layout literal is written down in any of these files at all.
	 *
	 * The resolution itself now lives in `scripts/chromium.mjs`, one file two capture scripts
	 * import, because the alternative was a second copy of it in `concept-shots.mjs` — and a
	 * copy that can disagree is precisely the failure the mirrored table already caused once.
	 */
	it('asks playwright-core for the executable path instead of constructing one', () => {
		expect(readFileSync(RESOLVER, 'utf8')).toContain('chromium.executablePath()');
	});

	it('resolves the browser through that one shared module rather than resolving its own', () => {
		expect(readFileSync(SCRIPT, 'utf8')).toContain("from './chromium.mjs'");
	});

	it('writes down no per-platform browser layout of its own, in any file that names a browser', () => {
		// Every directory name Playwright's own EXECUTABLE_PATHS table has used for a
		// chromium build, current and superseded. A literal from either era in any of these
		// files means the layout is being mirrored again.
		const layouts = [
			'chrome-win',
			'chrome-linux',
			'chrome-mac',
			'chrome.exe',
			'Chromium.app',
			'Google Chrome for Testing',
			'chrome-headless-shell',
		];

		const offenders = CHROMIUM_FILES.flatMap((file) => {
			const source = readFileSync(file, 'utf8');

			return layouts.filter((name) => source.includes(name)).map((name) => `${path.basename(file)}: ${name}`);
		});

		expect(offenders).toEqual([]);
	});
});
