# Stair and direction-arrow implementation follow-up

PR: [#114](https://github.com/Luis85/renovation-planner/pull/114).
Branch: `codex/editor-deliver-stairs`. Date: 2026-09-09.

## Scope and base

The current PR #113 head `0edf572ccd8303b351f43a2695edd63e12d9e134` was merged
without conflicts as `00d707affcd43cb449c8b37804b6d190065f6f2e`. The dedicated
Stair worktree was clean before work began. Main and downstream branches are unchanged.
Verification used a temporary detached worktree containing that merged, pre-fix baseline.

The [approved Stair/Arrow contract](editor-stairs-arrows.md), original
[delivery reconstruction](stair-arrow-delivery.md), and [PR #117's remaining plan](https://github.com/Luis85/renovation-planner/pull/117)
were read. This follow-up covers Stair/Arrow implementation and necessary integration.
It does not complete the later editor quality, visual matrix, native acceptance or release steps.
PR #114 initially had no reviews or review threads. Its four failing CI verify jobs
stopped on conditional assertions in `groupPointerRotation.test.ts`; PR #113's update
already fixes those assertions without weakening them.

## Demonstrated gaps fixed

- Placement parameter editing now tracks which dimensions were explicitly touched.
  Changing only tread count or direction preserves the exact canvas centreline and width;
  the shared parser still applies explicitly entered decimal values literally.
- An unchanged movement returns before constructing a command, so it creates neither
  a file write nor a history entry.
- Stair and Arrow edit retries retain the command for the same submitted content.
  The command retains the revisions produced by its own successful compensation after
  a sidecar failure. Retry no longer conflicts with that compensation.
- Numeric element rotation retains the command for the same proposed points for the
  same reason. Undo restores the original geometry exactly, including after a retry.
- Same-revision external geometry changes use the shared write-boundary vocabulary.
  They now retire the edit form and refresh the projection while retaining draft text,
  just as revision conflicts do. Subsequent submissions cannot overwrite the peer.

These changes preserve the established editor and persistence model: two Stair
centreline points with width, 1–200 treads and up/down direction; derived run;
900 mm / 3000 mm / 12 / up defaults; open multi-point Arrows whose native head follows
the final segment; full Stair footprint selection/framing/group bounds; and schema 8
only when current or intended geometry requires it. Names remain Plan metadata.
No icon catalogue, schema, thresholds, timeouts, exclusions or assertions were weakened.

## Automated verification

Node v24.20.0 on Windows. The full command and targeted batches used
`VITEST_MAX_WORKERS=2`; the isolated build-test rerun used one worker. Configuration,
timeouts, assertions and exclusions are unchanged.

| Check | Result |
| --- | --- |
| Targeted implementation/integration | 130 distinct tests across 14 files passed, including 21 added cases. |
| Unchanged `npm run check` | Build/type checking and both linters passed. 8,676 tests passed, nine failed, 70 existing skips; 735 files. |
| Coverage | Statements 98.79%, branches 97.30%, functions 98.99%, lines 99.50%. The unchanged statement/branch/function floors remain unmet. |
| Detached baseline `00d707af` | All seven Room/Zone/Inspector failures reproduced: seven failed and 50 passed across four files. |
| Isolated build tests | All 44 tests passed with the original 5-second and 60-second case timeouts. Their two full-run failures were timeouts. |
| Unchanged `npm run analyze` | Fails on six existing dead-code findings, two existing clone groups and 15 existing complexity findings. No new finding from this follow-up. |
| `git diff --check` | Passed. |

The seven reproduced failures are in `renovateRoomManipulation.test.ts` (one),
`renovationRoutes.test.ts` (one), `zoneEditing.test.ts` (three), and
`shell/newRoomInspector.test.ts` (two). The isolated build files are
`network-boundary.test.ts` and `lint-edited.test.ts`. No failing assertion was weakened.

The updated PR #113 [receipt](evidence/group-ui-20260909/receipt.json) already records
the same unmet coverage floors (98.81% statements, 97.34% branches, 98.98% functions).
No separate full pre-fix coverage percentage or arithmetic coverage union is claimed here.
Dead-code and clone findings reproduce in the pre-fix worktree; all 15 complexity
findings concern byte-equivalent source text and static cyclomatic/cognitive limits.
The baseline's additional unresolved PDF-worker test import, caused by its use of
ancestor-installed dependencies, is retained in the comparison rather than hidden.

The [receipt](evidence/stairs-arrows-20260909/receipt.json),
[full check log](evidence/stairs-arrows-20260909/check.log),
[baseline failures](evidence/stairs-arrows-20260909/baseline-failures.log), and
[analysis comparison](evidence/stairs-arrows-20260909/analysis-comparison.json)
record exact results and source hashes. Raw diagnostic logs are archived alongside them.

The added regressions cover placement precision, no-op movement, compensated edit and
rotation retries, same-revision peer edits, failed refresh without replay, disposal,
Arrow numeric/middle-vertex editing and native head geometry, saved group transforms,
exact Undo/Redo/readback, schema 5/6/7/8 compatibility and the Zone SnapService contract.
The existing native icon registration/unregistration, full-footprint marquee and
framing, Stair rendering, curved boundaries, group and opening movement cases are retained.

No identified Stair/Arrow functional implementation gap remains. The existing global
test, coverage and static-quality failures remain open for the later quality work;
this PR is not claimed to pass the complete gate or finish the whole editor plan.

## Manual acceptance

User-owned and pending. No Obsidian/desktop control, browser walkthrough, screenshot
acceptance, vault access or manual-test confirmation was performed or requested.
This does not block completing this implementation step.

Optional checks for the user:

- Place a Stair and a multi-point Arrow from Add; try Shift, Cancel and Details.
- Edit Stair dimensions/direction and Arrow vertices; move and rotate both individually
  and in a saved group, then Undo/Redo and reload.
- Check Stair treads/footprint/direction and the native/custom icons in the preferred theme.

No PR merge, release publication or whole-editor completion is claimed.
