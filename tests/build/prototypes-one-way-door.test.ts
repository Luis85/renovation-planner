import { beforeAll, describe, expect, it } from 'vitest';
import { ESLINT_BOOT_MS, lintText, warmUpEslint } from '../helpers/eslint';

/**
 * `src/prototypes/` is a ONE-WAY DOOR: nothing in `src/` may import from it, and no layer ban
 * stands in the way of the reverse. That keeps design scaffolding out of a built plugin at the
 * IMPORT rather than only at the bundle, so it holds for code nobody has written yet.
 *
 * The open direction is REAL and is used: a mock may carry a `<script setup>`, so it may import
 * — `WorkPackageFilters.vue` imports `ref` from `vue` — and a scripted mock composing a real
 * component by import is the shape a promoted component already has. A TEMPLATE-ONLY mock still
 * has nowhere to put an import statement and composes through the harness index's global
 * registry instead; both routes are live, and `src/prototypes/README.md` says which to reach
 * for. The last case below is what keeps the ban from becoming symmetric; its own comment says
 * what that is worth.
 *
 * Every layer is driven, not just one, because the ban is eight separate config blocks (six
 * `forbidden(...)` calls, the root-of-`src/` block, and the catch-all block below that covers
 * a subtree none of the six names) and a layer whose block was missed reports nothing while
 * looking correct in review. Two EXTENSIONS are driven for the same reason as two globs:
 * `srcFiles()` (`eslint.config.mjs`) and the root-of-`src/` block both cover every extension
 * `SRC_EXTENSIONS` names — `allowJs` plus what Vite's own resolver accepts, not what the tree
 * currently holds — and they are two SEPARATE glob lists, so a case proving one covers `.js`
 * says nothing about the other. Three of those extensions — `.tsx`, `.mts`, `.cts` — are
 * BANNED but driven by no case below: `SRC_EXTENSIONS`'s own comment in `eslint.config.mjs`
 * measures why no fixture, virtual or a real file written to disk, can reach them without
 * crashing ESLint outright, rather than reporting a finding this file could assert on.
 *
 * Rule IDS rather than a pass/fail, following `vue-rules.test.ts`: a fixture that went red for
 * its own unrelated reason would otherwise read as a pass.
 *
 * `.vue` fixtures are linted as PURELY VIRTUAL text against a path that need not exist — never
 * `.ts`. The generic `.ts` block in `eslint.config.mjs` turns on
 * `parserOptions.projectService`, and typescript-eslint's project service refuses a `.ts` path
 * it cannot find on disk with a FATAL parse error before any other rule — including
 * `no-restricted-imports` — ever runs. An earlier version of this file worked around that by
 * writing each fixture to a REAL temporary file under `src/`, which is worse: two other test
 * files (`lint-scope.test.ts`, `suppressions.test.ts`) read the `src/` tree independently and
 * vitest runs files in parallel, so a fixture present when one of them walks `src/` and gone by
 * the time it reads the file back is a cross-file race, not a hypothetical. `.vue` fixtures
 * sidestep the problem entirely: `srcFiles()` scopes every `forbidden()` block to every
 * extension `SRC_EXTENSIONS` names (`eslint.config.mjs`) — `.ts` and `.vue` among them — so a
 * `.vue` path drives the identical `no-restricted-imports` rule, and the Vue block
 * carries no `projectService` at all (see its own comment in `eslint.config.mjs`, for the same
 * reason) — so a path that does not exist on disk parses cleanly instead of fatally. `.vue` is
 * also what this tree actually holds, per its README.
 *
 * `.js` fixtures need none of that: measured, a virtual `.js` path parses cleanly with no
 * `PARSE_ERROR` either, because `.js` is outside the generic `.ts`-only type-aware block just
 * as `.vue` is — there is simply no `parserOptions` anywhere in `eslint.config.mjs` that scopes
 * to `.js` and turns on `projectService`. Plain `import`/`export` text is enough; no `sfc()`
 * wrapper, because a `.js` file is not an SFC.
 *
 * `sfc()` wraps each `.vue` fixture's script in a minimal `<script setup>`/`<template>` pair:
 * bare script text at a `.vue` path is not what `vue-eslint-parser` expects and is not what a
 * real file in this tree looks like either — measured, a bare import statement at a `.vue` path
 * reports only `vue/multi-word-component-names`, never touching `no-restricted-imports` at all,
 * which would have made every assertion below pass or fail for the wrong reason again.
 */
