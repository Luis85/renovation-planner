---
type: Issue
parent: "[[Release hardening]]"
order: 100
status: New
started: ""
finished: ""
horizon: "MVP"
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
strategic-alignment: ""
customer-value: ""
business-impact: ""
reach: ""
risk-reduction: ""
compliance: ""
time-criticality: ""
enablement: ""
confidence: ""
effort: ""
complexity: ""
business-value: ""
business-value-model: ""
---

# Fourteen stack pull requests merged without their own green CI

The Plan Editor stack merged on evidence about its top, not about each pull request. Fourteen of
its twenty-one pull requests never had a green CI run of their own. That limitation is accepted and
recorded here, and what is left of the stack's branches has no decided fate.

## What is true today

Measured on 2026-09-10.

**Per-pull-request CI.** GitHub's check rollup at each pull request's final head reads 4 failing
and 2 passing checks for every one of #102 to #115. #94 to #96, #100, #101, #116 and #117 read all
checks passing. #97 to #99 were separate pull requests and not part of the stack.

**What stood in for per-pull-request green.** The integration head `22772267` passed the full
`npm run check` locally, CI's four `verify` legs in run 34445960897, and the full visual matrix.
`17097b8a` added the refreshed matrix evidence, with green CI in run 34447537221, and `main` at the
merge commit `5dcc1f20` is green in run 34449275294. Once the top was green, the integration's own
ruling demoted per-pull-request greening to a secondary objective, because #115 consolidates the
components the per-pull-request refactors were splitting.

**History is preserved.** #119 landed as a merge commit, so every stack pull request's commits are
reachable from `main`, the failing final heads of #102 to #115 among them. A `git bisect` over
`main`'s full history can stop on reds unrelated to the defect it is hunting;
`git bisect start --first-parent` walks only `main`'s own line and steps over them.

**Review threads.** Each of the 21 stack pull requests has zero review threads, read through
GitHub's GraphQL API, so nothing there is left to resolve.

**Branches.** The 21 stack head branches and `integrate/editor-stack` are gone from `origin`: the
repository deletes a head branch on merge. What remains:

| Where | Branch | Against `main` |
| --- | --- | --- |
| `origin` | `fix/editor-visual-acceptance` (`f73cbb76`) | fully merged |
| `origin` | `codex/editor-evidence-15e4b0d7` | 201 commits not on `main` |
| `origin` | `codex/editor-evidence-fidelity-initial` | 4 commits not on `main` |
| `origin` | `codex/editor-evidence-rotation-initial` | 6 commits not on `main` |
| `origin` | `codex/editor-release-verification` | 16 commits not on `main` |
| local only, now deleted | ten `fix/editor-deliver-*` branches: creation, curves, group-storage, input, openings, photos, reference, room-edges, rotation-ui and shell | every commit classified and what `main` lacked ported to `test/salvage-editor-deliver`; see "Salvage of the ten local branches" |
| local only | `fix/editor-deliver-details` (`e4195dfd`) | on `main`, recorded content-free by `a92cdd7c` |

Each `fix/editor-deliver-*` branch is checked out in its own worktree under `.worktrees/codex/`,
beside `editor-integration` (`integrate/editor-stack`) and `editor-top`
(`fix/editor-visual-acceptance`), whose `harness-shots/` still holds the scratch capture directories
`probe-costs` and `probe-costs2`. The three `codex/editor-evidence-*` branches and
`codex/editor-release-verification` were never stack heads; the integration ledger recorded them
only as left where they were. **Whether any unmerged branch carries a change `main` lacks**, rather
than a version of one #115 superseded, is established for the ten local branches below and not
for the four `codex/editor-*` branches on `origin`.

