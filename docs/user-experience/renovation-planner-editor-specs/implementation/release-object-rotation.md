# Free spatial item rotation — implementation and verification

## Current contract

The user's 2026-09-08 scope amendment supersedes the initial Object-only increment. One selected Room, Area, Object, Path, Fence or Measurement can rotate independently. Wall rotation is a dependent work package: it carries hosted openings and connected junctions through a reviewed wall impact form; selecting an Opening routes to its host wall without replacing the selected ID. Group transforms, catalogue facing and reference-plan schemas are outside this change. The user's original Object → Opening → Wall → Room body priority remains authoritative; PR #93 is independently owned and is not modified here.

| Shape | Frozen pivot | Existing write path |
|---|---|---|
| Room / Area | Polygon area centroid | MoveSpatialObject and ReversibleMoveZoneCommand, including an explicit initial expected version |
| Object | Polygon area centroid | Conditional RenovationCommand / elementInput |
| Path / Fence | Length-weighted line centroid | Conditional RenovationCommand / elementInput |
| Measurement | Segment midpoint | Conditional RenovationCommand / elementInput |
| Wall / selected Opening's host | Wall midpoint | Dependent wall adapter and reviewed Structure command; owned by the wall work package |

Plan permits every supported current target. Renovate retains existing permission to edit current Rooms, Areas and walls; generic elements keep their existing Plan-only current-fact boundary. Review permits no rotation. Current geometry rotates independently of intended geometry; IDs, canonical names, other metadata, relationships and item order remain unchanged. No orientation field or schema version is added.

`runtime.rotationActions` owns the free-item rotation lifecycle: the selected target, busy/blocked state, cancellation generation, preview, handle geometry and numeric/pointer routing. `spatialEditing.ts` composes the existing element actions and these bindings; it creates no persistence service. The previous duplicate Object-specific `elementActions.rotate` implementation has been removed.

Positive degree values turn clockwise in the canvas's downward-positive world coordinates. Numeric Rotate by accepts signed decimal-point and decimal-comma degrees exactly; quarter-turn controls use ±90 degrees. Pointer Shift constrains the relative angle through the existing 15-degree snap service, including when Shift is held before grabbing the handle. Bearings unwrap across atan2's seam; every preview still transforms the immutable original points, never the previous preview. Exact cardinal coefficients are shared in Core.rotate so Rooms retain axis-aligned sizing after quarter turns and wall/free-item math agrees.

Pointer-up recalculates from its final position and commits through one existing history command. Invalid angles, zero/full turns, coincident geometry, cancellation, Escape, tool/perspective/selection changes, retired baselines and disposal produce no write/history. A geometry-identical refresh can continue the gesture; a peer geometry change cancels it before another preview. Numeric conflicts retain the entered angle and use read-only recovery; successful writes are never repeated to recover failed read-back.

## Shared handle and input behavior

The shared metrics are a 28px visible control, 44px grab target and preferred 40px diagonal offset from the upper-right extent. One placement helper returns the matched handle, attachment anchor and pivot for paint and hit testing. It clamps to 28px viewport side/bottom margins and 60px top clearance, tries alternative corners and edge positions, and reserves at least 34px around Room/Area/wall vertex handles. Existing measured native dimension rectangles are reused as obstacles; no new observer is added. A viewport with no clear target retains the numeric route.

The handle renders in the existing top Interaction layer through the same world transform; the seven-layer architecture remains unchanged. Source-layer visibility controls pointer-handle visibility while the selected record's numeric action remains usable. Ordinary Shift-click body/corner behavior remains selection toggling; selected IDs are retained under Shift only when the point actually hits the rotation target. Alt continues to bypass decorations. Fidelity owns the final arrow glyph, control layout and Inspector placement.

## Traceability

| Requirement / status | Source entry point | Owner and acceptance |
|---|---|---|
| Implemented, targeted verified: rigid geometry and pivots | src/presentation/editor/elements/objectRotation.ts; src/core/geometry/operations.ts | Rotation: arbitrary/cardinal angles, area/distance/pivot invariants and exact Room quarter-turn dimensions |
| Implemented, targeted verified: guarded commands and history | rotationActions.ts; rotationBaseline.ts; spatialEditing.ts; elementInput.ts | Rotation: immutable baseline, one command, no-op/cancel/disposal guards, peer conflicts, exact Undo/Redo, in-place item/metadata updates |
| Implemented, targeted verified: pointer lifecycle and targeting | ElementRotation.ts; tools/select-tool.ts; selection/resolveSelectionTarget.ts; handleMetrics.ts | Rotation: final pointer position, continuous angle feedback, Shift corner preservation, busy/source visibility, zoom/pan geometry, vertex/native-control clearance |
| Implemented, targeted verified: persisted reopen | tests/presentation/editor/objectRotationRuntime.test.ts | Rotation: all four generic kinds reconstruct index/repositories/runtime from persisted FakeVault bytes; Room/Area rotation reloads through fresh repositories; current/intended and metadata remain independent |
| Implemented, targeted verified: numeric entry/recovery | ObjectRotationForm.vue; rotationActions.ts | Rotation: decimal comma/point, invalid input, cancellation, late reads, successful-write/failed-readback without another write |
| Implemented helper; browser observation pending | tests/harness/editorRotationProbe.ts; scripts/editor-object-rotation-browser.mjs; scripts/editor-object-rotation-check.mjs | Rotation supplies read-only actual-renderer probes and native input journey; parent runs on final integrated source. Room screen-space previews are normalized through the actual renderer transform |
| Dependent implementation / integration pending here | structureActions.rotateWall / previewRotation | Wall work package: reviewed connected-wall impact, carried Opening fields, fresh persistence and wall-specific peer-preview regressions |
| Dependent visual acceptance pending here | ObjectRotationHandle.vue / ObjectRotationControls.vue and Inspector placements | Fidelity: arrow glyph, enlarged controls, signed angle display and constrained EN/DE layouts |

