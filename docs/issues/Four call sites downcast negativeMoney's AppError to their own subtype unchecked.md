---
type: Issue
parent: "[[Quantity, cost and the end-to-end loop]]"
order: 40
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

# Four call sites downcast negativeMoney's AppError to their own subtype unchecked

`negativeMoney` (`src/core/money/Money.ts:367`) is typed
`(label: string, value: Money | null | undefined, errorOf: (code: string, message: string) =>
AppError) => AppError | null`, returning the generic base type regardless of what `errorOf`
actually constructs. Every one of its four call sites hands it a specific `errorOf` and then
casts the result back to that specific subtype: `Asset.ts:233`
(`negativeUnitCost as ValidationError`), `AssetPriceOverride.ts:71` (the same cast),
`Project.ts:43` (`as ValidationError | null`), and `costPipeline.ts:182`
(`as CalculationError | null`). None of the four casts is checked by the compiler against what
`errorOf` actually returns — a caller could pass an `errorOf` returning the wrong subtype and
every cast would still compile.

## What is true today

Four unchecked downcasts exist for the same reason at the same shared function, all reachable
by grepping `negativeMoney(` under `src/`.

## What closes it

A generic signature — `<E extends AppError>(label: string, value: Money | null | undefined,
errorOf: (code: string, message: string) => E) => E | null` — lets each call site's own
`errorOf` fix the return type through inference, removing all four casts without changing a
single call site's arguments. No new test is needed to prove the removal safe: the existing
suite already exercises all four callers, and the change is a widening of what TypeScript can
verify, not a behavior change.

## References

- [[Quantity, cost and the end-to-end loop]]
- `src/core/money/Money.ts` — `negativeMoney`'s current non-generic signature.
- Item 8, `.superpowers/sdd/2026-09-05-improvement-and-polish-pass/issues-brief.md`.
