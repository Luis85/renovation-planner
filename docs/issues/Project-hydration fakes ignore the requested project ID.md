---
type: Issue
parent: "[[Errors, diagnostics and the test harness]]"
order: 50
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

# Project-hydration fakes ignore the requested project ID

## The question

Design spec §3 requires `ProjectStore.hydrate` to call `getProject` with the project ID read
from the Plan. `tests/helpers/planFixtures.ts:147-153`,
`tests/harness/planEditor.ts:140-159` and
`tests/presentation/stores/stores.test.ts:284-290` do not verify that relationship: why can
their project query answer every requested ID with the same fixture?

## What is true today

`fakeQueries` and `harnessDeps().queries` return their fixture project without consulting the
project id passed to `getProject`. The production store correctly calls
`getProject(foundPlan.value.projectId)`, but the store test checks only the returned project and
never records the argument.

Measured with `rg "getProject" tests/helpers/planFixtures.ts tests/harness/planEditor.ts
tests/presentation/stores/stores.test.ts`; the focused nine-file run completed with 127 tests
green at `16757d6d`.

Changing that call to `getProject(planId)` would therefore leave the test green whenever the
fake's fixture project matches the plan's project, even though the store would be asking for the
wrong entity.

## Why it matters

The context bar's project identity depends on the relationship read from the hydrated plan. A
test double that accepts every id cannot distinguish that contract from a query made with the
editor's plan id.

## What closes it

Make the shared fakes respect the requested project id, and assert the `getProject` argument in
the store hydration case so the wrong-field mutation fails.

## What closed it

**2026-09-04.** `fakeQueries.getProject` (`tests/helpers/planFixtures.ts`) and
`harnessDeps().queries.getProject` (`tests/harness/planEditor.ts`) both answer `ok(FIXTURE_
PROJECT)`/`ok(HARNESS_PROJECT)` only for the id that project actually carries, and `ok(null)`
for any other — the same shape the real query has. Holding test:
`tests/presentation/stores/stores.test.ts` › 'ProjectStore hydration' › "asks for the PLAN's
project, by the id the plan carries", which spies on the fake's own `getProject` and asserts
`toHaveBeenCalledWith(FIXTURE_PLAN.projectId)`; mutation-checked by changing
`ProjectStore.hydrate`'s call to `queries.getProject(planId)` (the plan's own id rather than its
`projectId`) — red at `toHaveBeenCalledWith`, reverted. Commit "test(editor): fakes that respect
the id and the width, and six cases whose bodies now hold what their names claim".

## References

- [[Errors, diagnostics and the test harness]]
- [[Enforce shared editor component and state boundaries]]
- Reviewed at commit `16757d6d`, PASS 3.
