---
type: Issue
parent: "[[Errors, diagnostics and the test harness]]"
order: 160
status: New
started: ""
finished: ""
horizon: Next
start: ""
due: ""
risk: ""
priority: ""
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
effort: ""
complexity: ""
business-value: ""
business-value-model: ""
---

# Three test files sit at the 450-line cap with crammed lines

`tests/**`'s `max-lines` cap is 450 (`eslint.config.mjs`), looser than `src/**`'s 400 because a
test file is mostly fixture setup. Measured with the gate's own counter,
`tests/application/reference/deleteAssetRefusals.test.ts` and
`tests/application/reference/deleteResolutionEngine.test.ts` both count 444 lines — 6 lines of
headroom each. `tests/application/events/reversibleWritePathCensus.test.ts` carries a
175-character import line
(`import { TEN_SQUARE_METERS, assignedRequirementFixture as withRequirement,
makeDeleteZoneCommand, requirementFixture, zoneSequenceCollaborators } from
'../../helpers/slice10';`) — the same shape as `runtime.ts`'s collapsed call line
([[runtime.ts is at 394 of 400 counted lines and paid readability for the budget]]), bought by
squeezing rather than by splitting.

## What is true today

All three files are close enough to their cap that the next case added to any of them needs a
seam (splitting the fixture setup, or the `describe` block, into a sibling file) rather than
another squeeze.

## What closes it

No fix is owed today — this is a housekeeping note for whoever next adds a case to any of the
three files. The signal to watch is the same one `[[runtime.ts is at 394 of 400 counted lines
and paid readability for the budget]]` names: headroom shrinking rather than a specific
failing check.

## References

- [[Errors, diagnostics and the test harness]]
- [[runtime.ts is at 394 of 400 counted lines and paid readability for the budget]] — the
  `src/**` sibling of this same shape.
- `tests/application/reference/deleteAssetRefusals.test.ts`,
  `tests/application/reference/deleteResolutionEngine.test.ts`,
  `tests/application/events/reversibleWritePathCensus.test.ts`.
