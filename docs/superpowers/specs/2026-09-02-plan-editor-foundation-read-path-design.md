# Plan editor foundation, increment 1 — the read path and selection

**Date:** 2026-09-02
**Epic:** `docs/requirements/Plan editor.md` → Feature `Editor foundation` (Increment A).
**Baseline:** `main` at `04a8ca5f`. The asset-designer branch
(`claude/asset-designer-first-increment-eh5fxq`) is NOT part of this baseline; see §9.
**Status:** approved design. `docs/superpowers/plans/2026-09-02-plan-editor-foundation-read-path.md`
is the implementation plan derived from it. Where this document and the SDD disagree, the SDD is
the authority; where it and a PBI under `Editor foundation` disagree, the PBI is.

## 1. What this increment delivers

A private renovator opens a floor plan in Obsidian and lands in a safe Standard Plan View
(M01): Select is active, nothing is selected, the Inspector shows a truthful floor summary and a
keyboard-reachable room list. They hover, select a room from the canvas or the list, and see the
same stable identity in the canvas outline, the list and a Room Inspector (M00's frame with only
supported values) that marks every unbuilt section unavailable rather than empty. They open Add,
see the homeowner catalogue, and Room is the one enabled entry. The shell works in a narrow leaf
beside a note (M16) without losing the viewport or the selection.

This is the vertical-slice plan's checkpoints **C0 (consolidated model) and C1 (shell and read
path)**. It writes nothing new to the vault. Checkpoint C2 (Add Room with a rectangular drag and a
name form) is Feature B and the next increment.

### PBIs and tasks this increment closes or advances

| PBI (`docs/requirements/`) | Tasks (`docs/tasks/`) touched here |
|---|---|
| Consolidate the current and target editor data models | Inventory and map the editor model; Decide Room Zone and Floor Plan boundaries; Prove editor persistence round trips; Approve the Editor foundation slice contract (this document); Establish the editor migration and compatibility contract (the no-change decision, recorded); Record remaining editor model and routing ADRs (recorded as DEFERRED with triggers, not accepted) |
| Open a floor plan in the Obsidian editor shell | Render the Obsidian native editor shell; Keep the editor truthful across failure and narrow layouts; Render independent simultaneous persistent warnings; Build full and compact editor status bars (compact form only as far as §5.7 states); Enforce shared editor component and state boundaries |
| View rooms in the Standard Plan View | Project Zones as homeowner Rooms; Render rooms on the standard canvas and list; Present the truthful floor summary and selection guidance; Distinguish empty unreadable and unavailable floor data; Frame selected Rooms and show contextual dimensions (framing half) |
| Layers | Build the truthful layer catalogue; Control layer visibility without changing renovation data; Keep layer controls usable in constrained leaves |
| Selection | Unify canvas and list selection by stable ID; Compose predictive and contextual Select surfaces (hover and cursor half); Resolve overlapping selection targets deterministically; Return selection to the safe floor state |
| Inspect a selected room | Query a truthful selected room overview; Render the selected room Inspector overview; Assemble shared homeowner-question Inspector navigation (rows present, all unavailable); Preserve room inspection across layout and read changes |
| Start one creation task from Add | Define the homeowner creation catalogue; Operate the Add menu by pointer and keyboard; Run one temporary creation task from Add; Show an active creation-task banner with complete controls |

