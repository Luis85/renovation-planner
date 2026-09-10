---
type: Task
parent: "[[Produce auditable release evidence]]"
order: 60
status: Done
horizon: "MVP"
release: "[[MVP]]"
---

# Confirm merged main carries the verified editor state

## Evidence

Measured on 2026-09-10, after pull request #119 landed:

- `main` is `5dcc1f20`, a merge commit whose parents are `db8e445b` (the previous `main`) and
  `17097b8a` (the head of `integrate/editor-stack`). `git diff 17097b8a 5dcc1f20` is empty, so the
  tree on `main` is the integration head's tree byte for byte. GitHub reads #119 and all 21 stack
  pull requests — #94 to #96 and #100 to #117 — as MERGED.
- `git merge-base --is-ancestor <commit> 5dcc1f20` answers yes for the Costs Inspector fix
  `5a244a92`; for the visual-matrix instrument fixes `81590b9a`, `9ce92e1e`, `78c5dfe3`,
  `92a10978`, `d65ccfc5` and `f73cbb76`; for the stack heads `dc1bb351` (#116) and `5c15006c`
  (#117); and for the integration commits `22772267` and `17097b8a`. They keep their original SHAs.
- `src/presentation/editor/planning/CostGroup.vue` gates a group's totals with
  `v-if="totals && rows.length > 1"`, and the grouping case in
  `tests/presentation/editor/planningWorkflow.test.ts` asserts one direct-child `.rp-cost-totals`
  for the two-row group and none for the one-row group.
- CI run 34449275294 on `5dcc1f20`, a push to `main`, concluded `success`: `verify` on Ubuntu with
  Node 22, 24 and 26, `verify` on Windows with Node 22, and `audit`.
- `docs/user-experience/renovation-planner-editor-specs/implementation/evidence/editor-visual-fidelity/capture-provenance.json`
  on `main` names `22772267` as its `commit`.

What that head carries, as the integration session reported it for `22772267`: all four CI legs
passed in run 34445960897, the full `npm run check` passed locally (coverage 99.22% statements,
98.13% branches, 99.13% functions, 99.56% lines; fallow clean), and
`scripts/editor-visual-final-check.mjs` passed the full visual matrix — **the first pass on the
current tree with the pinned Chromium**. An earlier pass on revision 430 used a substitute Edge
browser, and the editor package's `RESUME.md` keeps its images as predecessor evidence only.
`17097b8a` added only the refreshed matrix evidence, with its own green CI in run 34447537221.

CI's own count for `22772267`, in run 34445960897, is 760 test files and 8,829 tests passed with 69
skipped, 8,898 in all. The local gate counted 8,828 passed and 70 skipped: one test CI ran and
passed was skipped locally. The four coverage figures are identical in both. The CI runs, CI's
count and the provenance file are the parts re-read here; the local gate figures are the session's.

## Why it matters

Every acceptance item after the merge cites these commits. Before the merge, the follow-up draft
expected the fix to reach `main` only by rebase, cherry-pick or squash, each of which rewrites
SHAs, so "fixed at `5a244a92`" would have cited a commit `main` does not contain. And a gate that
is green on one machine is not the four legs CI runs.

## Approach

Checked on `main` by content, ancestry and CI rather than taken from the pre-merge record: read the
gate condition and its assertions in the files, asked git for ancestry, and asked GitHub for the
merge commit's CI run and each pull request's state.

## Acceptance criteria

1. `CostGroup.vue` on `main` carries the single-row gate, and `planningWorkflow.test.ts` carries
   the two assertions added with it, checked by content. **Met.**
2. The six instrument fixes are on `main`. **Met**, by ancestry.
3. CI `verify` is green on all four legs for the merge commit, and the run is recorded. **Met**,
   run 34449275294.
4. A mapping from branch SHAs to `main` SHAs is recorded. **Not needed**: #119 landed as a merge
   commit, so every branch SHA is reachable from `main` unchanged.
5. The provenance file's commit is marked pre-merge if the evidence came along. **Not needed**: it
   names `22772267`, an ancestor of `main` whose tree differs from `main`'s only by the evidence
   `17097b8a` committed.

## Risks

- The local repository was shallow when these checks ran, so none of them rests on a negative
  ancestry answer. It was unshallowed on 2026-09-10, as
  [[A shallow clone made a stack head read as parentless]] records, and that limit no longer holds.
- Anything committed to `main` after `5dcc1f20` is outside this confirmation.

## Outcome

`main` at `5dcc1f20` carries the verified editor state: the Costs Inspector fix and its
assertions, the visual-matrix instrument fixes, and the matrix evidence captured at `22772267`,
with CI green on the merge commit. Later evidence may cite the original SHAs.
