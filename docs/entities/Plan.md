---
name: Plan
layer: domain
persistence: note + sidecar
partOf: "[[Project]]"
sources:
  - PRD §8
  - PRD §13
  - PRD §38
  - PRD §59
  - PRD §79
  - PRD §82
  - SDD §39
  - SDD §40
type: entity
---

# Plan

A spatial representation of part of the [[Project]]: a background image, a scale, a coordinate
system, and the [[Spatial object]]s drawn on it. §8's examples are property, ground floor,
first floor, basement, garden, garage.

The plan is where §3.4 becomes real — geometry drives planning, so the plan is upstream of
quantities, costs and work rather than an illustration beside them. Two things it owns that
nothing else can:

- **Calibration** (§82). A background image arrives with no scale; the user draws a line of
  known length and every measurement on the plan derives from that. An uncalibrated plan can
  be drawn on but its quantities are meaningless, which is a state the model has to be able
  to express rather than a bug.
- **The coordinate system.** §23 fixes world coordinates in millimetres, so geometry is never
  stored in canvas pixels (§38).

## Identity and persistence

Split across two files, which is ADR-002 and SDD §39: a **note** carrying name, the
background reference, the layer names, the owning project and the stable `id`, plus a
**geometry sidecar** (SDD §40) holding the [[Spatial object]] points. Geometry is verbose,
machine-written and useless to a human reader, so it stays out of the Markdown that is
meant to be read.

**`calibration` is in the sidecar, not the note**, even though the section above calls it
one of the two things a plan owns — owning it and storing it are different questions.
Recalibrating rewrites the calibration *and* every rescaled object's geometry, and those
have to land as one write; split across two files it is the plan's own hazard below,
applied to the one value every measurement on the plan derives from. Slice 4 declares the
field on the sidecar schema and slice 7 fills it in. The note carries no `scale` key
either — the calibration is what establishes scale, so a second stored answer to it could
only disagree.

The sidecar is named by the plan's full `id` and lives in a `Geometry/` folder inside the
project's own folder —
`Geometry/plan-01JABB3C5D7E9F1G3H5J7K9M1N.rpgeo`, per ADR-011, not the
`Ground Floor.geometry.json` beside the note that ADR-002 and SDD §39 first drew.

The pairing is the plan's main hazard: two files, no transaction (SDD §42), and a rename by
[[Another editor on the vault]] can separate them. The sidecar carries the `planId`, not a
path, for exactly that reason.

## Relationships

- Belongs to exactly one [[Project]] (§59).
- Contains 0..n [[Layer]] and 0..n [[Spatial object]].
- Depicts part of a [[Site]], [[Building]], [[Floor]] or [[Outdoor area]] — a depiction, not
  ownership.
- Versioned by [[Plan revision]].
- A [[Construction section]] may span several plans (§80).

## Rules

- Geometry is stored in millimetres in world coordinates, never in pixels (§38, §23).
- Internal precision and display precision are separate (§71): 42718432 mm² is stored,
  42.72 m² is shown.
- The sidecar is derived-format but not derived data — it is canonical geometry in a second
  file, and losing it loses work.

## Business rules that reach this entity

[[World coordinates are millimetres, converted once at the engine boundary]] · [[Internal precision and display precision are separate]] · [[An uncalibrated plan never presents a measurement as true]]

## Sources

PRD §8 · PRD §13 · PRD §38 · PRD §59 · PRD §79 · PRD §82 · SDD §39 · SDD §40, in
[`docs/prds/obsidian-renovation-planner.md`](../prds/obsidian-renovation-planner.md) and
[`docs/sdds/obsidian-renovation-planner-SDD.md`](../sdds/obsidian-renovation-planner-SDD.md).
