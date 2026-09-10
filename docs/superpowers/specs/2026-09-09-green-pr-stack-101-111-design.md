# Green the editor PR stack 101–111 — design

Date: 2026-09-09. Approved in chat.

## Situation

The draft stack `codex/editor-release-selection` (#94) → … → `codex/editor-deliver-curves`
(#111) → … → #117 is red from #101 upward. Every failure is a test contract lagging a
behaviour change, not a src defect, and #116 (`codex/editor-deliver-acceptance`, green)
already carries the test fixes plus ~40 boundary test files that restore the coverage floors.

| PR | Failure introduced here | Coverage |
|---|---|---|
| 101 | `tests/presentation/editor/structureLifecycle.test.ts` "traces a temporary loop…" (fixed in #112) | ok |
| 102 | `renovationRoutes.test.ts` "changes perspective and marker visibility…" | ok |
| 103 | `renovateRoomManipulation.test.ts` corner edit; `zoneEditing.test.ts` handles + deselection | ok |
| 104 | `zoneEditing.test.ts` "deletes from the Inspector…" | branches 97.99 < 98 |
| 105 | `shell/newRoomInspector.test.ts` ×2 (hint id) | red |
| 106–109 | none new | branches 97.93 → 97.87 |
| 110–111 | none new | branches, functions, statements all under floor |

## Decision

Option A: bottom-up walk, every PR individually green. 112–117 are left untouched (in
active use) and take a later pass; #116's duplicate hunks will conflict there and are
resolved then.

## Fix ownership

| PR | Lands here |
|---|---|
| 101 | `structureLifecycle` fix lifted from #112's version of the file, trimmed to 101's tree |
| 102 | `renovationRoutes` layer-toggle selector hunk (#116) |
| 103 | new `tests/helpers/zoneEditingHandles.ts` + `renovateRoomManipulation` + `zoneEditing` handle/deselection hunks (#116) |
| 104 | `zoneEditing` delete/floor-state hunk (#116) + coverage tests for 104's src |
| 105 | `newRoomInspector` hint-id hunks (#116) + coverage tests |
| 106–111 | coverage tests only |

Coverage attribution: for PR N, match the src files N added or changed against #116's new
test files by import. Backport a match if it passes on N's tree; otherwise trim it to the
cases N's tree supports. Floors are never lowered. An unreachable guard may be removed
(CLAUDE.md: it costs a branch it can never pay back) and must be named in the report.

## Execution

- Phase 1, parallel (max 4 concurrent): one preparer per PR 101–111, in
  `.worktrees/codex/<branch>` with `npm ci`, committing on a local `fix/<branch>` branch.
  Verified with `npm run check:fast -- <touched tests>` and one `npm run test:coverage` at
  the end. No pushes. Output: branch name + report in the scratchpad.
- Phase 2, serial, one integrator: for N = 101…111: rebase `codex/<branch>` onto the fixed
  branch below, cherry-pick `fix/<branch>`, run the full `npm run check` alone, push with
  `--force-with-lease`, wait for CI green, then the next N. A red stops the walk.
- Stale worktrees of merged PRs are removed first (six-worktree gate hazard).

## Done

All four `verify` legs green on #101–#111; no floor lowered; test/helper files only
(plus any named unreachable-guard removal); per-PR outcome table in the final summary.
