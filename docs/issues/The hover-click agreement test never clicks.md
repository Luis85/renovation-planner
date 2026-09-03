---
type: Issue
parent: "[[Selection]]"
order: 70
status: New
started: ""
finished: ""
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

# The hover-click agreement test never clicks

## The question

Design spec §6.1 requires hover and click to ask one resolver, and
[[Compose predictive and contextual Select surfaces]] cites
`tests/presentation/editor/tools/selectTool.test.ts` as proof that hover predicts the same
target a click selects.

## What is true today

The case titled *"a hover with no gesture predicts the same target a click there would take"*
at `tests/presentation/editor/tools/selectTool.test.ts:221-233` invokes only
`pointerMove`: once over one candidate and once over empty canvas. It never invokes
`pointerDown`, never reads selection, and never compares the predicted ID with a click outcome.
The nearby case at `tests/presentation/editor/tools/selectTool.test.ts:235-247` clicks only to
assert that hover is cleared, which is a different property.

## Why it matters

Moving either the hover or click path onto a different resolver, candidate order or target
mapping can leave this named agreement test green. The task and parent then cite evidence for a
cross-path invariant that the test never crosses.

## What closes it

In one overlapping-candidate fixture, hover the point, capture the predicted ID, then send a real
primary click grammar (`pointerDown` plus `pointerUp`) at the same point and assert the selected
ID equals that prediction. Keep the off-target hover assertion separately; mutate either path to
choose the lower candidate and watch the agreement case fail.

## References

- [[Selection]]
- [[Compose predictive and contextual Select surfaces]]
- Reviewed at commit `16757d6d` — PASS 3
