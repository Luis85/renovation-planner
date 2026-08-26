# Harness Prototyping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a designer and a coding agent build a screen out of template-only mock SFCs and real Vue components in the browser harness, on the real stylesheet, without any of it reaching a built plugin.

**Architecture:** A new `src/prototypes/` tree holds template-only `.vue` files. The harness gains an index page that discovers prototypes and components with `import.meta.glob`, mounts them against one seeded Pinia fixture reused from `tests/harness/planEditor.ts`, and gives each entry its own URL so `npm run harness-shot <entry>` can capture it headlessly. Two independent checks keep prototypes out of `dist/`: an ESLint one-way-door ban and a bundle test.

**Tech Stack:** Vue 3 SFCs, Pinia, Vite (three configs), vitest + v8 coverage, ESLint flat config, oxlint, fallow, playwright-core.

**Spec:** [`docs/requirements/Prototype a screen in the harness before it is built.md`](../../requirements/Prototype%20a%20screen%20in%20the%20harness%20before%20it%20is%20built.md)

## Global Constraints

- **`npm run check` is the definition of done**: `npm run build && npm run lint && npm run test:coverage && npm run analyze`. All four must pass before any commit.
- **Coverage floors** (`vitest.config.ts:267-272`), which may rise but never fall: `statements: 99`, `functions: 99`, `lines: 99`, `branches: 98`.
- **Lint is two linters**: `oxlint --deny-warnings && eslint . --max-warnings 0`. Warnings fail.
- **No inline lint suppressions.** `eslint.config.mjs` sets `linterOptions.noInlineConfig`, and `tests/build/suppressions.test.ts` scans for oxlint directives. A rule that does not fit is turned off in config, with the reason written down.
- **Layer rule:** `presentation → application → domain → core`; `infrastructure → application`; only `plugin/` composes all. Enforced by `no-restricted-imports` per directory.
- **Nothing writes to the vault outside `infrastructure/`.**
- **`tests/` mirrors `src/`.** Naming a test directory is a claim about where the code goes.
- **Build entry is `src/main.ts`**, `lib.entry` in `vite.config.ts:70-71`, output `dist/`.
- **Never lower a coverage floor to accommodate this work.** Exclude non-shipping code by path instead.

---

### Task 1: The `src/prototypes/` tree and its one-way door

Creates the tree and the lint ban that makes it a one-way door, plus the configuration a new tree under `src/` needs so `npm run check` stays green while it holds only a placeholder.

**Files:**
- Create: `src/prototypes/README.md`
- Modify: `eslint.config.mjs:323-352` (the five `forbidden(...)` call sites)
- Modify: `vitest.config.ts:29` (coverage `exclude`)
- Modify: `.fallowrc.json` (`entry` array)
- Test: `tests/build/prototypes-one-way-door.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: the directory `src/prototypes/`, and the guarantee that no file outside it may import from it. Tasks 3–8 put files in this tree.

> **Executed. The code blocks in this task are MIRRORED from the committed files**, not from the
> draft that was written before it ran — the test's fixture technique and the config's extension
> list are both the finished versions. The steps below record the route taken, including the two
> places execution refuted the draft: Step 2's expected `PARSE_ERROR` diagnosis turned out to be
> the finding rather than a troubleshooting note (virtual `.ts` paths cannot be linted under
> `projectService`, so the fixtures are `.vue`), and Steps 3–4's `files` arrays were later replaced
> by `SRC_EXTENSIONS` and joined by a catch-all block for subtrees no `forbidden(...)` call names.
> Read the mirrored code as the answer and the prose as the reasoning that reached it.

- [ ] **Step 1: Write the failing test**

Create `tests/build/prototypes-one-way-door.test.ts`.

**Drive ESLint; do not read its config.** `tests/helpers/eslint.ts` already exists for exactly
this, and `tests/build/vue-rules.test.ts`'s header states the reason better than this plan can:
*"A rule present in a flat config but scoped to files it never matches reports nothing and looks
correct."* A test that greps the config for `'prototypes'` proves the string is there, not that
an import is refused — and criterion 3 asks for a planted file to be linted.

```typescript
import { beforeAll, describe, expect, it } from 'vitest';
import { ESLINT_BOOT_MS, lintText, warmUpEslint } from '../helpers/eslint';

/**
 * `src/prototypes/` is a ONE-WAY DOOR: it may import from the rest of `src/`, and nothing may
 * import from it. That keeps design scaffolding out of a built plugin at the IMPORT rather
 * than only at the bundle, so it holds for code nobody has written yet.
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
	 * The complement, and the reason this is not simply "prototypes is banned everywhere":
	 * a prototype composes REAL components, so the door has to be open in that direction. A
	 * rule that closed both ways would pass the test above and make the feature unusable.
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
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/build/prototypes-one-way-door.test.ts`

Expected: FAIL on all six layers — `no-restricted-imports` is not reported, because no layer
bans `prototypes` yet. The last test PASSES already, which is correct: nothing bans that
direction and nothing should.

**A layer reporting `PARSE_ERROR` is not a troubleshooting note — it is what actually happened,
and it is why the mirrored test above uses `.vue` fixture paths.** typescript-eslint's
`parserOptions.projectService` refuses to parse a path that is not in the TypeScript program, and
that refusal is FATAL: `no-restricted-imports` never runs, so the negative case
(`not.toContain('no-restricted-imports')`) passed against `['PARSE_ERROR']` and meant nothing. The
Vue block carries no `projectService`, which is why a virtual `.vue` path parses cleanly and
reaches the rule. The test now also asserts `not.toContain('PARSE_ERROR')` so the same green
cannot return.

- [ ] **Step 3: Add `'prototypes'` to all five existing bans**

In `eslint.config.mjs`, add `'prototypes'` to the `groups` array of each of the five `forbidden(...)` calls — located by the helper's name rather than by line, since slice 8's merge moved every line in this file. For example the first becomes:

```javascript
	forbidden(
		'core',
		{
			groups: ['domain', 'application', 'infrastructure', 'presentation', 'plugin', 'prototypes'],
			packages: PRESENTATION_AND_HOST,
		},
		'core/ is generic technical ground — geometry, units, money, ids, results, events. It knows nothing about renovation and nothing about a host.',
	),
```

Do the same for `'domain'`, `'application'`, `'infrastructure'` and `'presentation'` — append `'prototypes'` to each `groups` array, changing nothing else.

- [ ] **Step 4: Add the missing bans for `plugin/` AND for the root of `src/`**

`plugin/` composes every layer, so it has no `forbidden(...)` call today. Add this immediately
after the `forbidden('presentation', …)` call:

```javascript
	forbidden(
		'plugin',
		{ groups: ['prototypes'] },
		'plugin/ composes every layer, which is why it has no other ban — but src/prototypes/ is design scaffolding that must never reach a built plugin, and the composition root is the one place that could pull it in.',
	),
```

**That is not sufficient, and the reason is the whole point of this step.** `srcFiles` builds
`**/src/${subtree}/**/*`, so every `forbidden(...)` call covers a *subtree* — and
**`src/main.ts` is not in one.** It sits at the root of `src/`, and it is the build entry
(`vite.config.ts` sets `lib.entry` to exactly that file). So the single most important file in
the repository would be the one place a prototype import is *not* refused.

`forbidden()` cannot express it, since it takes a subtree name. Add a block of its own,
immediately after the `forbidden('plugin', …)` call:

```javascript
	{
		/**
		 * The root of `src/` — which today is `src/main.ts` and nothing else, and which no
		 * `forbidden(...)` call can reach: that helper builds `**​/src/<subtree>/**​/*`, so a
		 * file sitting directly in `src/` matches no subtree pattern at all.
		 *
		 * It is also the BUILD ENTRY (`vite.config.ts`, `lib.entry`). A prototype imported
		 * here is a prototype in every user's plugin, so the file with the most to lose was
		 * the one file the layer bans did not cover.
		 */
		// Mirrored note: this literal pair was later replaced by `SRC_EXTENSIONS.map(...)`, so
		// the root block covers every extension the layer bans do. See the committed config.
		files: ['**/src/*.ts', '**/src/*.vue'],
		rules: {
			'no-restricted-imports': [
				'error',
				{
					patterns: [
						{
							group: ['**/prototypes', '**/prototypes/*', '**/prototypes/**/*'],
							message:
								'src/main.ts is the build entry, so an import of src/prototypes/ here puts design scaffolding in every user’s plugin.',
						},
					],
				},
			],
		},
	},
```

- [ ] **Step 5: Run the test again**

Run: `npx vitest run tests/build/prototypes-one-way-door.test.ts`

Expected: PASS, 6 assertions.

- [ ] **Step 6: Create the tree with a README that explains itself**

Create `src/prototypes/README.md`:

```markdown
# src/prototypes — mocks and prototypes, never shipped

Template-only `.vue` files: a `<template>` block and nothing else. Pure HTML to write, and
already a real Vue component the harness mounts like any other, so **promotion adds a
`<script setup>` and moves the file — the markup is never redrawn.** That is the whole point,
and `tests/build/prototype-promotion.test.ts` holds it.

**This tree is a one-way door.** It may import from the rest of `src/`; nothing in `src/` may
import from it. Two checks, because neither is sufficient alone:

- `eslint.config.mjs` bans the import from every other layer — checked at the forbidden thing,
  so it holds for code nobody has written yet. `tests/build/prototypes-one-way-door.test.ts`.
- `tests/build/prototypes-not-bundled.test.ts` asserts against `dist/`, catching the dynamic
  route lint cannot see. It derives what to look for from THIS TREE — no file here has to
  remember a marker, because a marker only ever proves the marker is absent.

It is excluded from coverage (`vitest.config.ts`) because nothing ships it, and declared to
fallow (`.fallowrc.json`) because `import.meta.glob` is a Vite feature its static graph cannot
follow.

Reachable at `npm run harness`, from the index at the root.
```

- [ ] **Step 7: Exclude the tree from coverage**

In `vitest.config.ts`, change line 29 from:

```typescript
			exclude: ['src/main.ts'],
```

to:

```typescript
			// `src/main.ts` is registration glue needing the real Obsidian Plugin runtime.
			// `src/prototypes/**` is design scaffolding that is never in a built plugin
			// (`tests/build/prototypes-not-bundled.test.ts`), so measuring it would let a
			// mock's untested branches move a gate that exists for shipped code — and the
			// floors are a RATCHET, so a tree that drags them is a tree that lowers them.
			exclude: ['src/main.ts', 'src/prototypes/**'],
```

- [ ] **Step 8: Declare the tree to fallow**

In `.fallowrc.json`, add to the `entry` array after `"tests/harness/page.ts"`:

```json
		"src/prototypes/**/*.vue",
```

And add this to the comment block above `entry`, after the `type-safety.test-d.ts` paragraph:

```
	// `src/prototypes/**/*.vue` is a fifth kind: the harness index reaches every one of them
	// through `import.meta.glob`, which is a VITE feature resolved at build time and invisible
	// to a static import graph — so fallow sees a tree nothing imports and reports every file
	// dead. Declared as entries rather than as `dynamicallyLoaded` because they are modules
	// that import other modules (a prototype composes real components), and fallow has to
	// follow those edges or it reports the components dead instead.
```

- [ ] **Step 9: Run the full gate**

Run: `npm run check`

Expected: PASS, all four steps. If `analyze` reports `src/prototypes/README.md` or the empty tree, the `entry` glob matched nothing — a `.vue` file arrives in Task 3, so if fallow objects to a glob with no matches, move the entry line to Task 3 Step 6 and note it in the commit message.

- [ ] **Step 10: Commit**

```bash
git add src/prototypes/README.md eslint.config.mjs vitest.config.ts .fallowrc.json tests/build/prototypes-one-way-door.test.ts
git commit -m "Add src/prototypes as a one-way door

Nothing outside the tree may import from it, banned per layer in
eslint.config.mjs so the rule holds for code nobody has written yet.
plugin/ gains its first forbidden() call: it composes every layer, which
is exactly why it is the one place that could pull scaffolding into a
build.

Excluded from coverage because nothing ships it and the floors are a
ratchet, and declared to fallow because import.meta.glob is a Vite
feature its static graph cannot follow."
```

---

### Task 2: The bundle test

The backstop the one-way door cannot be: lint reads static imports, and a dynamic specifier or a route nobody anticipated is what the built artifact catches.

**Files:**
- Test: `tests/build/prototypes-not-bundled.test.ts`

**Interfaces:**
- Consumes: `src/prototypes/` from Task 1.
- Produces: nothing other tasks import. It asserts against `dist/`.

- [ ] **Step 1: Write the failing test**

Create `tests/build/prototypes-not-bundled.test.ts`.

**It asks the build what went into it.** Two earlier drafts scanned the bundle text and both
were wrong, in opposite directions, which is why this one does neither:

- A **marker** (`rp-prototype`) proves only that the marker is absent. The next prototype
  nobody remembered to mark ships past a green test.
- A **basename** derived from the tree is worse than useless: naming a mock after the component
  it stands in for is the workflow this whole feature is built for — `src/prototypes/StatusBar.vue`
  beside the real `StatusBar.vue` — and the real one already puts that string in the bundle. The
  gate would fail on correct work. Minification finishes the argument: `FIXTURE_PLAN`,
  `seedFixture` and `HARNESS_PLAN` are module-scope names that a release build renames — and a
  const holding an object literal can be inlined away entirely — so a fixture could ship with
  every assertion green.

Rollup reports the module ids that composed each chunk. That is provenance, and it is immune to
both problems.

```typescript
import path from 'node:path';
import { build } from 'vite';
import type { Rolldown } from 'vite';
import { beforeAll, describe, expect, it } from 'vitest';
import { REPO } from '../helpers/oxlint';

/**
 * The guarantee with a user on the other end: no prototype or fixture MODULE composes a
 * built chunk. `prototypes-one-way-door.test.ts` refuses the import statement; this refuses
 * the outcome — together they are what serve the wider claim that no mock, prototype or
 * fixture ever reaches a user, by whichever route.
 *
 * Narrower than that wider claim on purpose: `chunk.modules` is where source provenance
 * lives, so a prototype or fixture shipped as a separate output ASSET — a file with a
 * `fileName` and emitted `source`, no module id list — is outside what this test can see.
 * Not cheaply checkable, which is why the sentence above is narrowed rather than the check
 * widened to cover it.
 *
 * Both exist because neither is sufficient. Lint reads static imports and a dynamic
 * specifier slips past it; this sees whatever actually got in, and reports only after the
 * fact.
 *
 * `write: false` — the modules that composed the chunk are in the returned output, so
 * nothing is emitted to disk and this does not race `npm run build`'s own `dist/`.
 *
 * `Rolldown` comes from `vite` itself (`node_modules/vite/dist/node/index.d.ts` re-exports
 * it), not from `rollup`: this repo's Vite (`^8`) bundles with Rolldown, and `rollup` is not
 * an installed dependency here at all. Importing `RollupOutput` from `rollup` would
 * type-check nowhere — this file is outside the one `tests/**` path that gets type-checked
 * (CLAUDE.md's Testing section) — but would still trip `npm run analyze`'s
 * unlisted-dependency scan, which reads import specifiers rather than resolved types.
 */
const BUILD_MS = 120_000;

// Absolute, normalised to forward slashes exactly like `modules` below, so a module id can
// be compared against it the same way on every platform — REPO holds backslashes on
// Windows and the ids built below never do.
const repoRoot = REPO.split(path.sep).join('/');

let modules: string[] = [];

beforeAll(async () => {
	const result = (await build({
		configFile: path.resolve(REPO, 'vite.config.ts'),
		root: REPO,
		build: { write: false },
		logLevel: 'error',
	})) as Rolldown.RolldownOutput | Rolldown.RolldownOutput[];

	const output = Array.isArray(result) ? result[0] : result;
	// EVERY chunk, not the first. A dynamic import — the exact route this test exists to
	// catch, since lint cannot see it — is what Rollup most likely emits as a SEPARATE chunk,
	// so inspecting `output[0]` alone would leave the interesting case unexamined while
	// looking thorough.
	const chunks = output.output.filter((part): part is Rolldown.OutputChunk => part.type === 'chunk');

	if (chunks.length === 0) throw new Error('the build produced no chunk to inspect');

	// Absolute ids, normalised to forward slashes so this reads the same on Windows — which
	// is one of the four legs `npm run check` rides.
	modules = chunks.flatMap((chunk) => Object.keys(chunk.modules).map((id) => id.split(path.sep).join('/')));
}, BUILD_MS);

describe('the built plugin', () => {
	it('was built from real modules, so this test is asserting on something', () => {
		expect(modules.length).toBeGreaterThan(0);
		// A sanity anchor: the entry itself must be in there, or the shape of `chunk.modules`
		// has changed under us and every assertion below would pass vacuously.
		expect(modules.some((id) => id.endsWith('/src/main.ts'))).toBe(true);
	});

	it('contains no module from src/prototypes/', () => {
		// Anchored on this repository's own tree rather than a bare `/src/prototypes/`
		// substring, so a dependency at `node_modules/x/src/prototypes/…` cannot fail this
		// on correct work — `repoRoot` is what excludes `node_modules` from matching at all,
		// since a package inside it never starts with this repo's own absolute path.
		const leaked = modules.filter((id) => id.startsWith(`${repoRoot}src/prototypes/`));

		expect(leaked, `prototypes reached the bundle: ${leaked.join(', ')}`).toEqual([]);
	});

	/**
	 * EVERY test path, not just `tests/harness/`. The guarantee names fixtures, and they do
	 * not all live in one directory — Task 7 adds `tests/fixtures/promotion/` to hold the
	 * promoted SFC, and a harness-only assertion would not have covered it.
	 *
	 * Stated as "nothing under `tests/`" rather than as a list of fixture directories, so the
	 * next one somebody adds is covered without anybody remembering to come back here. Nothing
	 * under `tests/` belongs in a plugin under any circumstances, which makes the broad rule
	 * the correct one rather than merely the convenient one.
	 */
	it('contains no test module at all, fixtures included', () => {
		// Anchored on this repository's own tree for the same reason as the prototypes check
		// above — node_modules/x/tests/… must not trip this on correct work.
		const leaked = modules.filter((id) => id.startsWith(`${repoRoot}tests/`));

		expect(leaked, `test modules reached the bundle: ${leaked.join(', ')}`).toEqual([]);
	});
});
```

- [ ] **Step 2: Run it and watch the anchor tell you the shape is right**

Run: `npx vitest run tests/build/prototypes-not-bundled.test.ts`

Expected: PASS, three tests — and the first one is what makes the other two mean anything. If it
fails on `/src/main.ts`, `chunk.modules` is not the shape this test assumes and the other
assertions are passing over nothing; fix that before continuing.

- [ ] **Step 3: Prove it fails on a prototype — plant one and import it DYNAMICALLY**

Temporarily create `src/prototypes/DoomedPrototype.vue`.

**The name is two words on purpose.** `vue/multi-word-component-names` refuses a single-word
SFC name here, so a probe called `Doomed.vue` makes `npm run lint` red for a reason that has
nothing to do with the import boundary — and Step 5 below exists precisely to observe whether
lint is red or green on a dynamic import. A probe whose failure cannot be attributed to the rule
under test is the same defect as a green signal that means nothing. Measured.

```vue
<template>
	<div>planted</div>
</template>
```

It carries no marker, and its name deliberately does not collide with any component. Temporarily
add to the top of `src/main.ts`:

```typescript
export const planted = import('./prototypes/DoomedPrototype.vue');
```

**An `export`, not a `console.log`.** `.oxlintrc.json` turns `no-console` on for every file under
`src/**`, so a planted `console.log` fails `npm run lint` on the CONSOLE CALL — which would make
Step 5's PASS impossible and, worse, make its FAIL prove nothing about `no-restricted-imports`,
since the run would be red either way. An exported binding also holds the import better than a
console call does: it is a live export, so nothing can tree-shake it away before Rollup reports
the module.

**A dynamic import, deliberately.** It is the route lint cannot see, so it is the one this test
exists for — and it is also what Rollup is most likely to emit as a separate chunk, which is
what the multi-chunk aggregation above is for. A static import would prove the easy half and
leave the hard half untested while looking like a proof.

- [ ] **Step 4: Watch it go red**

Run: `npx vitest run tests/build/prototypes-not-bundled.test.ts`

Expected: FAIL on `contains no module from src/prototypes/`, naming `DoomedPrototype.vue`.

If it PASSES, the aggregation is not reaching every chunk — print `chunks.length` and the file
names before changing anything else, because a green result here means the whole test is
decorative.

- [ ] **Step 5: Confirm lint refuses the same thing**

Run: `npm run lint`

Expected: **PASS** — and that is the point rather than a problem. `no-restricted-imports` does
not see a dynamic specifier, which is precisely why the bundle test exists. Swap the planted line
for the static form to watch lint refuse it:

```typescript
import DoomedPrototype from './prototypes/DoomedPrototype.vue';
export const planted = DoomedPrototype;
```

Run `npm run lint` again: FAIL with `no-restricted-imports` from Task 1's `forbidden('plugin', …)`
block — and read the message, because that is the whole point of this step. It must name
`no-restricted-imports` and nothing else; a run red for a second reason proves nothing about which
rule is doing the work. The two halves cover different routes, and this step is what proves the division of labour
rather than assuming it.

- [ ] **Step 6: Prove it fails on a fixture too — the case a text scan could not catch**

Revert the prototype and plant a fixture import instead:

```bash
git checkout src/main.ts
rm src/prototypes/DoomedPrototype.vue
```

Then temporarily add to the top of `src/main.ts`:

```typescript
import { FIXTURE_PLAN } from '../tests/helpers/planFixtures';
export const planted = FIXTURE_PLAN;
```

**`tests/helpers/planFixtures.ts` and not `tests/harness/fixture.ts`, because the second does
not exist yet** — Task 3 creates it. Planting an import of a module that is not there makes Vite
stop on an unresolved specifier before Rollup ever produces a module list, so the step would fail
on the wrong thing and prove nothing about the assertion. `planFixtures.ts` is in the tree today,
it is genuinely a fixture, and its only import is type-only, so it resolves cleanly and lands in
the module list.

- [ ] **Step 7: Watch the fixture assertion go red**

Run: `npx vitest run tests/build/prototypes-not-bundled.test.ts`

Expected: FAIL on `contains no test module at all, fixtures included`, naming `planFixtures.ts`.

**This is the case that motivated the rewrite**: `FIXTURE_PLAN` is a module-scope const holding
an object literal, and a release build both renames it and can inline it away entirely — so a
text scan for that identifier stays green while every byte of the fixture's data ships.
Provenance sees the module regardless of what minification did to its names.

- [ ] **Step 8: Remove the planted import and run the full gate**

```bash
git checkout src/main.ts
```

Run: `npm run check`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add tests/build/prototypes-not-bundled.test.ts
git commit -m "Assert no prototype or fixture reaches the built plugin

Asks the build what went into it — Rollup reports the module ids that
composed the chunk — rather than scanning the bundle text.

Two text-scanning drafts were wrong in opposite directions. A marker
proves only the marker is absent. A basename derived from the tree is
worse: naming a mock after the component it stands in for is the
workflow this feature exists for, and the real component already puts
that string in the bundle, so the gate would fail on correct work.
Minification settles it — a release build renames FIXTURE_PLAN and can
inline the object it holds away entirely, so a fixture could ship with
every text assertion green.

Watched failing twice before being trusted: a planted prototype and a
planted fixture import, the second being the case no text scan catches."
```

---

### Task 3: The seeded fixture

One world every entry mounts against, so what the designer sees is reproducible and two components on a screen agree. It reuses the plan and zones the Plan Editor harness already defines rather than inventing a second set that could disagree.

**Files:**
- Modify: `tests/harness/planEditor.ts` — export `HARNESS_PLAN`, `HARNESS_ZONES` and `harnessDeps` (named rather than given as a line range, per `CLAUDE.md`: a range is correct until the next insertion above it)
- Create: `tests/harness/fixture.ts`
- Test: `tests/harness/fixture.test.ts`

**Interfaces:**
- Consumes: `HARNESS_PLAN`, `HARNESS_ZONES` and `harnessDeps(): PlanEditorDeps` from `tests/harness/planEditor.ts`, all three made `export` by Step 1.
- Produces, from `tests/harness/fixture.ts`: `seedFixture(): Pinia` — creates a Pinia, makes it
  active, seeds `useProjectStore` with the harness plan and zones, returns it — and
  `harnessEditorContext(): PlanEditorContext`, the value `app.provide(PLAN_EDITOR_CONTEXT, …)` needs.
  Task 4 uses both.

- [ ] **Step 1: Export the existing fixtures and the deps builder**

In `tests/harness/planEditor.ts`, change `const HARNESS_PLAN` (line 25), `const HARNESS_ZONES`
(line ~38) and `function harnessDeps` (line ~100) to `export`. Change nothing else in the file. Add this sentence to the file's header comment, after the "No background document" paragraph:

```
 * `HARNESS_PLAN` and `HARNESS_ZONES` are EXPORTED because the harness index mounts single
 * components against the same world (`fixture.ts`). One fixture rather than two: a second
 * set would be a second derivation that can answer differently, and two components drawn
 * from two plans that differ in a way nobody notices is exactly the defect one world buys
 * its way out of.
```

- [ ] **Step 2: Write the failing test**

Create `tests/harness/fixture.test.ts`:

```typescript
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { storeToRefs } from 'pinia';
import { createApp } from 'vue';
import { seedFixture, harnessEditorContext } from './fixture';
import {
	PLAN_EDITOR_CONTEXT,
	usePlanEditorContext,
	type PlanEditorContext,
} from '../../src/presentation/editor/PlanEditorContext';
import { HARNESS_PLAN, HARNESS_ZONES } from './planEditor';
import { useProjectStore } from '../../src/presentation/stores/ProjectStore';

/**
 * The one world every index entry mounts against. Three claims worth a test: it is SEEDED
 * (a component reading the store finds a plan, with no per-entry setup), it is ONE world
 * (two stores created from it agree, which is what makes two components on a prototype
 * consistent), and the editor context it hands out is one `usePlanEditorContext()` ACCEPTS.
 *
 * The third is driven through a real `createApp` rather than asserted on the returned
 * object, because the failure it guards is a key mismatch: a context built correctly and
 * provided under a symbol the consumer does not inject looks perfect in a shape assertion
 * and throws on mount. `usePlanEditorContext` throws rather than warning, so the index would
 * show Task 4's named-failure card for every component that reads it.
 */
