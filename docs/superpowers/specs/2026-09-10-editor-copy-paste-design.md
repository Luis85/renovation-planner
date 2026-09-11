# Plan editor — copy and paste

**Date:** 2026-09-10
**Source:** PRD §39 (`docs/product/prds/obsidian-renovation-planner.md`) lists Copy and Paste among
the editor's keyboard shortcuts; the editor interaction spec §65 lists Duplicate in the Room and
Wall context menus. Duplicate is NOT delivered here (§9).
**Baseline:** `main` at `c6db3854`.
**Status:** implemented by `docs/superpowers/plans/2026-09-10-editor-copy-paste.md`; the manual
case `docs/tests/cases/Copy and paste across floors.md` has not been run in a vault.

## 1. What this increment delivers

A renovator selects a kitchen and its walls on the ground floor, presses Ctrl+C, opens the first
floor, points at an empty spot and presses Ctrl+V. The kitchen, its walls, doors and windows and
the stair beside it appear under the pointer, selected. One Ctrl+Z removes all of it; Ctrl+Y puts
it back under the same ids.

- **Copy** — Ctrl/Cmd+C, or **Copy** in the canvas context menu. Snapshots the selection into a
  plugin-held clipboard. Always allowed, Review perspective and a stale floor included: it writes
  nothing.
- **Paste** — Ctrl/Cmd+V, or **Paste** in the canvas context menu. Writes a copy of the clipboard
  onto the CURRENT floor, any floor of any project, as ONE undo step, and selects the result.

Everything selectable can be copied: Rooms and Areas, walls, openings, spatial elements (objects,
paths, fences, measurements, stairs, arrows) and groups.

## 2. What a copy captures

Pure, in `src/domain/spatial/clipboard.ts`, node-tested. Input: the selected ids, the floor's
zones, its sidecar `Structure` and groups, and the plan's element metadata. Output: a
`SpatialClipboard` — a plain, serialisable value with no ids from the source floor that anything
downstream keys on except to rewire references inside the clipboard itself.

| Selected | Captured |
|---|---|
| Room / Area | outline (points and per-edge bulges), `zoneType`, `name`. Nothing linked. |
| Room | also its boundary walls (`Structure.boundaries`), so a pasted room still has walls |
| Wall | geometry, thickness, height, bulge; every opening it hosts |
| Opening | its host wall, and so every opening that wall hosts (`groupRoots` / `groupMembers`) |
| Element | kind, points, stair options, name from `spatialElements` metadata |
| Group | only when EVERY member is captured; name and membership |

The dependency closure is applied once, in that order, and is a fixpoint: a room pulls its walls,
a wall pulls its openings. A boundary is captured only for a captured room (its walls are then
always captured with it).

