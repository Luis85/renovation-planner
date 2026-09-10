# Wall rotation and hosted openings

Owner: wall rotation subagent, `codex/editor-release-wall-rotation`, initial evidence
`43fd968bf2aedd3e7b1c9dfa1ae57d470fff1880` (2026-09-08). User expanded the release scope to
every free spatial item and explicitly chose wall rotation with hosted openings. PR #94's
selection work is complete and unchanged. Parent owns integration, user guidance and final gates;
the free-item rotation branch owns shared controls, pointer handling and the runtime facade.

Source authority: user clarification; SDD §§20, 29–31; ADR-0020; M07/M08 host editing and
reviewed impact. Baseline status: **missing** wall/host rotation; hosted opening persistence,
connected junction editing, independent Room outlines and StructureCommand history are
implemented foundations. This extension does not introduce detached opening geometry.

## Contract and acceptance

- One wall at a time, pivot fixed at its initial midpoint. Positive degrees rotate clockwise
  in the existing downward-y world coordinates. A selected Door/Window/Opening resolves its
  host wall; selection keeps the opening ID and the dialog names the wall being rotated.
- Both selected-wall endpoints rotate from immutable baseline coordinates. Every exactly
  coincident endpoint on a connected neighboring wall follows the matching junction. Other
  neighbor endpoints remain fixed. Openings retain ID, kind, host ID, offset, width, height
  and sill; their drawn world locations follow their host. No independent opening rotation.
- Review shows affected walls, hosted openings and associated Rooms before Apply. Room
  polygons and provenance associations remain unchanged. Invalid intersections, collapsed
  walls and openings that no longer fit any affected host are refused without repair.
- Numeric entry accepts signed decimal point/comma degrees. Pointer snapping belongs to the
  shared rotation facade; wall geometry receives the final angle and never snaps vertices
  independently. Full-turn/no-op drafts create no history. Cancel/Escape discard previews.
- Plan and Renovate use the existing wall edit permissions; Review refuses writes. The root
  modal preserves focus/busy behavior. Fresh versioned baseline and original-pointer-wall
  checks refuse peer changes; retired tool/selection/perspective drafts cannot write.
- Apply dispatches the existing StructureCommand once after impact review. Undo/Redo restore
  exact endpoints, IDs and hosted facts. Successful writes followed by failed readback remain
  successful and refresh never replays them. Fresh repository/runtime reload verifies bytes.

Integration API: `structureActions.rotateWall(id, degrees?, originalWall?)` opens reviewed
editing; `previewRotation(id|null, degrees?, originalWall?)` updates transient structure preview.
The shared facade supplies an immutable original Wall for pointer operations. Parent adds
`wall: structureActions` to facade composition once both dependency branches are integrated.

Implementation sequence: add pure midpoint/junction rotation and focused invariant cases; add
reviewed form and guarded structureActions adapter; add runtime/history/persistence regressions;
run only granted targeted checks, then report exact evidence. No new schema or repository.

## Implemented checkpoint and verification

`rotateWallStructure` uses the existing core rotation and structure validator; supported rotations
preserve hosted fields, junction coincidence and unrelated points. `WallRotationForm` and the
structureActions adapter implement reviewed Apply, original-wall and epoch retirement checks,
busy controls, conflict retention and read-only recovery. `rotationHostId` exposes the host for
the parent's visual highlight without changing the selected Opening ID. EN/DE wall-specific
titles and explanations distinguish this operation from free geometry rotation.

On the worktree based on `43fd968b`, `npx vitest run tests/domain/spatial/rotateWall.test.ts
tests/presentation/editor/wallRotationRuntime.test.ts --maxWorkers=1` passed **21 tests in
2 files** (117.77 s). Evidence covers arbitrary/quarter rotations and midpoint/length invariants;
both neighbor junctions; full-width openings; invalid intersections, shortened adjacent hosts,
coordinate limits and no-ops; host-selected identity, impact review, exact Undo/Redo, unchanged
Room polygons and intended geometry; pending-save duplicate/Cancel refusal; peer conflicts and
retired reads; fresh plan/zone repositories, index and editor runtime; two failed read-only
refresh retries after confirmed write and subsequent recovery without replay.

