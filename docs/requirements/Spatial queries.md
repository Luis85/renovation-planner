---
type: Feature
parent: "[[Zones and spatial objects]]"
order: 40
status: ""
started: ""
finished: ""
horizon: "V2"
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
---

# Spatial queries

§15 lists spatial queries and §50 puts them in V2, which is the right order: the questions worth
asking — what is inside this zone, what does this construction section touch, which assets are in
the wet rooms — only become interesting once there is enough in the model to answer them
non-trivially.

The reason it is a feature rather than an implementation detail is that it is what makes geometry
*queryable* rather than merely drawn, and it is the mechanism [[Spatial markers]] and the
assignment features lean on instead of each hand-rolling containment.

## Outcome

A renovator can ask what is inside, touching or overlapping any area and get an answer from the
plan.
