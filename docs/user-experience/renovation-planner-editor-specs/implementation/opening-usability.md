# Opening placement and plan symbols

Current Move follow-up on PR #112: [delivery and automated verification](opening-move-delivery.md).
Move now projects the pointer onto its existing host even away from the wall or beyond an
endpoint. Older off-host refusal statements below are historical for Move; overlap and
host-containment validation still apply. Creation and numeric editing keep their existing contracts.
Manual acceptance of this follow-up is user-owned and pending, without blocking implementation.

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
  silently rehosts an opening. The direct canvas Move task below uses the same guarded command boundary.
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
separate creation fix. Integrated coverage, matching screenshots and
native-host acceptance remain with the coordinating parent. No full visual acceptance is
claimed by these component/repository checks.

## Move along the existing wall (2026-09-09)

The Inspector and single-opening canvas context menu now expose **Move along wall**.
Admission preserves the current selection, closes a constrained Inspector drawer, and
focuses the canvas. A temporary crosshair task highlights the original host wall and
previews only the selected opening. The primary click places its centre along that host,
clamped so the entire width remains on the wall; off-host and overlapping proposals cannot
write. Numeric Edit measurements remains available as the keyboard alternative.

One Escape cancels the task without a history entry. A click received while the baseline
read is pending is retained once; cancellation or a selection/context change retires that
click. Committing uses the existing version-guarded StructureCommand and shared history,
preserving identity, host, dimensions, sill and swing metadata. No new schema is introduced.
Curved hosts use the shared analytic projectOntoWall/openingOffsetAt contract.

The structural task, existing edit actions and Move task are composed by structureEditing
around the same per-editor ledger and transient structure preview. A held-pointer tool
switch clears the Move preview without recursively changing the requested next tool.

Verification on 2026-09-09: scoped Oxlint and ESLint, vue-tsc and the structure browser
script's Node syntax check passed. The initial seven-file batch passed 68 of 69 cases;
the existing lifecycle deletion case timed out because its positional selector clicked
Rotate. The actual Delete control now has an explicit action marker, used by both the
test and browser journey. Its timeout was not increased. The final two-file retry passed
29 of 29 cases: all 15 Move cases and all 14 structure lifecycle cases. Together with the
earlier opening/structure/curved presentation/geometry results, 71 unique targeted cases
are covered green.

Move regressions cover Inspector/context-menu admission and focus, exact Undo/Redo,
off-host/overlap refusal, endpoint bounds, curved-host arc distance and swing preservation,
early-click/blur/Escape retirement, held-pointer next-tool preservation, pending-write
admission, peer refresh and stale-write refusal, failed-read recovery, and Review/hidden
layer admission. Native visual confirmation and execution of the corrected browser
journey remain part of the integrated release evidence run.
