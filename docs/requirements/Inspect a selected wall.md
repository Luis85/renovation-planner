---
type: PBI
parent: "[[Editor foundation]]"
order: 120
status: New
horizon: "MVP"
release: "[[MVP]]"
dependsOn: "[[Walls and hosted openings]]"
---

# Inspect a selected wall

## Actor

[[Private renovator]] trying to understand one wall and its renovation implications in the
context of the current floor.

## Preconditions

- [[Walls and hosted openings]] provides stable Wall and Opening identities and canonical
  read paths.
- One readable wall on the current floor is selected by stable ID.
- The wall overview query can report capability availability independently from collection
  emptiness.
- The same wall is reachable through a non-canvas list route.

## Main flow

1. The Wall Inspector opens for the selected stable Wall identity.
2. It shows normalized length, height and thickness, with unavailable states for measurements
   the current records cannot supply.
3. It names the adjacent rooms and lists hosted openings from canonical relationships.
4. It presents truthful Existing, Planned and Work summaries for the wall.
5. It presents Materials, Costs and Evidence summaries from their canonical authorities.
6. The renovator follows an available summary or returns focus to the wall without changing the
   selection or viewport.

## Extensions

- **2a** — A measurement is unsupported or unreadable. It is unavailable or failed, never a
  fabricated zero.
- **3a** — The wall bounds only one room or no readable room. The relationship is shown as
  exterior, unresolved or unavailable according to the read result; no adjacent room is invented.
- **3b** — The wall has no hosted openings. The supported openings result is empty and remains
  distinct from an unavailable openings capability.
- **4a** — A semantic summary is supported but has no records. It shows a truthful empty state.
- **5a** — A linked authority is unavailable, stale or unreadable. That summary carries its own
  state without suppressing the wall measurements or other available sections.
- **6a** — The wall disappears after selection. The selection is retired and the loss is
  reported; another wall is not chosen by label or position.

## Guarantee

The Inspector describes exactly the selected Wall identity using only successfully read
measurements and canonical relationships. Empty, unavailable, stale and failed are distinct,
and canvas, list and Inspector never disagree about which wall is selected.

## Out of scope

- Creating, moving, resizing, deleting or changing the renovation state of a wall.
- Adding or editing hosted openings.
- Defining wall assemblies, structural analysis or demolition quantities.
- Creating material, cost, work or evidence records from the Inspector.

## Acceptance criteria

1. Wall heading, canvas highlight, list state and Inspector DTO share one stable Wall ID.
2. Length, height and thickness use normalized values and never present unsupported data as zero.
3. Adjacent rooms and hosted openings resolve through canonical identities and preserve
   unresolved relationships honestly.
4. Existing, Planned, Work, Materials, Costs and Evidence each distinguish unavailable from a
   supported empty summary.
5. A stale or failed linked summary cannot make other successfully read wall facts disappear.
6. Every selectable wall has a keyboard-accessible list route to the same Inspector.
7. Constrained presentation and summary drill-down preserve wall selection and floor viewport.

## Assumptions

- Wall and Opening persistence and referential integrity are owned by
  [[Walls and hosted openings]].
- Renovation, work, material, cost and evidence Features remain the authorities for their
  records; this PBI consumes summaries and creates no editor-owned copies.
- Missing height or thickness is a capability/data state, not a value of zero.
- Single selection is sufficient for this workflow; aggregate wall inspection belongs to
  multi-selection.

## Sources

- [M07 — Wall Selected](../user-experience/renovation-planner-editor-specs/screens/M07-wall-selected.md)
- [M00 — Kitchen Selected Overview](../user-experience/renovation-planner-editor-specs/screens/M00-kitchen-selected-overview.md)
- [Editor component library: WallInspector and EntityInspector](../user-experience/renovation-planner-editor-specs/components/component-library.md)
- [Editor interaction specification: Wall and Inspector models](../user-experience/renovation-planner-editor-specs/Renovation%20Planner%20%E2%80%94%20Editor%20Interaction%20%26%20Mental%20Model%20Specification.md)
