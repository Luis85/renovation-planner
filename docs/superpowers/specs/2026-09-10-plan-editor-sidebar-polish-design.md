# Plan editor sidebar and chrome polish — design

Date: 2026-09-10 · One PR off `main` at `032caa97`.

## Why this exists

`docs/user-experience/renovation-planner-editor-specs/screens/M01-standard-plan-view.md` is
the locked home state of the editor, and a screenshot of the current build taken against its
mockup shows the left sidebar and the chrome diverging in six places. This design closes the
six. It touches nothing on the canvas's drawing, the Inspector or the status bar.

Decisions taken with the user, in order:

1. The Obsidian view header is HIDDEN for the Plan editor, reversing what `styles/chrome.css`
   records. The pane's back/forward arrows and its `⋮` menu go with it; the tab strip keeps
   naming the plan.
2. The Pan button STAYS in the floating actions, with an icon. This reverses M01's "no
   persistent Pan mode" acceptance line and component library §6's Select+Add pair, on the
   strength of user testing. The spec is amended, not the code.
3. The Layers list is FLAT, as the mockup draws it, not grouped per interaction spec §54.
4. The Property tree lists the project and ALL of its plans as sibling rows.
5. The Elements list stays in the sidebar, collapsed by default; every sidebar section becomes
   collapsible; rooms rank above walls.
6. The status bar already mounts and was only outside the screenshot's crop; nothing changes.

## Scope

### 1. Chrome

Files: `styles/chrome.css`, `tests/presentation/views/planEditorView.test.ts`.

One selector, `.workspace-leaf-content[data-type="renovation-plan-editor"] .view-header
{ display: none; }`, and the existing `overflow: hidden` rule stays. The docblock above the
Plan editor block currently argues for KEEPING the header; it is rewritten to say the header is
hidden, why (a full-bleed workspace whose own context bar carries the plan name), and what is
lost (pane arrows, `⋮`). The view test pins the new selector to `PLAN_EDITOR_VIEW` the same way
it pins the `overflow` one. The harness mock nests `.view-header` already, so harness shots
show the result.

### 2. Pan icon

