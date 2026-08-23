import { readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO, lintedFiles } from '../helpers/oxlint';

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
