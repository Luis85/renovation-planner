---
type: PBI
parent: "[[Editor foundation]]"
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

# Consolidate the current and target editor data models

This scheduling PBI holds the evidence and decisions that must precede any editor schema,
entity or migration change. The locked screens speak in homeowner concepts while the current
implementation and vault data use `Project`, `Plan`, `Zone`, `Asset` and `Requirement`.
Treating those vocabularies as either identical or unrelated would make the first UI increment
rewrite valid data or show claims the model cannot support.

The work inventories the current model and storage shapes, traces representative round trips,
maps locked concepts across UI, read models, domain and persistence, and records the ADRs and
approved slice contract. It has no predecessor. It is itself the predecessor for model-changing
work under [[Editor foundation]].

Compatibility is the starting constraint, not a decision to skip the work:

- `Plan` presents as **Floor** in V1.
- A `Zone` with room classification presents as **Room**.
- Stable IDs, Markdown metadata and `.rpgeo` geometry remain canonical unless an accepted ADR
  changes them.
- Existing, Planned and Work are not aliases for the current Zone lifecycle status.
- Unsupported Inspector sections must distinguish unavailable capability from supported empty
  data.

## Outcome

The team has one reviewed inventory, one round-trip account, accepted Room/Zone and Plan/Floor
decisions, and one approved contract saying exactly which current fields and identities the
first editor slice reads and writes. No unresolved high-severity conflict remains for open,
select, create, move, undo, redo, save or reload.

## Sources

- [Vertical-slice plan: WP0 and data-model specification](../user-experience/renovation-planner-editor-specs/Renovation%20Planner%20—%20First%20Vertical%20Slice%20Plan%20and%20Data-Model%20Specification.md)
- [Editor implementation plan: Phase 0](../user-experience/renovation-planner-editor-specs/implementation/implementation-plan.md)
- [Locked editor specification set](../user-experience/renovation-planner-editor-specs/README.md)
