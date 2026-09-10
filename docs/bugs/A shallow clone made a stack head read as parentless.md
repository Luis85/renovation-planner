---
type: Bug
order: 10
status: Done
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

# A shallow clone made a stack head read as parentless

The Plan Editor stack's integration recorded the head of #116, `dc1bb351`, as a parentless squash
whose lineage shared no history with `main`, and chose its merge route with that in mind. The
commit has a parent and shares `main`'s fork. What was measured was the edge of a shallow clone.

## What happened

**The claim.** Before merging the stack, the integration session measured `dc1bb351` at ancestry
depth 1 and saw `git merge-tree` refuse #116, #117 and `fix/editor-visual-acceptance` as unrelated
histories. The claim reached three records: the integration's working ledger, the description of
pull request #119, and the message of `a92cdd7c`, the content-free merge now on `main`, which calls
them "a parentless lineage". The follow-up draft written the same day repeated it: no merge base
with `origin/main`, and #115's head not an ancestor.

**What GitHub answers**, measured on 2026-09-10 with no local history involved:

- `gh api repos/Luis85/renovation-planner/commits/dc1bb351` lists one parent, `689cf45b`.
- Comparing the pre-merge `main`, `db8e445b`, with `dc1bb351` answers `diverged`, with merge base
  `ec342370` — the fork the integration itself measured for #94 to #115.

**Why the local answer differed.** `C:\Projects\renovation-planner` is a shallow repository:
`git rev-parse --is-shallow-repository` answers `true`, and `.git/shallow` holds exactly one line,
`dc1bb3515dde752a14bd109e18b7d00a0430f623`, last written on 2026-09-09 at 18:42. Git treats a
commit listed there as having no parents, so every local walk stopped at #116: depth 1, no merge
base, unrelated histories. The object itself was never parentless — `git cat-file -p dc1bb351`
prints its `parent 689cf45b` line in the same repository. Every worktree under `.worktrees/` shares
that repository's `.git`, so every one of them inherited the boundary.

**Which command wrote the boundary is not established.** A depth-limited fetch writes such a line,
and no record names one.

## What was actually wrong with the stack

The stack was broken, just not like that. The PR table in `remaining-plan.md` (in
`docs/user-experience/renovation-planner-editor-specs/implementation/`) publishes #115 at `2259f0a5`
and #116 at `dc1bb351`, and GitHub's merge base for the final heads of #115 (`e23487cd`) and #116 is
exactly `2259f0a5`. #116 was cut from #115 as published, and #115 then gained 19 commits #116 never
received: an ordinary stale stack.

It was not the only stale pair. Compared at their final heads in stack order — #94, #95, #96, then
#100 to #117 — 10 of the 20 adjacent pairs have diverged:

| Adjacent pairs | Commits on the lower branch the upper lacks |
| --- | --- |
| #94 → #95, #95 → #96, #106 → #107, #107 → #108, #110 → #111, #111 → #112, #113 → #114, #114 → #115 | 1 each |
| #101 → #102 | 3 |
| #115 → #116 | 19 |

The eight one-commit gaps are the late test-only "Cover …" commits pushed to #94, #95, #106, #107,
#110, #111, #113 and #114 after the branches above them were cut. Four of the diverged pairs lie
between #101 and #111, a range the integration ledger had verified as exactly linear with
`git merge-base --is-ancestor` at the start of its walk. A stack that was linear when checked went
stale when a lower branch moved.

## Fix

- **The stack reached `main` intact regardless.** `integrate/editor-stack` set #115's tree to the
  verified tree (`f6ad547b`), merged `main` (`0161a915`), merged the eight late coverage commits
  (`152fe01f`), and recorded #101, #116, #117 and `fix/editor-visual-acceptance` through a
  content-free merge (`a92cdd7c`). Its checks were of content — the carried tree equal to
  `f73cbb76`, all 21 heads ancestors of its own head — and none of them depended on a negative
  ancestry answer, so the misreading cost a wrong sentence in three records rather than wrong code
  on `main`. #119 landed as the merge commit `5dcc1f20`. Whether merging #116 onto #115 directly
  would have been simpler than carrying the tree is not established.
- **This note is the correction of record.** The message of `a92cdd7c` cannot change on `main`.
  Pull request #119's description still carries the claim and can be edited; that is left to its
  author.
- **Not changed: the repository is still shallow.** `git fetch --unshallow` removes the boundary.
  It changes the owner's checkout rather than the register, so it is left to them. Until then,
  every negative local ancestry answer whose walk passes through `dc1bb351` is unreliable.

## Lesson

**On a shallow repository, a "no" from git's ancestry commands is not an answer.** A positive
`git merge-base --is-ancestor` has found a path and survives any shallow boundary. A negative one, a
missing merge base, `merge-tree`'s unrelated histories and a low `rev-list --count` can all be the
boundary talking. Ask `git rev-parse --is-shallow-repository` before believing any of them, or ask
the server: `gh api repos/<owner>/<repo>/compare/<base>...<head>` answers `ahead`, `behind`,
`diverged` or `identical` from the full history.

**An ancestry check on a stack is a snapshot of the moment it ran.** Checking every adjacent pair
once, before publishing, is necessary and not sufficient: a commit pushed to a lower branch
afterwards breaks linearity above it without touching any branch the check looked at. The check
belongs immediately before each push and each merge, over every adjacent pair — including pairs
outside the current task's scope, which is exactly where #115 → #116 sat.
