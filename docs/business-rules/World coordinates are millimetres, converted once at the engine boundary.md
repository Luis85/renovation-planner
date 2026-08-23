---
rule: BR-SPATIAL-001
kind: constraint
name: World coordinates are millimetres, converted once at the engine boundary
area: spatial
sources:
  - PRD §70
  - SDD §22
  - ADR-009
type: business-rule
---

# World coordinates are millimetres, converted once at the engine boundary

**The rule.** Length normalizes to mm, area to mm², volume to mm³ (§70). Geometry is persisted in
world millimetres, never in canvas pixels and never in display units. The conversion to `m`/`m²`/
`m³` happens **once**, at the quantity engine's first stage, and nothing downstream converts
again. `piece`, `hour`, `day` and `fixed` quantities pass through unconverted.

**Why.** Pixels are a property of the view: a zoom level, a screen and a background image
resolution all change them, and geometry stored in them silently means something different
tomorrow. One integral unit for each dimension also removes the whole class of defect where two
call sites disagree about whether a stored number was centimetres.

Converting once matters as much as converting at all — a second conversion is either a no-op
nobody can prove or a division applied twice, and both look like ordinary code.

**Where it holds.** `core/geometry` and `core/units` produce and consume mm; `toMeasuredQuantity`
is the single boundary where display units appear. [[Plan]] and [[Spatial object]] state the
persistence side of the same rule.

**Checked by.** Not yet. Every conversion is required to be a function in `domain/` asked by a node
test rather than by a screen — the *Calibration and measurement* epic's own definition of done.

**Sources.** PRD §70 · SDD §22–23 · ADR-009
([`docs/adrs/0009-world-coordinates-in-millimeters.md`](../adrs/0009-world-coordinates-in-millimeters.md)).
