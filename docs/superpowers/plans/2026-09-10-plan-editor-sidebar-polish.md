# Plan Editor Sidebar and Chrome Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the Plan editor's left sidebar and chrome in line with the M01 mockup: hidden Obsidian header, an iconed Pan button, a five-row user-vocabulary Layers list, a Property tree of sibling floors, and collapsible sections in a better order.

**Architecture:** Pure presentation work on the existing Vue tree. The Layers list stops keying rows by Konva layer id and keys them by a user-meaningful predicate pair (`visible()` / `toggle()`), built once in `PropertyLayerPanel` from the stores. The Property tree reads sibling plans that `ProjectStore.hydrate` now loads through one new query member, and navigates through one new `EditorNavigation` member over the existing `revealPlanEditor` seam. The Konva stack is untouched.

**Tech Stack:** Vue 3 SFCs, Pinia, vitest + jsdom, `HostIcon` over Obsidian `setIcon`, Lucide fixture SVGs for the harness, plain CSS partials under `styles/` assembled by `scripts/styles-assemble.mjs`.

**Spec:** `docs/superpowers/specs/2026-09-10-plan-editor-sidebar-polish-design.md`

## Global Constraints

- One PR off `main`. Branch: `feat/plan-editor-sidebar-polish`.
- `npm run check:fast -- <paths>` between edits; `npm run check` ONCE before the final commit, never concurrently with another gate.
- Every user-visible string goes through `tr('<key>')` with an `en` and a `de` entry, sentence case. `I18N_LITERAL_BAN` fails a literal at `.setText`/`createEl` text; Vue templates are held by convention.
- CSS: Obsidian variables only (`--text-muted`, `--background-modifier-border`, `--interactive-accent`, …). A hex or named colour fails `npm run build`. Partials cap at 400 lines.
- No `disabled` on a control that carries a reason: `aria-disabled` plus `aria-describedby`, as `LayerRow` already does.
- Files under `src/` obey `max-lines` and `max-lines-per-function` (lint reports the numbers). `tests/**` is type-checked by `npm run build`.
- The `obsidian` module is a mock in tests (`tests/helpers/obsidian-mock.ts`); `HostIcon` renders fixture SVG nodes from `tests/helpers/editorIconNodes.ts` and marks an unknown name `data-icon-missing`.
- Commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

---

## File map

| File | Responsibility after this plan |
|---|---|
| `styles/chrome.css` | Hides `.view-header` for both plugin view types; docblock says why the Plan editor's is hidden now |
| `tests/presentation/views/planEditorView.test.ts` | Pins the new selector to `PLAN_EDITOR_VIEW` |
| `src/presentation/editor/shell/FloatingPrimaryActions.vue` | Pan button carries `HostIcon name="hand"` |
| `tests/fixtures/editor-icons/hand.svg`, `tests/helpers/editorIconNodes.ts` | Harness fixture for `hand` |
| `src/presentation/stores/WorkspaceStore.ts` | New `notesVisible` ref, reset with the rest |
| `src/presentation/editor/PlanCanvas.vue` | Gates `evidencePins` on `notesVisible` |
| `src/presentation/editor/layers/layerCatalogue.ts` | `LayerEntry` with `visible()`/`toggle()`; five rows from a `LayerToggles` bundle |
| `src/presentation/editor/shell/LayerList.vue`, `LayerRow.vue` | Five-key `ids` record; row binds to the entry's predicate |
| `src/presentation/editor/shell/PropertyLayerPanel.vue` | Builds `LayerToggles`; four collapsible sections in the new order; mounts `PropertyTree` |
| `src/presentation/editor/shell/PropertyTree.vue` | Project row plus sibling floor rows, current one `aria-current` |
| `src/presentation/read-models/planEditorQueries.ts` | `listPlans(projectId)` on `PlanEditorQueryServices` |
| `src/presentation/stores/ProjectStore.ts` | `plans` ref filled by hydrate |
| `src/presentation/editor/PlanEditorContext.ts`, `src/plugin/editorWorkspaceNavigation.ts` | `EditorNavigation.plan(planId)` |
| `styles/editor-shell-fidelity.css` | Section summaries, tree rows, guide line |
| `src/presentation/i18n/locales/{en,de}/editorShell.ts` | Planned-changes label reworded; `editor.shell.elements` removed; `editor.shell.notes-layer` added |
| Spec docs M01, component library §6; `docs/development/agent-guide-increment-history.md` | Amended / appended |

---

### Task 1: Hide the Obsidian view header for the Plan editor

**Files:**
- Modify: `styles/chrome.css`
- Test: `tests/presentation/views/planEditorView.test.ts`

**Interfaces:**
- Produces: nothing code-facing; a CSS rule keyed on `PLAN_EDITOR_VIEW` (`'renovation-plan-editor'`).

- [ ] **Step 1: Write the failing test**

In `tests/presentation/views/planEditorView.test.ts`, replace the body of the case `is the view type styles/chrome.css keys its rule on` with:

