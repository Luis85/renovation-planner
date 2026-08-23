---
kind:
name: Construction section
layer: domain
persistence: note
partOf: "[[Project]]"
sources:
  - PRD §8
  - PRD §16
  - PRD §10
  - PRD §58
  - PRD §59
  - PRD §80
type: entity
---

# Construction section

A grouping of related measures — *BA-01 Roof*, *BA-02 Bathroom*, *BA-03 Terrace*, *BA-04 Front
Garden*. §8 gives it status, priority, phase, zones, trades, work packages, budget, actual
costs and planned dates.

It is the level at which a renovation is *decided about*. A [[Zone]] is where things are, a
[[Work package]] is what gets done, and the section is the chunk a renovator postpones,
prioritises, budgets or drops as a unit — which is why it carries both a budget and a phase
while neither of its neighbours does. §10's cost hierarchy puts it directly under the
[[Project]] and above the work package.

Its subtlety is that it cuts *across* the spatial hierarchy rather than sitting inside it.
§59 says it may span multiple [[Zone]]s and §80 says it may span multiple [[Plan]]s: "the
roof" is one section over two buildings, and "the bathroom" is one section covering part of
one zone. A section that could only contain one zone would collapse into the zone.

## Identity and persistence

A Markdown note (§36, §37) with a stable `id` (§60), status, priority, phase and planned
dates in frontmatter, so [[Bases]] can group by any of them.

## Relationships

- Belongs to exactly one [[Project]] (§59).
- Spans 0..n [[Zone]], across 0..n [[Plan]] (§80).
- Contains 0..n [[Work package]].
- Involves 0..n [[Trade]], derived from its work packages rather than set twice.
- Carries a budget, aggregating [[Cost item]]s beneath it (§10).
- May appear on a [[Plan]] as a PlanningZone [[Spatial object]] (§34).

## Rules

- The budget here is a *ceiling set by a human*; the estimate beneath it is *computed*. §11
  keeps them as separate cost types precisely so the comparison is possible.
- Actual cost, estimated cost and progress are all derived from the work packages (§88), never
  entered on the section itself.
- Dates are planned at this level and actual at [[Task]] level; a section's real dates are
  derived.

## Sources

PRD §8 · PRD §16 · PRD §10 · PRD §58 · PRD §59 · PRD §80, in
[`docs/prds/obsidian-renovation-planner.md`](../prds/obsidian-renovation-planner.md) and
[`docs/sdds/obsidian-renovation-planner-SDD.md`](../sdds/obsidian-renovation-planner-SDD.md).
