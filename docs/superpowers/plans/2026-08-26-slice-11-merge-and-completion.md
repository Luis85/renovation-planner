# Plan: merge main into slice 11, and finish the Error Boundary over slice 10

## Context

Branch `feat/slice-11-error-handling-diagnostics` carries design slice 11 (commit
`2109ce4`): the fail-closed schema-version gate, the `ExceptionMapper` +
`guardCommand`/`guardQuery` Error Boundary, `toUserMessage`, the content-free
diagnostics ledger and `GetDiagnosticsSnapshot`, and the verbose-logging setting.

`main` has since merged design slice 10 (assets, requirements, the reference-delete
resolution engine, the cascade handlers) and design slice 15's dialog framework.
A `git merge main` is in progress in this worktree with nine conflicted files.

The merge is not mechanical. Slice 11's central claim — **no command or query's public
contract can throw** — is implemented by wrapping every member of `PersistenceServices`
in a guard at the composition root. Slice 10 added roughly a dozen new commands and
queries to that interface. Merging without extending the boundary over them would leave
the claim written down and false.

## Spec

`docs/tasks/11-error-handling-diagnostics-and-data-safety.md` is the binding spec —
in particular its "Definition of Done" list. Slice 11's own commit noted that Data
Safety rule 5 (never cascade-delete silently) was documented N/A "until slice 10
referents exist". They exist now, so that note is stale and the rule has a subject.

## Global Constraints

- `npm run check` (build + lint + coverage-thresholded tests + fallow) is the
  definition of done. All four legs must pass.
- Coverage floors are 99/99/99/98 with about 0.02 of branch headroom. Plan the test
  with the code; an untested new arm fails the gate.
- The layer rule holds: `presentation → application → domain → core`,
  `infrastructure → application → domain → core`, `plugin/` composes all of them.
  `vue`/`pinia`/`konva`/`obsidian` may not be named in `core/`, `domain/`, `application/`.
- Nothing writes to the vault outside `infrastructure/`.
- Every user-facing string resolves through `t(language, key)` from the locale tables.
  `de.ts` must translate every key `en.ts` declares.
- An invariant asserted in a comment gets a test that fails without it, and the test is
  watched failing.
- A category invariant is checked at the forbidden thing, not by listing the places.
- Write the guarantee to the check, never ahead of it: if a check cannot reach the whole
  claim, narrow the sentence rather than leaving the wider one standing.
- Address code by name, not by line position.

## Task 1: Resolve the merge and extend the Error Boundary over slice 10

Resolve all nine conflicts, extend `guardCommand`/`guardQuery` over every service slice
10 added to `PersistenceServices`, and get `npm run check` green. Commit the merge.

## Task 2: Audit slice 11's Definition of Done against the merged tree

Read-only. Produce a gap report: for each of the eleven DoD items, the evidence that it
holds over the merged tree (naming the code and the test that would fail without it), or
the concrete gap.

## Tasks 3+

Derived from Task 2's report, one task per confirmed gap. The controller writes them
into this file as the audit lands.
