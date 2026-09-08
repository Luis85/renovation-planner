# Release Object rotation

Evidence baseline: main 7d4bc381, inspected 2026-09-08. Owner: rotation work package.
Dependency: shared resolver body-order correction is owned by selection work package; parent owns integrated verification and documentation reconciliation. PR #93 files are untouched.

## Interaction contract

One selected free Object in the Plan perspective supports rotation. Rooms/Areas, walls, hosted openings, reference plans, Asset catalogue facing, linear elements and groups do not. Planned/intended geometry remains an independent fact: this edits the current Object points only, preserving intended geometry, IDs, names and relationships under ADR-0023.

The polygon area centroid is frozen when the draft starts. Positive degrees rotate clockwise in the canvas world coordinate system (y points down). Pointer rotation is the change in bearing from pointer-down around that pivot; Shift constrains the relative angle through the existing SnapService 15-degree policy. Shift may be held before grabbing the handle. Numeric Rotate by accepts signed degrees with decimal point or decimal comma and preserves the exact requested angle without vertex snapping. Quarter-turn actions use ±90 degrees.

Each preview is calculated from immutable original points. Pointer-up recalculates from its final location and dispatches once via the existing guarded element action, RenovationCommand, write ledger and history. Zero/full-turn or coincident results produce no writes/history. Escape, cancellation, tool switching and disposal discard previews. Invalid/degenerate/unrepresentable shapes and invalid numbers are refused. No orientation schema is introduced.

The visible rotation handle is above the selected object's bounds by a fixed screen-pixel offset. Rendering and shared hover/click hit testing use the same geometry helper and camera scale; Alt overlap cycling bypasses it. A connector stem and live relative-degree label identify the handle. Pointer targeting and paint both honor the root action busy/save gate. A Rotate by dialog and ±90-degree actions in the Inspector and direct canvas actions remain keyboard accessible after list selection and preserve draft/recovery behavior.

## Actionable traceability

| Requirement | Baseline finding / source | Action and acceptance |
|---|---|---|
| Rigid rotation | Core operations.rotate and centroid implemented; Object rotation missing | Add shared proposal helper; verify distances, area, centroid, arbitrary angles, quarter turns and immutable preview |
| Pointer lifecycle | ElementMove and SelectTool guarded translation exists | Add rotation gesture using existing preview/commit callback; final pointer, no-op, cancellation, blocked and zoom handle tests |
| Numeric/quarter turn | elementActions edit/move exists; rotation missing | Add locale-aware form and accessible actions, one command path, conflict/readback recovery checks |
| Persistence/history | world-point sidecar and RenovationCommand exist | Exercise actual persisted geometry with reconstructed repository/index/runtime, exact Undo/Redo and independent intended preservation |
| Visual fidelity | shared StructureLayer and DirectActionPopover | Draw handle and compact translated actions; parent inspects final stable screenshots |

## Verification record

Initial targeted run passed 12 geometry/gesture cases and 6 runtime cases (numeric preview/commit, locale input, invalid/cancel, conflict, readback recovery, reconstructed runtime and pointer history). Two authored camera-switch tests used an unregistered Pan tool ID; corrected to the existing null camera mode. Subsequent busy, perspective, Escape and exact painted-handle cases await the final targeted run. Scoped Vue ESLint passed. Supplemental scripts/editor-object-rotation-check.mjs covers four browser theme/locale scenarios independently of the original nine journeys. Parent serializes unchanged full gate and final visual evidence after commits. Browser tests do not establish native Obsidian/device/screen-reader acceptance.
