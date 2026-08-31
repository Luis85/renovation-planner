---
type: Feature
parent: "[[Schedule]]"
order: 20
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
release: "[[Mighty Dragon]]"
---

# Schedule dates and durations

§21's start and end dates. The distinction that has to hold is between a date a dependency implies
and a date a renovator fixed — a plasterer booked for the 14th is a fact, and the date the model
would have chosen is not. §89 makes the fixed one an explicit override rather than a value that gets
silently recalculated away.

Duration is a length; a date is a position. Keeping them separate is what lets a slip move
everything after it without editing every entry.

## Outcome

A renovator can pin the dates that are really booked and let the rest follow from what depends on
what.
