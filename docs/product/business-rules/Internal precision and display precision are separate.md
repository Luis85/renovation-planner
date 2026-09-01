---
rule: BR-SPATIAL-002
kind: separation
name: Internal precision and display precision are separate
area: spatial
sources:
  - PRD §71
type: business-rule
---

# Internal precision and display precision are separate

**The rule.** `42718432 mm²` is what is stored; `42.72 m²` is what is shown. They are the same
fact at two precisions, and **no calculation ever reads the displayed one.**

**Why.** Code that reads the rounded figure back has silently thrown the exact one away, and every
subsequent operation compounds a rounding it did not choose. This is the spatial half of what
[[Money is rounded once, where the pipeline finalizes it]] states for currency — the same rule
about the same mistake, in the dimension where the magnitudes are large enough to hide it.

**Where it holds.** Formatting is a presentation concern and lives there; the domain never holds a
display string. [[Quantity]] and [[Plan]] both state it from their own side.

**Checked by.** Not yet. The [[Calibration and measurement]] Feature's Outcome contract requires
it, and it is a natural lint-shaped rule: the forbidden thing is a formatter's output re-entering
the domain.

**Sources.** PRD §71.
