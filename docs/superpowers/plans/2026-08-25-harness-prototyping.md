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

Create `tests/build/prototypes-one-way-door.test.ts`:

```typescript
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO } from '../helpers/oxlint';

/**
 * `src/prototypes/` is a ONE-WAY DOOR: it may import from the rest of `src/`, and nothing
 * may import from it. That is what keeps design scaffolding out of a built plugin at the
 * import rather than only at the bundle, so it holds for code nobody has written yet.
 *
 * Checked against the config rather than by linting a planted file: the ban is expressed as
 * `prototypes` appearing in every layer's forbidden `groups`, and a layer added later that
 * forgets it is exactly the regression this test exists to catch.
 */
const CONFIG = readFileSync(path.join(REPO, 'eslint.config.mjs'), 'utf8');

/** Every layer under `src/` that is NOT prototypes. Each owes a ban. */
const LAYERS = ['core', 'domain', 'application', 'infrastructure', 'presentation', 'plugin'];

describe('the prototypes one-way door', () => {
	it.each(LAYERS)('forbids %s/ from importing src/prototypes/', (layer) => {
		// The `forbidden(...)` call for this layer, up to the closing paren of its groups
		// array — enough to read that layer's own list without matching a neighbour's.
		const call = new RegExp(`forbidden\\(\\s*'${layer}',[\\s\\S]*?groups:\\s*\\[([^\\]]*)\\]`);
		const match = CONFIG.match(call);

		expect(match, `no forbidden(...) call with a groups array for '${layer}'`).not.toBeNull();
		expect(match?.[1]).toContain("'prototypes'");
	});
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/build/prototypes-one-way-door.test.ts`

Expected: FAIL. `core`, `domain`, `application`, `infrastructure` and `presentation` fail on `expect(match?.[1]).toContain("'prototypes'")`; `plugin` fails on `not.toBeNull()` because no `forbidden('plugin', …)` call exists yet.

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

- [ ] **Step 4: Add the missing ban for `plugin/`**

`plugin/` composes every layer, so it has no `forbidden(...)` call today. It still may not import a prototype. Add this immediately after the `forbidden('presentation', …)` call:

```javascript
	forbidden(
		'plugin',
		{ groups: ['prototypes'] },
		'plugin/ composes every layer, which is why it has no other ban — but src/prototypes/ is design scaffolding that must never reach a built plugin, and the composition root is the one place that could pull it in.',
	),
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

Create `tests/build/prototypes-not-bundled.test.ts`:

```typescript
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO } from '../helpers/oxlint';

/**
 * The guarantee with a user on the other end: no mock, prototype or fixture is ever in a
 * built plugin. `tests/build/prototypes-one-way-door.test.ts` refuses the import; this
 * refuses the OUTCOME, against the artifact that actually reaches a vault.
 *
 * Both exist because neither is sufficient. Lint reads static imports and a dynamic
 * specifier slips past it; a bundle scan sees everything and reports only after the fact.
 *
 * **The identifiers are DERIVED from the tree, never a marker each file has to remember.**
 * An opt-in marker only proves the marker is absent: the next prototype nobody marked would
 * ship past a green test, which is the failure this shape exists to prevent. Vue's SFC
 * compiler emits `__name: "<basename>"` for devtools, and a string literal survives
 * minification — so the file names themselves are what the bundle is scanned for.
 *
 * Production builds carry no sourcemap (`vite.config.ts` sets `sourcemap` only in
 * development mode), which is why this reads the bundle text rather than a module graph.
 */
const BUNDLE = path.join(REPO, 'dist', 'main.js');
const PROTOTYPES = path.join(REPO, 'src', 'prototypes');

/** Every `.vue` under `src/prototypes/`, by basename, at any depth. */
function prototypeNames(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		if (entry.isDirectory()) return prototypeNames(path.join(dir, entry.name));
		return entry.name.endsWith('.vue') ? [entry.name.replace(/\.vue$/, '')] : [];
	});
}

/**
 * The fixture's own identifiers. The guarantee names fixtures as well as prototypes, and the
 * fixture lives under `tests/`, which the layer ban does not reach — so it needs its own
 * assertion rather than inheriting one.
 */
const FIXTURE_IDENTIFIERS = ['seedFixture', 'HARNESS_PLAN', 'HARNESS_ZONES'];

