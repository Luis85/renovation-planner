---
type: PBI
parent: "[[Zones and spatial objects]]"
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

# Zone types

§15's list — room, garden, terrace, driveway, roof, construction area — ending in Custom, which
§84 makes a real requirement rather than a courtesy. The type is what lets a later epic ask a
useful question: paint applies to a room and not a driveway, and a planting plan applies to
neither.

The rule that carries the PBI is that a type this plugin does not ship must survive being read
and written back unchanged, because the vault is the source of truth and its owner is allowed to
invent vocabulary.

## Actor

[[Private renovator]], describing what kind of place a zone represents.

## Preconditions

- A zone exists.

## Main flow

1. The renovator chooses a zone.
2. The product offers §15's zone types: Room, Garden, Terrace, Driveway, Roof, Construction Area
   and Custom.
3. The renovator chooses the type that describes the place.
4. The product keeps that type with the zone.
5. Later features can use the type to distinguish where their behaviour applies.

## Extensions

- **2a** — The required vocabulary is not one of the types the plugin ships. The renovator uses
  a configurable custom type (§84).
- **4a** — The product reads a type it does not recognise. It preserves the value exactly as
  written when the zone is written back instead of replacing it with a known type.

## Guarantee

A zone's type remains the vocabulary its owner chose, including a type this version of the plugin
does not recognise.

## Out of scope

- Deciding which later features apply to each type.
- Polygon drawing, zone metadata, notes, links and spatial queries.
- A fixed list that prevents vault owners from inventing vocabulary.

## Acceptance criteria

1. A renovator can assign each type listed in PRD §15 to a zone.
2. Zone types are configurable as required by PRD §84.
3. A custom type can be assigned to a zone.
4. Reading and writing a zone with an unrecognised type preserves that type exactly.
5. Assigning a type does not silently substitute a different known type.

## Assumptions

1. The exact controls and storage representation are not decided by this PBI.
2. “Custom” means the vocabulary is extensible; it does not define a separate spatial shape.

## Sources

PRD §15 (zone types and examples) and PRD §84 (Custom Types).