describe('the harness fixture', () => {
	it('seeds the project store with the harness plan and zones', () => {
		seedFixture();

		const { plan, zones } = storeToRefs(useProjectStore());

		expect(plan.value?.id).toBe(HARNESS_PLAN.id);
		expect(zones.value.size).toBe(HARNESS_ZONES.length);
	});

	it('gives two readers the same plan, which is what makes two components agree', () => {
		seedFixture();

		const first = storeToRefs(useProjectStore()).plan;
		const second = storeToRefs(useProjectStore()).plan;

		expect(first.value).toBe(second.value);
	});

	it('provides a context `usePlanEditorContext()` accepts, so a real component can mount', () => {
		let seen: PlanEditorContext | undefined;

		const app = createApp({
			setup() {
				seen = usePlanEditorContext();

				return () => null;
			},
		});

		app.provide(PLAN_EDITOR_CONTEXT, harnessEditorContext());
		app.mount(document.createElement('div'));

		expect(seen?.planId).toBe(HARNESS_PLAN.id);

		app.unmount();
	});
});
```

- [ ] **Step 3: Run it and watch it fail**

Run: `npx vitest run tests/harness/fixture.test.ts`

Expected: FAIL with `Failed to resolve import "./fixture"`.

- [ ] **Step 4: Write the fixture**

Create `tests/harness/fixture.ts`:

```typescript
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import { useProjectStore } from '../../src/presentation/stores/ProjectStore';
import type { PlanEditorContext } from '../../src/presentation/editor/PlanEditorContext';
import { HARNESS_PLAN, HARNESS_ZONES, harnessDeps } from './planEditor';

/**
 * ONE seeded world, behind every entry the harness index mounts.
 *
 * Real components read stores — `StatusBar` alone reads `useProjectStore` and
 * `useEditorStore` — so mounting one in isolation needs state behind it. A single fixture
 * rather than per-entry setup buys two things: what the designer sees is REPRODUCIBLE, and
 * two components on one prototype AGREE, because they read the same plan rather than two
 * invented ones that differ in a way nobody notices until production.
 *
 * The cost, stated rather than hidden: a component state this world does not cover cannot be
 * shown without extending it, and extending it changes what every other entry draws.
 *
 * The plan and zones come from `planEditor.ts` rather than being declared here. A second set
 * would be a second derivation answering differently the day one of them is edited.
 */
export function seedFixture(): Pinia {
	const pinia = createPinia();

	// Process-wide: the last call to `setActivePinia` wins, so calling `seedFixture()` again
	// for a second entry replaces which Pinia `useProjectStore()` resolves to outside an
	// explicit `app.use(pinia)`. Harmless for how Task 4 uses this — one fixture call per
	// mounted entry, immediately consumed — but worth knowing before a caller relies on two
	// live at once.
	setActivePinia(pinia);

	const project = useProjectStore();

	// Assigned directly rather than through `hydrate`: `harnessDeps().queries` answers both
	// queries perfectly well with no vault behind them, so that is not the reason. The real
	// one is that `hydrate` is ASYNCHRONOUS (it awaits two query promises) and `seedFixture`
	// is not — every index entry needs a world in place before its first synchronous mount,
	// not one that lands a tick later. What a component needs is the post-hydration STATE,
	// which is this.
	project.plan = HARNESS_PLAN;
	project.zones = new Map(HARNESS_ZONES.map((zone) => [zone.id, zone]));
	project.status = 'ready';

	return pinia;
}

/**
 * The editor context, which is NOT optional and is easy to miss.
 *
 * `src/presentation/views/PlanEditorView.ts` does three things when it mounts: `createPinia()`,
 * `use(VueKonva)` and **`provide(PLAN_EDITOR_CONTEXT, …)`**. Without the third, every component
 * that calls `usePlanEditorContext()` throws — `PlanEditorRoot`, `BackgroundLayer`, anything
 * using `useThemeTokens` — so the index would render the named failure for exactly the
 * components a designer most wants to look at, and a prototype composing one would too.
 *
 * Built from `harnessDeps()` rather than from a second set of stubs, for the same reason the
 * plan and zones come from `planEditor.ts`: a second derivation answers differently the day one
 * of them is edited.
 */
export function harnessEditorContext(): PlanEditorContext {
	const deps = harnessDeps();

	return {
		planId: HARNESS_PLAN.id,
		queries: deps.queries,
		// Design slice 8's write side, which arrived on `main` while this branch was running.
		// Taken from `harnessDeps()` like everything else here rather than stubbed: it answers
		// `settings.unrecovered` for every write, which is the honest result for a page with no
		// vault — a mock's gestures fail visibly instead of pretending to persist.
		commands: deps.commands,
		vault: deps.vault,
		onThemeChange: deps.onThemeChange,
		onPlanChanged: (listener) => deps.onPlanChanged(HARNESS_PLAN.id, listener),
	};
}
```

- [ ] **Step 5: Run the test again**

Run: `npx vitest run tests/harness/fixture.test.ts`

Expected: PASS, 3 tests. If `project.status = 'ready'` is a type error, read the `ProjectStoreStatus` union in `src/presentation/stores/ProjectStore.ts` and use the member that means hydrated.

- [ ] **Step 6: Run the full gate**

Run: `npm run check`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add tests/harness/fixture.ts tests/harness/fixture.test.ts tests/harness/planEditor.ts
git commit -m "Add the one seeded fixture the harness index mounts against

Real components read stores, so isolation needs a world behind them. One
world rather than per-entry setup buys reproducibility and, more
importantly, makes two components on one prototype agree.

It reuses the plan and zones planEditor.ts already defines instead of
declaring a second set. A second derivation answers differently the day
one of them is edited, and two components drawn from two subtly
different plans is the defect one world buys its way out of."
```

---

### Task 4: Discovery and the index

The index page: every prototype and every component, discovered from the tree so a saved file is reachable with no registration step to forget.

**Files:**
- Create: `tests/harness/entries.ts`
- Create: `tests/harness/IndexPage.vue`
- Modify: `tests/harness/page.ts`
- Test: `tests/harness/entries.test.ts`

**Interfaces:**
- Consumes: `seedFixture()` and `harnessEditorContext()` from Task 3.
- Also owns **criterion 7**, moved here from Task 3 by that task's review: only this task's app installs VueKonva, and without it the two prop-free components that read `useProjectStore` cannot both mount.
- Produces, all from `tests/harness/entries.ts`: `interface HarnessEntry { id: string; label: string; kind: 'prototype' | 'component'; component: () => Promise<unknown> }`, `discoverEntries(modules: Record<string, () => Promise<unknown>>, kind: HarnessEntry['kind']): HarnessEntry[]`, and the two globbed accessors `prototypeEntries(): HarnessEntry[]` / `componentEntries(): HarnessEntry[]`. Task 5 uses the entries; Task 7 drives `prototypeEntries()` directly, which is the only place the real glob is exercised.

- [ ] **Step 1: Write the failing test**

Create `tests/harness/entries.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { discoverEntries, registrableComponents } from './entries';

/**
 * Discovery, tested here on the SHAPE `import.meta.glob` returns rather than on the glob
 * itself: what can go wrong in these cases is the id derivation, and a hand-built map is the
 * only way to drive a collision that does not exist on disk.
 *
 * That leaves the glob's own PATTERN unasserted, and a pattern that stops matching the tree
 * is the failure where nothing a designer adds ever appears. Task 7 adds the case that closes
 * it, in this file, once there is a real `.vue` under `src/prototypes/` to find: discovery
 * against the tree walked independently. It waits for Task 7 because on an empty tree that
 * assertion is `[] === []` — vacuous, and green for the wrong reason.
 *
 * The id is a URL, so it has to be UNIQUE across everything the index lists. A basename is
 * not: `src/prototypes/StatusBar.vue` and `src/presentation/editor/shell/StatusBar.vue` are
 * two different entries a designer would reasonably have at once — a mock of a component
 * next to the component — and collapsing them makes the second unreachable by URL and
 * uncapturable by `harness-shot`.
 */
describe('harness entry discovery', () => {
	it('qualifies the id by kind, so a mock and its real component are both reachable', () => {
		const [prototype] = discoverEntries({ '/src/prototypes/StatusBar.vue': () => Promise.resolve({}) }, 'prototype');
		const [component] = discoverEntries(
			{ '/src/presentation/editor/shell/StatusBar.vue': () => Promise.resolve({}) },
			'component',
		);

		expect(prototype.id).not.toBe(component.id);
		expect(prototype.id).toBe('prototype:StatusBar');
		expect(component.id).toBe('component:editor/shell/StatusBar');
	});

	it('keeps two components with the same basename in different directories distinct', () => {
		const entries = discoverEntries(
			{
				'/src/presentation/editor/shell/StatusBar.vue': () => Promise.resolve({}),
				'/src/presentation/views/StatusBar.vue': () => Promise.resolve({}),
			},
			'component',
		);

		expect(new Set(entries.map((entry) => entry.id)).size).toBe(2);
	});

	/**
	 * The case a FLATTENING id gets wrong, and the reason the separator is preserved rather
	 * than replaced. `a-b/C.vue` and `a/b-C.vue` collapse to the same string the moment `/`
	 * becomes `-`, because `-` is legal in a directory name — so the encoding has to be
	 * reversible, not merely qualified.
	 */
	it('does not collapse a directory name containing the separator character', () => {
		const entries = discoverEntries(
			{
				'/src/presentation/a-b/C.vue': () => Promise.resolve({}),
				'/src/presentation/a/b-C.vue': () => Promise.resolve({}),
			},
			'component',
		);

		expect(new Set(entries.map((entry) => entry.id)).size).toBe(2);
	});

	it('keeps a human-readable label even though the id is qualified', () => {
		const [entry] = discoverEntries(
			{ '/src/presentation/editor/shell/StatusBar.vue': () => Promise.resolve({}) },
			'component',
		);

		expect(entry.label).toBe('StatusBar');
	});

	it('sorts by id, so the index does not reorder itself between runs', () => {
		const entries = discoverEntries(
			{
				'/src/prototypes/Zebra.vue': () => Promise.resolve({}),
				'/src/prototypes/Alpha.vue': () => Promise.resolve({}),
			},
			'prototype',
		);

		expect(entries.map((entry) => entry.label)).toEqual(['Alpha', 'Zebra']);
	});

	it('returns nothing for an empty tree rather than throwing', () => {
		expect(discoverEntries({}, 'prototype')).toEqual([]);
	});
});

/**
 * A template-only prototype writes `<StatusBar />`, so the registry is keyed by LABEL — an id
 * containing `:` and `/` is not a valid tag. Labels are not unique, which is the third place
 * that has mattered in this design.
 *
 * The two collisions are NOT the same question, and an earlier draft treating them alike broke
 * the headline workflow. A mock named after the component it stands in for is not an ambiguity
 * to refuse — replacing that component is the entire reason the mock exists, so the prototype
 * takes the tag. A collision WITHIN one kind has no such answer and is still refused.
 */
describe('registering components for template-only prototypes', () => {
	it('registers an unambiguous label under its tag', () => {
		const { byTag, ambiguous, shadowed } = registrableComponents(
			discoverEntries({ '/src/presentation/editor/shell/StatusBar.vue': () => Promise.resolve({}) }, 'component'),
		);

		expect([...byTag.keys()]).toEqual(['StatusBar']);
		expect(ambiguous).toEqual([]);
		expect(shadowed).toEqual([]);
	});

	it('lets a mock take the tag from the component it stands in for', () => {
		const { byTag, ambiguous, shadowed } = registrableComponents([
			...discoverEntries({ '/src/prototypes/StatusBar.vue': () => Promise.resolve({}) }, 'prototype'),
			...discoverEntries(
				{ '/src/presentation/editor/shell/StatusBar.vue': () => Promise.resolve({}) },
				'component',
			),
		]);

		// The likeliest collision of all, and it is the WORKFLOW rather than a mistake: a
		// designer redrawing `StatusBar` writes a mock called `StatusBar`, and `<StatusBar />`
		// in their prototype has to mean the mock. Refusing both — the earlier draft — left the
		// tag unresolved in exactly the case this feature exists to serve.
		expect(byTag.get('StatusBar')?.kind).toBe('prototype');
		expect(ambiguous).toEqual([]);
		// Reported, because a component quietly replaced is worth one line in the console.
		expect(shadowed).toEqual(['StatusBar']);
	});

	it('refuses a duplicated label rather than letting the last one win', () => {
		const { byTag, ambiguous } = registrableComponents(
			discoverEntries(
				{
					'/src/presentation/editor/shell/StatusBar.vue': () => Promise.resolve({}),
					'/src/presentation/views/StatusBar.vue': () => Promise.resolve({}),
				},
				'component',
			),
		);

		// Two of one kind: no winner exists, so neither is registered. `IndexPage.vue` turns the
		// unresolved tag that follows into a named entry failure, so this is visible rather than
		// a warning nobody reads.
		expect(byTag.has('StatusBar')).toBe(false);
		expect(ambiguous).toEqual(['StatusBar']);
	});

	it('refuses two mocks sharing a label, since neither stands in for the other', () => {
		const { byTag, ambiguous, shadowed } = registrableComponents(
			discoverEntries(
				{
					'/src/prototypes/StatusBar.vue': () => Promise.resolve({}),
					'/src/prototypes/toolbar/StatusBar.vue': () => Promise.resolve({}),
				},
				'prototype',
			),
		);

		expect(byTag.has('StatusBar')).toBe(false);
		expect(ambiguous).toEqual(['StatusBar']);
		expect(shadowed).toEqual([]);
	});
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/harness/entries.test.ts`

Expected: FAIL with `Failed to resolve import "./entries"`.

- [ ] **Step 3: Write the discovery module**

Create `tests/harness/entries.ts`:

```typescript
/**
 * What the harness index can mount, discovered from the tree rather than from a list.
 *
 * A hand-kept manifest is a step somebody has to remember, and `CLAUDE.md` refuses that
 * shape elsewhere for the same reason it is refused here — "src/ is the list and it cannot
 * go stale". The `Coding agent` actor note gives the sharper version: a registration step is
 * one a stateless actor forgets across sessions.
 *
 * `discoverEntries` takes the glob RESULT rather than calling `import.meta.glob` itself, so the
 * id derivation stays a pure function a node test can drive. The two globs live below, in this
 * module rather than in `IndexPage.vue`, because `page.ts` needs the component list too — to
 * register those components globally — and a second glob in a second file is a second answer
 * that can disagree.
 *
 * `import.meta.glob` is a Vite feature, not a Vue one, so a `.ts` module can hold it.
 */
export interface HarnessEntry {
	/** Unique across every entry, and the value `?entry=` carries. See `idFor`. */
	readonly id: string;
	/** The basename, for a human reading the list. Not unique, and never used as a URL. */
	readonly label: string;
	readonly kind: 'prototype' | 'component';
	readonly component: () => Promise<unknown>;
}

/**
 * An id that is unique across the whole index, because it is a URL.
 *
 * A basename alone is NOT unique and the collision is the likely case rather than the exotic
 * one: a mock named after the component it stands in for is exactly what a designer builds,
 * and two components sharing a basename in different directories is ordinary. Either would
 * make the second entry unreachable by `?entry=` and uncapturable by `harness-shot`, with no
 * error — the index would simply always open the first.
 *
 * So: the kind, then the path between the tree root and the file, then the basename.
 */
function idFor(file: string, kind: HarnessEntry['kind']): string {
	const withoutExtension = file.replace(/\.vue$/, '');
	// Everything after the tree root: `…/src/prototypes/X` → `X`, and
	// `…/src/presentation/editor/shell/StatusBar` → `editor/shell/StatusBar`.
	const root = kind === 'prototype' ? '/src/prototypes/' : '/src/presentation/';
	const index = withoutExtension.indexOf(root);
	const relative = index === -1 ? withoutExtension : withoutExtension.slice(index + root.length);

	// The path separator is KEPT. Flattening it to `-` is not reversible — `-` is legal in a
	// directory name, so `a-b/C` and `a/b-C` become one id and one of them stops being
	// reachable, silently. Both `:` and `/` are legal in a query-string value and in a
	// quoted attribute selector, which is everywhere this id has to survive.
	return `${kind}:${relative}`;
}

/**
 * One entry per globbed module, sorted so the index does not reorder itself between runs — a
 * list whose order moves is one a designer cannot navigate by memory, and a screenshot of it
 * would differ run to run for no reason.
 */
export function discoverEntries(
	modules: Record<string, () => Promise<unknown>>,
	kind: HarnessEntry['kind'],
): HarnessEntry[] {
	const entries = Object.entries(modules)
		.map(([file, component]) => ({
			id: idFor(file, kind),
			label: file.split('/').pop()?.replace(/\.vue$/, '') ?? file,
			kind,
			component,
		}))
		.sort((left, right) => left.id.localeCompare(right.id));

	// Belt and braces over a reversible id: if two entries ever do collide, the failure mode
	// without this is SILENT — the index opens the first match and the second is simply
	// unreachable, with nothing to notice. Throwing turns that into a page that says so.
	const ids = new Set(entries.map((entry) => entry.id));

	if (ids.size !== entries.length) throw new Error(`duplicate harness entry ids in ${kind}`);

	return entries;
}

/** Every mock and prototype under `src/prototypes/`. */
export const prototypeEntries = (): HarnessEntry[] =>
	discoverEntries(
		import.meta.glob('../../src/prototypes/**/*.vue') as Record<string, () => Promise<unknown>>,
		'prototype',
	);

/** Every real component under `src/presentation/`. */
export const componentEntries = (): HarnessEntry[] =>
	discoverEntries(
		import.meta.glob('../../src/presentation/**/*.vue') as Record<string, () => Promise<unknown>>,
		'component',
	);

/**
 * Everything a template-only prototype can name, keyed by the tag it would write —
 * `<StatusBar />`, so by LABEL rather than by id, since an id containing `:` and `/` is not a
 * valid tag.
 *
 * Called with BOTH kinds: a prototype composes the mocks beside it as well as the real
 * components, and a template-only file can import neither.
 *
 * Labels are not unique, and this is the third place that has mattered — but the two kinds of
 * collision are different questions and an earlier draft refused both alike, which broke the
 * headline workflow.
 *
 * A MOCK sharing a label with a component is not an ambiguity. Naming a mock after the
 * component it stands in for is the whole point of writing one, so `<StatusBar />` inside a
 * prototype must mean the mock. The prototype takes the tag, deterministically, and the
 * shadowing is reported rather than merely allowed.
 *
 * A collision WITHIN one kind — two mocks, or two components in different directories — has no
 * such answer, so the label is registered for NOBODY and returned in `ambiguous`. That leaves
 * an unresolved tag, which `IndexPage.vue` turns into a named entry FAILURE: Vue only warns
 * about one, and a warning is invisible to `harness-shot`, which would otherwise photograph a
 * prototype with a component silently missing and exit 0.
 */
export function registrableComponents(entries: HarnessEntry[]): {
	byTag: Map<string, HarnessEntry>;
	ambiguous: string[];
	shadowed: string[];
} {
	const seen = new Map<string, HarnessEntry[]>();

	for (const entry of entries) seen.set(entry.label, [...(seen.get(entry.label) ?? []), entry]);

	const byTag = new Map<string, HarnessEntry>();
	const ambiguous: string[] = [];
	const shadowed: string[] = [];

	for (const [label, found] of seen) {
		if (found.length === 1) {
			byTag.set(label, found[0]);
			continue;
		}

		const mocks = found.filter((entry) => entry.kind === 'prototype');

		// Exactly one mock: it wins, whatever number of components it stands in for. Two mocks
		// is a collision within a kind again, and falls through to `ambiguous` with the rest.
		if (mocks.length === 1) {
			byTag.set(label, mocks[0]);
			shadowed.push(label);
			continue;
		}

		ambiguous.push(label);
	}

	return { byTag, ambiguous, shadowed };
}
```

- [ ] **Step 4: Run the test again**

Run: `npx vitest run tests/harness/entries.test.ts`