describe('the built plugin', () => {
	it('has been built, so this test is asserting on something', () => {
		expect(
			existsSync(BUNDLE),
			'dist/main.js is missing — run `npm run build` before this test, as `npm run check` does',
		).toBe(true);
	});

	it('contains no prototype from the tree', () => {
		const bundle = readFileSync(BUNDLE, 'utf8');
		const names = existsSync(PROTOTYPES) ? prototypeNames(PROTOTYPES) : [];

		// Not an assertion about `names.length`: an empty tree is a legitimate state and this
		// test still has to pass. What must never happen is a name in the tree appearing in
		// the bundle.
		for (const name of names) expect(bundle, `${name}.vue reached the bundle`).not.toContain(name);
	});

	it('contains no harness fixture', () => {
		const bundle = readFileSync(BUNDLE, 'utf8');

		for (const id of FIXTURE_IDENTIFIERS) expect(bundle, `${id} reached the bundle`).not.toContain(id);
	});
});
```

- [ ] **Step 2: Run it and watch the first assertion fail**

Run: `npx vitest run tests/build/prototypes-not-bundled.test.ts`

Expected: FAIL on the first test if `dist/` does not exist. This is the correct failure — it proves the test is asserting on a real artifact rather than passing vacuously.

- [ ] **Step 3: Build, then run it again**

Run: `npm run build && npx vitest run tests/build/prototypes-not-bundled.test.ts`

Expected: PASS, three tests. The tree is empty, so the second test iterates nothing — which is why Step 4 exists.

- [ ] **Step 4: Prove the test can fail — plant a prototype and import it**

This is the step that makes the test worth having. Temporarily create `src/prototypes/Doomed.vue`:

```vue
<template>
	<div>planted</div>
</template>
```

Note it carries no marker of any kind. That is the point: the test derives `Doomed` from the file name, so a prototype nobody thought to mark is caught anyway.

And temporarily add these two lines to the top of `src/main.ts`:

```typescript
import Doomed from './prototypes/Doomed.vue';
console.log(Doomed);
```

The reference is needed because a side-effect-only import of an SFC can be tree-shaken away, which would make the planted defect vanish and teach you nothing.

- [ ] **Step 5: Watch the bundle test go red**

Run: `npm run build && npx vitest run tests/build/prototypes-not-bundled.test.ts`

Expected: FAIL on `contains no prototype from the tree`, with the message `Doomed.vue reached the bundle`.

If it PASSES, the test is worthless and must be fixed before continuing. The likely cause is that `__name` is not emitted in this build configuration — check with `grep -c Doomed dist/main.js`. If the name genuinely does not survive, fall back to asserting on a distinctive string from each prototype's template, extracted by reading the files, and record why in the test's header.

- [ ] **Step 6: Confirm lint refuses the same thing**

Run: `npm run lint`

Expected: FAIL with the `no-restricted-imports` message from Task 1's `forbidden('plugin', …)` call. Both halves of the guarantee are now proven to fire on the same planted defect.

- [ ] **Step 7: Remove the planted files**

```bash
git checkout src/main.ts
rm src/prototypes/Doomed.vue
```

- [ ] **Step 8: Run the full gate**

Run: `npm run check`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add tests/build/prototypes-not-bundled.test.ts
git commit -m "Assert no prototype reaches the built plugin

The backstop the one-way door cannot be: lint reads static imports and a
dynamic specifier slips past it. This asserts against dist/main.js, the
artifact that actually reaches a vault.

Watched failing before being trusted: a planted prototype imported from
main.ts turns this red AND trips the lint ban, so both halves of the
guarantee are known to fire rather than assumed to."
```

---

### Task 3: The seeded fixture

One world every entry mounts against, so what the designer sees is reproducible and two components on a screen agree. It reuses the plan and zones the Plan Editor harness already defines rather than inventing a second set that could disagree.

**Files:**
- Modify: `tests/harness/planEditor.ts:25-95` (export the existing fixtures)
- Create: `tests/harness/fixture.ts`
- Test: `tests/harness/fixture.test.ts`

