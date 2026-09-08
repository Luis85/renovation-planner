# Opening placement and plan symbols

User-authorized extension to M01 and ADR-0020. Sidecar schema **5** reserves optional
`Opening.swing: { hinge: 'start' | 'end', side: 'left' | 'right', angle: number }` for
Doors and Windows, in current and intended structures. Angles are finite degrees in
the inclusive range 0–180. The hinge selects the opening endpoint along the directed
host; side means left/right looking from host start toward host end. In downward-y
coordinates the left normal is `(dy, -dx) / length`.

Absent swing remains absent through legacy read/write/history. Rendering defaults to a
start hinge on the left, Door angle90 and Window angle0. A plain Opening has no leaf and
rejects swing. The migration4→5 changes only the discriminator in memory; writes use5
only when current/intended openings contain swing. All other geometry and Plan metadata
retain their existing authority. Rotation/calibration carry swing without changing its
relative hinge/side/angle, and projection equality includes these facts for peer guards.

## Schema foundation verification

Scoped ESLint and `vue-tsc --noEmit` passed. The three repository/migration test files
`openingSwingPersistence.test.ts`, `structurePersistence.test.ts` and
`persistence-wiring.test.ts` passed **20/20** cases. They verify legacy read-only defaults,
version5 round-trip/current+intended preservation, exact Undo/Redo, lower-version restoration,
invalid/plain-opening refusal and the registered migration version.

## Pointer, editing and native-symbol continuation

- Hovering a host previews the selected Door/Window/Opening centred at the pointer's projection.
  The complete opening stays within its host; placement fields round to millimetres without
  rounding beyond the host end. The persisted `offset` still means the opening's leading edge.
  A primary click uses the existing `finish()` path once, selects the new opening and returns
  to Select. Numeric placement/Finish remains available. Invalid structure previews are withheld.
- `structureActions.moveOpeningToPoint(id, point)` requires a single selected opening and Select
  mode. It keeps the host, dimensions and ID, projects the point onto that host, then uses the
  existing fresh-baseline Preview/Apply form, guarded StructureCommand and history. It never
  silently rehosts an opening. The root-owned context menu will expose this action.
- Door/Window creation and editing expose hinge, side and angle. New doors default to90°, new
  windows to0°. Existing untouched swing fields retain their exact absence/value. Angle edits
  invalidate the impact preview; invalid values have field feedback and focus the angle input.
- Native opening symbols render the wall cut and jambs, window frames and closed/open leaves,
  and door leaf/swing arcs from host-relative geometry. Hinge, side and angle determine the
  symbol; a plain Opening draws no leaf. Colors come from the existing theme-token adapter.
  No reference raster is needed for any of these symbols.
- Host rotation and calibration carry the saved swing facts unchanged and derive the symbol
  from the transformed host. Curved-host work must adapt the existing along-wall projection
  and tangent calculations; this concern does not introduce curved-wall persistence.

Continuation validation: scoped ESLint and TypeScript passed. Eight focused files passed
**61/61 tests**, covering geometry symbols, all three click-placement paths, reviewed move and
swing editing, exact history, invalid input/cancel/peer refusal, existing structure routes,
legacy fresh-repository reload and wall rotation. Scoped Oxlint passed after replacing a
foundation-test non-null assertion with `expectDefined` and a callback reference with an arrow.

The whole-tree Oxlint run also reported three pre-existing creation-branch findings in
`DraftRoomDimensions.vue` and `RoomDraftSketch.vue`; those files are owned by the parent's
separate creation fix. Integrated coverage, matching screenshots, context-menu wiring and
native-host acceptance remain with the coordinating parent. No full visual acceptance is
claimed by these component/repository checks.
