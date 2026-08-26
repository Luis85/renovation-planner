import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { REPO } from '../helpers/oxlint';

/**
 * The edit-loop hook: oxlint over the ONE file an agent just wrote — and ESLint too when that
 * file is an SFC, since oxlint has no Vue rules at all — reported back while
 * the reasoning that produced it is still in hand. `npm run check` is still the definition
 * of done — this only moves the cheapest half of it several turns earlier.
 *
 * It does NOT prevent or revert the write. `PostToolUse` runs after the tool has already
 * changed the file; exit 2 there means "show stderr to Claude", not "block". The cases
 * below assert what the script does — the exit code and what the agent is told — and
 * nothing about an edit being stopped, because nothing stops one.
 *
 * Driven as a subprocess against planted files, the way Claude Code drives it, rather than
 * refactored into something importable: a seam built for the test is the thing that would
 * get tested.
 */

const HOOK = path.join(REPO, 'scripts', 'lint-edited.mjs');
const SETTINGS = path.join(REPO, '.claude', 'settings.json');

// A finding from `correctness`, which this repository has switched on.
const OFFENCE = 'export const settings = { units: 1, units: 2 };\n';

/** Runs the hook the way the host does — the tool call's JSON on stdin — and reports both
 * halves of what the host reads back: the exit code, and what the agent is told. */
const hook = (input: string) => {
	try {
		execFileSync(process.execPath, [HOOK], { cwd: REPO, input, encoding: 'utf8', stdio: 'pipe' });
		return { code: 0, said: '' };
	} catch (error) {
		const failure = error as { status?: number; stderr?: string };

		return { code: failure.status ?? 0, said: String(failure.stderr ?? '') };
	}
};

const edited = (file: string) => JSON.stringify({ tool_input: { file_path: file } });

/**
 * The script a hook command would actually run, resolved from the command itself rather
 * than compared to a literal: `$CLAUDE_PROJECT_DIR` on one platform,
 * `$env:CLAUDE_PROJECT_DIR` and backslashes on the other.
 */