**Interfaces:**
- Consumes: `HARNESS_PLAN` and `HARNESS_ZONES` from `tests/harness/planEditor.ts`.
- Produces: `seedFixture(): Pinia` from `tests/harness/fixture.ts` — creates a Pinia, makes it active, seeds `useProjectStore` with the harness plan and zones, and returns it. Tasks 4 and 7 call it.

- [ ] **Step 1: Export the existing fixtures**

In `tests/harness/planEditor.ts`, change `const HARNESS_PLAN` (line 25) and `const HARNESS_ZONES` (line ~38) to `export const`. Change nothing else in the file. Add this sentence to the file's header comment, after the "No background document" paragraph:

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
import { seedFixture } from './fixture';
import { HARNESS_PLAN, HARNESS_ZONES } from './planEditor';
import { useProjectStore } from '../../src/presentation/stores/ProjectStore';

/**
 * The one world every index entry mounts against. Two claims worth a test: it is SEEDED
 * (a component reading the store finds a plan, with no per-entry setup), and it is ONE
 * world (two stores created from it agree, which is what makes two components on a
 * prototype consistent).
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
import { HARNESS_PLAN, HARNESS_ZONES } from './planEditor';

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
```

- [ ] **Step 5: Run the test again**

Run: `npx vitest run tests/harness/fixture.test.ts`

Expected: PASS, 2 tests. If `project.status = 'ready'` is a type error, read the `ProjectStoreStatus` union in `src/presentation/stores/ProjectStore.ts` and use the member that means hydrated.

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
- Consumes: `seedFixture()` from Task 3.
- Produces: `type HarnessEntry = { id: string; kind: 'prototype' | 'component'; component: () => Promise<unknown> }` and `discoverEntries(modules: Record<string, () => Promise<unknown>>, kind: HarnessEntry['kind']): HarnessEntry[]` from `tests/harness/entries.ts`. Tasks 5 and 7 use both.

- [ ] **Step 1: Write the failing test**

Create `tests/harness/entries.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { discoverEntries } from './entries';

/**
 * Discovery, tested on the SHAPE `import.meta.glob` returns rather than on the glob itself.
 * The glob is a Vite build-time feature with nothing to assert about in a unit test; what
 * can go wrong and be caught here is the id derivation.
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
		expect(prototype.id).toBe('prototype-StatusBar');
		expect(component.id).toBe('component-editor-shell-StatusBar');
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
 * `discoverEntries` takes the glob RESULT rather than calling `import.meta.glob` itself, so
 * this module is a pure function a node test can drive. The globs live in `IndexPage.vue`,
 * which is the file Vite transforms.
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

	return `${kind}-${relative.split('/').join('-')}`;
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
	return Object.entries(modules)
		.map(([file, component]) => ({
			id: idFor(file, kind),
			label: file.split('/').pop()?.replace(/\.vue$/, '') ?? file,
			kind,
			component,
		}))
		.sort((left, right) => left.id.localeCompare(right.id));
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
 * The two globs are here rather than in `entries.ts` because `import.meta.glob` is resolved
 * by Vite at build time and needs a literal it can see — so the file that owns the literals
 * is the file Vite transforms, and the id derivation stays a pure function a node test can
 * drive.
 *
 * `eager: false` on both: the index lists far more than it draws, and eagerly importing
 * every component would mount the whole plugin's presentation layer to render a list of
 * links.
 *
 * TWO failure paths, not one. A module that fails to IMPORT rejects the promise and is
 * caught below; a module that imports fine but throws in `setup()` or `render()` fails
 * later, inside Vue's render cycle, where a try/catch around the import cannot see it.
 * `onErrorCaptured` is what covers the second, and without it criterion 8 holds only for
 * half the ways an entry can fail — the half that is easier to cause deliberately and rarer
 * in practice.
 */
import { computed, onErrorCaptured, ref, shallowRef } from 'vue';
import { discoverEntries, type HarnessEntry } from './entries';

const prototypes = discoverEntries(
	import.meta.glob('../../src/prototypes/**/*.vue') as Record<string, () => Promise<unknown>>,
	'prototype',
);
const components = discoverEntries(
	import.meta.glob('../../src/presentation/**/*.vue') as Record<string, () => Promise<unknown>>,
	'component',
);

const all = computed<HarnessEntry[]>(() => [...prototypes, ...components]);

