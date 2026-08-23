import { Linter } from 'eslint';
import obsidianmd from 'eslint-plugin-obsidianmd';
import { beforeAll, describe, expect, it } from 'vitest';
import { type ResolvedConfig, isIgnored, resolveConfig, severityOf } from '../helpers/eslint';

/**
 * `eslint.config.mjs` carves `no-console` off for `src/infrastructure/logging/**`, and the
 * comment beside that block promises it is NOT a blanket permission: `console.log` and
 * `console.info` still fail there, because `eslint-plugin-obsidianmd`'s own console rule
 * survives the carve-out. That promise is what lets the console sink exist at all, and it
 * rests on two things neither of which this repository controls.
 *
 * The first is that the carve-out's GLOB resolves to the directory it names, and only that
 * one. A glob is one edit from matching everything or nothing, and a wrong one makes the
 * gate quieter rather than redder — the same failure `tests/build/lint-scope.test.ts` was
 * written for. Checked through `tests/helpers/eslint.ts`, which asks ESLint itself to
 * resolve a configuration for a path under the carve-out and a path outside it — its own
 * resolution, not a re-reading of the config file.
 *
 * The second is subtler and is why this file exists rather than a comment. The obsidianmd
 * rule is not a console rule; it is `rule-custom-message`, a WRAPPER that runs ESLint's
 * built-in `no-console` and rewrites its report. It decides whether to rewrite by comparing
 * the built-in rule's rendered message against a string literal in the plugin's own config
 * — and on no match it reports NOTHING at all (`ruleCustomMessage.js`: the loop over
 * `messageMap` simply falls through). So an ESLint release that rewords one sentence, or a
 * plugin release that changes the `allow` list and therefore the rendered text, silently
 * turns the marketplace's console check off in the one directory where `no-console` is also
 * off. Nothing would fail. The sink would accept `console.log`, and the first sign of it
 * would be a marketplace rejection.
 *
 * So the coupling is pinned directly: render the built-in rule's message under the exact
 * options the plugin passes, and assert the plugin's key still matches it. Both halves are
 * read from the installed packages rather than restated here — a literal copied into this
 * file would pin the copy, not the coupling.
 */

// The carve-out path does not exist yet — the sink arrives with slice 1's Logger port.
// Resolution does not read the file, which is what makes this the right instrument: the
// claim is about the glob, not about a file's contents.
//
// Resolved in a beforeAll rather than at module scope: booting ESLint takes seconds, and a
// top-level await that overruns reports as a module-load failure with no useful message,
// where an overrunning hook names itself and its own timeout.
const IN_CARVE_OUT = 'src/infrastructure/logging/consoleLogger.ts';
const OUTSIDE = 'src/plugin/RenovationPlannerPlugin.ts';

let inCarveOut: ResolvedConfig;
let outside: ResolvedConfig;

/**
 * The plugin's own configuration for the rule it wraps `no-console` with, read out of the
 * installed package. Found by scanning the recommended blocks rather than by index: which
 * block carries it is the plugin's business and moves between releases.
 */
const wrappedNoConsole = (): { messages: Record<string, string>; options: unknown[] } => {
	const entry = obsidianmd.configs.recommended
		.map((block) => block.rules?.['obsidianmd/rule-custom-message'])
		.find((rule) => Array.isArray(rule)) as [
		unknown,
		Record<string, { messages: Record<string, string>; options: unknown[] }>,
	];

	return entry[1]['no-console'];
};

/** What ESLint's built-in `no-console` actually reports, under the plugin's own options. */
const emittedFor = (code: string): string[] =>
	new Linter()
		.verify(code, { rules: { 'no-console': ['error', ...wrappedNoConsole().options] } })
		.map((message) => message.message);

describe('the logging carve-out', () => {
	beforeAll(async () => {
		inCarveOut = await resolveConfig(IN_CARVE_OUT);
		outside = await resolveConfig(OUTSIDE);
	}, 60_000);

	it('turns no-console off under src/infrastructure/logging/ and nowhere else', () => {
		expect(severityOf(inCarveOut, 'no-console')).toBe(0);
		expect(severityOf(outside, 'no-console')).toBe(2);
	});

	/**
	 * The block sets one rule, deliberately, so that the per-directory OVERRIDE (two flat
	 * config blocks matching one file replace a rule rather than merging it) costs only
	 * `no-console`. If it ever grew a second rule or a `files` pattern that swallowed the
	 * budget block, the size limits would vanish from the sink with nothing to say so.
	 */
	it('leaves the size budget and the obsidianmd console rule in force there', () => {
		expect(severityOf(inCarveOut, 'max-lines')).toBe(2);
		expect(severityOf(inCarveOut, 'obsidianmd/rule-custom-message')).toBe(2);
	});

	/**
	 * The pin. `rule-custom-message` matches the built-in rule's rendered message against a
	 * literal and swallows the report on a miss, so the two have to be compared, not
	 * assumed. Both sides come from `node_modules`: the expected text from the plugin's own
	 * recommended config, the actual text from ESLint's own rule under the options that
	 * config passes it.
	 */
	it('still recognises the message ESLint emits, so console.log is not silently allowed', () => {
		const keys = Object.keys(wrappedNoConsole().messages);
		const emitted = emittedFor("console.log('x');\n");

		// One report, and the wrapper's own test — equality or substring — recognises it.
		expect(emitted).toHaveLength(1);
		expect(keys.some((key) => emitted[0] === key || emitted[0].includes(key))).toBe(true);
	});

	/**
	 * The other direction, and the one that would make the pin above vacuous if it broke:
	 * an allowed method must produce no report at all, or "console.log fails" would be true
	 * only because everything fails.
	 */
	it('leaves console.debug alone, which is what the sink actually calls', () => {
		expect(emittedFor("console.debug('x');\n")).toEqual([]);
	});

	/**
	 * The carve-out only means anything if the surrounding tree is linted at all. ESLint's
	 * global `ignores` legitimately covers `scripts/` and the root configs, so this is not
	 * a whole-set measurement like `lint-scope.test.ts` — it is the one direction that
	 * would turn the gate silent instead of red.
	 */
	it('does not ignore the trees it is the only linter for', async () => {
		const ignored = await Promise.all(
			[IN_CARVE_OUT, OUTSIDE, 'src/main.ts', 'tests/build/suppressions.test.ts'].map((file) => isIgnored(file)),
		);

		expect(ignored).toEqual([false, false, false, false]);
	});
});
