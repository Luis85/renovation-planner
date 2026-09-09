# PR #112: Move an opening along its existing host

Date: 2026-09-09. Scope is Door, Window and plain Opening movement along the current
host only. Manual acceptance is **user-owned and pending** and does not block this
implementation step. No desktop/Obsidian control, browser walkthrough, screenshots,
vault access, merge or release forms part of this follow-up.

## Source and plan

- PR: <https://github.com/Luis85/renovation-planner/pull/112>.
- Branch: `codex/editor-deliver-opening-move`; reused its clean dedicated worktree at
  `D:/Projects/renovation-planner/.worktrees/editor-deliver-opening-move`.
- Published starting head: `2b81464635aad433b3e08cbebe5cff9c990d6b5a`.
- Updated #111: `379f6a8aef24b1222d62624a5876672893fc84a2`, incorporated by merge
  `e7b39035b7fe51a038177f3f226737dd5c6104a1` without conflicts or rewritten history.
- Implementation and tests: `6f795b01bf86963cf02fe00b3e1d328bbe2520bd`.
- Main remains clean and on `main`; no downstream branch was updated.
- Read the [remaining plan in #117](https://github.com/Luis85/renovation-planner/blob/5c15006c38d01b530641ac6da1ed154ab52227c6/docs/user-experience/renovation-planner-editor-specs/implementation/remaining-plan.md),
  [opening requirements](../../../requirements/Add%20and%20safely%20edit%20a%20wall%20opening.md),
  [opening journey](../../user-journeys/insert-wall-opening.md),
  [M07](../screens/M07-wall-selected.md), [opening specification/delivery](opening-usability.md),
  [reconstruction](delivery/opening-move.md) and [updated curve delivery](curve-delivery.md).
  No repository `AGENTS.md` or `.codex/` exists at these checked heads; session instructions apply.

## Demonstrated gaps and changes

Four new cases failed on the merged, pre-fix source: three straight/positive-curved/
negative-curved host cases could not obtain a preview outside the wall hit band, and
one initial-read case lost the latest hover. Fourteen other new boundary cases passed.

Move now uses the existing analytic `openingOffsetAt` contract without imposing a
pointer hit band. Its preview and click remain on the captured host, with offset clamped
to `[0, wallLength - width]`; the full opening stays contained even when the pointer
passes an endpoint or lies near another wall. Overlapping openings still refuse placement.
The English and German tool instructions describe pointer positioning and click placement.

Pending input now retains the latest hover until the first click. That click freezes a
copy of its coordinates and wins over later clicks or hovers. Read completion processes
it once. Existing generation/selection/context guards and cancellation clear it; stop
and cancel continue to avoid calling ToolManager recursively.

The command, shared ledger, history, serialization, curve geometry and curve editing
adapters are unchanged. The preview copies the captured opening and changes only its
offset. ID, host, kind, dimensions, sill and swing/legacy field absence remain exact.
Once a guarded command has begun writing, its existing save lock lets that one operation
settle; Escape is not a rollback of an already-started write. Disposal retires the leaf
while allowing an actual completed write to remain saved.

Two old fixtures were adapted to the explicitly requested projection behavior: the
overlap test now exercises invalid projections both on and away from the host; the
held-press/tool-switch test uses an overlapping opening to keep the proposal invalid.
No assertion, timeout, threshold or exclusion was removed or weakened.

## Automated evidence

Windows, Node **24.20.0**, dependencies installed with `npm ci --no-audit --no-fund`.
Only worker parallelism was limited (`VITEST_MAX_WORKERS=2`).

- **Build/type-check, Oxlint and ESLint passed** in the unchanged `npm run check`.
- **116 targeted tests passed across 16 files**, including all 43 Move cases and the
  opening/curve geometry, presentation, persistence, recovery and lifecycle suites.
- **Full check remains red:** 8,570 passed, seven failed and 70 unchanged skips across
  721 files (717 passed, four failed).
- Coverage: **98.84% statements, 97.49% branches, 98.94% functions, 99.49% lines**.
  The first three miss unchanged floors (99/98/99); lines pass their 99% floor.
- Every failing case matches both published #112 CI and the updated #111 receipt:
  three `zoneEditing` cases (vertex editing, Inspector delete, selection handles),
  one `renovationRoutes` marker-visibility case, two `newRoomInspector` hint cases,
  and one `renovateRoomManipulation` corner-editing case. None is an opening-move or
  curve failure. This follow-up changes none of those four test files.
- The former published reference-viewport failure is absent after incorporating #111;
  the #111 lifecycle selector failure is absent with the already-existing #112 selector fix.
- Because the combined check stops at tests/coverage, Fallow is run separately.
  **Fallow remains red:** six dead-code/type issues, one existing command-guard clone
  and fourteen complexity findings. Every current finding also occurs when reverting
  just the four changed production files to the merged pre-fix source with final tests
  and coverage held constant. That diagnostic reports two additional CRAP findings on
  the reverted Move file, whose locations no longer match the final coverage exactly;
  those two are not claimed as a measured improvement or a baseline coverage result.
  The tested source was restored byte-for-byte and coverage was unchanged afterward.

Logs, failure-name comparisons and checked-source hashes are retained in
[the evidence receipt](evidence/opening-move-20260909/receipt.json).

The new tests cover both endpoint clamps and interior projection on straight and both
curve directions, one command/write and exact Undo/Redo/fresh-store documents, legacy
Doors/Windows/Openings, queued hover and first-click priority, all four cancellation
routes, concurrent host/swing changes and a peer arriving at the write boundary, failed
writes, saved writes with failed refresh and three read-only retries, and actual saved
write completion after disposal. Existing Inspector/context-menu/focus and curve tests
remain part of the relevant checks. Group metadata and intended geometry are included
only as preservation assertions; no group UI or rehosting is added.

Initial remote inspection found no reviews, inline threads or conversation comments.
The published CI run `34326614187` already failed eight tests in five files and the
statement/function/branch floors on all four verification jobs; audit and GitGuardian passed.
The #111 receipt separately records eight test failures and the same coverage floors.
Neither #117's historical cumulative pass nor #111's targeted pass is a pass for this head.

## Remaining acceptance

Optional user checklist: invoke Move from Inspector and context menu; move each opening
kind on a straight and curved wall, including near both ends; cancel before placing;
place once, Undo/Redo, reopen and check the saved position and properties.

Manual acceptance and the complete editor plan remain open. This note does not mark
M00–M17, the nine visual journeys, the eighteen comparisons or native acceptance complete.
No further functional implementation gap was demonstrated within this Move scope;
the full automated quality gate remains red as described above.