const requested = new URLSearchParams(window.location.search).get('entry');
const openComponent = shallowRef<unknown>(null);
const failure = ref<string | null>(null);
/**
 * The id of what is actually RENDERED — null until a component is on screen, and null again
 * the moment one fails. The stage exposes it as `data-entry`, which is what
 * `scripts/harness-shot.mjs` waits for.
 *
 * It is deliberately not `requested`: the stage element exists from the first paint, so a
 * capture waiting on the stage alone would photograph "Pick an entry." and exit 0. An empty
 * screenshot reported as a success is the worst outcome this whole feature can produce,
 * because the actor it is built for cannot see that it is empty.
 */
const renderedId = ref<string | null>(null);

async function open(entry: HarnessEntry): Promise<void> {
	failure.value = null;
	renderedId.value = null;
	try {
		const module = (await entry.component()) as { default: unknown };

		openComponent.value = module.default;
		// Set only after the component is assigned. It is still a tick before Vue has
		// rendered it, which `harness-shot` covers by also waiting for the stage to have a
		// child element.
		renderedId.value = entry.id;
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
	const id = renderedId.value ?? requested ?? 'the entry';

	openComponent.value = null;
	renderedId.value = null;
	failure.value = `${id} failed to render: ${error instanceof Error ? error.message : String(error)}`;
	return false;
});

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
					<a :href="`?entry=${entry.id}`" @click.prevent="open(entry)">{{ entry.label }}</a>
					<span>{{ entry.kind }}</span>
				</li>
			</ul>
		</nav>
		<main class="rp-harness-stage" :data-entry="renderedId ?? undefined">
			<p v-if="failure" role="alert" class="rp-harness-failure">{{ failure }}</p>
			<component :is="openComponent" v-else-if="openComponent" />
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
import { createApp } from 'vue';
import { mountHarness } from './mount';
import { mountPlanEditorHarness } from './planEditor';
import { seedFixture } from './fixture';
import IndexPage from './IndexPage.vue';
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
	document.body.empty();

	const root = document.body.createDiv('rp-harness-leaf');

	createApp(IndexPage).use(seedFixture()).mount(root);
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

The globs live in the SFC because import.meta.glob needs a literal Vite
can see; the id derivation is a pure function so a node test can drive
it. A failed mount names itself rather than blanking the stage, because
a gap reads as a layout decision."
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
		const sheets = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)].map((match) => match[1]);

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

Temporarily add to `tests/harness/index.html`, after the `/styles.css` link:

```html
		<link rel="stylesheet" href="../../docs/user-experience/concepts/concept.css" />
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

- [ ] **Step 2: Run it and watch the first case fail**

Run: `npx vitest run tests/build/harness-shot.test.ts`

Expected: FAIL on `captures a named entry` — neither `process.argv` nor `?entry=` appears in the script. The second case PASSES already, which is its job: it pins the existing behaviour so Step 3 cannot quietly replace it.

- [ ] **Step 3: Add the entry shots, waiting on the ENTRY rather than the shell**

In `scripts/harness-shot.mjs`, after the `SHOTS` array (line ~47), add:

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
 * `IndexPage.vue` sets `data-entry` only once the component is assigned, and the `> *` is what
 * waits out the render tick after it.
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
const entryShots = (entry) => [
	{
		name: `entry-${entry}-dark`,
		query: `?entry=${encodeURIComponent(entry)}`,
		selector: entryStage(entry),
	},
	{
		name: `entry-${entry}-light`,
		query: `?entry=${encodeURIComponent(entry)}&theme=light`,
		selector: entryStage(entry),
	},
];
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

**Interfaces:**
- Consumes: `src/prototypes/` from Task 1, the index from Task 4.
- Produces: the first real entry in the prototypes tree.

- [ ] **Step 1: Write the first mock**

Create `src/prototypes/ZoneSummary.vue`:

```vue
<template>
	<!--
		A template-only SFC: pure HTML to write, and already a real Vue component. Promotion
		adds a `<script setup>` above this block and moves the file into `src/presentation/`;
		this markup goes across unchanged, which is what
		`tests/build/prototype-promotion.test.ts` holds.

		Nothing here marks the file as a prototype, deliberately.
		`tests/build/prototypes-not-bundled.test.ts` derives what to scan for from the tree
		itself, so a mock nobody remembered to mark is caught anyway — which is the only
		version of that guarantee worth having.
	-->
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