```ts
	it('is the view type styles/chrome.css keys its rules on, and one of them hides the view header', () => {
		const chrome = readFileSync('styles/chrome.css', 'utf8');
		const selector = `.workspace-leaf-content[data-type="${PLAN_EDITOR_VIEW}"]`;

		expect(chrome).toContain(`${selector} .view-content`);
		// The pane title bar is hidden for this view since 2026-09-10 (sidebar polish): the
		// context bar carries the plan name and the tab strip still names the leaf.
		expect(chrome).toMatch(new RegExp(`${selector.replace(/[.[\]"]/g, '\\$&')} \\.view-header\\s*\\{\\s*display:\\s*none;`));
	});
```

- [ ] **Step 2: Run it to see it fail**

```bash
npm run check:fast -- tests/presentation/views/planEditorView.test.ts
```

Expected: FAIL on the `toMatch` (no `.view-header` rule for the plan editor).

- [ ] **Step 3: Add the rule and rewrite the docblock**

In `styles/chrome.css`, replace the whole comment block that begins `The Plan Editor is the same full-bleed case, and it KEEPS its view header` and the rule below it with:

```css
/*
 * The Plan Editor is the same full-bleed case and, since the 2026-09-10 sidebar polish, it
 * HIDES its view header too. The earlier version of this block kept it, arguing that a
 * per-plan leaf is told apart only by its title; the tab strip still names the leaf, and
 * the editor's own context bar carries the project and plan names, so the argument no
 * longer holds. What is knowingly lost with the header: the pane's own back/forward arrows
 * and its "more options" menu. Pane padding is already removed by
 * `.renovation-planner-container` above, whose class this view adds too.
 *
 * The second rule states the ONE other thing specific to this view type: its content area
 * must not scroll, because the canvas manages its own viewport and a scrollbar over it
 * would pan two things at once.
 *
 * Keyed on the view TYPE, the persisted identifier, so no other pane is touched —
 * `tests/presentation/views/planEditorView.test.ts` holds both selectors and
 * PLAN_EDITOR_VIEW together, so renaming the type fails the suite rather than silently
 * leaving the rules matching nothing.
 */
.workspace-leaf-content[data-type="renovation-plan-editor"] .view-header {
	display: none;
}

.workspace-leaf-content[data-type="renovation-plan-editor"] .view-content {
	overflow: hidden;
}
```

- [ ] **Step 4: Run the test and the build's stylesheet check**

```bash
npm run check:fast -- tests/presentation/views/planEditorView.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add styles/chrome.css tests/presentation/views/planEditorView.test.ts
git commit -m "style(chrome): hide the Obsidian view header for the plan editor

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Pan button icon and its harness fixture, plus the spec amendment

**Files:**
- Modify: `src/presentation/editor/shell/FloatingPrimaryActions.vue`
- Create: `tests/fixtures/editor-icons/hand.svg`
- Modify: `tests/helpers/editorIconNodes.ts`
- Modify: `docs/user-experience/renovation-planner-editor-specs/screens/M01-standard-plan-view.md`
- Modify: `docs/user-experience/renovation-planner-editor-specs/components/component-library.md`
- Test: `tests/presentation/editor/shell/floatingPrimaryActions.test.ts`

**Interfaces:**
- Consumes: `HostIcon` (`src/presentation/components/HostIcon.vue`, prop `name: string`), which in tests renders `<svg class="rp-host-icon" data-icon="<name>">` from `editorIconNodes` and adds `data-icon-missing` when the name has no fixture.

- [ ] **Step 1: Write the failing test**

Append to the `describe('FloatingPrimaryActions', …)` block in `tests/presentation/editor/shell/floatingPrimaryActions.test.ts`:

```ts
	/**
	 * Pan is a persistent button by decision of 2026-09-10 (user testing reversed M01's
	 * "no persistent Pan mode"), and it draws an icon like its two neighbours rather than
	 * being the one text-only control in the group. The fixture assertion is what proves the
	 * harness can draw it: `HostIcon` marks a name with no fixture `data-icon-missing`.
	 */
	it('draws Pan with the hand icon, and the harness has a fixture for it', async () => {
		const harness = await mountPlanEditorCanvas();
		const icon = harness.wrapper.find('button[data-rp-action="pan"] .rp-host-icon');

		expect(icon.exists()).toBe(true);
		expect(icon.attributes('data-icon')).toBe('hand');
		expect(icon.attributes('data-icon-missing')).toBeUndefined();
	});
```

- [ ] **Step 2: Run it to see it fail**

```bash
npm run check:fast -- tests/presentation/editor/shell/floatingPrimaryActions.test.ts
```

Expected: FAIL, `icon.exists()` is `false`.

- [ ] **Step 3: Add the icon to the button**

In `FloatingPrimaryActions.vue`, change the Pan button's content from

```vue
			{{ tr('editor.input.pan') }}
```

to

```vue
			<HostIcon name="hand" />{{ tr('editor.input.pan') }}
```

- [ ] **Step 4: Add the Lucide fixture**

Create `tests/fixtures/editor-icons/hand.svg` with the `hand` icon from the pinned Lucide revision named in `tests/fixtures/editor-icons/README.md` (`2bfb9bb1bae5d74f6a9f81640ddd8bccc2c71860`). Fetch it from
`https://raw.githubusercontent.com/lucide-icons/lucide/2bfb9bb1bae5d74f6a9f81640ddd8bccc2c71860/icons/hand.svg` and save the bytes verbatim. It is expected to read:

```svg
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2" />
  <path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2" />
  <path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8" />
  <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
</svg>
```

If the fetched file differs, the fetched bytes win and the node entry below is written from them.

Then add one entry to `editorIconNodes` in `tests/helpers/editorIconNodes.ts`, after `"house"`, transcribing each element of the SVG in order:

```ts
  "hand": [{"tag":"path","attributes":{"d":"M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2"}},{"tag":"path","attributes":{"d":"M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2"}},{"tag":"path","attributes":{"d":"M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8"}},{"tag":"path","attributes":{"d":"M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"}}],
```

- [ ] **Step 5: Run the test**

```bash
npm run check:fast -- tests/presentation/editor/shell/floatingPrimaryActions.test.ts
```

Expected: PASS.

- [ ] **Step 6: Amend the spec**

In `docs/user-experience/renovation-planner-editor-specs/screens/M01-standard-plan-view.md`:

- Replace `- Floating action control contains Select and Add.` with
  `- Floating action control contains Select, Pan and Add. Pan was added on 2026-09-10 after user testing; Space+drag and middle-drag remain the gesture routes.`
- Replace `- Opening a populated floor starts in Select with no persistent Pan mode.` with
  `- Opening a populated floor starts in Select. A persistent Pan button is offered beside it (decision of 2026-09-10, user testing); it is never the state a floor opens in.`

In `docs/user-experience/renovation-planner-editor-specs/components/component-library.md`, replace
`**Responsibility:** Keep Select and Add reachable without a permanent tool ribbon.` with
`**Responsibility:** Keep Select, Pan and Add reachable without a permanent tool ribbon. Pan joined the pair on 2026-09-10 after user testing; the interaction spec's "should not occupy primary toolbar space" is overridden by that decision for this control only.`

- [ ] **Step 7: Commit**

```bash
git add src/presentation/editor/shell/FloatingPrimaryActions.vue tests/fixtures/editor-icons/hand.svg tests/helpers/editorIconNodes.ts tests/presentation/editor/shell/floatingPrimaryActions.test.ts docs/user-experience/renovation-planner-editor-specs/screens/M01-standard-plan-view.md docs/user-experience/renovation-planner-editor-specs/components/component-library.md
git commit -m "feat(shell): give Pan its hand icon and record the spec reversal

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: `notesVisible` in the workspace store, gating evidence pins

**Files:**
- Modify: `src/presentation/stores/WorkspaceStore.ts`
- Modify: `src/presentation/editor/PlanCanvas.vue`
- Test: `tests/presentation/stores/stores.test.ts` (add cases), `tests/presentation/editor/curvedEvidencePins.test.ts` (read how pins are asserted; add one case there or in a new `tests/presentation/editor/notesLayer.test.ts`)

**Interfaces:**
- Produces: `useWorkspaceStore().notesVisible: Ref<boolean>` (default `true`, reset to `true` by `reset()`), and `toggleNotes(): void`.

- [ ] **Step 1: Write the failing store test**

Append to `tests/presentation/stores/stores.test.ts` (inside whichever `describe` covers `useWorkspaceStore`; if none, add one):

```ts
describe('WorkspaceStore notes visibility', () => {
	it('starts visible, toggles, and comes back on reset', () => {
		setActivePinia(createPinia());
		const workspace = useWorkspaceStore();

		expect(workspace.notesVisible).toBe(true);
		workspace.toggleNotes();
		expect(workspace.notesVisible).toBe(false);
		workspace.reset();
		expect(workspace.notesVisible).toBe(true);
	});
});
```

Add the imports the file lacks (`setActivePinia`, `createPinia` from `pinia`; `useWorkspaceStore` from `../../../src/presentation/stores/WorkspaceStore`).

- [ ] **Step 2: Run it to see it fail**

```bash
npm run check:fast -- tests/presentation/stores/stores.test.ts
```

Expected: FAIL, `toggleNotes` is not a function.

- [ ] **Step 3: Add the ref and the toggle**

In `WorkspaceStore.ts`, after `const gridVisible = ref(false);` add:

```ts
	/**
	 * Whether evidence pins — notes and photos — are drawn. The Layers panel's "Notes and
	 * photos" row (sidebar polish, 2026-09-10). Not a Konva layer: pins are drawn by the zone
	 * AND the annotation layers, so the gate sits where `PlanCanvas` computes the pin list
	 * rather than on either layer's `visible`.
	 */
	const notesVisible = ref(true);

	function toggleNotes(): void {
		notesVisible.value = !notesVisible.value;
	}
```

In `reset()`, add `notesVisible.value = true;` after `gridVisible.value = false;`.

In the returned object add `notesVisible,` and `toggleNotes,` after `toggleLayer,`.

- [ ] **Step 4: Gate the pins in the canvas**

In `PlanCanvas.vue`, replace

```ts
const evidencePins = useEvidencePins(() => runtime.planning.baseline.value?.plan.entity.renovation?.depth?.evidence ?? []);
```

with

```ts
const allEvidencePins = useEvidencePins(() => runtime.planning.baseline.value?.plan.entity.renovation?.depth?.evidence ?? []);
/** The Layers panel's Notes and photos row: one gate for both layers that draw pins. */
const evidencePins = computed(() => (workspace.notesVisible ? allEvidencePins.value : []));
```

Check `useEvidencePins`'s return type first (`src/presentation/editor/planning/evidencePins.ts`); if it returns a `ComputedRef`, the `.value` above is right. If it returns a plain array, drop `.value`.

- [ ] **Step 5: Write the failing canvas test**

Open `tests/presentation/editor/curvedEvidencePins.test.ts` and reuse its mount and its pin-locating helper. Add one case beside its existing ones:

```ts
	it('draws no evidence pins on either layer once Notes and photos is toggled off', async () => {
		// Mount exactly as the case above this one does, with evidence present.
		const harness = await mountWithEvidence();
		expect(countPins(harness)).toBeGreaterThan(0);

		useWorkspaceStore().toggleNotes();
		await settle();

		expect(countPins(harness)).toBe(0);
	});
```

Replace `mountWithEvidence` and `countPins` with the file's own helper names (read the file; the names above are placeholders for its existing helpers, not new ones to write). If the file has no counting helper, count `harness.stage.find('.rp-evidence-pin')` or whatever Konva `name` the pin group carries (grep `name:` in `src/presentation/editor/planning/EvidencePin*.vue`).

- [ ] **Step 6: Run both tests**

```bash
npm run check:fast -- tests/presentation/stores/stores.test.ts tests/presentation/editor/curvedEvidencePins.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/presentation/stores/WorkspaceStore.ts src/presentation/editor/PlanCanvas.vue tests/presentation/stores/stores.test.ts tests/presentation/editor/curvedEvidencePins.test.ts
git commit -m "feat(workspace): a notes-and-photos visibility gate over evidence pins

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: The layer catalogue speaks the user's vocabulary

**Files:**
- Modify: `src/presentation/editor/layers/layerCatalogue.ts`
- Modify: `src/presentation/editor/shell/LayerList.vue`
- Modify: `src/presentation/editor/shell/LayerRow.vue`
- Modify: `src/presentation/editor/shell/PropertyLayerPanel.vue`
- Modify: `src/presentation/i18n/locales/en/editorShell.ts`, `src/presentation/i18n/locales/de/editorShell.ts`
- Test: `tests/presentation/editor/layers/layerCatalogue.test.ts`, `tests/presentation/editor/shell/layerList.test.ts`, `tests/presentation/editor/shellFidelity.test.ts`

**Interfaces:**
- Produces:

```ts
export interface LayerToggle { readonly visible: () => boolean; readonly toggle: () => void }
export interface LayerToggles {
	readonly reference: LayerToggle;
	readonly rooms: LayerToggle;
	readonly walls: LayerToggle;
	/** `null` when the renovation session is not available: no row is offered. */
	readonly planned: LayerToggle | null;
	readonly notes: LayerToggle;
}
export type LayerEntryId = 'reference' | 'rooms' | 'walls' | 'planned' | 'notes';
export interface LayerEntry {
	readonly id: LayerEntryId;
	readonly labelKey: StringKey;
	readonly state: LayerEntryState;
	readonly reasonKey: StringKey | null;
	readonly action: LayerAction | null;
	readonly visible: () => boolean;
	readonly toggle: () => void;
}
export function layerCatalogue(plan: PlanDto | null, toggles: LayerToggles, writesBlocked = false): readonly LayerEntry[]
```

- Consumes: `useWorkspaceStore().layerVisibility`, `.toggleLayer`, `.notesVisible`, `.toggleNotes` (Task 3); `useRenovationSession().visible` (a `Ref<boolean>`); `useEditorRuntime().renovation.available`.

- [ ] **Step 1: Rewrite the catalogue test**

Replace the whole of `tests/presentation/editor/layers/layerCatalogue.test.ts` with:

```ts
import { describe, expect, it } from 'vitest';
import { layerCatalogue, type LayerToggle, type LayerToggles } from '../../../../src/presentation/editor/layers/layerCatalogue';
import { FIXTURE_PLAN } from '../../../helpers/planFixtures';

/** A toggle that records its own state, so each row's `toggle` can be shown to flip ITS predicate only. */
function toggle(initial = true): LayerToggle & { readonly calls: number[] } {
	let on = initial;
	const calls: number[] = [];
	return { visible: () => on, toggle: () => { on = !on; calls.push(calls.length); }, calls };
}

function toggles(planned: LayerToggle | null = toggle()): LayerToggles {
	return { reference: toggle(), rooms: toggle(), walls: toggle(), planned, notes: toggle() };
}

/**
 * The layers this editor can honestly offer, in the user's vocabulary (interaction spec §54,
 * §55): five rows, none of them a Konva layer by name. Sidebar polish, 2026-09-10.
 */
describe('layerCatalogue', () => {
	it('lists the five rows in the mockup order', () => {
		expect(layerCatalogue(FIXTURE_PLAN, toggles()).map((e) => e.id)).toEqual(['reference', 'rooms', 'walls', 'planned', 'notes']);
	});

	it('omits the Planned changes row when the renovation session is not available', () => {
		expect(layerCatalogue(FIXTURE_PLAN, toggles(null)).map((e) => e.id)).toEqual(['reference', 'rooms', 'walls', 'notes']);
	});

	it('binds each row to its own predicate and nothing else', () => {
		const t = toggles();
		const entries = layerCatalogue(FIXTURE_PLAN, t);
		const walls = entries.find((e) => e.id === 'walls')!;

		expect(walls.visible()).toBe(true);
		walls.toggle();
		expect(walls.visible()).toBe(false);
		expect(t.rooms.visible()).toBe(true);
		expect(t.notes.visible()).toBe(true);
		expect(t.reference.visible()).toBe(true);
		expect(t.planned!.visible()).toBe(true);
	});

	it('marks the reference plan supported-empty with a reason when the plan has no background, and disables Set scale', () => {
		const [reference] = layerCatalogue(FIXTURE_PLAN, toggles());
		expect(reference.state).toBe('supported-empty');
		expect(reference.reasonKey).toBe('editor.layer.reference-plan.none');
		expect(reference.action?.enabled).toBe(false);
	});

	it('offers Set scale when a background exists', () => {
		const [reference] = layerCatalogue({ ...FIXTURE_PLAN, background: { path: 'Plans/g.png', kind: 'image' } }, toggles());
		expect(reference.state).toBe('available');
		expect(reference.action).toEqual({
			labelKey: 'editor.layer.reference-plan.set-scale',
			toolId: 'calibrate',
			enabled: true,
			reasonKey: 'editor.layer.reference-plan.none',
		});
	});

	it('lists nothing for a null plan', () => {
		expect(layerCatalogue(null, toggles())).toEqual([]);
	});

	it('disables Set scale with the paused reason when writes are blocked, even with a background', () => {
		const planWithBackground = { ...FIXTURE_PLAN, background: { path: 'Plans/g.png', kind: 'image' as const } };

		const [blocked] = layerCatalogue(planWithBackground, toggles(), true);
		expect(blocked.action).toEqual({
			labelKey: 'editor.layer.reference-plan.set-scale',
			toolId: 'calibrate',
			enabled: false,
			reasonKey: 'editor.paused.reason',
		});

		const [unblocked] = layerCatalogue(planWithBackground, toggles(), false);
		expect(unblocked.action?.enabled).toBe(true);
	});

	it('keeps the no-background reason when writes are also blocked', () => {
		const [reference] = layerCatalogue(FIXTURE_PLAN, toggles(), true);
		expect(reference.action?.enabled).toBe(false);
		expect(reference.action?.reasonKey).toBe('editor.layer.reference-plan.none');
	});
});
```

- [ ] **Step 2: Run it to see it fail**

```bash
npm run check:fast -- tests/presentation/editor/layers/layerCatalogue.test.ts
```

Expected: FAIL (type errors: `LayerToggles` not exported; wrong argument shape).

- [ ] **Step 3: Rewrite the catalogue**

Replace the whole of `src/presentation/editor/layers/layerCatalogue.ts` with:

```ts
import type { StringKey } from '../../i18n/locales/en';
import type { PlanDto } from '../../read-models/PlanDto';

export type LayerEntryState = 'available' | 'supported-empty';

export interface LayerAction {
	readonly labelKey: StringKey;
	readonly toolId: 'calibrate';
	readonly enabled: boolean;
	readonly reasonKey: StringKey;
}

/** One row's own visibility: what it reads and what a click does. */
export interface LayerToggle {
	readonly visible: () => boolean;
	readonly toggle: () => void;
}

/**
 * Where each row's visibility LIVES, handed in by the panel rather than reached for here, so
 * this stays a pure function of a plan and a bundle of closures. Three are Konva layers in
 * `WorkspaceStore`, one is the renovation session's own flag and one is the store's notes gate.
 */
export interface LayerToggles {
	readonly reference: LayerToggle;
	readonly rooms: LayerToggle;
	readonly walls: LayerToggle;
	/** `null` when the renovation session is not available: no row is offered. */
	readonly planned: LayerToggle | null;
	readonly notes: LayerToggle;
}

export type LayerEntryId = 'reference' | 'rooms' | 'walls' | 'planned' | 'notes';

export interface LayerEntry {
	readonly id: LayerEntryId;
	readonly labelKey: StringKey;
	readonly state: LayerEntryState;
	/** Why the row is `supported-empty`; `null` when it is available. */
	readonly reasonKey: StringKey | null;
	readonly action: LayerAction | null;
	readonly visible: () => boolean;
	readonly toggle: () => void;
}

const AVAILABLE = { state: 'available', reasonKey: null, action: null } as const;

/**
 * The layers the user is offered, in the user's vocabulary (interaction spec §54, §55) and in
 * the M01 mockup's order: Reference plan, Rooms, Walls and openings, Planned changes, Notes and
 * photos. Sidebar polish, 2026-09-10 — until then rows were keyed by Konva layer id, which put
 * the scene's paint order in front of the user and had no way to say "Planned changes", a
 * visibility that cuts across three Konva layers.
 *
 * Set scale is the calibrate tool's ONLY door since the toolbar went (Task 13); it sits on the
 * thing being calibrated and is disabled, with a reason, while there is nothing to calibrate
 * against. `writesBlocked` (design spec §2.9) joins that reason mechanism rather than adding a
 * second one: with no background, the row's own "no background" reason stays, and the paused
 * reason applies only once there IS a background but writes are blocked anyway.
 */
export function layerCatalogue(plan: PlanDto | null, toggles: LayerToggles, writesBlocked = false): readonly LayerEntry[] {
	if (plan === null) return [];
	const hasReference = plan.background !== null;
	const entries: LayerEntry[] = [
		{
			id: 'reference',
			labelKey: 'editor.layer.reference-plan',
			state: hasReference ? 'available' : 'supported-empty',
			reasonKey: hasReference ? null : 'editor.layer.reference-plan.none',
			action: {
				labelKey: 'editor.layer.reference-plan.set-scale',
				toolId: 'calibrate',
				enabled: hasReference && !writesBlocked,
				reasonKey: hasReference && writesBlocked ? 'editor.paused.reason' : 'editor.layer.reference-plan.none',
			},
			...toggles.reference,
		},
		{ id: 'rooms', labelKey: 'editor.layer.rooms', ...AVAILABLE, ...toggles.rooms },
		{ id: 'walls', labelKey: 'editor.structure.list', ...AVAILABLE, ...toggles.walls },
	];
	if (toggles.planned !== null) entries.push({ id: 'planned', labelKey: 'editor.shell.planned-layer', ...AVAILABLE, ...toggles.planned });
	entries.push({ id: 'notes', labelKey: 'editor.shell.notes-layer', ...AVAILABLE, ...toggles.notes });
	return entries;
}
```

- [ ] **Step 4: Locale keys**

In `src/presentation/i18n/locales/en/editorShell.ts`:
- Change `'editor.shell.planned-layer': 'Planned changes and markers',` to `'editor.shell.planned-layer': 'Planned changes',`
- Add `'editor.shell.notes-layer': 'Notes and photos',` after it.
- Delete `'editor.shell.elements': 'Elements',` (its only consumer goes in this task).

In `src/presentation/i18n/locales/de/editorShell.ts`:
- Change the planned-layer value to `'Geplante Änderungen',`
- Add `'editor.shell.notes-layer': 'Notizen und Fotos',`
- Delete the `'editor.shell.elements'` line.

- [ ] **Step 5: LayerList's total ids record**

In `LayerList.vue`, replace the `ids` declaration with:

```ts
const ids: Record<LayerEntryId, { readonly checkbox: string; readonly reason: string; readonly actionReason: string }> = {
	reference: { checkbox: useId(), reason: useId(), actionReason: useId() },
	rooms: { checkbox: useId(), reason: useId(), actionReason: useId() },
	walls: { checkbox: useId(), reason: useId(), actionReason: useId() },
	planned: { checkbox: useId(), reason: useId(), actionReason: useId() },
	notes: { checkbox: useId(), reason: useId(), actionReason: useId() },
};
```

and change the import to `import type { LayerEntry, LayerEntryId } from '../layers/layerCatalogue';`. In its docblock, change "grows to two once it has" to "grows to five once it has" and "Three ids per entry" stays.

- [ ] **Step 6: LayerRow binds to the entry**

In `LayerRow.vue`:
- Remove `import { storeToRefs } from 'pinia';`, `import { useWorkspaceStore } …`, `const workspace = useWorkspaceStore();` and `const { layerVisibility } = storeToRefs(workspace);`.
- Change the checkbox to `:checked="entry.visible()"` and `@change="entry.toggle()"`.
- Change the label's icon to `<HostIcon :name="entry.visible() ? 'eye' : 'eye-off'" />`.

- [ ] **Step 7: The panel builds the toggles and drops the separate checkbox**

In `PropertyLayerPanel.vue`'s script, replace

```ts
const entries = computed(() => layerCatalogue(props.plan, stale.value));
```

with

```ts
const workspace = useWorkspaceStore();
const konva = (layer: KonvaLayerId): LayerToggle => ({
	visible: () => workspace.layerVisibility[layer],
	toggle: () => workspace.toggleLayer(layer),
});
/** Every row's home, in one place: three Konva layers, the session flag, the notes gate. */
const toggles = computed<LayerToggles>(() => ({
	reference: konva('background'),
	rooms: konva('zone'),
	walls: konva('architecture'),
	planned: runtime.renovation.available ? { visible: () => session.visible, toggle: () => { session.visible = !session.visible; } } : null,
	notes: { visible: () => workspace.notesVisible, toggle: workspace.toggleNotes },
}));
const entries = computed(() => layerCatalogue(props.plan, toggles.value, stale.value));
```

Add imports: `import { useWorkspaceStore } from '../../stores/WorkspaceStore';`, `import type { KonvaLayerId } from '../scene/KonvaLayers';`, and change the catalogue import to `import { layerCatalogue, type LayerToggle, type LayerToggles } from '../layers/layerCatalogue';`.

Check how `session.visible` is exposed: `useRenovationSession` returns a Pinia store, so `session.visible` is an unwrapped boolean and assignment works. If `runtime.renovation.available` is a `Ref`, read `.value`; grep `available` in `src/presentation/editor/runtime.ts` to confirm.

In the template, delete the whole `<label v-if="runtime.renovation.available" class="rp-layer-toggle">…</label>` block (the checkbox bound to `session.visible`). Leave the rest of the template alone for now; Task 7 restructures it.

- [ ] **Step 8: Update the two tests that drove the old checkbox**

In `tests/presentation/editor/shell/layerList.test.ts`, first case: change `expect(boxes).toHaveLength(2);` to `expect(boxes).toHaveLength(4);` with a comment `// reference, rooms, walls, notes — the fixture editor has no renovation session, so no Planned row` (verify by reading the result; if the fixture editor DOES offer a session, the count is 5 and the comment says so). Keep `boxes[1]` as the Rooms row.

In `tests/presentation/editor/shellFidelity.test.ts`, the case `keeps the accessible element list in a disclosure and layer visibility separate from saved data`: replace

```ts
	const visibility = rig.wrapper.get('.rp-property-layers > .rp-layer-toggle input');
```

with

```ts
	const visibility = rig.wrapper.findAll('.rp-layer-list input[type="checkbox"]')[3];
```

with the comment `// Planned changes is the fourth row (reference, rooms, walls, planned, notes)`.

- [ ] **Step 9: Run the affected suites**

```bash
npm run check:fast -- tests/presentation/editor/layers tests/presentation/editor/shell tests/presentation/editor/shellFidelity.test.ts tests/presentation/editor/nativeShellInputBoundaries.test.ts tests/harness/accessibility.test.ts
```

Expected: PASS. If a test elsewhere greps for `editor.shell.elements`, it fails here and is fixed in Task 7; note it and continue.

- [ ] **Step 10: Commit**

```bash
git add src/presentation/editor/layers/layerCatalogue.ts src/presentation/editor/shell/LayerList.vue src/presentation/editor/shell/LayerRow.vue src/presentation/editor/shell/PropertyLayerPanel.vue src/presentation/i18n/locales/en/editorShell.ts src/presentation/i18n/locales/de/editorShell.ts tests/presentation/editor/layers/layerCatalogue.test.ts tests/presentation/editor/shell/layerList.test.ts tests/presentation/editor/shellFidelity.test.ts
git commit -m "feat(layers): five user-vocabulary rows with their own visibility predicates

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Sibling plans reach the store

**Files:**
- Modify: `src/presentation/read-models/planEditorQueries.ts`
- Modify: `src/plugin/composition-root.ts` (pass `listPlansByProject`)
- Modify: `src/presentation/stores/ProjectStore.ts`
- Modify: `tests/helpers/planFixtures.ts`, `tests/harness/planEditor.ts`
- Test: `tests/presentation/stores/projectStore.test.ts`

**Interfaces:**
- Produces: `PlanEditorQueryServices.listPlans(projectId: string): Promise<Result<readonly PlanDto[], RepositoryError>>`; `useProjectStore().plans: Ref<readonly PlanDto[]>`.
- Consumes: `ListPlansByProject` (`src/application/queries/ListPlansByProject.ts`, `execute({ projectId }) → Result<{ plans: Plan[]; unreadable: number }>`), already guarded and exposed as `guarded.queries.listPlansByProject` in `composition-root.ts` (grep `listPlansByProject:` there to confirm the bundle it sits in).

- [ ] **Step 1: Write the failing store test**

Append to `tests/presentation/stores/projectStore.test.ts` (reuse its existing `setActivePinia`/`fakeQueries` setup; the names below are the file's own):

```ts
	it('loads the project\'s sibling plans beside the plan on a successful hydrate, and blanks them on failure', async () => {
		const sibling: PlanDto = { ...FIXTURE_PLAN, id: 'plan-first', name: 'First floor' };
		const store = useProjectStore();
		await store.hydrate({ ...fakeQueries(FIXTURE_PLAN), listPlans: () => Promise.resolve(ok([FIXTURE_PLAN, sibling])) }, FIXTURE_PLAN.id);

		expect(store.plans.map((p) => p.id)).toEqual(['plan-ground', 'plan-first']);

		await store.hydrate({ ...fakeQueries(FIXTURE_PLAN), getPlan: () => Promise.resolve(err({ category: 'Persistence', code: 'vault.unexpected-failure', message: 'io' })) }, FIXTURE_PLAN.id);

		expect(store.plans).toEqual([]);
	});

	it('answers an empty sibling list, not a failure, when the plan listing itself refuses', async () => {
		const store = useProjectStore();
		await store.hydrate({ ...fakeQueries(FIXTURE_PLAN), listPlans: () => Promise.resolve(err({ category: 'Persistence', code: 'vault.unexpected-failure', message: 'io' })) }, FIXTURE_PLAN.id);

		expect(store.status).toBe('ready');
		expect(store.plans).toEqual([]);
	});
```

Import `PlanDto`, `ok`, `err` as the file's neighbours do.

- [ ] **Step 2: Run it to see it fail**

```bash
npm run check:fast -- tests/presentation/stores/projectStore.test.ts
```

Expected: FAIL (`listPlans` not on the type; `store.plans` undefined).

- [ ] **Step 3: Add the query member**

In `planEditorQueries.ts`:

On `PlanEditorQueryServices`, after `getProject`, add:

```ts
	/**
	 * Every plan of a project, for the Property tree's sibling floors (sidebar polish,
	 * 2026-09-10). Loaded plans only: the refused count is the project detail state's to
	 * report, and this surface draws a tree, not a warning.
	 */
	listPlans(projectId: string): Promise<Result<readonly PlanDto[], RepositoryError>>;
```

In `unavailablePlanEditorQueries()` add `listPlans: refuseUnrecovered,`.

In `createPlanEditorQueries`'s parameter type add, after `findZonesByPlan`:

```ts
	/** Optional for the same reason the slice-10 members are: test rigs that draw no tree answer empty. */
	readonly listPlansByProject?: Query<ListPlansByProjectInput, Result<PlanListResult, RepositoryError>>;
```

with `import type { ListPlansByProjectInput, PlanListResult } from '../../application/queries/ListPlansByProject';`.

In the returned object, after `getProject`, add:

```ts
		async listPlans(projectId) {
			const listed = queries.listPlansByProject;
			if (!listed) return ok([]);
			const found = await listed.execute({ projectId: projectId as ProjectId });
			if (isErr(found)) return found;
			return ok(found.value.plans.map(toPlanDto));
		},
```

- [ ] **Step 4: Wire it in the composition root**

In `src/plugin/composition-root.ts`, the `createPlanEditorQueries({ geometry: …, ...guarded.queries, ...guarded.requirementQueries })` call: confirm with `grep -n "listPlansByProject" src/plugin/guardedServices.ts` which bundle carries `listPlansByProject`. If it is inside `guarded.queries`, nothing changes. If it is in another bundle, add `listPlansByProject: guarded.<bundle>.listPlansByProject,` to the call.

- [ ] **Step 5: Fakes answer it**

In `tests/helpers/planFixtures.ts`'s `fakeQueries`, after `getProject`, add `listPlans: () => Promise.resolve(ok(plan ? [plan] : [])),`.

In `tests/harness/planEditor.ts`'s query object, after `getProject`, add `listPlans: () => Promise.resolve(ok([structuredClone(HARNESS_PLAN)])),`.

- [ ] **Step 6: The store loads it**

In `ProjectStore.ts`:

- Add `readonly plans: Ref<readonly PlanDto[]>;` to `HydrationMissingRefs` and `HydrationRefs`.
- In `markMissing`, add `refs.plans.value = [];` after `refs.plan.value = null;`.
- In `runHydrationReads`, after the `foundProject` null check and before `const foundZones`, add:

```ts
	// Siblings are decoration on the tree, never a reason to fail the canvas: a refused
	// listing leaves an empty tree beside a drawn floor.
	const foundPlans = await queries.listPlans(foundPlan.value.projectId);
	if (ticket.superseded()) return;
	const siblings = isErr(foundPlans) ? [] : foundPlans.value;
```

and in the success block, after `refs.plan.value = foundPlan.value;`, add `refs.plans.value = siblings;`.

- In the store body: `const plans = ref<readonly PlanDto[]>([]);` after `const plan = …`; `plans.value = [];` in `fail()` after `plan.value = null;`; add `plans` to the `refs` bundle literal in `hydrate` and to the returned object after `plan,`. Check `reset()` (grep it) and blank `plans` there too if it blanks `plan`.

- [ ] **Step 7: Run the store suites and the build**

```bash
npm run check:fast -- tests/presentation/stores tests/presentation/editor/planEditorFailure.test.ts tests/presentation/editor/stalePath.e2e.test.ts
```

Expected: PASS. `vue-tsc` in `check:fast` catches any `PlanEditorQueryServices` literal that lacks `listPlans` — fix each by spreading `fakeQueries(...)` or adding the member.

- [ ] **Step 8: Commit**

```bash
git add src/presentation/read-models/planEditorQueries.ts src/plugin/composition-root.ts src/presentation/stores/ProjectStore.ts tests/helpers/planFixtures.ts tests/harness/planEditor.ts tests/presentation/stores/projectStore.test.ts
git commit -m "feat(store): hydrate a project's sibling plans for the property tree

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: `EditorNavigation.plan` and the Property tree

**Files:**
- Modify: `src/presentation/editor/PlanEditorContext.ts`
- Modify: `src/plugin/editorWorkspaceNavigation.ts`
- Create: `src/presentation/editor/shell/PropertyTree.vue`
- Modify: `src/presentation/editor/shell/PropertyLayerPanel.vue`
- Test: create `tests/presentation/editor/shell/propertyTree.test.ts`; modify `tests/plugin/editorWorkspaceNavigation.test.ts` if it exists (grep), else `tests/plugin/planEditorDeps.test.ts`

**Interfaces:**
- Produces: `EditorNavigation.plan?(planId: string): Promise<void>`; `PropertyTree.vue` (no props; reads `ProjectStore.project`, `.plan`, `.plans` and `usePlanEditorContext().navigation`).
- Consumes: `renovationProjectOpenPlan(workspace, logger)` from `src/plugin/renovationProjectOpenSeams.ts`, `(planId, origin?) => Promise<'opened' | 'failed'>`.

- [ ] **Step 1: Write the failing tree test**

Create `tests/presentation/editor/shell/propertyTree.test.ts`:

```ts
// @vitest-environment jsdom
/**
 * The Property tree (M01, sidebar polish 2026-09-10): the project row, then every plan of
 * the project as a sibling floor, the current one marked `aria-current`. Navigation goes
 * through the ONE `navigation.plan` door; without one the rows are text.
 */
import { describe, expect, it, vi } from 'vitest';
import { ok } from '../../../../src/core/result/Result';
import type { PlanDto } from '../../../../src/presentation/read-models/PlanDto';
import { fakeQueries, FIXTURE_PLAN } from '../../../helpers/planFixtures';
import { mountPlanEditorCanvas } from '../../../helpers/editor';

const FIRST: PlanDto = { ...FIXTURE_PLAN, id: 'plan-first', name: 'First floor' };
const queries = () => ({ ...fakeQueries(FIXTURE_PLAN), listPlans: () => Promise.resolve(ok([FIXTURE_PLAN, FIRST])) });

describe('PropertyTree', () => {
	it('lists the project, then each plan as a floor with the open one current', async () => {
		const harness = await mountPlanEditorCanvas({ queries: queries() });
		const tree = harness.wrapper.get('.rp-property-tree');

		expect(tree.get('.rp-property-tree__project').text()).toContain('Willow House');
		const floors = tree.findAll('.rp-property-tree__floor');
		expect(floors.map((f) => f.text())).toEqual(['Ground floor', 'First floor']);
		expect(floors[0].attributes('aria-current')).toBe('page');
		expect(floors[1].attributes('aria-current')).toBeUndefined();
	});

	it('opens a sibling floor through navigation.plan', async () => {
		const plan = vi.fn(() => Promise.resolve());
		const harness = await mountPlanEditorCanvas({
			queries: queries(),
			navigation: { project: () => Promise.resolve(), library: () => {}, plan },
		});

		await harness.wrapper.findAll('.rp-property-tree__floor')[1].trigger('click');

		expect(plan).toHaveBeenCalledWith('plan-first');
	});

	it('draws the floors as text when the leaf has no navigation', async () => {
		const harness = await mountPlanEditorCanvas({ queries: queries() });

		expect(harness.wrapper.findAll('button.rp-property-tree__floor')).toHaveLength(0);
		expect(harness.wrapper.findAll('.rp-property-tree__floor')).toHaveLength(2);
	});
});
```

Check `EditorHarnessOptions` in `tests/helpers/editor.ts` for the exact `navigation` option shape and adjust the literal (it is typed `EditorNavigation`, whose required members are `project` and `library`).

- [ ] **Step 2: Run it to see it fail**

```bash
npm run check:fast -- tests/presentation/editor/shell/propertyTree.test.ts
```

Expected: FAIL (`.rp-property-tree` not found; `plan` not on `EditorNavigation`).

- [ ] **Step 3: The navigation member**

In `PlanEditorContext.ts`, add to `EditorNavigation`:

```ts
	/** Open (or reveal) another plan's editor leaf — the Property tree's sibling floors. */
	plan?(planId: string): Promise<void>;
```

In `src/plugin/editorWorkspaceNavigation.ts`, add to the returned object:

```ts
		plan: async (planId) => { await renovationProjectOpenPlan(workspace, logger)(planId); },
```

with `import { renovationProjectOpenPlan, renovationProjectOpenAssetLibrary } from './renovationProjectOpenSeams';` (merge into the existing import).

- [ ] **Step 4: The component**

Create `src/presentation/editor/shell/PropertyTree.vue`:

```vue
<script setup lang="ts">
/**
 * M01's Property tree, sidebar polish 2026-09-10: the project, then every plan of it as a
 * sibling floor. The domain has no Building between the two, so the tree is two levels.
 *
 * Rows are buttons only when the leaf carries a `navigation` — the harness index mounts
 * this panel with none, and a button that does nothing is the live-control-that-does-nothing
 * shape slice 14 refused. `aria-current="page"` marks the plan this leaf shows.
 *
 * Deferred, and said here rather than promised: full `role="tree"` with arrow-key roving
 * (component library §4 `PropertyTree`). A nested list of buttons is Tab-reachable today;
 * the roving tabindex arrives when a third level does.
 */
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import HostIcon from '../../components/HostIcon.vue';
import { tr } from '../../i18n/strings';
import { usePlanEditorContext } from '../PlanEditorContext';
import { useProjectStore } from '../../stores/ProjectStore';

const { project, plan, plans } = storeToRefs(useProjectStore());
const context = usePlanEditorContext();
const openPlan = context.navigation?.plan;
/** The listing may be empty on a rig that answers no siblings; the open plan is always a floor. */
const floors = computed(() => (plans.value.length > 0 ? plans.value : plan.value ? [plan.value] : []));
</script>

<template>
	<div class="rp-property-tree">
		<button
			v-if="project && context.navigation"
			type="button"
			class="rp-property-tree__project"
			@click="context.navigation.project(project.id)"
		>
			<HostIcon name="house" />{{ project.name }}
		</button>
		<p
			v-else-if="project"
			class="rp-property-tree__project"
		>
			<HostIcon name="house" />{{ project.name }}
		</p>
		<ul class="rp-property-tree__floors">
			<li
				v-for="floor in floors"
				:key="floor.id"
			>
				<button
					v-if="openPlan && floor.id !== plan?.id"
					type="button"
					class="rp-property-tree__floor"
					@click="openPlan(floor.id)"
				>
					<HostIcon name="grid-2x-2" />{{ floor.name }}
				</button>
				<p
					v-else
					class="rp-property-tree__floor"
					:aria-current="floor.id === plan?.id ? 'page' : undefined"
				>
					<HostIcon name="grid-2x-2" />{{ floor.name || tr('editor.floor') }}
				</p>
			</li>
		</ul>
	</div>
</template>
```

Note the current floor is always a `<p>` with `aria-current`, never a button: pressing it would reveal the leaf already in front.

- [ ] **Step 5: Mount it in the panel**

In `PropertyLayerPanel.vue`, replace the whole `<section class="rp-property-context">…</section>` block with:

```vue
		<section class="rp-property-context">
			<h2 class="rp-editor-panel-title">
				{{ tr('editor.shell.property') }}
			</h2>
			<PropertyTree />
		</section>
```

Add `import PropertyTree from './PropertyTree.vue';` and remove the now-unused `project` from `storeToRefs(useProjectStore())` (keep `stale`) and the unused `HostIcon` import if nothing else in the file uses it. Lint reports either as unused.

- [ ] **Step 6: Run the tests**

```bash
npm run check:fast -- tests/presentation/editor/shell tests/plugin tests/harness/accessibility.test.ts
```

Expected: PASS. If a `tests/plugin/*` case asserts the exact member set of `editorWorkspaceNavigation`, add `plan` to it.

- [ ] **Step 7: Commit**

```bash
git add src/presentation/editor/PlanEditorContext.ts src/plugin/editorWorkspaceNavigation.ts src/presentation/editor/shell/PropertyTree.vue src/presentation/editor/shell/PropertyLayerPanel.vue tests/presentation/editor/shell/propertyTree.test.ts
git commit -m "feat(shell): a property tree of sibling floors with navigation

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Collapsible sections in the mockup order, and their styles

**Files:**
- Modify: `src/presentation/editor/shell/PropertyLayerPanel.vue`
- Modify: `styles/editor-shell-fidelity.css`
- Test: `tests/presentation/editor/shellFidelity.test.ts`, `tests/presentation/editor/nativeShellInputBoundaries.test.ts`, `tests/presentation/editor/shell/multiSelectionInspector.test.ts`, create `tests/presentation/editor/shell/sidebarSections.test.ts`

**Interfaces:**
- Produces: four `<details class="rp-sidebar-section">` elements with modifier classes `rp-property-context`, `rp-property-layers`, `rp-property-rooms`, `rp-property-elements`, in that order; the first three `open` by default.

- [ ] **Step 1: Write the failing section test**

Create `tests/presentation/editor/shell/sidebarSections.test.ts`:

```ts
// @vitest-environment jsdom
/**
 * The sidebar's four sections (sidebar polish 2026-09-10), every one collapsible, in the
 * order the user ranked them: Property, Layers (with the legend at its foot), Rooms and
 * areas, Walls and openings. The first three open; the walls list closed, because it is the
 * keyboard route to walls rather than something the mockup draws at rest.
 */
import { describe, expect, it } from 'vitest';
import { mountPlanEditorCanvas } from '../../../helpers/editor';

describe('sidebar sections', () => {
	it('draws four collapsible sections in order with the walls list closed', async () => {
		const harness = await mountPlanEditorCanvas();
		const sections = harness.wrapper.findAll('.rp-editor-layers > details.rp-sidebar-section');

		expect(sections.map((s) => s.classes().find((c) => c.startsWith('rp-property-')))).toEqual([
			'rp-property-context',
			'rp-property-layers',
			'rp-property-rooms',
			'rp-property-elements',
		]);
		expect(sections.map((s) => s.attributes('open') !== undefined)).toEqual([true, true, true, false]);
		expect(sections.every((s) => s.find('summary').exists())).toBe(true);
	});

	it('keeps the change legend inside the Layers section', async () => {
		const harness = await mountPlanEditorCanvas();
		const layers = harness.wrapper.get('.rp-property-layers');
		// The legend only draws with a renovation session; when absent, nothing else may draw it either.
		expect(harness.wrapper.findAll('.rp-change-legend').length).toBe(layers.findAll('.rp-change-legend').length);
	});
});
```

- [ ] **Step 2: Run it to see it fail**

```bash
npm run check:fast -- tests/presentation/editor/shell/sidebarSections.test.ts
```

Expected: FAIL (no `details.rp-sidebar-section`).

- [ ] **Step 3: Restructure the panel template**

Replace the whole `<template>` of `PropertyLayerPanel.vue` with:

```vue
<template>
	<aside
		class="rp-editor-layers"
		tabindex="-1"
		data-rp-region="layers"
		:aria-label="tr('editor.property-panel')"
	>
		<details
			class="rp-sidebar-section rp-property-context"
			open
		>
			<summary class="rp-editor-panel-title">
				{{ tr('editor.shell.property') }}
			</summary>
			<PropertyTree />
		</details>
		<details
			class="rp-sidebar-section rp-property-layers"
			open
		>
			<summary class="rp-editor-panel-title">
				{{ tr('editor.rail.layers') }}
			</summary>
			<LayerList
				v-if="session.perspective !== 'review'"
				:entries="entries"
				:plan="plan"
				@activate-tool="runtime.setTool"
			/>
			<details
				v-if="session.perspective !== 'review'"
				class="rp-reference-options"
			>
				<summary>{{ tr('editor.shell.reference-options') }}</summary>
				<ReferenceAction />
			</details>
			<ChangeLegend v-if="runtime.renovation.available" />
		</details>
		<details
			class="rp-sidebar-section rp-property-rooms"
			open
		>
			<summary class="rp-editor-panel-title">
				{{ tr('editor.selection.records') }}
			</summary>
			<RoomSummaryList
				v-if="records.length > 0"
				:records="records"
				:heading="tr('editor.selection.records')"
				:toggle-selection="toggleSelection"
			/>
			<label v-if="records.length > 1">
				<input
					v-model="toggleSelection"
					type="checkbox"
					data-rp-action="multiple-selection"
				>
				{{ tr('editor.selection.toggle-mode') }}
			</label>
			<p v-if="records.length > 1">
				{{ tr('editor.selection.hint') }}
			</p>
		</details>
		<details class="rp-sidebar-section rp-property-elements">
			<summary class="rp-editor-panel-title">
				{{ tr('editor.structure.list') }}
			</summary>
			<StructureList />
		</details>
	</aside>
</template>
```

`RoomSummaryList` draws its own `<h3>` heading from the `heading` prop; the section summary now says the same words above it. Open `RoomSummaryList.vue` and, if its heading is a required prop, keep passing it but hide the duplicate with a scoped rule in step 5 (`.rp-property-rooms .rp-room-summary-list > h3 { display: none }` — read the actual class name in that SFC). If the prop is optional, omit it instead. `StructureList.vue` draws its own `<h3>` for walls too; treat it the same way.

- [ ] **Step 4: Fix the tests that addressed the old markup**

`tests/presentation/editor/shellFidelity.test.ts`, case `keeps the accessible element list in a disclosure…`: the room row now lives in `.rp-property-rooms` (open), and walls are the closed disclosure. Replace the first three lines of the body with:

```ts
	const walls = rig.wrapper.get('.rp-property-elements');
	expect(walls.attributes('open')).toBeUndefined();
	expect(rig.wrapper.get('.rp-property-rooms').find(`[data-rp-id="${rig.room.id}"]`).exists()).toBe(true);
```

`tests/presentation/editor/nativeShellInputBoundaries.test.ts` line 61-62 already opens `.rp-property-elements > summary` before focusing a wall row; unchanged.

`tests/presentation/editor/shell/multiSelectionInspector.test.ts` finds `.rp-editor-layers [data-rp-id="zone-kitchen"]`; the room list is open by default so it still resolves. Run and confirm.

- [ ] **Step 5: Styles**

In `styles/editor-shell-fidelity.css`, replace the first rule (`.rp-property-context { padding-bottom … }`) and the `.rp-property-context__project` / `__floor` rules (lines 2-14) with:

```css
.renovation-plan-editor .rp-sidebar-section { padding-block: 12px; border-bottom: 1px solid var(--background-modifier-border); }
.renovation-plan-editor .rp-sidebar-section:last-child { border-bottom: 0; }
.renovation-plan-editor .rp-sidebar-section > summary {
	display: flex; align-items: center; gap: 6px; margin: 0; padding-block: 6px; cursor: pointer; list-style: none;
}
.renovation-plan-editor .rp-sidebar-section > summary::-webkit-details-marker { display: none; }
.renovation-plan-editor .rp-sidebar-section > summary::after {
	content: ''; margin-inline-start: auto; width: 8px; height: 8px;
	border-inline-end: 2px solid var(--text-muted); border-block-end: 2px solid var(--text-muted);
	transform: rotate(-45deg); transition: transform 120ms ease;
}
.renovation-plan-editor .rp-sidebar-section[open] > summary::after { transform: rotate(45deg); }
.renovation-plan-editor .rp-sidebar-section > summary:focus-visible { outline: 2px solid var(--interactive-accent); outline-offset: 2px; }
.renovation-plan-editor .rp-property-tree__project,
.renovation-plan-editor .rp-property-tree__floor {
	display: flex; align-items: center; gap: 10px; width: 100%; min-height: 36px;
	margin: 2px 0; padding: 8px; height: auto; white-space: normal; text-align: start;
	color: var(--text-normal); background: transparent; border: 1px solid transparent; box-shadow: none; border-radius: var(--radius-s);
}
.renovation-plan-editor .rp-property-tree__floors {
	list-style: none; margin: 0; padding: 0 0 0 14px;
	border-inline-start: 1px solid var(--background-modifier-border); margin-inline-start: 12px;
}
.renovation-plan-editor .rp-property-tree__floor[aria-current="page"] {
	background: var(--background-modifier-active-hover); border-color: var(--background-modifier-border);
	font-weight: var(--font-semibold);
}
.renovation-plan-editor button.rp-property-tree__project:hover,
.renovation-plan-editor button.rp-property-tree__floor:hover { background: var(--background-modifier-hover); }
.renovation-plan-editor button.rp-property-tree__project:focus-visible,
.renovation-plan-editor button.rp-property-tree__floor:focus-visible { outline: 2px solid var(--interactive-accent); outline-offset: 2px; }
```

Then:
- Change `.renovation-plan-editor .rp-property-layers { padding-block: 20px 12px; }` to `.renovation-plan-editor .rp-property-layers .rp-layer-list { margin-top: 4px; }`.
- Delete the `.rp-property-elements { border-top …; margin-top: 20px; }` rule and the `.rp-property-elements > summary { font-weight … }` rule (the shared section rule covers both). Keep the `> label` and `> p` rules but re-key them on `.rp-property-rooms`.
- Change `.rp-change-legend { … margin-top: 18px; }` to `margin-top: 12px`.
- Add the heading-hiding rule from step 3 if needed.

Check `styles/editor-visual-shell.css:65` and `styles/editor.css:100` for `.rp-editor-panel-title`: it was an `<h2>` and is a `<summary>` now; if either rule sets `display: block` or margins that fight the flex summary above, override them in this partial under `.rp-sidebar-section > summary.rp-editor-panel-title`.

Also grep `styles/` for `rp-property-context__project` and `rp-property-context__floor` and delete any remaining rules (`grep -rn "rp-property-context__" styles/`); the harness's `tests/build/prototype-styles.test.ts` and the assembler refuse nothing about orphaned selectors, but a dead rule is a lie the next reader believes.

- [ ] **Step 6: Run the sidebar suites and the build**

```bash
npm run check:fast -- tests/presentation/editor/shell tests/presentation/editor/shellFidelity.test.ts tests/presentation/editor/nativeShellInputBoundaries.test.ts tests/harness
```

Expected: PASS, including every `accessibility*.test.ts` (a `<summary>` with text is an accessible control; axe's `heading-order` no longer sees `<h2>`s here, which is fine because the Inspector's headings start at `h2` on their own — if `heading-order` fires, make the summary contain an `<h2>` rather than carry the class itself).

- [ ] **Step 7: Commit**

```bash
git add src/presentation/editor/shell/PropertyLayerPanel.vue styles/editor-shell-fidelity.css tests/presentation/editor/shell/sidebarSections.test.ts tests/presentation/editor/shellFidelity.test.ts
git commit -m "feat(shell): collapsible sidebar sections in the mockup order

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Captures, records, and the full gate

**Files:**
- Modify: `docs/development/agent-guide-increment-history.md`
- Modify: `docs/superpowers/specs/2026-09-10-plan-editor-sidebar-polish-design.md` (only if a deviation from it was needed above; record it under a `## Deviations` heading)

- [ ] **Step 1: Capture the editor before and after**

```bash
git stash list
```

Then, on `main` (a second worktree is fine: `git worktree add .worktrees/before main`), run in that tree:

```bash
npm run harness-shot
```

and copy `harness-shots/plan-editor-light.png`, `plan-editor-dark.png` aside as `before-*.png`. Back on the branch:

```bash
npm run harness-shot
```

and

```bash
npm run harness-shot -- --width=460
```

Open the four `plan-editor-*` PNGs and the 460 ones. Look for: a section summary wrapping, the tree guide line misaligned with the floor rows, the legend crowding the Reference options disclosure, the Pan icon sitting at a different baseline from Select's, the notice region overlapping the walls summary at 460. Fix anything found in `styles/editor-shell-fidelity.css` and re-capture. If Chromium is absent, `RP_CHROMIUM_EXECUTABLE=<path>` names one; if none is available, say so in the PR description as an outstanding check rather than claiming the captures were read.

- [ ] **Step 2: Increment history entry**

Append to `docs/development/agent-guide-increment-history.md`:

```markdown
## Plan editor sidebar and chrome polish, 2026-09-10

Spec: `docs/superpowers/specs/2026-09-10-plan-editor-sidebar-polish-design.md`. One PR.

What landed: the Plan editor hides Obsidian's view header (reversing `styles/chrome.css`'s
recorded argument for keeping it; the tab strip and the context bar both still name the plan);
Pan draws a `hand` icon and STAYS in the floating actions by a user-testing decision that
reverses M01's "no persistent Pan mode" — M01 and component library §6 carry the dated
amendment; the Layers list is five user-vocabulary rows (`layerCatalogue` takes a
`LayerToggles` bundle of `visible()`/`toggle()` closures and no longer names a Konva layer),
with "Planned changes" folded into the list and a new "Notes and photos" row over
`WorkspaceStore.notesVisible`, gated once where `PlanCanvas` computes evidence pins; a
`PropertyTree` of the project's sibling plans (`PlanEditorQueryServices.listPlans` →
`ProjectStore.plans`, navigation through the new `EditorNavigation.plan` over
`revealPlanEditor`); and every sidebar section is a `<details>` in the order Property,
Layers (legend at its foot), Rooms and areas, Walls and openings, the last one closed.

What was deferred and why: the mockup's reference-layer lock (interaction spec §56, nothing
today mis-drags a reference); `role="tree"` with arrow-key roving on the Property tree (two
levels, Tab-reachable buttons; the roving arrives with a third level); grouped layers per §54
(five rows do not need headings).

Lesson: the Konva seven-layer stack was never the problem — it is a paint order (SDD §17) and
correct. What was wrong was the PANEL borrowing its vocabulary, which made "Planned changes",
a visibility cutting across three layers, impossible to offer as a row. Keying a row by a
predicate rather than by a scene id is what made the fifth row cost one `ref`.
```

- [ ] **Step 3: The full gate, alone**

Confirm no other gate is running (`tasklist | findstr node` on Windows, or `ps aux | grep vitest`). Then:

```bash
npm run check
```

Expected: all four steps green. If coverage drops below a floor, read `coverage/coverage-final.json` for the changed files (`layerCatalogue.ts`, `PropertyTree.vue`, `PropertyLayerPanel.vue`, `ProjectStore.ts`, `planEditorQueries.ts`, `WorkspaceStore.ts`) and add a case for the uncovered arm rather than lowering a floor.

- [ ] **Step 4: Commit the records**

```bash
git add docs/development/agent-guide-increment-history.md docs/superpowers/specs/2026-09-10-plan-editor-sidebar-polish-design.md
git commit -m "docs: record the sidebar polish increment

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

- [ ] **Step 5: Open the PR**

```bash
git push -u origin feat/plan-editor-sidebar-polish
```

```bash
gh pr create --title "Plan editor sidebar and chrome polish" --body-file - <<'EOF'
Closes the six M01 divergences the 2026-09-10 screenshot showed. Spec: docs/superpowers/specs/2026-09-10-plan-editor-sidebar-polish-design.md.

- Obsidian view header hidden for the Plan editor (pane arrows and ⋮ menu go with it)
- Pan keeps its place and gains the hand icon; M01 and component library §6 amended
- Layers: five user-vocabulary rows with their own predicates; Notes and photos is new
- Property tree of sibling floors, navigable
- Four collapsible sections: Property, Layers, Rooms and areas, Walls and openings (closed)

Captures: plan-editor light/dark and 460px, before and after, read for spacing and wrapping.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
```
