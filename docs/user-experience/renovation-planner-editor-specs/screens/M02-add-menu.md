# M02 — Add Menu

## Spatial rotation continuation — 2026-09-08

Every free spatial item (Room, Area, Object, Path, Fence and Measurement) has a rotation handle
and keyboard-accessible **Rotate by…**, clockwise 90° and counterclockwise 90° actions.
Positive relative degrees turn clockwise in the downward-y world; decimal point/comma are
accepted. The pivot stays fixed, all points transform rigidly from the immutable baseline,
and Shift snaps pointer turns to 15° with visible angle feedback. Free-item Apply/release
saves once; Cancel/Escape/tool exit discards, and zero/full turns add no history. Selection,
identity, links and separate Planned geometry remain intact across save, reload and Undo/Redo.

Walls rotate about their midpoint with hosted openings attached. Connected junction endpoints
follow, independent Room outlines do not, and impact review/Apply precedes the write. A selected
door/window/opening offers **Rotate host wall** rather than detaching it. Invalid intersections,
containment, conflicts and readback failure retain their guarded outcomes. The handle's visible
circular arrow and at least 44 px grab region avoid dimension/corner controls. Reference plans
retain setup rotation; this action does not create group transforms or catalogue orientation.
See [ADR-0025](../../../development/adrs/0025-spatial-rotation.md) and
[release traceability](../implementation/release-2026-09-08.md).

![M02 — Add Menu](../images/M02-add-menu.png)

## Screen description

The Add menu is the single scalable creation entry point. It translates a growing catalog of technical creation capabilities into homeowner concepts and short plain-language choices.

## Entry conditions

- The editor is loaded and not blocked by an unrecoverable failure.
- The user activates `+ Add` from M01, M00, or another selected-entity state.

## Primary use cases

1. Add a room using the fastest beginner path.
2. Draw walls for a precise or irregular layout.
3. Add doors, windows, property areas, paths, fences, items, measurements, or notes.
4. Search the catalog when it becomes too large to scan.

## Menu structure

- **Structure:** Room, Wall, Door, Window
- **Property:** Area, Path, Fence
- **Planning:** Item, Measurement, Note

Room carries the hint `Fastest way to start`; Wall carries `For precise layouts`.

## Interactions

| Trigger | Result |
|---|---|
| Activate Add | Open anchored menu and focus the first recommended item |
| Arrow keys | Move between menu items |
| Type in search | Filter by localized label and synonym |
| Select Room | Close menu and enter M03 |
| Select Wall | Close menu and enter M04 |
| Select context-dependent item | Start its temporary creation state, optionally pre-linked to current selection |
| Click outside / Esc | Close menu and restore Add focus; preserve an existing draft/tool until the next cancel action |

Creation tools are temporary. After one successful creation, the editor returns to Select unless the user explicitly enables repeated creation.

## Used components

- `FloatingPrimaryActions`
- `AddMenu`
- `AddMenuSearch`
- `AddMenuGroup`
- `AddMenuItem`
- `KeyboardHint`
- `Icon`

## Data and state requirements

- Catalog entries with localized label, description, group, icon, availability predicate, and activation command
- Optional current selection context
- Search query and focused item
- Active temporary-tool identifier after selection

## Accessibility and themes

- Implements menu semantics and roving focus.
- Icon is supplementary to the label.
- Disabled/unavailable entries explain why.
- Menu surfaces use Obsidian popover/background/border variables.

## Acceptance criteria

- The menu contains no internal terms such as Zone or Polygon.
- Esc always closes it without changing data.
- Choosing an item invokes exactly one creation path.
- The catalog remains usable by keyboard and in both themes.

## Delivered Area contract — Phase 3 / Increment A, 2026-09-05

Room and Area are available. Area uses `activateCreationEntry('area', runtime)` and a
separate `draw-area` instance of the existing drawing tool; the legacy free-shape Room
completion still creates a Room. Unsupported catalogue entries retain their reasons.

- Activation closes Add, focuses the canvas, and writes nothing.
- Place corners; close on the first corner, press Enter with canvas focus, or activate
  **Create area / Fläche erstellen**. All three doors use the same validated completion.
- Fewer than three points, non-finite coordinates, zero area and area overflow refuse
  completion. The outline survives a refused write; the save/error policy is unchanged.
- Success dispatches one `ReversibleCreateZoneCommand`, selects the created entity and returns
  to Select. Undo/Redo removes/restores the same Zone ID and geometry through existing ports.
- **Keep adding areas / Weitere Flächen hinzufügen** is off by default. When checked, success
  clears the outline and keeps the tool active. Unchecking restores one-shot behavior; leaving
  the tool resets the preference. It is not persisted or shared with Room repetition.
- Escape closes Add or an overlay first, then discards a draft, then leaves an empty tool,
  then clears an idle selection. Held repeats cannot cascade across these steps. Cancel leaves
  the task directly and preserves selection. A submitted write may still finish after Cancel;
  its late response cannot overwrite a replacement task or selection. Undo reverses that write.