Run: `npm run harness-shot prototype-ZoneSummary`

Note the argument is the **id**, not the basename — ids are qualified by kind so a mock and the
component it stands in for are both reachable (`entries.ts`). The index shows the label; the URL
and this command take the id.

Expected: `harness-shots/entry-prototype-ZoneSummary-dark.png` and `-light.png` are written, and
the command exits 0. Open one — it must show the zone list, not "Pick an entry."

Then prove the failure path, which is the half that matters for an actor that cannot see:

Run: `npm run harness-shot NoSuchEntry`

Expected: non-zero exit, with a timeout reported for both shots. A typo must never write a
picture of the index and call it success.

- [ ] **Step 4: Write the failing promotion test**

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
 * Checked by simulating the promotion rather than by waiting for a real one: the template
 * block is extracted from the mock, a promoted file is composed from it in memory, and the
 * template extracted back out has to be identical. That makes the claim testable today,
 * with no promoted component in the tree yet.
 */
const MOCK = path.join(REPO, 'src', 'prototypes', 'ZoneSummary.vue');

/** The `<template>` block, with its delimiters, or null when there is none. */
function templateBlock(sfc: string): string | null {
	const match = sfc.match(/<template>[\s\S]*<\/template>/);

	return match ? match[0] : null;
}

describe('promoting a mock', () => {
	it('leaves the template byte-identical', () => {
		const mock = readFileSync(MOCK, 'utf8');
		const before = templateBlock(mock);

		expect(before, 'the mock has no <template> block').not.toBeNull();

		// What promotion does: a script block above, the same template below.
		const promoted = `<script setup lang="ts">\nimport { computed } from 'vue';\n</script>\n\n${before}\n`;

		expect(templateBlock(promoted)).toBe(before);
	});

	it('is template-only before promotion — no script block in the prototypes tree', () => {
		expect(readFileSync(MOCK, 'utf8')).not.toContain('<script');
	});
});
```

- [ ] **Step 5: Run it**

Run: `npx vitest run tests/build/prototype-promotion.test.ts`

Expected: PASS, 2 tests.

- [ ] **Step 6: Prove the third case can fail**

Temporarily add a script block to the top of `src/prototypes/ZoneSummary.vue`:

```vue
<script setup lang="ts"></script>
```

Run: `npx vitest run tests/build/prototype-promotion.test.ts`

Expected: FAIL on `is template-only before promotion`. Then revert: `git checkout src/prototypes/ZoneSummary.vue`

- [ ] **Step 7: Run the full gate**

Run: `npm run check`

Expected: PASS. In particular `analyze` must not report `ZoneSummary.vue` dead — Task 1's fallow entry is what covers it, and this is the first file that proves the glob matches.

- [ ] **Step 8: Commit**

```bash
git add src/prototypes/ZoneSummary.vue tests/build/prototype-promotion.test.ts
git commit -m "Add the first mock, and hold the promotion claim

A promoted mock's template must be byte-identical to the mock's — the
criterion the whole feature is for, since if a template cannot cross that
boundary unchanged the rewrite this replaces has only moved.

Simulated rather than waited for: the template is extracted, a promoted
file composed from it in memory, and the template extracted back out
compared. Testable today, with nothing promoted yet.

This is also the first file proving the fallow glob matches and the
harness-shot entry path writes a PNG."
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
  Its ROOT is now an index of every prototype and every real component, discovered from the
  tree with `import.meta.glob` so a saved file needs no registration. `?entry=<name>` opens
  one, `npm run harness-shot <name>` captures it in both schemes, and `?view=` keeps the two
  original surfaces. Mocks live in `src/prototypes/` as template-only SFCs — pure HTML to
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
| 1 — a file appears with no registration step | 4 (`entries.test.ts`) |
| 2 — no prototype in the built plugin | 2 (`prototypes-not-bundled.test.ts`) |
| 3 — an import from elsewhere fails lint | 1 (`prototypes-one-way-door.test.ts`) |
| 4 — every entry addressable and shootable | 4 (`?entry=`) + 6 (`harness-shot <name>`) |
| 5 — one stylesheet, no second sheet | 5 |
| 6 — a component mounts with no per-entry setup | 3 (`fixture.test.ts`) |
| 7 — two components read the same plan | 3 (second case) |
| 8 — an entry that throws names itself; empty tree still lists | 4 (`IndexPage.vue` failure branch, empty-tree case) |
| 9 — `npm run check` passes with the tree populated | 7 Step 7 |
| 10 — a promoted template is byte-identical | 7 (`prototype-promotion.test.ts`) |

