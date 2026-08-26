# Design Slice 14 — Empty States — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give both central views an actionable empty state (PRD §94), so a vault with no
projects and a plan with no background or no zones each say what to do next instead of
drawing a blank pane.

**Architecture:** One reusable `EmptyState.vue` that takes resolved strings and knows nothing
about i18n, a typed registry mapping each empty condition to `StringKey`s, and two pure
selectors over already-succeeded query results. The Renovation Project view gains its first
data dependency (`ListProjects` + a store). In the Plan Editor the empty state is an
**overlay inside a still-mounted `PlanCanvas`**, not a replacement for it.

**Tech Stack:** TypeScript, Vue 3 (`<script setup>`), Pinia, Vitest + `@vue/test-utils`
(jsdom per file), axe-core, `npm run harness` / `npm run harness-shot` for looking at it.

**Spec:** [`docs/tasks/14-empty-states.md`](../../tasks/14-empty-states.md) — read it first.
Task 1 amends it; every later task argues from the amended text.

## Why this slice, now

Design slice 11 is in flight in the worktree `C:\Projects\renovation-planner-worktrees\slice-11-error-handling`
(branch `feat/slice-11-error-handling-diagnostics`, 79 files changed against `main`).
Slice 14 `dependsOn` slice 05 alone and was chosen over the two other formally-unblocked
slices for conflict surface:

- **Slice 18** rewrites `NoteVaultDeps`, all five Obsidian repositories, `buildProjectIndexEntries`,
  `MigrationRunner`, `settings.ts` and `composition-root.ts` — very nearly slice 11's own file set.
- **Slice 12** is the harness that verifies slice 11's rules, by slice 11's own out-of-scope
  list, and edits `vitest.config.ts` which slice 11 is ratcheting.

Slice 14 edits exactly four files slice 11 also edits, and every one additively:
`i18n/locales/en.ts`, `i18n/locales/de.ts` (one key each), `plugin/composition-root.ts`
(one field), `presentation/stores/ProjectStore.ts` (one getter).

## Global Constraints

- **`npm run check` is the definition of done** — build, lint (oxlint then ESLint), coverage-thresholded tests, fallow. All four, before every commit.
- **Coverage floors are 99/99/99/98** (statements/functions/lines/branches) against a measured 99.27/99.04/99.51/**98.02**. That is ~0.02 of branch headroom where one uncovered branch costs ~0.05. **Every new branch gets its test in the same commit.** This is arithmetic, not style.
- **No user-facing literal.** Every string goes through `t(language, key)` / `tr(key)` with a `StringKey` declared in `src/presentation/i18n/locales/en.ts`. `tests/presentation/i18n/strings.test.ts` requires `de.ts` to answer every key `en.ts` declares.
- **`en.ts` is sentence-case and linted** by `eslint-plugin-obsidianmd`. `de.ts` is exempt (German noun capitalization).
- **No `<style>` block anywhere in `src/presentation/`** — `vue/no-restricted-block` fails one. CSS lives in `styles/` partials, each imported from `styles/index.css`, under 400 lines, with **no hard-coded colour** (SDD §84 — use Obsidian variables; the check runs on lightningcss's parsed tree and sees bare colour words too).
- **Layers:** `presentation → application → domain → core`. `presentation/emptyStates/` must not import `infrastructure/` or `plugin/`. Enforced by `no-restricted-imports` in `eslint.config.mjs`.
- **Tab indentation.** Vue templates obey `vue/html-indent` and `vue/singleline-html-element-content-newline`; both are auto-fixable with `npx eslint --fix <file>`. The edit-loop hook (`scripts/lint-edited.mjs`) runs full ESLint on every `.vue` write, so an SFC comes back linted.
- **`src/prototypes/` is importable by NOTHING.** A mock destined for promotion declares its CSS in a `styles/` partial (which ships and travels), never in a `<style scoped>` block (which does neither).
- **Headings are `<h2>`** — the established top level (`InspectorPanel.vue:77`, `LayersPanel.vue:42`, every dialog). An `<h1>` or `<h3>` here would trip axe's `heading-order`.
- **Commit messages end with:** `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`

## The four decisions this plan encodes

Settled with the product owner on 2026-08-26, before any code:

1. **`noProjects` ships with no action button.** Its hand-off (a project-creation modal) is slice 16's, and slice 16 `dependsOn` slice 11. `actionLabel` is optional in the registry exactly for this.
2. **`PlanCanvas` always mounts once `status === 'ready'`.** Both Plan Editor empty states are **overlays inside** it.
3. **An overlay hides while any tool is active** (`runtime.activeToolId !== null`). One rule, no per-key branching.
4. **The selectors stay pure `(plan, zones) → key | null`.** The tool-active gate is a rendering concern in the component, not an input to the selector.

### Why decisions 2 and 3, in one paragraph

The spec's original `<PlanCanvas v-else />` — empty state *replacing* the canvas — is a shipped
regression, for two reasons found by reading the code rather than the document:

- **`create-sample-project` seeds a plan with no background and five zones** (`src/plugin/sampleProject.ts:143`), then opens the editor on it. It is the only way zones exist in a vault today. Replace the canvas on `background === null` and that command's entire output becomes unreachable: five zones drawn, an empty state over them saying "no plan yet".
- **The browser harness refuses a background on the record.** `tests/harness/planEditor.ts`: *"**No background document**, deliberately. The harness has no vault, so a background would have to come from a committed binary or from a data URI built on the page — and the second is a model of the base64 embedding §55 forbids, sitting right next to the code that must never do it."* Replacement would make `?view=plan-editor` and both plan-editor `harness-shot` captures show an empty state instead of the scene — losing the only place the Konva layers can be looked at.

Secondary but real: all three fixtures carry `background: null`
(`tests/helpers/planFixtures.ts:18`, `tests/helpers/planEditorRig.ts:51`,
`tests/harness/planEditor.ts:42`) and 13 test files assert on `.rp-plan-canvas`,
`canvasEl` or `.stage`. The overlay decision costs **zero** fixture churn.

## File Structure

**Created:**

| Path | Responsibility |
| --- | --- |
| `src/prototypes/EmptyState.vue` | The mock, drawn and judged in the harness before promotion. Moved in Task 5 when the real component lands. |
| `styles/empty-state.css` | Every class both the mock and the promoted component use. Declared here from the start so promotion is a pure move. |
| `src/presentation/emptyStates/selectors.ts` | The two pure selectors. No DOM, no Obsidian, no store. |
| `src/presentation/emptyStates/content.ts` | `EMPTY_STATE_CONTENT` — `StringKey`s only, never copy. |
| `src/presentation/emptyStates/resolve.ts` | `resolveEmptyState` — maps one registry entry's keys through `tr()` into `EmptyStateProps`. The one place a key becomes a string. |
| `src/presentation/components/EmptyState.vue` | The component. Resolved strings in, one `action` event out. |
| `src/presentation/read-models/renovationProjectQueries.ts` | The project view's read bundle, mirroring `planEditorQueries.ts`. |
| `src/presentation/views/RenovationProjectContext.ts` | The injection key and `useRenovationProjectContext()`, mirroring `PlanEditorContext.ts`. |
| `src/presentation/stores/RenovationProjectStore.ts` | The project view's first store: the `ListProjects` result plus a load status. |
| `src/application/queries/ListProjects.ts` | Wraps `ProjectRepository.listAll()`. Same shape as `ListAssets`. |
| `tests/presentation/emptyStates/selectors.test.ts` | Node. The selectors' full input/output table. |
| `tests/presentation/emptyStates/content.test.ts` | Node. Registry ↔ locale agreement, and the distinctness of the two Plan Editor entries. |
| `tests/presentation/components/emptyState.test.ts` | jsdom. The component contract. |
| `tests/presentation/editor/emptyStateOverlay.test.ts` | jsdom. The overlay's rendering cases against the real editor tree. |
| `tests/application/queries/listProjects.test.ts` | Node. The query against `InMemoryProjectRepository`. |
| `tests/presentation/views/renovationProjectEmptyState.test.ts` | jsdom. The project view's empty state, and that a failed read renders none. |

**Modified:**

| Path | Change |
| --- | --- |
| `docs/tasks/14-empty-states.md` | The four decisions, and three corrections to its PRD citations. |
| `styles/index.css` | One `@import`. |
| `src/presentation/i18n/locales/en.ts` | Eight keys. |
| `src/presentation/i18n/locales/de.ts` | The same eight, translated. |
| `src/presentation/editor/PlanCanvas.vue` | A default `<slot />` inside `.rp-plan-canvas`. |
| `src/presentation/editor/PlanEditorRoot.vue` | Keep `provideEditorRuntime`'s return; render the overlay into the canvas slot. |
| `src/presentation/stores/ProjectStore.ts` | One computed getter, `emptyStateKey`. |
| `src/presentation/views/RenovationProjectView.ts` | A `RenovationProjectDeps` constructor parameter, provided on the app. |
| `src/presentation/views/ViewRoot.vue` | Hydrate the store on mount; render the empty state. |
| `src/plugin/composition-root.ts` | `listProjects` on `PersistenceServices`; a `renovationProjectDeps()` bundle beside `planEditorDeps()`. |
| `src/plugin/RenovationPlannerPlugin.ts` | Resolve the view's deps per factory call. |
| `tests/helpers/makeRenovationProjectView.ts` | The one `new RenovationProjectView(...)` call site takes the new parameter. |
| `tests/harness/mount.ts` | Follows `makeView`'s new signature. |
| `tests/presentation/views/viewRoot.test.ts` | `ViewRoot` now needs the injected context. |
| `CLAUDE.md` | The slice-14 section. |

---

## Task 1: Amend the spec

Nothing is built from a document that contradicts what we decided. This task is docs only.

**Files:**
- Modify: `docs/tasks/14-empty-states.md`

**Interfaces:**
- Consumes: nothing.
- Produces: the amended spec every later task cites. No code.

- [ ] **Step 1: Add an amendment section immediately before `## Design`**

Insert this verbatim:

```markdown
### Amended 2026-08-26, before implementation

Four decisions taken with the product owner. Where they disagree with the text below,
these win and the text below is the bug.

1. **`noProjects` ships with NO action button.** Its hand-off is slice 16's
   project-creation form, and slice 16 `dependsOn` slice 11. `actionLabel` is optional in
   `EmptyStateContent` precisely so a state can ship without one; Design §6's illustrative
   `@action="openCreateProjectModal()"` has no target yet and is not wired.
2. **`PlanCanvas` always mounts once `ProjectStore.status === 'ready'`.** Both Plan Editor
   empty states render as OVERLAYS inside it. Design §6's `<PlanCanvas v-else />` is
   withdrawn.
3. **An overlay hides while any tool is active** (`EditorRuntime.activeToolId !== null`).
   One rule for both keys, no per-key branching.
4. **The selectors stay pure `(plan, zones) -> key | null`.** The tool-active gate is a
   rendering concern in the component; it is not an input to the selector, and the
   Interfaces & Contracts signatures below are unchanged.

**Why 2 and 3, because "the empty state replaces the canvas" reads as obviously right and
is not.** Two things in the code refuse it:

- `create-sample-project` seeds a plan with **no background** and five zones
  (`src/plugin/sampleProject.ts`), then opens the editor on it — the only way zones exist
  in a vault today. Replacing the canvas on `background === null` makes that command's
  whole output unreachable: five zones drawn, and an empty state over them telling the
  user to import a plan.
- `tests/harness/planEditor.ts` refuses a background ON THE RECORD, on SDD §55 grounds:
  the harness has no vault, so a background would have to be a committed binary or a
  page-built data URI, and the second models the base64 embedding §55 forbids. So
  replacement would make `?view=plan-editor` and both plan-editor `harness-shot` captures
  draw an empty state instead of the scene — losing the only place the Konva layers can be
  looked at at all.

A blank canvas under an overlay still satisfies PRD §94: the overlay is what carries the
guidance, and §94 asks for an actionable empty state, not for a replaced region.

**Three citation corrections, since this document's own references were checked while
amending it:**

- PRD §94 is **one sentence** ("Every central view should provide actionable empty
  states.") and carries **no worked example**. Design §2's comment claiming
  `"Noch kein Plan vorhanden…"` as "PRD §94's own worked example" is wrong in both
  directions: the German is not quoted from anywhere, and it is ours to write. `de.ts`
  gets a translation like every other key.
- The `noBackground`-before-`noZones` precedence is correctly grounded: PRD §93
  (Installation & Onboarding) does draw `Create Renovation Project -> Choose Project
  Folder -> Import First Plan -> Calibrate`.
- The ordered list this document attributes to §93's "onboarding order" as
  `Import Plan -> Calibrate -> Create Zone` is PRD **§52** (Product Success Criteria),
  items 2-4. Both sections support the precedence; only §93 is about onboarding.
```

- [ ] **Step 2: Rewrite Design §6's Plan Editor code block**

Replace the second illustrative block under `### 6. Action wiring` with a block showing the
canvas always mounted and the empty state in its default slot:

```text
<PlanCanvas :tokens="tokens" @background-status="...">
    <EmptyState v-if="overlay !== null" v-bind="overlay" @action="onEmptyStateAction()" />
</PlanCanvas>
```

- [ ] **Step 3: Amend Definition of Done items 1, 5 and 7**

In item 1, change the parenthetical's opening from `(headline/body always render;` to
`(headline renders as an <h2>; body always renders;` and leave the rest. Replace item 5
wholly with:

```markdown
5. `PlanCanvas` mounts whenever `ProjectStore.status === 'ready'`, regardless of empty
   state — asserted directly, because this is the claim the sample project and the browser
   harness both depend on. The Plan Editor renders a `planEditor.noBackground` OVERLAY over
   it when the open Plan's `background` is `null`, a `planEditor.noZones` overlay when it is
   set but `FindZonesByPlan` returns `[]`, neither when both are populated, and neither
   while `activeToolId !== null`. No change to the five-region shell layout.
```

Replace item 7 wholly with:

```markdown
7. Each action that IS wired invokes exactly the one hand-off named in Design §6, and no
   second independently-implemented path to the same effect exists. `noProjects` is wired
   to nothing and renders no button (amendment 1), so it has no hand-off to check.
```

- [ ] **Step 4: Verify the document has no contradiction left**

Run: `grep -n "PlanCanvas v-else\|openCreateProjectModal" docs/tasks/14-empty-states.md`
Expected: matches only inside the amendment section's own quoted withdrawal, nowhere else.

- [ ] **Step 5: Commit**

```bash
git add docs/tasks/14-empty-states.md docs/superpowers/plans/2026-08-26-slice-14-empty-states.md
git commit -m "docs: amend slice 14 for the overlay decision and fix its PRD citations

The canvas stays mounted and the empty states become overlays: replacing the
region makes create-sample-project's output unreachable (no background, five
zones) and makes the browser harness draw an empty state where the Konva scene
should be, which its own docblock refuses a background on SDD 55 grounds.

noProjects ships without an action button, since its hand-off is slice 16's and
slice 16 depends on slice 11.

Also: PRD 94 is one sentence and carries no worked example, so the German copy
is ours to write rather than a quotation.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Draw the mock in the harness, and look at it

The project's own requirement (`docs/requirements/Prototype a screen in the harness before it
is built.md`) makes a mock the first step for a screen. The mock is a real Vue component the
harness mounts, and **promotion moves the file** — the markup is never redrawn, which is why
it is written to `src/`'s Vue lint rules and why its CSS goes straight into a `styles/`
partial.

**Files:**
- Create: `src/prototypes/EmptyState.vue`
- Create: `styles/empty-state.css`
- Modify: `styles/index.css`

**Interfaces:**
- Consumes: nothing.
- Produces: the exact template block Task 5 moves into `src/presentation/components/EmptyState.vue`, and the class names `styles/empty-state.css` declares: `rp-empty-state`, `rp-empty-state--overlay`, `rp-empty-state__panel`, `rp-empty-state__icon`, `rp-empty-state__headline`, `rp-empty-state__body`, `rp-empty-state__action`.

- [ ] **Step 1: Write the stylesheet partial**

Create `styles/empty-state.css`. Every colour is an Obsidian variable — the build fails on a
hard-coded one, including a bare word like `red`.

```css
/*
 * The empty state (design slice 14, PRD §94): one panel, used two ways.
 *
 * `.rp-empty-state` on its own is the BLOCK form — the Renovation Project view, where the
 * empty state is the whole pane. `--overlay` adds the positioning that puts the same panel
 * over a live Konva canvas, which is what the Plan Editor uses: the canvas is always
 * mounted (see the slice's amendment), so the panel floats and the stage keeps its pointer
 * gestures.
 *
 * `pointer-events` is the load-bearing pair. The overlay's own box must not swallow a pan,
 * a zoom or a click on a zone, so it is `none` there and re-enabled on the one child that
 * has to be pressable. Setting it on `.rp-empty-state__panel` instead would make the whole
 * card a pointer trap over a canvas the user is trying to draw on.
 */
