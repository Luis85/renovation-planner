---
type: Feature
parent: "[[Calibration and measurement]]"
order: 20
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

# Distance and perimeter measurement

§14's distance measurement and perimeter. Perimeter is the more valuable of the two and the less
obvious: skirting, coving, edge trim, wall tiling and cornice are all priced per metre, so a
zone's perimeter is a quantity the product should never make anybody measure by hand.

Both are pure functions of stored geometry and the calibration, which is why they are testable in
`domain/` without a canvas (§44 testability).

## Outcome

A renovator gets the length of anything on the plan, and the perimeter of any zone, without
measuring it again.
