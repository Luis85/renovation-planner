---
type: PBI
parent: "[[Construction sections]]"
order: 20
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

# Spatial assignment

## Actor

[[Private renovator]] locating a renovation job in the spaces where it will be carried out.

## Preconditions

- A construction section exists.
- At least one zone exists on a project plan.

## Main flow

1. The renovator opens the construction section's spatial scope.
2. The plugin lists zones from the project, including zones on plans other than the currently open
   plan.
3. The renovator selects one or more zones.
4. The plugin links the section to those zones by their stable identities.
5. The section exposes spatial quantities from the linked zones' current geometry without storing
   a second copy of that geometry.
6. The assignment is visible from both the section and each linked zone.

## Extensions

- **2a** — No zones exist. The plugin explains that a zone must be created before one can be
  assigned and writes nothing.
- **3a** — A selected zone is already assigned. The existing link is kept and no duplicate link
  is created.
- **4a** — A selected zone no longer exists or cannot be read. That link is refused or identified
  as broken; no geometry is copied to make the assignment appear valid.
- **4b** — Persisting any requested link fails. The failure is reported and the section is not
  shown with links that were not saved.
- **5a** — A linked zone's geometry changes. The next section reading uses the changed geometry
  and derived quantities without reassigning the zone.
- **6a** — The renovator removes an assignment. Only the link is removed; the zone and its geometry
  remain unchanged.

## Guarantee

Spatial assignment records references between one construction section and existing zones,
including zones across several plans; it never creates, owns or copies zone geometry.

## Out of scope

- Creating or editing zone geometry.
- Copying a zone between plans.
- Defining quantity, waste or cost formulas from spatial measures.
- Scheduling work separately for each assigned zone.

## Acceptance criteria

1. One section can reference several zones from more than one plan.
2. One zone can be referenced by several construction sections.
3. Every assignment persists zone identity rather than geometry.
4. Editing a linked zone changes the section's next derived spatial reading without changing the
   assignment.
5. Reassigning an already linked zone creates no duplicate.
6. Removing an assignment deletes neither the zone nor its geometry.
7. A missing or unreadable zone cannot be replaced silently with copied or stale geometry.

## Assumptions

1. A section's spatial scope is the set of its zone references, not a new geometry aggregate.
2. The section reads quantities from the existing zone authority; this PBI introduces no competing
   measurement formula.
3. Cross-plan assignment is limited to plans in the same renovation project.

## Sources

- PRD §16 (spatial assignment).
- PRD §80 (Cross-Plan Relationships).
- PRD §8 (Spatial Model).
- [[Construction sections]].
- [[Zones and spatial objects]].
