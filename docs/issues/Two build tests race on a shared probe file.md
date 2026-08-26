---
type: Issue
parent: "[[Errors, diagnostics and the test harness]]"
order: 10
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
---

# Two build tests race on a shared probe file

Found while closing design slice 14: `npm run check` failed once on `tests/build/lint-scope.test.ts`
under full-suite load, and passed immediately on a rerun and again in isolation — the
signature of a race, not a real defect in either file.

## The question

`tests/build/lint-edited.test.ts` plants its SFC lint-hook fixtures as REAL files on disk,
inside the tree the suite otherwise treats as source: `plantSfc` writes to
`tests/harness/lint-edited-probe-${N}.vue`, because the edit-loop hook it drives
(`scripts/lint-edited.mjs`) has to resolve a path ESLint's own `VUE_FILES` glob matches, which
a temp directory outside the repo cannot do. Its `afterEach` removes every planted file, but
only after the `it()` that created it has finished.

`tests/build/lint-scope.test.ts` reads that same tree twice, by two different instruments, at
two different times:

- `const linted = new Set(lintedFiles())` at module scope — a real `oxlint --debug=files`
  subprocess, spawned once when the test file loads, snapshotting the disk at that instant.
- `walk('tests')` inside `it('lints every source file under tests/', ...)` — a synchronous
  `readdirSync` walk, run when that specific case executes.

Vitest runs test files in separate workers, in parallel, by default. Nothing here declares
these two files as needing to run sequentially or in isolation, and nothing about either
file's own logic asks for that — each is correct read alone. If `lint-edited.test.ts` plants a
probe `.vue` file in `tests/harness/` in the window between `lint-scope.test.ts`'s two disk
reads, `walk('tests')` sees a file `lintedFiles()`'s earlier snapshot never scanned, the
`!linted.has(file)` filter keeps it, and the assertion that the array is empty fails — reporting
a false "this file is not linted" on a file that is not source at all and was already gone by
the time anyone read the failure.

## What is true today

- Both test files pass in isolation and under `npm run test`'s normal path; this was one
  failure under `npm run check`'s full-suite parallel run, reproduced by rerunning that one
  command, not by a targeted repro script — nobody has yet forced the race on demand.
- Neither file did anything wrong by its own stated contract. `lint-edited.test.ts`'s docblock
  is explicit about why the probe has to be a real repository path; `lint-scope.test.ts`'s
  docblock is explicit about why it asks the tool rather than the glob. Neither anticipated
  the other's write landing between its own two reads.
- This is not the shape of most flaky tests here — no unresolved promise, no unmocked
  timer. It is two otherwise-correct files sharing a directory neither declares as shared
  state.

## Why it matters

- **An intermittent CI failure is among the most expensive kinds to diagnose later** —
  by the time someone is paged for a red `main`, the reasoning that would explain "which two
  files were even running at the same time" is gone, and a rerun that goes green erases the
  evidence.
- **This repository runs the same `npm run check` across four CI legs** (three Ubuntu Node
  ranges, one Windows floor), so a race like this has four independent chances per push to
  surface, each one indistinguishable at first glance from a real regression until someone
  reruns it.
- It is the same category CLAUDE.md's testing section already names for a different pair
  (`tests/build/lint-scope.test.ts`'s own docblock cites a prior review round that misread a
  glob's depth) — this repository's build-tooling tests are dense enough, and probe enough
  real disk state, that a second instance sharing a directory is not a surprising place for
  this to recur.

## What closes it

Not designed here. Candidates worth weighing when it is picked up: give
`lint-edited.test.ts`'s SFC probes a name `lint-scope.test.ts`'s `walk` can filter out by
convention (a fixed `lint-edited-probe-*` glob exclusion, named in both files so neither can
drift from the other); move the SFC probe outside `tests/harness/` to a directory
`lint-scope.test.ts` does not walk, if ESLint's `VUE_FILES` glob reaches one; or mark the two
files as unable to run concurrently (vitest's own sequencing options), which costs suite wall
time for a guarantee that holds everywhere rather than a filename convention that has to be
kept in two files by hand. Whichever is chosen, the regression check is running `npm run
check` enough times under load to force the window, since neither file alone reproduces it.

## References

- `tests/build/lint-edited.test.ts` — `plantSfc`, writing to
  `tests/harness/lint-edited-probe-${N}.vue`, and its `afterEach` cleanup.
- `tests/build/lint-scope.test.ts` — `const linted = new Set(lintedFiles())` at module scope,
  and `walk('tests')` inside `it('lints every source file under tests/', ...)`.
- `tests/helpers/oxlint.ts` — `lintedFiles()`, the real `oxlint --debug=files` subprocess
  both files depend on being asked at the right moment.
- [[Errors, diagnostics and the test harness]] — slice 12's testing infrastructure, which
  this pair of files is part of.