## Verified source and receipt

Production source: **42176cf2c2914421bf7eaffc17d3ca7e3bfc8c57**, on `codex/editor-release-rotation`, based on selection documentation tip `26723bee`. The tested pre-rebase source was `bbc4bd4e`; the rebase changed only its documentation ancestry. Git confirmed identical source and test trees before/after:

- src: `26ae80d02e43d3c7bd13542e5e6093ee3438982b`
- tests: `8ed8e1317024cf968d863224d775454f66a23db7`

On 2026-09-08:

- `node node_modules/vue-tsc/bin/vue-tsc.js -noEmit` passed.
- Scoped ESLint passed for all rotation-changed/new `.ts` and `.vue` files, with unchanged complexity and line limits. Repository configuration excludes these browser `.mjs` drivers from ESLint; global Oxlint includes them.
- Global `oxlint --deny-warnings` passed.
- `vitest run tests/core/geometry tests/presentation/editor/objectRotation.test.ts tests/presentation/editor/objectRotationRuntime.test.ts tests/presentation/editor/tools/selectTool.test.ts tests/application/commands/spatialElements.test.ts --maxWorkers=1 --no-file-parallelism` passed: **8 files, 172 tests**. Vitest elapsed 75.20s; test bodies 9.86s. This is a targeted development run, not a performance acceptance claim.

The unchanged `npm run check`, integrated wall/UX regression reruns, supplemental native-browser rotation journey, final nine original journeys and all eighteen reference comparisons remain parent-owned pending checks. Native Obsidian, physical-device and screen-reader acceptance are separate observations and are not established by FakeVault, jsdom, browser automation or axe.

## Historical checkpoints

The initial Object implementation was `43fd968b` (rebased as `9f44c959`); its partial checks do not establish the expanded scope. The first generalized engine checkpoint was `f056a1f2` (rebased as `643a0c00`), with full Oxlint/types and 41 targeted tests. Subsequent review established and corrected viewport-clamp/vertex overlap, Shift-corner selection, item-order preservation, peer-preview retirement, cardinal Room sizing and existing lint-budget issues. The 172-test receipt above supersedes those partial verification counts.

### CI scene regression follow-up (test-only)

The full CI suite exposed five stale assertions that counted every interaction-layer Circle/Line as a legacy selection affordance. The corrected suites still require exactly four direct screen-space vertex handles and one named selection outline, assert the nested rotation group separately, and require its removal on deselection/Review. The idle scene now explicitly reserves four empty groups. No production code or verification threshold changed; the source tree remains `26ae80d02e43d3c7bd13542e5e6093ee3438982b`.

`npm run check:fast -- tests/presentation/editor/renovateRoomManipulation.test.ts tests/presentation/editor/scene.test.ts tests/presentation/editor/zoneEditing.test.ts tests/presentation/editor/objectRotation.test.ts tests/presentation/editor/objectRotationRuntime.test.ts --maxWorkers=1 --no-file-parallelism` passed global Oxlint, type checking and **5 files / 89 tests** on 2026-09-08. Full-suite coverage and the unchanged integrated gate remain parent-owned verification; this follow-up does not claim they have passed.

### CI admission and retirement follow-up (test-only)

CI run `34259386627` passed 672 files / 8,225 tests at `c6577dc1`, but its branch
coverage was 12,894 / 13,165 (97.9415%), below the unchanged 98% floor.
`rotationAdmission.test.ts` adds twelve behavioral cases: Room read error, absence and
cross-plan ownership; peer name/geometry changes; unexpected read-fault cleanup; element
read/peer metadata failures; retired/no-op pointer proposals; refreshed peer geometry;
a retired numeric callback; and refusal by the real stale gate at dispatch. Assertions
check no unintended command/repository writes, retained peer facts and operation cleanup.

The three rotation/admission suites passed 67 tests, both normally and under targeted
coverage. Whole Oxlint, TypeScript and scoped test ESLint passed. Targeted coverage of
`rotationBaseline.ts` and `rotationActions.ts` reports 138 / 161 branches (85.71%) and
correctly exits nonzero against the unchanged global thresholds: that diagnostic covers
two source files, not the full repository. No thresholds or exclusions were modified.

Comparing identical branch maps with the CI artifact shows fourteen previously missed
branches exercised. Their arithmetic union with that recorded CI baseline would be
12,908 / 13,165 (98.0479%). This is a projection, not a fresh full-suite coverage result;
CI on the pushed follow-up remains the global acceptance gate. The local comparison
receipt is `harness-shots/pr95-admission-coverage/ci-branch-comparison.json`.
