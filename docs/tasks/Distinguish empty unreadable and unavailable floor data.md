---
type: Task
parent: "[[View rooms in the Standard Plan View]]"
order: 30
status: Active
horizon: "MVP"
release: "[[MVP]]"
---

# Distinguish empty unreadable and unavailable floor data

## Evidence

The vertical plan's [Inspector honesty rule](../user-experience/renovation-planner-editor-specs/Renovation%20Planner%20—%20First%20Vertical%20Slice%20Plan%20and%20Data-Model%20Specification.md) forbids fabricated counts and requires unavailable capability to differ from supported empty data.

## Why it matters

Zero, unreadable and unsupported lead to different user decisions and cannot share one blank state.

## Approach

Define selectors and presentation states for an empty readable floor, partial unreadable results, query failure and unsupported aggregates; expose each in the M01 shell.

## Acceptance criteria

- Empty, partial-unreadable, failed and unsupported fixtures render distinct states.
- Readable rooms remain usable beside partial warnings.
- No unsupported aggregate is displayed as zero.
- Light and dark checks include each state.

## Risks

Convenience defaults in DTO mapping can erase the distinction before presentation receives it.

## Outcome

The Standard Plan View never claims more certainty or capability than its data supports.

## Amendments

**2026-09-03**, the plan editor foundation's first increment. Criterion 1's four states are
`tests/presentation/read-models/spatialRecords.test.ts`'s 'distinguishes a floor with no rooms
from one whose rooms could not be read' (empty against partial-unreadable),
`tests/presentation/editor/planEditorFailure.test.ts` (failed, as an in-place failure state) and
`tests/presentation/read-models/roomOverview.test.ts` with
`tests/presentation/editor/shell/floorInspector.test.ts` (unsupported, as the word rather than a
number). Criterion 2 is `tests/presentation/editor/unreadableZonesNotice.test.ts` — the readable
rooms stay on the canvas beside an additive warning naming the count. Criterion 3 is the
'never zero' clause of the floor-summary case.

**Criterion 4 is held by NOTHING, which is why this Task is Active rather than Done.** SDD §84
refuses a literal colour in any stylesheet partial, so no state can carry a palette of its own —
that is a check on the SOURCE, not a light-and-dark check of any state, and reading it as one was
the error this amendment corrects. The `plan-editor-dark` and `plan-editor-light` captures
photograph the RESTING scene; `plan-editor-selected`, `-add-menu` and `-narrow` are each light
only. None of the four states this Task exists to distinguish — empty, partial-unreadable, failed,
unsupported — has a picture in either scheme, and jsdom lays nothing out, so nothing else here can
see one either.
