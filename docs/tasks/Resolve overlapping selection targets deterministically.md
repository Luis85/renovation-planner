---
type: Task
parent: "[[Selection]]"
order: 20
status: Active
horizon: "MVP"
release: "[[MVP]]"
---

# Resolve overlapping selection targets deterministically

## Evidence

The [implementation plan Phase 2](../user-experience/renovation-planner-editor-specs/implementation/implementation-plan.md) locks priority as handle → object → opening → wall → room → background and requires overlap cycling.

## Why it matters

Overlapping geometry otherwise makes the same click select different records as render order changes.

## Approach

Centralize hit candidates and priority, make hover use the same resolution as selection, and provide an alternate/cycling route for ambiguous locations.

## Acceptance criteria

- The same ordered candidate list resolves identically; z-order (bottom first) is the input, and
  reversing it selects the newly topmost body.
- Hover predicts the record a click selects.
- Alternate selection can reach lower-priority candidates.
- Priority cases are tested with overlapping fixtures.

## Risks

Future entity types can bypass the rule if hit testing is distributed among shapes.

## Outcome

Users can predict and recover which overlapping part will be selected.

## Amendments

**2026-09-03** — `src/presentation/editor/selection/resolveSelectionTarget.ts` is one function
that `SelectTool.pointerDown` and `SelectTool.pointerMove` both ask; the tool's private
`hitTest`/`vertexAt` were deleted rather than left beside it, which is what stops two derivations
of one priority. `tests/presentation/editor/selection/resolveSelectionTarget.test.ts` holds
criterion 1 ('resolves the same target regardless of the order the same candidates arrive in, once
z-order is fixed') and criterion 4 ('picks the topmost body where two overlap', 'a vertex handle of
the SELECTED record beats every body', 'a vertex of an UNSELECTED record is just a body hit', and
the two degenerate-input cases). Criterion 2 is
`tests/presentation/editor/tools/selectTool.test.ts`'s hover case.

Criterion 3 is out of scope by spec §6.1: this increment has ONE record type, so the only overlap
is a room over a room, and the resolver's shape leaves room for cycling rather than implementing
it. No alternate route to a lower-priority candidate exists.

**2026-09-04** — criterion 1's evidence moves to
`resolveSelectionTarget.test.ts`'s 'is a function of z-order: the same ordered list answers the
same, and reversing it makes the other body topmost', which replaces a case that computed both
sides of its equality from the SAME `[below, above]` order — a call repeated rather than a
discriminating one, unable to detect nondeterminism or an accidental reversal of the z-order rule.
The criterion's own wording is rewritten to state that rule rather than "regardless of layer
iteration order", which the resolver was never meant to hold: `candidates` IS z-order, bottom
first, and the resolver deliberately scans it in reverse so the last-drawn body wins. Closes
[[The overlap-order test repeats the same candidate order]].
