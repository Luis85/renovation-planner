import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { REPO, lintedFiles } from '../helpers/oxlint';
import { ESLINT_BOOT_MS, resolveConfig, warmUpEslint } from '../helpers/eslint';

/**
 * The whole argument for a second linter is the tree the first one cannot reach: the
 * Obsidian ruleset is type-aware, so `eslint.config.mjs` stops it at `src/` and ignores
 * `scripts/` and the root config files outright. oxlint lints all of them — and that is a
 * claim about an `ignorePatterns` array in `.oxlintrc.json`, one edit away from being
 * false with nothing to say so. A pattern that swallows a directory does not fail a lint
 * run; it makes one quieter.
 *
 * So the check asks oxlint itself which files it would lint (`--debug=files`, the same
 * resolution the real run uses) and compares that against every source file on disk.
 * Asserting "some file under scripts/ is linted" would pass while one of them was
 * excluded — the set is measured whole, not sampled.
 */

// What oxlint parses, and it must not be NARROWER than what the tool parses: an extension
// missing here makes this check measure a smaller tree than the one it is asserting about,
// which passes. `.d.mts` and `.cts` match nothing on disk today and stay listed for that
// reason — the cost of a spare extension is nothing, and the cost of a missing one is a
// silent pass.
//
// `vue` is here because oxlint DOES parse an SFC — measured, not assumed: it reported
// `no-console` inside a `<script setup lang="ts">` block, and `--debug=files` names
// `ViewRoot.vue` among the files it lints. So SFCs are in the oxlint gate and in the
// edit-loop hook (`scripts/lint-edited.mjs`, which carries the same list), and leaving
// `vue` out here would have made this test assert about a tree with the SFCs cut out of it.
const LINTED = /\.(?:ts|mts|cts|js|mjs|cjs|vue)$/;

const walk = (dir: string): string[] =>
	readdirSync(path.join(REPO, dir), { withFileTypes: true }).flatMap((entry) => {
		const child = `${dir}/${entry.name}`;

		if (entry.isDirectory()) return walk(child);
		return LINTED.test(entry.name) ? [child] : [];
	});

const linted = new Set(lintedFiles());

describe('the oxlint gate', () => {
	// One case per tree, so a failure names the directory that fell out of scope rather
	// than printing one diff of every file in the repository.
	for (const dir of ['src', 'tests', 'scripts']) {
		it(`lints every source file under ${dir}/`, () => {
			expect([...walk(dir)].filter((file) => !linted.has(file))).toEqual([]);
		});
	}

	/**
	 * The root config files are the case ESLint cannot take at all: they are outside
	 * `tsconfig.json`, so the type-aware rules would crash on them and `eslint.config.mjs`
	 * ignores them by name. Named here rather than globbed, because the point is that
	 * these specific files — the build, the suite and the harness — are covered by
	 * something.
	 */
	it('lints the root config files ESLint has to ignore', () => {
		const configs = ['vite.config.ts', 'vite.harness.config.ts', 'vitest.config.ts', 'eslint.config.mjs'];

		expect(configs.filter((file) => !linted.has(file))).toEqual([]);
	});

	// The other direction: `ignorePatterns` still has to hold. Vendored agent tooling ran
	// to hundreds of findings on the first run here, and a gate that loud is one nobody
	// reads.
	it('leaves the vendored and generated trees alone', () => {
		const excluded = ['node_modules/', 'coverage/', 'dist/', '.obsidian/', '.claude/'];

		expect([...linted].filter((file) => excluded.some((dir) => file.startsWith(dir)))).toEqual([]);
	});
});

/**
 * The other gate's scope, for the one claim about it that turned out to be believed wrongly:
 * the 450-line budget on test files.
 *
 * A review round asserted — as a measurement — that the budget "does not reach
 * `tests/harness/indexPage.test.ts` at all", reading `files: [`${TESTS}/*.ts`]` as one level
 * deep. It is not: `TESTS` is `**\/tests/**`, so the pattern is `**\/tests/**\/*.ts` and `**`
 * matches any depth including none. Asked of ESLint's own `calculateConfigForFile`, the budget
 * resolves for a nested test file exactly as it does for a top-level one, and `indexPage.test.ts`
 * measured 449 of its 450 lines — one under, which is why a review round that read the glob
 * instead of asking the linter could believe the cap was absent while it was in fact about to
 * fire.
 *
 * So the repair is not to widen anything. It is to stop the glob's SHAPE being the evidence: a
 * budget that quietly stopped reaching the deepest test directories would make the gate looser
 * with nothing to say so, which is the same failure mode the oxlint scope check above exists for.
 * Both depths are asked, because a case at one depth alone is what could not tell them apart.
 */
describe('the ESLint test-file size budget', () => {
	beforeAll(warmUpEslint, ESLINT_BOOT_MS);

	it.each([
		['tests/helpers/editor.ts', 'one level'],
		['tests/harness/indexPage.test.ts', 'two levels'],
		['tests/presentation/editor/tools/selectTool.test.ts', 'three levels'],
	])('reaches %s, %s under tests/', async (file) => {
		// A real file on disk, asserted as such: `calculateConfigForFile` answers happily for a
		// path that does not exist, so a typo'd or moved fixture would make this case measure the
		// config for nothing at all and still pass.
		expect(existsSync(path.join(REPO, file)), `${file} is not on disk`).toBe(true);

		const config = await resolveConfig(path.join(REPO, file));

		expect(config.rules['max-lines']).toEqual([2, { max: 450, skipBlankLines: true, skipComments: true }]);
	});
});
