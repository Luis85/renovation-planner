---
type: Task
parent: "[[Select several parts of a plan]]"
order: 30
status: Done
horizon: "MVP"
release: "[[MVP]]"
---

# Apply a multi-selection action as one transaction

## Evidence

[M11](../user-experience/renovation-planner-editor-specs/screens/M11-multi-selection.md) requires batch commands to be atomic and undo as one user action.

## Why it matters

Partial batch writes leave selected records disagreeing about the action the user confirmed once.

## Approach

Define the generic confirmation, impact and composite-command route for compatible actions, including version checks, compensation and one history entry.

## Acceptance criteria

- One confirmation dispatches one composite command.
- Every target is revalidated before write.
- Success creates one undo entry.
- A refusal writes nothing; a mid-sequence failure compensates or exposes recovery state.
- Destructive impact is shown before consent.

## Risks

Later domain actions may require stronger transaction semantics than the foundation can assume.

## Outcome

Compatible shared actions behave as one trustworthy reversible user action.

## Closing evidence

**2026-09-08**, the plan-editor stack — landed in 59977120 (#91, `codex/editor-plan-finalization`).

Two batch shapes exist: a shared renovation record over several targets (`renovationBatch`) and a
mixed wall/element deletion (`spatialBatchRemoval`). Both are one command, one confirmation and
one history entry.

Criterion 1 — **one confirmation dispatches one composite command** — and criterion 3 —
**success creates one undo entry** — are `tests/application/commands/renovationBatch.test.ts`'s
'persists one %s identity, protects every linked target, and undoes the entire batch' and
`tests/presentation/editor/spatialBatchRemoval.test.ts`'s 'deletes a mixed wall/element selection
once, including hosted openings, and restores exact labels/shapes with Undo/Redo'.

Criterion 2 — **every target is revalidated before write** — is 'refreshes a peer shape before
asking for deletion and does not overwrite that shape', 'refuses a peer edit that arrives while
the named deletion confirmation is open' and 'abandons a delayed read when selection changes and
refuses missing or Room members' in `spatialBatchRemoval.test.ts`, and 'refuses the whole selected
deletion when a current %s refers to one member' for the referential half.

Criterion 4 — **a refusal writes nothing; a mid-sequence failure compensates or exposes recovery**
— is 'leaves every member untouched on cancellation, a failed read, and a sidecar failure with
conditional compensation' and `tests/presentation/editor/renovationBatchForm.test.ts`'s 'retains a
failed batch draft and freezes further submission after %s'.

Criterion 5 — **destructive impact is shown before consent** — is `renovationBatchForm.test.ts`'s
'explains affected hosted openings and linked records in the removal preview' and
`tests/presentation/editor/spatialNavigationBoundaries.test.ts`'s 'names both Wall and Opening in
native batch deletion, cancels safely and undoes the exact confirmed relationship'.

What is refused rather than batched, so it is not read as covered: a Room in a deletion batch
('refuses missing or Room members' — a Room's deletion stays its own confirmed path), and an Area
beside a Room in a shared-record batch
(`tests/presentation/editor/renovationBatchGuards.test.ts`'s 'keeps unsupported Area combinations
explicit and exposes the current-geometry deletion action', which asserts the action DISABLED and
not the sentence beside it — see [[Show only truthful shared multi-selection values]]).
