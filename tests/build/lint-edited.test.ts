import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO } from '../helpers/oxlint';

/**
 * The edit-loop hook: oxlint over the ONE file an agent just wrote, reported back while
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

const plant = (contents: string) => {
	const file = path.join(mkdtempSync(path.join(tmpdir(), 'lint-edited-')), 'edited.ts');

	writeFileSync(file, contents);
	return file;
};

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
	 */
	it('is the command the host is configured to run', () => {
		const settings = JSON.parse(readFileSync(SETTINGS, 'utf8')) as {
			hooks: { PostToolUse: { matcher: string; hooks: { command: string }[] }[] };
		};
		const [wired] = settings.hooks.PostToolUse;

		expect(wired.matcher).toBe('Edit|Write');
		expect(wired.hooks).toHaveLength(1);

		// Resolved from the command the host would actually run rather than compared to a
		// literal: the settings name a path relative to the working directory, and the two
		// things worth refusing are that path not existing and it not being the file the
		// cases above just drove.
		const named = path.join(REPO, wired.hooks[0].command.replace(/^node\s+/, ''));

		expect(existsSync(named)).toBe(true);
		expect(named).toBe(HOOK);
	});
});
