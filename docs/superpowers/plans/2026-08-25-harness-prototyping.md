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

// The ESLint boot, paid once here rather than by whichever test ran first.
beforeAll(warmUpEslint, ESLINT_BOOT_MS);

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
 */
const IMPORTER = (layer: string) => `src/${layer}/Fixture.ts`;
const PROTOTYPE_IMPORT = "import Mock from '../prototypes/ZoneSummary.vue';\n\nexport const used = Mock;\n";
/** From `src/main.ts` the tree is one level down, not two. */
const ROOT_IMPORT = "import Mock from './prototypes/ZoneSummary.vue';\n\nexport const used = Mock;\n";

const LAYERS = ['core', 'domain', 'application', 'infrastructure', 'presentation', 'plugin'];

describe('the prototypes one-way door', () => {
	it.each(LAYERS)('refuses an import of src/prototypes/ from %s/', async (layer) => {
		const reported = await lintText(PROTOTYPE_IMPORT, IMPORTER(layer));

		expect(reported).toContain('no-restricted-imports');
	});

	/**
	 * `src/main.ts` is the BUILD ENTRY and matches no subtree pattern, so every layer ban
	 * misses it. Driven by its real path rather than a fixture beside it: the whole failure
	 * this catches is a glob that does not reach the file, and a fixture at a different path
	 * would be answering a different question.
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
		const reported = await lintText(
			"import StatusBar from '../presentation/editor/shell/StatusBar.vue';\n\nexport const used = StatusBar;\n",
			'src/prototypes/Fixture.ts',
		);

		expect(reported).not.toContain('no-restricted-imports');
	});
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/build/prototypes-one-way-door.test.ts`

Expected: FAIL on all six layers — `no-restricted-imports` is not reported, because no layer
bans `prototypes` yet. The last test PASSES already, which is correct: nothing bans that
direction and nothing should.

If a layer reports `PARSE_ERROR` instead, the fixture path is not matching the block you expect —
check it against `srcFiles()` in `eslint.config.mjs` before changing the rule.

- [ ] **Step 3: Add `'prototypes'` to all five existing bans**

In `eslint.config.mjs`, add `'prototypes'` to the `groups` array of each of the five `forbidden(...)` calls at lines 323–352. For example the first becomes:

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
import type { RollupOutput } from 'rollup';
import { beforeAll, describe, expect, it } from 'vitest';
import { REPO } from '../helpers/oxlint';

/**
 * The guarantee with a user on the other end: no mock, prototype or fixture is ever in a built
 * plugin. `prototypes-one-way-door.test.ts` refuses the import; this refuses the OUTCOME.
 *
 * Both exist because neither is sufficient. Lint reads static imports and a dynamic specifier
 * slips past it; this sees whatever actually got in, and reports only after the fact.
 *
 * `write: false` — the modules that composed the chunk are in the returned output, so nothing
 * is emitted to disk and this does not race `npm run build`'s own `dist/`.
 */
const BUILD_MS = 120_000;

let modules: string[] = [];

beforeAll(async () => {
	const result = (await build({
		configFile: path.resolve(REPO, 'vite.config.ts'),
		build: { write: false },
		logLevel: 'error',
	})) as RollupOutput | RollupOutput[];

	const output = Array.isArray(result) ? result[0] : result;
	// EVERY chunk, not the first. A dynamic import — the exact route this test exists to
	// catch, since lint cannot see it — is what Rollup most likely emits as a SEPARATE chunk,
	// so inspecting `output[0]` alone would leave the interesting case unexamined while
	// looking thorough.
	const chunks = output.output.filter((part) => part.type === 'chunk');

	if (chunks.length === 0) throw new Error('the build produced no chunk to inspect');

	// Absolute ids, normalised to forward slashes so this reads the same on Windows — which
	// is one of the four legs `npm run check` rides.
	modules = chunks.flatMap((chunk) =>
		Object.keys(chunk.type === 'chunk' ? chunk.modules : {}).map((id) => id.split(path.sep).join('/')),
	);
}, BUILD_MS);

describe('the built plugin', () => {
	it('was built from real modules, so this test is asserting on something', () => {
		expect(modules.length).toBeGreaterThan(0);
		// A sanity anchor: the entry itself must be in there, or the shape of `chunk.modules`
		// has changed under us and every assertion below would pass vacuously.
		expect(modules.some((id) => id.endsWith('/src/main.ts'))).toBe(true);
	});

	it('contains no module from src/prototypes/', () => {
		const leaked = modules.filter((id) => id.includes('/src/prototypes/'));

		expect(leaked, `prototypes reached the bundle: ${leaked.join(', ')}`).toEqual([]);
	});

	/**
	 * EVERY test path, not just `tests/harness/`. The guarantee names fixtures, and they do not
	 * all live in one directory — `tests/fixtures/promotion/` holds the promoted SFC this plan
	 * itself creates, and it would have passed a harness-only assertion.
	 *
	 * Stated as "nothing under `tests/`" rather than as a list of fixture directories, so the
	 * next one somebody adds is covered without anybody remembering to come back here. Nothing
	 * under `tests/` belongs in a plugin under any circumstances, which makes the broad rule
	 * the correct one rather than merely the convenient one.
	 */
	it('contains no test module at all, fixtures included', () => {
		const leaked = modules.filter((id) => id.includes('/tests/'));

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

Temporarily create `src/prototypes/Doomed.vue`:

```vue
<template>
	<div>planted</div>
</template>
```

It carries no marker, and its name deliberately does not collide with any component. Temporarily
add to the top of `src/main.ts`:

```typescript
void import('./prototypes/Doomed.vue').then((module) => console.log(module));
```

**A dynamic import, deliberately.** It is the route lint cannot see, so it is the one this test
exists for — and it is also what Rollup is most likely to emit as a separate chunk, which is
what the multi-chunk aggregation above is for. A static import would prove the easy half and
leave the hard half untested while looking like a proof.

- [ ] **Step 4: Watch it go red**

Run: `npx vitest run tests/build/prototypes-not-bundled.test.ts`

Expected: FAIL on `contains no module from src/prototypes/`, naming `Doomed.vue`.

If it PASSES, the aggregation is not reaching every chunk — print `chunks.length` and the file
names before changing anything else, because a green result here means the whole test is
decorative.

- [ ] **Step 5: Confirm lint refuses the same thing**

Run: `npm run lint`

Expected: **PASS** — and that is the point rather than a problem. `no-restricted-imports` does
not see a dynamic specifier, which is precisely why the bundle test exists. Swap the planted line
for the static form to watch lint refuse it:

```typescript
import Doomed from './prototypes/Doomed.vue';
console.log(Doomed);
```

Run `npm run lint` again: FAIL with `no-restricted-imports` from Task 1's `forbidden('plugin', …)`
block. The two halves cover different routes, and this step is what proves the division of labour
rather than assuming it.

- [ ] **Step 6: Prove it fails on a fixture too — the case a text scan could not catch**

Revert the prototype and plant a fixture import instead:

```bash
git checkout src/main.ts
rm src/prototypes/Doomed.vue
```

Then temporarily add to the top of `src/main.ts`:

```typescript
import { FIXTURE_PLAN } from '../tests/helpers/planFixtures';
console.log(FIXTURE_PLAN);
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
  `harnessEditorContext(): EditorContext`, the value `app.provide(EDITOR_CONTEXT, …)` needs.
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
	EDITOR_CONTEXT,
	useEditorContext,
	type EditorContext,
} from '../../src/presentation/editor/EditorContext';
import { HARNESS_PLAN, HARNESS_ZONES } from './planEditor';
import { useProjectStore } from '../../src/presentation/stores/ProjectStore';

/**
 * The one world every index entry mounts against. Three claims worth a test: it is SEEDED
 * (a component reading the store finds a plan, with no per-entry setup), it is ONE world
 * (two stores created from it agree, which is what makes two components on a prototype
 * consistent), and the editor context it hands out is one `useEditorContext()` ACCEPTS.
 *
 * The third is driven through a real `createApp` rather than asserted on the returned
 * object, because the failure it guards is a key mismatch: a context built correctly and
 * provided under a symbol the consumer does not inject looks perfect in a shape assertion
 * and throws on mount. `useEditorContext` throws rather than warning, so the index would
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

	it('provides a context `useEditorContext()` accepts, so a real component can mount', () => {
		let seen: EditorContext | undefined;

		const app = createApp({
			setup() {
				seen = useEditorContext();

				return () => null;
			},
		});

		app.provide(EDITOR_CONTEXT, harnessEditorContext());
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
import type { EditorContext } from '../../src/presentation/editor/EditorContext';
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

	setActivePinia(pinia);

	const project = useProjectStore();

	// Assigned directly rather than through `hydrate`: hydration takes query services and is
	// asynchronous, and this page has no vault to answer them. What a component needs is the
	// post-hydration STATE, which is this.
	project.plan = HARNESS_PLAN;
	project.zones = new Map(HARNESS_ZONES.map((zone) => [zone.id, zone]));
	project.status = 'ready';

	return pinia;
}

/**
 * The editor context, which is NOT optional and is easy to miss.
 *
 * `src/presentation/views/PlanEditorView.ts` does three things when it mounts: `createPinia()`,
 * `use(VueKonva)` and **`provide(EDITOR_CONTEXT, …)`**. Without the third, every component that
 * calls `useEditorContext()` throws — `PlanEditorRoot`, `BackgroundLayer`, anything using
 * `useThemeTokens` — so the index would render the named failure for exactly the components a
 * designer most wants to look at, and a prototype composing one would too.
 *
 * Built from `harnessDeps()` rather than from a second set of stubs, for the same reason the
 * plan and zones come from `planEditor.ts`: a second derivation answers differently the day one
 * of them is edited.
 */
export function harnessEditorContext(): EditorContext {
	const deps = harnessDeps();

	return {
		planId: HARNESS_PLAN.id,
		queries: deps.queries,
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
 * that has mattered in this design, so an ambiguous one is registered for nobody.
 */
describe('registering components for template-only prototypes', () => {
	it('registers an unambiguous label under its tag', () => {
		const { byTag, ambiguous } = registrableComponents(
			discoverEntries({ '/src/presentation/editor/shell/StatusBar.vue': () => Promise.resolve({}) }, 'component'),
		);

		expect([...byTag.keys()]).toEqual(['StatusBar']);
		expect(ambiguous).toEqual([]);
	});

	it('refuses a label shared by a mock and the component it stands in for', () => {
		const { byTag, ambiguous } = registrableComponents([
			...discoverEntries({ '/src/prototypes/StatusBar.vue': () => Promise.resolve({}) }, 'prototype'),
			...discoverEntries(
				{ '/src/presentation/editor/shell/StatusBar.vue': () => Promise.resolve({}) },
				'component',
			),
		]);

		// The likeliest collision of all, since naming a mock after its component is the
		// workflow. Neither is registered, so nothing silently shadows the other.
		expect(byTag.has('StatusBar')).toBe(false);
		expect(ambiguous).toEqual(['StatusBar']);
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

		// Neither is registered. A prototype writing `<StatusBar />` gets an unresolved tag it
		// can SEE, rather than a component from a directory nobody chose.
		expect(byTag.has('StatusBar')).toBe(false);
		expect(ambiguous).toEqual(['StatusBar']);
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
 * Labels are not unique, and this is the third place that has mattered. Rather than let the
 * second registration silently win — a prototype would then draw a component from a directory
 * nobody chose, or a mock would shadow the component it stands in for — a duplicated label is
 * registered for NOBODY and returned in `ambiguous`, so the index can say which tag it refused
 * and why. An unresolved tag a designer can see beats a resolved one pointing somewhere they
 * did not mean.
 */
export function registrableComponents(entries: HarnessEntry[]): {
	byTag: Map<string, HarnessEntry>;
	ambiguous: string[];
} {
	const seen = new Map<string, HarnessEntry[]>();

	for (const entry of entries) seen.set(entry.label, [...(seen.get(entry.label) ?? []), entry]);

	const byTag = new Map<string, HarnessEntry>();
	const ambiguous: string[] = [];

	for (const [label, found] of seen) {
		if (found.length === 1) byTag.set(label, found[0]);
		else ambiguous.push(label);
	}

	return { byTag, ambiguous };
}
```

- [ ] **Step 4: Run the test again**

Run: `npx vitest run tests/harness/entries.test.ts`

Expected: PASS, 4 tests.

- [ ] **Step 5: Write the index page component**

Create `tests/harness/IndexPage.vue`:

```vue
<script setup lang="ts">
/**
 * The harness index: every prototype and every component, click to open.
 *
 * The entry lists come from `entries.ts`, which owns both globs — `page.ts` needs the component
 * list too, to register those components for template-only prototypes, and a second glob here
 * would be a second answer that can disagree.
 *
 * Both globs are lazy: the index lists far more than it draws, and eagerly importing every
 * component would mount the whole plugin's presentation layer to render a list of links.
 *
 * TWO failure paths, not one. A module that fails to IMPORT rejects the promise and is
 * caught below; a module that imports fine but throws in `setup()` or `render()` fails
 * later, inside Vue's render cycle, where a try/catch around the import cannot see it.
 * `onErrorCaptured` is what covers the second, and without it criterion 8 holds only for
 * half the ways an entry can fail — the half that is easier to cause deliberately and rarer
 * in practice.
 */
import { computed, onErrorCaptured, ref, shallowRef } from 'vue';
import { componentEntries, prototypeEntries, type HarnessEntry } from './entries';

const prototypes = prototypeEntries();
const components = componentEntries();

const all = computed<HarnessEntry[]>(() => [...prototypes, ...components]);

const requested = new URLSearchParams(window.location.search).get('entry');
const openComponent = shallowRef<unknown>(null);
const failure = ref<string | null>(null);
/**
 * The id of what is actually RENDERED, and it means the WHOLE subtree — null until every
 * async dependency below the entry has settled, and null again the moment one fails. The
 * stage exposes it as `data-entry`, which is what `scripts/harness-shot.mjs` waits for.
 *
 * It is deliberately not `requested`: the stage element exists from the first paint, so a
 * capture waiting on the stage alone would photograph "Pick an entry." and exit 0. An empty
 * screenshot reported as a success is the worst outcome this whole feature can produce,
 * because the actor it is built for cannot see that it is empty.
 *
 * And it is deliberately not set by `open()` either, which is the same defect one level in.
 * The global registry hands every component to Vue as a `defineAsyncComponent`, so a
 * prototype composing `<StatusBar />` starts loading it only once the OUTER module has
 * rendered. Setting the id when the outer loader resolves would mark the page ready while
 * every nested component was still a placeholder — the outer element satisfies the shot
 * selector, so `harness-shot` writes a picture of a half-drawn screen and exits 0. `open()`
 * therefore only ever CLEARS it; `<Suspense>` in the template is what sets it, because
 * resolving a whole subtree's async dependencies together is exactly what that boundary is
 * for and it holds at any nesting depth.
 */
const renderedId = ref<string | null>(null);

/** What `@resolve` should name. Distinct from `renderedId`, which means "on screen". */
const pendingId = ref<string | null>(null);

async function open(entry: HarnessEntry): Promise<void> {
	failure.value = null;
	renderedId.value = null;
	pendingId.value = entry.id;
	try {
		const module = (await entry.component()) as { default: unknown };

		openComponent.value = module.default;
		// No `renderedId` assignment here, deliberately — see its declaration. The outer
		// module having loaded says nothing about the components it composes.
	} catch (error) {
		// Named rather than blank: a prototype that half-drew itself is worse than one that
		// says what is missing, because a gap reads as a layout decision.
		openComponent.value = null;
		failure.value = `${entry.id} failed to load: ${error instanceof Error ? error.message : String(error)}`;
	}
}

/**
 * A render-time throw from the mounted entry. Returning `false` stops it propagating, so one
 * bad entry reports itself instead of blanking the page and taking the list with it.
 */
onErrorCaptured((error) => {
	const id = renderedId.value ?? pendingId.value ?? requested ?? 'the entry';

	openComponent.value = null;
	renderedId.value = null;
	failure.value = `${id} failed to render: ${error instanceof Error ? error.message : String(error)}`;
	return false;
});

/**
 * The link an entry is reachable at, built with `URLSearchParams` rather than interpolated.
 *
 * `&` and `#` are legal in a filename on every platform this runs on, and an id carries the
 * path, so a raw `?entry=${id}` produces a URL that no longer means the id: opening the link
 * in a new tab or copying it hands `URLSearchParams.get('entry')` a truncated value and the
 * index reports an unknown entry. The in-page click hides this, because `@click.prevent`
 * calls `open(entry)` with the object and never reads the URL back — so the defect would
 * appear only in the one path an agent uses, which is the path with no human watching.
 * `scripts/harness-shot.mjs` encodes the same id on its side.
 */
function hrefFor(entry: HarnessEntry): string {
	return `?${new URLSearchParams({ entry: entry.id }).toString()}`;
}

const initial = all.value.find((entry) => entry.id === requested);

// An `?entry=` naming nothing is reported rather than silently ignored — `harness-shot`
// exits non-zero on it, so a typo in a capture command fails loudly instead of writing a
// picture of the index.
if (requested && !initial) failure.value = `no entry named ${requested}`;
if (initial) void open(initial);
</script>

<template>
	<div class="rp-harness-index">
		<nav aria-label="Harness entries">
			<h1>Harness</h1>
			<p v-if="prototypes.length === 0">No prototypes yet — add a .vue file under src/prototypes/.</p>
			<ul>
				<li v-for="entry in all" :key="entry.id">
					<a :href="hrefFor(entry)" @click.prevent="open(entry)">{{ entry.label }}</a>
					<span>{{ entry.kind }}</span>
				</li>
			</ul>
		</nav>
		<main class="rp-harness-stage" :data-entry="renderedId ?? undefined">
			<p v-if="failure" role="alert" class="rp-harness-failure">{{ failure }}</p>
			<!--
				`@resolve` fires once every async dependency in the subtree has settled, which is
				the only signal that covers a mock composing a real component that composes
				another. `@pending` fires when a new set appears, so switching entries takes the
				readiness marker away again rather than leaving the previous entry's id on a stage
				that is mid-swap.
			-->
			<Suspense v-else-if="openComponent" @pending="renderedId = null" @resolve="renderedId = pendingId">
				<component :is="openComponent" />
			</Suspense>
			<p v-else>Pick an entry.</p>
		</main>
	</div>
</template>
```

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
import { EDITOR_CONTEXT } from '../../src/presentation/editor/EditorContext';
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
	 * `src/presentation/views/PlanEditorView.ts:158` calls `app.use(VueKonva)`, and without it
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
	 * obvious. `PlanEditorView` calls `app.provide(EDITOR_CONTEXT, …)`; without it every
	 * component reading `useEditorContext()` throws, and the index would show the named
	 * failure for precisely the components a designer most wants to see.
	 */
	app.provide(EDITOR_CONTEXT, harnessEditorContext());

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
	// main flow. One registry across both also means a mock and a component sharing a label
	// are caught as the ambiguity they are, rather than one kind silently shadowing the other.
	const { byTag, ambiguous } = registrableComponents([...componentEntries(), ...prototypeEntries()]);

	for (const [tag, entry] of byTag) {
		app.component(tag, defineAsyncComponent(entry.component as () => Promise<Component>));
	}

	// Registered for nobody rather than for whichever won a race. An unresolved tag a designer
	// can see beats a resolved one pointing at a directory they did not choose.
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

- [ ] **Step 8: Run the full gate**

Run: `npm run check`

Expected: PASS. If `analyze` reports `IndexPage.vue` or `entries.ts` dead, they are reached from `tests/harness/page.ts`, which is already a fallow entry — check the import chain rather than adding a declaration.

- [ ] **Step 9: Commit**

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
- Test: `tests/harness/harness.test.ts` (add a case)

**Interfaces:**
- Consumes: `tests/harness/index.html`.
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
	 */
	it('offers prototypes exactly one plugin stylesheet and no proposal sheet', () => {
		const html = readFileSync(path.join(REPO, 'tests', 'harness', 'index.html'), 'utf8');

		// Every `<link>`, then its attributes — rather than one regex assuming `rel` precedes
		// `href`. Attribute order is free in HTML, so `<link href="…/concept.css"
		// rel="stylesheet">` would load the forbidden proposal sheet while an order-dependent
		// pattern reported the same three and stayed green.
		const sheets = [...html.matchAll(/<link\b([^>]*)>/g)]
			.map((match) => match[1])
			.filter((attrs) => /\brel\s*=\s*["']stylesheet["']/.test(attrs))
			.map((attrs) => /\bhref\s*=\s*["']([^"']+)["']/.exec(attrs)?.[1] ?? '');

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

- [ ] **Step 3: Run it**

Run: `npx vitest run tests/harness/harness.test.ts`

Expected: PASS immediately — the page already links exactly those three. This test is a **regression guard**, not a driver, and that is worth being explicit about: it exists so that adding `concept.css` to the harness page later is a red test rather than a quiet reintroduction of the split.

- [ ] **Step 4: Prove it can fail**

Temporarily add to `tests/harness/index.html`, after the `/styles.css` link — **with `href`
first**, which is the spelling an order-dependent pattern would have missed:

```html
		<link href="../../docs/user-experience/concepts/concept.css" rel="stylesheet" />
```

Run: `npx vitest run tests/harness/harness.test.ts`

Expected: FAIL on both assertions. Then revert: `git checkout tests/harness/index.html`

- [ ] **Step 5: Run the full gate**

Run: `npm run check`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add tests/harness/harness.test.ts
git commit -m "Guard the one-sheet claim on the harness page

A mock drawn against a second sheet is approved against something that
will not ship, which is the entire reason prototypes moved out of
docs/user-experience/concepts/. Adding concept.css to the harness page
is now a red test rather than a quiet reintroduction of the split.

Watched failing with the sheet planted before being trusted."
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
	 * The assertion that stops a green run from lying. Waiting on `.rp-harness-stage` alone
	 * would photograph the placeholder — a successful, empty PNG, which the actor this
	 * feature exists for cannot tell from a real one.
	 */
	it('waits for the entry to have rendered, not merely for the stage to exist', () => {
		const source = readFileSync(SCRIPT, 'utf8');

		expect(source).toContain('data-entry=');
		// The bare stage class must not be used as a wait target on its own.
		expect(source).not.toMatch(/selector:\s*['"`]\.rp-harness-stage['"`]/);
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
	 * The production mount does THREE things — Pinia, VueKonva and `provide(EDITOR_CONTEXT)`.
	 * The third has no `use()` to make it visible in a diff, which is why it was the one
	 * missed, and why it gets its own assertion rather than being folded into the one above.
	 */
	it('provides EDITOR_CONTEXT on the index app, as the production mount does', () => {
		const page = readFileSync(path.join(REPO, 'tests', 'harness', 'page.ts'), 'utf8');
		const production = readFileSync(
			path.join(REPO, 'src', 'presentation', 'views', 'PlanEditorView.ts'),
			'utf8',
		);

		expect(production).toContain('app.provide(EDITOR_CONTEXT');
		expect(page).toContain('provide(EDITOR_CONTEXT');
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
		if (firstUse >= 0) expect(install).toBeLessThan(firstUse);
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
		const open = index.slice(index.indexOf('async function open'), index.indexOf('onErrorCaptured'));

		expect(open, 'open() never runs').toContain('renderedId.value = null');
		expect(open, 'open() marks the stage ready before nested components load').not.toMatch(
			/renderedId\.value\s*=\s*(?!null)/,
		);
		expect(index).toContain('<Suspense');
		expect(index).toContain('@resolve="renderedId = pendingId"');
	});

	/**
	 * The index's own links have to survive a round trip through the URL, because that is the
	 * path an agent uses: it never clicks, it opens `?entry=` directly. `&` and `#` are legal
	 * in a filename and an id carries the path, so an interpolated link means something other
	 * than the id it names — and the in-page click masks it by passing the object instead.
	 */
	it('builds index links with URLSearchParams rather than interpolating the id', () => {
		const index = readFileSync(path.join(REPO, 'tests', 'harness', 'IndexPage.vue'), 'utf8');

		expect(index).toContain('new URLSearchParams({ entry: entry.id })');
		expect(index, 'a raw ?entry= interpolation is back').not.toContain('`?entry=${');
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
 * would still be a placeholder wherever a mock composes a real component. The `> *` waits out
 * the render tick after that and is belt and braces rather than the primary signal.
 */
const entryStage = (entry) => `.rp-harness-stage[data-entry="${entry}"] > *`;

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
	const readable = entry.replace(/[^a-zA-Z0-9]+/g, '-');
	const digest = createHash('sha1').update(entry).digest('hex').slice(0, 8);
	const fileSafe = `${readable}-${digest}`;

	return [
		{
			name: `entry-${fileSafe}-dark`,
			query: `?entry=${encodeURIComponent(entry)}`,
			selector: entryStage(entry),
		},
		{
			name: `entry-${fileSafe}-light`,
			query: `?entry=${encodeURIComponent(entry)}&theme=light`,
			selector: entryStage(entry),
		},
	];
};
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
command exits 0, and
the command exits 0. Open one — it must show the zone list, not "Pick an entry."

Then prove the failure path, which is the half that matters for an actor that cannot see:

Run: `npm run harness-shot NoSuchEntry`

Expected: non-zero exit, with a timeout reported for both shots. A typo must never write a
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

- [ ] **Step 5: Write the failing test**

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

	it('is template-only before promotion — no script block in the prototypes tree', () => {
		expect(readFileSync(MOCK, 'utf8')).not.toContain('<script');
	});

	it('gains a script block on promotion, which is what promotion IS', () => {
		expect(readFileSync(PROMOTED, 'utf8')).toContain('<script setup lang="ts">');
	});
});
```

- [ ] **Step 6: Run it**

Run: `npx vitest run tests/build/prototype-promotion.test.ts`

Expected: PASS, three tests.

If `leaves the template byte-identical` fails, the two templates differ — most likely by
indentation or a trailing newline. **Do not "fix" it by generating one from the other.** Read the
diff and make the promoted fixture match the mock exactly, because that is what the criterion
claims a promotion does.

- [ ] **Step 7: Prove it can fail, on the thing it is actually guarding**

Temporarily edit the promoted fixture's template — change `<h2>Zones</h2>` to `<h2>Rooms</h2>`,
which is exactly the kind of small redraw a real promotion might slip in.

Run: `npx vitest run tests/build/prototype-promotion.test.ts`

Expected: FAIL on `leaves the template byte-identical`.

This is the assertion the whole tree exists to protect, so it is the one that must be watched
failing. Then revert: `git checkout tests/fixtures/promotion/ZoneSummary.promoted.vue`

- [ ] **Step 8: Prove the tree IS the registration, against the REAL glob**

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
		const onDisk = vueFilesUnder(path.join(REPO, 'src', 'prototypes')).sort();

		// First, because an empty tree would make the equality below `[] === []` — vacuous, and
		// exactly the "only passes while empty" failure the PBI's criterion 9 names.
		expect(onDisk).toContain('ZoneSummary.vue');

		const discovered = prototypeEntries()
			.map((entry) => `${entry.id.replace(/^prototype:/, '')}.vue`)
			.sort();

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

- [ ] **Step 9: Run the full gate**

Run: `npm run check`

Expected: PASS. In particular `analyze` must not report `ZoneSummary.vue` dead — Task 1's fallow entry is what covers it, and this is the first file that proves the glob matches.

- [ ] **Step 10: Commit**

```bash
git add src/prototypes/ZoneSummary.vue tests/fixtures/promotion/ZoneSummary.promoted.vue tests/build/prototype-promotion.test.ts tests/harness/entries.test.ts
git commit -m "Add the first mock, and hold the promotion claim

A promoted mock's template must be byte-identical to the mock's — the
criterion the whole feature is for, since if a template cannot cross that
boundary unchanged the rewrite this replaces has only moved.

The two sides are INDEPENDENT files. An earlier draft composed the
promoted side by interpolating the mock's own template, which compared a
string to itself: it could not fail, and would have stayed green while a
real promotion redrew everything. The promoted fixture is hand-written,
and watched failing on a one-word template edit before being trusted.

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

- [ ] **Step 3: Verify the added link resolves**

Run:

```bash
test -f "docs/requirements/Prototype a screen in the harness before it is built.md" && echo ok
```

Expected: `ok`

- [ ] **Step 4: Run the full gate**

Run: `npm run check`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md docs/user-experience/concepts/README.md
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
| 1 — a file appears with no registration step | 4 (id derivation) + **7 Step 8** (the real glob, against the tree on disk) |
| 2 — no prototype in the built plugin | 2 (`prototypes-not-bundled.test.ts`) |
| 3 — an import from elsewhere fails lint | 1 (`prototypes-one-way-door.test.ts`) |
| 4 — every entry addressable and shootable | 4 (`?entry=`) + 6 (`harness-shot <name>`) |
| 5 — one stylesheet, no second sheet | 5 |
| 6 — a component mounts with no per-entry setup | 3 (`fixture.test.ts`) |
| 7 — two components read the same plan | 3 (second case) |
| 8 — an entry that throws names itself; empty tree still lists | 4 (`IndexPage.vue` failure branch, empty-tree case) |
| 9 — `npm run check` passes with the tree populated | 7 Step 9 |
| 10 — a promoted template is byte-identical | 7 (`prototype-promotion.test.ts`) |

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
4. **Task 1 Step 9 may need reordering.** A fallow `entry` glob matching nothing might itself be an error; if so the declaration moves to Task 7, and Task 1's gate run passes without it.

**Placeholder scan:** every code step carries real code; no "TBD", no "handle errors appropriately", no "similar to Task N".

**Type consistency:** `HarnessEntry` (`id`, `label`, `kind`, `component`) is defined in Task 4 and used unchanged in Tasks 4 and 6. `seedFixture(): Pinia` is defined in Task 3 and called in Task 4 Step 6. `discoverEntries(modules, kind)` keeps one signature across its test and its use. The `id` is the URL and the `harness-shot` argument (`prototype:ZoneSummary`), sanitised only for PNG filenames since Windows forbids `:` there; `label` is the basename shown in the list and is never used as an address — Task 7 Step 3 uses the id, deliberately.

**Task 2's test passes vacuously on an empty tree**, which is why Task 2 Step 4 plants an *unmarked* prototype and imports it: it proves the test fires on a file nobody remembered to flag, which is the only version of that guarantee worth having.

**Revised across eight review rounds — twenty-nine findings, all real, all fixed above rather than noted.**

Round one, on the shape of the harness:

| Finding | What was wrong | Fixed in |
| --- | --- | --- |
| Capture waited on the stage shell | `.rp-harness-stage` exists on first paint, so `harness-shot <name>` could photograph "Pick an entry." and **exit 0** — an empty PNG reported as success, to an actor that cannot see it is empty | Task 4 (`data-entry`) and Task 6 (`[data-entry="…"] > *`, plus a test forbidding the bare class). Round eight found the same defect one level in |
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
component registry, where the second registration silently wins. An ambiguous label is registered
for nobody now, so a designer sees an unresolved tag instead of a component from a directory they
did not choose.

Rounds five and six kept finding the same thing, which is why the pattern below matters more
than any of the fixes:

| Finding | What was wrong | Fixed in |
| --- | --- | --- |
| A test contradicted its own task | Task 6's DOM test asserted the standard-DOM branch **abandoned in round four**. Executed in order it would have failed against Task 4's own code — the plan was unrunnable | Task 6 (asserts ORDER: shim before first use) |
| Sibling mocks were unregistered | A prototype composes the mocks beside it, and a template-only file can import neither a component nor a sibling. `<MockToolbar />` unresolved — half the main flow | Task 4 (both kinds in one registry) |
| `CLAUDE.md` text contradicted the route | Task 8 still said the root is the index after Task 4 made it opt-in | Task 8 |
| **VueKonva was not installed** | `PlanEditorView.ts:158` installs it; the index app did not. Every canvas component leaves `VStage`/`VLayer`/`VLine` unresolved — and Vue **warns rather than throws**, while the outer element still satisfies the shot selector, so `harness-shot` exits 0 on a PNG of a missing canvas | Task 4, with a test that reads the requirement out of production rather than pinning today's answer |
| The fixture check was harness-only | This plan creates `tests/fixtures/promotion/`, which a `/tests/harness/` filter misses. Residue of round four's own promotion fix | Task 2 (nothing under `tests/` at all — a rule, not a list) |
| The promoted template was not byte-identical | The mock's commentary sat *inside* its template block, so the independent pair the previous round introduced could never match. Worse, the comment **spelled the opening template tag**, and `templateBlock()` finds the block by regex — the extraction would have started mid-comment | Task 7: commentary above the template, never naming that tag. Verified by running the test's own regex over both files |

Round seven, on what the tests still did not reach:

| Finding | What was wrong | Fixed in |
| --- | --- | --- |
| **The editor context was not provided** | `PlanEditorView.ts:145-159` does four things to mount the real app — Pinia, VueKonva, `provide(EDITOR_CONTEXT, …)`, mount. The index app did the first two. `useEditorContext()` **throws** on the missing injection (`EditorContext.ts:57-63`), so `PlanEditorRoot`, `BackgroundLayer` and anything using `useThemeTokens` render Task 4's named-failure card instead — the index would fail for exactly the components a designer most wants to look at | Task 3 (`harnessEditorContext()`, built from the exported deps rather than a second set of stubs), Task 4 Step 6 (the provision) and Task 6 (a test reading the requirement out of `PlanEditorView.ts` rather than pinning today's answer) |
| **The stylesheet check required attribute order** | The regex wanted `rel` before `href`. A link written the other way round is the same link to a browser and invisible to the test — so a second sheet could be added in the spelling the check cannot see | Task 5 (two-stage parse: find every `<link>`, then read its attributes in any order; the planted proof is now `href`-first) |
| **The real glob was never driven** | Every discovery case handed `discoverEntries` a hand-built map. If `import.meta.glob`'s pattern stopped matching `src/prototypes/`, discovery would return nothing, no prototype a designer added would ever appear — and all of them stay green. Criterion 1 asks for exactly this case and it was the one not written | Task 7 Step 8: discovery compared against the tree walked with `readdirSync`, watched failing on a deliberately broken glob. It waits for Task 7 because on an empty tree it is `[] === []` |

Round eight, on the paths only the eyeless actor takes:

| Finding | What was wrong | Fixed in |
| --- | --- | --- |
| **Readiness meant the outer module, not the screen** | The same defect as round one's stage-shell race, one level in and invisible to round one's fix. Every component is registered as a `defineAsyncComponent`, so a prototype composing `<StatusBar />` starts loading it only after the outer module renders — and the outer element already satisfies `[data-entry] > *`. `harness-shot` would write a picture of a half-drawn screen and exit 0, on exactly the composition the feature exists for | Task 4: `<Suspense>` sets `renderedId` on `@resolve`, which settles a whole subtree at any depth; `open()` may only ever CLEAR it. Task 6 asserts the negative, because that is where the defect was |
| **Index links interpolated the id** | `&` and `#` are legal in a filename and an id carries the path, so `?entry=${id}` names something other than the id. The in-page click masks it — `@click.prevent` passes the object and never reads the URL back — so it would break only in the path an agent uses, which is the path with no human watching | Task 4 (`URLSearchParams`), Task 6 (a test forbidding the raw interpolation) |
| **The planted fixture did not exist yet** | Task 2 Step 6 planted an import of `tests/harness/fixture.ts`, which **Task 3** creates. Vite stops on an unresolved specifier before Rollup produces a module list, so the step would have failed on the wrong thing and proved nothing | Task 2 Step 6 plants `tests/helpers/planFixtures.ts`, which is in the tree today and is genuinely a fixture. It also sharpens the minification argument: a const holding an object literal can be inlined away entirely |

**The pattern, across all eight rounds and worth more than any individual fix:** every failure was
a **green signal that means nothing** — a config grep for a lint run, a first chunk for a build,
a string compared to itself, a shimmed DOM call that passes in jsdom and throws in a browser, a
glob whose subtree excludes the file that matters, a hand-built map standing in for the glob that
would have to work, a readiness marker that means the outer module rather than the screen, an
unresolved component or a failed injection Vue only warns about.

And the second pattern, which is mine rather than the design's: **every round, a fix left a
sibling stale.** The DOM fix left the toggle. The promotion fixture left the bundle filter. The
routing fix left the `CLAUDE.md` text and the PBI's own assumption. Round seven's glob fix left Task 4's own
header claiming the glob had "nothing to assert about in a unit test", and Task 7's step numbers
already carried two Step 7s. Rounds five onward ended with a *deliberate residue sweep* before
pushing, and it kept catching what the review had not — which is the practice to carry into
execution, not the twenty-nine fixes.