import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveConfig } from '../helpers/eslint';
import { REPO, lintOne, lintedFiles } from '../helpers/oxlint';

/**
 * No linted file silences a linter inline.
 *
 * The hole this closes is specific and was measured: oxlint honours ESLint's directive
 * spelling as well as its own, and the rules that govern suppressions here
 * (`eslint-comments/no-unlimited-disable`, `require-description`, `no-restricted-disable`)
 * arrive with the Obsidian ruleset, which reaches `src/` and no further — `tests/` gets
 * the TypeScript baseline only, and `scripts/` and the root configs are in ESLint's global
 * `ignores`. So across exactly the tree oxlint was added to cover, one comment turns a rule
 * off and nothing anywhere reports it. A gate that can be switched off from inside the
 * file it guards is a suggestion.
 *
 * The remedy for a rule that genuinely does not fit is `.oxlintrc.json`, where the reason
 * is written down and a reviewer sees it — `no-underscore-dangle` is the worked example.
 *
 * `options.reportUnusedDisableDirectives` covers the complementary case, and only that
 * one: a directive silencing nothing. It cannot see a directive that is doing its job,
 * which is the one worth refusing.
 *
 * ESLint's half of this is `linterOptions.noInlineConfig` in `eslint.config.mjs`, which
 * refuses the whole class rather than a spelling — including the rule-CONFIGURATION form
 * (`eslint some-rule: off` in a block comment), which carries no directive keyword and so
 * is invisible to the scan below. That form was the real exposure: `no-restricted-syntax`
 * and `no-restricted-imports` are ESLint-only, so oxlint could not have backstopped them.
 * The last case here is what keeps that setting from being removed silently.
 */

// Assembled from parts rather than written out, so this file is scannable by the rule it
// states — a literal here would be a finding in the gate's own source. Every spelling
// either tool honours (bare, the two line forms, the block form) begins with one of these
// two, so a substring match sees all of them.
const DIRECTIVES = ['eslint', 'oxlint'].map((tool) => `${tool}-disable`);

const carries = (text: string) => DIRECTIVES.some((directive) => text.includes(directive));

describe('inline lint suppressions', () => {
	const files = lintedFiles();

	/**
	 * The instrument, tested first, and against the real linter rather than against
	 * itself: an empty file list would pass the assertion below by scanning nothing, and a
	 * needle that no longer matches what oxlint honours would pass it by recognising
	 * nothing. This drives one directive through oxlint and watches a real finding
	 * disappear.
	 */
	it('recognises a directive that really does silence the linter', () => {
		expect(files.length).toBeGreaterThan(30);

		const dir = mkdtempSync(path.join(tmpdir(), 'suppressions-'));
		const probe = path.join(dir, 'probe.ts');
		// `no-dupe-keys`, a `correctness` rule this repository has switched on, and one that
		// reports exactly once rather than dragging a second rule in with it.
		const offence = 'export const settings = { units: 1, units: 2 };\n';
		const silenced = `// ${DIRECTIVES[0]}-next-line no-dupe-keys\n${offence}`;

		writeFileSync(probe, offence);
		expect(lintOne(probe)).toContain('no-dupe-keys');

		writeFileSync(probe, silenced);
		expect(lintOne(probe)).toBe('');
		expect(carries(silenced)).toBe(true);
	});

	it('are absent from every file oxlint lints', () => {
		const suppressing = files.filter((file) => carries(readFileSync(path.join(REPO, file), 'utf8')));

		expect(suppressing).toEqual([]);
	});

	/**
	 * Asked of `src/`, where the rules worth turning off live — the layer bans and the
	 * vault write boundary — and asked of the resolved configuration rather than of the
	 * file that declares it, because flat config is where this would go wrong: a block
	 * matching one file overrides rather than merges, so a setting can be present and not
	 * reach anything. What this does NOT check is that ESLint honours its own setting;
	 * that is ESLint's contract, and the measurement is in the comment beside it.
	 */
	it('cannot be re-enabled by a comment, because ESLint takes no inline configuration', async () => {
		// Asked through `tests/helpers/eslint.ts`, which is ESLint's own resolution in
		// process. This used to spawn the bin for `--print-config` and spent 4.4 of
		// vitest's 5-second default inside that one boot; the helper exists because a
		// second caller of the same instrument would have made that a flake rather than a
		// cost.
		const resolved = await resolveConfig('src/main.ts');

		expect(resolved.linterOptions.noInlineConfig).toBe(true);
	}, 60_000);
});
