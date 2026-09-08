# Curved Room and Wall boundaries

Baseline: combined `aa5fddd9`, including verified Group6 `587f0266`, opening swing5, input,
hover-arrow and all-edge measurement continuations. Parent reserves curve sidecar7 before
Stair8. This topic is in progress and is not accepted release evidence.

## Approved contract and sequence

1. Add circular-arc Core primitives and optional per-edge `bulges` on a closed Room boundary;
   a Wall has one optional `bulge`. Missing/zero stays straight; finite values satisfy
   `|bulge| ≤ 1`, so larger arcs use multiple edges. Endpoints remain the existing world-mm
   coordinates. The quarter-angle tangent representation follows
   [Autodesk's documented bulge convention](https://help.autodesk.com/cloudhelp/2026/DEU/AutoCAD-LT-ActiveX-Reference/files/GUID-E1CE125E-AB3A-4645-B548-E43200064F9C.htm);
   visible direction follows this editor's existing screen-y-down coordinate system.
2. Deliver a verified domain/DTO7/migration/mapper/version-observation foundation commit early
   for Stair8. Preserve groups6 and opening swing5. Curve-only edits must change Zone geometry
   observations, including frozen before/after projections for mixed history.
3. Add exact arc length, area, centroid and extrema, with stable near-straight arithmetic.
   Curved Room rotation uses its analytic area centroid. Curved Wall rotation retains the
   established chord-midpoint pivot. Group bounds include actual arc extrema and hidden members.
4. Preserve curve parameters on legacy point-only movement/rotation/corner edits; refuse
   ambiguous topology changes instead of silently dropping curvature. Exact full-geometry
   replacements and history inverses remain distinguishable from point-only transforms.
5. Render and hit-test the actual boundaries; keep every edge's current/preview length visible.
   Hosted openings use arc-length positions and local tangents. Room-to-Wall enclosure copies
   curvature, matches existing curves rather than endpoints alone, and reverses bulge on a
   reversed edge. It does not establish a general live constraint system.
6. Expose an explicit **Edit curves** task for a selected Room/Wall with midpoint bend handles
   and precise bend-depth/radius entry, separate from Select's rotation/corner targets. Untouched
   rounded text preserves exact bulges; deliberate retyping requests the exact displayed input.
7. Verify analytic geometry, round trips, peer guards, exact Undo/Redo, legacy transforms,
   rendering/hit agreement, native keyboard/pointer paths and constrained EN/DE layouts.

Parent owns Group UI/actions and the final combined build, full tests, browser matrix and native
acceptance. Shared runtime/PlanCanvas/rotation/group/enclosure hunks are coordinated before edits.
No hierarchy redesign, general CAD engine, dependency install or plugin version bump is included.

## Verified foundation checkpoint — 2026-09-09

The domain/DTO7 foundation includes analytic arc length, points, tangents, projection, extrema,
area/centroid and ray containment; line/arc and arc/arc validity; persistence and observation
keys; curve-preserving point transforms; and curve-aware group bounds/enclosure. `projectOntoWall`
returns the closest point, clamped along-arc offset, fraction and distance for opening movement.

Production types and scoped ESLint/Oxlint passed. Thirteen targeted files cover 145 unique
cases. The first batch passed 115/116 and exposed an explicit-tuple equality helper omitting
curvature, so a curve-only command was treated as no-write. Adding Room/Wall curve fields fixed
the eight-case curve/group history rerun. The remaining 29 Zone, migration-registration and
combined hover compatibility cases passed. Mixed Zone → curve-only group command → Zone
Undo/Redo, schema7 round trips preserving group6/opening5 metadata, old-reader refusal and
curve-only peer observations are covered.

The combined baseline also needed duplicate SelectionInteractions imports removed and its
idle hover block extracted to meet the existing complexity budget. Those are separate mechanical
integration repairs, not changes to curve semantics.

This checkpoint is a dependency for Stair8 and opening movement. **Curve rendering, editor
task controls, full frontend metadata forwarding and combined browser/native acceptance remain
in progress.** No screenshot or usable-release claim is attached to this foundation alone.

## Editor checkpoint — 2026-09-09

The explicit **Edit curves** task is available for a selected Room or Wall. It separates numbered
bend handles from ordinary vertex and rotation handles; the edge arrow explains signed depth in
the screen coordinate system. Moving more than four screen pixels starts bending. A click only
chooses the edge, pointer interruption restores that bend's opening value, and Cancel discards
the complete draft. The native edge picker, depth and radius fields offer the same operation.
Untouched display text preserves the original bulge; retyping deliberately applies a new value.
Apply uses the whole-sidecar conditional geometry command and its exact inverse/Zone receipts.
An ordinary Room with no structure section is supported, and straightening removes its obsolete
curve map so the task can reopen without a false conflict.

Room fills and selection outlines, Wall paint and opening cuts follow the curved edges. Display
polylines are approximations only; length, area, centroid, hit projection, thin marquee crossings
and bounds use analytic geometry. Every Room edge label follows current curve previews and
rigid rotation; multiple selected Rooms accept the shared group-document preview. Numeric
rectangular scaling is unavailable for curved Rooms. Existing point editing retains edge maps,
while ambiguous changes to the number of corners are refused. Wall length editing scales the
chord with the original bend and heading; hosted openings use distance and local tangent along
the host. Room-to-Wall enclosure remains explicit, not a continuous synchronization relationship.

Types, scoped ESLint and scoped Oxlint 1.81 passed with the aligned repository dependencies.
Six targeted files cover 20 unique cases. The first run passed 19/20; its only failure demanded
exact equality between -1000 and -999.9999999999999 for an analytic midpoint. A tolerance-based
assertion and the full three-case projection rerun passed. All five new runtime cases passed:
native numeric preview/application and exact history, straighten/reopen, Room without walls and
no-op bytes, interrupted pointer/cancel invariance, curve-only peer retirement, and Wall/Review
admission. Two shadowed local variable names found by Oxlint were also corrected.

The independent Group UI merge must compose `curveTask.preview ?? groupActions.preview` for
ZoneLayer, RoomDimensionLabels and StructureLayer, preserving the group's full member geometry.
The curve task is composed in `createSpatialEditing` alongside the existing tool actions.
Broader scene/dimension/rotation regressions, actual EN/DE constrained rendered captures and
native-host acceptance remain pending. This checkpoint is implementation evidence, not final
visual acceptance of the expanded release.
