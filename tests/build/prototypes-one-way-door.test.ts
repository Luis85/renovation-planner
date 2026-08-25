import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ESLINT_BOOT_MS, lintText, warmUpEslint } from '../helpers/eslint';
import { REPO } from '../helpers/oxlint';

/** Paths this file may have written to disk, tracked so a failed assertion still cleans up. */
const writtenFixtures = new Set<string>();

afterEach(() => {
	for (const path of writtenFixtures) rmSync(path, { force: true });
	writtenFixtures.clear();
});

/**
 * Writes `code` to a REAL file at `relativePath` (repo-root-relative), lints it, and removes
 * it again — see the header below for why a purely virtual path cannot exercise the type-aware
 * `.ts` blocks. `writtenFixtures` plus `afterEach` guarantee removal even when the assertion
 * after this call throws.
 */
const withRealFixture = (code: string, relativePath: string): Promise<string[]> => {
	const absolute = join(REPO, relativePath);
	mkdirSync(dirname(absolute), { recursive: true });
	writeFileSync(absolute, code);
	writtenFixtures.add(absolute);

	return lintText(code, relativePath);
};

// The ESLint boot, paid once here rather than by whichever test ran first — plus one more
// one-time cost specific to this file: typescript-eslint's project service has to notice a
// path it has never seen before it can type-check it, and that first discovery is what timed
// out inside an individual test's default budget when it was left to happen there (measured:
// ~5s, against vitest's 5000ms default). `warmUpEslint` already opens `src/main.ts`, a path the
// initial program knows about; this second call teaches the project service about a NEW path
// once, under `ESLINT_BOOT_MS`'s generous budget, so no test body pays for it below.
beforeAll(async () => {
	await warmUpEslint();
	await withRealFixture('export {};\n', 'src/core/prototypesOneWayDoorWarmup.ts');
}, ESLINT_BOOT_MS);

/**
 * `src/prototypes/` is a ONE-WAY DOOR: it may import from the rest of `src/`, and nothing may
 * import from it. That keeps design scaffolding out of a built plugin at the IMPORT rather
 * than only at the bundle, so it holds for code nobody has written yet.
 *
 * Every layer is driven, not just one, because the ban is six separate config blocks and a
 * layer whose block was missed reports nothing while looking correct in review.
 *
 * Rule IDS rather than a pass/fail, following `vue-rules.test.ts`: a fixture that went red for
 * its own unrelated reason would otherwise read as a pass.
 *
 * `.ts` fixtures are written to REAL, temporary paths rather than linted purely as virtual
 * text — discovered by actually running this file (as Step 2/5 require): the generic `.ts`
 * block in `eslint.config.mjs` turns on `parserOptions.projectService`, and typescript-eslint's
 * project service refuses a path it cannot find on disk with a FATAL parse error, before any
 * other rule — including `no-restricted-imports` — ever runs. That is not merely a noisier
 * failure: with a virtual-only path, the "allows a prototype to import a real component" test
 * below was passing for the wrong reason (`expect(reported).not.toContain(...)` is trivially
 * true of `['PARSE_ERROR']`), which is exactly the failure mode this plan's review history
 * warns about. `.vue` fixtures elsewhere in the suite (`vue-rules.test.ts`) never hit this,
 * because the Vue block is deliberately configured without `projectService` for the same
 * reason stated there. Each fixture file is written immediately before its assertion and
 * removed immediately after, through `withRealFixture` above.
 */
const IMPORTER = (layer: string) => `src/${layer}/Fixture.ts`;
const PROTOTYPE_IMPORT = "import Mock from '../prototypes/ZoneSummary.vue';\n\nexport const used = Mock;\n";
/** From `src/main.ts` the tree is one level down, not two. */
const ROOT_IMPORT = "import Mock from './prototypes/ZoneSummary.vue';\n\nexport const used = Mock;\n";

const LAYERS = ['core', 'domain', 'application', 'infrastructure', 'presentation', 'plugin'];

describe('the prototypes one-way door', () => {
	it.each(LAYERS)('refuses an import of src/prototypes/ from %s/', async (layer) => {
		const reported = await withRealFixture(PROTOTYPE_IMPORT, IMPORTER(layer));

		expect(reported).toContain('no-restricted-imports');
	});

	/**
	 * `src/main.ts` is the BUILD ENTRY and matches no subtree pattern, so every layer ban
	 * misses it. Driven by its real path rather than a fixture beside it: the whole failure
	 * this catches is a glob that does not reach the file, and a fixture at a different path
	 * would be answering a different question. `src/main.ts` already exists, so this stays a
	 * purely virtual `lintText` call — no write needed, and none of its real content is
	 * disturbed even momentarily.
	 */
	it('refuses an import of src/prototypes/ from the build entry itself', async () => {
		const reported = await lintText(ROOT_IMPORT, 'src/main.ts');

		expect(reported).toContain('no-restricted-imports');
	});

	/**
	 * The complement, and the reason this is not simply "prototypes is banned everywhere":
	 * a prototype composes REAL components, so the door has to be open in that direction. A
	 * rule that closed both ways would pass the test above and make the feature unusable.
	 */
	it('allows a prototype to import a real component', async () => {
		const reported = await withRealFixture(
			"import StatusBar from '../presentation/editor/shell/StatusBar.vue';\n\nexport const used = StatusBar;\n",
			'src/prototypes/Fixture.ts',
		);

		expect(reported).not.toContain('no-restricted-imports');
	});
});
