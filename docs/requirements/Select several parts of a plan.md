---
type: PBI
parent: "[[Editor foundation]]"
order: 80
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

# Select several parts of a plan

## Actor

[[Private renovator]] applying one safe shared action to several spatial records.

## Preconditions

- A floor is open with at least two selectable records.
- Single selection and its canvas/list identity contract are working.
- Compatibility rules exist for each offered batch action.

## Main flow

1. The renovator adds compatible records to selection from the canvas or alternative list.
2. The editor stores an ordered set of stable IDs and types without duplicating an identity.
3. Canvas badges and list rows make every selected member identifiable.
4. The Inspector shows only shared properties, explicit mixed values and valid aggregate
   measurements.
5. The renovator chooses an available shared action.
6. After confirmation where required, one composite reversible command applies it as one user
   action.

## Extensions

- **1a** — The renovator selects an already selected record. It is removed without disturbing
  the remaining order.
- **1b** — Keyboard additive selection performs the same operation as Shift-click.
- **4a** — Values differ. The Inspector labels them mixed and never presents one member's value
  as shared.
- **5a** — The selected types are incompatible with an action. The action is disabled with a
  reason.
- **6a** — Referential impact is destructive. A summary names affected records before consent.
- **6b** — Any step of the composite write fails. Compensation restores the pre-action state or
  a persistent recovery state reports what remains.

## Guarantee

Selection alone writes nothing. A batch action is offered only for a defined compatible set and
either commits as one reversible user action or leaves an explicit recoverable state; mixed data
is never shown as uniform.

## Out of scope

- Defining renovation-specific batch actions owned by later Features.
- Lasso selection or arbitrary geometry grouping.
- Persisting a selection set across sessions.
- Collaboration or approval semantics.

## Acceptance criteria

1. Canvas and list add/remove the same stable identities.
2. A selected identity appears at most once and order remains deterministic.
3. Mixed properties and shared properties are visually and programmatically distinct.
4. Unsupported combinations disable actions with an explanation.
5. Numbered canvas badges match list members without relying on color.
6. A composite batch command undoes and redoes as one action.
7. Escape clears the set and returns to the Standard Plan View.

## Assumptions

- Multi-selection extends the same shared selection authority as single selection.
- The foundation supplies the generic workflow; concrete renovation actions arrive with their
  owning domains.
- Atomicity and compensation follow the existing command/repository contracts.

## Sources

- [M11 — Multi-Selection](../user-experience/renovation-planner-editor-specs/screens/M11-multi-selection.md)
- [Editor implementation plan: Phase 2](../user-experience/renovation-planner-editor-specs/implementation/implementation-plan.md)
- [Editor component library: MultiSelectionOverlay and action bar](../user-experience/renovation-planner-editor-specs/components/component-library.md)
