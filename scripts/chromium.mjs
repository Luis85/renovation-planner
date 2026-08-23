import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

/**
 * Where a headless capture's browser comes from — asked of `playwright-core` rather than
 * assembled here, and shared by every script that needs one (`harness-shot.mjs`,
 * `concept-shots.mjs`). It lives in its own file because the alternative is a copy in each,
 * and a copy is what produced the defect this function's history is about.
 *
 * `chromium.executablePath()` is a pure path computation: it honours
 * `PLAYWRIGHT_BROWSERS_PATH`, applies the revision this repository's `playwright-core` pins,
 * and knows the per-platform directory layout. It does NOT throw when the browser is absent
 * — measured — it returns the path the browser WOULD be at, which is why the existence check
 * below is this function's own job and why the error can name the exact path it wanted.
 *
 * The capture script used to build that path itself, from a per-platform table mirrored by
 * hand, and the comment defending that argued Playwright's resolver "throws when the
 * installed one is a different number". That premise was false, and the mirror was the
 * defect it was meant to avoid: when Playwright moved to Chrome-for-Testing builds it
 * renamed every chromium build directory, on every platform, and the copy here kept the old
 * names. Four of that table's five platforms were wrong, and `npm run harness-shot` failed
 * on Windows — this repository's own CI platform — with a message blaming a missing install
 * rather than a wrong path.
 *
 * The old names are deliberately not written down above, not even as history: a name spelled
 * out in a comment is a name the next author can copy back into code, which is how the
 * mirror returns. `git log` has them.
 *
 * What is deliberately NOT done any more: hunting a DIFFERENT revision on disk when the
 * pinned one is missing. Capturing with a Chromium the project did not pin is a quieter
 * problem than not capturing, and the remedy below is one command.
 *
 * `tests/build/harness-shot.test.ts` holds the rule this rests on: no browser-layout literal
 * is written down in this file, or in either script that calls it.
 */
export function resolveChromiumExecutable() {
	let bin;

	try {
		bin = chromium.executablePath();
	} catch (error) {
		// An unsupported platform is the one case the resolver refuses outright, and its own
		// message says more about why than anything this could add — so it travels as `cause`
		// rather than being restated into a string.
		throw new Error('playwright-core could not resolve a Chromium for this platform', { cause: error });
	}

	if (existsSync(bin)) return bin;

	throw new Error(
		`No Chromium build found for headless capture (looked for ${bin}).\n\n` +
			'Install one with:\n' +
			'  npx playwright install chromium\n\n' +
			'Set PLAYWRIGHT_BROWSERS_PATH first if browsers should not live in the default cache.',
	);
}
