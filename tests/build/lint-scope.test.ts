import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { REPO, lintedFiles } from '../helpers/oxlint';
import ts from 'typescript';
import { ESLINT_BOOT_MS, resolveConfig, severityOf, warmUpEslint } from '../helpers/eslint';

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

/**
 * A file `lint-edited.test.ts` plants and removes, which is on disk for part of a run and in no
 * snapshot taken outside that window.
 *
 * `plantSfc` writes `tests/harness/lint-edited-probe-<n>.vue` and an `afterEach` removes it. It
 * cannot use a temp directory — the path has to match ESLint's `VUE_FILES` glob or the hook it
 * drives is linting nothing — so the file is genuinely in the tree this file walks, and vitest
 * runs the two in parallel workers.
 *
 * EXCLUDED IN `walk` RATHER THAN AT A CALL SITE, because both comparisons here race it and they
 * race it in OPPOSITE directions. The oxlint gate snapshots `lintedFiles()` at module load and
 * walks inside the case, so a probe planted between the two is on disk and absent from the
 * snapshot. The type gate walks at collection time and parses the tsconfig inside the case, so a
 * probe planted before the walk and gone by the parse is in the list and absent from the include
 * set. One filter at one call site closed the second window and left the first — which is this
 * repository's recurring shape, a distinction repeated everywhere it is expressed or repeated
 * nowhere reliably.
 *
 * The prefix is reserved by construction: `plantSfc` owns it, and no harness SFC anybody wrote is
 * named that way.
 */
const isPlantedProbe = (name: string): boolean => name.startsWith('lint-edited-probe-');

const walk = (dir: string): string[] =>
	readdirSync(path.join(REPO, dir), { withFileTypes: true }).flatMap((entry) => {
		const child = `${dir}/${entry.name}`;

		if (entry.isDirectory()) return walk(child);
		return LINTED.test(entry.name) && !isPlantedProbe(entry.name) ? [child] : [];
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

/**
 * The harness's own SFCs, and the two gates that did not reach them until this check existed.
 *
 * `tests/harness/IndexPage.vue` is the largest Vue file in the repository and the surface every
 * prototype is viewed through, and it was outside BOTH: `tsconfig.json`'s `include` named
 * `src/**\/*.vue` and one test file, and `eslint.config.mjs`'s `VUE_FILES` was `**\/src/**\/*.vue`.
 * What that cost was not hypothetical — the first `vue-tsc` run over it found `HARNESS_PLAN`
 * missing a required `PlanDto` field, annotated as one for as long as it had existed.
 *
 * Both halves are asked of the TOOL rather than read off the glob, for the reason the oxlint
 * scope check above states: a pattern that stops matching a directory does not fail a run, it
 * makes one quieter. TypeScript's own config parser resolves the include list, with `.vue`
 * declared as an extra extension exactly as `vue-tsc` declares it — a plain parse would answer
 * "no files" for a `.vue` glob and that empty answer would pass a sampled check.
 *
 * The set is measured whole in both directions. Every SFC on disk must be in scope, so a new
 * one cannot arrive unchecked; and `no-console` must still be an ERROR under `src/`, so the
 * carve-out this widening required cannot spread past the directory whose job is the console.
 */
describe("the harness's own SFCs", () => {
	beforeAll(warmUpEslint, ESLINT_BOOT_MS);

	// `walk` has already dropped the planted probes — see `isPlantedProbe`, which states why that
	// exclusion belongs to the walk and not to either caller.
	const harnessSfcs = walk('tests/harness').filter((file) => file.endsWith('.vue'));

	// The instrument before the measurement: a walk that found nothing would make every case
	// below vacuous and green.
	it('are files this check can actually see', () => {
		expect(harnessSfcs.length).toBeGreaterThan(0);
	});

	it('are all in the type gate', () => {
		const config = ts.readConfigFile(path.join(REPO, 'tsconfig.json'), ts.sys.readFile);

		expect(config.error, 'tsconfig.json did not parse').toBeUndefined();

		const parsed = ts.parseJsonConfigFileContent(
			config.config,
			ts.sys,
			REPO,
			undefined,
			'tsconfig.json',
			undefined,
			// What `vue-tsc` adds, and without it TypeScript resolves a `.vue` glob to nothing
			// at all — the failure that would read as "no files out of scope".
			[{ extension: '.vue', isMixedContent: true, scriptKind: ts.ScriptKind.Deferred }],
		);
		const included = new Set(parsed.fileNames.map((file) => path.relative(REPO, file).replaceAll('\\', '/')));

		expect(harnessSfcs.filter((file) => !included.has(file))).toEqual([]);
	});

	it.each([['tests/harness/IndexPage.vue'], ['tests/harness/SharedWorldPrototype.vue']])(
		'%s is linted by the Vue rules, with the console left to the harness',
		async (file) => {
			expect(existsSync(path.join(REPO, file)), `${file} is not on disk`).toBe(true);

			const config = await resolveConfig(path.join(REPO, file));

			// A rule only `VUE_FILES` supplies, so its presence is what says the block matched.
			expect(severityOf(config, 'vue/max-attributes-per-line')).toBe(1);
			expect(severityOf(config, 'no-console')).toBe(0);
		},
	);

	// The other direction. The carve-out is one block setting one rule; a `files` entry that
	// widened to `src/` would turn the logging policy off where it is the policy.
	it('leaves the console ban in force under src/', async () => {
		const config = await resolveConfig(path.join(REPO, 'src/presentation/editor/shell/EditorToolbar.vue'));

		expect(severityOf(config, 'no-console')).toBe(2);
	});
});
