# M03 — Add Room

## All-edge measurements and free-form discovery — 2026-09-08

The user's new requirement keeps actual edge lengths visible for rotated and irregular Rooms,
including rotation, point editing and creation previews. The rectangular width/depth editing
boundary below still applies; it no longer limits read-only measurement visibility. Add Room
also exposes **Draw a free-form room** in the canvas task banner, so the route remains visible
with Details closed. The same action in the Inspector preserves the current name and rectangle
corners when switching to the existing free-form drawing task. See the
[implementation and pending acceptance](../implementation/room-edge-measurements.md).

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

## Existing-room naming continuation — Phase 4 / Increment B (2026-09-06)

Select one existing Room through the canvas or persistent list, then choose **Rename room /
Raum umbenennen** in its contextual Inspector. All Room outlines qualify, including triangles,
rotated and irregular polygons. The size form's four-corner/axis-alignment test does not apply.
Areas and multiple selections do not offer this action.

The root-owned `FormDialog` follows the existing dimensions/creation modal contract. It shows the
saved baseline name and focuses **Room name / Raumname**. Tab reaches **Apply name / Namen
übernehmen**, then **Cancel / Abbrechen**, then wraps to the field. Typing and blur change only the
local draft. Plain Enter submits; held, composed or modified Enter does not. Space, Delete,
Backspace and arrows retain native text editing. Escape discards the modal task and preserves
selection; no input key reaches a canvas action. Busy submission refuses Escape/Cancel and duplicate
Apply while leaving controls focusable and the input readonly.

The name contract is the existing `Zone.create` rule, now shared through `zoneName`: JavaScript
`trim()` removes outer whitespace, then the result must be non-empty. No case folding, internal
whitespace collapsing, Unicode normalization, uniqueness constraint, length limit or filename
character restriction is added. Empty submissions retain raw text, describe the field error and
focus the input. Names equal after this normalization never dispatch from the form and add no
history. Different rooms may have identical names; stable Zone IDs key selection, list rows,
canvas nodes and references, independently of their labels.

Opening acquires one entity/version through `GetZone`. Apply maps one Inspector `name` edit to
`RenameZoneCommand` and its reversible adapter. The first write supplies that exact baseline;
Undo/Redo use the existing shared write ledger, including peer-generation protection. A failure
retains the draft. A version conflict refreshes the current saved name (or explains its
unavailability), retains the original baseline/text and pauses Apply. Cancel and reopen to use the
new baseline; no silent rebase or overwrite occurs. Confirmed writes close the form even when
readback fails: existing stale-state recovery retries the read only. Retired baseline responses
cannot open a dialog; retired form completions cannot resolve a replacement dialog.

Name is independent of note filename/path. Existing `ObsidianZoneRepository.save` resolves an
update by ID and writes its indexed existing path. It retains the owned-frontmatter/body merge,
expected revision/observation check and compensating note/sidecar transaction. No rename or link
rewrite is requested, so no new file/link transaction is needed. ID, classification, status,
geometry and references stay intact. The v1 Markdown keys and sidecar format do not change;
`domainNoteLink` remains domain-only under the existing mapper contract, not a newly persisted
field. The repository can advance sidecar bookkeeping while retaining identical geometry entries.

Canvas, list and Inspector refresh through the ordinary dispatcher. `ZoneRenamed` enters the
existing plan-change subscription so other leaves refresh too, without emitting a false geometry
change or triggering a quantity/cost recalculation. Responsive panel remounts preserve the root
modal and its input focus; cancellation restores the replacement action or Details rail when the
original opener disappeared. Forced leaf/process disposal retains the existing limitation: a
submitted write may finish and no draft recovery is promised.

Evidence and open live acceptance: [Rename a room](../../../tests/cases/Rename%20a%20room.md).
That naming evidence covers its bounded increment. The continuations below and M02 now cover Area metadata and general numeric outline editing; the combined plan remains open pending integration and acceptance. Stored room kinds retain their explicit ADR-RK deferral.


## Numeric outline continuation (2026-09-07)

Select a Room or Area and activate **Edit corner coordinates** in its Inspector. The root-owned form lists each corner in world metres and previews valid edits. Untouched axes preserve exact stored coordinates; explicitly retyping a rounded value intentionally changes that coordinate. Signed decimal point/comma input shares the existing coordinate parser. Apply dispatches one existing reversible geometry command; connected walls keep their own geometry. Cancel retires the preview without writing. A stale baseline refuses the write and retains the typed draft.

This provides a non-canvas editing route for irregular outlines without replacing them with rectangles. `outlineProposal.test.ts` and `outlineEdit.e2e.test.ts` cover parsing, preview, reflow, cancellation and history; final integrated visual and host acceptance remain open.


## Room alignment continuation (2026-09-07)

Rectangle dragging uses the existing SnapService against saved Zone corners/edges, wall segments and hosted-opening endpoints. Its eight-screen-pixel tolerance scales with the camera. The press, preview and release share this projection; a visible marker and localized status identify alignment. A stationary click near an anchor still creates no rectangle. Exact numeric edits clear former alignment guides. Cancel, tool exit and completed creation clear the transient guides without changing saved geometry.

`roomSnapping.test.ts` and `drawRoomTool.test.ts` passed 24 tool cases; `roomSnapping.e2e.test.ts` passed two production-component cases covering visible feedback, persisted geometry, numeric override, cancellation and Undo/Redo. These results precede UI/recovery integration; combined visual, keyboard and live-host acceptance remain open.