The PBI's extensions map too: **2a** → Task 4 Step 5's `failure` branch; **4a** → Task 4's empty-tree test and the `v-if` in the template; **4b** → Vite's own overlay, unchanged, plus the try/catch; **3a** → Task 6 leaves an argumentless run intact so a machine without Chromium fails on `resolveChromiumExecutable` as it does today. **6a** is out of scope by the PBI's own text.

**Known gaps, stated rather than hidden:**

1. **Criterion 8's "names itself" is tested by construction, not by a driven failure.** Task 4 writes the branch and Task 7 does not plant a throwing prototype to watch it fire. Add that if a reviewer wants the branch proven — it would be a fourth case in `entries.test.ts` mounting a module whose import rejects.
2. **The fixture assigns store state directly** rather than going through `hydrate`, because hydration takes query services this page cannot answer. If `ProjectStore`'s refs turn out not to be writable from outside, Task 3 Step 4 needs a store action instead, and that is a change to `src/presentation/stores/ProjectStore.ts` this plan does not currently touch.
3. **Task 1 Step 9 may need reordering.** A fallow `entry` glob matching nothing might itself be an error; if so the declaration moves to Task 7, and Task 1's gate run passes without it.

**Placeholder scan:** every code step carries real code; no "TBD", no "handle errors appropriately", no "similar to Task N".

**Type consistency:** `HarnessEntry` (`id`, `label`, `kind`, `component`) is defined in Task 4 and used unchanged in Tasks 4 and 6. `seedFixture(): Pinia` is defined in Task 3 and called in Task 4 Step 6. `discoverEntries(modules, kind)` keeps one signature across its test and its use. The `id` is the URL and the `harness-shot` argument (`prototype-ZoneSummary`); `label` is the basename shown in the list and is never used as an address — Task 7 Step 3 uses the id, deliberately.

**Task 2's test passes vacuously on an empty tree**, which is why Task 2 Step 4 plants an *unmarked* prototype and imports it: it proves the test fires on a file nobody remembered to flag, which is the only version of that guarantee worth having.

**Revision after review.** Five findings on the first draft, all real, all fixed above rather than noted:

| Finding | What was wrong | Where it is fixed |
| --- | --- | --- |
| Capture waited on the stage shell | `.rp-harness-stage` exists on first paint, so `harness-shot <name>` could photograph "Pick an entry." and **exit 0** — an empty PNG reported as a success, to an actor that cannot see it is empty | Task 4 (`data-entry`, set only once the component is assigned) and Task 6 (`[data-entry="…"] > *`, plus a test forbidding the bare class as a wait target) |
| The argumentless run broke | Routing "no `view` parameter → index" sent the three fixed shots (`''`, `?theme=light`, `?phone`) to the index, where they would time out — while Task 6's test asserting the shots still exist kept passing | Task 4 Step 6: the index is opt-in (`?index` or `?entry=`), and Task 6 gains a test pinning that from the other side |
| Render errors escaped the catch | `try/catch` around the dynamic import cannot see a throw from `setup()` or `render()`, so criterion 8 held for only half the ways an entry fails | Task 4: `onErrorCaptured` returning `false` |
| The bundle test was opt-in | Scanning for a marker proves only the marker is absent; the next unmarked prototype ships past a green test, and the fixture had no marker at all despite the guarantee naming fixtures | Task 2: identifiers derived from the tree and from the fixture's own exports; the marker is gone from the plan entirely |
| Ids could collide | A basename id makes a mock and the component it stands in for the same URL — the likely case, not the exotic one — leaving the second unreachable and uncapturable, silently | Task 4: ids qualified by kind and relative path, with `label` split off for display |

Two of those were P1s that would have cost an implementer a debugging session each, and both are the same shape as the defect this plan's own subject exists to prevent: a green signal that means nothing.