**Not captured**, deliberately: requirements, costs, material needs, renovation subjects, work,
decisions, evidence and photos (all keyed to the source room or target), planned (`intended`)
geometry, zone status (the copy takes `Zone.create`'s default). A copy starts clean; duplicating
linked records would double-count estimates.

**Names are kept verbatim.** `ZoneName` does not require uniqueness, and `freshNotePath` already
names a clashing note `name <id>.md`.

Positions are stored relative to the copy's pivot — `groupPivot(groupPoints(…))`, which already
accounts for arcs and stairs — so placement is one translation.

## 3. Where the clipboard lives

Each editor leaf mounts its own Vue app and Pinia (SDD §12), so a clipboard shared across floors
cannot be a store. It is `EditorClipboard`, a Vue `ShallowRef<SpatialClipboard | null>` created by
`createEditorClipboard()` in `src/presentation/editor/clipboard/editorClipboard.ts`, constructed
ONCE as a field of `RenovationPlannerPlugin` and handed to every leaf through `PlanEditorDeps` — a
ref rather than a plain holder because Vue's reactivity is not scoped to one app, so a Copy in one
leaf re-evaluates another leaf's Paste menu item. A plugin field survives the settings-save
remount that rebuilds the composition root. It does not survive an Obsidian reload, which is
acceptable for an in-app clipboard.

The OS clipboard is not used: it would make pasted content a trust boundary needing a schema, for
no requirement anyone has stated (§9).

## 4. Placement

Pure, beside the capture function: `placeClipboard(clip, target, zoneIds, mintId)` returns the
zone geometries and the structure, element-metadata and group additions for the target floor.

- Every point translated so the pivot lands on `target` (world millimetres — calibration is per
  plan, so a copy keeps its real size across floors). That holds between calibrated plans: an
  uncalibrated plan draws at placeholder scale 1, so a copy between a calibrated and an
  uncalibrated plan changes apparent size.
- New ids through the injected `mintId` (`createEntityId` in production): `wall-`, `opening-`,
  `element-`, `group-`. Zone ids are NOT minted here — they come back from the zone writes (§5,
  step 1) and are passed in.
- References rewired: `Opening.hostId`, `RoomBoundary.roomId` / `wallIds`, `SpatialGroup.memberIds`,
  element metadata ids.

**Target point.**
- Keyboard paste: `EditorStore.pointerWorld`, or the viewport centre when the pointer is off the
  stage.
- Context-menu paste: the world point where the menu was OPENED (the pointer is over the menu by
  the time the item is clicked); the viewport centre for a keyboard-opened menu.

A viewport-centre helper does not exist; `NewRoomInspector.vue`'s local `stageCentreWorld()` and
two inline computations do. The increment extracts one beside `Viewport.ts` and uses it here — the
existing three may follow it, but changing them is not required.

## 5. `PasteCommand`

`src/application/commands/spatial/PasteCommand.ts`. One undoable object — `{ execute, undo }`
returning `DispatchResult` — dispatched through the leaf's `CommandHistory`, so the stale gate,
save-state tracking and state refresh apply as for every other edit. It COMPOSES existing
commands rather than writing files itself:

1. **Zones.** One `ReversibleCreateZoneCommand` per captured Room/Area, in clipboard order. Each
   mints its id, writes the note and its sidecar object, and records the related plan write in the
   leaf's `WriteLedger`. The created ids feed placement.
2. **Structure and elements.** Read the renovation baseline (plan + sidecar) AFTER step 1, then one
   `RenovationCommand` with `spatial: { structure: current + placed walls/openings/boundaries/
   elements, metadata: current + placed names }`, `renovation` and `intended` unchanged. Skipped
   when the clipboard holds no walls and no elements. That command already writes metadata and
   sidecar together and restores the metadata if the sidecar write fails.
3. **Groups.** Only when the clipboard holds groups: read the sidecar, one `GroupGeometryCommand`
   whose document is the current one plus the placed groups.

**Failure.** If step *k* fails, the steps already applied are undone newest first, and the step's
own error is returned — a validation refusal (`spatialError('intersection')`, invalid group, …)
reaches the user through the existing `report-failure` mapping. If a compensating undo itself
fails, the result is `markUncompensated`, which the editor already turns into the reopen-the-floor
recovery.

**Undo / redo.** Undo runs the applied steps' `undo()` newest first; redo runs their `execute()` in
order. Sub-commands keep their snapshots, so redo restores the same ids and the placed structure
remains valid. Each sub-command already refuses with `undoSuperseded` when something outside this
leaf changed what it wrote; `PasteCommand` stops at the first refusal and returns it. Whether the
ledger generation stays stable across the sub-commands' OWN sequential writes (step 1's recorded
sidecar receipts versus steps 2 and 3's generation checks) is asserted by a test before anything
builds on it — it is the design's one unverified assumption.

**Known refusal.** `validateStructure` accepts only end-to-end wall junctions, so a paste whose
walls cross or overlap an existing wall is refused with the existing intersection message. That
structure refusal is checked before any zone is written, so a refused paste writes nothing;
compensation covers failures after that point. The user moves the pointer and pastes again. Snapping or splitting walls is out of scope (§9).

## 6. Wiring

- **Shortcuts.** `surface/historyShortcut.ts` gains C and V beside Z and Y, so both inherit its
  guards: ignored while a field is being edited, a dialog is open, or the event is already
  handled. Copy claims the chord — and copies — only when there was something to copy; Paste
  claims it whenever it could write, then claims but ignores it (`preventDefault` without
  pasting) during a gesture or on an OS autorepeat, exactly as Undo is. So a copy inside a text
  field stays native. Paste additionally claims nothing when `writesBlocked` or the clipboard is
  empty.
- **Context menu.** `useCanvasMenuActions` gains `copy` (group `object`, shown only when the
  selection holds something copyable, every perspective — hidden rather than shown disabled,
  since Copy is not an edit and a greyed item could only offer an edit's own reason) and `paste`
  (group `create`, shown when the clipboard is non-empty, hidden in Review exactly as the other
  edits are, disabled with `editor.stale-write-refused` ("Editing is paused until the floor is
  re-read.") when writes are blocked, or with `editor.input.unavailable` ("Not available while
  another tool or edit is active.") when a structure, element, rotation or group edit is already
  reading its baseline or has a form open — any of those saves would otherwise refuse as stale
  once the edit resumes). Icons:
  `copy`, `clipboard-paste` — the harness draws only icon names it has a pinned fixture for under
  `tests/fixtures/editor-icons`, so both are added there. Review returns early after `fit` today;
  `copy` is pushed before that return.
- **Actions.** `clipboard/clipboardActions.ts` holds `copy()` and `paste(target?)`, provided by
  `PlanEditorRoot` and injected by the context menu — not members of `EditorRuntime`, because
  `runtime.ts` is at its line budget. Both the shortcut and the menu call these — one action,
  every input.
- **Selection.** After a successful paste the selection is exactly the pasted ids (zones, walls,
  openings, elements), focused on the first.
- **Copy.** English and German keys: the two menu labels and any refusal sentence not already
  mapped (`editor.clipboard.*`). No literal reaches a notice (`NOTICE_TEXT_BAN`).

## 7. Testing

- **Domain (node).** Capture: each dependency rule, fixpoint (opening → wall → sibling openings),
  partial groups dropped, boundaries only with rooms, element names. Placement: translation of
  points, bulges and stair geometry; id remapping of every reference; no source id survives.
- **Application.** `PasteCommand` against `createRepositoryStack`: rooms + walls + elements +
  groups written and valid; failure injected at each step compensates back to the baseline
  document and note set; undo then redo restores identical ids; an outside write between execute
  and undo refuses; the ledger-generation assumption of §5.
- **Presentation.** Shortcut guards (field, dialog, gesture, blocked, empty clipboard); menu item
  presence per perspective and selection; target point for menu versus keyboard paste; clipboard
  shared by two mounted editors through one holder.
- **Manual.** `docs/tests/cases/Copy and paste across floors.md` — copy a room with walls and a
  door on one floor, paste on another, undo, redo, reload. Unrun until walked in a vault.

## 8. Layering check

`domain/spatial/clipboard.ts` imports only `core/` and `domain/`. `PasteCommand` imports only
`application/` and below. The holder type lives in `presentation/editor/` and the plugin, which may
import every layer, constructs it. No new registration with Obsidian: the shortcuts are DOM
keydown handling inside the view, not commands, matching Ctrl+Z.

## 9. Not in this increment

- **Cut** — Copy then Delete, which exists.
- **Duplicate** (spec §65, PRD §39) — a thin follow-up once paste is proven.
- **System clipboard** — survives reloads and vaults; needs a zod schema at the trust boundary.
- **Copying linked records** (requirements, work, costs, evidence) and planned geometry.
- **Joining or snapping** pasted walls to existing walls.
