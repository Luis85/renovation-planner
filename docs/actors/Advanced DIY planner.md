---
kind: actor
name: Advanced DIY planner
layer: human
standing: secondary persona
partOf: "[[Private renovator]]"
sources: ["PRD §4", "PRD §24", "PRD §32", "PRD §75", "PRD §76", "PRD §88"]
---

# Advanced DIY planner

Not a different person from the [[Private renovator]] so much as the same person further in,
doing more of the work themselves and so caring about the parts a contractor would otherwise
absorb. §4 lists what they need on top: material requirements, measurements, quantities,
shopping lists, suppliers, price comparisons, dependencies.

This actor is why the material chain is four entities rather than one number. §32 insists
[[Asset]], [[Requirement]], [[Procurement item]] and [[Cost item]] stay separate concepts,
and it is this actor who feels the separation: they are the one who buys 47.52 m² because
tiles come in boxes, having calculated that 46.2 m² is required, and knowing 43.8 m² will
actually go down. Collapsing those would be wrong for everyone but *visibly* wrong only here.

## What it does to the plugin

- Drives the quantity pipeline (§75) end to end, and notices when a step is missing.
- Compares [[Quote]]s from different [[Supplier]]s and expects the comparison to be like for
  like.
- Cares about [[Dependency]] ordering, because they are the constraint: one person cannot
  tile and wire on the same day.
- Tracks remaining material (§76), because leftovers are theirs to store or reuse.

## What the plugin owes it

- Purchase quantities that account for package sizes and minimum order quantities (§24), not
  a rounded requirement.
- A shopping list that is a real output rather than a report.
- Every derived quantity traceable to the geometry that produced it (§88), so a number they
  doubt can be checked rather than merely re-read.

## Sources

PRD §4 · PRD §24 · PRD §32 · PRD §75 · PRD §76 · PRD §88, in
[`docs/prds/obsidian-renovation-planner.md`](../prds/obsidian-renovation-planner.md) and
[`docs/sdds/obsidian-renovation-planner-SDD.md`](../sdds/obsidian-renovation-planner-SDD.md).