const sfc = (script: string): string => `<script setup lang="ts">\n${script}\n</script>\n\n<template>\n\t<div />\n</template>\n`;

const IMPORTER = (layer: string) => `src/${layer}/Fixture.vue`;
const PROTOTYPE_IMPORT = sfc("import Mock from '../prototypes/ZoneSummary.vue';\n\nconst used = Mock;\nvoid used;");
/** From `src/main.ts` the tree is one level down, not two. Plain `.ts`: `src/main.ts` is real. */
const ROOT_IMPORT = "import Mock from './prototypes/ZoneSummary.vue';\n\nexport const used = Mock;\n";

/** The `.js` counterparts of `PROTOTYPE_IMPORT`/`ROOT_IMPORT` — plain text, no `sfc()`. */
const JS_PROTOTYPE_IMPORT = "import Mock from '../prototypes/ZoneSummary.vue';\n\nexport const used = Mock;\n";
const JS_ROOT_IMPORT = "import Mock from './prototypes/ZoneSummary.vue';\n\nexport const used = Mock;\n";

const LAYERS = ['core', 'domain', 'application', 'infrastructure', 'presentation', 'plugin'];

// The ESLint boot, paid once here rather than by whichever test ran first — plus one more
// one-time cost, measured separately: the FIRST `lintText` call against a real, type-aware
// (`.ts`) path builds typescript-eslint's project-service program, and that build alone (not
// `warmUpEslint`'s `calculateConfigForFile`, which never invokes the parser) cost ~1.4s locally
// and ~5.1s under `npm run test:coverage`'s instrumentation and full-suite parallel load —
// enough to blow an individual test's default 5000ms timeout when left to happen there. This
// primes it with the exact call the "build entry" test below makes, so that test only ever
// pays the ~10ms cached cost. No file is written for this — `src/main.ts` already exists.
beforeAll(async () => {
	await warmUpEslint();
	await lintText(ROOT_IMPORT, 'src/main.ts');
}, ESLINT_BOOT_MS);

