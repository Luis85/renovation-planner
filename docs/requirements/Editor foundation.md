---
type: Feature
parent: "[[Plan editor]]"
order: 10
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
release: "[[MVP]]"
---

# Editor foundation

This Feature is Increment A of the approved editor sequence. It reconciles the locked homeowner
language with the current model, then establishes the Obsidian-native shell, safe navigation,
layers, selection, contextual inspection, one Add entry point and shared history on which later
spatial and renovation workflows depend.

It owns editor workflows only. It does not introduce Property, Building, Floor, Room, Wall or
renovation-state entities merely to make the screen vocabulary match. Until the consolidation
work and ADRs decide otherwise, `Plan` presents as **Floor** and a room-classified `Zone`
presents as **Room**, with stable current IDs and persistence preserved.

## Outcome

A private renovator can open a floor plan in Obsidian, orient and navigate without entering a
destructive mode, control what is visible, select the same spatial record from canvas or list,
inspect truthful available details, begin one creation task from Add, and reverse editor changes
through one predictable history.

## Sources

- [Editor implementation plan, Increment A and Phases 0–3](../user-experience/renovation-planner-editor-specs/implementation/implementation-plan.md)
- [Vertical-slice plan and data-model specification](../user-experience/renovation-planner-editor-specs/Renovation%20Planner%20—%20First%20Vertical%20Slice%20Plan%20and%20Data-Model%20Specification.md)
- [Editor design specification set](../user-experience/renovation-planner-editor-specs/README.md)
