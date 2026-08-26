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

The audit returned 3 HOLDS, 7 PARTIAL and 1 GAP over the eleven items, and twelve
proposed fixes. Tasks 3–7 below are those twelve, grouped by the claim each serves and
ordered so each is dispatchable on its own. Task 1's fix round already covers the
audit's proposed items 1 and 2 and part of 4 and 10; what remains of those is folded in
below rather than re-dispatched.

## Task 3: Make the boundary's completeness checkable, not maintained

The claim is "no command or query's public contract can throw". Today it is true because
someone remembered to wrap each member at one call site. A service added next month
without a guard is invisible to all four gates.

- Add the category check: every `execute`-bearing member leaving the composition root is
  a guard wrapper, asserted by walking the composed root rather than by listing names —
  with any deliberate exception carved out BY NAME and with its reason, so the carve-out
  is the thing review argues about.
- Complete `tests/application/errors/guardAgainstThrowing.test.ts` over slice 10's
  twelve services, and repair the pre-slice-10 constructor fixtures the review found
  (a `Proxy` that answers every property with a thrower makes a malformed construction
  look like a rejecting repository).
- `recoverInterruptedSequences` is awaited by nothing at load, so a rejection there is an
  unhandled rejection — the same defect `reportFault` exists to prevent. Close it, and
  correct the comment at its call site, which currently claims otherwise.

## Task 4: Message and log separation, over slice 10's vocabulary

The claim is that user-facing text comes from `t()` keyed by `error.code`, never from
`AppError.message`, and that the paired `logger.error` carries the full detail in English.

- Slice 10's reference error codes have no locale entries and fall through to the generic
  per-category sentence; two of them thereby name the wrong defect. Give them real keys
  in `en.ts` and `de.ts`.
- The delete flow stuffs already-translated copy INTO `AppError.message` and then
  discards it. Remove that path; the message field is log text.
- `requirement.recalculation.failed` drops a cause it is holding.

## Task 5: Make the diagnostics claims true, or narrow them

- `schemaVersions` is claimed to cover every entity kind; derive it from the migration
  registration table so the claim cannot drift, or correct the comments that assert it.
- "Demonstrably contains zero project content" is a claim about a shape that CAN carry
  content, so no fixture can demonstrate it. Narrow `DiagnosticsLedger.record`'s
  parameter types until a name cannot be passed, which moves the check to the end that
  can hold it.
- "No network client, analytics SDK, or remote endpoint exists in
  `infrastructure/logging/` or the diagnostics query" is true today and checked by
  nothing. Put it under a lint rule driven through a real fixture path.

## Task 6: Give the persistence safety rules their coverage

- The round-trip preservation case (unknown frontmatter keys and a hand-authored body
  survive a targeted property update) exists for some repositories and not others. Make
  it a shared contract case all five run, plus one for `markStale`.
- Fail-closed coverage is missing the future-version half for `asset` and `requirement`,
  and the SCOPING half — that the rest of the project still loads — is exercised for one
  entity kind only. Add both, and drive the project index build over a poisoned note.

## Task 7: Reconcile the task document and the agent guide

Last, once tasks 3–6 have settled what is true.

- Two DoD items are stated more widely than this architecture can reach. Item 1's first
  clause is unsatisfiable while `PlanEditorCommandServices` deliberately hands
  presentation raw repository ports; item 6's "demonstrably" is a claim about a shape.
  Narrow both sentences to the seam that exists rather than leaving the wider ones
  standing — and where task 5 made one checkable, say what the check is.
- Tick the DoD boxes that hold, and delete the stale "N/A until slice 10 referents
  exist" note: slice 10 closed rule 5, in the command, which is where the rule demands it.
- Give `CLAUDE.md` slice 11's paragraph, in the shape the other slices' paragraphs take:
  what landed, and the rules that came out of the review pass.
