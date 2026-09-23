import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { CHROMIUM_OVERRIDE, resolveChromiumExecutable } from '../../scripts/chromium.mjs';
import { REPO } from '../helpers/repo';

/**
 * Which Chromium a headless capture runs against — driven as a function rather than pinned as
 * source text. `harness-shot.test.ts` holds the rule that no browser layout is WRITTEN DOWN in
 * that module; this holds what it actually answers.
 *
 * **Why the pinned-path half runs in a child process, which is not a style choice.**
 * `chromium.executablePath()` reads `PLAYWRIGHT_BROWSERS_PATH` when playwright-core is
 * IMPORTED, not when it is called — measured, and measured the expensive way: the first draft
 * of this file set that variable in `beforeEach` and created the pinned path under it, and
 * playwright-core answered with the machine's REAL browser directory throughout, so the test
 * wrote an empty file called `chrome` into that machine's provisioned Playwright cache. Every
 * later case then found a "pinned build" that was a zero-byte file the suite itself had
 * planted. A fake that reaches outside the test is worse than one that is merely thin.
 *
 * **And why it is ONE child for all five of them.** A spawn that imports playwright-core costs
 * about 650ms; six of them cost 3.76s of a two-core CI runner, in synchronous bursts, beside
 * test files whose waits are bounded in TICKS rather than seconds — `settleUntil`'s own
 * docblock records a fixed-tick wait failing next to a PDF rasterizing two million pixels, and
 * this file reproduced that shape against `accessibility.test.ts` on one CI leg while the other
 * three passed. Nothing about the scenarios needs a process each: the import happens once, and
 * the FILESYSTEM and the ENVIRONMENT are read at call time, so one child can walk every state.
 * The `it`s stay one-per-behaviour and read the results back.
 *
 * The override-only cases stay in-process on purpose: the override is answered before
 * playwright-core is consulted at all, which is the property that makes it usable on a machine
 * whose browsers are provisioned rather than installed.
 */

const MODULE = pathToFileURL(path.join(REPO, 'scripts', 'chromium.mjs')).href;

interface Answer {
	readonly ok?: string;
	readonly error?: string;
}

interface PinnedRun {
	/** The unpinned build the child put on disk, so a case can assert the override won. */
	readonly other: string;
	readonly scenarios: Record<string, Answer>;
}

/**
 * Every state the PINNED path can be in, walked once in a process that imported
 * playwright-core knowing `browsers` — never at a path this file spells out, since a
 * per-platform layout mirrored by hand is the exact defect that module's history is about.
 */
function pinnedScenarios(browsers: string): PinnedRun {
	const source = `
		import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
		import path from 'node:path';
		import { chromium } from 'playwright-core';
		import { CHROMIUM_OVERRIDE, resolveChromiumExecutable } from ${JSON.stringify(MODULE)};

		const pinned = chromium.executablePath();
		mkdirSync(path.dirname(pinned), { recursive: true });
		// A Chromium on disk that is NOT the pinned one — what a provisioned machine offers.
		const other = path.join(${JSON.stringify(browsers)}, 'some-other-build', 'chrome');
		mkdirSync(path.dirname(other), { recursive: true });
		writeFileSync(other, '');

		const scenarios = {};
		const record = (name) => {
			try {
				scenarios[name] = { ok: resolveChromiumExecutable() };
			} catch (error) {
				scenarios[name] = { error: error.message };
			}
		};
		const clearPinned = () => rmSync(pinned, { recursive: true, force: true });

		delete process.env[CHROMIUM_OVERRIDE];
		clearPinned();
		record('absent');
		clearPinned();
		mkdirSync(pinned);
		record('directory');
		clearPinned();
		writeFileSync(pinned, '');
		record('installed');
		process.env[CHROMIUM_OVERRIDE] = '';
		record('emptyOverride');
		process.env[CHROMIUM_OVERRIDE] = other;
		record('overrideBeside');

		process.stdout.write(JSON.stringify({ other, scenarios }));
	`;
	const stdout = execFileSync(process.execPath, ['--input-type=module', '-e', source], {
		encoding: 'utf8',
		env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: browsers, [CHROMIUM_OVERRIDE]: '' },
	});
	return JSON.parse(stdout) as PinnedRun;
}

