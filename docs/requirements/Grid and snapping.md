---
type: Feature
parent: "[[Plan editor]]"
order: 30
status: ""
started: ""
finished: ""
horizon: "MVP"
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
---

# Grid and snapping

§13's grid and snapping. These look cosmetic and are not: a polygon whose corners nearly meet
produces an area that is nearly right, and that error is invisible on screen and arrives later as
a tile order. Snapping is how a non-draughtsman draws a closed shape.

Because it changes the geometry that gets stored, the snap has to happen in world units rather
than screen pixels, or the result depends on the zoom level at which somebody happened to be
working.

## Outcome

A renovator drawing by hand gets shapes that close properly and quantities they can rely on.