.rp-empty-state {
	display: flex;
	flex: 1;
	align-items: center;
	justify-content: center;
	min-width: 0;
	padding: var(--size-4-4);
}

.rp-empty-state--overlay {
	position: absolute;
	inset: 0;
	flex: 0 1 auto;
	pointer-events: none;
}

.rp-empty-state__panel {
	display: flex;
	flex-direction: column;
	gap: var(--size-4-2);
	align-items: center;
	max-width: 28em;
	padding: var(--size-4-4);
	border: 1px solid var(--background-modifier-border);
	border-radius: var(--radius-m);
	background-color: var(--background-secondary);
	text-align: center;
}

.rp-empty-state__icon:empty {
	display: none;
}

.rp-empty-state__headline {
	margin: 0;
	color: var(--text-normal);
	font-size: var(--font-ui-large);
	font-weight: var(--font-semibold);
}

.rp-empty-state__body {
	margin: 0;
	color: var(--text-muted);
	font-size: var(--font-ui-small);
	line-height: var(--line-height-tight);
}

.rp-empty-state__action {
	/* Re-enabled against `--overlay`'s `none`, so the one control a user must be able to
	   press is pressable while the canvas underneath keeps every other gesture. */
	pointer-events: auto;
}
```

- [ ] **Step 2: Import it from the sheet entry**

Add to `styles/index.css`, after the `zone-panel.css` line — the order is not load-bearing
here, and nothing in this partial competes on specificity with another:

```css
@import "./empty-state.css";
```

- [ ] **Step 3: Write the mock**

Create `src/prototypes/EmptyState.vue`. Note where the commentary lives: **above** the
template, never inside it, and it must not spell the opening template tag —
`tests/build/prototype-promotion.test.ts`'s header records both traps.

```vue
<!--
	The empty state, drawn before it is built (design slice 14, PRD §94).

	Scripted rather than template-only, because promotion is then a plain file move: every
	shipped component has a script block, and this one needs props and a conditional button
	the moment it is more than a picture. The props here are the real contract — RESOLVED
	strings, never i18n keys, so the component stays reusable by a future Budget or Schedule
	view that has its copy from somewhere else.

	Two forms, one panel: block for a whole pane, `--overlay` for the Plan Editor, where the
	canvas stays mounted underneath. `styles/empty-state.css` carries both and ships, which
	is why there is no style block here — a scoped block would neither ship nor travel at
	promotion, and this file is written to be moved.

	The defaults below are what the index renders it with; the real caller passes props.
-->
<script setup lang="ts">
withDefaults(
	defineProps<{
		headline?: string;
		body?: string;
		actionLabel?: string;
		overlay?: boolean;
	}>(),
	{
		headline: 'No zones yet',
		body: 'Draw the first zone on this plan to start measuring areas and costs.',
		actionLabel: 'Draw a zone',
		overlay: false,
	},
);
</script>

<template>
	<div
		class="rp-empty-state"
		:class="{ 'rp-empty-state--overlay': overlay }"
	>
		<div class="rp-empty-state__panel">
			<div class="rp-empty-state__icon">
				<slot name="icon" />
			</div>
			<h2 class="rp-empty-state__headline">
				{{ headline }}
			</h2>
			<p class="rp-empty-state__body">
				{{ body }}
			</p>
			<button
				v-if="actionLabel !== undefined"
				type="button"
				class="rp-empty-state__action"
			>
				{{ actionLabel }}
			</button>
		</div>
	</div>
