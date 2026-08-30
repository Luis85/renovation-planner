import { defineConfig } from 'vitest/config';

/**
 * The child run's config. `include` names `*.fixture.ts` so the deliberately failing spec
 * is collected HERE and nowhere else; the repository root is kept as `root` so the
 * fixture's repo-relative imports of the contract keep resolving, which an out-of-tree
 * temporary directory would not.
 *
 * No coverage, no reporters beyond the default: this run's only output is an exit code and
 * the failure text the parent parses.
 */
export default defineConfig({
	test: {
		root: process.cwd(),
		environment: 'node',
		// NAMED EXACTLY, never globbed. `tests/build/fixtures/*.fixture.ts` also collects
		// Task 8's `indirectDom.fixture.ts`, which reads `document` at module evaluation and
		// therefore throws a `ReferenceError` under this run's node environment — so every
		// child run would carry an unrelated second failure, the direct-run expectation of an
		// assertion-only failure would be false, and the parent's discriminators would be
		// reading a run with two causes in it. A glob absorbs the next fixture and tells
		// nobody, which is the reason `.fallowrc.json`'s own comments give for naming files
		// one at a time.
		include: ['tests/build/fixtures/brokenFake.fixture.ts'],
	},
});
