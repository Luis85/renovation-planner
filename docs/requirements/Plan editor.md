---
type: Epic
order: 20
status: Active
started: 2026-09-01
finished: ""
horizon: MVP
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

# Plan editor

The Plan editor is the spatial renovation workspace inside an Obsidian leaf. It brings the
property context, floor plan, renovation meaning and planning records together without becoming
a separate application shell.

Its job is:

> When a private renovator needs to understand or change part of a property, help them work from
> the floor plan, connect each spatial thing to what exists, what should change and what work
> follows, and keep the same information reachable through non-canvas routes.

The epic owns the editor workflows and their trust contract. It does not own the underlying
project, schedule, procurement or evidence domains; it projects those capabilities in spatial
context as their Features arrive. The first release preserves the current persisted model until
[[Consolidate the current and target editor data models]] and its ADRs approve a change:
`Plan` presents as **Floor**, and a `Zone` classified as a room presents as **Room**.

Its Feature children are exactly:

1. [[Editor foundation]]
2. [[Spatial creation]]
3. [[Renovation semantics]]
4. [[Planning depth]]
5. [[Release hardening]]
6. [[Zones and spatial objects]]
7. [[Calibration and measurement]]
8. [[Construction sections]]

The first five follow the approved A–E delivery sequence. The final three retain their domain
authority and non-canvas obligations while being consolidated under the Plan editor epic; this
placement does not make their rules presentation-owned.

## Definition of done

An item beneath this epic is done when:

- The editor opens and behaves as an Obsidian-native workspace leaf in inherited themes and
  constrained desktop layouts.
- Select is the safe default, creation is temporary, and navigation gestures do not become
  persistent editing modes.
- Canvas, lists and Inspector resolve the same stable entity identity.
- Spatial changes use completed reversible commands; transient pointer movement never writes.
- Existing, Planned and Work remain separate concepts and unsupported Inspector sections are
  distinguishable from supported sections with no records.
- Every essential entity and action has a keyboard-accessible non-canvas route with visible
  focus and no colour-only meaning.
- Successful state survives vault round trips; failures retain the last trustworthy projection
  and never replay a successful write.
- Feature A through E acceptance journeys and the consolidated domain guarantees are traced to
  their source specifications.

## Sources

- [Editor design specification set](../user-experience/renovation-planner-editor-specs/README.md)
- [Vertical-slice plan and data-model specification](../user-experience/renovation-planner-editor-specs/Renovation%20Planner%20—%20First%20Vertical%20Slice%20Plan%20and%20Data-Model%20Specification.md)
- [Editor implementation plan](../user-experience/renovation-planner-editor-specs/implementation/implementation-plan.md)
- [Editor component library](../user-experience/renovation-planner-editor-specs/components/component-library.md)
