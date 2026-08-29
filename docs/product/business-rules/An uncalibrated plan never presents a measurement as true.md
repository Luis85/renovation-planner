---
rule: BR-SPATIAL-003
kind: constraint
name: An uncalibrated plan never presents a measurement as true
area: spatial
sources:
  - PRD §82
  - PRD §14
  - SDD §25
type: business-rule
---

# An uncalibrated plan never presents a measurement as true

**The rule.** Drawing on an uncalibrated [[Plan]] is allowed — `calibration` is `null` and the
placeholder scale is one background-image pixel to one world millimetre. What is **not** allowed is
showing a number from it as a measurement: a plan that has not been calibrated says so wherever a
measurement would otherwise appear.

Calibration is two points and one known distance (§82) — a measurement a renovator can actually
take with a tape against a wall they can reach.

**Why.** A number with no scale behind it is worse than no number: it is a guess wearing the
formatting of arithmetic, and everything downstream — areas, tile counts, paint quantities, the
budget — inherits it. The placeholder exists so the background renders before calibration is
built, not so it can be read.

The related trap is on the other side: silently reusing a scale after its background image was
replaced produces a plausible, wrong budget, which is the worst available outcome. Calibration
belongs to the plan and survives ordinary editing, **or it is invalidated loudly.**

**Where it holds.** `Plan.calibration: Calibration | null` is the whole distinction; the
presentation layer branches on it rather than formatting whatever the geometry produced.

**Checked by.** Not yet. Slice 07 defines the uncalibrated default and the recalibration
behaviour; the *says so* half is a presentation surface.

**Sources.** PRD §82 · PRD §14 · SDD §25 · slice 07
([`docs/tasks/07-calibration.md`](../../tasks/07-calibration.md)).