**The ten local branches were never pushed under their own names, but each tracks a stack head.**
`fix/editor-deliver-<name>` tracks `codex/editor-deliver-<name>`, the head branch of one of #102 to
#111, deleted from `origin` on merge and an ancestor of `main`. Every one is ahead of that head:
shell by 10 (and behind by 5), input by 3 (behind by 1), creation by 2, curves, group-storage and
openings by 1 (each behind by 1), and photos, reference, room-edges and rotation-ui by 1. GitHub
answers "No commit found" for all ten tips, so those commits exist only in this repository. For
those ten, the open question above is exactly the commits each holds beyond its head.
`fix/editor-deliver-details` is level with its head, #101's.

## Salvage of the ten local branches

Done on 2026-09-10 against `origin/main` at `ada324f9`. The ten branches held 19 commits. Each was
classified by content, never by message: 8 already on `main`, 1 superseded, 9 still valuable in
part, and 1 harmful.

- **Already on `main`.** `git cherry` marks five of `shell`'s
  commits as patch-identical to `main`. The sixth, `c5020fce`, has its one hunk in `main` through
  `138c6a59`. `rotation-ui`'s helper and both of its call sites are byte-identical on `main`.
  `creation`'s `8d696306` drives the same Finish arm as a case `main` already has.
- **Superseded.** `shell`'s `0cb9e3db` split `LayerList.vue` and `PersistentWarningStrip.vue` for
  template complexity. `main` solved that differently: it split the row into `LayerRow.vue` and
  lifted the strip's row conditions into functions, and `npm run analyze` passes on it.
- **Still valuable.** A baseline `npm run test:coverage` on `main` left 312 branches, 174
  statements and 55 functions uncovered. Every candidate test case was then run alone under
  coverage. 29 cases reached at least one of those arms and were ported; the rest reached nothing
  new, duplicated a kept case, or were already on `main`. Five unreachable-guard removals were
  re-proven against `main`'s code, and their proof comments were rewritten.
- **Harmful.** `input`'s `ElementTool` guard removal was dropped, together with `d7f31099`, which only
  reworded its comment. That guard is reachable through the class's public constructor: a
  `blocked()` whose answer changes between the two reads in one press reaches it. The case proving
  that is one of the 29 ported cases.

The pull request from `test/salvage-editor-deliver` carries the per-commit table and the arm-level
evidence. The ten branches and their `.worktrees/codex/` worktrees were deleted after it was
opened. `shell`'s worktree also held an untracked `fix.patch`. That file is `c5020fce`'s own hunk,
and it already reverse-applies to `main`.

## The question still open

What happens to the four `codex/editor-*` branches and `fix/editor-visual-acceptance` on `origin`.
Deleting a branch discards whatever only it holds, so the decision is the product owner's. This
note records the question and does not take it.

## Alternatives

- **Delete the merged remote branch now.** `fix/editor-visual-acceptance` is fully contained in
  `main`, so deleting it loses nothing. Not taken here, because branch deletion is the product
  owner's call.
- **Keep everything as it is.** It costs nothing today. The cost comes later: unmerged branches and
  idle worktrees read as live work, which is how four abandoned worktrees accumulated before
  anyone looked, as `CLAUDE.md` records.
- **Diff each unmerged branch against `main` and land what `main` lacks as new pull requests.** It
  recovers anything real, at the cost of review for work #115's consolidation may already have made
  moot.
- **Tag each branch head before deleting it.** It keeps every SHA the integration record cites
  resolvable, with no branch list to maintain.
- **Rejected: green each pull request's CI after the fact.** The pull requests are merged. A green
  run on a closed branch changes nothing on `main`, and the commits a bisect meets are already in
  history.
- **Rejected at integration: merge the stack bottom-up.** That walks `main` through red states. The
  integration gave a second reason too — that #116 and #117 could not be merged at all — and that
  one rested on a misreading, recorded in
  [[A shallow clone made a stack head read as parentless]]. The first reason stands on its own.

## References

- [[Release hardening]]
- [[Produce auditable release evidence]]
- [[A shallow clone made a stack head read as parentless]]
- Pull request #119, and CI runs 34445960897, 34447537221 and 34449275294.