Expected: PASS, 4 tests.

- [ ] **Step 5: Write the index page component**

Create `tests/harness/IndexPage.vue`:

**This step no longer carries the file's source, and the deletion is deliberate — read this
before reaching for git history to "restore" it.**

An executable snippet for this file was here through round twenty-four. It then diverged from the
committed `tests/harness/IndexPage.vue` across seven review rounds, and by round thirty-two the
divergence was total: the snippet had no `EntryBoundary`, no `warningOwner`, no `reportLateDefect`
and a `mountedId` the code no longer has. **Executing it would have rebuilt a page with none of the
attribution apparatus rounds twenty-five through thirty-one installed** — five review rounds undone
by following the plan.

Two remedies were proposed and both were refused, which is why this section reads as it does.
*Annotating* the stale snippet leaves stale code sitting there to be copied, which is the actual
complaint. *Mirroring* the committed file means every future fix to it must be duplicated here — and
that treadmill is not hypothetical, it is precisely what produced rounds twenty-nine and thirty-two.
A second copy is a second derivation that answers differently the day one of them is edited, which
is the pattern `tests/harness/fixture.ts` and `tests/harness/planEditor.ts` already refuse elsewhere
in this repository for the same reason.

**So the general rule, which the next plan should start from: a plan under execution carries the
argument and the acceptance criteria, and stops carrying executable code for a file once that file
exists and has been reviewed.** The code is the authority the moment it is committed; a snippet is
only useful before there is a file to point at.

`tests/harness/IndexPage.vue` is that authority. What it must satisfy:

**Three ways an entry fails, and no one mechanism sees two of them.**

1. A module that fails to IMPORT rejects the promise — caught around the `await` in `open()`.
2. A module that imports and then THROWS — in `setup()`, in `render()`, or from an async lifecycle
   hook a tick later — fails inside Vue's error cycle, where a try/catch around the import cannot
   see it. A per-entry `onErrorCaptured` boundary covers it; a ROOT hook cannot, because it is
   handed the error and the throwing instance and nothing that says which `open()` call put that
   instance there.
3. A module that neither rejects nor throws can still draw WRONGLY — an unresolved tag, a missing or
   mistyped prop — which Vue only WARNS about. Every warning reaching the handler is a defect: the
   classification is inverted rather than an allowlist, because an allowlist fails silently when it
   is wrong and this one already did, twice.

**All three are asynchronous, which is the harder half.** Any of them can land after the reader has
opened something else, and a report on the wrong entry is worse than no report — it pulls a working
component off the stage and accuses it. Four guards answer that, and they share ONE key.

**The key is the MOUNT, not the entry.** An id cannot distinguish two mounts of the same entry, so
A -> B -> A defeats any id-keyed guard: the stale mount and the live one compare equal. A monotonic
generation, incremented in `open()`, is the key, and all four guards compare it — the loader await,
the `<Suspense>` resolve, the error channel, and the warning channel.

**Readiness means the whole SUBTREE, not the outer module.** Every component is registered as a
`defineAsyncComponent`, so a prototype composing `<StatusBar />` starts loading it only once the
outer module has rendered. `open()` may only ever CLEAR the readiness marker; `<Suspense>`'s
`@resolve` is what sets it, because settling a whole subtree's async dependencies together is
exactly what that boundary is for and it holds at any nesting depth.

Every one of those was a real defect before it was a rule, each has a test that fails without it,
and `tests/harness/indexPage.test.ts` drives all of them. Read that file beside the page: it is
where the acceptance criteria above are actually enforced.

- [ ] **Step 6: Mount the index from the page entry**

In `tests/harness/page.ts`, replace the mount block. **The routing rule is what matters here,
and getting it wrong silently breaks the existing capture workflow**: the three fixed shots in
`scripts/harness-shot.mjs` use the queries `''`, `?theme=light` and `?phone`, none of which
names a view. Routing on "has no `view` parameter → index" would send all three to the index
while `captureOne` waits for `.renovation-planner-view`, and each would time out. So the index
is reached by `?entry=` or by an explicit `?index`, and everything else keeps today's default.

```typescript
import { createApp, defineAsyncComponent, type Component } from 'vue';
import VueKonva from 'vue-konva';
import { mountHarness } from './mount';
import { mountPlanEditorHarness } from './planEditor';
import { seedFixture, harnessEditorContext } from './fixture';
import { PLAN_EDITOR_CONTEXT } from '../../src/presentation/editor/PlanEditorContext';
import { componentEntries, prototypeEntries, registrableComponents } from './entries';
import IndexPage from './IndexPage.vue';
import { installObsidianDom } from '../helpers/dom';
import { applyPlatform, drawSchemeToggle } from './theme';

applyPlatform(window.location.search);

const params = new URLSearchParams(window.location.search);

/**
 * The index is OPT-IN, and that is a decision rather than an accident.
 *
 * `?view=plan-editor` keeps the Plan Editor and everything else keeps the project view,
 * because `scripts/harness-shot.mjs`'s three fixed shots address the project surface with no
 * `view` parameter at all — `''`, `?theme=light`, `?phone`. Making a bare URL mean "index"
 * would break all three, and the test in Task 6 that asserts the fixed shots still exist
 * would keep passing while the captures timed out.
 *
 * The PBI leaves "does the index displace the current root" open. This answers it: it does
 * not, because displacing it costs a working workflow to save one query parameter.
 */
const wantsIndex = params.has('index') || params.has('entry');
const wantsPlanEditor = params.get('view') === 'plan-editor';

let view: unknown = null;

if (wantsIndex) {
	/**
	 * The shim, on this branch too.
	 *
	 * `mountHarness` and `mountPlanEditorHarness` install Obsidian's DOM prototype extensions
	 * and this branch calls neither — but `drawSchemeToggle()` below runs on EVERY branch and
	 * uses `document.body.createEl`. Without this the index mounts and then throws, which
	 * `harness-shot` records as a page error and exits non-zero on: a capture that looks
	 * broken while the entry rendered perfectly.
	 *
	 * `tests/harness/theme.ts:44-47` carries the same rule for `applyPlatform`, with the
	 * sentence that explains why no test catches it: every jsdom file installs these at module
	 * top, so the shimmed spelling passes the suite and throws on the real page.
	 */
	installObsidianDom();
	document.body.empty();

	const root = document.body.createDiv('rp-harness-leaf');
	/**
	 * Pinia AND VueKonva, because the production mount installs both.
	 * `src/presentation/views/PlanEditorView.ts` calls `app.use(VueKonva)` where it mounts, and without it
	 * here every canvas component — `PlanCanvas`, `ZoneLayer`, `ZoneShape` — leaves `VStage`,
	 * `VLayer` and `VLine` unresolved.
	 *
	 * That failure is SILENT in the worst way: Vue reports an unresolved component as a
	 * warning, not an error, and the entry's outer element still satisfies the screenshot
	 * selector. `harness-shot` would exit 0 with a PNG of a missing canvas — the exact shape
	 * of failure this whole feature is built to make impossible.
	 */
	const app = createApp(IndexPage).use(seedFixture()).use(VueKonva);

	/**
	 * The third thing the production mount does, and the one with no `use()` to make it
	 * obvious. `PlanEditorView` calls `app.provide(PLAN_EDITOR_CONTEXT, …)`; without it every
	 * component reading `usePlanEditorContext()` throws, and the index would show the named
	 * failure for precisely the components a designer most wants to see.
	 */
	app.provide(PLAN_EDITOR_CONTEXT, harnessEditorContext());

	/**
	 * Every real component, registered globally and lazily.
	 *
	 * Without this a template-only prototype cannot use one: `<StatusBar />` resolves through a
	 * local import or the app registry, and a file with no `<script setup>` has no imports. The
	 * prototype would render an unresolved custom element — silently, since Vue only warns —
	 * and "compose mocks beside real components" would not work at all, which is the feature.
	 *
	 * `defineAsyncComponent` keeps the glob lazy: registering twelve components eagerly would
	 * mount the presentation layer to draw a list of links.
	 */
	// BOTH kinds. A top-level prototype composes the mocks written beside it, and a
	// template-only mock cannot import a sibling any more than it can import a component —
	// registering only the real ones leaves `<MockToolbar />` unresolved, which is half the
	// main flow. One registry across both is also what lets a mock TAKE the tag of the
	// component it stands in for, which is the workflow rather than a collision to refuse.
	const { byTag, ambiguous, shadowed } = registrableComponents([
		...componentEntries(),
		...prototypeEntries(),
	]);

	for (const [tag, entry] of byTag) {
		app.component(tag, defineAsyncComponent(entry.component as () => Promise<Component>));
	}

	// The workflow, not a warning: a mock named after a component takes its tag.
	if (shadowed.length > 0) console.info(`mocks standing in for components: ${shadowed.join(', ')}`);

	// Two of one kind: registered for nobody rather than for whichever won a race. The
	// unresolved tag that follows is NOT left as a console warning — `IndexPage.vue` catches
	// Vue's resolution warning and turns it into a named entry failure, because a warning is
	// invisible to `harness-shot` and it would photograph the gap and exit 0.
	if (ambiguous.length > 0) console.warn(`ambiguous component tags, not registered: ${ambiguous.join(', ')}`);

	app.mount(root);
} else {
	view = wantsPlanEditor ? mountPlanEditorHarness(document.body).view : mountHarness(document.body).view;
}

drawSchemeToggle();

(window as unknown as Record<string, unknown>).__rp = { view };
```

- [ ] **Step 7: Look at it**

Run: `npm run harness`, then open `?index` on the URL it prints.

Expected: `?index` lists the twelve components under `src/presentation/` and says there are no
prototypes yet. A bare URL still draws the project view and `?view=plan-editor` still draws the
Plan Editor — check both, because those are the three fixed captures' addresses.

- [ ] **Step 8: Hold criterion 7 — two DIFFERENT components reading one plan**

This arrived from Task 3's review and it is the reason this step exists here rather than there.
Criterion 7 reads: *"Two components mounted from one prototype read the same plan: a value shown by
both matches."* Task 3 owned it and could not hold it — two prop-free components reading
`useProjectStore` exist (`StatusBar.vue` and `PlanEditorRoot.vue`), but `PlanEditorRoot` needs
`app.use(VueKonva)`, which only this task's app installs. Its first attempt read one store ref
twice and compared it to itself, which passes whatever the fixture does.

**The obvious pair does not work, and the reason decides the case.** `PlanEditorRoot` does not
render a plan value itself — it reads `status` and gates its ready branch on it, and the plan NAME
a reader sees inside it comes from the `StatusBar` nested in its own template. So "assert the
fixture's plan name appears in standalone `StatusBar` and in `PlanEditorRoot`" exercises two
`StatusBar` instances and passes even if `PlanEditorRoot` stops reading the store entirely.

Measured on the tree after slice 8 merged: of the components reading `useProjectStore`, exactly one
prop-free component renders a PLAN-level value — `StatusBar`, which renders `plan.name`.
`PlanEditorRoot` reads `status`; `ZoneLayer`, `BackgroundLayer` and `InteractionLayer` all declare
required props. So the criterion's literal form — one value rendered by two different components —
has no honest pair available today.

What IS available is the criterion's substance, and it is stronger than the literal form:

**Write it in `tests/harness/entries.test.ts`**, beside the discovery cases, and add that file to
Step 10's `git add` — an earlier draft of this step described the case without naming a file, which
would have let an implementer complete every prescribed edit and commit with criterion 7 untested.

Mount `StatusBar` and `PlanEditorRoot` against ONE `seedFixture()`, in an app configured the way
Step 6 configures the index — Pinia, VueKonva and the editor context. Assert two DIFFERENT
observable consequences of the one seeded world: that `StatusBar` renders the fixture's plan name,
and that `PlanEditorRoot` renders its `status === 'ready'` branch rather than the missing or failed
one. Then assert the negative, which is what makes it mean anything: **with the fixture's
assignments removed, BOTH change** — the name disappears and the ready branch does not render.

