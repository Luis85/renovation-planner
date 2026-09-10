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
| local only | ten `fix/editor-deliver-*` branches: creation, curves, group-storage, input, openings, photos, reference, room-edges, rotation-ui and shell | not on `main`, never pushed |
| local only | `fix/editor-deliver-details` (`e4195dfd`) | on `main`, recorded content-free by `a92cdd7c` |

Each `fix/editor-deliver-*` branch is checked out in its own worktree under `.worktrees/codex/`,
beside `editor-integration` (`integrate/editor-stack`) and `editor-top`
(`fix/editor-visual-acceptance`), whose `harness-shots/` still holds the scratch capture directories
`probe-costs` and `probe-costs2`. The three `codex/editor-evidence-*` branches and
`codex/editor-release-verification` were never stack heads; the integration ledger recorded them
only as left where they were. **Whether any unmerged branch carries a change `main` lacks**, rather
than a version of one #115 superseded, is not established.

## The question still open

What happens to the branches and worktrees above. Deleting a branch discards whatever only it
holds, so the decision is the product owner's. This note records the question and does not take
it.

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
