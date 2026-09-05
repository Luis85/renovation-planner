---
type: PBI
parent: "[[Project dashboard and navigation]]"
order: 50
status: New
started: ""
finished: ""
horizon: "MVP"
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

# Continue when the last plan is unavailable

`Continue` resolves its stored plan by listing the project's plans and looking for it. One line
decides what happens when that does not work:

```
plan = (isErr(plans) ? undefined : plans.value.plans.find((p) => p.id === resume.planId)) ?? 'gone'
```

A read that **failed** and a plan that is **absent** answer the same `'gone'`, and `'gone'` makes
the whole affordance disappear. So a vault that could not be read for a moment looks exactly like a
plan the renovator deleted, and the remedy for the first — try again — is not offered, because the
control that would offer it is the one that vanished.

Indexing is the third case wearing the same answer. Obsidian restores leaves before the index scan
runs, so a `Continue` resolved too early asks an empty index, finds nothing, and reports a plan as
gone on the strength of a question asked before there was anything to answer it.

## Actor

A renovator opening the pane, whose last plan may or may not still be there.

## Main flow

1. The renovator opens the pane.
2. The stored target resolves against the project index.
3. `Continue` offers the project and plan by name.
4. Pressing it opens the plan.

## Extensions

- **2a. The index scan has not completed.** `Continue` says it is still resolving rather than
  claiming anything about the plan. It resolves when the scan does. No deletion is ever claimed on
  an incomplete index.
- **2b. The read fails.** `Continue` says so and offers a retry, keeping the stored target. A
  transient failure never deletes what it could not read.
- **2c. The plan is genuinely absent and the project is there.** `Continue` says the plan is gone
  and offers the project instead. It does not silently substitute another of that project's plans.
- **2d. The project is absent.** `Continue` says so and offers the list. The stored target is
  cleared, because nothing it names exists.
- **4a. The plan disappears between resolving and pressing.** Pressing revalidates; the outcome is
  [[Resume the last plan on a confirmed opening]]'s, and the target is not overwritten by the
  failure.
- **2e. A slower earlier resolution answers after a newer one.** It is discarded. An old request
  can never mark a newer target missing.

## Guarantee

**A target is only ever reported gone on evidence that it is gone.** A failure to read, an
incomplete index and a slow answer each say what they are, and none of them is allowed to produce
the sentence that a plan no longer exists — so the renovator is never told to redo work that is
still there.

## Acceptance criteria

- With the plan-listing read forced to fail, `Continue` draws a failure with a retry and the stored
  target survives; retrying after the read recovers resolves normally.
- With the index scan incomplete, `Continue` draws neither the plan nor a gone state, and resolves
  once the scan completes.
- With the plan deleted and the project intact, `Continue` offers the project, and no other plan of
  that project is opened.
- With the project deleted, `Continue` offers the list and the stored target is cleared.
- A resolution that resolves after a newer one has started does not change what is drawn.

## Sources

`docs/user-experience/renovation-planner-project-specs/implementation/repository-reconciliation-and-backlog.md`
PBI-05 and its §1 row on Resume resolution; screen P03;
`src/presentation/views/ViewRoot.vue`, where the two conditions collapse into one sentinel.