That holds what the spec is actually arguing for ("two components on one screen agree, because they
read the same plan rather than two invented ones") through two different components reading two
different fields of one store, and it fails if either stops reading it. State plainly in the test
what it does NOT prove: that two components render the SAME value, which no pair in this tree can
demonstrate until a second plan-level consumer exists.

**Read the DOM SYNCHRONOUSLY, and understand why before you write it.** `PlanEditorRoot` calls
`projectStore.hydrate(...)` from `onMounted`, and `harnessDeps().queries` answer `HARNESS_PLAN` for
any plan id — so one microtask after mounting, `status === 'ready'` **whether or not the fixture
seeded anything**, because the queries seeded it instead. A negative case that awaits a flush
therefore passes for a reason that has nothing to do with `seedFixture`.

That is not a race and the synchronous read is not a lucky window: `hydrate` awaits promises, so its
effect lands on the microtask queue, and an assertion in the same tick as the mount runs strictly
before it. What the fixture exists to provide is a world in place before the FIRST synchronous
mount — every index entry mounts synchronously, which is why `seedFixture` is sync and `hydrate` is
not — so the un-awaited DOM is measuring exactly the thing the criterion is about.

Say that at the observation helper, because the next reader's instinct will be to add an `await`.
If one is ever added the negative case goes RED rather than quietly green, which is the safe
direction — but only if the reason is written down.

Two things remain forbidden however you write it:

- **Mounting one component twice.** That proves Pinia's store is a singleton, which is true
  independent of the fixture, and it is the exact defect Task 3's first attempt shipped.
- **A case that passes on an unseeded store.** Comment out the assignments in `seedFixture` and
  watch it go red before you trust it. If it stays green, say so rather than shipping it.

- [ ] **Step 9: Run the full gate**

Run: `npm run check`

Expected: PASS. If `analyze` reports `IndexPage.vue` or `entries.ts` dead, they are reached from `tests/harness/page.ts`, which is already a fallow entry — check the import chain rather than adding a declaration.

- [ ] **Step 10: Commit**

```bash
git add tests/harness/entries.ts tests/harness/entries.test.ts tests/harness/IndexPage.vue tests/harness/page.ts
git commit -m "Add the harness index, discovered from the tree

Every prototype and every component, listed without a registration step:
a step that must be remembered is one a stateless actor forgets across
sessions, and CLAUDE.md refuses hand-kept lists elsewhere for the same
reason.

entries.ts owns both globs because page.ts needs the component list too
— to register components for template-only prototypes — and a second
glob in a second file is a second answer that can disagree. The id
derivation stays a pure function so a node test can drive it.

A failed mount names itself rather than blanking the stage, because a
gap reads as a layout decision, and onErrorCaptured covers the render
throw the loader catch cannot see."
```

---

### Task 5: A stylesheet check, and the one-sheet claim

The reason the whole feature exists: a mock and a real component drawn side by side must be styled by the same sheet, or an approved mock is approved against something that will not ship.

**Files:**
- Test: `tests/harness/harness.test.ts` (three cases over SOURCE — the page's CSS-bearing nodes, the module graph, and a stylesheet importing a stylesheet)
- Test: `tests/harness/indexPage.test.ts` (one case over the RENDERED DOCUMENT, for the routes no source scan can see)

**Interfaces:**
- Consumes: `tests/harness/index.html`; every non-test module under `src/`, `tests/harness/` and `tests/helpers/` — the three trees the page can reach; every `.css` in `tests/harness/` and `styles/` except `index.css`; and the mounting helper `tests/harness/indexPage.test.ts` already has.
- Produces: nothing.

- [ ] **Step 1: Read what the file already asserts**

Run: `grep -n "describe\|it(" tests/harness/harness.test.ts`

This tells you the existing describe blocks so the new case is added inside the right one rather than creating a second file for one assertion.

- [ ] **Step 2: Write the failing test**

Append this case to the outermost `describe` in `tests/harness/harness.test.ts`:

```typescript
	/**
	 * The one-sheet claim, which is the entire reason prototypes moved out of
	 * `docs/user-experience/concepts/`. A mock drawn against a second sheet is approved
	 * against something that will not ship, and the page offering one is all it would take.
	 *
	 * Asserted on the page rather than on a rendered screen: there is no rendering engine
	 * here, and what CAN be checked — that the page links exactly the three sheets it means
	 * to, and that `concept.css` is not among them — is the thing that would actually go
	 * wrong.
	 *
	 * PARSED, not pattern-matched. This file already runs in jsdom (`@vitest-environment`
	 * at the top), so `DOMParser` is right there, and HTML has more spellings of one link
	 * than a regex written by hand keeps up with: attribute order is free, attribute values
	 * may be UNQUOTED (`<link rel=stylesheet href=…/concept.css>` is valid HTML a browser
	 * loads), tag and attribute names are case-insensitive, and `rel` is a space-separated
	 * token list. Two hand-written patterns here were each defeated by the next spelling
	 * somebody thought of. The parser knows all of them, and it is the same argument
	 * `CLAUDE.md` already makes for checking colours on lightningcss's parsed tree rather
	 * than on source text.
	 *
	 * `[rel~=stylesheet i]` is that knowledge spelled out: `~=` matches one token of the
	 * list, `i` makes it case-insensitive. The `<link rel="icon">` this page carries is
	 * excluded by it, which is checked below rather than assumed.
	 *
	 * `style` joins the selector because a `<style>` element is a second way this page can
	 * introduce CSS, and an `@import` inside one is a way in that no other guard here sees:
	 * the module scan reads `.ts`/`.vue`, the sheet scan reads the harness's own `.css`
	 * files, and neither is this HTML. The expected list is therefore the whole CSS-bearing
	 * set of the page, not its links — which is why a `<style>` appears in it as `<style>`
	 * and fails the equality rather than being silently uncounted.
	 */
	it('offers prototypes exactly one plugin stylesheet and no proposal sheet', () => {
		const html = readFileSync(path.join(REPO, 'tests', 'harness', 'index.html'), 'utf8');

		const page = new DOMParser().parseFromString(html, 'text/html');
		// EVERY node that can introduce CSS, not only the links: a `<style>` element in this
		// page is another way in, and `<style>@import '…/concept.css';</style>` is a way in
		// that no later guard sees either — they scan module sources and the harness's own
		// `.css` files, neither of which is this HTML. Asked as one category so the set is
		// what is asserted, rather than a list of the spellings somebody thought of.
		const sheets = [...page.querySelectorAll('link[rel~=stylesheet i], style')].map((node) =>
			node.tagName === 'STYLE' ? '<style>' : (node.getAttribute('href') ?? ''),
		);

		expect(sheets).toEqual(['./obsidian.css', './theme.css', '/styles.css']);
		expect(sheets.some((href) => href.includes('concept'))).toBe(false);
	});
```

If `readFileSync`, `path` or `REPO` are not already imported in that file, add them:

```typescript
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { REPO } from '../helpers/oxlint';
```

- [ ] **Step 3: Write the second case — the route the HTML scan cannot see**

The case above reads `index.html`, and a `<link>` is not the only way a sheet reaches the page.
`import '../../docs/user-experience/concepts/concept.css'` — in `tests/harness/page.ts`, or in
any module it can reach — or a `<style>` block in `tests/harness/IndexPage.vue`, loads a second
sheet through Vite's module graph. The HTML has three links either way and the first case stays
green.

Three facts decide the scope, and all three were measured rather than assumed:

- `eslint.config.mjs`'s `VUE_FILES` is `['**/src/**/*.vue']`, so `vue/no-restricted-block`
  already refuses a `<style>` block anywhere under `src/`, prototypes included. That half needs
  nothing here — and must not be duplicated by a text scan, which would report `ViewRoot.vue`,
  whose comment spells the tag it promises never to use.
- A `.vue` file under `tests/` matches **no ESLint configuration at all** (`eslint .` skips it
  silently) and oxlint reports nothing on one either. So `tests/harness/IndexPage.vue` — a file
  Task 4 creates — is linted by neither, and a `<style>` block in it is refused by nothing.
- **Nothing refuses a `.css` import in either tree**, and the route is transitive: `page.ts`
  imports the harness modules, those import `src/`, and Task 4's index globs `src/prototypes/**`
  and `src/presentation/**`. A sheet imported by a component three levels down is loaded exactly
  as surely as one imported in `page.ts`, and a scan of the harness directory alone would not
  see it.

Scanning both trees for the import closes the transitive route without building anything: if no
file in either imports a stylesheet, nothing reachable through them does. Measured on the tree as
it stands — 169 files, no importer, no `<style>` block outside that one comment.

Hence a text scan, over what the page can reach rather than over the files that exist today:

```typescript
	/**
	 * The same claim over every other route. A sheet reaches this page as a `<link>` in
	 * `index.html`, through Vite's module graph — a `.css` import anywhere in what the page
	 * can load, or an SFC `<style>` block — or as a `<link>` a TEMPLATE renders into the
	 * body, which no build step and no import is involved in at all. The case above can see
	 * only the first. The page's sheets are the three links in `index.html`, and nothing the
	 * page can reach may add a fourth.
	 *
	 * The scanned set is what the page can reach, not the files that exist today: `page.ts`
	 * imports the harness modules, those import `src/` AND `tests/helpers/`, and Task 4's
	 * index globs `src/prototypes/**` and `src/presentation/**` — so a sheet imported by a
	 * component three levels down, or by a DOM helper, is loaded exactly as surely as one
	 * imported here. Scanning all three trees closes the transitive route without building
	 * anything: if no file in any of them imports a stylesheet, nothing reachable through
	 * them does.
	 *
	 * The three spellings are checked over different sets, and the asymmetry is deliberate:
	 *
	 * - A `<style>` block is checked in `tests/harness/` ONLY, because `eslint.config.mjs`
	 *   already refuses one anywhere under `src/` (`vue/no-restricted-block`, over
	 *   `VUE_FILES` = `['**​/src/**​/*.vue']`) while a `.vue` under `tests/` matches no
	 *   ESLint block at all — measured. Scanning `src/` for it here would duplicate a live
	 *   rule AND report `ViewRoot.vue`, whose comment spells the tag it is promising never
	 *   to use. A text scan cannot tell a comment from a block; the linter can, and does.
	 * - A `.css` IMPORT is checked over both, because no rule refuses one in either.
	 * - A `<link rel="stylesheet">` IN A TEMPLATE is checked over both as well, and it is the
	 *   spelling that needs no build step and no import at all: a browser honours a
	 *   stylesheet link in the body, so a mock carrying one loads the proposal sheet while
	 *   the import scan, the `<style>` scan and the `index.html` scan all stay green. Matched
	 *   as `<link … stylesheet` rather than by attribute order, for the reason the case above
	 *   already gives — and narrow enough that the prose in this repository that merely says
	 *   "stylesheet" does not trip it. Measured: no hit in 169 files.
	 *
	 * The import pattern matches the SPECIFIER POSITION — a quoted string preceded by `from`,
	 * by `import`, or by `import(` — rather than the bare substring `.css`. Both halves of
	 * that are load-bearing:
	 *
	 * Not the bare substring, because prose naming `concept.css` is how this repository
	 * explains itself, and a guard that fires on its own explanation gets deleted rather
	 * than obeyed.
	 *
	 * And not `import` alone, because `import classes from './panel.module.css'` — Vite's
	 * ordinary CSS-modules form — puts the specifier after `from`, and a pattern anchored
	 * on the quote following `import` misses it while looking thorough. Measured on all
	 * five spellings: side-effect, default binding, named binding, dynamic, and a
	 * re-export.
	 */
	it('loads no stylesheet through anything the harness can reach', () => {
		const sheetImport = /(?:\bfrom\s*|\bimport\s*\(?\s*)['"][^'"]*\.css['"]/;
		const sheetLink = /<link[^>]*\bstylesheet\b/i;
		// Every extension Vite will load as a module, not the two this repository happens to
		// hold today: `tsconfig.json` sets `allowJs`, so a `.js` or `.mjs` helper is as
		// reachable as any other and its CSS import would load the same sheet.
		const MODULE = /\.(?:ts|tsx|js|mjs|cjs|jsx|vue)$/;
		const sources = (dir: string): string[] =>
			readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
				const full = path.join(dir, entry.name);
				if (entry.isDirectory()) return sources(full);
				return MODULE.test(entry.name) && !entry.name.endsWith('.test.ts') ? [full] : [];
			});

		const reachable = [
			...sources(path.join(REPO, 'src')),
			...sources(path.join(REPO, 'tests', 'harness')),
			// `tests/helpers/` too: `mount.ts` and `planEditor.ts` are RUNTIME modules of this
			// page and they import from there, so a stylesheet imported by a helper reaches the
			// page exactly as surely as one imported here.
			...sources(path.join(REPO, 'tests', 'helpers')),
		];
		const read = (file: string): string => readFileSync(file, 'utf8');

		const importers = reachable.filter((file) => sheetImport.test(read(file)));
		const linkers = reachable.filter((file) => sheetLink.test(read(file)));
		const styleBlocks = sources(path.join(REPO, 'tests', 'harness')).filter((file) =>
			/<style[\s>]/.test(read(file)),
		);

		expect({ importers, linkers, styleBlocks }).toEqual({ importers: [], linkers: [], styleBlocks: [] });
	});
```

`readdirSync` joins the existing `node:fs` import, and `import { transform } from 'lightningcss';`
is new — the package is already a devDependency and `scripts/styles-assemble.mjs` already imports
it, so nothing arrives for this.

**A stylesheet can import a stylesheet, and that is a fourth route.** `@import
'../../docs/user-experience/concepts/concept.css';` added to `tests/harness/theme.css` loads the
proposal sheet: the HTML still has its three links, no module imports a `.css`, no template renders
a `<link>`, and every list above stays empty. The walker excludes `.css` files entirely, so it
cannot see it.

The two linked harness sheets are the reachable ones, and neither has any legitimate use for
`@import` — they are standalone files the page links directly. So the rule is simply that they
carry none:

```typescript
	it('lets no stylesheet the page loads pull in another', () => {
		// PARSED, for the same reason the page check is parsed rather than pattern-matched.
		// `@IMPORT` is valid CSS and a browser honours it; `/@import/` does not match it, and
		// `/@import/i` would then match one inside a comment. `lightningcss` answers both at
		// once — it is already a devDependency, already used by the stylesheet gate, and the
		// visitor sees exactly what the cascade would.
		const importsIn = (file: string): string[] => {
			const found: string[] = [];
			transform({
				filename: file,
				code: readFileSync(file),
				minify: false,
				visitor: { Rule: { import: (rule) => (found.push(rule.value.url), []) } },
			});
			return found;
		};

		const sheets = (dir: string, skip: string[] = []): string[] =>
			readdirSync(dir)
				.filter((name) => name.endsWith('.css') && !skip.includes(name))
				.filter((name) => importsIn(path.join(dir, name)).length > 0)
				.map((name) => path.posix.join(path.basename(dir), name));

		const imported = [
			...sheets(path.join(REPO, 'tests', 'harness')),
			// `styles/` too, minus `index.css`. The assembler validates index.css's OWN lines
			// against `@import "./<partial>.css";` — but it then concatenates each partial's
			// body UNCHANGED (`scripts/styles-assemble.mjs`, the `parts` map: line count and
			// hard-coded colours are checked, nothing else), so an `@import` inside a partial
			// survives into the shipped sheet and into the page. Verified in the source, after
			// an earlier version of this comment claimed the assembler owned the question and
			// was wrong.
			...sheets(path.join(REPO, 'styles'), ['index.css']),
		];

		expect(imported).toEqual([]);
	});
```

One file is excluded and exactly one: **`styles/index.css`**, which uses `@import` for
`./view.css`, `./editor.css` and `./chrome.css`. That is how the shipped sheet is assembled, and
`scripts/styles-assemble.mjs` validates those lines itself — only `@import "./<partial>.css";` and
comments are allowed in that file, flat, no subdirectories. Refusing `@import` there would refuse
the mechanism the plugin's own stylesheet is built from.

**The PARTIALS are not excluded, and an earlier version of this plan wrongly said they were.** It
claimed the assembler owned an `@import` inside a partial. It does not: reading its `parts` map,
each partial's body is checked for line count and hard-coded colours and then concatenated
**unchanged**. So `@import '/prototype.css';` in `styles/view.css` reaches the assembled sheet, and
therefore the page, with every other guard green. That is why the scan covers `styles/` too.

- [ ] **Step 4: Run the cases**

Run: `npx vitest run tests/harness/harness.test.ts`

Expected: PASS. They are **regression guards**, not drivers, and that is worth being explicit
about: they exist so that adding `concept.css` to the harness — by any of its routes — is a red
test rather than a quiet reintroduction of the split.

- [ ] **Step 5: Prove the link case can fail**

Temporarily add to `tests/harness/index.html`, after the `/styles.css` link — **unquoted, and
with `href` first**, which is valid HTML a browser loads and is the spelling both hand-written
patterns before this one missed:

```html
		<link href=../../docs/user-experience/concepts/concept.css rel=stylesheet>
```

Plant the `<style>` spelling too, since it is the one no other guard would catch:

```html
		<style>@import '../../docs/user-experience/concepts/concept.css';</style>
```

Expected: FAIL, with `'<style>'` present in the reported list — which is the reading that tells you
the category selector caught it rather than the equality failing for some other reason.

Run: `npx vitest run tests/harness/harness.test.ts`

Expected: FAIL on both assertions, with `concept.css` present in the reported list — which is the
part worth reading rather than just seeing red. A parser that had quietly dropped the unquoted
link would fail the first assertion too, on a list of three that no longer matched a list of four,
and look identical at a glance.

Then revert: `git checkout tests/harness/index.html`

Worth one more run before moving on, because it is the assumption the case rests on: confirm the
page's own `<link rel="icon">` is NOT in `sheets`. If it were, the expected list would be four
entries and the assertion would have been written around the parser's behaviour rather than
against the page.

- [ ] **Step 6: Prove the module-graph case can fail**

Temporarily add to `tests/harness/page.ts`, as its first line:

```typescript
import '../../docs/user-experience/concepts/concept.css';
```

Run: `npx vitest run tests/harness/harness.test.ts`

Expected: FAIL, naming `page.ts` under `importers`. Then revert: `git checkout tests/harness/page.ts`

Plant the **transitive** case too, because it is the one the previous version of this guard
missed: put the same import at the top of `src/presentation/editor/shell/StatusBar.vue`'s script
block. Expected: FAIL, naming that file — a sheet a component pulls in is loaded as surely as one
`page.ts` pulls in. `git checkout` afterwards.

Plant the remaining two spellings as well — a guard watched failing on one of its spellings has
been watched failing on one of its spellings, and each of these has its own list to land in:

- A `<style>` block in whichever `.vue` the harness directory holds at this point. Expected FAIL
  under `styleBlocks`.
- `<link rel="stylesheet" href="../../docs/user-experience/concepts/concept.css" />` inside a
  `<template>` — put it in `src/prototypes/ZoneSummary.vue` if Task 7 has landed, otherwise in the
  harness's own `.vue`. Expected FAIL under `linkers`. This is the spelling that reaches the page
  with no import and no build step, which is why it is worth planting rather than reasoning about.

`git checkout` after each.

- [ ] **Step 7: The route no source scan can see — check the rendered document**

Every guard above reads SOURCE. A template can render a stylesheet link without any of them
seeing a `<link` at all: `<component is="link" rel="stylesheet" href="…/concept.css" />` is valid
Vue and produces a real one, and `<component :is="tag">` with a computed value is not statically
knowable even in principle.

This is the sixth route found on this feature, and the fifth was already the point at which
enumerating spellings stopped being the right shape. So this case does not add a spelling. It asks
the DOCUMENT, after an entry has mounted, which is the only place every route converges:

```typescript
	const cssNodes = (): number => document.querySelectorAll('link[rel~=stylesheet i], style').length;

	// The control. It proves the mounting path and the counting work, so the loop below is not
	// silently doing nothing while the prototypes tree is empty.
	it('adds no stylesheet to the document when a component mounts', async () => {
		const before = cssNodes();

		// Mount through the index the way a designer opens an entry, not by importing the
		// component directly — the question is what the PAGE ends up with.
		const page = await openEntryInIndex('component:editor/shell/StatusBar');

		expect(cssNodes()).toBe(before);

		page.unmount();
	});

	// The real ones, from the real glob. Empty until Task 7 adds `ZoneSummary.vue`, and covering
	// it from that moment with no edit here — the tree being the registration, applied to the
	// guard as well as to the index.
	it.each(prototypeEntries())('adds no stylesheet when $id mounts', async ({ id }) => {
		const before = cssNodes();

		const page = await openEntryInIndex(id);

		expect(cssNodes()).toBe(before);

		page.unmount();
	});
```

**Drive every REAL prototype, not one hard-coded entry — and mind where you put it.**
`tests/harness/indexPage.test.ts` mounts the index for criterion 8, but it **mocks `./entries`**, so
a check living there inspects fixtures rather than the tree. Mounting one hard-coded `StatusBar`
would be worse still: the route this case exists for is a PROTOTYPE rendering a `<link>`, and a
component entry cannot exercise it.

So the case must iterate what `prototypeEntries()` actually returns — the real glob — and it must
live somewhere discovery is not mocked. Reuse a mounting helper rather than writing a second one,
but the entry list has to be real even where the helper is borrowed.

**On an empty tree this covers nothing, and that is stated rather than hidden.** Task 5 runs before
any prototype exists, so today the loop has no iterations. It becomes meaningful the moment Task 7
puts `ZoneSummary.vue` in the tree — with no edit to this test, which is the same "the tree IS the
registration" property the feature is built on, applied to its own guard. Add one component entry
alongside as a control, so the case is not silently doing nothing before then: the control proves
the mounting path and the counting work, and the loop proves it over whatever the tree holds.

Say both of those in the test. A reader who finds a loop with no iterations and no explanation will
reasonably assume it is dead.

**Watch it fail on the route it exists for**: give a fixture entry the template
`<component is="link" rel="stylesheet" href="../../docs/user-experience/concepts/concept.css" />`,
and confirm the count goes up. That is the spelling no source scan sees, so it is the only planted
proof worth taking here.

**What this does and does not add.** It closes the category — any route a template takes to put a
sheet on the page, including ones nobody has thought of — for the entries a test actually mounts.
It does NOT replace the source scans: those catch a sheet in the edit loop, before anything runs,
and they cover files no test mounts. Two checks, different reach, and the source scans stay because
neither subsumes the other. Say that in the test, so the next reader does not delete one for the
other.

- [ ] **Step 8: Prove the `@import` case can fail, in both trees**

Plant it in BOTH trees before trusting it, because they are guarded for different reasons — and
plant one as `@IMPORT`, since answering case is half of why this parses rather than matching:

- `tests/harness/theme.css` — expect FAIL naming `harness/theme.css`.
- `styles/view.css` — expect FAIL naming `styles/view.css`. This is the one an earlier draft
  believed was somebody else's problem, so it is the one worth seeing red.

`git checkout` each afterwards.

`*.test.ts` is skipped, and the reason is worth stating rather than discovering: the tests in
`tests/harness/` name stylesheet paths as strings they READ — `cssVars.test.ts` and this file
both do — and a test that reads a stylesheet is not a page that loads one.

**The extension list is every module type Vite will load**, rather than the two this repository
happens to hold. `tsconfig.json` sets `allowJs`, so a `.js` or `.mjs` helper under either tree is
reachable and its CSS import loads the same sheet — and a scan admitting only what already exists
is a scan of the past, which is the failure this guard has now had corrected three times in three
different places. Measured with the widened list: still 169 files, still no hit.

Report the two lists in one `toEqual` rather than two `expect([]).toEqual([])` calls, so a
failure names WHICH file and WHICH half — a bare `expected [ '…' ] to equal []` sends the reader
back to the source to find out which rule they broke.

- [ ] **Step 9: Run the full gate**

Run: `npm run check`

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add tests/harness/harness.test.ts tests/harness/indexPage.test.ts
git commit -m "Guard the one-sheet claim on the harness page

A mock drawn against a second sheet is approved against something that
will not ship, which is the entire reason prototypes moved out of
docs/user-experience/concepts/. Adding concept.css to the harness page
is now a red test rather than a quiet reintroduction of the split.

Two routes, because a sheet reaches the page as a <link> or through
Vite's module graph, and a scan of index.html can only see the first.
A .vue under tests/ matches no ESLint configuration, so the second is
refused by nothing else.

Both watched failing with a sheet planted before being trusted."
```

---

### Task 6: `harness-shot` takes an entry name

The coding agent's eye. Without it every layout judgement is deferred to a human, and the agent cannot catch the class of defect `CLAUDE.md` records four instances of.

**Files:**
- Modify: `scripts/harness-shot.mjs:37-47` (the `SHOTS` array) and `run()`
- Test: `tests/build/harness-shot.test.ts` (add cases)

**Interfaces:**
- Consumes: the `?entry=` URL from Task 4.
- Produces: `npm run harness-shot <entry>` writing `harness-shots/entry-<name>-dark.png` and `-light.png`.

- [ ] **Step 1: Write the failing test**

Append to `tests/build/harness-shot.test.ts`, inside its existing `describe`:

```typescript
	/**
	 * The agent's eye. `docs/actors/Coding agent.md` states the constraint this serves: the
	 * actor has no browser, so a screen reachable only by clicking a row in an index cannot
	 * be captured, scripted or diffed — and every layout judgement is deferred to a human.
	 *
	 * Asserted on the SOURCE rather than by running a capture, for the reason this file's
	 * header already gives: driving Playwright here would trade the suite's speed for a
	 * check `npm run harness-shot` gives a developer directly. What is checked is that the
	 * argument is read and turned into the `?entry=` URL the index answers.
	 */
	it('captures a named entry, using the index URL that entry is reachable at', () => {
		const source = readFileSync(SCRIPT, 'utf8');

		// The argument is read from argv rather than hard-coded.
		expect(source).toMatch(/process\.argv/);
		// And becomes the query the index reads (`IndexPage.vue`).
		expect(source).toContain('?entry=');
	});

	/**
	 * The PNG name is derived from a file path, and a legal path must not produce an illegal
	 * filename. Two ways it can, and both are the same criterion-4 failure — an entry the
	 * index opens and the capture cannot write:
	 *
	 * - Two different ids flattening onto one name, so the second capture silently
	 *   overwrites the first. The digest is what refuses that.
	 * - One id flattening onto a name too long for the filesystem — `ENAMETOOLONG` from
	 *   `page.screenshot()`. The cap is what refuses that, and it is safe only BECAUSE the
	 *   digest holds the identity: truncating a part that no longer has to be unique costs
	 *   nothing.
	 *
	 * Asserted on the source at the point this step is written, because `harness-shot.mjs`
	 * runs its capture at module scope and cannot be imported to be called — a real limit,
	 * stated rather than papered over: what these check is that the script still SAYS this,
	 * not that a 300-character id was captured.
	 *
	 * **This stopped being true in fix round 1.** `entryShots` is a PURE function
	 * (`(string) => Shot[]`, no browser, no module-scope side effect), so it was lifted into
	 * its own module (`scripts/entryShots.mjs`) specifically so this claim and the three
	 * beside it could be asserted by calling the function instead of reading its source text
	 * — see `tests/build/entryShots.test.ts`. The source-text pins below are what Task 6
	 * actually shipped and are kept here as the historical record of that step; they are not
	 * what the repository asserts today.
	 */
	it('keeps the PNG name unique and short enough to exist', () => {
		const source = readFileSync(SCRIPT, 'utf8');

		// Identity: a short hash of the REAL id, not of the flattened one.
		expect(source).toContain("createHash('sha1').update(entry)");
		// Length: the human-readable half is capped, since the digest is what makes it unique.
		expect(source).toMatch(/\.slice\(0,\s*60\)/);
	});

	/**
	 * The assertion that stops a green run from lying. Waiting on `.rp-harness-stage` alone
	 * would photograph the placeholder — a successful, empty PNG, which the actor this
	 * feature exists for cannot tell from a real one.
	 */
	it('waits for the entry to have rendered, not merely for the stage to exist', () => {
		const source = readFileSync(SCRIPT, 'utf8');

		// The readiness question is asked in the page: the id is compared as a STRING against
		// `dataset.entry`, never interpolated into a CSS attribute selector, because an id is
		// built from a file path and a `"` is a legal filename character on POSIX.
		expect(source).toContain('stage.dataset.entry === id');
		expect(source).toContain('waitForFunction(entryHasDrawn');
		// The stage must not be empty either — but by NODE, not by element: a template whose
		// root is text renders no element, and an element check would refuse a capture of an
		// entry the index drew correctly.
		expect(source).toContain('stage.childNodes.length > 0');
		expect(source).not.toContain('firstElementChild');
		// The bare stage class must not be used as a wait target on its own, and no attribute
		// selector may be built out of an entry id.
		expect(source).not.toMatch(/selector:\s*['"`]\.rp-harness-stage['"`]/);
		expect(source).not.toMatch(/\[data-entry=/);
	});

	/**
	 * The index app must install everything the production mount does, or a canvas component
	 * renders nothing while every gate stays green — Vue warns rather than throws on an
	 * unresolved component, and the outer element still satisfies the shot selector.
	 */
	it('installs VueKonva on the index app, as the production mount does', () => {
		const page = readFileSync(path.join(REPO, 'tests', 'harness', 'page.ts'), 'utf8');
		const production = readFileSync(
			path.join(REPO, 'src', 'presentation', 'views', 'PlanEditorView.ts'),
			'utf8',
		);

		// Read from production rather than hard-coded: if the plugin ever installs something
		// else, this asks the question again instead of pinning today's answer.
		expect(production).toContain('app.use(VueKonva)');
		expect(page).toContain('.use(VueKonva)');
	});

	/**
	 * The production mount does THREE things — Pinia, VueKonva and `provide(PLAN_EDITOR_CONTEXT)`.
	 * The third has no `use()` to make it visible in a diff, which is why it was the one
	 * missed, and why it gets its own assertion rather than being folded into the one above.
	 */
	it('provides PLAN_EDITOR_CONTEXT on the index app, as the production mount does', () => {
		const page = readFileSync(path.join(REPO, 'tests', 'harness', 'page.ts'), 'utf8');
		const production = readFileSync(
			path.join(REPO, 'src', 'presentation', 'views', 'PlanEditorView.ts'),
			'utf8',
		);

		expect(production).toContain('app.provide(PLAN_EDITOR_CONTEXT');
		expect(page).toContain('provide(PLAN_EDITOR_CONTEXT');
	});

	/**
	 * The index branch runs BEFORE any mount, so Obsidian's DOM prototype extensions do not
	 * exist until it installs them itself — and it MUST, because `drawSchemeToggle()` runs on
	 * every branch and calls `document.body.createEl`.
	 *
	 * The assertion is ORDER, not spelling: the shim call has to come before the first use of
	 * an extension. Asserting "no extension calls here" was the earlier version and it was
	 * wrong twice over — it forbade the working implementation, and it would have passed a
	 * branch that used standard DOM and then let `drawSchemeToggle()` throw anyway.
	 *
	 * `tests/harness/theme.ts:44-47` carries the same rule for `applyPlatform` and names why
	 * no runtime test catches it: every jsdom file installs the extensions at module top, so
	 * the shimmed spelling passes the suite and throws on the real page.
	 */
	it('installs the Obsidian DOM shim before the index branch uses any extension', () => {
		const page = readFileSync(path.join(REPO, 'tests', 'harness', 'page.ts'), 'utf8');
		const branch = page.slice(page.indexOf('if (wantsIndex)'), page.indexOf('} else {'));

		const install = branch.indexOf('installObsidianDom()');
		const firstUse = branch.search(/\.empty\(\)|\.createDiv\(|\.createEl\(/);

		expect(install, 'the index branch never installs the shim').toBeGreaterThanOrEqual(0);
		// Written to avoid a CONDITIONAL expect (oxlint's `vitest/no-conditional-expect`, which
		// `npm run check` fails on with zero tolerance): the literal
		// `if (firstUse >= 0) expect(install).toBeLessThan(firstUse);` shown in an earlier
		// version of this block is refused by that rule, and `linterOptions.noInlineConfig`
		// rules out a suppression. Same claim either way — if no extension use is found in the
		// branch, the ordering holds vacuously. Found executing Task 6, 2026-08-25.
		const shimInstallsFirst = firstUse < 0 || install < firstUse;

		expect(shimInstallsFirst, 'the shim installs before the first Obsidian DOM extension use').toBe(true);
	});

	/**
	 * Readiness must mean the WHOLE subtree, not the outer module.
	 *
	 * Every component is registered as a `defineAsyncComponent`, so a prototype composing
	 * `<StatusBar />` starts loading it only after the outer module renders. Marking the stage
	 * ready when the outer loader resolves satisfies this file's own `> *` selector while every
	 * nested component is still a placeholder — a half-drawn screen captured and exited 0 on,
	 * which is the same defect as the "Pick an entry." capture, one level in.
	 *
	 * Asserted on the source for the reason this file's header gives, and the assertion is the
	 * NEGATIVE one, because that is where the defect was: `open()` may clear `renderedId` and
	 * must never set it to an id. `<Suspense>` is what sets it, on `@resolve`.
	 */
	it('marks the stage ready from Suspense, never from the entry loader', () => {
		const index = readFileSync(path.join(REPO, 'tests', 'harness', 'IndexPage.vue'), 'utf8');
		// The function body ONLY. Sliced to its own closing brace rather than to the next
		// declaration, so that moving a neighbour cannot quietly widen what this reads.
		const start = index.indexOf('async function open');
		const open = index.slice(start, index.indexOf('\n}', start) + 2);

		// Every assignment's RIGHT-HAND SIDE, collected and then required to be `null` — rather
		// than a negative lookahead, which is how the first version of this was WRONG.
		//
		// It read `expect(open).not.toMatch(/renderedId\.value\s*=\s*(?!null)/)`, and that regex
		// MATCHES `renderedId.value = null`: the engine backtracks `\s*` to zero width, the
		// lookahead then sees `" nul"` rather than `"null"`, and succeeds. With `.not.toMatch`
		// around it, the case therefore went RED against a correct file — Task 6 failed on
		// arrival rather than letting a defect through, which is the less dangerous direction and
		// still made the task unrunnable.
		//
		// Measured, both ways, against the committed file: the repaired form passes on the file as
		// it stands, goes red when an `renderedId.value = entry.id` is injected into `open()`, and
		// goes red when the clear is deleted entirely. Enumerating what is assigned has no
		// backtracking trap and names the offending right-hand side when it fails.
		const assigned = [...open.matchAll(/renderedId\.value\s*=\s*([^;\n]+)/g)].map((m) => m[1].trim());

		expect(assigned, 'open() never runs').not.toHaveLength(0);
		expect([...new Set(assigned)], 'open() marks the stage ready before nested components load').toEqual([
			'null',
		]);
		expect(index).toContain('<Suspense');
		expect(index).toContain('@resolve="settle()"');
	});

	/**
	 * A tag that resolves to nothing, and a required prop nobody passed, are Vue's most
	 * invisible failures: a warning, a wrong element in the DOM, and a `<Suspense>` that
	 * resolves perfectly happily. `harness-shot` records console ERRORS and page errors, so
	 * without this the capture succeeds with a hole in it. Both are reachable from the plan's
	 * own tree — two entries of one kind sharing a label, and `EmptyLayer.vue`'s three required
	 * props against a bare `<component :is>`.
	 */
	it('turns an unresolved tag or a missing required prop into a named entry failure', () => {
		const index = readFileSync(path.join(REPO, 'tests', 'harness', 'IndexPage.vue'), 'utf8');

		expect(index).toContain('config.warnHandler');
		// The message ITSELF, with no fragment match in front of it. Pinning the two warning
		// strings is what this assertion used to do, and it was wrong twice over: it went stale
		// the moment the classification was inverted, and while it stood it described the
		// allowlist that let `Invalid prop: type check failed` through. What must be true is
		// that nothing filters — see `renderDefects` in `IndexPage.vue`.
		expect(index).toContain('renderDefects.push(message)');
		// Behaviour, not text, is held by `tests/harness/indexPage.test.ts`, which drives a real
		// missing prop, a real wrong prop and a real unresolved tag through the mounted page.
		// This case exists for the one thing that file cannot say: that the collection is
		// unconditional at the point it is written.
	});

	/**
	 * Two clicks in quick succession leave two `open()` awaits in flight. Without a generation
	 * guard the LAST import to settle wins regardless of which entry the designer chose, so the
	 * stage can draw A while `data-entry` says B — a capture of the wrong component, reported
	 * as a success under the requested name, which is worse than an empty one.
	 */
	it('ignores a stale entry load', () => {
		const index = readFileSync(path.join(REPO, 'tests', 'harness', 'IndexPage.vue'), 'utf8');
		const start = index.indexOf('async function open');
		const open = index.slice(start, index.indexOf('\n}', start) + 2);

		expect(open).toContain('const mine = ++generation');
		// Both arms: a stale RESOLVE must not draw, and a stale REJECT must not overwrite a
		// good entry's screen with the abandoned one's error.
		expect(open.match(/if \(mine !== generation\.value\) return;/g) ?? []).toHaveLength(2);
	});

	/**
	 * The other half of the same race, and it is NOT covered by the generation guards: those
	 * protect `entry.component()`'s await, while `<Suspense>` settles on its own schedule. Entry
	 * A can be on screen with a descendant still pending when a click moves `pendingId` to B;
	 * A's descendant then resolves and, without this, the stage advertises `data-entry="B"` over
	 * A's content — a capture of the wrong component under the requested name.
	 */
	it('unmounts the previous entry before awaiting, and settles only for what is mounted', () => {
		const index = readFileSync(path.join(REPO, 'tests', 'harness', 'IndexPage.vue'), 'utf8');
		const start = index.indexOf('async function open');
		const open = index.slice(start, index.indexOf('\n}', start) + 2);

		// The clear happens BEFORE the await, or the stale subtree stays mounted through it.
		expect(open.indexOf('openComponent.value = null')).toBeGreaterThanOrEqual(0);
		expect(open.indexOf('openComponent.value = null')).toBeLessThan(open.indexOf('await entry.component()'));

		const settleStart = index.indexOf('function settle');
		const settle = index.slice(settleStart, index.indexOf('\n}', settleStart) + 2);

		expect(settle).toContain('mountedGeneration !== generation.value');
	});

	/**
	 * The index's own links have to survive a round trip through the URL, because that is the
	 * path an agent uses: it never clicks, it opens `?entry=` directly. `&` and `#` are legal
	 * in a filename and an id carries the path, so an interpolated link means something other
	 * than the id it names — and the in-page click masks it by passing the object instead.
	 *
	 * **Updated in fix round 6 (Finding F), and the string this pins changed shape.** `hrefFor`
	 * used to build a link from the id ALONE (`new URLSearchParams({ entry: entry.id })`),
	 * which dropped `?theme`/`?phone` — real harness knobs `theme.ts` reads — off every link
	 * and off the address bar `open()` now writes with it (Finding B's `history.replaceState`,
	 * same round). It now clones the CURRENT `window.location.search`, deletes the `index`
	 * routing key and sets `entry`, so a designer's variant survives a click same as an id
	 * with `&`/`#` in it always did. The two assertions below moved with it: the positive pins
	 * the new construction (`URLSearchParams(window.location.search)` plus `.set('entry', …)`)
	 * rather than the old literal object-argument spelling, and the negative is unchanged —
	 * a raw `` `?entry=${ `` interpolation is still the one thing refused either way.
	 */
	it('builds index links with URLSearchParams rather than interpolating the id', () => {
		const index = readFileSync(path.join(REPO, 'tests', 'harness', 'IndexPage.vue'), 'utf8');
		// `hrefFor`'s BODY, sliced the way the case above slices `open()`. Reading the whole file
		// is what the first version did, and it could not work: the comment on `hrefFor` explains
		// the defect by SPELLING the forbidden interpolation, so the negative matched the
		// explanation and the guard was red against correct code. A comment naming a forbidden
		// spelling is not the forbidden spelling.
		//
		// The narrower claim is stated rather than hidden: this covers the one function that
		// builds the link. A second link built elsewhere by interpolation is not seen here.
		const start = index.indexOf('function hrefFor');
		const hrefFor = index.slice(start, index.indexOf('\n}', start) + 2);

		expect(hrefFor).toContain('new URLSearchParams(window.location.search)');
		expect(hrefFor).toContain("params.set('entry', entry.id)");
		expect(hrefFor, 'a raw ?entry= interpolation is back').not.toContain('`?entry=${');
	});

	/**
	 * Ids carry `:` and `/`; Windows filenames cannot. One of the four `npm run check` legs is
	 * Windows, so an unsanitised PNG name is a leg-specific failure nobody would reproduce
	 * locally on Linux or macOS.
	 */
	it('sanitises the entry id for the PNG filename without sanitising the URL', () => {
		const source = readFileSync(SCRIPT, 'utf8');

		expect(source).toMatch(/replace\(\/\[\^a-zA-Z0-9\]\+\/g/);
		expect(source).toContain('encodeURIComponent(entry)');
		// Sanitising alone collapses `a-b/C` and `a/b-C` onto one filename, so the hash is
		// what actually keeps two captures from overwriting each other.
		expect(source).toContain('createHash');
	});

	it('still defines the five fixed shots, so an argumentless run is unchanged', () => {
		const source = readFileSync(SCRIPT, 'utf8');

		for (const name of ['dark', 'light', 'phone', 'plan-editor-dark', 'plan-editor-light']) {
			expect(source).toContain(`name: '${name}'`);
		}
	});

	/**
	 * The fixed shots address the project surface with NO `view` parameter, so
	 * `tests/harness/page.ts` must keep routing a bare URL there. Asserted from this side
	 * because the previous test passes whether or not those URLs still reach anything — a
	 * shot list that exists and times out is the failure it cannot see.
	 */
	it('keeps the three project-view shots on URLs that do not request the index', () => {
		const source = readFileSync(SCRIPT, 'utf8');

		for (const query of ["query: ''", "query: '?theme=light'", "query: '?phone'"]) {
			expect(source).toContain(query);
		}

		const page = readFileSync(path.join(REPO, 'tests', 'harness', 'page.ts'), 'utf8');

		// The index is opt-in. If this ever becomes `!params.has('view')`, all three fixed
		// shots start timing out with nothing else to report it.
		expect(page).toContain("params.has('index')");
	});
```

- [ ] **Step 2: Run it and watch the first case fail**

Run: `npx vitest run tests/build/harness-shot.test.ts`

Expected: FAIL on `captures a named entry` — neither `process.argv` nor `?entry=` appears in the script. The second case PASSES already, which is its job: it pins the existing behaviour so Step 3 cannot quietly replace it.

- [ ] **Step 3: Add the entry shots, waiting on the ENTRY rather than the shell**

In `scripts/harness-shot.mjs`, add `createHash` to the imports at the top:

```javascript
import { createHash } from 'node:crypto';
```

Then, after the `SHOTS` array (line ~47), add:

```javascript
/**
 * What "the entry has drawn" means — and it is NOT `.rp-harness-stage`.
 *
 * The stage element is mounted synchronously on the first paint, while the selected SFC is
 * still being imported. A capture waiting on the stage alone photographs "Pick an entry." and
 * exits 0: a successful, empty PNG. That is the worst thing this script can produce, because
 * the actor it exists for cannot see that the picture is blank — it would read a green exit
 * as "the mock looks like that".
 *
 * `IndexPage.vue` sets `data-entry` from `<Suspense>`'s `@resolve`, so it means the entry AND
 * every async component below it has settled — not merely that the outer module loaded, which
 * would still be a placeholder wherever a mock composes a real component. The node check waits
 * out the render tick after that and is belt and braces rather than the primary signal.
 *
 * Asked IN THE PAGE rather than as a CSS selector, deliberately. An id is built from a file
 * path, and a quote or a newline is a legal filename character on POSIX; interpolating one
 * into an attribute-value selector produces one that parses as something else or does not
 * parse at all, so the index could open an entry `harness-shot` could never capture.
 * Comparing `dataset.entry` as a STRING has no escaping question to get wrong — the class of
 * defect is removed rather than patched.
 *
 * `childNodes`, deliberately not the DOM's element-only equivalent. A template whose root is
 * TEXT — `<template>Coming soon</template>`, which is a perfectly good early mock — mounts a
 * text node and no element, so a check that required an ELEMENT child would time out on an
 * entry the index drew correctly and refuse a capture the guarantee promises. The marker is
 * what proves the screen settled; this is only the cheap sanity check that the stage is not
 * literally empty, and it must not be narrower than what a valid entry can render.
 *
 * (Reworded away from naming the forbidden DOM property directly: the earlier phrasing put
 * that literal substring inside this very comment, and the sibling test two blocks up checks
 * the WHOLE script source for it — so the plan's own prescribed code failed its own
 * prescribed test. Found executing Task 6, 2026-08-25; the quoted CSS attribute-selector
 * example a few lines up had the same shape and was reworded the same way — see the paragraph
 * on interpolating an id into an attribute-value selector, just above.)
 */
const entryHasDrawn = (id) => {
	const stage = document.querySelector('.rp-harness-stage');

	return stage instanceof HTMLElement && stage.dataset.entry === id && stage.childNodes.length > 0;
};

/**
 * The shots for ONE named entry, in both schemes.
 *
 * This is what makes the harness usable by an actor with no eyes: `docs/actors/Coding agent.md`
 * describes an agent that verifies by running something that writes a file it can then read,
 * or does not verify at all. Without an argument here, every layout judgement about a mock is
 * deferred to a human and every iteration costs a round.
 *
 * No `?phone` shot: the fixed set has one for the project view because that surface is
 * responsive by design, and a prototype's own breakpoints are the prototype's business — add
 * `&phone` to the URL by hand when that is the question.
 */
const entryShots = (entry) => {
	// The id is a URL and may contain `:` and `/` — both legal in a query value, both ILLEGAL
	// in a Windows filename, and Windows is one of the four legs `npm run check` rides.
	//
	// Sanitising ALONE is not enough, and the plan's own id test names the case: `a-b/C` and
	// `a/b-C` are different entries that collapse to one string the moment `/` and `:` become
	// `-`. Two captures would then write the same two PNGs, the second silently overwriting
	// the first — the same collision `entries.ts` refuses, moved from the URL to the file
	// system. So the readable part is sanitised for humans and a short hash of the REAL id
	// keeps it unique.
	//
	// The readable part is also CAPPED, and the cap is safe precisely because identity lives
	// in the digest rather than in it: a deep path or a long basename is legal on every
	// platform this runs on, and flattening the whole id into a filename is how a legal
	// source path becomes an `ENAMETOOLONG` from `page.screenshot()` — an entry the index
	// opens and the capture cannot write, which is the same criterion-4 failure as the
	// collision above wearing different clothes. 60 leaves room for the `entry-`, the
	// digest, the scheme and `.png` well inside the 255-byte per-component limit, and inside
	// Windows' 260-character whole-path limit once `harness-shots/` is in front of it —
	// Windows being one of the four legs, and the stricter of the two constraints.
	const readable = entry.replace(/[^a-zA-Z0-9]+/g, '-').slice(0, 60);
	const digest = createHash('sha1').update(entry).digest('hex').slice(0, 8);
	const fileSafe = `${readable}-${digest}`;

	// `entry` rather than `selector`: `captureOne` waits on `entryHasDrawn` when it is present.
	return [
		{ name: `entry-${fileSafe}-dark`, query: `?entry=${encodeURIComponent(entry)}`, entry },
		{
			name: `entry-${fileSafe}-light`,
			query: `?entry=${encodeURIComponent(entry)}&theme=light`,
			entry,
		},
	];
};
```

And teach `captureOne` the second way of waiting. Change its signature and its wait, and nothing
else in the function:

```javascript
async function captureOne(browser, baseUrl, { name, query, selector, entry }, errors) {
```

```javascript
		// The fixed shots name a selector; a named entry names itself, and is compared as a
		// string in the page because a CSS attribute selector built from a file path is a
		// quoting bug waiting for the first filename with a `"` in it.
		if (entry === undefined) await page.waitForSelector(selector, { state: 'attached' });
		else await page.waitForFunction(entryHasDrawn, entry);
```

- [ ] **Step 4: Read the argument in `run()`, and fail loudly on a name that draws nothing**

In `scripts/harness-shot.mjs`, change `captureAll` to take the shot list:

```javascript
async function captureAll(browser, baseUrl, shots) {
	const errors = [];

	for (const shot of shots) await captureOne(browser, baseUrl, shot, errors);
	return errors;
}
```

In `run()`, immediately after `const executablePath = resolveChromiumExecutable();`:

```javascript
	// `node scripts/harness-shot.mjs ZoneSummary` — one entry, both schemes. With no
	// argument, the five fixed surfaces, exactly as before.
	const entry = process.argv[2];
	const shots = entry ? entryShots(entry) : SHOTS;
```

Then change the `captureAll(browser, baseUrl)` call inside `run()` to `captureAll(browser, baseUrl, shots)`.

Nothing further is needed for the unknown-name case, and it is worth knowing why rather than
assuming it: `IndexPage.vue` never sets `data-entry` for a name it cannot find, so
`waitForSelector` times out, `captureOne` pushes that onto `errors`, and `reportErrors` sets a
non-zero exit code. A typo fails; it does not quietly produce a picture of the index.

- [ ] **Step 5: Run the test again**

Run: `npx vitest run tests/build/harness-shot.test.ts`

Expected: PASS, all cases.

- [ ] **Step 6: Run the full gate**

Run: `npm run check`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add scripts/harness-shot.mjs tests/build/harness-shot.test.ts
git commit -m "harness-shot takes an entry name

The coding agent's eye. That actor has no browser, so a screen reachable
only by clicking a row cannot be captured, scripted or diffed, and every
layout judgement gets deferred to a human.

An argumentless run is unchanged and a test pins that, so the five fixed
shots cannot be quietly replaced by the new path."
```

---

### Task 7: A first prototype, and the promotion claim

The criterion the whole note is for: a promoted mock's template must be byte-identical to the mock's. If that cannot hold, the rewrite this replaces has only moved.

**Files:**
- Create: `src/prototypes/ZoneSummary.vue`
- Modify: `eslint.config.mjs` (a `src/prototypes/**/*.vue` block narrowing `vue/no-restricted-block`)
- Test: `tests/build/prototype-promotion.test.ts`
- Test (modify): `tests/harness/entries.test.ts` — Task 4 left the real glob undriven

**Interfaces:**
- Consumes: `src/prototypes/` from Task 1, the index from Task 4.
- Produces: the first real entry in the prototypes tree.

- [ ] **Step 1: Write the first mock**

Create `src/prototypes/ZoneSummary.vue`:

**The commentary goes ABOVE the `<template>` block, not inside it.** Anything inside is compared
byte-for-byte against the promoted file by `tests/build/prototype-promotion.test.ts`, so a
comment in one and not the other fails the test that matters — and duplicating it into the
promoted file would mean carrying a note about mocks into shipped code. Outside the block, the
rule explains itself: what is in `<template>` is what crosses unchanged.

```vue
<!--
	A template-only SFC: pure HTML to write, and already a real Vue component. Promotion adds a
	`<script setup>` above the template and moves the file into `src/presentation/`; the markup
	goes across unchanged, which is what `tests/build/prototype-promotion.test.ts` holds.

	This comment is OUTSIDE the template on purpose, and it deliberately does not spell the
	opening template tag anywhere. `templateBlock()` finds the block with a regex, so a comment
	naming that tag would make the test extract from HERE — the block it compares would start
	mid-comment and the two files could never match. Anything inside the block would also have
	to be copied into the promoted component, carrying a note about mocks into shipped code.

	Nothing marks this file as a prototype, deliberately.
	`tests/build/prototypes-not-bundled.test.ts` asks the build which modules composed the
	chunk, so a mock nobody remembered to mark is caught anyway — the only version of that
	guarantee worth having.
-->
<template>
	<section class="rp-zone-summary">
		<h2>Zones</h2>
		<ul>
			<li>
				<span class="rp-zone-summary__name">Kitchen</span>
				<span class="rp-zone-summary__area">12.60 m²</span>
			</li>
			<li>
				<span class="rp-zone-summary__name">Bathroom</span>
				<span class="rp-zone-summary__area">4.20 m²</span>
			</li>
		</ul>
	</section>
</template>
```

- [ ] **Step 2: Look at it**

Run: `npm run harness`

Expected: `ZoneSummary` appears in the index under prototypes. Open it; it draws, unstyled beyond what the plugin's own sheet gives it.

- [ ] **Step 3: Capture it, the way an agent would**

Run: `npm run harness-shot prototype:ZoneSummary`

Note the argument is the **id**, not the basename — ids are qualified by kind so a mock and the
component it stands in for are both reachable (`entries.ts`). The index shows the label; the URL
and this command take the id.

Expected: two PNGs under `harness-shots/`, named `entry-prototype-ZoneSummary-<hash>-dark.png`
and `-light.png`. The colon becomes a dash because Windows forbids it in a filename, and the
short hash of the real id is what stops two different entries sanitising onto one name. The
command exits 0. Open one — it must show the zone list, not "Pick an entry."

Then prove the failure path, which is the half that matters for an actor that cannot see:

Run: `npm run harness-shot NoSuchEntry`

Expected: non-zero exit, reporting `no entry named NoSuchEntry` for both shots — not a bare
`Timeout 30000ms exceeded`. `IndexPage.vue` sets `.rp-harness-failure` synchronously the moment
an `?entry=` names nothing, and `captureOne` reads that text in its catch block rather than
reporting only the timeout that follows it (fix round 1, Minor 3). A typo must never write a
picture of the index and call it success.

- [ ] **Step 4: Write the promoted fixture — an INDEPENDENT artifact**

The claim is that a real promotion leaves the template unchanged. A test that builds the
"promoted" file by interpolating the mock's own template cannot fail, whatever a real promotion
later does — it compares a string to itself. So the promoted side has to be written separately,
by hand, the way somebody actually promoting this component would write it.

Create `tests/fixtures/promotion/ZoneSummary.promoted.vue` — what `ZoneSummary` looks like after
promotion, with a script block added and **the template copied across untouched**.

Its explanatory comment lives in the `<script setup>` block, and the mock's sits above the
template. Neither is inside the compared block, which is what lets the two templates be
byte-identical while each file still explains itself.

Neither comment spells the opening template tag, either: `templateBlock()` locates the block by
regex, so a comment naming that tag would make the extraction start mid-comment. That is not
hypothetical — writing this plan hit it.

```vue
<script setup lang="ts">
/**
 * The promoted form of `src/prototypes/ZoneSummary.vue`, kept as a FIXTURE rather than as a
 * component: `tests/build/prototype-promotion.test.ts` diffs its template against the mock's,
 * and that diff is the whole claim the prototypes tree rests on.
 *
 * Written by hand, not generated from the mock. A generated copy would agree with the mock by
 * construction and prove nothing — which is exactly what the first version of that test did.
 */
import { computed } from 'vue';

const zones = computed(() => [
	{ name: 'Kitchen', area: '12.60 m²' },
	{ name: 'Bathroom', area: '4.20 m²' },
]);
</script>

<template>
	<section class="rp-zone-summary">
		<h2>Zones</h2>
		<ul>
			<li>
				<span class="rp-zone-summary__name">Kitchen</span>
				<span class="rp-zone-summary__area">12.60 m²</span>
			</li>
			<li>
				<span class="rp-zone-summary__name">Bathroom</span>
				<span class="rp-zone-summary__area">4.20 m²</span>
			</li>
		</ul>
	</section>
</template>
```

Note the promoted template still has the values hard-coded even though a `zones` computed now
exists. That is deliberate and it is the point of the fixture: **promotion moves the markup
across unchanged**, and wiring the data up is a separate, later edit. A fixture that had already
rewritten the template to `v-for` would be recording a rewrite as if it were a promotion.

**A binding the template does not read does not fail this repository's lint, and that was
measured rather than assumed** — the question is obvious enough that it will be asked again.
`npm run lint` is `oxlint --deny-warnings && eslint . --max-warnings 0`: oxlint exits 0 on this
file, and `eslint .` does not lint it at all, because a `.vue` under `tests/` matches no block
in `eslint.config.mjs` (`VUE_FILES` is `['**/src/**/*.vue']`). The same content under `src/`
DOES fail, on `no-unused-vars` for `zones`. So the script block stays exactly as written; do not
trim it to satisfy a rule that does not run here. That `.vue` files under `tests/` are linted by
neither linter is a real gap in this repository and it is not this plan's to close — Task 5's
module-graph scan covers the one consequence that touches this feature.

**If `npm run analyze` reports this fixture as a dead file, declare it rather than deleting or
importing it.** `tests/build/prototype-promotion.test.ts` reads it with `readFileSync`, so no
import graph can reach it — the same shape as the entries already declared in `.fallowrc.json`,
and the same remedy: name the file, with the reason written down beside the others. Naming it
rather than globbing `tests/fixtures/**`, for the reason that file already gives about the
concept stylesheets: a glob absorbs the next file and tells nobody.

- [ ] **Step 5: Make template-only a RULE, not a property of one file**

The case above reads `ZoneSummary.vue` by name. The second mock somebody writes could carry a
`<script setup>` and that test would still pass — so the tree's defining invariant would hold
for the one file that was thought of, which is the shape `CLAUDE.md` refuses: *a category
invariant is checked at the forbidden thing, not by listing the places.*

It is a real invariant rather than a preference. A prototype's promotion is "add a script block",
so a mock that already has one has been promoted in place, and criterion 10's byte-identical
claim has nothing left to compare. Nothing refuses it today: `vue/no-restricted-block` is
configured `['error', 'style']`, which permits every script form.

Add a block to `eslint.config.mjs`, immediately after the `VUE_FILES` block it narrows:

```javascript
	{
		/**
		 * `src/prototypes/` is TEMPLATE-ONLY, and this is where that stops being prose.
		 * Promotion is "add a `<script setup>`", so a mock that already has one has been
		 * promoted in place and there is nothing left for the byte-identical template claim
		 * to compare. A mock needs no script either: the index registers every discovered
		 * component and mock on the app, so a template resolves its tags without importing
		 * them.
		 *
		 * `'style'` is REPEATED rather than inherited. Two flat-config blocks matching one
		 * file override `vue/no-restricted-block`'s options rather than merging them, so a
		 * block naming only `'script'` would silently permit the `<style>` block the wider
		 * VUE_FILES block refuses — the same trap this config already documents for
		 * `no-restricted-syntax`.
		 *
		 * `'script'` covers `<script setup>` as well as a plain `<script>`: the rule matches
		 * the block name, and `setup` is an attribute on it. Measured, both forms.
		 */
		files: ['**/src/prototypes/**/*.vue'],
		rules: { 'vue/no-restricted-block': ['error', 'style', 'script'] },
	},
```

Watch it work before trusting it. Temporarily give `src/prototypes/ZoneSummary.vue` a
`<script setup lang="ts"></script>` block and run `npx eslint src/prototypes/ZoneSummary.vue`:
expected FAIL, `vue/no-restricted-block`, "Using `<script>` is not allowed." Then revert the
block and confirm the file lints clean — a template-only SFC reports nothing, which is the half
that has to keep working.

- [ ] **Step 6: Write the failing test**

Create `tests/build/prototype-promotion.test.ts`:

```typescript
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO } from '../helpers/oxlint';

/**
 * THE criterion the whole feature is for. Promotion must add a `<script setup>` and move the
 * file — never redraw the markup. If a template cannot cross that boundary unchanged, the
 * rewrite this replaces has only moved somewhere else.
 *
 * The two sides are INDEPENDENT files. An earlier version composed the promoted side by
 * interpolating the mock's own template, which made the comparison a string against itself:
 * it could not fail, and would have stayed green while a real promotion redrew everything.
 *
 * A consequence worth stating, because the first independent pair failed on it: **nothing
 * explanatory may live inside a `<template>` block in this tree.** The comparison is
 * byte-for-byte, so a comment in the mock and not in the promoted file fails the test — and
 * copying it across would carry a note about mocks into shipped code. Commentary goes above
 * the template in a mock and in the script block of a promoted component.
 *
 * And no comment may SPELL the opening template tag: this function finds the block by regex,
 * so a comment naming it makes the extraction start mid-comment and the two files can never
 * match. Writing the plan this came from hit exactly that.
 */
const MOCK = path.join(REPO, 'src', 'prototypes', 'ZoneSummary.vue');
const PROMOTED = path.join(REPO, 'tests', 'fixtures', 'promotion', 'ZoneSummary.promoted.vue');

/** The `<template>` block, with its delimiters, or null when there is none. */
function templateBlock(sfc: string): string | null {
	const match = sfc.match(/<template>[\s\S]*<\/template>/);

	return match ? match[0] : null;
}

describe('promoting a mock', () => {
	it('leaves the template byte-identical', () => {
		const mock = templateBlock(readFileSync(MOCK, 'utf8'));
		const promoted = templateBlock(readFileSync(PROMOTED, 'utf8'));

		expect(mock, 'the mock has no <template> block').not.toBeNull();
		expect(promoted, 'the promoted fixture has no <template> block').not.toBeNull();
		expect(promoted).toBe(mock);
	});

	it('is template-only before promotion', () => {
		expect(readFileSync(MOCK, 'utf8')).not.toContain('<script');
	});

	it('gains a script block on promotion, which is what promotion IS', () => {
		expect(readFileSync(PROMOTED, 'utf8')).toContain('<script setup lang="ts">');
	});
});
```

- [ ] **Step 7: Run it**

Run: `npx vitest run tests/build/prototype-promotion.test.ts`

Expected: PASS, three tests.

If `leaves the template byte-identical` fails, the two templates differ — most likely by
indentation or a trailing newline. **Do not "fix" it by generating one from the other.** Read the
diff and make the promoted fixture match the mock exactly, because that is what the criterion
claims a promotion does.

- [ ] **Step 8: Prove it can fail, on the thing it is actually guarding**

Temporarily edit the promoted fixture's template — change `<h2>Zones</h2>` to `<h2>Rooms</h2>`,
which is exactly the kind of small redraw a real promotion might slip in.

Run: `npx vitest run tests/build/prototype-promotion.test.ts`

Expected: FAIL on `leaves the template byte-identical`.

This is the assertion the whole tree exists to protect, so it is the one that must be watched
failing. Then revert: `git checkout tests/fixtures/promotion/ZoneSummary.promoted.vue`

- [ ] **Step 9: Prove the tree IS the registration, against the REAL glob**

Everything in `tests/harness/entries.test.ts` so far hands `discoverEntries` a hand-built map,
which tests the id derivation and nothing else. The criterion is about `import.meta.glob`'s
pattern: if it stops matching the tree, discovery returns nothing, no prototype a designer adds
ever appears in the index, and every one of those tests stays green. There is a file on disk now,
so the case can finally be written.

Append to `tests/harness/entries.test.ts` — and add `prototypeEntries` to the import from
`./entries`, plus the two node imports and `REPO`:

```typescript
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { REPO } from '../helpers/oxlint';
```

```typescript
/** Every `.vue` under a directory, walked rather than globbed — the independent side. */
function vueFilesUnder(directory: string, prefix = ''): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const relative = prefix ? `${prefix}/${entry.name}` : entry.name;

		if (entry.isDirectory()) return vueFilesUnder(path.join(directory, entry.name), relative);

		return entry.name.endsWith('.vue') ? [relative] : [];
	});
}

/**
 * Criterion 1, and the only case in this file that drives the real `import.meta.glob`.
 *
 * The test does NOT write the `.vue` file itself, and could not: `import.meta.glob` is resolved
 * when Vite transforms this module, so a file created at run time is invisible to it and the
 * assertion would fail for a reason that says nothing about registration. The file added by
 * Step 1 is the one being added; what is asserted is that adding it to the TREE was the whole
 * of adding it — nothing names it anywhere else.
 *
 * The id is mapped back to a path rather than the path forward to an id, deliberately: an
 * expected id built by the test's own copy of `idFor` would be a second derivation agreeing
 * with itself. The inverse is also the reversibility `idFor` claims when it keeps the path
 * separator, so a flattened id would fail here.
 */
describe('the prototypes tree IS the registration', () => {
	it('discovers every .vue on disk, with nothing registering them', () => {
		const onDisk = vueFilesUnder(path.join(REPO, 'src', 'prototypes')).toSorted();

		// First, because an empty tree would make the equality below `[] === []` — vacuous, and
		// exactly the "only passes while empty" failure the PBI's criterion 9 names.
		expect(onDisk).toContain('ZoneSummary.vue');

		// `toSorted`, not `sort`: `unicorn/no-array-sort` is on for `tests/` under
		// `--deny-warnings`, which is what forced the same change in `entries.ts`.
		const discovered = prototypeEntries()
			.map((entry) => `${entry.id.replace(/^prototype:/, '')}.vue`)
			.toSorted();

		expect(discovered).toEqual(onDisk);
	});
});
```

Run: `npx vitest run tests/harness/entries.test.ts`

Expected: PASS, and the new case must be watched failing before it is trusted. Break the glob —
change `'../../src/prototypes/**/*.vue'` in `tests/harness/entries.ts` to
`'../../src/prototypes/*.vue.disabled'` — and run it again.

Expected: FAIL on `discovers every .vue on disk`, reporting `[]` against `['ZoneSummary.vue']`.
That is the defect the hand-built maps could not see. Then revert:
`git checkout tests/harness/entries.ts`

- [ ] **Step 10: Run the full gate**

Run: `npm run check`

Expected: PASS. In particular `analyze` must not report `ZoneSummary.vue` dead — Task 1's fallow entry is what covers it, and this is the first file that proves the glob matches.

- [ ] **Step 11: Commit**

```bash
git add src/prototypes/ZoneSummary.vue eslint.config.mjs tests/fixtures/promotion/ZoneSummary.promoted.vue tests/build/prototype-promotion.test.ts tests/harness/entries.test.ts
git commit -m "Add the first mock, and hold the promotion claim

A promoted mock's template must be byte-identical to the mock's — the
criterion the whole feature is for, since if a template cannot cross that
boundary unchanged the rewrite this replaces has only moved.

The two sides are INDEPENDENT files. An earlier draft composed the
promoted side by interpolating the mock's own template, which compared a
string to itself: it could not fail, and would have stayed green while a
real promotion redrew everything. The promoted fixture is hand-written,
and watched failing on a one-word template edit before being trusted.

It is also where template-only stops being prose: eslint.config.mjs now
narrows vue/no-restricted-block over src/prototypes/**/*.vue to refuse a
script block as well as a style one, so the invariant holds for the next
mock rather than for the one file a test names. Promotion is "add a
script block", so a mock that already has one has been promoted in place
and the byte-identical claim has nothing left to compare.

This is also the first file proving the fallow glob matches and the
harness-shot entry path writes a PNG — and the first one under
src/prototypes/ at all, which is what finally lets the discovery test
drive the real import.meta.glob instead of a hand-built map. Until now
every discovery case would have stayed green with the glob pattern
matching nothing at all."
```

---

### Task 8: Record it where the next reader looks

A capability nobody knows about is one that gets rebuilt. `CLAUDE.md` is what an agent reads first, and the concepts README needs its boundary stated from its own side.

**Files:**
- Modify: `CLAUDE.md` (the three-commands section)
- Modify: `docs/user-experience/concepts/README.md` (header)
- Modify: `src/prototypes/README.md` and `vitest.config.ts` (the sentences Task 1 deliberately left in the future tense, now that their checks exist)

**Interfaces:**
- Consumes: everything above.
- Produces: nothing.

- [ ] **Step 1: Add the index to `CLAUDE.md`'s harness paragraph**

Find the `npm run harness` bullet in `CLAUDE.md` (it begins "a Vite dev server drawing the real view"). Append to it:

```
  **`?index`** draws an index of every prototype and every real component, discovered from the
  tree with `import.meta.glob` so a saved file needs no registration. `?entry=<id>` opens one
  directly, and `npm run harness-shot <id>` captures it in both schemes. The index is OPT-IN
  and the bare root still draws the project view: the three fixed captures address that surface
  with no query at all, so making the root an index would break them while the test asserting
  they exist kept passing. Mocks live in `src/prototypes/` as template-only SFCs — pure HTML to
  write, already a real component, and promoted by adding a `<script setup>` rather than
  being redrawn. **Nothing in that tree ever reaches a built plugin**, refused twice: a
  per-layer `no-restricted-imports` ban makes it a one-way door, and
  `tests/build/prototypes-not-bundled.test.ts` asserts against `dist/`. Neither is
  sufficient — lint reads static imports, the bundle scan reports after the fact.
```

- [ ] **Step 2: State the boundary from the concepts side**

In `docs/user-experience/concepts/README.md`, insert after the first paragraph ("Drawings of the design…"):

```markdown
**This folder takes no new pages.** New prototyping happens in `src/prototypes/`, against the
plugin's real assembled stylesheet, per
[`Prototype a screen in the harness before it is built`](../../requirements/Prototype%20a%20screen%20in%20the%20harness%20before%20it%20is%20built.md).
The six pages here stay, frozen, as the record of what was proposed and of the six findings
below — several of which no other instrument could have produced. A record that gets rewritten
stops being one, which is why this is a boundary rather than a migration.
```

- [ ] **Step 3: Make `src/prototypes/README.md` present-tense**

Task 1 wrote that README with three sentences deliberately in the FUTURE tense, because the checks
they name — `tests/build/prototypes-not-bundled.test.ts`, `tests/build/prototype-promotion.test.ts`
and the index's glob over `src/prototypes/` — did not exist when it was committed, and a README
asserting a guarantee ahead of its check is the defect this repository's guide names first. The
`vitest.config.ts` coverage-exclusion comment was written the same way.

All three exist now. Flip them, and assert it rather than trusting the flip:

```bash
ls tests/build/prototypes-not-bundled.test.ts tests/build/prototype-promotion.test.ts
grep -rn "import.meta.glob" tests/harness/entries.ts
```

Every one must resolve before you change a word. Task 1's fix report lists the exact sentences it
put in the future tense — read that list rather than re-deriving it, and change those and nothing
else. If a sentence on the list names something the three commands above do NOT find, the sentence
stays in the future tense and this step says so in the commit message: that is a task that did not
land, not a README to be optimistic about.

- [ ] **Step 4: Verify the added link resolves**

Run:

```bash
test -f "docs/requirements/Prototype a screen in the harness before it is built.md" && echo ok
```

Expected: `ok`

- [ ] **Step 5: Run the full gate**

Run: `npm run check`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md docs/user-experience/concepts/README.md src/prototypes/README.md vitest.config.ts
git commit -m "Record the harness index where the next reader looks

CLAUDE.md is what an agent reads first, and a capability nobody knows
about is one that gets rebuilt. The concepts README states the boundary
from its own side: it takes no new pages, and the six existing ones are
a record rather than a migration backlog."
```

---

## Self-Review

**Spec coverage** — each of the PBI's ten acceptance criteria against a task:

| Criterion | Task |
| --- | --- |
| 1 — a file appears with no registration step | 4 (id derivation) + **7 Step 9** (the real glob, against the tree on disk) |
| 2 — no prototype in the built plugin | 2 (`prototypes-not-bundled.test.ts`) |
| 3 — an import from elsewhere fails lint | 1 (`prototypes-one-way-door.test.ts`) |
| 4 — every entry addressable and shootable | 4 (`?entry=`) + 6 (`harness-shot <name>`) |
| 5 — one stylesheet, no second sheet | 5, over two instruments: three SOURCE scans (the page's whole CSS-bearing node set, a `.css` import anywhere the page can reach, an `@import` in any sheet it loads) and one check of the RENDERED DOCUMENT after an entry mounts, which is where every route converges — including `<component is="link">` and any spelling nobody has thought of |
| 6 — a component mounts with no per-entry setup | 3 (`fixture.test.ts`, mounting the REAL `StatusBar` against nothing but the fixture) — for a component that takes no required props; see gap 4 |
| 7 — two components read the same plan | **4**, not 3, and held in its SUBSTANCE rather than its letter — see Task 4 Step 8. Exactly one prop-free component renders a plan-level value (`StatusBar`), so no pair can render the same value; `PlanEditorRoot` reads `status`. The case mounts both against one fixture, asserts two different consequences of it, and asserts that removing the fixture changes both. What it cannot show is stated in the test |
| 8 — an entry that throws names itself; empty tree still lists | 4 (`IndexPage.vue` failure branch — four ways in now: a rejected import, `onErrorCaptured`, an unresolved tag and a missing required prop, the last two via `warnHandler`; plus the empty-tree case) |
| 9 — `npm run check` passes with the tree populated | 7 Step 10 |
| 10 — a promoted template is byte-identical | 7 (`prototype-promotion.test.ts`, plus the lint rule in Step 5 that keeps every mock template-only) |

The PBI's extensions map too: **2a** → Task 4 Step 5's `failure` branch; **4a** → Task 4's empty-tree test and the `v-if` in the template; **4b** → Vite's own overlay, unchanged, plus the try/catch; **3a** → Task 6 leaves an argumentless run intact so a machine without Chromium fails on `resolveChromiumExecutable` as it does today. **6a** is out of scope by the PBI's own text.

**Known gaps, stated rather than hidden:**

1. **Criterion 8's "names itself" is tested by construction, not by a driven failure.** Task 4 writes the branch and Task 7 does not plant a throwing prototype to watch it fire. Add that if a reviewer wants the branch proven — it would be a fourth case in `entries.test.ts` mounting a module whose import rejects.
2. **The fixture assigns store state directly** rather than going through `hydrate`, because hydration takes query services this page cannot answer. If `ProjectStore`'s refs turn out not to be writable from outside, Task 3 Step 4 needs a store action instead, and that is a change to `src/presentation/stores/ProjectStore.ts` this plan does not currently touch.
3. **`<Suspense>` settles the INITIAL subtree.** An async component that only becomes part of the
   tree later — behind a `v-if` a click flips — is not covered by the `@resolve` that marked the
   stage ready. `@pending` clears `renderedId` when a new set of dependencies appears, so the
   marker is at least honest about it, but a capture of a screen that lazily loads on interaction
   would need its own signal. No entry does that today; the sentence is here so the next one is
   not a surprise. It is also the reason `open()` is forbidden from setting `renderedId` rather
   than merely discouraged: the negative is what a test can hold.
4. **A component with REQUIRED PROPS cannot be mounted bare, and the index says so.** The fixture
   answers stores and the editor context; it cannot answer props, and discovery is a glob that
   knows nothing about a component's signature before importing it. `EmptyLayer.vue` is the
   example in the tree — `layerId`, `transform`, `visible`. Such an entry is listed, and opening
   it reports a named failure rather than drawing something malformed. Composing it inside a
   prototype, where a template can pass props, is how a designer looks at one. Giving the index
   its own way to supply props is the obvious extension and is deliberately not in this plan.
5. **`app.config.warnHandler` is a DEVELOPMENT-build API.** It is what turns an unresolved tag or
   a missing required prop into a named failure, and both `npm run harness` and `npm run harness-shot` run Vite's dev
   server, so it is live everywhere it matters today. A production build of the harness page
   would lose it silently and go back to photographing the hole — which is the trigger for
   needing a different signal, not a reason to avoid this one.
6. ~~**Task 1 Step 9 may need reordering.**~~ **Settled by execution: it does not.** `npm run
   analyze` accepts `"src/prototypes/**/*.vue"` in `entry` while it matches nothing — measured on
   a full run at the end of Task 1, with the manual-entry count unchanged at 7, since a glob
   matching nothing contributes no resolved entries. The declaration stays in Task 1 and Task 7
   adds nothing to `.fallowrc.json` for it.

**Placeholder scan:** every code step carries real code; no "TBD", no "handle errors appropriately", no "similar to Task N".

**Type consistency:** `HarnessEntry` (`id`, `label`, `kind`, `component`) is defined in Task 4 and used unchanged in Tasks 4 and 6. `seedFixture(): Pinia` is defined in Task 3 and called in Task 4 Step 6. `discoverEntries(modules, kind)` keeps one signature across its test and its use, and `registrableComponents(entries)` returns `{ byTag, ambiguous, shadowed }` in Task 4's test, its implementation and `page.ts` alike. The `id` is the URL and the `harness-shot` argument (`prototype:ZoneSummary`), sanitised only for PNG filenames since Windows forbids `:` there; `label` is the basename shown in the list and is never used as an address — Task 7 Step 3 uses the id, deliberately.

**Task 2's test passes vacuously on an empty tree**, which is why Task 2 Step 4 plants an *unmarked* prototype and imports it: it proves the test fires on a file nobody remembered to flag, which is the only version of that guarantee worth having.

**Revised across thirty review rounds — seventy-two findings. Seventy were real and are fixed
above rather than noted; two were not, and each is recorded as declined with the measurement that
declined it.**

Round one, on the shape of the harness:

| Finding | What was wrong | Fixed in |
| --- | --- | --- |
| Capture waited on the stage shell | `.rp-harness-stage` exists on first paint, so `harness-shot <name>` could photograph "Pick an entry." and **exit 0** — an empty PNG reported as success, to an actor that cannot see it is empty | Task 4 (`data-entry`) and Task 6 (a `waitForFunction` comparing `dataset.entry`, plus a test forbidding the bare class). Round eight found the same defect one level in; round ten took the CSS selector out of it |
| The argumentless run broke | Routing "no `view` parameter → index" sent the three fixed shots to the index to time out — while the test asserting those shots exist kept passing | Task 4 Step 6 (index is opt-in) and Task 6 (a test pinning it from the other side) |
| Render errors escaped the catch | `try/catch` around a dynamic import cannot see a throw from `setup()` or `render()` | Task 4 (`onErrorCaptured`) |
| The bundle test was opt-in | A marker proves only the marker is absent | Task 2 |
| Ids could collide | A mock named after its component shared a URL with it — the likely case, not the exotic one | Task 4 |

Round two, on whether the tests test anything — the deeper set, and **one root cause: every one of them asserted on a proxy rather than on the thing**:

| Finding | The proxy | What it asserts now |
| --- | --- | --- |
| Lint test read the config | Grepping `eslint.config.mjs` for `'prototypes'` proves the string is present, not that an import is refused — and `tests/build/vue-rules.test.ts` already says why: *"a rule scoped to files it never matches reports nothing and looks correct"* | Drives ESLint through the existing `lintText` helper, across all six layers, plus the open direction |
| Bundle test scanned text — twice, wrongly | A marker is opt-in; a **basename** is worse than useless, since `src/prototypes/StatusBar.vue` beside the real one makes the gate fail on correct work, and minification renames `FIXTURE_PLAN` so a fixture ships green | Asks Rollup which modules composed the chunk. Watched failing on a planted prototype **and** a planted fixture |
| Promotion test was tautological | The "promoted" file was built by interpolating the mock's own template, so it compared a string to itself and could never fail | An independent hand-written fixture, watched failing on a one-word template edit |
| Ids still collided | Flattening `/` to `-` is not reversible: `a-b/C` and `a/b-C` become one id | Separator preserved (`component:editor/shell/StatusBar`), plus an explicit duplicate check that throws |
| — (found while fixing the above) | Ids contain `:` and `/`, which are illegal in **Windows** filenames, and Windows is one of the four `npm run check` legs | `harness-shot` sanitises the PNG name only; the URL keeps the real id |

Round three, on the things only a browser or a build would have told you:

| Finding | What was wrong | Fixed in |
| --- | --- | --- |
| The index would not mount at all | The `?index` branch called `document.body.empty()` and `createDiv()` — Obsidian prototype extensions installed by `mountHarness`, which does not run on that branch. It throws in a real browser, so **every named screenshot fails**. `tests/harness/theme.ts:44-47` already carries this exact rule for the one other pre-mount call site, including the sentence that matters: *no test can see it, because every jsdom file installs the extensions at module top* | Task 4 Step 6 (standard DOM) and Task 6 (a test reading that branch) |
| Only the first chunk was inspected | A **dynamic import** — the one route lint cannot see, and therefore the whole reason the bundle test exists — is what Rollup most likely emits as a *separate* chunk. `output[0]` alone left it unexamined while looking thorough, and the planted proof used a static import, so it could not have revealed this | Task 2 (aggregate every chunk; the planted proof is now dynamic, and Step 5 shows lint deliberately *passing* on it, which is what proves the division of labour) |
| PNG filenames collided | Sanitising `[^a-zA-Z0-9]` collapses `a-b/C` and `a/b-C` onto one name — the plan's own id example, the same collision moved from the URL to the file system, with the second capture silently overwriting the first | Task 6 (a short hash of the real id beside the readable part) |
| An unclosed code fence | Steps 2 and 3 of Task 6 rendered *inside* a TypeScript block, so an executor copying a "code" step would have copied prose | Fixed; fence balance now verified mechanically |

Three of the fourteen were P1s that would each have cost an implementer a debugging session, and
one of those — the DOM shim — would have made the feature's headline capability fail on first
use while every test stayed green.

Round four, on whether the thing would work at all:

| Finding | What was wrong | Fixed in |
| --- | --- | --- |
| **The build entry was the one file not covered** | `srcFiles` builds `**/src/<subtree>/**/*`, so every layer ban covers a *subtree* — and `src/main.ts` sits at the root of `src/`, in none of them. It is also `vite.config.ts`'s `lib.entry`. The file with the most to lose was the only one where a prototype import was not refused, and Task 2's claim that lint catches the static plant was simply false | Task 1 (a block for `**/src/*.ts`) and its test, which lints `src/main.ts` by its real path |
| **Template-only prototypes could not use a real component** | `<StatusBar />` resolves through a local import or the app registry. A file with no `<script setup>` has neither, and the app installed only Pinia — so the core workflow, mocks composed beside real components, would have rendered unresolved custom elements. Silently: Vue only warns | Task 4 (`app.component` + `defineAsyncComponent` for every discovered component, kept lazy) |
| **The scheme toggle threw on the index branch** | Residue of round three's own fix. `drawSchemeToggle()` runs on every branch and calls `document.body.createEl`; the index branch installed no shim, so the page mounted and *then* threw — which `harness-shot` records and exits non-zero on, reporting a broken capture of an entry that rendered perfectly | Task 4 Step 6 (`installObsidianDom()` on that branch) |

Two of those three were P1s, and the middle one would have made the feature's stated purpose
not work.

Fixing them surfaced two more, unprompted: `page.ts` needed the component list, so **both globs
moved into `entries.ts`** — a second glob in a second file is a second answer that can disagree —
and registering by label reintroduced **the basename collision for a third time**, now in Vue's
component registry, where the second registration silently wins. A label claimed twice within one
kind is registered for nobody now, so a designer sees an unresolved tag instead of a component
from a directory they did not choose. (Round nine corrected the other half of that fix: a mock
sharing a label with the component it stands in for is the WORKFLOW, and refusing both left the
tag unresolved in the one case this feature exists to serve.)

Rounds five and six kept finding the same thing, which is why the pattern below matters more
than any of the fixes:

| Finding | What was wrong | Fixed in |
| --- | --- | --- |
| A test contradicted its own task | Task 6's DOM test asserted the standard-DOM branch **abandoned in round four**. Executed in order it would have failed against Task 4's own code — the plan was unrunnable | Task 6 (asserts ORDER: shim before first use) |
| Sibling mocks were unregistered | A prototype composes the mocks beside it, and a template-only file can import neither a component nor a sibling. `<MockToolbar />` unresolved — half the main flow | Task 4 (both kinds in one registry) |
| `CLAUDE.md` text contradicted the route | Task 8 still said the root is the index after Task 4 made it opt-in | Task 8 |
| **VueKonva was not installed** | `PlanEditorView.ts` installs it where it mounts; the index app did not. Every canvas component leaves `VStage`/`VLayer`/`VLine` unresolved — and Vue **warns rather than throws**, while the outer element still satisfies the shot selector, so `harness-shot` exits 0 on a PNG of a missing canvas | Task 4, with a test that reads the requirement out of production rather than pinning today's answer |
| The fixture check was harness-only | This plan creates `tests/fixtures/promotion/`, which a `/tests/harness/` filter misses. Residue of round four's own promotion fix | Task 2 (nothing under `tests/` at all — a rule, not a list) |
| The promoted template was not byte-identical | The mock's commentary sat *inside* its template block, so the independent pair the previous round introduced could never match. Worse, the comment **spelled the opening template tag**, and `templateBlock()` finds the block by regex — the extraction would have started mid-comment | Task 7: commentary above the template, never naming that tag. Verified by running the test's own regex over both files |

Round seven, on what the tests still did not reach:

| Finding | What was wrong | Fixed in |
| --- | --- | --- |
| **The editor context was not provided** | `PlanEditorView.ts` does four things where it mounts the real app — Pinia, VueKonva, `provide(PLAN_EDITOR_CONTEXT, …)`, mount. The index app did the first two. `usePlanEditorContext()` **throws** on the missing injection (`PlanEditorContext.ts`), so `PlanEditorRoot`, `BackgroundLayer` and anything using `useThemeTokens` render Task 4's named-failure card instead — the index would fail for exactly the components a designer most wants to look at | Task 3 (`harnessEditorContext()`, built from the exported deps rather than a second set of stubs), Task 4 Step 6 (the provision) and Task 6 (a test reading the requirement out of `PlanEditorView.ts` rather than pinning today's answer) |
| **The stylesheet check required attribute order** | The regex wanted `rel` before `href`. A link written the other way round is the same link to a browser and invisible to the test — so a second sheet could be added in the spelling the check cannot see | Task 5 (two-stage parse: find every `<link>`, then read its attributes in any order; the planted proof is now `href`-first) |
| **The real glob was never driven** | Every discovery case handed `discoverEntries` a hand-built map. If `import.meta.glob`'s pattern stopped matching `src/prototypes/`, discovery would return nothing, no prototype a designer added would ever appear — and all of them stay green. Criterion 1 asks for exactly this case and it was the one not written | Task 7 Step 9: discovery compared against the tree walked with `readdirSync`, watched failing on a deliberately broken glob. It waits for Task 7 because on an empty tree it is `[] === []` |

Round eight, on the paths only the eyeless actor takes:

| Finding | What was wrong | Fixed in |
| --- | --- | --- |
| **Readiness meant the outer module, not the screen** | The same defect as round one's stage-shell race, one level in and invisible to round one's fix. Every component is registered as a `defineAsyncComponent`, so a prototype composing `<StatusBar />` starts loading it only after the outer module renders — and the outer element already satisfies `[data-entry] > *`. `harness-shot` would write a picture of a half-drawn screen and exit 0, on exactly the composition the feature exists for | Task 4: `<Suspense>` sets `renderedId` on `@resolve`, which settles a whole subtree at any depth; `open()` may only ever CLEAR it. Task 6 asserts the negative, because that is where the defect was |
| **Index links interpolated the id** | `&` and `#` are legal in a filename and an id carries the path, so `?entry=${id}` names something other than the id. The in-page click masks it — `@click.prevent` passes the object and never reads the URL back — so it would break only in the path an agent uses, which is the path with no human watching | Task 4 (`URLSearchParams`), Task 6 (a test forbidding the raw interpolation) |
| **The planted fixture did not exist yet** | Task 2 Step 6 planted an import of `tests/harness/fixture.ts`, which **Task 3** creates. Vite stops on an unresolved specifier before Rollup produces a module list, so the step would have failed on the wrong thing and proved nothing | Task 2 Step 6 plants `tests/helpers/planFixtures.ts`, which is in the tree today and is genuinely a fixture. It also sharpens the minification argument: a const holding an object literal can be inlined away entirely |

Round nine, on what a warning costs an actor that reads exit codes:

| Finding | What was wrong | Fixed in |
| --- | --- | --- |
| **An ambiguous tag was only a warning — and the ambiguity was the workflow** | Two halves, both bad. A mock named after the component it stands in for made `registrableComponents` refuse BOTH, so `<StatusBar />` was unresolved in exactly the case the feature exists for. And an unresolved tag is a Vue *warning*: `<Suspense>` still resolves, `captureOne` records only console errors, so `harness-shot` photographs a prototype with a component missing and exits 0 | Task 4: a prototype WINS its label (`shadowed`, reported); a collision within one kind is still refused; and `IndexPage.vue` installs a `warnHandler` that turns `Failed to resolve component` into a named entry failure, checked in `settle()` after the render Suspense waited on, so `data-entry` is never set on a page with a hole in it |
| **A stale entry load could overwrite a newer one** | Two clicks leave two `open()` awaits in flight, and whichever import settles LAST wins. The stage could draw A while `data-entry` said B — a capture of the wrong component reported as a success under the requested name, which is worse than an empty one — or A's load error could replace a B that had drawn perfectly | Task 4 (a generation counter, guarding both the resolve and the reject arm), Task 6 (a test requiring both guards) |

Round ten, on the two remaining ways a green exit could lie:

| Finding | What was wrong | Fixed in |
| --- | --- | --- |
| **A missing required prop was not a failure** | Round nine caught the unresolved TAG and stopped there. A component with required props mounted by a bare `<component :is>` gets none — `EmptyLayer.vue` needs three — and Vue routes that through the same handler as a *different warning string*, which the match ignored. Same outcome: `<Suspense>` resolves, `data-entry` is set, and `harness-shot` captures a malformed component and exits 0 | Task 4: `renderDefects` replaces `unresolved`, and the plan states the limit rather than routing around it — a component needing props is listed, fails loudly when opened bare, and is looked at by composing it in a prototype that can pass them. The fix at the time was a two-item `FATAL_WARNINGS` allowlist; round twenty-three replaced it with the inversion below, and this row is kept as the history of how the allowlist got its second entry rather than as a description of what stands |
| **The wait selector was built from a file path** | `[data-entry="${id}"]` interpolates an id derived from a filename, and a `"` or a newline is legal in one on POSIX. The selector then parses as something else or not at all, so the index could open an entry the capture could never wait for | Task 6 asks the PAGE instead: `waitForFunction` comparing `dataset.entry` as a string. The escaping question is removed rather than answered, and a test forbids `[data-entry=` from reappearing in the script |

Round eleven, on the halves the previous round's fix did not reach:

| Finding | What was wrong | Fixed in |
| --- | --- | --- |
| **Suspense settled for a navigation that was over** | Round nine's generation guards protect `entry.component()`'s await and nothing else, while `<Suspense>` settles on its own schedule. Entry A on screen with a descendant still pending, a click moves `pendingId` to B, A's descendant resolves — and the stage advertises `data-entry="B"` over A's content. A capture of the wrong component under the requested name, which is the failure mode this whole feature keeps producing in new places | Task 4: `open()` clears `openComponent` BEFORE the await, so the stale subtree unmounts rather than resolving later; and `settle()` refuses a resolve that does not belong to the mount currently on the stage, so removing the clear cannot reintroduce it silently. (That comparison was spelled with `mountedId` when this row was written; round thirty-one replaced the id with the generation, and the row is now worded to the INVARIANT rather than to the spelling so it cannot go stale the same way twice.) Task 6 pins both |
| **The lint probe used `console.log`** | `.oxlintrc.json` turns `no-console` on for every file under `src/**`, so all three planted probes fail `npm run lint` on the console call. Step 5's documented PASS was impossible, and its FAIL would have proved nothing about `no-restricted-imports` — the run was red either way, which is a proof that cannot distinguish the thing it exists to distinguish | Task 2 Steps 3, 5 and 6 export the planted binding instead. It also holds the import better: a live export cannot be tree-shaken away before Rollup reports the module |

Round twelve, on the sheet that arrives by the other road — and the first finding that did not
survive being checked:

| Finding | What was wrong | Fixed in |
| --- | --- | --- |
| **A second sheet could arrive through the module graph** | Task 5 read `index.html` for `<link>` tags, and a `.css` import in `page.ts` or a `<style>` block in `IndexPage.vue` loads a sheet Vite injects at runtime — three links either way, green either way. Criterion 5 is the reason the whole feature exists, and it was checked over one of its two roads. Worse where it lands: `VUE_FILES` is `['**/src/**/*.vue']`, so `vue/no-restricted-block` covers a prototype's `<style>` but not `IndexPage.vue`'s, and a `.vue` under `tests/` matches no ESLint block at all | Task 5: a second case scanning `tests/harness/` for a `.css` import or a `<style>` block, watched failing on both spellings. The `src/prototypes/` half needed nothing — an existing rule already had it |
| *(declined)* **"the promoted fixture's unused binding fails lint"** | It does not, and the finding named two specifics that are both false: `computed` IS used (it builds `zones`), and at the fixture's real path neither linter reports anything — oxlint exits 0, and `eslint .` skips the file because no configuration matches a `.vue` under `tests/`. The same content under `src/` does fail, which is presumably where the reasoning came from | Nothing changed. The measurement is written into Task 7 beside the fixture, so the next reader does not re-derive it — and the underlying gap it accidentally surfaced (`.vue` under `tests/` is linted by neither linter) is stated there as real and out of this plan's scope |

Round twelve also settled the spec's own assumption 3, which had stood unverified since the note
was written: **a template-only SFC under `src/prototypes/` passes this repository's lint** —
driven through ESLint at that exact path, exit 0. `vue/component-api-style` and `vue/block-lang`
report on blocks that exist, so a file with no script block satisfies both.

Round thirteen, on three guards that each held for the case somebody thought of:

| Finding | What was wrong | Fixed in |
| --- | --- | --- |
| **The sheet scan was not transitive** | Round twelve's own fix, one level out. The scan read `tests/harness/` and a sheet imported by a component under `src/presentation/` — or by anything the index's glob loads — reaches the page exactly as surely, with the guard green. Fresh evidence against a fix that was itself fresh | Task 5: the import half scans `src/` and `tests/harness/` both, which closes the transitive route without building anything. The `<style>` half stays harness-only on purpose — `vue/no-restricted-block` already owns it under `src/`, and a text scan there reports `ViewRoot.vue`, whose comment spells the tag it promises never to use. The pattern matches a SPECIFIER now, not the substring `.css`, for the same reason |
| **A text-root entry could never be captured** | `entryHasDrawn` required `stage.firstElementChild !== null`, and `<template>Coming soon</template>` — a perfectly good early mock — renders a text node and no element. The index draws it, `data-entry` is set, and `harness-shot` times out on an entry criterion 4 promises is capturable. A readiness check narrower than what a valid entry can render | Task 6: `childNodes.length > 0`. Its sibling test pinned the old string verbatim and was updated in the same edit — it now also forbids `firstElementChild` returning |
| **Template-only held for one file** | The promotion test read `ZoneSummary.vue` by name, so the second mock could carry a `<script setup>` and stay green. `vue/no-restricted-block` was `['error', 'style']`, which permits every script form. The tree's defining invariant was a property of the one file that had been thought of | Task 7 Step 5: a `src/prototypes/**/*.vue` block narrowing that rule to `['error', 'style', 'script']` — checked at the forbidden thing, so it holds for mocks nobody has written. `'style'` is repeated because two blocks matching one file override the option array rather than merging it. Both script forms measured refused, template-only measured clean |

Round fourteen, on a legal path that makes an illegal filename:

| Finding | What was wrong | Fixed in |
| --- | --- | --- |
| **The readable half of a PNG name was uncapped** | `readable` is the whole id flattened, so a deep path or a long basename produces a filename past the filesystem's 255-byte per-component limit — and past Windows' 260-character whole-path limit sooner, `harness-shots/` being in front of it and Windows being one of the four legs. `page.screenshot()` fails with `ENAMETOOLONG` on an entry the index opened perfectly: criterion 4's failure again, from the third direction now — first a collision, then a wait selector, now a length | Task 6: `.slice(0, 60)` on the readable half, which is safe precisely because identity lives in the digest beside it. A test pins both halves, and states the limit of a source-text assertion rather than implying it captured anything |

Round fifteen, on the spelling that needs no import at all:

| Finding | What was wrong | Fixed in |
| --- | --- | --- |
| **A `<link rel="stylesheet">` in a TEMPLATE was invisible to every check** | Rounds twelve and thirteen chased the sheet through the module graph and never left it. A browser honours a stylesheet link in the BODY, so a mock whose template renders one loads the proposal sheet with no import, no `<style>` block and no build step involved — past the import scan, past the `<style>` scan, and past the `index.html` scan, which reads a different file. Three green checks and the forbidden sheet on the page | Task 5: a third list, `linkers`, over the same reachable set as the import scan, matched as `<link … stylesheet` rather than by attribute order. Narrow enough that prose merely saying "stylesheet" does not trip it — measured, no hit in 169 files — and planted as its own watched failure in Step 6 |

Round sixteen, on a regex that read one of the five spellings, and on my own stale sibling:

| Finding | What was wrong | Fixed in |
| --- | --- | --- |
| **The import pattern missed the binding form** | `/import\s*\(?\s*['"]…/` anchors on a quote immediately after `import`, so `import classes from './panel.module.css'` — Vite's ordinary CSS-modules form — does not match. The sheet loads and `importers` stays empty. Round fifteen widened this guard's REACH twice and never checked its PATTERN against more than the spelling it was written for | Task 5: the pattern matches the specifier POSITION — a quoted string preceded by `from`, `import`, or `import(` — measured against all five spellings (side-effect, default binding, named binding, dynamic, re-export) and against two prose shapes it must ignore |
| **Task 8 staged two files it did not modify, and not the two it did** | Its Step 3 retenses `src/prototypes/README.md` and `vitest.config.ts`, and its `git add` named neither — so following the plan leaves the worktree dirty and the retensing uncommitted, with no later commit to catch it. This is MY residue, not the plan's: the edit that added Step 3 also tried to fix this `git add` and its replacement target did not match, so the fix silently did nothing | Task 8: both files staged |

The second one is worth keeping in this list rather than quietly correcting, because it is the
review's own second pattern turned on the reviewer: **every round, a fix left a sibling stale** —
and this time the stale sibling was inside the fix that was written to prevent exactly that. A
replacement that matches nothing fails silently, which is the same shape as every other finding
here: a green signal that means nothing.

One finding from the review rounds belongs beside the others and did not fit their tables, because
it is about a fix rather than about the code: **round nineteen refuted the pair this plan proposed
for criterion 7 within an hour of it being written.** `PlanEditorRoot` renders the plan name only
through the `StatusBar` nested in its own template, so the prescribed assertion would have
exercised two `StatusBar` instances and passed with `PlanEditorRoot` no longer reading the store at
all. The remedy narrowed the criterion to what the tree can honestly show — two components, two
different fields, one world, both failing when the world is emptied — and wrote down what that does
not prove. It is the clearest instance yet of the rule this plan keeps rediscovering: **a fix
written to close a proxy defect is itself a claim, and it is worth exactly as much as the run that
checks it.**

**Found by the BASE MOVING**, which is the fourth category and the only one no amount of care
inside this branch could have prevented:

Design slice 8 (zone editing) merged into `main` while this plan was executing — 92 files, 5427
insertions — and it **renamed `src/presentation/editor/EditorContext.ts` to
`PlanEditorContext.ts`** and gave the context a new `commands` member. Every local run stayed
green; all four CI legs went red. The reason is worth writing down because it will recur:

**CI builds the pull request MERGE of head into base.** The two sides touched different LINES and
disagreed about what EXISTS, so `mergeable_state` read `clean` at every check-in of the day, git
merged without a single conflict, and the only instrument that could see the problem was the one
that builds both sides together. A semantic clash does not show as dirty.

What it cost, and what it did not: the fixture needed the new name and the new member — taken from
`harnessDeps()`, which `main` had already taught to answer `commands` with
`unavailablePlanEditorCommands()`, so no second stub was invented. This plan's references needed
the same sweep, including one that would have failed outright: **Task 6 asserts
`toContain('app.provide(EDITOR_CONTEXT')` against production source**, which after the rename
matches nothing — a test reading a requirement out of production is only as durable as the spelling
it reads, and this is the first time that cost anything.

Every `PlanEditorView.ts:145-159`-style reference in this plan became a symbol reference in the same
pass. `CLAUDE.md` says *address code by name, not by position — line numbers are correct until the
next insertion above them*, and slice 8 inserted above all of them at once.

Round twenty, on a route through CSS itself, a step that named no file, and one finding that did
not reproduce:

| Finding | What was wrong | Fixed in |
| --- | --- | --- |
| **A stylesheet can `@import` a stylesheet** | The fourth route, and the first that involves no JavaScript at all: `@import '…/concept.css';` in `tests/harness/theme.css` loads the proposal sheet with the page's three links unchanged, no module importing a `.css`, and no template rendering a `<link>`. The walker excludes `.css` files entirely, so all three lists stay empty | Task 5: a case refusing `@import` in `tests/harness/*.css`, planted before being trusted. Scoped there deliberately — `styles/index.css` uses `@import` to assemble the shipped sheet from its partials, and `scripts/styles-assemble.mjs` already fails the build on one it cannot resolve, so refusing it there would refuse the mechanism the plugin's own stylesheet is built from. What that leaves — an `@import` inside a `styles/` partial pointing outside `styles/` — belongs to the assembler, and the test says so rather than reaching into it |
| **Task 4's criterion-7 step named no file** | Prose describing a case, with no file to write it in, and `git add` staging four files none of which was obviously its home. An implementer could complete every prescribed edit and commit with criterion 7 untested — which is how a criterion that was MOVED to a task gets lost in the move. My residue: the rewrite that fixed the pair deleted the sentence naming `entries.test.ts` | Task 4 Step 8 names the file and points at Step 10, which already staged it |
| *(declined)* **"an emitted ASSET escapes the chunk-modules check"** | The scenario is real in principle — `chunk.modules` carries source provenance and an `OutputAsset` does not — but it does not reproduce in this build. Planted both spellings: `new URL('../tests/fixtures/…png', import.meta.url)` emitted no asset at all, and a plain `import png from '../tests/fixtures/…png'` put the fixture's path **into `chunk.modules`**, where the existing assertion catches it. The only asset this lib build emits is `styles.css`, whose `originalFileNames` is `[]` | Nothing changed. The test's own header already narrows its claim to chunk modules rather than asserting more, which was the right call independently |

Round thirty, on the two actors rather than on the machinery:

| Finding | What was wrong | Fixed in |
| --- | --- | --- |
| **The seeded world was never reseeded between entries** | `page.ts` calls `seedFixture()` ONCE for the lifetime of the index app, so every entry opened afterwards inherits whatever the previous one did to the stores — and `PlanEditorRoot` mutates the editor store on pan and zoom, which makes it reachable by ordinary use. `fixture.ts`'s headline claim is that what the designer sees is REPRODUCIBLE, and this is exactly the property that leaks: an entry's rendering depends on which entries were opened before it. Its `setActivePinia` paragraph also states the invariant the code beside it breaks — "one fixture call per mounted entry, immediately consumed", when Task 4 calls it once per app | Task 4, as a follow-up round: a RESET on the same Pinia at the top of `open()` — replacing the instance is not available, since `app.use()` installs one for the app's lifetime — covering every store an entry can dirty rather than only the one `seedFixture` writes, with `fixture.ts`'s false sentence corrected in the same commit |
| **The address bar did not follow the opened entry** | `@click.prevent` cancels navigation and `open()` never touches history, so refreshing or copying the URL opens the wrong screen — while `hrefFor` exists precisely so a copied link survives `&` and `#` in an id, and says so in a comment. `.prevent` also fires on MODIFIED clicks, so Cmd/Ctrl-click does not open a new tab | Task 4, same round: `history.replaceState` (not `push` — back should leave the harness, not walk backwards through every entry glanced at) plus a modifier guard |

Both land on the **Designer** actor rather than the agent one, and that is the observation worth
keeping. Twenty-nine rounds of review went almost entirely into the agent-facing half — what
`harness-shot` captures, what it exits non-zero on, what a gate can see — because that half has
instruments pointed at it. `npm run check` cannot see a URL that failed to update, a new tab that
did not open, or a component drawing against a world the previous entry moved. The half of the spec
with no gate watching it is the half that accumulated defects quietly.

Round twenty-nine, on the plan itself rather than on the code:

| Finding | What was wrong | Fixed in |
| --- | --- | --- |
| **The executable snippet still carried the allowlist round twenty-three removed** | Task 4's prescribed code declared `const FATAL_WARNINGS = ['Failed to resolve component', 'Missing required prop']` and filtered through it, while the committed `IndexPage.vue` had inverted the classification six rounds earlier. Following the plan rebuilds the exact `Invalid prop: type check failed` hole the inversion closed. Worse, and this is where the cost was: **Task 6's test pinned both strings as SOURCE TEXT** — `expect(index).toContain("'Failed to resolve component'")` — and the committed file spells them only inside a comment, with backticks rather than single quotes. Task 6 was unrunnable as written, and Task 6 had not run yet | The plan, in four places: the declaration and its rationale, the handler's filter, Task 6's assertion (now pinning `renderDefects.push(message)` — the collection being unconditional at the point it is written — with the behavioural proof left in `indexPage.test.ts`, which drives a real missing prop, a real wrong prop and a real unresolved tag), and two Self-Review rows, one of which had recorded the inversion as "the third string joins the list" |
| **Warning ownership keyed by id, A -> B -> A** | The same defect as round twenty-eight, one channel over: `warningOwner` and `mountedId` both hold `'A'` for two different mounts, so a delayed warning from the first A is accepted and `reportLateDefect()` pulls the healthy second A off the stage | Folded into round twenty-eight's shape fix, and then MEASURED rather than assumed: the guard is generation-keyed with the other three, but the case cannot reach this channel. Vue consults `config.warnHandler` only while its warning STACK is non-empty, and a continuation resuming after its own instance was unmounted has none — so Vue sends that warning to `console.warn` and the handler is never offered it. `tests/harness/indexPage.test.ts` drives that exact navigation and pins it, and the `warnHandler` guard carries the reason beside it |

The first is the fifth instance on this branch of one shape, and the most expensive kind of it. The
recurring failure has been a fix that leaves a sibling stale; here the stale sibling was an
**instruction for work not yet done** rather than a description of work already finished, so it
would have been executed rather than merely read. The pre-flight scan could not have caught it: at
scan time the plan agreed with itself, and it was the CODE that moved afterwards. The generalisable
rule is that a plan under execution is not a static document — every fix to committed code has to
be checked against the tasks still ahead of it, not only against the tasks behind.

The second is why round twenty-eight's ruling was made on the shape rather than on the case: two of
the four guards named by one navigation, found independently. Driving it turned the ERROR channel red
and left the warning channel green — Vue never offers this handler a warning raised by a mount the
reader has left — so that half is answered by a measurement and a sentence beside the guard rather
than by a test that fails without the fix. `task-4-report.md`'s fix round 5 carries the measurement.

Round twenty-eight, on the key the previous two rounds were both written in:

| Finding | What was wrong | Fixed in |
| --- | --- | --- |
| **Attribution by ID cannot tell two mounts of the same entry apart** | A -> B -> A. `EntryBoundary` snapshots `props.entryId` in `setup`, so the first A's boundary and the second A's boundary hold the same `owned`. If the first A's async hook rejects only after the second A has mounted, `reportEntryFailure` compares `'A' !== mountedId` — false — and pulls the NEW, healthy A off the stage to accuse it. That is the exact outcome the attribution apparatus exists to prevent, and the outcome `reportEntryFailure`'s own header claims is prevented | Task 4's committed `IndexPage.vue`, as a follow-up round scoped to the SHAPE rather than the case: one attribution key across all four guards |

This is the third refinement of one problem — round twenty-five gave the error channel an owner it
had never had, round twenty-seven gave the warning channel one, and this round says the owner both
of them were given is the wrong KIND of thing. Each fix was sound and each closed the route it
named, which is what makes the recurrence worth reading as a signal rather than as three unrelated
bugs. It is the same shape the stylesheet thread had for six rounds: the answer was a different
question, not a better patch.

The different question here: **`generation` — the monotonic counter `open()` already increments —
is a key that distinguishes two mounts of the same entry, and three of the four guards do not use
it.** The loader await has used it since round one of this file's life; `settle()`,
`reportEntryFailure` and the `warnHandler` all key on an id. So the fix is not a fifth guard, it is
bringing the four onto one key.

Round twenty-seven, on the channel the previous round's fix did not own:

| Finding | What was wrong | Fixed in |
| --- | --- | --- |
| **`renderDefects` was a shared array with no owner** | Vue allows one `config.warnHandler` per app, so the defect array is shared by construction, and `open()` emptying it on the way past is not ownership. `open()` clears the array and sets `openComponent` to null SYNCHRONOUSLY, which only queues Vue's re-render — so the flush that tears entry A down runs afterwards, reliably ahead of the module await resuming, and a warning raised from A's teardown lands in the array B's `settle()` reads. A clean B is pulled off the stage under its own name | Task 4's committed `IndexPage.vue`: `warningOwner`, published by the live `EntryBoundary` and checked at PUSH time, so a warning that is not the stage entry's goes to `console.error` instead of into the array |

The pair with round twenty-five is the point: that round gave the ERROR channel a per-entry owner
and stopped there, because the error channel is the one Vue offers a per-entry hook for. The warning
channel has no such hook — which is exactly why it needed the owner published instead of inferred,
and exactly why it was the channel left unguarded.

Round twenty-six, on the guard added one round earlier:

| Finding | What was wrong | Fixed in |
| --- | --- | --- |
| **The rendered-document check mounted one hard-coded component** | It named `StatusBar` — a COMPONENT, which cannot exercise the route the case exists for, since that route is a PROTOTYPE rendering a `<link>`. And the file it was placed in mocks `./entries`, so it would have inspected fixtures rather than the tree | Task 5: the case iterates what `prototypeEntries()` really returns, in a file where discovery is not mocked, with one component kept as a CONTROL so the loop is not silently doing nothing while the tree is empty |
| **Task 5 staged one of its two test files** | Step 7 writes to `indexPage.test.ts` and the `git add` named only `harness.test.ts`. Following the plan would leave the new guard uncommitted and the worktree dirty | Both staged. **My residue, for the fourth time on this branch** |

The first is the sharper one and it is the same mistake as the fix it corrects. Round twenty-five
replaced route-enumeration with a category check — and then wrote that category check against ONE
entry, chosen because it was convenient rather than because it was the case in question. Moving from
"which spellings" to "what does the page end up with" is only worth something if the page is asked
about the things that can actually do it.

The empty-tree property is worth naming: the loop covers nothing today and covers `ZoneSummary` the
moment Task 7 adds it, **with no edit to the test**. That is the feature's own headline claim — the
tree is the registration — turned on its own guard.

Round twenty-five, on the sixth route — and the last one worth chasing by spelling:

| Finding | What was wrong | Fixed in |
| --- | --- | --- |
| **A template can render a `<link>` without containing one** | `<component is="link" rel="stylesheet" href="…/concept.css" />` is valid Vue and produces a real stylesheet link. No source scan sees a `<link`, the path is not an import specifier, and `<component :is="tag">` with a computed value is not statically knowable even in principle | Task 5 Step 7: a check of the **rendered document**, after an entry mounts through the index, asserting the page's CSS-bearing node count is unchanged. It closes the CATEGORY rather than the spelling |
| **`onErrorCaptured` blames the current entry for a stale one's rejection** | Entry A starts an async lifecycle hook that rejects after B is opened; Vue still delivers A's rejection to the root capture hook, which reads the CURRENT `renderedId`/`pendingId` and reports that **B** failed, pulling B off the stage. The generation guards cover `entry.component()`'s await and `<Suspense>`'s settlement; the error channel was the third path and had none | Task 4's committed `IndexPage.vue`, as a follow-up |

The first closes the stylesheet thread properly, and the honest summary of that thread is worth
more than the fix: **six routes, found one at a time, each fix closing the route it named.** The
source scans stay — they catch a sheet in the edit loop, before anything runs, and they cover files
no test mounts — but they cannot see what a template RENDERS, and no amount of pattern refinement
will change that. The document check can. Two instruments with different reach, and the plan now
says why neither subsumes the other, so the next reader does not delete one for the other.

The second is the same shape as rounds nine and eleven in a channel nobody had checked: a guard
built for one asynchronous path, and a second path that reaches the same state.

Round twenty-four, on the one guard I left as a regex after arguing against regexes:

| Finding | What was wrong | Fixed in |
| --- | --- | --- |
| **`@IMPORT` is valid CSS and the scan was case-sensitive** | Round twenty-two replaced the HTML check with a parse, and argued for it at length. Round twenty-three then added a CSS check written as `/@import/` — the exact shape that argument refuses, two rounds later, by the same author | Task 5: `lightningcss` parses each sheet and the visitor reports what the cascade would see. Measured: it catches `@IMPORT` and ignores `/* @import '…' */`, which a case-insensitive regex would have got wrong in the other direction. Already a devDependency, already used by the stylesheet gate |
| **The index stage has no height rule** | `<main class="rp-harness-stage">` gets no growth: `theme.css` flexes `.rp-harness-leaf > div` and `> div > div:last-child`, and neither matches it. A full-pane entry's `height: 100%` chain therefore has an auto-height containing block, so Konva measures the canvas from intrinsic content rather than from the pane — the index shows a component at the wrong size, which is the one thing the harness exists to get right | Task 4, as a follow-up. Found independently by both reviewers, which is what moved it from "a risk nobody can see" to work |

The first is the sharpest self-inflicted finding on this branch. The argument for parsing was made,
written down, and applied to HTML — and then the very next guard went in as a pattern, because it
was a different file type and the lesson had been filed under the file type rather than under the
question. A lesson that lives in one place is a lesson about that place.

Round twenty-three, on a claim of mine that was false, a third fatal warning, and a rule the
committed code already obeys:

| Finding | What was wrong | Fixed in |
| --- | --- | --- |
| **The `styles/` partials were excused on a false premise** | This plan said an `@import` inside a `styles/` partial was the assembler's problem. It is not: `scripts/styles-assemble.mjs` validates `index.css`'s own lines, and then checks each partial only for line count and hard-coded colours before concatenating its body **unchanged**. So `@import '/prototype.css';` in `styles/view.css` reaches the assembled sheet and the page with every guard green — including the guard whose comment excused it | Task 5: the `@import` scan covers `styles/` too, excluding only `index.css`, whose imports the assembler validates itself. Planted in BOTH trees, and the `styles/` plant is the one worth watching red, being the one a draft believed was somebody else's problem |
| **`Invalid prop: type check failed` is a third fatal warning** | `FATAL_WARNINGS` names the unresolved tag and the missing required prop. A prototype can pass every required prop and pass a WRONG one — `transform="bad"` to `EmptyLayer` — and Vue only warns, `<Suspense>` resolves, `data-entry` is set, and `harness-shot` records a malformed entry as a success. Round ten found the missing prop and stopped one warning short; this is the same stop, one warning further on | Task 4's committed `IndexPage.vue`, as a follow-up round — and NOT by adding a third string, which is what this row first said. A third entry would have been the same stop one warning further on for a fourth time; Vue's prop validator alone raises four and `runtime-core` dozens more. The classification is INVERTED instead: every warning reaching the handler is a defect, with the carve-out reserved for a benign warning somebody has actually seen. Driven from REAL sources — `EmptyLayer` with genuine required props, a real `resolveComponent` miss — rather than written down again |
| **Task 7's real-glob test used `.sort()`** | The same `unicorn/no-array-sort` that forced `.toSorted` in `entries.ts` — so the prescribed Step 10 gate could not have passed | Task 7: `.toSorted` on both arrays, with the reason named so the next writer does not reintroduce it |

The first is worth more than its size, because the defect was in a SENTENCE rather than in code:
the plan reasoned about what a build script does instead of reading it, wrote the conclusion into a
comment, and the comment then justified not checking. That is the same failure as an unchecked
invariant, one level up — a guard narrowed on a premise nobody verified. It was checked this time
only because a reviewer read the assembler.

Round twenty-two, on the fifth way into one page:

| Finding | What was wrong | Fixed in |
| --- | --- | --- |
| **An inline `<style>` in `index.html`** | `<style>@import '…/concept.css';</style>` loads the proposal sheet, and every guard misses it: the page check queried `link[rel~=stylesheet i]`, the module scan reads `.ts`/`.vue`, and the sheet scan reads the harness's own `.css` files — none of which is this HTML | Task 5: the page query asks for **every CSS-bearing node** (`link[rel~=stylesheet i], style`) rather than for links, so the expected list is the page's whole CSS set and a `<style>` fails the equality by appearing in it. Planted as its own proof |

Five routes to one forbidden sheet have now been found one at a time — a `<link>`, a module import,
a template-rendered `<link>`, a stylesheet's own `@import`, and an inline `<style>`. The lesson is
not that the fifth was missed; it is that **enumerating routes is the wrong shape and kept looking
like the right one**, because each fix genuinely closed the route it named. Where the check could be
turned from a list into a category it now is: the page query asks what can introduce CSS rather than
which tags do, which is why this round's fix needed no new assertion.

Round twenty-one, on two guards that were narrower than the thing they guard:

| Finding | What was wrong | Fixed in |
| --- | --- | --- |
| **The sheet scan missed the harness's own helpers** | `tests/harness/mount.ts` and `planEditor.ts` are RUNTIME modules of the page and they import `tests/helpers/dom.ts`, `workspace.ts`, `canvas.ts` and `layout.ts`. A stylesheet imported by any of those loads into the page while the walker examined `src/` and `tests/harness/` only. Fourth iteration of one family: too few directories, too few spellings, too few extensions, now too few TREES | Task 5: `tests/helpers/` joins the reachable set. Measured with it: 200 files, no importer, no `<link>` |
| **Criterion 7's negative case could pass after hydration** | `PlanEditorRoot` re-hydrates from `context.queries` in `onMounted`, and `harnessDeps()` answers `HARNESS_PLAN` for any id — so a microtask after mounting, `status === 'ready'` whether the fixture seeded anything or not. An awaited negative would have proved nothing | Already handled in the code, which reads the DOM synchronously and says why; the PLAN did not name the trap, and now does. Not a race: `hydrate`'s effect lands on the microtask queue and a same-tick assertion runs before it, and the fixture's whole purpose is a world in place before the first synchronous mount |

The second is the round's more interesting result, because the finding was RIGHT about the mechanism
and the implementation had already accounted for it — independently, with the reason written at the
call site. A plan that had merely said "assert the negative" would have got the fragile version.

**Found by the TASK REVIEWS**, which is a third category and the sharpest one so far, because
these are defects in the plan's own test code that eighteen rounds of reading did not see:

| Found in | What was wrong | Settled by |
| --- | --- | --- |
| Task 1 | The negative assertion could not tell a pass from a parse error — the very predicate the file's own header identified as having silently accepted `['PARSE_ERROR']`. The mechanism was fixed and the assertion that could not see it was not | `not.toContain('PARSE_ERROR')`, watched failing |
| Task 1 | Fixtures written into `src/` raced two tests that walk that tree | Removed by changing technique, not by serialising |
| Task 2 | Six Minor findings, promoted to a fix round: a hand-written type where the bundler's own was one line away, a dead narrowing ternary, an unpinned `root`, a guarantee sentence wider than the check, and substring matching that a `node_modules` path could trip | All six in one pass |
| **Task 3** | **The criterion-7 case could not fail.** `useProjectStore()` returns the same store instance for one active Pinia, so reading `storeToRefs(...).plan` twice compares one ref to itself. Delete the fixture's assignments and it stays green — both sides read `null`. It asserted Pinia's singleton semantics, not that the fixture is one world | Criterion 7 moved to Task 4, which is the first task with VueKonva and so the first that can mount two different components. Task 3 leaves a pointer rather than a green test that means nothing |
| **Task 3** | **Criterion 6 was held against a stub**, not a real component — `createApp({ setup: () => () => null })`, which reads no store. That proves the injection key round-trips | Task 3 mounts the real `StatusBar` against nothing but the fixture, watched failing with the fixture emptied |

The Task 3 pair is worth more than the others: **the plan named "a test that asserts on a proxy
rather than on the thing" as its single most repeated defect, and then shipped two of them in the
task that was supposed to prove the fixture works.** Naming a failure mode does not immunise you
against it; only running the test with the thing removed does.

Round eighteen, on HTML's own spellings, and on the six directories that exist today:

| Finding | What was wrong | Fixed in |
| --- | --- | --- |
| **The link check read only QUOTED attributes** | `<link rel=stylesheet href=…/concept.css>` is valid HTML that a browser loads, and the two-stage regex round seven introduced — itself the fix for an attribute-ORDER defect — matched neither half of it. Third pattern, third spelling it did not know about | Task 5: the case PARSES. This file already runs in jsdom, so `DOMParser` and `link[rel~=stylesheet i]` were there all along — free of attribute order, quoting, case, and `rel` being a token list. The same argument `CLAUDE.md` already makes for reading colours off lightningcss's tree instead of off source text. The planted proof is now the unquoted spelling, and the `<link rel="icon">` exclusion is checked rather than assumed |
| **The prototype ban enumerated the six layers that exist** | The six `forbidden(...)` calls name today's subtrees and the root block covers only files DIRECTLY under `src/`. A new `src/shared/` would match neither, and its import of a prototype would pass lint — the "list the places" shape `CLAUDE.md` refuses, hiding inside the fix that was built to check at the forbidden thing | Task 1's config, as a follow-up: see the note below on why the remedy is not simply one broad block |

The second one's remedy needs care rather than the obvious edit, and the reason is already written
down in this repository: **two flat-config blocks matching one file OVERRIDE
`no-restricted-imports` rather than merging it.** A broad `src/**/*` block carrying the prototype
ban, placed after the `forbidden(...)` calls, would take the layer bans off every layer file it
also matches — trading one hole for six. Placed BEFORE them it works, because each `forbidden(...)`
call already carries `'prototypes'` in its own `groups` and so re-states the ban for the files it
overrides. That ordering is load-bearing and invisible, which means the test has to drive a subtree
name that no `forbidden(...)` call mentions AND re-check that a layer ban still fires in a layer
directory. A fix that only proves the first half would silently be the trade above.

Round seventeen, on the extension list — the same finding in two places, which is what makes it
a category rather than a slip:

| Finding | What was wrong | Fixed in |
| --- | --- | --- |
| **The one-way door does not cover a `.js` importer** | `srcFiles()` builds `**/src/<subtree>/**/*.ts` and `*.vue`, and Task 1's root block matches `**/src/*.ts` and `*.vue`. `tsconfig.json` sets `allowJs`, so a `.js` file under `src/` is compiled and bundled — and importing `src/prototypes/` from one passes lint. Measured: `src/main.js` and `src/core/Fixture.js` both exit 0 with the import in place. Criterion 3 says "from anywhere else in `src/`", and a `.js` file is anywhere else | Task 1's config, as a follow-up fix round: the extension lists widen and the test drives a `.js` importer. The layer bans inherit the same widening, which is a strict improvement — they claim the same thing about the same tree |
| **The sheet scan does not read a `.js` module either** | `sources()` admitted `.ts` and `.vue`, so a `.js`/`.mjs` helper importing a stylesheet is a module Vite loads and the guard never opens | Task 5: the extension list is every module type Vite will load. Measured with the widened list — still 169 files, still no hit |

Both are the same mistake: **an extension list written from what the tree contains rather than
from what the tool accepts.** It is the third form of a failure this plan keeps producing — first
a scan of too few directories, then a pattern matching too few spellings, now a filter admitting
too few file types. Each looked complete because everything it could see was covered.

**Found by EXECUTION rather than by review**, which is the category this list did not have until
the plan started running. Two in Task 1, two in Task 2, and each was invisible to fifteen rounds
of reading because each depended on what a tool actually does:

| Found in | What was wrong | Settled by |
| --- | --- | --- |
| Task 1 | The prescribed fixture technique linted FICTITIOUS `.ts` paths, and typescript-eslint's `projectService` fatally refuses a path not in the program — so `no-restricted-imports` never ran and the task's own third assertion passed trivially against `['PARSE_ERROR']`. `vue-rules.test.ts` gets away with the same shape only because the Vue block carries no `projectService` | Purely virtual `.vue` fixture paths, which `srcFiles()` already scopes every ban to. The negative assertion now also refuses `PARSE_ERROR`, watched failing |
| Task 1 | Writing real fixtures into `src/` raced two tests that walk that tree, and vitest runs files in parallel | Removed by the technique above rather than serialised — a test that mutates the shared source tree is worse than the race it causes | 
| Task 2 | `import type { RollupOutput } from 'rollup'` fails `npm run analyze`: this Vite bundles with **Rolldown** and `rollup` is not installed. It survives Vitest, which strips type-only imports without resolving them, so the failure arrives from fallow at the end of the gate rather than from the test | `import type { Rolldown } from 'vite'` — the bundler's own type, from a package the file already imports and `package.json` already lists. Installing `rollup` for a type nothing type-checks is the dependency `CLAUDE.md` refuses by name; hand-written local interfaces were the FIRST fix and were wrong for the other reason, being a second description of someone else's shape that can disagree with it. The review found the accurate option one line away |
| Task 2 | The planted probe `Doomed.vue` fails `vue/multi-word-component-names`, so the lint run in the step that exists to observe lint's verdict was red for an unrelated reason | `DoomedPrototype.vue`, and the plan now says why the name is two words |

The generalisation is the one this plan already knew and had only applied to tests: **a step whose
expectation nobody has run is a claim, not a check.** Fifteen rounds of review could not see any of
these four, because each is a fact about a tool's behaviour rather than about the text.

**The pattern, across all twenty-six rounds and worth more than any individual fix:** every failure was
a **green signal that means nothing** — a config grep for a lint run, a first chunk for a build,
a string compared to itself, a shimmed DOM call that passes in jsdom and throws in a browser, a
glob whose subtree excludes the file that matters, a hand-built map standing in for the glob that
would have to work, a readiness marker that means the outer module rather than the screen, an
unresolved component or a failed injection Vue only warns about — and, twice now, a design that
refused the collision its own headline workflow creates, and a probe whose failure could not
distinguish the rule it was testing from the one it tripped by accident.

And the second pattern, which is mine rather than the design's: **every round, a fix left a
sibling stale.** The DOM fix left the toggle. The promotion fixture left the bundle filter. The
routing fix left the `CLAUDE.md` text and the PBI's own assumption. Round seven's glob fix left Task 4's own
header claiming the glob had "nothing to assert about in a unit test", and Task 7's step numbers
already carried two Step 7s. Rounds five onward ended with a *deliberate residue sweep* before
pushing, and it kept catching what the review had not — which is the practice to carry into
execution, not the sixty-four fixes. Round twelve is the first to add a third pattern:
a finding can be confidently specific and still wrong, so a declined one is declined with a
measurement rather than with a judgement.