</template>
```

- [ ] **Step 4: Lint the mock, since the hook only reports and does not block**

Run: `npx eslint --fix src/prototypes/EmptyState.vue && npx eslint src/prototypes/EmptyState.vue`
Expected: no output. `vue/html-indent` and `vue/singleline-html-element-content-newline` are
both auto-fixable, so the `--fix` settles them without reading a rule.

- [ ] **Step 5: Check the classes and the variables**

Run: `npx vitest run tests/build/prototype-styles.test.ts tests/build/styles.test.ts tests/harness/cssVars.test.ts`
Expected: PASS, three suites, each refusing something different:

- `prototype-styles` — a class named in the template and declared in neither the mock nor the assembled sheet. This is what caught `rp-wp-state-word` in an hour-old mock.
- `styles` — an unimported partial, a line the assembler cannot resolve, the 400-line cap, and a hard-coded colour at any nesting depth.
- `cssVars` — a `var(--x)` no linked sheet declares. Every variable in the partial above is already in the sheet's vocabulary (`--background-modifier-border`, `--background-secondary`, `--font-semibold`, `--font-ui-large`, `--font-ui-small`, `--line-height-tight`, `--radius-m`, `--size-4-2`, `--size-4-4`, `--text-muted`, `--text-normal`), so this should pass on the first run — it is here to catch the next variable somebody reaches for, since one that resolves to nothing draws a box with no padding and a screenshot of it looks deliberate.

- [ ] **Step 6: Capture it and LOOK at the PNG**

```bash
npm run harness-shot prototype:EmptyState
npm run harness-shot prototype:EmptyState -- --width=460
```

Read the PNGs in `harness-shots/` by eye, in both colour schemes and at the narrow width.
This is the only instrument in this repository that reaches spacing, wrapping and overflow —
jsdom lays nothing out. The known trap on this exact surface: Vue's default
`whitespace: 'condense'` removes the whitespace between two elements on adjacent template
lines, which rendered `ZonePanelprototype` in the index for forty-four review rounds. Every
text node here is inside its own element, so it should not bite; confirm it by eye rather
than by reasoning.

- [ ] **Step 7: Hand the captures to the product owner and stop**

Do not proceed to Task 3 until the design is approved. This is the whole point of drawing it
first, and the requirement's own main flow ends with the designer judging the result.

- [ ] **Step 8: Commit**

```bash
git add src/prototypes/EmptyState.vue styles/empty-state.css styles/index.css
git commit -m "feat(prototypes): draw the empty state before building it

Scripted rather than template-only, so promotion is a file move: every shipped
component has a script block. The CSS goes into styles/empty-state.css rather
than a scoped block, because a scoped block neither ships nor travels.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: The two pure selectors

TDD, node environment, no DOM and no Obsidian. These are the whole of the slice's logic, and
they are the cheapest thing in it to get exactly right.

**Files:**
- Create: `src/presentation/emptyStates/selectors.ts`
- Test: `tests/presentation/emptyStates/selectors.test.ts`

**Interfaces:**
- Consumes: `PlanDto`, `ZoneDto`, `ProjectSummaryDto` from `src/presentation/read-models/PlanDto.ts`.
- Produces:
  - `type PlanEditorEmptyStateKey = 'noBackground' | 'noZones'`
  - `selectPlanEditorEmptyState(plan: PlanDto | null, zones: readonly ZoneDto[]): PlanEditorEmptyStateKey | null`
  - `selectRenovationProjectEmptyState(projects: readonly ProjectSummaryDto[]): 'noProjects' | null`

- [ ] **Step 1: Write the failing test**

Create `tests/presentation/emptyStates/selectors.test.ts`. Node environment — no
`@vitest-environment` docblock, because `vitest.config.ts` defaults to `node` and jsdom is
opt-in per file.

```typescript
/**
 * The empty-state selectors: the full input/output table from the slice's Design §3.
 *
 * Node, not jsdom, and that is the return on keeping them pure — a rule about which empty
 * state applies is asked of a function, never of a screen.
 */
import { describe, expect, it } from 'vitest';
import {
	selectPlanEditorEmptyState,
	selectRenovationProjectEmptyState,
} from '../../../src/presentation/emptyStates/selectors';
import type { PlanDto, ProjectSummaryDto, ZoneDto } from '../../../src/presentation/read-models/PlanDto';

const PLAN: PlanDto = {
	id: 'plan-1',
	projectId: 'project-1',
	name: 'Ground floor',
	background: null,
	calibration: null,
	layers: [],
};

const ZONE: ZoneDto = {
	id: 'zone-1',
	planId: 'plan-1',
	name: 'Kitchen',
	zoneType: 'Room',
	status: 'Planned',
	points: [
		{ x: 0, y: 0 },
		{ x: 1000, y: 0 },
		{ x: 1000, y: 1000 },
	],
};

const withBackground = (): PlanDto => ({
	...PLAN,
	background: { path: 'Plans/ground.png', kind: 'image' },
});

describe('selectPlanEditorEmptyState', () => {
	it('asks for a background first, even though such a plan also has no zones', () => {
		expect(selectPlanEditorEmptyState(PLAN, [])).toBe('noBackground');
	});

	/**
	 * The precedence is a FIXED order over PRD §93's onboarding sequence, not a re-derived
	 * "which is more missing". A plan with no background and zones on it is exactly what the
	 * sample project produces, so this arm is the one a user meets first.
	 */
	it('still asks for a background when the plan already has zones', () => {
		expect(selectPlanEditorEmptyState(PLAN, [ZONE])).toBe('noBackground');
	});

	it('asks for a zone once the background is set', () => {
		expect(selectPlanEditorEmptyState(withBackground(), [])).toBe('noZones');
	});

	it('asks for nothing when the plan has both', () => {
		expect(selectPlanEditorEmptyState(withBackground(), [ZONE])).toBeNull();
	});

	/**
	 * `null` is a BROKEN REFERENCE — the leaf's persisted plan id no longer resolves — not
	 * "no plan yet". Rendering `noBackground` here would tell a user they never imported a
	 * plan when they may have imported one that then vanished. Slice 17 owns what this
	 * renders as; this function's job is to return no key for it.
	 */
	it('returns no key for a plan that does not resolve at all', () => {
		expect(selectPlanEditorEmptyState(null, [])).toBeNull();
	});
});

describe('selectRenovationProjectEmptyState', () => {
	it('asks for a project when the vault has none', () => {
		expect(selectRenovationProjectEmptyState([])).toBe('noProjects');
	});

	it('asks for nothing once there is one', () => {
		const project: ProjectSummaryDto = { id: 'project-1', name: 'Kitchen refit', status: 'Planning' };

		expect(selectRenovationProjectEmptyState([project])).toBeNull();
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/presentation/emptyStates/selectors.test.ts`
Expected: FAIL — `Failed to resolve import ".../emptyStates/selectors"`.

- [ ] **Step 3: Write the implementation**

Create `src/presentation/emptyStates/selectors.ts`:

```typescript
import type { PlanDto, ProjectSummaryDto, ZoneDto } from '../read-models/PlanDto';

/**
 * Which empty state a view is in — decided from query results that have ALREADY succeeded,
 * and from nothing else.
 *
 * Pure, DOM-free and Obsidian-free on purpose: this is the one piece of judgement in design
 * slice 14, and asking a function rather than a screen is the whole return on the layering.
 * Deliberately NOT a function of editor state either (no `activeToolId` parameter): whether
 * an overlay is currently in the way of an active tool is a rendering rule, and mixing it in
 * here would make "which state is this plan in" unanswerable without a live editor.
 *
 * **An `Err` never reaches either function**, which is why neither input type admits one. A
 * failed read is not an empty state: downgrading it would hide a real, actionable problem
 * behind cheerful onboarding copy telling the user to create something. The composing view
 * branches on the result first.
 */
export type PlanEditorEmptyStateKey = 'noBackground' | 'noZones';

/**
 * `plan === null` is a BROKEN REFERENCE — this leaf's persisted plan id no longer resolves
 * to anything — and returns no key. It is not "no plan yet": the editor was supposed to have
 * something and does not, and `noBackground` would read to the user as "you haven't imported
 * a plan," which may be false. Slice 17 owns what renders there.
 *
 * The precedence is a short-circuit over PRD §93's onboarding order (Import First Plan ->
 * Calibrate -> …), not a re-derivation of which lack is worse: a plan with no background
 * necessarily has no zones either, and the user is asked to do the FIRST missing step.
 */
export function selectPlanEditorEmptyState(
	plan: PlanDto | null,
	zones: readonly ZoneDto[],
): PlanEditorEmptyStateKey | null {
	if (plan === null) return null;
	if (plan.background === null) return 'noBackground';
	if (zones.length === 0) return 'noZones';
	return null;
}

export function selectRenovationProjectEmptyState(
	projects: readonly ProjectSummaryDto[],
): 'noProjects' | null {
	return projects.length === 0 ? 'noProjects' : null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/presentation/emptyStates/selectors.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/presentation/emptyStates/selectors.ts tests/presentation/emptyStates/selectors.test.ts
git commit -m "feat(presentation): the empty-state selectors, pure and node-tested

No activeToolId parameter: whether an overlay is in the way of an active tool is
a rendering rule, and mixing it in would make \"which state is this plan in\"
unanswerable without a live editor.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: The content registry and the eight locale keys

The registry holds `StringKey`s, not copy. Typing it that way is what makes "the registry and
the locale tables agree" a compiler guarantee instead of a review item.

**Files:**
- Create: `src/presentation/emptyStates/content.ts`
- Create: `src/presentation/emptyStates/resolve.ts`
- Modify: `src/presentation/i18n/locales/en.ts`
- Modify: `src/presentation/i18n/locales/de.ts`
- Test: `tests/presentation/emptyStates/content.test.ts`

**Interfaces:**
- Consumes: `StringKey` from `src/presentation/i18n/locales/en.ts`; `tr` from `src/presentation/i18n/strings.ts`.
- Produces:
  - `interface EmptyStateContent { readonly headline: StringKey; readonly body: StringKey; readonly actionLabel?: StringKey }`
  - `EMPTY_STATE_CONTENT` with `renovationProject.noProjects`, `planEditor.noBackground`, `planEditor.noZones`
  - `interface EmptyStateProps { readonly headline: string; readonly body: string; readonly actionLabel?: string }`
  - `resolveEmptyState(content: EmptyStateContent): EmptyStateProps`

- [ ] **Step 1: Add the eight keys to `en.ts`**

Insert immediately before the closing `} as const;`. Sentence case — the obsidianmd ruleset
lints this table.

```typescript
	'empty.project.no-projects.headline': 'No renovation projects yet',
	'empty.project.no-projects.body': 'A renovation project holds your plans, zones, assets and costs. Create one to get started.',
	'empty.plan.no-background.headline': 'No plan document yet',
	'empty.plan.no-background.body': 'Set a floor plan, site plan, sketch or garden plan as this plan\u2019s background, then calibrate it so areas come out in real units.',
	'empty.plan.no-background.action': 'Set plan background',
	'empty.plan.no-zones.headline': 'No zones yet',
	'empty.plan.no-zones.body': 'Draw the first zone on this plan. Its area is measured from the outline and drives the quantities and costs of anything you assign to it.',
	'empty.plan.no-zones.action': 'Draw a zone',
```

`\u2019` rather than a literal apostrophe: the escape keeps the byte content unambiguous in a
file written by tooling, and a literal `'` inside a single-quoted string would need escaping
anyway. `tests/build/encoding.test.ts` refuses a BOM either way.

