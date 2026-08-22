import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

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

const REPO = fileURLToPath(new URL('../..', import.meta.url));
// The oxlint package's bin is a plain ES module, so it runs under `process.execPath` on
// both CI platforms. `node_modules/.bin/oxlint` is a shell shim on Windows, which
// execFileSync cannot spawn without a shell.
const OXLINT = path.join(REPO, 'node_modules', 'oxlint', 'bin', 'oxlint');

// What oxlint parses. `.d.mts` is in the list because it lints the declaration files
// beside the build scripts, and a check that quietly skipped them would report a smaller
// set than the tool does and still pass.
const LINTED = /\.(?:ts|mts|cts|js|mjs|cjs)$/;

const walk = (dir: string): string[] =>
	readdirSync(path.join(REPO, dir), { withFileTypes: true }).flatMap((entry) => {
		const child = `${dir}/${entry.name}`;

		if (entry.isDirectory()) return walk(child);
		return LINTED.test(entry.name) ? [child] : [];
	});

// Posix separators on both platforms: oxlint reports Windows paths with backslashes, and
// the expected set is built from `path.join`, which agrees with it there and nowhere else.
const posix = (file: string) => file.split(path.sep).join('/');

const linted = new Set(
	execFileSync(process.execPath, [OXLINT, '--debug=files'], { cwd: REPO, encoding: 'utf8' })
		.split('\n')
		.map((line) => posix(line.trim()))
		.filter(Boolean),
);

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