describe('resolving a Chromium for a headless capture', () => {
	let pinnedRoot: string;
	let pinned: PinnedRun;

	beforeAll(() => {
		pinnedRoot = mkdtempSync(path.join(tmpdir(), 'rp-pinned-'));
		pinned = pinnedScenarios(pinnedRoot);
	});

	afterAll(() => rmSync(pinnedRoot, { recursive: true, force: true }));

	it('answers the pinned build when it is installed', () => {
		// Under the temporary root, which is also what proves the child really honoured it —
		// the defect in this file's own first draft was an answer from somewhere else entirely.
		expect(pinned.scenarios.installed?.ok?.startsWith(pinnedRoot)).toBe(true);
	});

	it('refuses to hunt a different build on disk when the pinned one is absent', () => {
		// The rule this module was written for: capturing with a Chromium the project did not
		// pin is a quieter problem than not capturing, so an unpinned build lying around — and
		// the child puts one there — is never silently promoted into the answer.
		expect(pinned.scenarios.absent?.error).toMatch(/No Chromium build found/);
	});

	it('names the override in that refusal, so the message is one a provisioned machine can act on', () => {
		// `npx playwright install chromium` is the remedy on a developer's laptop and is
		// exactly what a container with its browsers baked in cannot do — the environment this
		// check went un-run in. An error naming only the impossible remedy is how a capture
		// gets disclosed as outstanding instead of taken.
		expect(pinned.scenarios.absent?.error).toContain(CHROMIUM_OVERRIDE);
	});

	it('takes the same file check at the PINNED path, not only at the override', () => {
		// One question with two doors is two questions unless one function holds it. A
		// directory where the pinned browser should be is as unlaunchable as one a person
		// named, and `isFile` is what both ask.
		expect(pinned.scenarios.directory?.error).toMatch(/No Chromium build found/);
	});

	describe('the override', () => {
		let browsers: string;
		const saved = process.env[CHROMIUM_OVERRIDE];

		beforeEach(() => {
			browsers = mkdtempSync(path.join(tmpdir(), 'rp-chromium-'));
			delete process.env[CHROMIUM_OVERRIDE];
		});

		afterEach(() => {
			rmSync(browsers, { recursive: true, force: true });
			if (saved === undefined) delete process.env[CHROMIUM_OVERRIDE];
			else process.env[CHROMIUM_OVERRIDE] = saved;
			vi.restoreAllMocks();
		});

		/** A Chromium on disk that is not the pinned one, for the cases that never reach it. */
		function otherChromium(): string {
			const bin = path.join(browsers, 'some-other-build', 'chrome');
			mkdirSync(path.dirname(bin), { recursive: true });
			writeFileSync(bin, '');
			return bin;
		}

		it('is taken when it names a browser that exists, pinned or not', () => {
			const other = otherChromium();
			process.env[CHROMIUM_OVERRIDE] = other;

			expect(resolveChromiumExecutable()).toBe(other);
		});

		it('outranks an INSTALLED pinned build, rather than being a fallback for a missing one', () => {
			// The discriminating case, and the reason it belongs in the child: "try the pinned
			// build, fall back to the override" is the other plausible design, and every other
			// case here passes under it — with no pinned build the two orderings are
			// indistinguishable. Naming a browser is deliberate, so it wins outright; otherwise
			// a developer who installed the pinned build once could never point a capture at
			// anything else again.
			expect(pinned.scenarios.overrideBeside?.ok).toBe(pinned.other);
		});

		it('says on stderr that the capture is not the pinned browser', () => {
			// The whole argument for refusing an unpinned build is that a capture taken with one
			// is a QUIETER problem than none at all. Allowing it deliberately is only honest if
			// the picture carries that caveat — otherwise the escape hatch reopens exactly the
			// failure the refusal exists to prevent.
			const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
			process.env[CHROMIUM_OVERRIDE] = otherChromium();

			resolveChromiumExecutable();

			expect(warn).toHaveBeenCalledTimes(1);
			expect(String(warn.mock.calls[0]?.[0])).toContain(CHROMIUM_OVERRIDE);
		});

		it('is refused when it names nothing, rather than handing a bad path to Playwright', () => {
			// Playwright's own failure for a missing executable arrives from a launch several
			// steps later and blames the browser, not the typo in the variable.
			process.env[CHROMIUM_OVERRIDE] = path.join(browsers, 'not-here', 'chrome');

			expect(() => resolveChromiumExecutable()).toThrow(/not-here/);
		});

		it('is refused when it names a DIRECTORY, which is a path that exists and is not a browser', () => {
			// `existsSync` answers true for one, so the first version accepted a directory as an
			// executable and Playwright failed at a launch several steps later, blaming the
			// browser rather than the variable — the late, unactionable failure this module
			// exists to convert into an early one.
			const directory = path.join(browsers, 'a-folder');
			mkdirSync(directory);
			process.env[CHROMIUM_OVERRIDE] = directory;

			expect(() => resolveChromiumExecutable()).toThrow(/a-folder/);
		});

		it('treats an empty value as unset, so `VAR= npm run harness-shot` still resolves the pinned build', () => {
			expect(pinned.scenarios.emptyOverride?.ok?.startsWith(pinnedRoot)).toBe(true);
		});
	});
});
