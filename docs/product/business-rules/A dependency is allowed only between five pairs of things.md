---
rule: BR-REL-001
kind: constraint
name: A dependency is allowed only between five pairs of things
area: relationships
sources:
  - PRD §77
  - PRD §78
type: business-rule
---

# A dependency is allowed only between five pairs of things

**The rule.** §77 names the pairs, and no others are modelled:

```text
Work package → Work package
Task         → Task
Procurement  → Work package
Decision     → Work package
Milestone    → Work package
```

§78's initial types are three, and they do different things: **Finish-to-Start** is the only one
that moves dates; **Blocking** changes status; **Informational** changes nothing and exists to be
read ([[Dependency]]).

**Why.** An unconstrained dependency graph over every entity is a scheduler nobody can reason about
and a cycle nobody can prevent. These five pairs are the ones a renovation actually has: the tiles
must arrive before the tiling (procurement → work package), the tile has to be chosen before it can
be ordered (decision → work package), and the inspection gates the trade behind it (milestone →
work package).

Naming the pairs is also what makes the type distinction enforceable — *only Finish-to-Start moves
dates* is a rule about a schedule, and it needs to be clear which edges reach the schedule at all.

**Where it holds.** `domain/schedule`. A cycle is invalid and is refused **at the point it would be
created**, not discovered later by a scheduler that fails to terminate — and references are by
stable `id`, so a dependency pointing at a deleted note is exactly the dangling reference
[[Four kinds of reference failure are detected by name]] requires be found.

**Checked by.** Not yet.

**Sources.** PRD §77 · PRD §78.
