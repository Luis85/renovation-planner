---
type: Issue
parent: "[[Selection]]"
order: 40
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

## What closed it

**2026-09-04.** The criterion is aligned with the adopted semantic z-order — `candidates` IS
z-order, bottom first, and the resolver deliberately scans it in reverse so the last-drawn body
wins — rather than the "regardless of layer iteration order" wording the resolver was never
meant to hold. Holding test:
`tests/presentation/editor/selection/resolveSelectionTarget.test.ts` › "is a function of
z-order: the same ordered list answers the same, and reversing it makes the other body
topmost", which asserts a stable result over the SAME ordered input and a different, discriminating
result — `'below'` rather than `'above'` — over the reversed one; mutation-checked by scanning
`candidates` forward instead of in reverse (red at `'below'`, reverted). Commit "test(editor):
fakes that respect the id and the width, and six cases whose bodies now hold what their names
claim".

## References

- [[Selection]]
- [[Resolve overlapping selection targets deterministically]]
- Reviewed at commit `16757d6d` — PASS 3
