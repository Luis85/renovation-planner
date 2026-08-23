---
kind: entity
name: Plan
layer: domain
persistence: note + sidecar
partOf: "[[Project]]"
sources: ["PRD §8", "PRD §13", "PRD §38", "PRD §59", "PRD §79", "PRD §82", "SDD §39", "SDD §40"]
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

Split across two files, which is ADR-002 and SDD §39: a **note** carrying name, background,
scale, calibration and the stable `id`, plus a **geometry sidecar** (`Ground Floor.geometry.json`,
SDD §40) holding the [[Spatial object]] points. Geometry is verbose, machine-written and
useless to a human reader, so it stays out of the Markdown that is meant to be read.

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

## Sources

PRD §8 · PRD §13 · PRD §38 · PRD §59 · PRD §79 · PRD §82 · SDD §39 · SDD §40, in
[`docs/prds/obsidian-renovation-planner.md`](../prds/obsidian-renovation-planner.md) and
[`docs/sdds/obsidian-renovation-planner-SDD.md`](../sdds/obsidian-renovation-planner-SDD.md).
