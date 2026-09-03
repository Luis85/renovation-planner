---
type: Issue
parent: "[[View rooms in the Standard Plan View]]"
order: 20
status: Done
started: 2026-09-04
finished: 2026-09-04
horizon: Now
start: ""
due: ""
risk: ""
priority: high
assignee: ""
iteration: ""
strategic-alignment: ""
customer-value: ""
business-impact: ""
reach: ""
risk-reduction: ""
compliance: ""
time-criticality: ""
enablement: ""
confidence: ""
effort: S
complexity: ""
business-value: ""
business-value-model: ""
---

# The partial-summary test never checks the area count

## The question

Does the test cited as evidence that every count stays partial actually check every count?

## What is true today

`tests/presentation/read-models/spatialRecords.test.ts:48-52` names the case “marks every count
partial” but asserts only `roomCount` and `totalAreaMm2.state`. It never reads `areaCount`.
Production currently computes all three through `counted` at
`src/presentation/read-models/spatialRecords.ts:89-91`, but the test does not hold the middle
line.

The read-path design's §3 clause at
`docs/superpowers/specs/2026-09-02-plan-editor-foundation-read-path-design.md:140-142` requires
all three aggregates to become `partial` and carry `unreadable`. The completed task's Closing
evidence at
`docs/tasks/Present the truthful floor summary and selection guidance.md:50-58` cites this case
as evidence for the partial arm generally, so its evidence overclaims what the assertions keep.

Measured command:
`npx vitest run tests/presentation/read-models/spatialRecords.test.ts` remains green when
`areaCount` is mutated to stay available in the partial fixture, because no assertion observes
that value.

## Why it matters

A later edit can regress only the area count while the test title and the completed task continue
to say every count is protected. The visible Inspector would then disagree with the room count
and total area about the same unreadable records.

## What closes it

The smallest fix and test are one assertion in the existing partial case:
`expect(summary.areaCount).toEqual({ state: 'partial', value: 1, unreadable: 2 })`. Amend the
task's Closing evidence in the same change so it points to the now-complete assertion set rather
than the former overclaim.

## What closed it

**2026-09-04.** One assertion was added to the existing partial case:
`expect(summary.areaCount).toEqual({ state: 'partial', value: 1, unreadable: 2 })`. Holding
test: `tests/presentation/read-models/spatialRecords.test.ts` › 'buildFloorSummary' › "marks
every count partial when some zones were unreadable, carrying the number", now asserting all
three of `roomCount`, `areaCount` and `totalAreaMm2.state`; mutation-checked by computing
`areaCount` as `counted(areas.length, 0)` (red, `state: 'available'` where `'partial'` was
expected; reverted). Commit "test(editor): fakes that respect the id and the width, and six
cases whose bodies now hold what their names claim".

## References

- [[View rooms in the Standard Plan View]]
- [[Present the truthful floor summary and selection guidance]]
- Reviewed at commit 16757d6d.
- PASS 3.
