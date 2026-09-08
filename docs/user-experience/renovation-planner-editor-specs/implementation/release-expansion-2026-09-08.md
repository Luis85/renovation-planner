# User-directed editor continuation — 2026-09-08

This extends the release task and its active completion goal. It does not replace the
original M00–M17 verification, nine final journeys, 18 reference comparisons, unchanged
repository gate, or applicable isolated Obsidian acceptance. Main stays clean; concern
branches remain reviewable and no GitHub merge is authorized.

## Confirmed interaction and capability additions

- Left-drag box selection in Select; saved groups survive reopening. Selection continues
  to hold actual member IDs. Group move/rotation uses one frozen geometry baseline and
  one guarded history entry; walls carry hosted openings. Normal member selection expands
  its group; explicit deep selection can inspect an individual member.
- Enclose a Room with walls explicitly and group the Room/walls automatically. This is a
  user-invoked action, not an implicit rewrite of every independent Room/wall relationship.
- A visible Pan tool makes ordinary left-drag pan; Select left-drag selects a box.
- Type-aware right-click and keyboard context menus expose existing commands and real
  Group/Ungroup/Enclose actions. Ctrl+Z/Ctrl+Y work in the editor outside text editing.
- Shift line constraints must reuse the existing zone-drawing behavior exactly. The
  earlier proposed independent 45-degree policy is withdrawn; the zone snap service is
  authoritative for angle increments, snap interaction and modifier transitions.
- Every Room edge has a length during selection, rotation, point editing and free-form
  drawing. Free-form creation must be discoverable. Editable circular-arc Room edges
  must account for arc length and area; renderer tessellation is not a measurement source.
- The user rejected the permanent labelled rotation control. Small curved-arrow handles
  appear at clear edges on hover, with generous invisible targets. Hover does not select;
  explicit arrow press may select an unselected item, then freezes its target/pivot. A
  selected group member must not silently collapse group selection. Numeric rotation stays.
- Door/Window clicks position the opening at the pointer along its host, with valid extent
  preview. Hinge, swing side and angle are editable and persisted; native leaves, arcs,
  window frames and wall cuts should reproduce M01's plan detail without relying on raster.
- Add Stairs and Direction arrow tools. Stairs expose width/run/tread count/direction;
  arrows are separate editable/rotatable/groupable geometry. Keep every previous Add route.
- Placement fields belong in the Inspector with a compact taskbar, not a central form
  obstructing placement. Constrained canvas-first activation must remain possible.
- Review must not shift the perspective bar when editing controls disappear.
- Add photo must be a minimal image/import flow with optional caption and progressive
  metadata. Replace the full-vault dropdown with bounded image search; opening the form
  must not materialize thousands of options.
- Reference scale setup needs a large image viewport with pan/zoom/Fit and calibration
  points anchored to original image pixels.

## Ownership and model coordination

Opening schema5 foundation is verified at ae1d1c30. Its optional swing contract is
`{hinge: start|end, side: left|right, angle: 0..180}`, relative to directed host start/end.
Legacy absence stays absent; Door defaults visually to90°, Window toclosed0°; plain
Opening has no leaf. Reserve sidecar6 for saved groups,7 for curve geometry,8 for new
Stair/Arrow kinds. Later concerns incorporate earlier versions so no writer strips
fields introduced by a preceding feature. Preserve minimum-needed version writing and
older-reader refusal tests.

Root owns group model/geometry/persistence/guarded transforms and assembly. The input
agent owns marquee, Pan, shortcuts, shared zone constraint reuse and contextual menus.
The measurement/rotation agent owns all-edge display, free-form discovery, edge hover
controls and curve proposal. The opening agent owns pointer placement/swing symbols,
then photo/reference modal improvements. New actions must reuse leaf-owned command,
recovery and focus boundaries; no dead menus or duplicate storage authority.

## Current evidence boundary

The repaired M00 continuation passed its visibility assertion at source736ca7c1.
That smoke stopped later because the old helper tried to Tab an inactive radio; it has
been adapted to native radio keys. The captured M04 image exposed caption clipping and
Select/Add/taskbar overlap, corrected in creation follow-up81804792, still awaiting fresh
combined images. The user-driven hover presentation supersedes source5853827's labelled
handle; that source is a verified interaction predecessor, not the accepted final UI.

PR95 current CI passes672 files/8225 tests but fails the unchanged98% branch threshold
at97.94%. The coverage artifact is retained for meaningful missing-boundary tests. PR96
CI lint defects were fixed/pushed in422953af with whole lint/types/26 wall tests passing.
No expanded release completion or full native/device/screen-reader acceptance is claimed.
