---
type: Epic
order: 170
status: ""
started: ""
finished: ""
horizon:
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
release: "[[Brave Turtle]]"
---

# Reporting and project cockpit

Nineteen epics' worth of correctly modelled data is not an overview. The question a private
renovator has on a Sunday evening is short — am I over budget, what is next, what is blocked, can
I still afford the kitchen — and answering it by opening eleven notes is the same as not
answering it.

§28's forecast is the whole epic in one line: actual plus committed plus remaining estimate. It is
the only number in the product that mixes all three financial states from §33, and it is worth
having precisely because a renovator's instinct is to compare spend against budget and forget
what has been ordered but not yet invoiced.

This epic stores nothing. Everything it shows belongs to another epic, which is what keeps it from
becoming a second, disagreeing copy of the project. Its counterpart is §12's project dashboard in
[[Project management]]: that one is one project's status and navigation, this one is the aggregate
and the forecast.

Derived from PRD §28 (Epic 17), with the financial lifecycle from §33, derived data from §88,
accessibility from §44 and the performance budgets in §102.

## Definition of done

An item beneath this epic is done when:

- Every figure it shows is derived (§88) and nothing is written back. A cached cockpit total is a
  second source of truth with a fresher-looking timestamp.
- The forecast is exactly §28's identity, and each of its three terms is traceable to the objects
  that produced it. A forecast nobody can take apart is a number nobody will believe.
- Project health is not colour-only (§44) and says what made it that colour.
- Everything in the cockpit is reachable without the cockpit (§44 portability), because this is
  the view most likely to be replaced by a user's own Bases table.
- It opens fast enough to be opened casually, against §102's budgets. A cockpit that takes four
  seconds is a cockpit nobody checks.