Files: `src/presentation/editor/shell/FloatingPrimaryActions.vue`,
`tests/fixtures/editor-icons/hand.svg` (Lucide, under the folder's existing licence),
`docs/user-experience/renovation-planner-editor-specs/screens/M01-standard-plan-view.md`,
`docs/user-experience/renovation-planner-editor-specs/components/component-library.md`.

The Pan button gets `<HostIcon name="hand" />` before its label, matching Select and Add.
M01's layout bullet becomes "Floating action control contains Select, Pan and Add" and the
acceptance line "starts in Select with no persistent Pan mode" becomes "starts in Select; Pan
is a persistent button by decision of 2026-09-10 (user testing), and Space+drag and middle-drag
remain". Component library §6 `FloatingPrimaryActions` gains Pan in its responsibility line
with the same dated note.

### 3. Layers model

Files: `src/presentation/editor/layers/layerCatalogue.ts`,
`src/presentation/editor/shell/LayerList.vue`, `src/presentation/editor/shell/LayerRow.vue`,
`src/presentation/editor/shell/PropertyLayerPanel.vue`,
`src/presentation/stores/WorkspaceStore.ts`, `src/presentation/editor/PlanCanvas.vue`, locale
files, their tests.

`LayerEntry` loses `konvaLayer`. It gains `visible: () => boolean` and `toggle: () => void`,
so a row is a user-meaningful thing with its own predicate rather than a scene layer
(interaction spec §55: layers are visibility, not ownership). `layerCatalogue` takes what it
needs to build the predicates: the plan, the workspace store, the renovation session, and the
existing `writesBlocked`. Five rows, in this order:

| Row | Predicate | Notes |
|---|---|---|
| Reference plan | `workspace.layerVisibility.background` | Keeps `supported-empty`, Set scale and `ReferenceLayerAppearance` exactly as today |
| Rooms | `workspace.layerVisibility.zone` | |
| Walls and openings | `workspace.layerVisibility.architecture` | New row; the layer had no toggle |
| Planned changes | `session.visible` | Replaces the separate checkbox in `PropertyLayerPanel`; row present only when `runtime.renovation.available`, as the checkbox is today |
| Notes and photos | `workspace.notesVisible` | New `ref(true)` in `WorkspaceStore`, reset in `reset()`; `PlanCanvas` computes `evidencePins` as `[]` when false, so `ZoneLayer` and `RenovationLayer` go quiet through the one prop they already take |

`LayerList`'s total `ids` record extends to the five ids; the reason for its being total is
unchanged and its docblock still says so. `LayerRow` binds `:checked="entry.visible()"` and
`@change="entry.toggle()"`; nothing else in it changes. The "Reference options" disclosure
stays below the list. The mockup's lock and opacity affordances are out of scope: the
appearance control that exists stays, and locking waits for spec §56.

The Konva stack is untouched. §17's seven layers, including the two `EmptyLayer` mounts, are
the paint order and stay; the record `defaultLayerVisibility` builds stays keyed by Konva id.
Only the panel stops speaking that vocabulary.

### 4. Property tree

Files: new `src/presentation/editor/shell/PropertyTree.vue`,
`src/presentation/editor/PlanEditorContext.ts`, `src/presentation/read-models/planEditorQueries.ts`,
`src/plugin/planEditorDeps.ts`, `src/presentation/editor/PlanEditorRoot.vue` (hydrate),
`src/presentation/stores/ProjectStore.ts` (the sibling list), locale files, tests.

- `PlanEditorQueryServices.listPlans(projectId)` maps `PlanRepository.listByProject` into
  `PlanDto[]` (loaded plans only; the refused count is not this surface's to report).
- `ProjectStore` gains `plans: PlanDto[]`, filled by the root's hydrate routine after the
  project read succeeds, so a re-hydrate after a command refreshes the tree too.
- `EditorNavigation.plan(planId)` is a new member, wired in `planEditorDeps.ts` over the
  existing `revealPlanEditor` seam, so a sibling row opens (or reveals) that plan's editor
  leaf. It is optional like `downstream`, and a row without navigation renders as text.
- `PropertyTree.vue` draws the project row (house icon, `HostIcon`), then a nested `<ul>` of
  plan rows (grid icon), the current one carrying `aria-current="page"` and the highlighted
  style. It replaces the two rows `PropertyLayerPanel` draws today. Full `role="tree"` with
  arrow-key roving is deferred and the docblock says so.

### 5. Sidebar sections

Files: `src/presentation/editor/shell/PropertyLayerPanel.vue`, `styles/editor-shell-fidelity.css`,
locale files, tests.

Every section is a `<details class="rp-sidebar-section">` whose `<summary>` is the heading.
Order and default state:

1. Property — open — `PropertyTree`
2. Layers — open — `LayerList`, the Reference options disclosure, then `ChangeLegend` at its
   foot, where the mockup draws the legend
3. Rooms and areas — open — `RoomSummaryList` plus the multi-selection toggle and hint
4. Walls and openings — closed — `StructureList`

Open state is not persisted; `WorkspaceStore`'s docblock already records that which full-mode
panels are open is deliberately not stored, and a `<details>` default is that rule kept.

### 6. Styling

`styles/editor-shell-fidelity.css` (88 lines today, cap 400): section summaries share one
style; tree rows indent with a guide line; layer rows keep their existing rhythm. Obsidian
variables only; the build's colour check refuses anything else.

## Testing

- Updated: `layerCatalogue`, `LayerList`, `LayerRow`, `PropertyLayerPanel`,
  `FloatingPrimaryActions` and `planEditorView` suites.
- New cases: the catalogue answers five rows in order and each `toggle` flips its own
  predicate and no other; `notesVisible = false` yields no pins on either layer; the tree lists
  the project's plans with the current one `aria-current` and a click reaches
  `navigation.plan`; section defaults are open/open/open/closed.
- Locale: every new string in `en` and `de`, sentence case.
- Captures: `npm run harness-shot` of `plan-editor` in both schemes and at `--width=460`,
  before and after, read for spacing and wrapping. The existing axe suites scan the real
  mounted surface and pick the new markup up unchanged.
- `npm run check` green once before the commit.

## Records

- Increment-history entry for this pass, naming the two spec reversals.
- `styles/chrome.css` docblock rewritten (section 1), M01 and component library amended
  (section 2).
- CLAUDE.md is not edited: it names neither the header decision nor the layer row count.
