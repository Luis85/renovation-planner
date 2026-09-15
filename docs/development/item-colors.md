# Item placement appearance contract

`SpatialElement.color?: ItemColor` is optional user content on `object` and `asset` only.
Its stable ids are `slate`, `rose`, `amber`, `green`, `blue`, `violet`. Absence means Default;
neither `null`, `default`, arbitrary CSS, nor unknown ids are valid persisted values.
`validSpatialElement` and the DTO enforce eligibility. Plain Items are called Objects in
German. Other SpatialElement kinds are structural facts or drafting/measurement marks and
are excluded, as are Zone-based Rooms/Areas, Walls/Openings and reference-plan appearance.

## Persistence and compatibility

The geometry sidecar's `structure.elements[]` owns the property, beside the placement
geometry. Plan Markdown still owns only the element id/name metadata. No Asset definition,
material, requirement, renovation record, Zone, or reference appearance field changes.

Schema 14 adds the optional field to the element shape in current and intended structures.
The 13→14 migration changes only the schema discriminator. All earlier migrations compose
normally; existing elements acquire no color. The writer selects schema 14 if either
structure contains an override and otherwise keeps its existing lowest-content-version
policy. Reset physically removes the field, allowing the normal downgrade when no other
content requires 14. Older readers reject version 14 rather than stripping an unknown field.

The editor edits the current placement in Plan. Intended geometry remains the independently
owned proposal and is not rewritten by this action. Its DTO can preserve a color carried
through the existing spread-based proposal pipeline. This feature introduces no editing
route for intended-only objects in Renovate/Review.

## Commands and selection

Both controls invoke `elementActions.setColor`. It uses the existing guarded `rewrite` →
`elementInput` → `RenovationCommand` → dispatcher route, including baseline comparison,
conditional Plan/sidecar writes, compensation, projection refresh and history. It admits
exactly one currently selected eligible element. Selection or mode changes during the read
(even away and back), unsupported ids, stale data, saving, active element operations, dialogs
and non-Select tools refuse the operation. A same-color request performs no write or history
push. Undo restores the previous element; redo reapplies the override.
Document content equality includes the color in both current and intended structures,
so undo/redo refuses a peer's appearance change even when the Plan note version is unchanged.

Groups and multiple selections have no palette and no batch color command. The action
also refuses direct single-id calls while multiple ids are selected. Existing Details member
focus plus Select focused item supplies a complete keyboard route without dissolving a saved group.
No mixed state is advertised and no eligible subset is silently changed.

Clipboard capture/translation and paste clone the element's fields, preserving the color
while minting a new identity. Placement replacement already spreads the current element.
Item promotion explicitly copies its color and rejects a concurrent change to that color.

## Rendering and accessibility

Content RGB values: slate `#778899`, rose `#ce6682`, amber `#d69b32`, green `#54976d`,
blue `#518cce`, violet `#956bc4`. Canvas fills blend 28% of the preset with 72% of the
resolved host canvas background, yielding an opaque fill. Asset solid details use that same
fill; dashed overhead detail and clearance semantics remain unchanged. The selected outline,
handles and labels continue using host tokens. The actual named value, pressed/checked state,
outline and check icon supplement color. These values are user content, never plugin chrome.

Konva's color parser supports the host's hex/rgb/named background forms. If a custom theme
supplies an unparseable color expression, the canvas keeps the host's original fill; Details
still exposes the saved name. This bounded fallback is preferable to choosing the wrong
contrast world. Swatch colors remain the fixed content samples under every host.

The shared control renders named pressed buttons in Details and `menuitemradio` buttons in
the context menu. Native Enter/Space activation is retained; Left/Right moves among colors;
menu Up/Down/Home/End includes all swatches. Disabled state is discoverable and callbacks
recheck admission. Targets are 36×40 px on wide desktop, 44×44 px under 900 px or coarse
pointer, with wrapping and host-token focus rings. Host control chrome is never recolored.
