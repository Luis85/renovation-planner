---
type: Issue
parent: "[[Plan editor and canvas]]"
order: 110
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

# Nothing asserts what the requirement lifecycle events do at their second consumer

`projectPricesChangeSource.ts` now fans `RequirementCreated`, `RequirementDeleted` and
`RequirementRestored` into the price-change signal it publishes
(`REQUIREMENT_LIST_EVENTS`). The Plan Editor's own consumer,
`runtime.ts`'s `onBeforeUnmount(context.onProjectPricesChanged(reloadInspector))`, subscribes
through `PlanEditorContext.onProjectPricesChanged(listener: () => void)` — a listener that
takes NO project id, unlike `RenovationProjectContext.onProjectPricesChanged(listener:
(projectId: string | null) => void)`, which does. So `reloadInspector` reloads the Inspector
for a requirement lifecycle event fired by ANY project's requirements, not only the plan
editor's own.

## What is true today

`grep`ing every test that drives `RequirementCreated`/`RequirementDeleted`/`RequirementRestored`
against every test that drives `onProjectPricesChanged` turns up no overlap: the events are
tested at their source (`projectPricesChangeSource.test.ts`,
`requirementEvents.test.ts` and siblings) and `onProjectPricesChanged` is tested at its
consumers (`projectPriceSection.test.ts`, `planEditorView.test.ts`,
`viewRootOpenProject.test.ts` and others) — but no test drives a `RequirementCreated`/
`Deleted`/`Restored` delivery THROUGH to either consumer to check what it does.

## What closes it

A case in `runtime.ts`'s own test suite publishing one of the three requirement events for a
DIFFERENT project than the mounted Plan Editor's, asserting whether `reloadInspector` fires —
today it would, since the listener discards the id. If that over-triggering is accepted, the
test should say so explicitly rather than leaving the behavior undriven; if not, the fix is
threading the project id through `PlanEditorContext.onProjectPricesChanged` the way
`RenovationProjectContext`'s already does, and filtering in `runtime.ts`.

## References

- [[Plan editor and canvas]]
- `src/application/events/projectPricesChangeSource.ts` — the three requirement lifecycle
  events fanned into one signal.
- `src/presentation/editor/PlanEditorContext.ts` and
  `src/presentation/views/RenovationProjectContext.ts` — the two `onProjectPricesChanged`
  signatures, one with a project id and one without.