- [ ] **Step 2: Add the same eight keys to `de.ts`**

Insert immediately before the closing `};`. German noun capitalization is why the
sentence-case lint deliberately does not run on this file. This copy is **ours to write** —
PRD §94 is one sentence and quotes nothing (see Task 1's citation corrections).

```typescript
	'empty.project.no-projects.headline': 'Noch keine Renovierungsprojekte',
	'empty.project.no-projects.body': 'Ein Renovierungsprojekt enthält Ihre Grundrisse, Zonen, Materialien und Kosten. Erstellen Sie eines, um zu beginnen.',
	'empty.plan.no-background.headline': 'Noch kein Plandokument',
	'empty.plan.no-background.body': 'Legen Sie einen Grundriss, Lageplan, eine Skizze oder einen Gartenplan als Hintergrund dieses Plans fest und kalibrieren Sie ihn, damit Flächen in echten Einheiten herauskommen.',
	'empty.plan.no-background.action': 'Planhintergrund festlegen',
	'empty.plan.no-zones.headline': 'Noch keine Zonen',
	'empty.plan.no-zones.body': 'Zeichnen Sie die erste Zone auf diesem Plan. Ihre Fläche wird aus dem Umriss gemessen und bestimmt Mengen und Kosten für alles, was Sie ihr zuweisen.',
	'empty.plan.no-zones.action': 'Zone zeichnen',
```

- [ ] **Step 3: Verify the locale tables agree**

Run: `npx vitest run tests/presentation/i18n/strings.test.ts`
Expected: PASS. This suite requires `de.ts` to answer every key `en.ts` declares. The type
permits the gap on purpose (an incomplete locale is safe, and `t` falls back per key), which
is exactly why the check exists.

- [ ] **Step 4: Write the failing registry test**

Create `tests/presentation/emptyStates/content.test.ts`:

```typescript
/**
 * The registry, and the two claims about it a compiler cannot make.
 *
 * The compiler already guarantees that every value here is a `StringKey`, so a key with no
 * `en.ts` entry fails the build rather than this suite. What it cannot check is that the two
 * Plan Editor entries resolve to DIFFERENT copy: a registry mapping both to one key would
 * type-check perfectly and tell a user with a background and no zones to import a plan.
 */
import { describe, expect, it } from 'vitest';
import { EMPTY_STATE_CONTENT } from '../../../src/presentation/emptyStates/content';
import { t } from '../../../src/presentation/i18n/strings';

const LANGUAGES = ['en', 'de'] as const;

describe('the empty-state content registry', () => {
	it('holds exactly the three entries the slice names', () => {
		expect(Object.keys(EMPTY_STATE_CONTENT.renovationProject)).toEqual(['noProjects']);
		expect(Object.keys(EMPTY_STATE_CONTENT.planEditor)).toEqual(['noBackground', 'noZones']);
	});

	/**
	 * Amendment 1: `noProjects` ships with no action button, because its hand-off is slice
	 * 16's project-creation form and slice 16 depends on slice 11. Asserted rather than left
	 * implicit, so adding a label is a decision somebody takes deliberately.
	 */
	it('gives noProjects no action label, since it has no hand-off yet', () => {
		expect(EMPTY_STATE_CONTENT.renovationProject.noProjects.actionLabel).toBeUndefined();
	});

	it.each(LANGUAGES)('resolves the two plan-editor entries to distinct copy in %s', (language) => {
		const { noBackground, noZones } = EMPTY_STATE_CONTENT.planEditor;

		expect(t(language, noBackground.headline)).not.toBe(t(language, noZones.headline));
		expect(t(language, noBackground.body)).not.toBe(t(language, noZones.body));
	});

	it.each(LANGUAGES)('resolves every declared key to a non-empty string in %s', (language) => {
		const entries = [
			EMPTY_STATE_CONTENT.renovationProject.noProjects,
			EMPTY_STATE_CONTENT.planEditor.noBackground,
			EMPTY_STATE_CONTENT.planEditor.noZones,
		];

		for (const entry of entries) {
			expect(t(language, entry.headline).length).toBeGreaterThan(0);
			expect(t(language, entry.body).length).toBeGreaterThan(0);
			if (entry.actionLabel !== undefined) {
				expect(t(language, entry.actionLabel).length).toBeGreaterThan(0);
			}
		}
	});
});
```

- [ ] **Step 5: Run it to verify it fails**

Run: `npx vitest run tests/presentation/emptyStates/content.test.ts`
Expected: FAIL — `Failed to resolve import ".../emptyStates/content"`.

- [ ] **Step 6: Write the registry**

Create `src/presentation/emptyStates/content.ts`:

```typescript
import type { StringKey } from '../i18n/locales/en';

/**
 * What an empty state SAYS, as i18n keys rather than copy.
 *
 * Typing these `StringKey` rather than `string` is the whole mechanism: a key with no entry
 * in `en.ts` fails to compile, so "the registry and the locale tables agree" is a compiler
 * guarantee rather than a review item. PRD §94's requirement is stated for "every central
 * view", and `docs/requirements/Multilanguage.md` applies to every user-facing string, so an
 * English literal here would be the one surface in the plugin that could not answer either.
 *
 * A registry, not a switch statement in two components: a fourth entry (a future Budget or
 * Schedule view) is one object literal, never a new `if` chain in a template.
 */
export interface EmptyStateContent {
	readonly headline: StringKey;
	readonly body: StringKey;
	/**
	 * Absent means NO BUTTON, and `renovationProject.noProjects` is the reason the field is
	 * optional rather than the exception to it. Its hand-off is slice 16's project-creation
	 * form, which depends on slice 11 — so a button here would either do nothing or be a
	 * second, independently-decided way to create a project. Slice 14's own dependencies
	 * section permits exactly this: "a click on an action button whose target isn't built yet
	 * is simply not wired."
	 */
	readonly actionLabel?: StringKey;
}

export const EMPTY_STATE_CONTENT = {
	renovationProject: {
		noProjects: {
			headline: 'empty.project.no-projects.headline',
			body: 'empty.project.no-projects.body',
		},
	},
	planEditor: {
		/**
		 * Checked BEFORE `noZones` even though a background-less plan necessarily has no
		 * zones either: PRD §93's onboarding order is Create Project -> Choose Folder ->
		 * Import First Plan -> Calibrate, so the user is asked to do the first missing step
		 * rather than told about the second.
		 */
		noBackground: {
			headline: 'empty.plan.no-background.headline',
			body: 'empty.plan.no-background.body',
			actionLabel: 'empty.plan.no-background.action',
		},
		/**
		 * Deliberately distinct copy from `noBackground` — a plan WITH a background and no
		 * zones is a different, later stage of the same onboarding flow, not a variant
		 * wording of "nothing here yet". `content.test.ts` asserts the distinctness, because
		 * a registry pointing both at one key would type-check perfectly.
		 */
		noZones: {
			headline: 'empty.plan.no-zones.headline',
			body: 'empty.plan.no-zones.body',
			actionLabel: 'empty.plan.no-zones.action',
		},
	},
} as const satisfies Record<string, Record<string, EmptyStateContent>>;
```

- [ ] **Step 7: Write the resolver**

Create `src/presentation/emptyStates/resolve.ts`:

```typescript
import { tr } from '../i18n/strings';
import type { EmptyStateContent } from './content';

/**
 * What `EmptyState.vue` takes: strings that are already resolved.
 *
 * The component knows nothing about i18n, which is what keeps it reusable by a future view —
 * or a test — whose copy comes from somewhere else. It is the same division slice 15's dialog
 * framework settled on: a user-facing string in a descriptor is resolved by the CALLER.
 */
export interface EmptyStateProps {
	readonly headline: string;
	readonly body: string;
	readonly actionLabel?: string;
}

/**
 * The ONE place a registry entry's keys become strings.
 *
 * `tr`, not `t`: the app language is resolved per call from Obsidian's own `getLanguage()`,
 * which is what keeps a rendered-per-open surface correct after the user changes it. A cached
 * language, or a language setting of this plugin's own, is a recurring marketplace review
 * rejection.
 *
 * `actionLabel` stays ABSENT rather than becoming an empty string when the entry has none:
 * the component branches on `!== undefined` to decide whether a button exists at all, and
 * `''` would render a nameless button — which is both a live control that does nothing and an
 * axe `button-name` violation.
 */
export function resolveEmptyState(content: EmptyStateContent): EmptyStateProps {
	return {
		headline: tr(content.headline),
		body: tr(content.body),
		...(content.actionLabel === undefined ? {} : { actionLabel: tr(content.actionLabel) }),
	};
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run tests/presentation/emptyStates tests/presentation/i18n/strings.test.ts`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/presentation/emptyStates/content.ts src/presentation/emptyStates/resolve.ts \
        src/presentation/i18n/locales/en.ts src/presentation/i18n/locales/de.ts \
        tests/presentation/emptyStates/content.test.ts
git commit -m "feat(presentation): the empty-state registry, keyed rather than copied

StringKey rather than string is the mechanism: a key with no en.ts entry fails
to compile. What the compiler cannot check is that the two plan-editor entries
resolve to DIFFERENT copy, so content.test.ts asserts that per locale.

resolveEmptyState omits actionLabel rather than emptying it, because '' renders
a nameless button - a live control that does nothing, and an axe button-name
violation.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Promote the mock into `EmptyState.vue`

Promotion **moves the file**. The template block crosses unchanged; what changes is the
script (real props, a real emit, no defaults) and the location.

**Files:**
- Create: `src/presentation/components/EmptyState.vue` (by `git mv`)
- Delete: `src/prototypes/EmptyState.vue`
- Test: `tests/presentation/components/emptyState.test.ts`

**Interfaces:**
- Consumes: `EmptyStateProps` from `src/presentation/emptyStates/resolve.ts`.
- Produces: `EmptyState.vue` — props `headline: string`, `body: string`, `actionLabel?: string`, `overlay?: boolean`; slot `icon`; emit `(e: 'action'): void`.

- [ ] **Step 1: Write the failing component test**

Create `tests/presentation/components/emptyState.test.ts`:

```typescript
/**
 * @vitest-environment jsdom
 *
 * The empty state's component contract (design slice 14, DoD 1).
 *
 * Presentation behaviour only: what renders, what is conditional, what one click emits.
 * Nothing here asserts WHICH empty state applies — that is `selectors.test.ts`'s, in node,
 * and asking a screen for it would waste the whole point of keeping the rule pure.
 */
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import EmptyState from '../../../src/presentation/components/EmptyState.vue';

const PROPS = { headline: 'No zones yet', body: 'Draw the first zone.' };

describe('EmptyState', () => {
	it('renders the headline as an h2 and the body', () => {
		const wrapper = mount(EmptyState, { props: PROPS });

		// h2, not h1 or h3: it is the level every other panel and dialog here uses
		// (InspectorPanel, LayersPanel, all four dialogs), and a skip is an axe
		// `heading-order` violation.
		expect(wrapper.find('h2.rp-empty-state__headline').text()).toBe('No zones yet');
		expect(wrapper.find('.rp-empty-state__body').text()).toBe('Draw the first zone.');
	});

	it('renders no button when there is no action label', () => {
		const wrapper = mount(EmptyState, { props: PROPS });

		expect(wrapper.find('button').exists()).toBe(false);
	});

	it('renders a named button when there is one, and emits once per click', async () => {
		const wrapper = mount(EmptyState, { props: { ...PROPS, actionLabel: 'Draw a zone' } });

		const button = wrapper.find('button.rp-empty-state__action');
		expect(button.text()).toBe('Draw a zone');

		await button.trigger('click');

		expect(wrapper.emitted('action')).toHaveLength(1);
	});

	/**
	 * The block form is the whole pane (the project view); the overlay form floats over a
	 * live Konva canvas. One class is the difference, and `styles/empty-state.css` hangs the
	 * `pointer-events` pair off it — so a missing modifier is a pointer trap over a canvas
	 * the user is trying to draw on.
	 */
	it('adds the overlay modifier only when asked', () => {
		expect(mount(EmptyState, { props: PROPS }).classes()).not.toContain('rp-empty-state--overlay');
		expect(mount(EmptyState, { props: { ...PROPS, overlay: true } }).classes()).toContain(
			'rp-empty-state--overlay',
		);
	});

	it('passes the icon slot through untouched', () => {
		const wrapper = mount(EmptyState, {
			props: PROPS,
			slots: { icon: '<svg data-test="given"></svg>' },
		});

		expect(wrapper.find('.rp-empty-state__icon [data-test="given"]').exists()).toBe(true);
	});

	/**
	 * The slot renders nothing on its own, deliberately. `CLAUDE.md`'s "Deliberately absent"
	 * list keeps icon rendering (`setIcon`) waiting for its first real caller, and none of
	 * this slice's three registry entries passes anything in — adding one here would be that
	 * trigger arriving as a side effect of an unrelated slice.
	 */
	it('draws nothing of its own in the icon slot', () => {
		const wrapper = mount(EmptyState, { props: PROPS });

		expect(wrapper.find('.rp-empty-state__icon').element.children).toHaveLength(0);
	});
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/presentation/components/emptyState.test.ts`
Expected: FAIL — `Failed to resolve import ".../components/EmptyState.vue"`.

- [ ] **Step 3: Move the file and replace its script block**

```bash
mkdir -p src/presentation/components
git mv src/prototypes/EmptyState.vue src/presentation/components/EmptyState.vue
```

Then replace everything above `<template>` with the following. **The template block below the
script is not touched** — that is the criterion this tree exists for.

```vue
<script setup lang="ts">
/**
 * One empty state, used two ways (PRD §94, design slice 14).
 *
 * It imports no command, no query, no store and no Obsidian API, and it takes RESOLVED
 * strings rather than i18n keys — so a future Budget, Schedule or Procurement view can reuse
 * it without depending on this slice's registry or on Plan/Project types at all. The
 * composing view resolves `EMPTY_STATE_CONTENT`'s keys through `resolveEmptyState` and passes
 * the results down; this component never learns that i18n exists.
 *
 * `overlay` is the Plan Editor's form. The canvas there is ALWAYS mounted (see the slice's
 * 2026-08-26 amendment), because `create-sample-project` seeds a plan with no background and
 * five zones and the browser harness refuses a background outright — so replacing the region
 * would hide the one thing both exist to show. `styles/empty-state.css` hangs the
 * `pointer-events` pair off this modifier: the panel lets a pan or a zoom through, the button
 * does not.
 *
 * Promoted from `src/prototypes/EmptyState.vue` by MOVING the file. The template below is the
 * markup that was drawn and captured in the harness, unchanged; only this block differs, and
 * only by losing the mock's placeholder defaults.
 */
import type { EmptyStateProps } from '../emptyStates/resolve';

defineProps<EmptyStateProps & { overlay?: boolean }>();
defineEmits<{ action: [] }>();
</script>
```

- [ ] **Step 4: Lint it**

Run: `npx eslint --fix src/presentation/components/EmptyState.vue && npx eslint src/presentation/components/EmptyState.vue`
Expected: no output. In particular `vue/no-restricted-block` must not fire — there is no
`<style>` block, because the CSS already lives in `styles/empty-state.css`.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/presentation/components/emptyState.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 6: Confirm the prototype tree's own gates still hold**

Run: `npx vitest run tests/build/prototype-styles.test.ts tests/build/prototypes-not-bundled.test.ts tests/build/prototypes-one-way-door.test.ts tests/build/prototype-promotion.test.ts`
Expected: PASS. The mock is gone, so `prototype-styles` has one fewer file to grade;
`prototype-promotion` still holds the `ZoneSummary` pair, which is deliberately untouched.

- [ ] **Step 7: Commit**

```bash
git add -A src/prototypes src/presentation/components tests/presentation/components
git commit -m "feat(presentation): promote EmptyState by moving the file

The template crosses unchanged - the criterion the prototypes tree exists for.
Only the script block differs, and only by losing the mock's placeholder
defaults; the CSS never moves, because it was written into
styles/empty-state.css from the start.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: The Plan Editor overlay

The canvas keeps mounting. The empty state goes into a new default slot on `PlanCanvas`, which
is already `position: relative` — so the overlay resolves against the canvas region and not
against the shell.

**Files:**
- Modify: `src/presentation/stores/ProjectStore.ts`
- Modify: `src/presentation/editor/PlanCanvas.vue`
- Modify: `src/presentation/editor/PlanEditorRoot.vue`
- Test: `tests/presentation/editor/emptyStateOverlay.test.ts`

**Interfaces:**
- Consumes: `selectPlanEditorEmptyState`, `PlanEditorEmptyStateKey` (Task 3); `EMPTY_STATE_CONTENT` (Task 4); `resolveEmptyState` (Task 4); `EmptyState.vue` (Task 5); `EditorRuntime.activeToolId: Ref<ToolId | null>` and `EditorRuntime.setTool` from `src/presentation/editor/runtime.ts`.
- Produces: `useProjectStore().emptyStateKey: ComputedRef<PlanEditorEmptyStateKey | null>`; a default slot on `PlanCanvas` rendered inside `.rp-plan-canvas`.

- [ ] **Step 1: Settle `noBackground`'s hand-off before writing the component**

Run: `grep -n "setPlanBackground" src/presentation/editor/planEditorCommands.ts src/presentation/editor/PlanEditorContext.ts src/plugin/RenovationPlannerPlugin.ts`

Slice 5's background picker is a **plugin command** (`command.set-plan-background`), not a
member of `PlanEditorCommandServices`. So the editor's Vue tree has no way to reach it, and
the only routes are a new seam on `PlanEditorContext` or the view calling the global `app` —
which the marketplace rules refuse.

**Two acceptable outcomes; pick one and say which in the code:**

- **(a)** Drop `actionLabel` from `EMPTY_STATE_CONTENT.planEditor.noBackground` (Task 4) and delete the corresponding `en.ts`/`de.ts` key. `noBackground` then renders headline and body only, exactly as `noProjects` does, for exactly the same reason: no reachable hand-off yet.
- **(b)** Add one member to `PlanEditorContext` — an `openBackgroundPicker(): void` supplied by `planEditorDeps` from the same function the plugin command already calls, so it is one more caller of one action rather than a second decision-maker.

**(a) is the smaller, honest change and this plan assumes it.** Take (b) only if the product
owner wants the button now; it widens the view's dependency bundle, which is slice 5's seam
and not this slice's.

- [ ] **Step 2: Write the failing test**

Create `tests/presentation/editor/emptyStateOverlay.test.ts`:

```typescript
/**
 * @vitest-environment jsdom
 *
 * The Plan Editor's empty states, as OVERLAYS over a canvas that never unmounts.
 *
 * The load-bearing assertion in this file is the first one: `.rp-plan-canvas` exists in every
 * case. `create-sample-project` seeds a plan with no background and five zones and then opens
 * the editor on it, and `tests/harness/planEditor.ts` refuses a background outright on SDD
 * §55 grounds — so an empty state that REPLACED the region would make both of them draw an
 * empty state where the scene should be. Neither is reachable from this suite, which is
 * exactly why the claim is pinned here.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { t } from '../../../src/presentation/i18n/strings';
import { mountPlanEditor, settle, type EditorHarness } from '../../helpers/editor';
import { FIXTURE_PLAN, FIXTURE_ZONES } from '../../helpers/planFixtures';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';

let harness: EditorHarness | null = null;

afterEach(() => {
	harness?.unmount();
	harness = null;
});

const WITH_BACKGROUND = {
	...FIXTURE_PLAN,
	background: { path: 'Plans/ground.png', kind: 'image' as const },
};

const overlay = (mounted: EditorHarness) => mounted.wrapper.find('.rp-empty-state');

describe('the plan editor empty states', () => {
	it('keeps the canvas mounted while an empty state is showing', async () => {
		harness = await mountPlanEditor({ plan: FIXTURE_PLAN, zones: [] });

		expect(harness.wrapper.find('.rp-plan-canvas').exists()).toBe(true);
		expect(overlay(harness).exists()).toBe(true);
	});

	it('renders the overlay INSIDE the canvas, so it positions against it', async () => {
		harness = await mountPlanEditor({ plan: FIXTURE_PLAN, zones: [] });

		expect(harness.wrapper.find('.rp-plan-canvas .rp-empty-state').exists()).toBe(true);
		expect(overlay(harness).classes()).toContain('rp-empty-state--overlay');
	});

	it('asks for a background when the plan has none, even with zones drawn', async () => {
		harness = await mountPlanEditor({ plan: FIXTURE_PLAN, zones: FIXTURE_ZONES });

		expect(overlay(harness).find('h2').text()).toBe(t('en', 'empty.plan.no-background.headline'));
	});

	it('asks for a zone once the background is set', async () => {
		harness = await mountPlanEditor({ plan: WITH_BACKGROUND, zones: [] });

		expect(overlay(harness).find('h2').text()).toBe(t('en', 'empty.plan.no-zones.headline'));
	});

	it('shows nothing when the plan has a background and zones', async () => {
		harness = await mountPlanEditor({ plan: WITH_BACKGROUND, zones: FIXTURE_ZONES });

		expect(overlay(harness).exists()).toBe(false);
	});

	/**
	 * Amendment 3, and the reason the noZones action is usable at all: its own button
	 * activates `draw-polygon`, and a panel still sitting over the canvas afterwards would
	 * leave the user in a mode they cannot reach the stage in. One rule for both keys, so
	 * `noBackground` yields to an active tool too — a plan with no background still has a
	 * coordinate system, which is precisely what the sample project draws five zones in.
	 */
	it('yields to an active tool', async () => {
		harness = await mountPlanEditor({ plan: WITH_BACKGROUND, zones: [] });
		expect(overlay(harness).exists()).toBe(true);

		useEditorStore(harness.pinia).activeToolId = 'draw-polygon';
		await settle();

		expect(overlay(harness).exists()).toBe(false);
		expect(harness.wrapper.find('.rp-plan-canvas').exists()).toBe(true);
	});

	it('activates the draw tool when the noZones action is pressed', async () => {
		harness = await mountPlanEditor({ plan: WITH_BACKGROUND, zones: [] });

		await overlay(harness).find('button.rp-empty-state__action').trigger('click');
		await settle();

		expect(useEditorStore(harness.pinia).activeToolId).toBe('draw-polygon');
	});

	/**
	 * A failed read is NOT an empty state (DoD 6). `mountPlanEditor` with a plan of `null`
	 * drives `status === 'missing'`, which mounts no canvas, so it can carry no overlay.
	 * Slice 17 owns what that renders as; this asserts only that it is not downgraded into
	 * cheerful onboarding copy.
	 */
	it('renders no empty state for a plan that does not resolve', async () => {
		harness = await mountPlanEditor({ plan: null, zones: [] });

		expect(overlay(harness).exists()).toBe(false);
		expect(harness.wrapper.find('.rp-editor-canvas-message').exists()).toBe(true);
	});
});
```

If step 1 chose outcome **(a)**, delete the `noBackground` action case — there is no button —
and keep the `noZones` one. Do not leave a case asserting a control that deliberately does not
exist.

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run tests/presentation/editor/emptyStateOverlay.test.ts`
Expected: FAIL — every case, `.rp-empty-state` not found.

