---
type: PBI
parent: "[[Architecture and Software Design]]"
order: 30
status: Active
started: 2026-08-25
finished: ""
horizon: Now
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: "[[1 - Iteration]]"
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
# Quantity, cost and the end-to-end loop

Slices 9 and 10: geometry becomes a quantity, a quantity becomes a cost, and the whole chain
is wired together on real entities.

| Slice | Increment | Primary SDD sections |
| --- | --- | --- |
| [9 — Quantity & Cost Engine](../tasks/09-quantity-and-cost-engine.md) | 7 (part) | §48–52; ADR-010 |
| [10 — Assets, Requirements & the End-to-End Loop](../tasks/10-assets-requirements-and-the-end-to-end-loop.md) | 7 (part) | wiring; PRD §8, §9 |

**Slice 9 depends on slice 2, not on slice 4.** `Money`, `Quantity`, `UnitKind` and
`MeasurementUnit` are pure, so the engine can be built and tested against the primitives
alone, in parallel with everything in *Plan editor and canvas*. It is grouped here because
of what consumes it, not because of what it waits for.

**Slice 10 is an integration point, and that is its whole character.** It introduces no new
architecture; it wires slices 4, 8 and 9 into the
`Zone Geometry → Area → Requirement → Cost` loop the SDD's Increment 7 describes. Its
dependency list is therefore the union of three groups' outputs rather than a chain, and it
is the last thing in the MVP architecture to land.

## Outcome

Drawing a zone changes a number a user cares about: an area becomes a requirement, a
requirement becomes a cost, and editing the geometry moves the cost — through the same
repositories and the same command history as everything else.
