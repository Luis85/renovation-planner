---
type: PBI
parent: "[[Zones and spatial objects]]"
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

# Polygon drawing

§15's polygon tool: the act of outlining a real area on the plan. §7's geometry types set what a
shape may be and §38 sets how it is stored — world units, never canvas pixels — so this PBI is
where that rule is either honoured or quietly broken for the first time.

It is the product's most-used tool and the one that decides whether the whole premise feels worth
it, because a renovator will draw twenty rooms before they see a single cost.

## Actor

[[Private renovator]], outlining a real area on a plan.

## Preconditions

- A plan is open and ready for spatial editing.
- The area can be represented by §7's initial Polygon geometry.

## Main flow

1. The renovator chooses the polygon tool (§15).
2. The renovator marks the boundary of the real area on the plan.
3. The renovator completes the outline.
4. The product keeps the completed polygon in world units rather than canvas pixels (§7, §38).
5. The completed shape is available for the rest of the product to measure.

## Extensions

- **2a** — The renovator has not completed the outline. No completed polygon is produced yet.
- **3a** — The renovator abandons the drawing. No completed area is produced.

## Guarantee

Every completed outline represents its geometry in world units, never canvas pixels, and can be
measured independently of the current viewport.

## Out of scope

- §7's future geometry types: Circle, Wall, Opening, Path and Compound Polygon.
- Zone type, metadata, notes, links and spatial queries, which are separate PBIs under
  [[Zones and spatial objects]].
- Costs and other downstream uses of a measured shape.

## Acceptance criteria

1. A renovator can complete a polygonal outline of a real area.
2. The completed shape uses world coordinates and does not use canvas pixels as domain
   measurements (§7, §38).
3. An incomplete or abandoned outline is not presented as a completed area.
4. The completed polygon can supply a measurable shape to later product behaviour.

## Assumptions

1. This PBI requires polygon drawing and its world-coordinate result; it does not choose the
   editor interaction, persistence representation or measurement implementation.
2. Areas requiring one of §7's future geometry types remain outside this PBI.

## Sources

PRD §7 (Geometry Types and World Coordinates), PRD §15 (polygon tool) and PRD §38
(Geometry Persistence).
