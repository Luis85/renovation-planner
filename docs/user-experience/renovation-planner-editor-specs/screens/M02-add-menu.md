# M02 — Add Menu

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

Remaining after the numeric continuation below: Area name/type forms, self-crossing
outline validation, and the unavailable creation domains. This contribution does not close
all M02 use cases or Increment A's domain-dependent criteria.


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
