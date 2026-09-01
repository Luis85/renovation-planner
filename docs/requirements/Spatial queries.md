---
type: PBI
parent: "[[Zones and spatial objects]]"
order: 40
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

# Spatial queries

§15 lists spatial queries and §50 puts them in V2, which is the right order: the questions worth
asking — what is inside this zone, what does this construction section touch, which assets are in
the wet rooms — only become interesting once there is enough in the model to answer them
non-trivially.

The reason it is a PBI rather than an implementation detail is that it is what makes geometry
*queryable* rather than merely drawn, and it is the mechanism [[Spatial markers]] and the
assignment features lean on instead of each hand-rolling containment.

## Actor

[[Private renovator]], asking how objects and areas relate on a plan.

## Preconditions

- The plan contains spatial objects and an area against which to ask the question.
- The V2 spatial-query capability is available (§50).

## Main flow

1. The renovator chooses an area on the plan.
2. The renovator asks which spatial objects are inside it.
3. The product evaluates the plan's spatial model.
4. The product returns the objects inside the chosen area.
5. The answer is available to features such as [[Spatial markers]] and spatial assignment
   without each feature defining containment for itself.

## Extensions

- **2a** — The renovator asks which objects touch the area. The product returns the objects that
  touch it.
- **2b** — The renovator asks which objects overlap the area. The product returns the objects
  that overlap it.
- **4a** — No object satisfies the requested relationship. The answer is empty rather than
  containing an object that does not satisfy it.

## Guarantee

The answer contains only objects that satisfy the requested inside, touching or overlapping
relationship against the chosen area.

## Out of scope

- Creating or editing the queried geometry.
- The presentation and assignment behaviour of features that consume a query.
- Bringing spatial queries into the MVP; PRD §50 places them in V2.

## Acceptance criteria

1. A renovator can query which objects are inside a chosen area.
2. A renovator can query which objects touch a chosen area.
3. A renovator can query which objects overlap a chosen area.
4. Each answer excludes objects that do not satisfy the requested relationship.
5. A query with no matches returns an empty answer.
6. [[Spatial markers]] and assignment features can consume the same spatial-query behaviour
   rather than defining containment independently.

## Assumptions

1. This PBI does not define the query interface, spatial algorithm or presentation.
2. “Inside”, “touching” and “overlapping” are the relationships required here; further spatial
   relations need separate product decisions.

## Sources

PRD §15 (spatial queries) and PRD §50 (V2 Scope — Advanced Planning).