- [ ] **Step 4: Add the store getter**

In `src/presentation/stores/ProjectStore.ts`: add `computed` to the `vue` import, add
`import { selectPlanEditorEmptyState } from '../emptyStates/selectors';`, and insert before
the `reset` function:

```typescript
	/**
	 * Which empty state this Plan Editor is in, or `null` for a normal render (design slice
	 * 14). A getter over state this store already hydrates — no new field and no new query,
	 * which is why it is here rather than in a store of its own.
	 *
	 * It reads `plan` and `zones` and NOTHING about the editor: whether an active tool
	 * currently displaces the overlay is a rendering rule, decided in `PlanEditorRoot`. A
	 * store that mixed the two would make "which state is this plan in" unanswerable without
	 * a live tool manager, and this getter's whole value is that it is answerable.
	 *
	 * A failed or missing read never reaches the selector: `plan` is `null` in both cases and
	 * the selector returns no key for that — which is the `Ok(null)`-is-a-broken-reference
	 * rule, not an accident of ordering.
	 */
	const emptyStateKey = computed(() => selectPlanEditorEmptyState(plan.value, [...zones.value.values()]));
```

Add `emptyStateKey` to the returned object, keeping the `fallow-ignore-next-line` comment
attached to the `return`:

```typescript
	// fallow-ignore-next-line unused-store-member
	return { project, plan, zones, status, error, emptyStateKey, hydrate, reset };
```

