---
type: Issue
parent: "[[Quantity, cost and the end-to-end loop]]"
order: 50
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

# A non-finite quantity has two error codes by door

`quantityEngine.ts`'s `negativeQuantity` (`src/domain/cost/quantityEngine.ts:93`) refuses a
non-finite quantity with `quantity.non-finite`. The Cost Pipeline's own
`nonFiniteInputError` (`costPipeline.ts:193`) refuses the same condition earlier, with
`cost.non-finite-input`, before `negativeQuantity` is ever reached from that door — so a
caller going through the pipeline only ever sees `cost.non-finite-input`, while a caller
calling `toMeasuredQuantity`/`applyWaste`/`applyPackaging` directly sees `quantity.non-finite`.
`negativeQuantity`'s own docblock defends this as "one code per door, same as the negative-number
rule" — but the negative-number rule does NOT have a second, pipeline-specific code: every
door, including the pipeline's own `negativeAmount`/`negativeQuantity` calls, reaches
`quantity.negative` through the one function. Only the non-finite check has a second, distinct
code minted for its front door.

## What is true today

The one rule this module states about itself — "one rule with two error codes would be two
rules, and a caller could not tell which one it had broken" — is true of the negative check
and not of the non-finite check, by the module's own account at
`quantityEngine.ts:80-86`.

## What closes it

Collapsing to one code (having the pipeline's `nonFiniteInputError` reuse
`quantity.non-finite`, or vice versa) is the improvement; both call sites and every locale
sentence that names either code would need the same single code, and
`toUserMessage.test.ts`'s scan (see
[[The application-code scan cannot see domain-owned error factories]]) would need to keep
recognising whichever code is kept.

## References

- [[Quantity, cost and the end-to-end loop]]
- `src/domain/cost/quantityEngine.ts` — `negativeQuantity`'s docblock and the two-codes
  reasoning it states about itself.
- `src/domain/cost/costPipeline.ts` — `nonFiniteInputError`, the pipeline's own front door.