describe('the prototypes one-way door', () => {
	it.each(LAYERS)('refuses an import of src/prototypes/ from %s/', async (layer) => {
		const reported = await lintText(PROTOTYPE_IMPORT, IMPORTER(layer));

		expect(reported).toContain('no-restricted-imports');
	});

	/**
	 * `src/main.ts` is the BUILD ENTRY and matches no subtree pattern, so every layer ban
	 * misses it. Driven by its real path rather than a fixture beside it: the whole failure
	 * this catches is a glob that does not reach the file, and a fixture at a different path
	 * would be answering a different question. `src/main.ts` already exists on disk, so this
	 * stays a purely virtual `lintText` call — no write needed, and none of its real content
	 * is disturbed even momentarily.
	 */
	it('refuses an import of src/prototypes/ from the build entry itself', async () => {
		const reported = await lintText(ROOT_IMPORT, 'src/main.ts');

		expect(reported).toContain('no-restricted-imports');
	});

	/**
	 * `.js` is a DIFFERENT extension in a DIFFERENT glob than `.ts`/`.vue`, in both places the
	 * ban lives: `srcFiles()`'s subtree pattern and the root-of-`src/` block's own `files`
	 * array. One layer stands in for all six subtree blocks the same way `.vue` does above —
	 * `srcFiles()` is one function, so every `forbidden(...)` call shares whatever extension
	 * list it names — but the root block is a SEPARATE literal `files` array, so it needs its
	 * own case; a fix to one glob is not a fix to the other.
	 */
	it('refuses an import of src/prototypes/ from a .js file in a layer', async () => {
		const reported = await lintText(JS_PROTOTYPE_IMPORT, 'src/core/Fixture.js');

		expect(reported).toContain('no-restricted-imports');
	});

	it('refuses an import of src/prototypes/ from a .js build entry', async () => {
		const reported = await lintText(JS_ROOT_IMPORT, 'src/main.js');

		expect(reported).toContain('no-restricted-imports');
	});

	/**
	 * The six `forbidden(...)` calls in `eslint.config.mjs` name today's six layers, one
	 * `srcFiles(layer)` glob each — so a SUBTREE none of them names (`src/shared/`, say)
	 * matches none of the six, and the root-of-`src/` block above does not reach it either
	 * (that block only covers files sitting directly at the root). A catch-all block in
	 * `eslint.config.mjs`, placed BEFORE the six `forbidden(...)` calls, is what closes
	 * this — and its position, not its rule, is the fix: see that block's own comment for
	 * why AFTER would silently take every layer ban away instead (this file's sibling case
	 * below is the other half of that proof).
	 */
	it('refuses an import of src/prototypes/ from a subtree no forbidden(...) call names', async () => {
		const reported = await lintText(PROTOTYPE_IMPORT, 'src/shared/Fixture.vue');

		expect(reported).toContain('no-restricted-imports');
	});

	/**
	 * The other half of the catch-all's proof, and the one a fix touching only the case
	 * above would never catch: a REAL cross-layer violation — `core/` naming `presentation/`
	 * — in a layer the catch-all's own glob ALSO matches. If the catch-all ever ends up
	 * placed after the six `forbidden(...)` calls in `eslint.config.mjs`, this is the case
	 * that goes red: the catch-all's narrower `prototypes`-only rule would override
	 * `core/`'s full ban instead of the other way around, and this import would pass while
	 * the prototypes-only tests above stayed green throughout.
	 */
	it('still refuses a real cross-layer import once the catch-all block is in place', async () => {
		const reported = await lintText(
			sfc("import StatusBar from '../presentation/editor/shell/StatusBar.vue';\n\nconst used = StatusBar;\nvoid used;"),
			'src/core/Fixture.vue',
		);

		expect(reported).toContain('no-restricted-imports');
	});

	/**
	 * The complement, and the reason this is not simply "prototypes is banned everywhere".
	 *
	 * The reason is NOT "a prototype imports real components" — that was impossible while the
	 * tree was template-only and is merely possible now, which is not the same as being what
	 * this case holds. What
	 * this case actually holds is that the ban is DIRECTIONAL: a rule closed both ways would
	 * pass every case above while making this tree a layer nothing may reach out of, and the
	 * error it produced would be about layers rather than about the template-only rule that is
	 * the real constraint. It also keeps the door open for the one direction promotion needs —
	 * the moment a `<script setup>` is added, the file is a component in `src/presentation/` and
	 * the imports it gains are ordinary; nothing about the move should turn on a prototypes-only
	 * ban that was never meant to fire that way.
	 *
	 * Both a positive and a negative check on `no-restricted-imports`, and a check that
	 * parsing itself succeeded: `not.toContain('no-restricted-imports')` alone cannot tell a
	 * genuine pass from a fatal parse error swallowing every rule, including this one — that
	 * is exactly what happened when this file used `.ts` fixtures (see the header above), and
	 * `not.toContain('PARSE_ERROR')` is what would have caught it.
	 */
	it('allows a prototype to import a real component', async () => {
		const reported = await lintText(
			sfc("import StatusBar from '../presentation/editor/shell/StatusBar.vue';\n\nconst used = StatusBar;\nvoid used;"),
			'src/prototypes/Fixture.vue',
		);

		expect(reported).not.toContain('no-restricted-imports');
		expect(reported).not.toContain('PARSE_ERROR');
	});
});
