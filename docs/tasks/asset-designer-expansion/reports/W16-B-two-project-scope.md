# Task report — W16-B (AD15 matrix row F10, two-project half)

Outcome: implemented — F10's two-project half is now asserted by a case that was watched failing
against a deliberately broken `ListPlansUsingAsset`. F10's **frozen** half is deliberately
untouched and must stay that way; see *The half I did not write, and why that is correct*.
Owner / worktree / branch: W16-B / `.worktrees/ad10` / `w16b-two-project-scope`
Base commit / candidate commit: `1157ed28d` / this card's single commit
Accepted contract revision: `r1`
Allowed scope and shared-file leases: one MODIFY (`tests/application/queries/listPlansUsingAsset.test.ts`)
and one CREATE (this report). No `src/`, no other test file, no helper, no locale table, no
matrix, no `state.json`.

## Changed files and reason

| File | Purpose | Within lease? |
|---|---|---|
| `tests/application/queries/listPlansUsingAsset.test.ts` | One new case asserting the two-project scope, plus the two rig affordances it needs | Yes — MODIFY, named in the lease |
| `docs/tasks/asset-designer-expansion/reports/W16-B-two-project-scope.md` | This report | Yes — CREATE, named in the lease |

`git diff --name-only 1157ed28d..HEAD` prints exactly these two paths. `src/` was modified during
the watched-red step and restored from a copy before the commit; `git status --short` printed only
the test file afterwards, and the diffstat is `56 insertions(+), 2 deletions(-)` in one file.

## The gap, verified before anything was written

The brief said the gap was real. I re-derived it rather than taking it:

- `ls tests/application/queries/` — sixteen files; `listPlansUsingAsset.test.ts` exists and is the
  one that owns this query.
- The rig function `vault()` calls `makeProject()` **once** and saves it. Every one of the file's
  seven cases ran against that single project.
