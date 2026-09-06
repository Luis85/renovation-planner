---
type: Issue
parent: "[[Errors, diagnostics and the test harness]]"
order: 130
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

# The application-code scan cannot see domain-owned error factories

`toUserMessage.test.ts`'s `APPLICATION_CODE_PATTERN`
(`tests/presentation/i18n/toUserMessage.test.ts:93`) matches a literal `AppError.code` minted
directly under `src/application/` — the object-literal `code: '...'` shape and the three
application-owned factories (`referenceError`, `calculationError`, `persistenceError`). Its own
docblock says a domain-owned factory reached FROM `application/` (`planError`, `assetNotFound`,
`calibrationError`) is deliberately NOT matched, because a scan following a factory by name
would keep walking into `domain/`. That is a stated design choice, and it has a live
consequence: `ReversibleCalibratePlan.ts`'s `planError('nothing-to-undo', ...)` — a code this
pass added a locale sentence for by hand — mints a code the scan cannot see and therefore
cannot hold accountable for having one.

## What is true today

Every code minted through a domain factory called from `application/` falls outside
`APPLICATION_CODE_PATTERN` by construction. The next such code added without a locale row
would get no sentence and no gate would raise it — the scan simply never looks.

## What closes it

Widen the scan to also walk `src/domain/` for the same factory-call shape
(`planError(`, `assetError(`, and siblings), or add a second, domain-scoped pattern run
alongside the existing one. Either way the fix needs its own case: a domain factory code with
no locale row, added under a temporary fixture, watched red before the scan is widened and
green after.

## References

- [[Errors, diagnostics and the test harness]]
- `tests/presentation/i18n/toUserMessage.test.ts` — `APPLICATION_CODE_PATTERN` and its own
  docblock naming the exclusion as deliberate.
- `src/application/commands/plan/ReversibleCalibratePlan.ts` — `planError('nothing-to-undo',
  ...)`, the live code this scan cannot see.
