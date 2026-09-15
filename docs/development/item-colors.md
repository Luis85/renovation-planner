# Plan colour contract

`ItemColor` (`src/domain/spatial/ItemColor.ts`) is a preset id — `slate`, `rose`, `amber`, `green`, `blue`,
`violet` — or a lowercase `#rrggbb`. Absence means Default; `null`, `default`, uppercase or 3-digit hex, other CSS
forms and unknown ids are invalid. It is optional on every `SpatialElement` kind, `Wall`, `Opening` and `Zone`.
The name keeps "item" because renovators call every plan thing an item. [ADR-0033](adrs/0033-a-colour-is-user-content-on-every-plan-family.md) records why.

## Persistence

The geometry sidecar owns it: `structure.elements[]`, `structure.walls[]`, `structure.openings[]` and the room's
`objects[]` entry. A room's note never carries it. `Zone.color` round-trips through `zoneMapper` exactly as
`labelOffset` does, so a rename, move or lock keeps it, and `observeZone` includes it, so a peer's recolour changes
the zone's version.

Schema 16 adds the field to every family; 15→16 changes only the discriminator. The writer picks 16 when any hex
colour exists or a wall, opening, room or non-item element carries a colour; a placement's own size still writes 15,
and presets on items and placements 14, and a reset downgrades normally. Older readers refuse 16 rather than strip
it. The proposed (intended) structure can hold a colour carried through the proposal pipeline; nothing here
recolours it.

## Commands and selection

`groupActions.setColor(ids, color)` is the one door. It captures the selection through group operations, sets or
physically removes `color` on exactly the selected ids with `recoloredDocument` — never a wall's hosted opening
unless it is selected too — and commits one conditional sidecar write through `GroupGeometryCommand`: one history
entry, the displayed-document stale check, busy and saving refusals, Plan only. The same colour writes nothing.
`sameGeometryDocument` compares the colour on every family, so undo refuses over a peer's recolour, and the
command records a zone receipt for a colour-only change, so the zone edits around it still undo.

`colorTargets` admits every selected room, wall, opening and element, or nothing when any id cannot be coloured —
never a silent subset. Values that differ read **Mixed**, with no swatch checked; any choice sets them all.

Copy/paste and item promotion carry an element's colour. A pasted room starts uncoloured.

## Rendering and accessibility

Preset samples: slate `#778899`, rose `#ce6682`, amber `#d69b32`, green `#54976d`, blue `#518cce`, violet `#956bc4`.
A filled area (item, placement and its solid details, stair outline, hatch-mark tile ground, wall body or its tile
ground) takes an opaque blend of 28% colour over the resolved host background; an unparseable host background keeps
the host fill. A line, mark or text (path, fence, measurement, arrow, beam, post and its load-bearing fill, dimension,
section, view, grid, boundary, text, opening frame, leaf and arc) takes the colour at full strength, and the accent
while selected. A room takes a translucent wash: opacity 0.18 at rest, 0.28 selected. Outlines of closed shapes,
labels, selection marks and handles keep host tokens. Nothing enforces contrast for a custom colour.

`ItemColorControl` renders Default and the presets as named pressed buttons in Details and `menuitemradio` buttons in
the context menu, with Left/Right between swatches and the menu's Up/Down/Home/End. Details adds a labelled native
colour input that commits on `change`, never `input`; the menu has none. It mounts in the element, structure, room and
multi-selection Details and in the context menu, and hides outside Plan.