- The two refusal cases (*"REFUSES rather than answering an empty scope when the project list
  cannot be read"*, *"refuses rather than half-answering when one project plan listing refuses"*)
  reach a multi-project *shape* through a `listAll` failure and a `planListing` override
  respectively. Neither saves a second project note, so neither exercises the walk over more than
  one loaded project.
- So the row's actual claim — one definition placed in plans belonging to two DIFFERENT projects,
  with the scope naming both and each row carrying its own `projectId` — was unasserted. Nothing
  already covered it under another name.

The requirement was read at source, not through the matrix: the F-table row F10 in
`ACCEPTANCE-AND-QA.md` reads *"One definition used in two projects and, where supported, one frozen
revision | Live update scope versus historical output."* The *where supported* clause is the seam
the split falls on.

## What was added

One case, `names the plans of EVERY project that places the asset, each row carrying its own
project`, and the two affordances it needs, both on the existing rig rather than beside it:

- `rig.project(name)` — saves a second project note through the same real
  `ObsidianProjectRepository` the rig already uses, and answers its id. Put on the rig because the
  rig owns the vault; a project saved past it would be a `projectId` the rig could not name.
- `rig.plan(name, elements, inProject = project.id)` — a third parameter, defaulted, so every
  pre-existing call site reads exactly as it did before. Two lines changed in that helper.

The case seeds `Kitchen` (one OVEN placement) in the rig's own project, then a second project
`Annexe conversion` holding `Loft` (two OVEN placements) and `Garage` (a `CABINET` and no asset).
`Garage` is there to keep the length assertion honest: a query that reached the second project by
listing its plans but never read their geometry would still fail.

The assertion is `expect.arrayContaining` plus `toHaveLength(2)` plus `unreadable === 0`. That is
the shape `listProjects.test.ts`'s *"answers every project seeded into the vault"* already uses for
the same question, and it is deliberately not an ordered `toEqual`: **which** rows are in the scope
is what this query promises, and the order `listAll` walks projects in is not. Following the file's
own convention was a lease condition and it is also the honest narrowing.

No port is wrapped by the new case. The file header's claim that *"Only the REFUSAL cases wrap a
port"* was re-read and is still true after this change.

## Watched red — the evidence

The smallest break that should fail only this case is to stop the project walk after the first
project. In `ListPlansUsingAsset.execute`:

```
for (const project of listed.value.loaded) {        // real
for (const project of listed.value.loaded.slice(0, 1)) {   // broken, for this step only
```

`npx vitest run tests/application/queries/listPlansUsingAsset.test.ts`, verbatim:

```
 ❯ |suite| tests/application/queries/listPlansUsingAsset.test.ts (8 tests | 1 failed) 53ms
     × names the plans of EVERY project that places the asset, each row carrying its own project 14ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  |suite| tests/application/queries/listPlansUsingAsset.test.ts > ListPlansUsingAsset > names the plans of EVERY project that places the asset, each row carrying its own project
AssertionError: expected [ { …(4) } ] to deeply equal ArrayContaining{…}

- Expected
+ Received

- ArrayContaining [
+ [
    {
      "placements": 1,
      "planId": "plan-01M33V7MR6SWE7GPRGC7X1T231",
      "planName": "Kitchen",
      "projectId": "project-01M33V7MR5VMY3C0XCTM3R1N61",
-   },
-   {
-     "placements": 2,
-     "planId": "plan-01M33V7MR6SWE7GPRGC7X1T233",
-     "planName": "Loft",
-     "projectId": "project-01M33V7MR6SWE7GPRGC7X1T232",
    },
  ]

 Test Files  1 failed (1)
      Tests  1 failed | 7 passed (8)
```

**The load-bearing line is `1 failed | 7 passed`.** The other seven cases stayed GREEN against a
query that answers from the first project only — which is the direct measurement that the gap was
real, rather than an argument that it was. `src/` was then restored from a copy taken before the
mutation, and the file re-ran `8 passed (8)`.

## Acceptance coverage

| Criterion/test ID | Result | Exact evidence | Remaining issue |
|---|---|---|---|
| F10 — "one definition used in two projects" | **Closed** | New case; two real saved projects over the real `ObsidianProjectRepository`/`ObsidianPlanRepository`; both rows asserted with their own `projectId`; watched red against a truncated project walk | None at this layer. It is a query-level assertion, not a UI one — see the next row |
| F10 — "live update scope" as a user SEES it | Not this card | `AssetUsageScope.vue` draws the scope and gates on `indexScanCompleted()`; no component test was written or claimed here | The two-project scope is unasserted at the component. Named for the integrator below, not silently left |
| F10 — "where supported, one frozen revision" | **Deliberately not written**, and correctly so | `DECISIONS.md` `r1` row 3 | None. Writing it would be the defect |

## The half I did not write, and why that is correct rather than incomplete

`DECISIONS.md` revision `r1`, row 3 (contract **C11**, historical output) accepts **"Explicit
capability gating only. No shape history, no placement pinning"**, on the ground that *"Nothing in
the product can be approved — `Plan revisions` is a requirement note, not code — so no approved
drawing can be silently redrawn."*

So F10's *"where supported, one frozen revision"* clause is satisfied by **not being supported**.
The fixture it asks for cannot be built, because no type in this product can express a frozen or
approved revision. The only test one could write is an assertion that an absent state is absent —
and this repository has a written ruling refusing exactly that shape (AD15-R1, T20): such a test
costs a branch it can never pay back, and CLAUDE.md's own coverage rules say the same thing from
the other side (*"An UNREACHABLE guard is not free"*).

I therefore wrote nothing for it, and the matrix row should be re-graded on that basis rather than
left at **partial** implying work outstanding. The clause's trigger is the increment that makes
approval a thing the code has, which is `docs/requirements/Plan revisions.md`'s, not this
package's.

## Executed checks

| Command or manual action | Commit / environment | Exit code or observed result | Evidence |
|---|---|---|---|
| `npx vitest run tests/application/queries/listPlansUsingAsset.test.ts` | working tree, after the change | `Test Files 1 passed (1)`, `Tests 8 passed (8)` | Read off the `Test Files` line, not an exit code |
| Same, against the truncated project walk | working tree, `src/` mutated then restored | `Tests 1 failed \| 7 passed (8)` | Quoted verbatim above |
| Same, after restoring `src/` | working tree | `Tests 8 passed (8)` | Re-run confirming the mutation left nothing behind |
| `npx eslint tests/application/queries/listPlansUsingAsset.test.ts` | working tree | exit `0` | Includes the test line budget, which the file is still under at 261 lines |
| `npx oxlint tests/application/queries/listPlansUsingAsset.test.ts` | working tree | exit `0` | oxlint prints nothing on a clean run; the exit code is the reading |
| `git status --short` after restoring `src/` | working tree | one line, the test file | `src/` is provably unmodified in the commit |
| `git ls-files --eol` on the target, then `grep -c $'\r'` after editing | working tree | `w/lf` before; `0` carriage returns after | The file was LF and stayed LF |
| Grep behind the new comment's claim | after the change | `rig.project(` appears **once**, at the new case; `makeProject` appears at the import, at `vault()`'s single project, and inside the new `project()` helper | The comment's sentence *"Every other case in this file lives inside the single project `vault()` opens with"* was written from this grep, run after the edit |

## Verification not performed

- **`npm run check`, `check:fast`, `npm run test:coverage`, `npm run analyze` and `npm run lint`
  were not run**, per the brief: this wave runs three cards on one 7.8 GB machine, and two full
  gates at once produce a wrong red (a destroyed `coverage/.tmp/coverage-N.json`, and `tests/build/`
  ESLint boots over their `beforeAll` budget). They are the integrator's, on the pull request.
- **No coverage measurement was taken**, so I cannot state this card's effect on the floors. The
  change adds test code only and touches no `src/` branch, so the expected effect is a small rise
  in covered branches of `ListPlansUsingAsset` (the multi-project loop iteration) and none
  anywhere else — but that is a derivation, not a reading of `coverage-final.json`. The integrator
  should read the changed-file entry rather than the summary line, per CLAUDE.md's rule that one
  branch is below the hundredth the summary prints.
- **No other test file was run.** In particular `tests/plugin/guardCategory.test.ts`, which the
  query's docblock cites as the case that found the original false-absence defect, was not
  re-run — it is outside my lease to modify and I had no reason to believe it was affected, but I
  did not confirm that.
- **No component or view test was written or run.** `AssetUsageScope.vue` is the caller that draws
  this scope; whether it renders rows from two projects sensibly (grouping, project naming, the
  pre-scan gate) is untested by this card and unclaimed by it.
- **Obsidian was not opened; `npm run test-build` was not run.** No manual case was walked. This is
  an application-layer query test over in-memory repositories; nothing here is an appearance claim.
- **No harness run and no capture.** `npm run harness` and `npm run harness-shot` draw nothing this
  card touches, and this machine's pinned Chromium was not checked.
- **The second project's note PATHS were not inspected on disk.** I relied on `createProjectId()`
  being unique and on the two projects having different names; the save succeeded and `listAll`
  returned both, which is the behaviour the case needs, but I did not read where the fake vault put
  either note.
- **Only one mutation was watched.** The truncated project walk proves the case sees a second
  project. I did not additionally mutate the per-row `projectId` to prove that each row carries its
  OWN project rather than a constant — the case's expectation names a different project id per row,
  so it would catch a constant, but that is reasoning rather than a watched red.

## Data and integration implications

Schema/migration change: none. No `src/` file is in the commit.
Relevant renderer/export/revision consumers: `AssetUsageScope.vue` is the one caller of
`ListPlansUsingAsset`; it is unchanged and untested by this card.
Undo/no-op/conflict/failure coverage: unchanged. The file's existing refusal and tolerant-skip
cases were not touched, and all seven still pass.
Identity/unit/quantity/calibration invariants: unchanged. The new case asserts identity only
(which plan, which project, how many placements).
Shared root/runtime/locales wiring still required: none.
Rollback/recovery considerations: the commit is one test file; reverting it removes a case and
nothing else.

## Things belonging to the integrator

- **Matrix**: `reports/AD15-validation-matrix.md` row F10 is graded **partial** with the two-project
  half *"reachable"*. It is now **asserted**. The frozen half should be graded as settled-by-contract
  rather than outstanding, citing `DECISIONS.md` `r1` row 3 — it is not work anybody should pick up.
  I did not edit the matrix; it is outside my lease.
- **`state.json`**: not touched, outside my lease.
- **Coverage**: read `coverage-final.json` for `src/application/queries/ListPlansUsingAsset.ts` on
  the integrated tree rather than the summary line.
- **A possible follow-up, offered as an observation and not proposed work**: the two-project scope
  is now pinned at the query and nowhere at the view. If F10 is meant to cover what a user sees,
  `AssetUsageScope.vue` is where the remaining half of that would live.

## Reviewer and integrator acceptance

Reviewer outcome and findings:
Integrated commit:
Post-integration checks/evidence:
Final status: integrated / verified / blocked

Only the integrator/reviewer fills final acceptance. A worker's completion statement is not this
field.