- [ ] **Step 5: Give `PlanCanvas` a default slot**

In `src/presentation/editor/PlanCanvas.vue`, add a slot as the last child of the
`.rp-plan-canvas` div, immediately after `</VStage>`:

```vue
		</VStage>
		<!--
			Whatever floats over the stage — design slice 14's empty state today. It is a
			SIBLING of `<VStage>` inside this div rather than a child of it: Konva owns
			everything inside the stage and would not render a DOM node there at all. The div
			is already `position: relative` (`styles/editor.css`), so an absolutely positioned
			overlay resolves against the canvas region and not against the shell — which is
			what keeps it off the layers panel and the inspector.
		-->
		<slot />
```

- [ ] **Step 6: Render the overlay from `PlanEditorRoot`**

In `src/presentation/editor/PlanEditorRoot.vue`: add `computed` to the `vue` import, and add

```typescript
import EmptyState from '../components/EmptyState.vue';
import { EMPTY_STATE_CONTENT } from '../emptyStates/content';
import { resolveEmptyState } from '../emptyStates/resolve';
```

Change `provideEditorRuntime(context);` to:

```typescript
// The return value is USED now, not discarded: `activeToolId` is what displaces the empty
// state and `setTool` is what the noZones action calls, and this is the same runtime object
// every tool and the toolbar already share.
const runtime = provideEditorRuntime(context);
```

Add, after the `layersPanelOpen`/`inspectorPanelOpen` line:

```typescript
const { emptyStateKey } = storeToRefs(projectStore);

/**
 * The overlay's props, or `null` for no overlay.
 *
 * Two gates answering different questions. `emptyStateKey` is "is this plan legitimately
 * empty", decided from query results alone. `activeToolId` is "is the user mid-task", and it
 * is checked HERE rather than in the selector because it is a rendering rule: a panel still
 * floating over the canvas after its own button activated the draw tool would leave the user
 * in a mode they cannot reach the stage in.
 */
const overlay = computed(() => {
	const key = emptyStateKey.value;
	if (key === null || runtime.activeToolId.value !== null) return null;
	return resolveEmptyState(EMPTY_STATE_CONTENT.planEditor[key]);
});

/**
 * The one hand-off this slice wires, to the ONE entry point that already exists — never a
 * second, independently-decided path to the same effect (`CLAUDE.md`'s one-action-every-input
 * rule, applied to a new kind of input).
 *
 * Setting the tool rather than dispatching a command is deliberate: a Zone cannot be created
 * with zero user-supplied geometry, so there is no `CreateZoneCommand` call to make — the
 * correct action is putting the user in the same drawing mode the toolbar's own button would.
 *
 * `noBackground` has no button (see the task's step 1): slice 5's picker is a PLUGIN COMMAND,
 * not a member of the editor's bundle, so there is nothing here to call that would not be
 * either a new seam or a reach for the global `app`.
 */
function onEmptyStateAction(): void {
	runtime.setTool('draw-polygon');
}
```

Then wrap the canvas:

```vue
			<PlanCanvas
				v-if="status === 'ready'"
				:tokens="tokens"
				@background-status="(next) => (backgroundStatus = next)"
			>
				<EmptyState
					v-if="overlay !== null"
					v-bind="overlay"
					overlay
					@action="onEmptyStateAction()"
				/>
			</PlanCanvas>
```

- [ ] **Step 7: Lint both SFCs**

Run: `npx eslint --fix src/presentation/editor/PlanCanvas.vue src/presentation/editor/PlanEditorRoot.vue && npx eslint src/presentation/editor/PlanCanvas.vue src/presentation/editor/PlanEditorRoot.vue`
Expected: no output.

- [ ] **Step 8: Run the new test and every editor suite it could disturb**

Run: `npx vitest run tests/presentation/editor tests/harness/accessibility.test.ts`
Expected: PASS throughout. The three fixtures all carry `background: null`, so the
default-mounted editor now shows a `noBackground` overlay — with the canvas still mounted,
which is why nothing asserting `.rp-plan-canvas`, `canvasEl` or `.stage` moves. If any of
those 13 files goes red, the overlay has become a replacement somewhere; fix that rather than
the test.

- [ ] **Step 9: Look at it in a browser**

```bash
npm run harness-shot
npm run harness-shot -- --width=460
```

The two plan-editor captures now carry the `noBackground` overlay over the seeded scene
(`HARNESS_PLAN.background` is `null` and its four zones are drawn). Read them: the panel must
not cover the zone captions it is explaining, and at 460px — the width an Obsidian sidebar
leaf actually has, which has already hidden one layout defect the default 1280 could not show
— it must not overflow the pane.

- [ ] **Step 10: Commit**

```bash
git add src/presentation/stores/ProjectStore.ts src/presentation/editor/PlanCanvas.vue \
        src/presentation/editor/PlanEditorRoot.vue tests/presentation/editor/emptyStateOverlay.test.ts
git commit -m "feat(editor): the plan editor's empty states, over a canvas that stays mounted

PlanCanvas gains a default slot inside .rp-plan-canvas, which is already
position: relative - so the overlay resolves against the canvas region and not
against the shell.

Two gates answering different questions: emptyStateKey is \"is this plan
legitimately empty\" and lives on the store, activeToolId is \"is the user
mid-task\" and lives in the component. Folding the second into the selector
would make the first unanswerable without a live tool manager.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: `ListProjects`

`ProjectRepository.listAll()` was declared by slice 3 and implemented by slice 4 ahead of any
consumer, precisely so adding one is a query file rather than a port change. This is that
consumer.

**Files:**
- Create: `src/application/queries/ListProjects.ts`
- Test: `tests/application/queries/listProjects.test.ts`

**Interfaces:**
- Consumes: `ProjectRepository` from `src/application/ports/ProjectRepository.ts` (`listAll(): Promise<Result<Loaded<Project>[], PersistenceError>>`).
- Produces: `class ListProjects { execute(): Promise<Result<Project[], PersistenceError>> }`. It hands back **domain entities**, exactly as `ListAssets` does; the mapping to `ProjectSummaryDto` happens in Task 8's read-model bundle, because a type belongs with the code that produces it and `application/` may not name `presentation/`.

- [ ] **Step 1: Write the failing test**

Create `tests/application/queries/listProjects.test.ts`. Read the sibling suites in
`tests/application/queries/` first and reuse whichever helper they already use to build a
`Project` — do not invent a second one.

```typescript
/**
 * `ListProjects` — the Renovation Project view's first read (design slice 14).
 *
 * An Application Test in the SDD §71 sense: the query against an in-memory repository, with
 * no Obsidian anywhere. What it has to establish is small but not nothing — that a failed
 * read is handed back as a failure rather than flattened into an empty list, because an empty
 * list is what the view renders an empty state for.
 */
