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
 * What is still deliberately NOT done: hunting a DIFFERENT revision on disk when the pinned
 * one is missing. Capturing with a Chromium the project did not pin is a quieter problem
 * than not capturing — an unannounced substitution renders a picture somebody then reasons
 * about as if it were the pinned browser's. `CHROMIUM_OVERRIDE` is the one door out of that,
 * and it differs from hunting in both halves: a person names the build, and the capture says
 * out loud that it is not the pinned one.
 *
 * `tests/build/harness-shot.test.ts` holds the rule this rests on: no browser-layout literal
 * is written down in this file, or in either script that calls it. What it ANSWERS is
 * `tests/build/chromium.test.ts`, which drives the function against a temporary
 * `PLAYWRIGHT_BROWSERS_PATH` rather than against whatever this machine has installed.
 */

/**
 * The escape hatch, for a machine whose browsers are provisioned rather than installed.
 *
 * `npx playwright install chromium` is the remedy on a developer's laptop and is exactly
 * what a container with its browsers baked in cannot do — its image ships one Chromium, at
 * a revision nobody consulted this repository's `playwright-core` about, and a `postinstall`
 * download is usually disabled outright. An error naming only the impossible remedy is how
 * a capture check goes un-run and gets disclosed as outstanding instead.
 *
 * Not a `--flag`: two scripts call this, one of them through the `--` argument parsing
 * `harness-shot.mjs` already documents as load-bearing, and an environment variable is what
 * the environment providing the browser can set once for every command that needs it.
 */
export const CHROMIUM_OVERRIDE = 'RP_CHROMIUM_EXECUTABLE';

export function resolveChromiumExecutable() {
	// An empty value is unset. `RP_CHROMIUM_EXECUTABLE= npm run harness-shot` is how a shell
	// spells "not this time", and taking it literally would resolve the browser to `''`.
	const override = process.env[CHROMIUM_OVERRIDE];
	if (override) return useOverride(override);

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
			'Set PLAYWRIGHT_BROWSERS_PATH first if browsers should not live in the default cache.\n' +
			`On a machine whose browsers are provisioned rather than installed, name one instead:\n` +
			`  ${CHROMIUM_OVERRIDE}=/path/to/chrome npm run harness-shot`,
	);
}

/**
 * A named build, checked and announced.
 *
 * The existence check is this function's own job for the same reason it is below: Playwright
 * accepts an `executablePath` that does not exist and fails several steps later, at a launch,
 * with a message about the browser rather than about the variable that named it.
 */
function useOverride(bin) {
	if (!existsSync(bin)) {
		throw new Error(`${CHROMIUM_OVERRIDE} names ${bin}, which is not a file on this machine.`);
	}

	console.warn(
		`${CHROMIUM_OVERRIDE} is set: capturing with ${bin}, which is not the Chromium playwright-core pins.\n` +
			'Read the pictures as approximate — a different build renders text and layout slightly differently.',
	);
	return bin;
}
