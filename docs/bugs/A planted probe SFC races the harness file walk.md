---
type: Bug
parent: "[[Prototype a screen in the harness before it is built]]"
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
---

# A planted probe SFC races the harness file walk

Two build tests disagree about what is in `tests/harness/` because one of them puts a file
there and takes it away again, and vitest runs them in parallel.

The first note in `docs/bugs/`. The folder is named in `docs/README.md` and had no notes; this
is a defect rather than an open question, and writing it as an Issue would have filed a thing
that misbehaves as a thing somebody wondered about.

## What happened

`tests/build/lint-scope.test.ts` › *are all in the type gate* failed twice on 27 August 2026
during full-suite runs, and passed on an immediate re-run both times. It asserts that every
`.vue` file under `tests/harness/` is inside `tsconfig.json`'s parsed include set — the check
that keeps `IndexPage.vue`, the largest Vue file in the repository, from falling out of
`vue-tsc`'s reach.

The two halves that meet:

- **`tests/build/lint-edited.test.ts` plants a real SFC in that directory.** `plantSfc` writes
  `tests/harness/lint-edited-probe-<n>.vue` and an `afterEach` removes it. Its own comment says
  why a temp directory is not used: the file has to sit at a path ESLint's `VUE_FILES` glob
  actually matches, or the hook being tested is linting nothing.
- **`tests/build/lint-scope.test.ts` walks that directory at collection time.**
  `const harnessSfcs = walk('tests/harness').filter((file) => file.endsWith('.vue'))` runs while
  the describe block is being built; TypeScript's config is parsed later, inside the `it`.

Vitest runs test files in parallel workers. If the walk catches a planted probe that is deleted
before the parse, the file is in `harnessSfcs` and absent from `included`, and the assertion
fails naming a file that no longer exists.

**Only one direction races** in that pair: an extra entry in `included` fails nothing, since the
assertion filters the walk against the include set and not the reverse. That is why it is rare
rather than constant.

**There is a SECOND window in the same file, and it runs the other way.** The oxlint gate a
hundred lines above snapshots `lintedFiles()` at MODULE LOAD and walks `tests/` inside its case,
so a probe planted between those two is on disk and absent from the snapshot — the mirror of the
type gate, where the walk is early and the parse is late. A review of the first fix found it,
after that fix had closed one window and left the other.

## What is not established

The mechanism above is read off the code, not demonstrated. **It did not reproduce**: zero
failures in six paired runs of the two files and zero in six full `tests/build/` runs. Both
observed failures came in a run started immediately after a source file was written, which is
consistent with different worker scheduling and is not evidence of it.

So the honest statement is that two files have a shared mutable directory and a window in which
they disagree, and that the observed symptom is what that window would produce.

## Fix

`lint-scope.test.ts` excludes the transient name inside `walk` itself, which is what covers both
windows:

```js
const PLANTED_PROBE = /^tests\/harness\/lint-edited-probe-\d+\.vue$/;
```

**In the walk rather than at a call site**, and that placement is the fix's whole content. The
first attempt filtered `harnessSfcs` alone, which closed the type gate's window and left the
oxlint gate's — one filter where the file expresses the same distinction twice. This repository
already names that shape: a distinction between kinds of thing is repeated everywhere it is
expressed, or it is repeated nowhere reliably.

**The WHOLE PATH, not the basename**, and that is the second thing a review had to correct. `walk`
is also called for `src/` and `scripts/`, so a basename test would drop any real file named
`lint-edited-probe-*.ts` anywhere in the repository out of the oxlint comparison — silently, and
out of the very case whose promise is that no source file falls out of scope. An exclusion inside
a coverage check has to be exactly as wide as the thing it excludes, and `plantSfc` reserves one
name in one directory with one extension.

**What was demonstrated, and what was not.** The predicate was measured with a probe planted and
without, at both scopes it has to reach: `tests/harness` goes from three `.vue` files to two, and
`tests` from 223 linted files to 222, the excluded entry being the probe in each case; with no
probe present neither set moves. A `tests/helpers/lint-edited-probe-99.ts` planted beside it stays
counted, which is what separates the path-exact predicate from the basename one.

The race itself was not reproduced and could not be — it needs the file present at collection
time and gone at parse time, which is a window between two workers rather than a state a test
can set up. **So the fix is reasoned from the two files, not demonstrated by a red run**, and
this note says that rather than letting a passing suite read as proof. What a green suite
establishes here is only that the exclusion broke nothing.

The alternatives, and why this one:

- **Plant in a temp directory.** Refused by `lint-edited.test.ts`'s own comment — the path must
  match `VUE_FILES` or the test stops testing the hook.
- **Serialise the two files** (`fileParallelism: false`, or a shared sequential group). Closes it
  completely and costs every other build test its parallelism, to fix a race between two of them.
- **Walk at assertion time instead of collection time.** Does not close it: the window moves, it
  does not shut.
- **Filter the prefix.** Narrow, and honest about what it hides — a file named
  `lint-edited-probe-*.vue` is transient by construction and is never a harness SFC anyone wrote.

This was not pushed with PR #17 because neither file is in that diff, and widening a review
already 49 rounds deep for an unrelated pre-existing race was the wrong trade. It lands with
this note instead, which is what the type asks for: `docs/README.md` says a `Bug` records what
fixed the defect, and one whose fix is still a proposal is an Issue wearing the wrong shape. A
review of the first draft made that argument and it was right.

## Lesson

**A test that writes into a directory another test reads is sharing state through the
filesystem, and `afterEach` does not make that safe under parallelism.** The cleanup is correct
and still leaves a window, because the other reader is not waiting for it.

The second half is about instruments rather than tests: `lint-scope.test.ts` exists to prove the
type gate's *scope*, and a scope check whose subject is a directory anybody may write to is
measuring a moving set. Both halves would be invisible to a reviewer reading either file alone —
which is what makes it worth a note rather than a commit message.
