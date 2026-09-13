# Property tree polish — design

> Superseded on schema: kind/order shipped as frontmatter schema v11 (main took v10 for `north`); see ADR-0029.

Date: 2026-09-12 · One PR off `main` at `5dfb0725`.

## Why this exists

The sidebar's Property tree (`src/presentation/editor/shell/PropertyTree.vue`, sidebar polish
2026-09-10 and ADR-0028) draws the project, a detail plan's ancestry and the open plan's
SIBLINGS. It never draws the open plan's own detail plans, so from a root plan the tree shows
only other root plans; a three-level property reads as a flat list of ancestors; and the nested
list stacks a margin, a padding, a row padding and an icon gap into an indent wider than the
pane earns. The tree also has no order a user can set, and every plan draws the same icon
whether it is the whole site or one room.

The user's two use-cases, both of which this design serves with one model: a property built
top-down (site → main house → ground floor → kitchen) and a project that is one floor and its
rooms, with the floor at the root.

Decisions taken with the user, in order:

1. No "+ New plan" from the tree in this pass, and no change to how a plan gets its parent —
   ADR-0028's zone context menu stays the only creation door, and `parent` stays immutable.
2. Siblings are reorderable BOTH by drag and drop and by a context menu with keyboard
   equivalents; the order is persisted.
3. A plan carries a persisted **kind** — `site`, `building`, `floor`, `room` — driving its icon
   and its level label. A label, not an entity: no Site, Building or Floor identity arrives.

## Scope

### 1. Domain: `Plan.kind` and `Plan.order`

Files: `src/domain/plan/Plan.ts`, `src/domain/plan/PlanKind.ts` (new),
`src/domain/plan/Plan.errors.ts`, `src/application/commands/plan/CreatePlan.ts`,
`src/application/commands/plan/UpdatePlanDetails.ts` (new).

- `PLAN_KINDS = ['site', 'building', 'floor', 'room'] as const`; `PlanKind` is its union.
  `Plan.kind: PlanKind`, default `'floor'` when `CreatePlanProps` omits it (ADR-0017: a plan
  presents as Floor). `Plan.create` refuses a value outside the vocabulary
  (`plan.unknown-kind`).
- `Plan.order: number`, a non-negative integer, default `0`. `Plan.create` refuses a
  non-integer or negative value (`plan.invalid-order`). `order` ranks a plan among its
  SIBLINGS (same `parent.planId`, or both root) and means nothing across parents.
- `Plan.withDetails({ kind?, order? })` returns a re-validated Plan, immutable like
  `withBackground`. No `withName`: rename is out of scope, and a door nothing calls is a door
  nothing tests.
- `CreatePlanInput` gains optional `kind` and `order`. `CreatePlanCommand` passes them
  through; when `order` is omitted it assigns one past the highest `order` among the plan's
  siblings from `ListPlansByProject`, so a new plan lands last rather than first.
- `UpdatePlanDetailsCommand` — `{ planId, expectedVersion, kind?, order? }` — loads the plan,
  applies `withDetails`, saves through the existing `savePlan` path with the version check
  every plan write carries. It is the FIRST command that writes an existing plan's frontmatter
  for anything but its background, and it is guarded by `guardCommand` like the rest.
- `ReorderPlansCommand` — `{ moves: readonly { planId; expectedVersion; order }[] }` — one
  `UpdatePlanDetailsCommand` per entry in sequence, stopping at the first failure and
  reporting which plans were written. Not transactional: two frontmatter files cannot be
  written atomically here, and a half-applied swap is a visible order the user can redo, not
  data loss. The docblock says so.

### 2. Persistence: schema v10

Files: `src/infrastructure/persistence/dto/planFrontmatter.ts`,
`src/infrastructure/persistence/mappers/planMapper.ts`, `tests/infrastructure/persistence/`.

- Frontmatter keys `kind` and `order`, both optional in the Zod schema. `planSchemaVersion`
  answers `10` when either is set and differs from its default; older notes lift to 10 in
  memory as every version does.
- On read, a missing `kind` is `'floor'` and a missing `order` is `0`. A `kind` outside the
  vocabulary refuses the note (`plan.unknown-kind`), the same "strict on the way out, tolerant
  on the way in" line the background keys draw: a stray key is dropped, a WRONG value is not
  guessed at. A negative or fractional `order` refuses the note for the same reason.
- On write, `kind` is written only when it is not `'floor'` and `order` only when it is not
  `0`, so a note this pass never touched is byte-identical after its next save.
