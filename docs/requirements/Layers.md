---
type: PBI
parent: "[[Editor foundation]]"
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
release: "[[MVP]]"
---

# Layers

## Actor

[[Private renovator]] reducing a busy floor plan to the information relevant to the current
decision.

## Preconditions

- A floor is open and has one or more renderable layers.
- Each layer descriptor truthfully reports its current visibility and supported controls.

## Main flow

1. The renovator opens the Layers section in the persistent panel or constrained overlay.
2. The editor lists available layers in a predictable order, initially including the Reference
   plan and room geometry supported by the current model.
3. The renovator changes a layer's visibility.
4. The canvas updates its projection while keeping underlying domain records unchanged.
5. The renovator can identify unavailable controls separately from a valid empty layer.

## Extensions

- **2a** — A future semantic layer is not implemented. It is absent or explicitly unavailable,
  never presented with invented records or counts.
- **3a** — The Reference plan is locked. Visibility remains available, while placement changes
  require the explicit reference-plan workflow.
- **3b** — Opacity or lock is unsupported by the current persisted contract. The control is not
  rendered as if it worked.
- **4a** — The selected entity is hidden with its layer. Selection remains one shared identity
  and the list/Inspector route explains or clears the visual focus predictably.
- **4b** — The leaf becomes constrained. The same layer controls move into the overlay without
  resetting their values.

## Guarantee

Changing layer presentation never deletes, edits or reclassifies a renovation record, and an
unsupported layer capability is never represented as supported-but-empty.

## Out of scope

- Defining Existing, Planned, Work, Materials, Costs, Evidence or Review domain records.
- Reference-plan import, crop, calibration or replacement.
- Grid and snapping settings.
- Product-specific colors or a theme switch.

## Acceptance criteria

1. Available layers have stable order, labels and visibility state.
2. Toggling visibility changes only the canvas projection.
3. Reference plan and semantic state are not conflated into one layer concept.
4. Unsupported controls and empty supported layers have different states.
5. Layer controls are keyboard operable and survive full/constrained layout changes.
6. Layer meaning uses labels, patterns or markers where color alone would be ambiguous.
7. Current layer persistence remains compatible until consolidation and an ADR approve change.

## Assumptions

- The initial catalogue is capability-driven and grows with later Features.
- Current sidecar layer names and settings are retained where they can represent the approved
  interaction truthfully.
- Feature A supplies the workflow and container, not every future semantic layer.

## Sources

- [M00 — Kitchen Selected Overview](../user-experience/renovation-planner-editor-specs/screens/M00-kitchen-selected-overview.md)
- [M01 — Standard Plan View](../user-experience/renovation-planner-editor-specs/screens/M01-standard-plan-view.md)
- [M16 — Constrained Workspace](../user-experience/renovation-planner-editor-specs/screens/M16-constrained-workspace.md)
- [Editor component library: Property and layer components](../user-experience/renovation-planner-editor-specs/components/component-library.md)
