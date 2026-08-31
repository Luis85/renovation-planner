---
type: Feature
parent: "[[Plan editor]]"
order: 60
status: ""
started: ""
finished: ""
horizon: Now
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

# Undo and redo

§68 gives this its own architecture section, and §48 puts it in the MVP, which is unusual for
something that ships no visible capability. The reason is that a spatial editor without undo is
one where every experiment is a risk, so users stop experimenting — and experimenting is the
entire point of planning a renovation before paying for it.

The requirement that shapes the design is one stack for the whole editor rather than one per tool,
and a command model (§85) is what makes that possible.

## Outcome

Anything a renovator does on a plan can be taken back, including the thing they did four steps
ago.