- Enter belongs to the canvas only when the canvas has focus, no gesture is running and no
  Ctrl/Meta/Alt chord, composition or repeat is present. Shift remains the drawing constraint.
  Native form inputs do not trigger canvas actions.
- The default name is `Area {n}` / `Fläche {n}`, counted from hydrated spatial records; the
  persisted type is the existing `Custom` (`zone-type: custom`, displayed as Other / Sonstiges).
  This does not introduce an Area schema, migrate notes, or reinterpret non-Room types.

Evidence: `areaCreation.e2e.test.ts`, `add/areaOutline.test.ts`, `areaPersistence.test.ts`,
`tools/polygonFinish.test.ts` and `tests/harness/areaCreation.test.ts`. The browser scenario is
`?view=plan-editor&area`; `node scripts/editor-area-check.mjs` verifies keyboard/layout states
in light, dark, custom accent and German constrained layouts. Its browser fixture refuses
writes; successful persistence and Undo/Redo are exercised by the repository-backed tests.

Current reconciliation: Area name/type forms are implemented in finalization. Self-intersection detection is explicitly deferred by SDD §26 and the Spatial object entity contract. All eleven Add routes are now implemented; final integrated acceptance remains open.


## Numeric Area corner input — continuation of Phase 3 / Increment A

The Area task includes a native **Enter corner coordinates / Eckpunkte numerisch eingeben**
disclosure. It starts folded to preserve pointer workspace; opening it needs no Inspector
navigation or modal, including at constrained widths. Add still focuses the canvas; Tab
reaches the disclosure. The form scrolls independently and Finish/Cancel remain outside it.

1. Enter x and y in metres from the plan origin `(0, 0)` (x right, y down). Zero and negative
   values are allowed. The shared length parser accepts decimal point/comma, rejects units,
   exponents and incomplete values, and rounds input to whole millimetres. Absolute coordinates
   must fit safe integer millimetres; they are not bounded by the Room side-length limit.
2. **Add corner / Eckpunkt hinzufügen** or unmodified Enter in either field applies the pair
   to the existing temporary outline. The input clears and focus returns to x for the next
   corner. Enter in a field never creates the Area. Untouched fields preserve the exact
   original mouse coordinate when editing, even if its displayed metre value is rounded.
3. The ordered list states each corner's position. **Edit / Bearbeiten** loads a corner and
   focuses x; **Apply corner change / Eckpunkt ändern** updates it. **Remove / Entfernen**
   removes the chosen corner and returns focus to x. There is no second geometry representation.
4. Bad values stay in the form, explain their error through `FieldError` and focus the first
   invalid field. Duplicate positions are refused by the same tool rule as mouse placement.
   Pending input blocks completion and other row edits; **Discard coordinate entry /
   Koordinateneingabe verwerfen** explicitly abandons it. Folding the form does not abandon it.
5. Create area uses `areaOutline` and the existing command, for pointer and numeric points
   alike. Collinear/zero-area/overflowing outlines cannot complete. Another command's saving
   state blocks every completion door, including Enter and first-corner close (#75 review).
   Refused writes retain the outline. Undo/Redo reverses/restores the whole created Area.
6. Native fields keep Escape and their editing keys. From a button, Escape uses the existing
   root route; Add/overlays retain priority. An applied draft clears before the tool exits.
   Cancel exits directly; even an empty task retires its pending coordinate text. Success
   restores canvas focus after one-shot creation; explicit repeat keeps the empty task active.

The numeric form does not name/classify Areas or repair self-crossing outlines. It closes the
numeric-placement gap only; the remaining M02 and Increment A criteria stay open.


## Finalization continuation — Area details and free-shape Room (2026-09-07)

Selecting an Area exposes an explicit name/type form. Apply writes both fields as one conditional reversible Zone update, preserving its geometry, note body, requirements and Room/Area identity. A peer revision retains the draft and reports the latest metadata; Cancel writes nothing.

Add → Room includes a free-shape choice. A completed rectangle and chosen name survive this transition; native corner controls then edit the same temporary polygon used by pointer input. The free-shape task has a name field and explicit Create room action, uses the same completion gate for button, Enter and first-corner closure, and returns to Select after one creation. A missing name, invalid outline or pending corner text blocks completion. Undo/Redo preserves the created Room identity.

Evidence: `areaDetails.e2e.test.ts`, `editZoneDetails.test.ts`, `freeShapeRoom.e2e.test.ts`. These focused component/repository checks do not replace combined-tree theme or live-host acceptance.


## Add Note continuation (2026-09-07)

With one Room selected, Add → Note opens the same contextual Notes form as the Room Inspector. It starts with note type and the current Room/source context. Creating a contextual note writes an ordinary Markdown file through the existing evidence file service; applying the form attaches one evidence record. Undo removes that link and preserves the file. Redo restores the same evidence identity. Cancel before file creation writes nothing; an already-created file remains an ordinary vault note when the form is cancelled.

The menu explains that a Room must be selected and its planning data available. `addNote.e2e.test.ts` passes the unavailable, creation/history and cancellation paths against real commands and FakeVault-backed repositories. Element-context and shared-record integration is still pending the UI checkpoint.