import { describe, expect, it } from 'vitest';
import { ListProjects } from '../../../src/application/queries/ListProjects';
import { InMemoryProjectRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryProjectRepository';
import { err, isErr, isOk } from '../../../src/core/result/Result';
import type { PersistenceError } from '../../../src/core/errors/AppError';
import type { ProjectRepository } from '../../../src/application/ports/ProjectRepository';

const READ_FAILED: PersistenceError = {
	category: 'Persistence',
	code: 'project.read-failed',
	message: 'boom',
};

describe('ListProjects', () => {
	it('answers an empty list for a vault with no projects', async () => {
		const result = await new ListProjects(new InMemoryProjectRepository()).execute();

		expect(isOk(result) && result.value).toEqual([]);
	});

	/**
	 * The distinction the empty state depends on. `ok([])` means "legitimately nothing yet"
	 * and gets onboarding copy; `isErr` means a real problem and must NOT be downgraded into
	 * it, or a persistence failure renders as a cheerful invitation to create something.
	 */
	it('hands a failed read back as a failure, never as an empty list', async () => {
		const repository = new InMemoryProjectRepository();
		const failing: ProjectRepository = {
			...repository,
			listAll: () => Promise.resolve(err(READ_FAILED)),
		};

		const result = await new ListProjects(failing).execute();

		expect(isErr(result) && result.error.code).toBe('project.read-failed');
	});
});
```

Add a third case that seeds two projects through the repository and asserts both come back,
using the sibling suites' construction for a `Project`.

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/application/queries/listProjects.test.ts`
Expected: FAIL — `Failed to resolve import ".../queries/ListProjects"`.

- [ ] **Step 3: Write the query**

Create `src/application/queries/ListProjects.ts`:

```typescript
import { isErr, ok, type Result } from '../../core/result/Result';
import type { PersistenceError } from '../../core/errors/AppError';
import type { Project } from '../../domain/project/Project';
import type { ProjectRepository } from '../ports/ProjectRepository';

/**
 * Every project in the vault — the Renovation Project view's first read (design slice 14).
 *
 * A thin wrapper over `listAll()`, which slice 3 declared on the port and slice 4 implemented
 * ahead of any consumer, precisely so adding one is a query file rather than a port change.
 * Named `List*` per SDD §80, the same shape `ListAssets` follows.
 *
 * It hands back DOMAIN ENTITIES, not a DTO. `application/` may not name `presentation/`, and a
 * type belongs with the code that produces it — so the mapping to `ProjectSummaryDto` happens
 * in the read-model bundle the view is handed, beside every other `to*Dto`.
 *
 * The `Result` is passed through unflattened. `ok([])` and `isErr` are different facts: the
 * first is "this vault legitimately has no projects yet" and earns an empty state, the second
 * is a real problem that must never be rendered as one.
 */
export class ListProjects {
	constructor(private readonly projects: ProjectRepository) {}

	async execute(): Promise<Result<Project[], PersistenceError>> {
		const listed = await this.projects.listAll();
		if (isErr(listed)) return listed;
		return ok(listed.value.map((loaded) => loaded.entity));
	}
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/application/queries/listProjects.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/application/queries/ListProjects.ts tests/application/queries/listProjects.test.ts
git commit -m "feat(application): ListProjects, the project view's first read

listAll() was declared by slice 3 and implemented by slice 4 ahead of any
consumer, so this is a query file rather than a port change.

It returns domain entities, not a DTO: application/ may not name presentation/,
and the Result passes through unflattened because ok([]) earns an empty state
and isErr must never be rendered as one.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: The Renovation Project view's first data dependency

Slice 1 reserved this seam in writing: *"Query-service access is constructor-injected …
exactly like `RenovationProjectView` would be once it has data needs."* This is that data
need, and the seam is extended by a field rather than relocated.

**Files:**
- Create: `src/presentation/read-models/renovationProjectQueries.ts`
- Create: `src/presentation/views/RenovationProjectContext.ts`
- Create: `src/presentation/stores/RenovationProjectStore.ts`
- Modify: `src/presentation/views/RenovationProjectView.ts`
- Modify: `src/presentation/views/ViewRoot.vue`
- Modify: `src/plugin/composition-root.ts`
- Modify: `src/plugin/RenovationPlannerPlugin.ts`
- Modify: `tests/helpers/makeRenovationProjectView.ts`
- Modify: `tests/harness/mount.ts`
- Modify: `tests/presentation/views/viewRoot.test.ts`
- Test: `tests/presentation/views/renovationProjectEmptyState.test.ts`

**Interfaces:**
- Consumes: `ListProjects` (Task 7); `toProjectSummaryDto` from `src/presentation/read-models/PlanDto.ts`; `selectRenovationProjectEmptyState` (Task 3); `EMPTY_STATE_CONTENT`, `resolveEmptyState` (Task 4); `EmptyState.vue` (Task 5).
- Produces:
  - `interface RenovationProjectQueryServices { listProjects(): Promise<Result<readonly ProjectSummaryDto[], PersistenceError>> }`
  - `createRenovationProjectQueries(listProjects: ListProjects): RenovationProjectQueryServices`
  - `unavailableRenovationProjectQueries(): RenovationProjectQueryServices`
  - `interface RenovationProjectDeps { readonly queries: RenovationProjectQueryServices }`
  - `RENOVATION_PROJECT_CONTEXT: InjectionKey<RenovationProjectDeps>`, `useRenovationProjectContext()`
  - `useRenovationProjectStore()` with `projects`, `status: 'idle' | 'loading' | 'ready' | 'failed'`, `error`, `emptyStateKey`, `hydrate(queries)`, `reset()`
  - `renovationProjectDeps(root: CompositionRoot): RenovationProjectDeps` in `composition-root.ts`
  - `listProjects: ListProjects` on `PersistenceServices`

- [ ] **Step 1: Write the failing view test**

Create `tests/presentation/views/renovationProjectEmptyState.test.ts`:

```typescript
/**
 * @vitest-environment jsdom
 *
 * The Renovation Project view's first content (design slice 14, DoD 4).
 *
 * Until this slice the view mounted an empty Vue app and drew nothing, which was slice 1's
 * success criterion and is no longer anybody's. Mounted through `makeView`, the ONE
 * construction site both this suite and the browser harness go through — so a grown
 * constructor requirement meets both at once instead of stranding the harness page.
 */
import { describe, expect, it } from 'vitest';
import { err, ok } from '../../../src/core/result/Result';
import { t } from '../../../src/presentation/i18n/strings';
import { installObsidianDom } from '../../helpers/dom';
import { makeView } from '../../helpers/makeRenovationProjectView';
import type { ProjectSummaryDto } from '../../../src/presentation/read-models/PlanDto';
import type { RenovationProjectQueryServices } from '../../../src/presentation/read-models/renovationProjectQueries';

const PROJECT: ProjectSummaryDto = { id: 'project-1', name: 'Kitchen refit', status: 'Planning' };

const answering = (projects: readonly ProjectSummaryDto[]): RenovationProjectQueryServices => ({
	listProjects: () => Promise.resolve(ok(projects)),
});

const refusing = (): RenovationProjectQueryServices => ({
	listProjects: () =>
		Promise.resolve(err({ category: 'Persistence', code: 'settings.unrecovered', message: 'no' })),
});

/** The view hydrates on open; the same settle shape the editor harness uses. */
async function settle(): Promise<void> {
	for (let index = 0; index < 4; index += 1) await Promise.resolve();
	await new Promise((resolve) => setTimeout(resolve, 0));
}

async function open(queries: RenovationProjectQueryServices) {
	installObsidianDom();
	const view = makeView({ queries });
	await view.onOpen();
	await settle();
	return view;
}

describe('the renovation project view', () => {
	it('invites the user to create a project when the vault has none', async () => {
		const view = await open(answering([]));

		const empty = view.contentEl.querySelector('.rp-empty-state');
		expect(empty?.querySelector('h2')?.textContent).toBe(
			t('en', 'empty.project.no-projects.headline'),
		);
		await view.onClose();
	});

	/**
	 * Amendment 1: no button, because the hand-off is slice 16's project-creation form and
	 * slice 16 depends on slice 11. A rendered control that does nothing is worse than no
	 * control, and this is what stops one appearing by accident.
	 */
	it('renders no action button, since there is no hand-off yet', async () => {
		const view = await open(answering([]));

		expect(view.contentEl.querySelector('.rp-empty-state button')).toBeNull();
		await view.onClose();
	});

	it('renders no empty state once a project exists', async () => {
		const view = await open(answering([PROJECT]));

		expect(view.contentEl.querySelector('.rp-empty-state')).toBeNull();
		await view.onClose();
	});

	/**
	 * DoD 6, asserted rather than reviewed. A failed read is not "legitimately nothing yet",
	 * and downgrading it would hide a persistence or settings failure behind copy telling the
	 * user to create something. What it renders INSTEAD is slice 17's; this slice's claim is
	 * only that it is not this.
	 */
	it('renders no empty state for a failed read', async () => {
		const view = await open(refusing());

		expect(view.contentEl.querySelector('.rp-empty-state')).toBeNull();
		await view.onClose();
	});
});
```

Add one store-level case in the same file asserting `status === 'failed'` and
`emptyStateKey === null` after a refused read. That is the "never reaches the selector" half
of DoD 6, held at the store rather than by spying on a module export through an SFC's import
binding — the weaker instrument, taken deliberately and said so, rather than a case deleted.

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/presentation/views/renovationProjectEmptyState.test.ts`
Expected: FAIL — `makeView` takes no argument, and `renovationProjectQueries` does not resolve.

- [ ] **Step 3: Write the read-model bundle**

Create `src/presentation/read-models/renovationProjectQueries.ts`, mirroring
`planEditorQueries.ts` exactly in structure: the interface, `createRenovationProjectQueries`
mapping `ListProjects`'s entities through `toProjectSummaryDto`, and
`unavailableRenovationProjectQueries` returning `err({ category: 'Persistence', code:
'settings.unrecovered', … })`.

A new sibling rather than a member of `planEditorQueries.ts`, and the file must say why: that
file is named for one view and already carries six methods; two small files named for their
views beat one growing file named for the wrong one.

The refusal bundle needs a paragraph justifying itself against `CLAUDE.md`'s fifth
fake-instance lesson — *"a stand-in that REFUSES what production answers turns a tool built
for looking into one that shows a false picture"*. Here the refusal is **honest**: with
settings unrecovered there is no repository, no index and no project list, so
`settings.unrecovered` is exactly what a caller should get. That is the case the lesson
exempts, and the file should state it rather than leave a reader to work it out.

- [ ] **Step 4: Write the context and the store**

`RenovationProjectContext.ts` mirrors `PlanEditorContext.ts`: the `InjectionKey`, and a
`useRenovationProjectContext()` that **throws** when the context is absent — the same
reasoning, that there is no sensible degraded behaviour and failing at mount points at the
composition mistake instead of drawing a plausible-looking empty pane.

`RenovationProjectStore.ts` — three requirements the code must actually meet:

1. **A hydration ticket**, the same mechanism `ProjectStore` and `InspectorStore` both carry (`let latestHydration = 0`, bumped before the first await, and bumped again by `reset()`). There is one caller today — but `ProjectStore` gained its second in slice 8, and a slower earlier read landing on a fresher later one is a just-created project vanishing with no error anywhere.
2. **A failed read leaves no stale list behind** — `projects` empties, `error` is set, `status` becomes `'failed'`. Drawing a list beside an error saying it could not be read is the worse of the two wrong answers, which is the rule `ProjectStore.fail` already states.
3. **`emptyStateKey` is `null` unless `status === 'ready'`.** This is what makes DoD 6 hold structurally rather than by ordering luck.

- [ ] **Step 5: Extend the view and its root**

`RenovationProjectView` takes `private readonly deps: RenovationProjectDeps` as a second
constructor parameter and calls `app.provide(RENOVATION_PROJECT_CONTEXT, this.deps)` before
`app.mount(this.contentEl)` — the same order `PlanEditorView` uses (`PlanEditorView.ts:165`).

`ViewRoot.vue` injects the context, hydrates on `onMounted`, and renders:

```vue
<template>
	<div class="renovation-planner-view">
		<EmptyState
			v-if="empty !== null"
			v-bind="empty"
		/>
		<DialogHost />
	</div>
</template>
```

`DialogHost` stays the **last child** and a sibling of everything else — its own contract: it
makes its parent's other children `inert` while a dialog is open, so every sibling has to be a
sibling of it for the background to actually go inert.

**Update the docblocks that stop being true in this commit.** `RenovationProjectView.ts` and
`ViewRoot.vue` both say the view "draws nothing yet, and that is the increment's success
criterion rather than an omission". A comment asserting the opposite of the code beside it is
the defect this project has already paid for — six of ten review findings on one pull request
in the source project were exactly that.

- [ ] **Step 6: Wire the composition root and the plugin**

In `composition-root.ts`: add `listProjects: new ListProjects(projects)` to
`PersistenceServices`, and a `renovationProjectDeps(root: CompositionRoot)` function beside
`planEditorDeps`, returning `unavailableRenovationProjectQueries()` when `root.persistence` is
`null` — the same total-rather-than-nullable shape, for the same stated reason.

In `RenovationPlannerPlugin.ts:127`:

```typescript
		this.registerView(
			RENOVATION_PROJECT_VIEW,
			// Per CALL, not captured — the same reason the Plan Editor's factory resolves per
			// call: `saveSettings` replaces `this.root`, and a view built against the old one
			// would read through query services pointed at the previous project folder.
			(leaf) => new RenovationProjectView(leaf, renovationProjectDeps(this.root)),
		);
```

- [ ] **Step 7: Update the three test seams**

`tests/helpers/makeRenovationProjectView.ts` — `makeView(deps?)`, defaulting to a bundle
answering `ok([])`. Extend its docblock: it already promises that "a grown constructor
requirement meets every consumer at the same time instead of fixing the suite and silently
stranding the harness page", and this is the first time that promise is called in.

`tests/harness/mount.ts` — no change if `makeView`'s parameter is optional. Keep the default
`ok([])` and note in the file that the harness page therefore shows the empty state: it is
the new thing worth looking at, and the populated surface has nothing to draw until a later
slice builds a project list (this slice explicitly does not).

`tests/presentation/views/viewRoot.test.ts` — `ViewRoot` now injects the context, so its two
existing cases need it provided via `global.provide`. Keep both assertions exactly as they
are; only the mount grows.

- [ ] **Step 8: Run the affected suites**

Run: `npx vitest run tests/presentation/views tests/harness/accessibility.test.ts tests/harness/harness.test.ts tests/plugin/registration.test.ts`
Expected: PASS. The a11y case *"reports no semantic violations on the surface
RenovationProjectView actually draws"* becomes a real check in this commit — it has been
scanning an empty pane since slice 1. If it reports `heading-order` or `page-has-heading-one`,
read that file's SCOPE paragraph before changing markup: it scans `contentEl`, a subtree, so
page-level rules are known not to fire reliably there.

- [ ] **Step 9: Commit**

```bash
git add src/presentation/views src/presentation/stores/RenovationProjectStore.ts \
        src/presentation/read-models/renovationProjectQueries.ts \
        src/plugin/composition-root.ts src/plugin/RenovationPlannerPlugin.ts \
        tests/helpers/makeRenovationProjectView.ts tests/harness/mount.ts \
        tests/presentation/views
git commit -m "feat(views): the renovation project view's first data dependency

Slice 1 reserved this seam in writing - constructor-injected query services,
\"exactly like RenovationProjectView would be once it has data needs\". This is
that need, and the seam is extended by a field rather than relocated.

The store takes a hydration ticket even with one caller today: ProjectStore
gained its second in slice 8, and a slower earlier read landing on a fresher
later one is a just-created project vanishing with no error anywhere.

The view's docblock stops claiming it draws nothing, because it does now.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Close the slice

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/tasks/14-empty-states.md` (tick the DoD)
- Modify: `vitest.config.ts` (only if the floors actually move)

- [ ] **Step 1: Run the full gate**

Run: `npm run check`
Expected: PASS — all four steps. Read the coverage summary rather than skimming it: branches
started at 98.02 against a floor of 98, so a single uncovered new arm fails here. The arms
this slice adds are the selectors' five, `resolveEmptyState`'s `actionLabel` pair, the
overlay's two gates, and the store's `failed` path; every one should already have a test from
its own task.

- [ ] **Step 2: Ratchet the floors, or record that they did not move**

Only if the measured figures round down to something higher than 99/99/99/98. The policy in
`vitest.config.ts` is explicit: floors rise to what a FINISHED increment measures, leaving at
least one covered unit of headroom, and they never fall. Slices 5 and 15 ratcheted nothing;
that is a normal outcome, not a failure.

- [ ] **Step 3: Tick the Definition of Done in the task document**

Go through all eight items against the code. Items 1, 5 and 7 are the amended ones. **Do not
tick an item the code does not satisfy** — write down what is open and why instead, the way
slice 15's document carries its two open items and names the amendment that reopened them. If
Task 6 Step 1 took outcome (a), `noBackground` has no action button and item 7's wording
already accommodates it; say so explicitly rather than leaving a reader to infer it.

- [ ] **Step 4: Write the slice's section in `CLAUDE.md`**

Follow the existing sections' shape: what landed, then the rules that came out of it, each
with the defect it prevents. The ones worth recording, because each was found by reading code
rather than by a gate:

- **An empty state that replaces a region hides the thing the region exists to show.** Both `create-sample-project` (no background, five zones) and the browser harness (which refuses a background on SDD §55 grounds) run on backgroundless plans, so replacement would have made a seeded scene unreachable and left `?view=plan-editor` drawing an empty state. Both empty states are overlays inside a canvas that always mounts; an overlay yields to an active tool, because its own button activates one.
- **A selector stays a function of query results; "is the user mid-task" is a rendering rule.** Folding `activeToolId` into `selectPlanEditorEmptyState` would have made "which state is this plan in" unanswerable without a live tool manager, for a gate the component applies in one line.
- **An absent `actionLabel` is a decision with a reason, not a gap.** `noProjects`'s hand-off is slice 16's and slice 16 depends on slice 11; `noBackground`'s picker is a plugin command the editor's Vue tree cannot reach without a new seam or the global `app`. Both render no button rather than a live control that does nothing, and `content.test.ts` asserts it so adding one is deliberate.
- **PRD §94 is one sentence and quotes nothing.** Slice 14's own document attributed a German worked example to it; the copy is ours, and `de.ts` is a translation like every other key. A citation nobody checks is the same defect as an unchecked comment.
- **The a11y case for the project surface was an adoption placeholder until this slice.** It has scanned an empty pane since slice 1; it grades real markup now.

Also correct the paragraph naming what deletes `create-sample-project`. It reads *"slice 14's
empty-state actions and slice 16's creation forms"* — slice 14's actions do not delete it,
because `noProjects` has no action at all. Narrow it to slice 16.

- [ ] **Step 5: Capture the finished surfaces**

```bash
npm run harness-shot
npm run harness-shot -- --width=460
```

Five fixed shots plus the narrow pane. Look at all of them.

- [ ] **Step 6: Verify in a real vault**

```bash
npm run test-build
```

Then in this repository as a vault: reload the plugin, open the Renovation project view on a
vault with no projects (the empty state), run `create-sample-project`, and confirm the editor
opens on the seeded plan with **the canvas visible, four zones drawn, and the `noBackground`
overlay over them** — the exact scenario that made replacement wrong. Then activate Draw zone
from the toolbar and confirm the overlay yields. `docs/tests/suites/Smoke Test the Editor.md`
is where a new case for this belongs.

- [ ] **Step 7: Commit**

```bash
git add CLAUDE.md docs/tasks/14-empty-states.md vitest.config.ts
git commit -m "docs: close design slice 14

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Merge order against slice 11

Slice 14 edits four files slice 11 also edits, all additively: `i18n/locales/en.ts`,
`i18n/locales/de.ts` (eight keys appended before a closing brace), `composition-root.ts` (one
field on `PersistenceServices`, one function beside `planEditorDeps`), and `ProjectStore.ts`
(one computed and one name in the returned object).

**Whichever branch merges second rebases.** If slice 11 lands first, expect conflicts at
exactly those four points and nowhere else; resolve by keeping both additions. If slice 14
lands first, tell the slice 11 worktree, because it is holding all four of those files open.

## Self-review notes

Checked against the amended spec:

- **Covered:** `EmptyState.vue` (Task 5), the registry with exactly three entries and no literals under `emptyStates/` (Task 4), both pure selectors including the `plan === null` case (Task 3), `ListProjects` and the view's first data dependency (Tasks 7-8), the Plan Editor's render states (Task 6), the failed-`Result` case asserted by test rather than review (Tasks 6 and 8), one hand-off per wired action (Task 6), `npm run check` (Task 9).
- **One spec item deliberately narrowed:** DoD 7's "each of the three actions" is now "each action that IS wired". `noProjects` has none by amendment 1; `noBackground` has none because slice 5's picker is a plugin command the editor's Vue tree cannot reach without a new seam (Task 6, Step 1). Both are stated in the code and in the DoD rather than resolved silently, because a rendered control that does nothing is the failure mode being avoided.
- **One instrument deliberately weakened, and said so:** DoD 6's "never reaches either selector" is held at the store (`status === 'failed'`, `emptyStateKey === null`) rather than by spying on a module export through an SFC's import binding (Task 8, Step 1). The claim is narrower than the spec's wording; the task says which and does not delete the case.
