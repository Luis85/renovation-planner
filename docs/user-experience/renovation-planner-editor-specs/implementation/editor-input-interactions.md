# Editor input interaction preparation

The user's latest input requests add a selection marquee, an explicit Pan choice,
editor-wide undo/redo shortcuts and contextual actions. They supersede the earlier
absence of a persistent Pan control. Existing camera, command-history and typed form
routes remain the implementation authority; this concern changes no stored schema.

- Dragging from empty canvas in Select previews a marquee and selects intersected
  geometry on release. Shift adds; cancellation restores the starting selection.
  Body clicks, Alt cycling and handle priority retain the existing resolver.
- Pan uses the established surface camera, including pointer ownership and interruption
  rules. Space/middle remain temporary navigation overrides while drawing.
- Ctrl/Cmd+Z, Ctrl+Y and Ctrl/Cmd+Shift+Z use the editor's own history when focus is in
  its leaf. Native text history, composition and modal dialogs remain untouched. Repeat,
  active gestures, unavailable history and existing write guards prevent extra commands.
- The latest user correction requires Shift to behave exactly like Zone drawing. All
  line tools now share `constrainDrawingPoint`, which calls the existing configured
  `SnapService.snapDirection` before their normal point snapping. No separate 45-degree
  constant is introduced; changing or releasing Shift reuses the surface's existing
  modifier replay. Rotation retains its independent current behavior.
- Right-click and keyboard Context Menu/Shift+F10 open scoped actions. Existing typed
  Room/Area/Wall/Opening/element edit, rename, rotation and removal facades own mutations;
  empty canvas offers Add, Fit and Pan. The menu has keyboard navigation and focus return.

## Group integration seams

`SelectionInteractions` optionally supplies `expandSelection(id, deep)` and a
`selectionMove` gesture port. Selection continues to contain actual member IDs. The
owning group facade controls geometry snapshots, preview, versions and history; a refused
group move never falls back to moving one member. Input code forwards active gesture
updates and cancellation only.

`provideCanvasGroupActions` accepts the per-leaf group action provider, plus the same
optional expansion function for context selection. No provider means no Group/Ungroup/
Enclose menu items. Returned actions must represent actual supported commands with their
current guards; no placeholder controls or inferred stored relationships are created here.

## Verification

Whole Oxlint, scoped ESLint and TypeScript checks passed. Ten focused files passed 171
cases covering input interactions, marquee/group delegation, shared drawing constraints,
Select/Polygon behavior, camera navigation/ownership, structure/element tools and scene
ordering. Four stylesheet/button/encoding files passed 294 checks.

The new component cases use the real command history for Ctrl+Z/Ctrl+Y, the existing Room
rename form from the context menu, native input/modal exclusions, explicit Pan routing,
and keyboard context-menu dismissal. The marquee cases distinguish actual segment
intersection from a diagonal bounding-box false positive and verify no geometry command
is dispatched. The line cases compare Wall/Path/Fence/Measurement against the existing
Zone tool's actual constrained preview and verify release of Shift and placed points.

The group command facade is supplied by its separate contribution. This optional input
seam does not claim grouped persistence or transformations have been verified here.
Combined full repository gates, browser captures and live Obsidian acceptance remain pending.