- ADR-0029 (new): "A plan carries a kind label and a sibling order". Amends ADR-0017 once
  more: still no Site/Building/Floor entity, still `Plan` presents as Floor by default; the
  label is what the tree draws and nothing else reads it. Revisit when a kind has to constrain
  what a plan may contain, or when order must be shared across parents.

### 3. Read model: the whole tree

Files: `src/presentation/read-models/planHierarchy.ts`,
`src/presentation/read-models/PlanDto.ts`, `tests/presentation/read-models/`.

- `PlanSummaryDto` gains `kind` and `order`; `PlanDto` gains `kind` and `order`.
- `PlanHierarchyDto` gains `tree: readonly PropertyTreeNode[]`, where
  `PropertyTreeNode = { id, name, kind, version, children: PropertyTreeNode[] }` and `version`
  is the loaded version the reorder command needs as `expectedVersion`. Built by
  `propertyTreeOf(plans)` from the `listPlans` read `readPlanHierarchy` already makes, so no
  extra read: children under their parent, siblings by `order` then `name.localeCompare`.
- A plan whose parent is not among the listed plans (deleted, unreadable) draws at the root —
  the requirement's "the chain simply stops one level early", applied to the tree. A cycle
  (hand-edited notes only) breaks at the first repeated id, as `ancestryOf` already does, and
  the plans on the cycle draw at the root.
- `ancestry`, `detailPlans`, `parentZone` and `parentZoneMissing` are unchanged.
- `ProjectStore.plans` stays as it is; `PropertyTree` stops reading it and reads
  `hierarchy.tree`.

### 4. Tree UI

Files: `src/presentation/editor/shell/PropertyTree.vue`,
`src/presentation/editor/shell/PropertyTreeRow.vue`,
`src/presentation/editor/shell/PropertyTreeMenu.vue` (new),
`src/presentation/editor/shell/usePlanReorder.ts` (new), `styles/editor-shell-fidelity.css`,
`src/presentation/editor/editorIcons.ts`, `src/presentation/i18n/locales/*/editorShell.ts`.

**Structure.** The project row, then the tree recursively: `<ul role="tree">`,
`<li role="treeitem" aria-level aria-expanded>` per plan, a nested `<ul role="group">` for
children. Every node is expanded — a project has a handful of plans, and collapse state would
be one more thing to persist for nothing. The open plan carries `aria-current="page"` and is
not a button. `hierarchy.parentZoneMissing` keeps its line under the tree.

**Icon by kind**, in `editorIcons.ts` so the context bar's crumbs use the same table:
`site` → `land-plot`, `building` → `building`, `floor` → `grid-2x-2`, `room` → `door-open`.
The project row keeps `house`. `building` has no fixture under
`tests/fixtures/editor-icons/` yet; one is added from the same pinned Lucide set, under the
same licence file, or the harness marks it missing per the existing rule.

**Level label.** Each row's accessible name is `{name}, {kind}` through `aria-description`
carrying the localised kind (`editor.shell.kind.site` … `editor.shell.kind.room`), which is
component library §4's "level labels".

**Keyboard.** Roving tabindex over the `treeitem`s: ↑/↓ move focus, Home/End jump, Enter or
Space opens the plan, ←/→ move to parent / first child (no collapse, so → on a leaf does
nothing). This is the `role="tree"` deferral the polish round wrote down as "arrives with a
third level"; this is that level. Alt+↑ / Alt+↓ move the focused plan among its siblings.

**Context menu.** Right-click on a row, or Shift+F10 / the context-menu key while it is
focused, opens `PropertyTreeMenu`: **Move up**, **Move down** (each disabled at its end of the
sibling list) and **Kind** as four radio-styled entries with the current one checked. It
reuses `CanvasContextMenu`'s `CanvasMenuAction` shape and positioning so the two menus look
the same, and is hidden when the leaf has no `UpdatePlanDetails` command (the harness index
mounts this panel with none). In review perspective the menu is not offered at all, matching
the detail-plan entries' rule. Writes paused: entries are shown disabled with the same reason
every paused zone action carries.

**Drag and drop.** Native HTML5 `draggable` on each row. `dragstart` records the dragged plan
id and its parent id in a module-local ref, never in `dataTransfer` text (the payload is
internal). `dragover` on a row of the SAME parent shows an insertion line above or below by
pointer half; a row of another parent, the project row and the canvas get no indicator and
`drop` there is a no-op — reparenting is out of scope and ADR-0028 forbids it. A drop
renumbers the affected siblings `0…n-1` and dispatches one `ReorderPlansCommand`. Touch
devices have no HTML5 drag; the context menu is the mobile path and this is said in the
component's header.

