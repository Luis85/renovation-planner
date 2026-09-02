---
type: PBI
parent: "[[Planning depth]]"
order: 10
status: New
horizon: "V1"
release: ""
dependsOn:
  - "[[Geometry-linked quantities]]"
  - "[[Searchable asset catalog]]"
  - "[[Package sizes and purchase quantities]]"
---

# Manage materials from spatial context

## Actor

[[Private renovator]], while reviewing what a selected room, wall or area needs.

## Preconditions

- A spatial target is selected in the plan editor.
- The authoritative asset and requirement services are available.
- Any calculated need has a geometry or work source that the quantity authority can explain.

## Main flow

1. The renovator opens Materials for the selected spatial target.
2. The editor queries the authoritative requirements and quantity calculations for that target.
3. The Inspector groups the returned needs by their related work and distinguishes calculated,
   overridden and manual quantities.
4. The renovator selects a row and sees its unit, waste input, effective need and calculation
   provenance.
5. The selected row reveals its related surface or work marker on the plan.
6. The renovator may add or link a material need with the current spatial target prefilled.
7. The editor dispatches the canonical material command and refreshes from the authoritative
   result.
8. Where purchase quantities are available, the renovator can follow the need to the procurement
   authority.

## Extensions

- **2a** — The query fails. Existing spatial context remains visible and the failure is surfaced;
  no empty material list is presented as an authoritative answer.
- **2b** — No material need is linked. The Inspector explains that state and offers the contextual
  add/link action.
- **3a** — A need uses a unit incompatible with its source. The row is marked unresolved and no
  quantities are combined.
- **4a** — A calculated input is stale. The editor labels it stale and follows the calculation
  authority's recovery path rather than calculating in Vue or Pinia.
- **6a** — The command refuses the proposed link or value. The draft and spatial selection remain
  available for correction.
- **8a** — Procurement capability is unavailable. The authoritative material need remains
  viewable; the editor does not invent purchase or delivery state.

## Guarantee

Every quantity shown for the selected context is either an authoritative calculated value with
visible provenance or an explicitly labelled manual/override value; the editor never maintains a
second material calculation.

## Out of scope

- Full supplier research, quote selection, ordering, delivery and inventory tracking.
- Execution consumption and as-built material records.
- A second asset catalogue scoped to the Inspector.
- Calculating quantity, waste, package or cost values in Vue or Pinia.

## Acceptance criteria

1. Selecting a spatial target lists only requirements authoritatively linked to that context.
2. A geometry-derived row identifies its source geometry/work, formula inputs, unit and waste
   contribution without relying on hover.
3. Changing authoritative geometry and refreshing changes the displayed need without an
   Inspector-owned calculation.
4. Calculated, overridden and manual quantities are visibly and accessibly distinguishable.
5. An incompatible unit is never silently combined with another quantity.
6. Adding a need from the Inspector sends the selected spatial id through the canonical command
   and the subsequent display comes from a query.
7. Procurement navigation opens the owning capability; the Inspector stores no purchase,
   delivery or quote-comparison state.

## Assumptions

1. V1 supports contextual viewing, linking and the handoff to procurement, not full procurement
   inside the editor.
2. Stable material markers are optional when the same relationship can be reached through the
   accessible list.
3. The asset catalogue remains vault-authoritative and reusable outside the current plan.

## Sources

- [[M12-room-materials]]
- [Renovation Planner — Editor Component Library](../user-experience/renovation-planner-editor-specs/components/component-library.md)
- [[Renovation Planner — Editor Interaction & Mental Model Specification]]
- [[Renovation Planner — Editor UX Research & Pattern Study]]
- [Renovation Planner — Editor Implementation Plan](../user-experience/renovation-planner-editor-specs/implementation/implementation-plan.md)
- [[Geometry-linked quantities]]
- [[Asset library]]
- [[Suppliers, quotes and procurement]]
