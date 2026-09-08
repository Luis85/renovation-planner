---
type: Task
parent: "[[Select several parts of a plan]]"
order: 20
status: Active
horizon: "MVP"
release: "[[MVP]]"
---

# Show only truthful shared multi-selection values

## Evidence

[M11](../user-experience/renovation-planner-editor-specs/screens/M11-multi-selection.md) forbids showing a mixed value as shared and requires valid aggregate area or length.

## Why it matters

Editing one member's value as though every selected member shared it causes unintended batch changes.

## Approach

Compute shared-property intersections, explicit mixed states, compatible aggregates and per-action compatibility from the selected ID set.

## Acceptance criteria

- Equal, mixed, unavailable and failed values remain distinct.
- Aggregates include exactly the compatible selected records.
- Unsupported combinations explain why an action is unavailable.
- Canvas badges and Inspector members correspond one-to-one.

## Risks

Ignoring unreadable members can make a partial aggregate look complete.

## Outcome

The multi-selection Inspector states only what is true of the whole selected set.


## Implementation update — 2026-09-05

M11 now displays the sum of individual selected areas and shared or mixed room/area types. Canvas badges and ordered rows agree. multiSelectionInspector.test.ts covers the current types. Failed/unavailable domain aggregates and per-batch-action compatibility remain open; this task is not complete.

## Amendments

**2026-09-08** — the stack landed (dfe9b2a6 for #74, 59977120 for #91) and this task stays
Active for the half of criterion 3 nothing asserts. Criteria 1 and 4 are
`tests/presentation/editor/selection/spatialSelection.test.ts`'s 'keeps unavailable members
explicit and never turns an entirely unreadable selection into a zero area' and 'counts
overlapping areas separately and exposes only genuinely shared types', with the mounted half in
`tests/presentation/editor/shell/multiSelectionInspector.test.ts`'s 'labels unavailable members
rather than showing a complete aggregate over a subset' (`Unavailable selected elements: 1`, and
no `0.00` anywhere) and 'derives a shared type, updates after record removal and ignores a
no-longer-readable ID'. Criterion 2 is the area sum over exactly the readable members in the
first of those. Per-batch-action compatibility, open on 2026-09-05, arrived with #91:
`tests/presentation/editor/renovationBatchGuards.test.ts`'s 'keeps unsupported Area combinations
explicit and exposes the current-geometry deletion action' and 'rejects unavailable,
single-target and failed-read batches without opening a stale dialog'. What that case asserts is
the `disabled` attribute on `[data-rp-batch="work"]` and `[data-rp-batch="delete"]` — not the
EXPLANATION criterion 3 asks for. Whether a sentence stands beside the disabled control is not
measured, so the criterion is recorded as half-held rather than ticked.
