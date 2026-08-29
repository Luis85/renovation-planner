import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CHROMIUM_OVERRIDE, resolveChromiumExecutable } from '../../scripts/chromium.mjs';
import { REPO } from '../helpers/oxlint';

/**
 * Which Chromium a headless capture runs against — driven as a function rather than pinned as
 * source text. `harness-shot.test.ts` holds the rule that no browser layout is WRITTEN DOWN in
 * that module; this holds what it actually answers.
 *
 * **Why half of it runs in a child process, which is not a style choice.**
 * `chromium.executablePath()` reads `PLAYWRIGHT_BROWSERS_PATH` when playwright-core is
 * IMPORTED, not when it is called — measured, and measured the expensive way: the first draft
 * of this file set that variable to a temporary directory in `beforeEach` and created the
 * pinned path under it, and playwright-core answered with the machine's REAL browser
 * directory throughout, so the test wrote an empty file called `chrome` into this container's
 * provisioned Playwright cache. Every later case then found a "pinned build" that was a
 * zero-byte file the suite itself had planted. A fake that reaches outside the test is worse
 * than one that is merely thin, so anything depending on that variable is asked of a fresh
 * process, where the import happens after the environment is set.
 *
 * The override cases stay in-process on purpose: the override is answered before
 * playwright-core is consulted at all, which is the property that makes it usable on a machine
 * whose browsers are provisioned rather than installed.
 */

const MODULE = pathToFileURL(path.join(REPO, 'scripts', 'chromium.mjs')).href;

/**
 * `resolveChromiumExecutable` in a process that imported playwright-core knowing `browsers`,
 * optionally with the pinned build made to exist first — never at a path this file spells out,
 * since a per-platform layout mirrored by hand is the exact defect that module's history is
 * about.
 */
function resolveIn(
	browsers: string,
	{ installPinned = false, override = '' } = {},
): { ok?: string; error?: string } {
	const source = `
		import { mkdirSync, writeFileSync } from 'node:fs';
		import path from 'node:path';
		import { chromium } from 'playwright-core';
		import { resolveChromiumExecutable } from ${JSON.stringify(MODULE)};
		if (${String(installPinned)}) {
			const bin = chromium.executablePath();
			mkdirSync(path.dirname(bin), { recursive: true });
			writeFileSync(bin, '');
		}
		try {
			process.stdout.write(JSON.stringify({ ok: resolveChromiumExecutable() }));
		} catch (error) {
			process.stdout.write(JSON.stringify({ error: error.message }));
		}
	`;
	const stdout = execFileSync(process.execPath, ['--input-type=module', '-e', source], {
		encoding: 'utf8',
		env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: browsers, [CHROMIUM_OVERRIDE]: override },
	});
	return JSON.parse(stdout) as { ok?: string; error?: string };
}

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

/** A Chromium on disk that is NOT the pinned one — what a provisioned machine actually offers. */
function otherChromium(): string {
	const bin = path.join(browsers, 'some-other-build', 'chrome');
	mkdirSync(path.dirname(bin), { recursive: true });
	writeFileSync(bin, '');
	return bin;
}

describe('resolving a Chromium for a headless capture', () => {
	it('answers the pinned build when it is installed', () => {
		const { ok } = resolveIn(browsers, { installPinned: true });

		// Under the temporary root, which is also what proves the child really honoured it —
		// the defect in this file's own first draft was an answer from somewhere else entirely.
		expect(ok?.startsWith(browsers)).toBe(true);
	});

	it('refuses to hunt a different build on disk when the pinned one is absent', () => {
		// The rule this module was written for: capturing with a Chromium the project did not
		// pin is a quieter problem than not capturing, so an unpinned build lying around is
		// never silently promoted into the answer.
		otherChromium();

		expect(resolveIn(browsers).error).toMatch(/No Chromium build found/);
	});

	it('names the override in that refusal, so the message is one a provisioned machine can act on', () => {
		// `npx playwright install chromium` is the remedy on a developer's laptop and is
		// exactly what a container with its browsers baked in cannot do — the environment this
		// check went un-run in. An error naming only the impossible remedy is how a capture
		// gets disclosed as outstanding instead of taken.
		expect(resolveIn(browsers).error).toContain(CHROMIUM_OVERRIDE);
	});

	describe('the override', () => {
		it('is taken when it names a browser that exists, pinned or not', () => {
			const other = otherChromium();
			process.env[CHROMIUM_OVERRIDE] = other;

			expect(resolveChromiumExecutable()).toBe(other);
		});

		it('outranks an INSTALLED pinned build, rather than being a fallback for a missing one', () => {
			// The discriminating case, and the reason it costs a child process: "try the pinned
			// build, fall back to the override" is the other plausible design, and every other
			// case here passes under it — on a machine with no pinned build the two orderings
			// are indistinguishable. Naming a browser is deliberate, so it wins outright;
			// otherwise a developer who installed the pinned build once could never point a
			// capture at anything else again.
			const other = otherChromium();

			expect(resolveIn(browsers, { installPinned: true, override: other }).ok).toBe(other);
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

		it('treats an empty value as unset, so `VAR= npm run harness-shot` still resolves the pinned build', () => {
			process.env[CHROMIUM_OVERRIDE] = '';

			const { ok } = resolveIn(browsers, { installPinned: true });

			expect(ok?.startsWith(browsers)).toBe(true);
		});
	});
});