const named = (command: string) =>
	path.join(
		REPO,
		command
			.replace(/^node\s+/, '')
			.replace(/["']/g, '')
			.replace(/\$(env:)?CLAUDE_PROJECT_DIR/, '')
			.replace(/^[\\/]/, '')
			.split('\\')
			.join('/'),
	);

/**
 * An SFC at a path ESLint's `VUE_FILES` glob actually matches — see the SFC cases for why a
 * temp directory cannot be used. Tracked so `afterEach` removes it even when a case throws:
 * a stray offending `.vue` left in the tree would fail `npm run lint` for the whole repository.
 */
const plantedSfcs: string[] = [];

const plantSfc = (contents: string) => {
	const file = path.join(REPO, 'tests', 'harness', `lint-edited-probe-${plantedSfcs.length}.vue`);

	plantedSfcs.push(file);
	writeFileSync(file, contents);
	return file;
};

afterEach(() => {
	for (const file of plantedSfcs.splice(0)) rmSync(file, { force: true });
});

const plant = (contents: string) => {
	const file = path.join(mkdtempSync(path.join(tmpdir(), 'lint-edited-')), 'edited.ts');

	writeFileSync(file, contents);
	return file;
};

/**
 * What one SFC may cost the edit-loop hook before the suite calls it broken. See the docblock
 * on the first SFC case for why this is measured against the tree rather than the fixture.
 */
const SFC_LINT_BUDGET = 60_000;

describe('the edit-loop hook', () => {
	it('tells the agent what oxlint found, on the code that reaches the agent', () => {
		const { code, said } = hook(edited(plant(OFFENCE)));

		// 2, not merely non-zero. On `PostToolUse` neither code stops anything, but 1 shows
		// stderr to the USER and lets the agent carry on unaware of the finding, while 2
		// hands it over as a tool error the agent has to answer for. Getting this wrong
		// costs the whole point of the hook and nothing reports it.
		expect(code).toBe(2);
		expect(said).toContain('no-dupe-keys');
	});

	it('says nothing about a clean edit', () => {
		const { code, said } = hook(edited(plant('export const ok = 1;\n')));

		expect({ code, said }).toEqual({ code: 0, said: '' });
	});

	it('leaves a file oxlint does not parse alone', () => {
		expect(hook(edited('README.md')).code).toBe(0);
	});

	/**
	 * The one extension where oxlint alone is not enough, and the reason this hook runs a second
	 * linter at all: oxlint has no port of `eslint-plugin-vue` — no Vue rules whatever — so a
	 * `.vue` edit used to come back clean from a hook that could not read the ruleset governing
	 * it. `vue/html-indent` is exactly what a mock author trips first, and `npm run check` said
	 * so several turns later, which is the gap this hook exists to close.
	 *
	 * Planted under `tests/harness/`, which is a real directory `VUE_FILES` matches: ESLint's
	 * flat config resolves `files` globs against the project, so a temp-directory path — what
	 * `plant` produces for every other case here — matches no block and would be reported as
	 * nothing at all. Removed in `afterEach` whatever happens.
	 *
	 * **Both SFC cases carry their own timeout, and the number is a measurement rather than a
	 * cushion.** ESLint's ruleset here is type-aware, so its project service loads the whole of
	 * `src/` before it can answer for one file — which means this test's cost tracks the SIZE of
	 * the tree, not the size of the fixture. It was about 2.5s when the hook was built and is
	 * 5.4s now that slice 10's modules are in `src/`, so it crossed vitest's 5000ms default by
	 * growth alone and failed with a timeout that named nothing.
	 *
	 * **Measure it under the suite, not on its own, and this is the paragraph that says why.**
	 * The first repair here budgeted three times the ISOLATED cost and failed again at 15s: the
	 * gate runs 173 files across parallel workers, and this case shells out to a second linter
	 * that competes with all of them for CPU. Measured with `--reporter=verbose` over the whole
	 * suite it is **17.2s** and **13.4s**, against 5.4s alone — so the isolated figure is not
	 * the one this budget is for. 60s is roughly 3.5× the loaded measurement: high enough that
	 * ordinary growth and a busier machine do not turn a green suite red, low enough that a
	 * hook which genuinely HANGS still fails instead of blocking the gate for ten minutes.
	 *
	 * Re-measure it, do not raise it blindly, if it starts failing again — under the suite, and
	 * the thing it is really watching is whether this hook is still cheap enough to sit in the
	 * edit loop, where the number that matters is the 5.4s one.
	 */
	it('tells the agent what ESLint found in an SFC, which oxlint cannot see at all', () => {
		const spaced = '<template>\n  <p>x</p>\n</template>\n';

		const { code, said } = hook(edited(plantSfc(spaced)));

		expect(said).toContain('vue/html-indent');
		expect(code).toBe(2);
	}, SFC_LINT_BUDGET);

	// The other direction, so the case above is not passing because ESLint reports on every SFC:
	// a conforming template must still come back silent.
	it('says nothing about an SFC that conforms', () => {
		const tabbed = '<template>\n\t<p>x</p>\n</template>\n';

		expect(hook(edited(plantSfc(tabbed)))).toEqual({ code: 0, said: '' });
	}, SFC_LINT_BUDGET);

	/**
	 * Fails OPEN, on every internal failure. A hook that failed closed on its own bug
	 * would answer every edit in the session with an error about the hook rather than
	 * about the code — and `npm run check` still catches whatever this misses, so silence
	 * is the cheaper wrong answer.
	 */
	for (const [what, input] of [
		['input it cannot parse', 'not json'],
		['a tool call with no file', '{}'],
	]) {
		it(`stays out of the way given ${what}`, () => {
			expect(hook(input).code).toBe(0);
		});
	}

	/**
	 * The wiring, which is the half no amount of testing the script itself would reach:
	 * the hook only runs because `.claude/settings.json` names it, and a renamed or moved
	 * script leaves that pointing at nothing. Nothing fails — the edits simply stop being
	 * checked, which is the silent direction.
	 *
	 * The settings file is shared with the tooling the repository vendors, so this finds
	 * OUR entry by the script it names rather than by position, and it reads both platform
	 * spellings: a `commandWindows` that drifted from its `command` would disable the hook
	 * on exactly one CI leg, with nothing to say so.
	 */
	it('is the command the host is configured to run, on both platforms', () => {
		const settings = JSON.parse(readFileSync(SETTINGS, 'utf8')) as {
			hooks: { PostToolUse: { matcher: string; hooks: { command: string; commandWindows?: string }[] }[] };
		};
		const wired = settings.hooks.PostToolUse.flatMap((entry) =>
			entry.hooks.filter((h) => h.command.includes('lint-edited')).map((h) => ({ matcher: entry.matcher, ...h })),
		);

		expect(wired).toHaveLength(1);

		// Every tool that writes a file, not just the two: a MultiEdit that skipped the
		// linter would be the one shape nobody notices going unchecked.
		expect(new Set(wired[0].matcher.split('|'))).toEqual(new Set(['Edit', 'Write', 'MultiEdit']));

		expect(named(wired[0].command)).toBe(HOOK);
		expect(named(wired[0].commandWindows ?? '')).toBe(HOOK);
		expect(existsSync(HOOK)).toBe(true);
	});
});
