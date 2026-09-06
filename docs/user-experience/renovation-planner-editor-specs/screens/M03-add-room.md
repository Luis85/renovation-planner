# M03 — Add Room

![M03 — Add Room](../images/M03-add-room.png)

## Screen description

This state supports fast room-first creation. The homeowner drags a rectangular room visually, sees live dimensions, and may type exact values before creating it.

## Entry conditions

- User chooses `Add → Room`.
- The current floor is editable.

## Primary use cases

1. Create a roughly sized room quickly.
2. Enter exact width/depth when known.
3. Choose a common room type and name.
4. Continue adding rooms deliberately.

## Interactions

| Trigger | Result |
|---|---|
| Pointer down + drag | Preview rectangular room and live dimensions |
| Snap near wall/guide | Align preview and announce snapped relation |
| Click dimension | Focus numeric entry; Enter applies preview value |
| Choose room type | Set semantic type; suggest a default localized name |
| Click `Create room` / Finish | Validate, execute one reversible create command, select new room, return to Select |
| Toggle `Keep adding rooms` | Return to room tool after creation instead of Select |
| Esc / Cancel | Discard preview with no write |

## Inspector content

- Room type
- Name
- Width and depth
- Calculated area
- `Keep adding rooms` off by default
- Create action

## Used components

- `TemporaryToolBanner`
- `RoomCreationOverlay`
- `SnapGuideLayer`
- `EditableDimensionLabel`
- `CreationToolBar`
- `NewRoomInspector`
- `Field`
- `SelectField`
- `CalculatedValue`
- `Toggle`

## Data and state requirements

- Draft geometry separate from persisted geometry
- Unit-aware length parser/formatter
- Snapping candidates and active guides
- Validation errors for zero/invalid dimensions or out-of-bounds numeric entry
- Reversible `CreateRoom` command

## Accessibility and themes

- Numeric fields provide the non-pointer route.
- Live measurements are announced without excessive repetition.
- Preview outline and handles remain visible in both themes.
- Focus returns to the created room or Add action after completion.

## Acceptance criteria

- The user can complete room creation without understanding wall drawing.
- Direct drag and exact numeric entry produce the same domain command.
- Cancellation writes nothing.
- Creation returns to Select by default.


## Existing-room precision continuation — Phase 4 / Increment B (2026-09-06)

Selecting one existing Room through the canvas or persistent list offers **Change room size /
Raumgröße ändern** in its Inspector. This is an explicit form task using the existing modal
`FormDialog`: the rest of the editor is inert, the form survives responsive panel changes, and
its own starting-size and preview text remain understandable when the canvas is covered.

Support is deliberately bounded by SDD §§20–26 and `normalizeTransformerResult`:

- Exactly four distinct, finite corners, implicit closure, and alternating horizontal/vertical
  edges. Either winding and any first vertex work. No bounding box replaces an arbitrary outline.
- Width is the world x extent; depth the world y extent. The `(min x, min y)` corner stays fixed;
  the opposite edges move right/down. Vertex order, winding, ID, name and classification survive.
- No independent stored orientation exists. Rectangles aligned with the floor axes are supported,
  including ones aligned after a quarter turn; other rotated rectangles, triangles, concave or
  redundant-corner outlines are not. Their Inspector explains this limit and retains corner editing.
- Metre labels use the shared parser/formatter: decimal point/comma, whole-mm rounding of edited
  values, positive lengths up to 1000 m. Unchanged fields preserve original sub-mm coordinates.
  An unchanged/equivalent size creates no history entry. Unrepresentable output is refused.

Opening reads a versioned baseline through `GetZone`. Width receives focus; Tab goes to Depth,
Apply dimensions, then Cancel, wrapping within the existing dialog focus trap. Typing updates
only form text, the existing dashed `RenderState.previewPolygon` and the numeric area preview.
Neither blur nor typing persists. Plain Enter submits the form; modified, composed or held Enter
cannot repeat it. Invalid submission keeps the text and focuses the first described invalid field.
Cancel or dialog Escape explicitly discards the operation; focus returns to its Inspector opener
or the replacement action/Details rail if a layout change removed that opener.
This follows the existing modal-form contract, without deciding the broader blur-commit issue.

Apply uses the Inspector edit mapping and the existing reversible `MoveSpatialObject` adapter,
with the baseline version supplied on the first write and shared ledger versions for Undo/Redo.
The ordinary dispatcher owns save status, history, projection refresh and recalculation. Busy
Apply/Cancel are inoperative but focusable, fields readonly. A failure retains the draft; a
conflict refreshes and displays the latest saved size (or its unavailability) without rebasing
the draft. Apply is paused; cancel and reopen to use that current baseline.
A successful write with failed readback remains a successful write and pauses later writes via
the existing stale state. Late baseline/submit responses cannot open or resolve a retired task.
Forced leaf closure has the existing FormDialog limit: it cannot undo an already submitted write.

Automated, browser and live acceptance are separated in [Resize a room](../../../tests/cases/Resize%20a%20room.md).
Room creation/type decisions, general shape repair, metadata editing, Walls/Openings and the
rest of Phase 4 / Increment B remain open.