**One reorder door.** `usePlanReorder` owns the sibling arithmetic — `moveUp(id)`,
`moveDown(id)`, `moveTo(id, index)` — and every input above (menu, Alt+arrows, drop) calls
one of those three, which is CLAUDE.md's "one action, every input" rule applied here. After a
successful write it calls `PlanHierarchyStore.load` so the tree redraws from the vault rather
than from an optimistic local order; a failed write reports through `report-failure.ts` like
every other editor write and the tree keeps its last read.

**Indent.** The nesting itself is the indent: each `<ul role="group">` gets
`padding-inline-start: 16px` and no margin, and the 1px guide line is its
`border-inline-start`, so depth costs 16px per level with nothing computed and nothing inline.
The row drops to `padding: 4px 8px`, `min-height: 32px`, `gap: 8px`. Today's rule stacks a
12px margin, a 14px padding and an 8px row padding per level, which is what the screenshot
shows. The ancestry rows that drew flat are gone, since the tree now draws them at their depth.

### 5. Other surfaces

Files: `src/presentation/views/NewPlanForm.vue`,
`src/presentation/editor/shell/FloorInspector.vue`,
`src/presentation/editor/shell/EditorContextCrumb.vue`, `src/plugin/sampleProject.ts`.

- New plan form: a **Kind** `<select>` over `PLAN_KINDS`, defaulting to `floor` for a root
  plan and to one step below the parent's kind for a detail plan (site → building → floor →
  room; room → room). The parent's kind reaches the form through a new optional
  `parentKind` prop beside `parent`.
- Floor inspector: a **Kind** `<select>` under the name, dispatching `UpdatePlanDetails`
  through the inspector's existing selection-to-DTO-to-command pipeline. Hidden in review
  perspective.
- Context bar crumbs draw the kind icon beside each ancestor. Nothing else changes there.
- `create-sample-project` seeds its plan as `floor`; unchanged in effect, stated so the
  scaffold's docblock does not lie by omission.

### 6. Tests and gates

- Domain: kind vocabulary, order validation, `withDetails` re-validates and does not touch
  `parent`.
- Mapper: v10 round trip; a v9 note reads as `floor`/`0` and writes back byte-identical; a
  note with `kind: attic` refuses with `plan.unknown-kind`; `order: -1` refuses.
- Commands: `CreatePlan` assigns last order among siblings; `UpdatePlanDetails` version
  conflict surfaces the existing conflict error; `ReorderPlans` stops at the first failure and
  reports what was written.
- Read model: `propertyTreeOf` over fixtures with three levels, an orphan, a cycle and a tie
  on `order` broken by name.
- Component (jsdom): the tree draws three levels with the right `aria-level`; arrow keys rove;
  Enter opens through `navigation.plan`; the menu's Move down dispatches a two-entry reorder;
  a drop across parents dispatches nothing; no menu when the command is absent.
- `tests/harness/accessibility*.test.ts`: the tree scanned under axe with `role="tree"`
  present, which is new ARIA and the reason the file is touched.
- No import-graph reachability walk exists for the editor shell (only the designer has one),
  so the tree component test asserts the menu component is mounted and reachable by keyboard.
- Harness shot: `home-property-tree` at 460px in both schemes, since the indent is a visual
  claim no jsdom test can grade.
- `docs/tests/cases/Reorder plans in the Property tree.md`: a manual case for drag and drop in
  a real vault, with an empty Runs table — written, not run, said as such.
- Coverage: floors do not move; the changed files are read in `coverage-final.json` for a
  single uncovered arm before the PR.

### 7. Documents

- ADR-0029 as in §2.
- `docs/requirements/Navigate property, building and floor context in the editor.md`:
  amendment dated 2026-09-12 — the tree draws every plan of the project nested by parent,
  siblings are reorderable, a kind label drives icons.
- `docs/requirements/Create a detail plan from a zone and move between levels.md`: its
  out-of-scope line "a nested tree of detail plans in the project's own plan list" stays true
  (the PROJECT list is untouched); the editor's tree is now nested, and the amendment says so.
- `CLAUDE.md`: no count changes; the paragraph naming the Property tree is untouched because
  it names no shape this design alters.
- `docs/development/agent-guide-increment-history.md`: the increment's entry, written when
  the PR lands.

## Out of scope

"+ New plan" from the tree, reparenting or clearing a parent, renaming a plan, collapse state,
nesting in the project view's plan list, a kind constraining what a plan may contain, and any
warning on deleting a zone that has detail plans.
