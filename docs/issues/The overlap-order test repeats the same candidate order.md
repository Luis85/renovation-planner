---
type: Issue
parent: "[[Selection]]"
order: 40
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

# The overlap-order test repeats the same candidate order

## The question

The acceptance criterion in [[Resolve overlapping selection targets deterministically]] says
identical candidate sets resolve identically regardless of layer iteration order. Design spec
§6.1 instead defines `candidates` as z-order, bottom first, and
`src/presentation/editor/selection/resolveSelectionTarget.ts:32-36` deliberately scans that
order in reverse so the last drawn body wins.

## What is true today

The test titled *"resolves the same target regardless of the order the same candidates arrive
in, once z-order is fixed"* computes both values from `[below, above]`:
`tests/presentation/editor/selection/resolveSelectionTarget.test.ts:35-39`. No order changes,
so the equality assertion is the same call repeated. Reversing the array is not an equivalent
input under §6.1; it makes `below` topmost and should change the result.

## Why it matters

The cited test cannot detect nondeterminism or an accidental reversal of the z-order rule, yet
the task and parent amendment present it as evidence for order independence. A future change can
select the wrong overlapping room while this case remains green.

## What closes it

Align the criterion with the adopted semantic z-order: the same ordered input must be stable,
and reversing the order must select the newly topmost body. Replace the duplicate call with that
discriminating reverse-order assertion, or add an explicit z-index before claiming array-order
independence; update the task and parent evidence to cite only the property the chosen test
proves.

## References

- [[Selection]]
- [[Resolve overlapping selection targets deterministically]]
- Reviewed at commit `16757d6d` — PASS 3
