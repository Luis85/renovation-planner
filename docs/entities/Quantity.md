---
kind: entity
name: Quantity
layer: core
persistence: none
sources: ["PRD §9", "PRD §70", "PRD §71", "PRD §75", "SDD §23", "SDD §50", "ADR-009"]
---

# Quantity

A number with a unit. §9's vocabulary: piece, m, m², m³, hour, day, fixed. §70's dimensions:
length, area, volume, quantity, duration.

Like [[Money]], a value object rather than an entity — no id, no note, no lifecycle — and listed
here for the same reason: it is a business concept with a rule that has to hold everywhere.

**Two separations carry it.** The first is §70 and ADR-009: internal units are normalised —
length in mm, area in mm², volume in mm³ — because geometry arrives in world coordinates
measured in millimetres, and a model that stored metres would be converting on every read. The
second is §71: **internal precision and display precision are different things.** 42718432 mm²
is what is stored; 42.72 m² is what is shown. Rounding the stored value to what looks tidy on
screen loses area that reappears as a discrepancy three aggregations later.

§75's pipeline is a sequence of quantities, each a legitimate different answer to "how much":
calculated → waste-adjusted → required → purchase → delivered → consumed → remaining. Naming
them separately is what stops one being mistaken for another.

## Identity and persistence

None. Stored as part of a [[Requirement]], a [[Procurement item]] or a [[Cost item]], and mostly
derived rather than stored at all (§88).

## Relationships

- Produced by geometry on a [[Spatial object]], via the quantity engine (SDD §50).
- Held by [[Requirement]], [[Procurement item]] and [[Cost item]].
- Multiplied by a unit price to give [[Money]] (SDD §51).

## Rules

- Millimetre-based internal units (§70, ADR-009). Never canvas pixels, never display units.
- Internal and display precision are separate (§71).
- A unit is part of the value. An arithmetic operation between mismatched units is an error, not
  a coercion — *8 pieces* and *8 m²* are not both eight.
- The pipeline stages are distinct quantities. Reusing one where another is meant is the defect
  §32 exists to prevent.

## Sources

PRD §9 · PRD §70 · PRD §71 · PRD §75 · SDD §23 · SDD §50 · ADR-009, in
[`docs/prds/obsidian-renovation-planner.md`](../prds/obsidian-renovation-planner.md) and
[`docs/sdds/obsidian-renovation-planner-SDD.md`](../sdds/obsidian-renovation-planner-SDD.md).