Scoped oxlint over all eight changed/new source, locale and test files passed. The attempted
`check:fast` stopped before TypeScript/tests on inherited rotation-checkpoint lint errors in
DirectActionPopover and objectRotation.test.ts; those are owned and already being corrected by
the free-item rotation branch. Two test lint issues in this package were corrected before the
passing scoped lint. TypeScript, unchanged full gate, merged facade/render integration, final
screenshots and native-host observations remain parent-owned pending the stacked integration.
These tests are automated repository/runtime evidence, not native Obsidian acceptance.

## Shared facade integration

Rebased onto tested generalized rotation checkpoint `f056a1f204859c08c6b83e767c1db85c56a91e32`;
the wall checkpoint is now `eb2bb65ccb4089819140c4ce1b274a7a0649a209`. The reserved runtime
composition now supplies `wall: structureActions`. Three additional adapter cases drive Wall and
Opening pointer handles through the real ToolManager/facade, release at a different final angle
than the previous move, require impact review before writing, retain the selected ID and reverse
the single write. Numeric Opening routing and generation retirement use that same facade.

`npm run check:fast -- tests/domain/spatial/rotateWall.test.ts
tests/presentation/editor/wallRotationRuntime.test.ts --maxWorkers=1` passed whole-tree oxlint,
TypeScript and **24 tests in 2 files** (123.41 s). The inherited checkpoint lint stop is therefore
resolved by the generalized dependency. Shared visual controls/host highlight, final unchanged
full gate and browser/native acceptance remain integration-owned.

## Peer-preview follow-up staged for integrated verification

The wall branch now depends on engine checkpoint `42176cf2c2914421bf7eaffc17d3ca7e3bfc8c57`.
Its existing composition is retained through `createSpatialEditing`, with the same
`wall: structureActions` adapter. A pair of wall-specific regressions requires a peer-moved host
to cancel the next pointer preview, while a geometry-identical refresh must keep the draft and
allow a reviewed commit. This detects reusing the refreshed host's midpoint inside a gesture
whose original midpoint was frozen. The engine's matching geometry guard was verified separately;
this pair awaits the coordinated wall/UI run on the integrated source. No old-revision failing
test run is claimed: that extra cold run was explicitly omitted by the coordinating parent.
The Unreleased changelog now records wall/host rotation in the PR that implements it.

## PR #96 CI follow-up

CI run `34259393431`, Ubuntu job `102173247095`, found a Vue name collision between
the initial `degrees` prop and the parsed computed value, an over-complex `rotateWall`
function, and a detached `openPlanNote` callback. The follow-up retains published history.

The form now names its parsed value `parsedDegrees`. Rotation admission, captured-operation
retirement and baseline matching are separate predicates, preserving the original active,
selection, tool, perspective, document and pointer-baseline checks. Preview and dispatch
share the captured-operation guard. Source-note recovery calls its owning context directly.
Impact review, guarded dispatch, readback recovery and exact history behavior are unchanged.

Verification on the existing PR branch passed:

- `npm run lint` (whole-tree Oxlint and ESLint, zero warnings).
- `vue-tsc --noEmit`.
- `vitest run tests/domain/spatial/rotateWall.test.ts tests/presentation/editor/wallRotationRuntime.test.ts --maxWorkers 1`: **26/26 tests**, two files, 85.41 s.
- `git diff --check`.

The cases preserve reviewed impact, pending-save input/Cancel refusal, stale pointer baselines,
peer changes, exact Undo/Redo, fresh repository/runtime reload and readback recovery without
replaying successful writes. No lint thresholds or exclusions changed. Full integrated
coverage, screenshot and native-host acceptance remain the coordinating parent's work.