Not advanced here: Canvas navigation (already built; its PBI is a re-statement of shipped
behaviour and is closed by review, not by code), Undo and redo (same), Select several parts of a
plan, Navigate property/building/floor context, Reveal one floor in one editor leaf (already
built as `revealPlanEditor`), Apply per-plan display units. Inspect a selected wall (no wall entity exists; this increment's Room Inspector is the frame a wall Inspector will reuse), Plan editor and canvas (the pre-existing scheduling PBI; nothing here advances its criteria). Amended 2026-09-04: the first draft mapped 11 of the 13 PBIs whose frontmatter parent is `[[Editor foundation]]`; `rg -l '^parent: "\[\[Editor foundation\]\]"$' docs/requirements` is the review-time check.

## 2. Decisions (WP0)

### 2.1 ADR-0016 — a room-classified Zone presents as Room

Room is a **presentation-layer projection** over `Zone` where `zoneType === 'Room'`. Every other
`ZoneType` presents as an **Area**. The `ZoneId` is the Room's identity; nothing is renamed,
no frontmatter key changes, no homeowner label is written to a note. The ADR compares three
alternatives (projection, renamed entity, separate Room entity linked to geometry) and names the
revisit trigger: a Room needs a field or invariant a Zone cannot carry without harming Areas.

### 2.2 ADR-0017 — Plan presents as Floor

`Plan` stays the persisted concept; "Floor" is its homeowner name in copy. No `Floor` entity, no
`Building`, no persisted hierarchy. The breadcrumb reads `Project › Floor` because that is what
exists. Trigger: a project with two buildings, or floor alignment between plans.

### 2.3 The five remaining ADRs are DEFERRED, in writing

ADR-HI (hierarchy), ADR-EPW (Existing/Planned/Work), ADR-SO (spatial-object evolution), ADR-RL
(relationship mechanism), ADR-SV (schema-version policy) are each recorded in the consolidation
report with the increment that first needs them and the trigger that forces the decision. No
code in this increment reads any of them. Deciding them without a consuming slice is the shape
`CLAUDE.md` warns about (a decision nothing pins drifts).

### 2.4 No schema change; fixtures preserved

Every note and sidecar schema stays at its current version. Existing fixtures under
`tests/vault/` and `tests/fixtures/` are preserved as-is. The round-trip test (§2.5) is the
evidence. This discharges the migration-contract task for this increment by recording that
nothing migrates.

### 2.5 The consolidation report and its instrument

`docs/development/consolidation/2026-09-editor-model-consolidation.md` holds: the baseline SHA;
the inventory of entities, value objects, DTOs, mappers, repositories, queries, commands and
events the editor touches, each with its file; the mapping matrix (homeowner term ↔ read model ↔
domain ↔ persisted key); the round-trip matrix; the gap register (including the spec's finding
that `Zone.domainNoteLink` is on the entity and absent from the v1 DTO and mapper — classified,
not fixed); the compatibility decision; the deferred ADRs.

The round-trip matrix is backed by **one contract test**,
`tests/infrastructure/persistence/editorRoundTrip.test.ts`, that drives a `Project`, a `Plan` and
a Room-classified `Zone` through the real mappers and the in-memory repository stack and asserts
every first-slice field, both ids, the revision and a user-authored note body survive. The report
cites the test; the test does not cite the report.

## 3. Read models (presentation, over existing queries)

All in `src/presentation/read-models/`. The application layer keeps speaking Zone and Plan.

```ts
export type SpatialKind = 'room' | 'area';

export interface SpatialRecordDto {
  readonly kind: SpatialKind;          // 'room' iff zoneType === 'Room'
  readonly id: string;                 // the ZoneId, unchanged
  readonly planId: string;
  readonly name: string;
  readonly zoneType: string;           // for the type label key lookup
  readonly points: readonly Point[];   // world mm
  readonly areaMm2: number;            // derived here from points; never stored
}

export interface FloorDto {
  readonly id: string;                 // the PlanId
  readonly name: string;
  readonly projectId: string;
  readonly projectName: string;
}

export type Aggregate<T> =
  | { readonly state: 'available'; readonly value: T }
  | { readonly state: 'partial'; readonly value: T; readonly unreadable: number }
  | { readonly state: 'unavailable' };

export interface FloorSummaryDto {
  readonly floor: FloorDto;
  readonly roomCount: Aggregate<number>;
  readonly areaCount: Aggregate<number>;
  readonly totalAreaMm2: Aggregate<number>;
  readonly plannedChanges: Aggregate<number>;   // always 'unavailable' in this increment
  readonly estimatedCost: Aggregate<never>;     // always 'unavailable' in this increment
  readonly rooms: readonly SpatialRecordDto[];
  readonly areas: readonly SpatialRecordDto[];
}

export const INSPECTOR_SECTIONS = ['existing', 'planned', 'work', 'costs', 'documents', 'photos', 'notes'] as const;
export type InspectorSection = (typeof INSPECTOR_SECTIONS)[number];

export interface RoomOverviewDto {
  readonly record: SpatialRecordDto;
  readonly floorName: string;
  readonly unavailableSections: readonly InspectorSection[];  // all seven, this increment
}
```

Rules:

- `roomCount`, `areaCount` and `totalAreaMm2` are `available` when `unreadableZones === 0` and
  `partial` otherwise, carrying the count. A partial total is a total over what was read and
  says so; it is never rounded up to "available".
- `plannedChanges` and `estimatedCost` are `unavailable`. There is no floor-level cost query and
  the Inspector may not recompute cost (task: "formatted from the project/cost authority and
  never independently recomputed").
- Requirements for a selected zone stay on the existing `getRequirementsForZone` path and the
  existing `RequirementRow` panel; they are a supported section and are not in the union.
- `PlanEditorQueryServices` gains `getProject(projectId): Promise<Result<ProjectSummaryDto | null, RepositoryError>>`
  wired to the existing `GetProject`; the unrecovered bundle refuses it like the others.
  `ProjectStore.hydrate` reads it after the plan and fills the `project` ref it already declares
  and never sets. A failed project read is a failed hydration (same handling as a failed plan read).

## 4. Stores

- `WorkspaceStore` gains `layoutMode: 'full' | 'constrained' | 'unsupported'` (default `full`),
  `overlay: 'none' | 'layers' | 'inspector'` (default `none`), `setLayoutMode`, `openOverlay`,
  `closeOverlay`. `layersPanelOpen`/`inspectorPanelOpen` were to keep their meaning for the FULL
  mode; they were DELETED on 2026-09-04 (R11) with their two toggle actions, because §5.6 builds
  no View menu and nothing in the product ever called them — the shell renders both full-mode
  panels unconditionally instead.
- `EditorStore.activeToolId` stays `ToolId | null`; `null` (camera mode) is no longer a state
  any control puts the user into. The runtime activates `'select'` when `ProjectStore.status`
  becomes `'ready'` for the first time, and re-activates it after `DrawPolygonTool` completes or
  cancels (see §6).
- `SelectionStore` is unchanged in shape: it holds stable ids. `kind` is derived from the record
  at read time, never stored twice.
- `renderState.hoveredObjectId` (already declared, never written) becomes the hover authority.
- `PlanEditorContext` gains one member, `focusLeaf(): void`, partially applied by the view from
  its own `WorkspaceLeaf` exactly as `closeLeaf` is — the one thing `UnsupportedWidthNotice` can
  offer. It asks Obsidian to reveal and focus the leaf through the supported workspace API; it
  does not maximise anything, because the pinned typings promise no such call.

## 5. Shell

### 5.1 Components (all under `src/presentation/editor/shell/` unless stated)

| Component | Replaces | Responsibility |
|---|---|---|
| `ResponsiveEditorShell.vue` | layout markup in `PlanEditorRoot.vue` | Arranges context bar, panel, canvas, Inspector, warnings and status by `layoutMode`. Owns the `ResizeObserver` on its root and writes `layoutMode`. Owns nothing else. |
| `EditorContextBar.vue` | `EditorToolbar.vue` (deleted) | Breadcrumb text `Project › Floor`, Undo, Redo. No perspective switch (§5.6). |
| `FloatingPrimaryActions.vue` | toolbar mode buttons | Select and Add, anchored over the canvas. Select is `aria-pressed` while `activeToolId === 'select'`. Add opens `AddMenu`. |
| `PropertyLayerPanel.vue` | `LayersPanel.vue` (renamed and widened) | Floor name heading, then `LayerList`. |
| `LayerList.vue` | list markup inside `LayersPanel.vue` | Renders the layer catalogue (§5.3). Reusable in the persistent panel and the overlay. |
| `PanelRail.vue` | — | Constrained mode: two labelled buttons, "Layers" and "Details". Opens one overlay at a time. |
| `OverlayPanel.vue` | — | Constrained container for `LayerList`; Escape closes; focus returns to its rail button. |
| `InspectorDrawer.vue` | — | Constrained container for the same Inspector content; same focus rules. |
| `EntityInspector.vue` | `InspectorPanel.vue` (becomes the Room body) | Frame: routes by selection to `FloorInspector`, `RoomInspector` or the multiple-selection text. |
| `FloorInspector.vue` | the `editor.inspector.empty` paragraph | Floor summary (§3) and `RoomSummaryList`. |
| `RoomInspector.vue` | `InspectorPanel.vue` body | Name, type, floor, area; existing Requirements panel and Delete; `HomeownerQuestionNav`; `LinkedContentList`. |
| `RoomSummaryList.vue` | — | Rooms and Areas as two labelled lists of buttons; activation selects and frames (§6.4). |
| `HomeownerQuestionNav.vue` | — | Three rows in canonical order, each rendered unavailable with a reason; no `href`, no click handler that does nothing. |
| `LinkedContentList.vue` | — | Costs, Documents, Photos, Notes rows, unavailable. |
| `PersistentWarningStrip.vue` | four `<p class="rp-editor-notice">` in the root | One keyed collection: `{ id, severity, messageKey, params? }[]` computed in the root from `stale`, `unreadableZones` and `backgroundStatus`. Renders every active warning, in a fixed order, inside ONE unconditional `role="status"` container — never a per-item live region, so the region exists before its first content (amended 2026-09-04). Each item carries its `severity` as a mark and a word; heading, busy state and actions are not in this increment's model. |
| `TemporaryToolBanner.vue` | — | Shown while `activeToolId` is neither `null` nor `'select'`: task name, one instruction, Cancel. |
| `UnsupportedWidthNotice.vue` | — | Replaces the canvas below the floor width: floor name, room count, and a "Focus this tab" button calling `context.focusLeaf()`. |

`PlanEditorRoot.vue` keeps hydration, failure routing, the stale flag and the dialog host, and
composes the shell. It stays under the 400-line cap by moving layout into
`ResponsiveEditorShell` and the notices into the strip.

### 5.2 The toolbar is retired, not renamed

`EditorToolbar.vue` and its strings (`editor.toolbar.pan`, `.select`, `.draw-zone`,
`.calibrate`, `editor.toolbar`) are deleted. Only the PLAN EDITOR's toolbar keys are meant: the Asset Designer keeps a real toolbar and owns its own `designer.toolbar.*` keys (amended 2026-09-04; three keys it had borrowed from this namespace are renamed). Undo and Redo move to the context bar with new keys
(`editor.context.undo`, `editor.context.redo`). Pan has no control: the camera override pans on
Space and middle button already, and the status bar's gesture hint says so
(`editor.hint.pan`). `docs/tests/cases/Canvas Navigation.md` is updated for the missing button.

### 5.3 The layer catalogue

`src/presentation/editor/layers/layerCatalogue.ts` derives an ordered list from the plan and the
scene:

| id | Konva layer | label key | state |
|---|---|---|---|
| `reference` | `background` | `editor.layer.reference-plan` | `available` when `plan.background !== null`, else `supported-empty` (checkbox present but disabled, reason: no reference plan) |
| `rooms` | `zone` | `editor.layer.rooms` | `available` |

The Reference plan row carries one action, **Set scale** (`editor.layer.reference-plan.set-scale`),
which activates the `calibrate` tool through the same `runtime.setTool` the toolbar used. It is
disabled with a reason while there is no background. Lock and opacity are not rendered: the
sidecar persists neither.

The four empty Konva layers (`architecture`, `construction`, `asset`, `annotation`) and the
`interaction` layer are not listed. Their visibility stays `true` in `WorkspaceStore`; nothing
the user can reach toggles them. `editor.layer.*` keys for them are deleted with their rows.

### 5.4 Layout modes and thresholds

| mode | condition | layout |
|---|---|---|
| `full` | width ≥ 900px | context bar / [panel] canvas [inspector] / warnings / status |
| `constrained` | 400 ≤ width < 900 | context bar / rail canvas / warnings / compact status; overlay or drawer over the canvas |
| `unsupported` | width < 400 | context bar / `UnsupportedWidthNotice` / status |

The thresholds are judgements. The 460px capture (the width of an Obsidian sidebar leaf) must
show a usable canvas in `constrained`; the 1280px capture must show `full`. Both are read by
eye after the wave that builds them. The canvas component is mounted in `full` and
`constrained` and is the SAME instance across the two: `layoutMode` changes move the panels,
never the `PlanCanvas` element, so viewport and selection survive by construction. `unsupported`
unmounts the canvas; returning from it re-mounts with the store's viewport and selection intact,
because both live in Pinia and not in the component.

### 5.5 Focus and one-overlay rule

Opening the Layers overlay closes the Inspector drawer and vice versa. Escape inside either
closes it and returns focus to the rail button that opened it. Neither traps focus: the canvas
behind them stays reachable by Tab. M16's accessibility list
used to read "overlay panels trap focus only while open"; the Inspector PBI's criterion 7
requires the opposite ("does not trap focus"), both components implement no trap, and M16 was
amended on 2026-09-04 to match. `responsiveShell.test.ts` pins that policy over both panels —
it MOVES focus to the canvas rather than pressing Tab, because jsdom performs no traversal, and
then asserts the panel neither pulls focus back nor closes. What a browser's own Tab key does
with the order, and whether Electron honours the focus return, is the manual case's step 9.

### 5.6 What the shell deliberately does not show

- **No perspective switch.** Only Plan has content. A switch with two dead options is the
  live-control-that-does-nothing slice 14's amendment refuses. `EditorContextBar` leaves a slot
  for it and the spec says so.
- **No property tree.** One project, one floor; the breadcrumb is text. The Navigate PBI owns the tree.
- **No grid or snap controls in the status bar.** Neither exists as a setting.
- **No View menu.** Nothing would be in it.

### 5.7 Status bar

`StatusBar.vue` keeps its three regions. The measurements region shows zoom and, new, the scale
state (`editor.status.scale.calibrated` / `editor.status.scale.uncalibrated`) so that a plan
drawn at the placeholder scale says so. In `constrained` mode the pointer readout is dropped and
the rest stays; this is the whole of "compact" in this increment.

## 6. Selection and Inspector behaviour

### 6.1 One resolver

`src/presentation/editor/selection/resolveSelectionTarget.ts`:

```ts
export type SelectionTarget =
  | { kind: 'handle'; id: string; vertexIndex: number }
  | { kind: 'body'; id: string }
  | null;
export function resolveSelectionTarget(input: {
  candidates: readonly SpatialObjectCandidate[];  // z-order, bottom first
  selectedIds: readonly string[];
  worldPoint: Point;
  handleToleranceWorld: number;
}): SelectionTarget;
```

Priority: a vertex handle of an already-selected record → the topmost body containing the point
→ `null`. `SelectTool.pointerDown` and `SelectTool.pointerMove` both call it; the tool's private
`hitTest`/`vertexAt` are deleted in favour of it. Overlap cycling is out of scope (one record
type) and the resolver's shape leaves room for it.

### 6.2 Hover

`SelectTool.pointerMove` with no gesture in flight writes `renderState.hoveredObjectId` from the
resolver's body hit (or `null`). `InteractionLayer` draws a hover outline (stroke only, from
`tokens`) for that id when it is not the selected one. The canvas cursor class is `pointer`
over a body, `grab` over a handle, default otherwise, via the existing `cursorClass` mechanism.
Hover never calls `selection.select`.

### 6.3 Escape precedence, in one function

`PlanCanvas.onKeyDown` (main) already handles Escape. The rule is, in order: an open Add menu or overlay closes (the root owns those and handles the
key before the canvas sees it); else a running pan swallows it (existing); else ANY active tool
holding a draft — `DrawPolygonTool`'s vertex buffer, `CalibrateTool`'s placed point, or
`SelectTool`'s drag in flight — cancels that draft and stays put (`EditorTool.hasDraft()`), so a
selection is never cleared out from under a hand still dragging; else an active non-Select tool
with nothing drawn returns to Select through `setTool('select')` alone, whose deactivation of
the outgoing tool IS the cancellation boundary (no separate `cancelGesture()` call — `hasDraft()`
has already answered `false`); else with Select active and a selection: clear it; else nothing.
Clicking empty canvas already clears (`SelectTool.pointerDown` with `null` hit).

*Amended 2026-09-04.* The first version nested the draft test under "an active non-select tool"
and called both `cancelGesture()` and a return to Select on the no-draft arm. The code shipped the
order above deliberately (`escapeRouting.ts`, `escapeRouting.test.ts`'s "Select mid-drag cancels
the drag before it would clear the selection") and this section now says what the code does.

### 6.4 List selection frames the record

`RoomSummaryList` row activation calls `selection.select([id])` and then
`editor.setViewport(fitViewport(boundsOfZones([record]), stage, padding, currentZoom))` through
the same door the `Shift+2` shortcut uses. A degenerate extent (`null` bounds) leaves the camera
alone; the selection still changes.

### 6.5 Retiring a gone selection

A watcher in the runtime compares `selection.selectedIds` against `projectStore.zones` after
every successful hydrate and clears ids that no longer resolve. The Floor Inspector then draws.
Nothing rebinds by name or position.

### 6.6 Announcing the return to the floor

A shell-level `SelectionGuidance` region (mounted by the root beside the warning strip, so it is present in every layout mode — amended 2026-09-04, the Inspector is unmounted while the constrained drawer is closed) has one `role="status"` element that receives
`editor.inspector.floor.guidance` when the selection goes from non-empty to empty, and is emptied
again on the next tick, so a refresh or a pointer move never re-announces it.

### 6.7 Room Inspector content

Heading is the room name with a type label (`editor.zone-type.<type>` keys, homeowner wording:
Room, Garden, Terrace, Driveway, Roof, Construction area, Other). Below: floor name, area in
m² (existing formatter). Then the existing Requirements panel unchanged. Then
`HomeownerQuestionNav` with What's here / What will change / What needs doing, each marked
unavailable (`editor.inspector.unavailable`), then `LinkedContentList` (Costs, Documents, Photos,
Notes) likewise. Then Delete, unchanged. No count is rendered for any unavailable row.

## 7. Add

### 7.1 Catalogue

`src/presentation/editor/add/creationCatalogue.ts`:

```ts
export interface CreationEntry {
  readonly id: 'room' | 'wall' | 'door' | 'window' | 'area' | 'path' | 'fence' | 'item' | 'measurement' | 'note';
  readonly group: 'structure' | 'property' | 'planning';
  readonly labelKey: StringKey;
  readonly descriptionKey: StringKey;
  readonly synonymKeys: readonly StringKey[];
  readonly availability: { kind: 'available' } | { kind: 'unsupported'; reasonKey: StringKey };
  readonly activate: (runtime: EditorRuntime) => void;   // only called when available
}
export const CREATION_CATALOGUE: readonly CreationEntry[];
```

Room is `available` and activates `runtime.setTool('draw-polygon')`. Every other entry is
`unsupported` with `editor.add.unsupported.not-yet` as its reason. An unsupported entry's
`activate` throws, so a menu that called it would fail loudly in a test rather than doing
nothing. Room carries the hint `editor.add.room.hint` ("Fastest way to start").

### 7.2 Menu

`AddMenu.vue`: `role="menu"` anchored below the Add button, `role="menuitem"` per entry with
`aria-disabled` and the reason as `aria-describedby`; roving `tabindex`; ArrowUp/Down, Home/End;
a search input that filters on localized label, description and synonyms; Enter or click on an
available entry closes the menu, then calls `activate`; Escape or click outside closes without
calling anything; focus returns to the Add button on close. The menu handles its own keys with
`.stop` so the canvas never sees them.

### 7.3 Task lifecycle

`DrawPolygonTool` is unchanged in its gesture. The runtime returns to Select on two events it
already observes: a successful close (the tool selects the new zone; the runtime then
`setTool('select')`) and a cancel with an empty draft. `TemporaryToolBanner` shows while
`activeToolId` is `'draw-polygon'` or `'calibrate'`, with `editor.task.draw-room.instruction`
("Click to place corners; click the first corner to finish") or the calibrate instruction, and a
Cancel button that calls the same Escape routine. Repeated creation is NOT built; the banner has
no toggle for it and the spec records this.

## 8. Strings

Every new key lands in `en.ts` and `de.ts` in the same edit. German addresses the user formally
and says `Objekt` for an asset. The Plan Editor toolbar's keys are deleted from both; no `editor.toolbar.*` key survives in either locale, and `strings.test.ts` refuses the prefix. The
per-key interpolation-hole test already guards the two locales against each other.

## 9. Sequencing and the asset-designer branch

The asset-designer branch has extracted `EditorSurface.vue` from `PlanCanvas.vue` and edited
`StatusBar.vue`, `EditorToolbar.vue`, the tool framework and several test rigs. This increment
is built in waves so that its only conflict-free work runs first:

1. **Wave 0** on `main`: §2 (ADRs, report, round-trip test). No `src/` change except the test.
2. **Rebase gate**: merge `main` into this branch. If the asset-designer branch has not landed
   on `main`, STOP and report rather than building the shell against `PlanCanvas.vue` as it
   stands. When it has, §6.3's Escape routine lives in `EditorSurface.vue`, and the plan's task
   naming is adjusted at that gate.
3. **Wave 1**: §3 read models and `getProject`; §4 store members and the CSS skeleton for the
   three modes.
4. **Wave 2**: §5.1 context bar, floating actions, panel, Inspector frame and bodies; §6
   resolver, hover, Escape, list framing, retirement, announcement.
5. **Wave 3**: §7 catalogue, menu, banner; §5.4–5.5 rail, overlay, drawer, unsupported notice;
   §5.1 warning strip.
6. **Wave 4**: harness knobs (`?select=<id>`, `?add`), fixed shots `plan-editor-selected`,
   `plan-editor-add-menu`, `plan-editor-narrow` (460px); accessibility cases; manual test case;
   PBI and task status updates; CLAUDE.md section.

## 10. Testing

| layer | cases |
|---|---|
| contract | `editorRoundTrip.test.ts` (§2.5) |
| read models | mapping preserves id and kind; area derived; aggregates available/partial/unavailable; unreadable count travels |
| stores | `layoutMode` transitions; one overlay at a time; select-as-default after ready; gone-selection retirement |
| resolver | handle beats body; topmost body wins; identical candidate sets resolve identically regardless of order; hover and click agree |
| components (jsdom) | context bar breadcrumb and undo/redo flags; floating actions pressed state; Add menu keyboard traversal, search, Escape, focus return, one activation per choice, unsupported entries inert; Escape precedence at each level; list row selects and frames; Room Inspector shares the id with the selection; unavailable rows render no count; warning strip shows two conditions at once and retires one without the other; shell modes move panels without remounting the canvas (asserted on element identity) |
| accessibility (axe) | plan editor in `full`; Add menu open; `constrained` with the overlay open; `constrained` with the drawer open; Room Inspector with a selection; `unsupported` |
| build | strings complete in both locales; every new stylesheet class declared; no `editor.toolbar.*` key in either locale and no reference under `src/` |
| harness | four fixed shots read by eye at 1280 and 460 |
| manual | `docs/tests/cases/Open a floor and select a room.md`: focus behaviour of overlay and drawer, Obsidian keymap interaction with the menu, the real leaf at sidebar width |

Coverage floors are the binding constraint (`vitest.config.ts`); every new arm ships with its test
in the same task.

## 11. Risks

| risk | control |
|---|---|
| The asset-designer merge lands mid-increment and moves `PlanCanvas` under Wave 2 | Wave 0 is docs-only; the rebase gate before Wave 1 is a hard stop |
| Deleting the toolbar reddens shell, calibrate-wiring and four `tests/build/` button tests | Named in the plan; the fixtures move to the context bar and floating actions in the same task |
| Layout thresholds are wrong | Judged by the 460px and 1280px captures in Wave 4; the numbers are constants in one file |
| An unavailable row becomes a clickable control that does nothing | Rows render as `<li>` text with a reason, never as `<button>`; a test asserts no button inside `HomeownerQuestionNav` |
| `layoutMode` remounts the canvas and loses the viewport | The shell test asserts the canvas element identity is preserved across `full` ↔ `constrained` |
| Branch coverage headroom is one unit | Each task's plan names the arms it adds and the test that reaches them |

## 12. Out of scope, stated so it is not read as forgotten

Rectangular Add Room and its name form (Feature B, Phase 4); multi-selection and badges; context
menus and the direct-action popover; the perspective switch; the property tree and floor
switching; per-plan display units; grid and snap settings; overlay panel opacity and lock;
repeated-creation opt-in; any schema change or migration; any new vault write.
