---
rule: BR-COST-004
kind: derivation
name: A cost rollup is derived along its axis, never stored
area: cost
sources:
  - PRD §10
  - PRD §88
type: business-rule
---

# A cost rollup is derived along its axis, never stored

**The rule.** §10 names seven aggregation axes — project, construction section, zone, trade, work
package, asset, supplier. A total along any of them is computed from the [[Cost item]]s that roll
into it, on read. No total is persisted in frontmatter.

**Why.** The seven axes overlap: one cost item contributes to a [[Work package]] total, a
[[Trade]] total, a [[Zone]] total and the [[Project]] budget simultaneously. Storing any of them
means one edit has to update several places atomically, and the first missed update is a total
that looks authoritative and is wrong. This is the general rule
[[A derived value is recomputed on read, not persisted]], applied where the arithmetic is most
tempting to cache.

**Where it holds.** The cost engine in `domain/cost`. [[Work package]] states the same rule from
its own side — its estimate is the sum of its cost items, not an independent number.

**Checked by.** Not yet. Slice 09's aggregation tests.

**Sources.** PRD §10 · PRD §88.
