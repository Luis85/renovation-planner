# Plan editor item creation modes and "Add to asset library" — design

Date: 2026-09-13 · Off `main` at `4ca4c7ea`. Two increments to the Plan editor's **Item**
(`place-object`, `SpatialElement` kind `'object'`), designed together because the second one
turns what the first one draws into a library asset.

## Why this exists

An Item is drawn today one corner per click, with an optional collapsed "Use a rectangle" section
for typed position and size. Rooms, in contrast, start as a rectangle drag and offer a switch to a
free-form outline. Most furniture and equipment is rectangular, so the item flow asks for four
clicks where a drag would do.

An Item is also a dead end: ADR-0023 keeps a generic object unlinked from the asset library, and
nothing lets a user promote an outline they drew into a catalogue entry. To get a costed,
reusable asset they have to open the library, create the asset, type its dimensions again, go
back and place it.

Decisions taken with the user:

1. **Rectangle is the default and the switch works both ways** — unlike rooms, whose switch to
   free-form is one-way.
2. **A promoted item becomes a placement** of the new asset, rather than staying a plain item.
3. **Asset details come from the existing New asset dialog**, prefilled, rather than one-click
   defaults.

## A. Rectangle or free-form item drawing

**State.** `ElementDraft` gains `shape: 'rectangle' | 'free'`, meaningful only for `kind: 'object'`.
`place-object` starts in `'rectangle'`. The tool id does not change, so the Add menu catalogue,
`TemporaryToolBanner`, `EntityInspector` and every `isElementTool` check keep working. Rooms use
two tool ids (`draw-room`, `draw-polygon`); repeating that here would touch every site keyed on
`place-object` for no behaviour a draft field cannot give.

**Rectangle mode.** In `ElementTool`, for `place-object` with `shape === 'rectangle'`:

- `pointerDown` (primary) records a snapped anchor and starts a drag.
- `pointerMove` during the drag calls `setPoints` with the four corners of the normalised
  rectangle between the anchor and the snapped cursor.
- `pointerUp` ends the drag. A zero-area drag leaves no points.
- A new drag replaces the rectangle.

Normalising and corner generation reuse the room tool's helpers (`draw-room-tool.ts` /
`room-draft-store.ts`) rather than a second copy. The details panel shows
`ObjectRectangleFields` expanded (X / Y / Width / Depth) instead of the per-point X/Y entry.

**Free-form mode.** Exactly today's behaviour: click corners, or typed X/Y plus "Add point".

**Switch.** A two-option control, "Rectangle | Free-form", in the banner (`TaskDrawingControls`)
and in `ElementTaskForm`. It is refused (inoperative) while the draft is blocked or has pending
typed input. The name is untouched, since it lives on the same draft.

- Rectangle → free-form keeps the current corners as editable points.
- Free-form → rectangle replaces the points with their axis-aligned bounding box when there are at
  least two distinct points and the box has area, and clears them otherwise.

**Persistence.** Unchanged: a polygon through `RenovationServices.command` with `elementInput`, so
validation (`areaOutline`), undo and saving are identical in both modes.

## B. Right-click → "Add to asset library"

**Menu.** `useCanvasMenuActions` adds `add-to-library` (group `records`) when exactly one element
of kind `'object'` is selected, the perspective is not Review, and the editor has asset-creation
services. It is disabled while writes are blocked or an element action is active.

**Dialog.** `openNewAssetDialog` accepts an optional prefill `{ name, footprint }`.
`NewAssetForm` then:

- starts with the item's name;
- renders a read-only line "Footprint: from the item outline (W × D mm)" in place of the Width and
  Depth inputs;
- after `createAsset`, writes the footprint with `setAssetFootprint({ assetId, points, measured: true })`
  instead of `setFootprintFromDimensions`.

The created-id retry rule and frozen catalogue fields are unchanged. If the prefill pushes the
component past its line budget, the footprint variant moves to a small sibling component sharing
the same dispatch; that is a planning decision, not a behaviour change.

**Footprint.** The item outline translated so its bounding-box centre is the origin — the same
convention `footprintFromDimensions` uses, so the default anchor `(0, 0)` is the middle.

`SetAssetFootprintInput` gains `measured?: true`. When set, the footprint is written
`footprintOrigin: 'typed'`, `footprintPending: false`; `validateAssetShape` already permits any
polygon under `'typed'` (its only rule is "typed is never pending"). Without the flag, a brand-new
asset with no calibration would record the outline as pending (`captureAwaitsScale`), and the
editor's placement read would answer `unscaled` and refuse to place it.

**Conversion.** When the dialog resolves `{ created: true }`, the item is replaced through
`elementTask.assets.write` — the path `replace` already uses — by
`{ id, kind: 'asset', assetId, points: placementPoints(centre, 0), name }`:

- **same id and name**, so linked records and labels survive;
- **identical world outline**: anchor `(0, 0)`, facing `0`, heading `0`, placed at the centre.

It is one reversible dispatch, so **undo restores the plain item**. The new asset stays in the
library; catalogue creation is not in the editor's history anywhere else either.

**Failure.** Asset created but conversion refused (stale floor, conflict): a notice through
`notifyOperationFailure`, the item is left as it was, and the asset remains in the library. A
cancelled dialog changes nothing. `{ created: false }` cannot occur, because no `findExisting` is
passed.

**Wiring.** `PlanEditorCommandServices` gains optional
`assetCreation?: { createAsset, setAssetFootprint, defaultCurrency }`, built in
`src/plugin/planEditorDeps.ts` from the guarded `persistence.createAsset` and
`persistence.assetDesign.setFootprint`. Absent, the menu entry is not offered.

**ADR-0023.** Still holds — an object never *silently* references an asset. Promotion is an
explicit user action that changes the element's kind; the ADR gets a one-line amendment pointing
here.

## Out of scope

- Promoting other element kinds (paths, fences, stairs).
- The similar-name hint in this dialog.
- A back-to-rectangle switch for rooms.
- Rotated rectangles in rectangle mode (an item drawn at an angle is drawn free-form).

## Testing

- `ElementTool` rectangle drag: points follow the drag, a re-drag replaces, zero-area leaves none;
  free-form clicks unchanged.
- Mode switch conversions (a pure function): corners kept; bounding box; cleared when degenerate.
- `useCanvasMenuActions`: offered for one object, absent for other kinds, several selected, Review,
  or no services; disabled while blocked.
- `NewAssetForm` with a footprint prefill: no dimension inputs, dispatches `setAssetFootprint`
  with `measured: true`, retry reuses the created id.
- `SetAssetFootprintCommand` with `measured: true`: `'typed'`, not pending, on an uncalibrated
  asset with no background.
- Conversion: same id and name, kind `'asset'`, placed outline equals the original polygon, undo
  restores the object; a refused conversion leaves the item and notifies.
- Locales `en` and `de`; `docs/using-plan-editor.md`; a manual case under `docs/tests/cases/`.
