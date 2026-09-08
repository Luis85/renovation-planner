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
