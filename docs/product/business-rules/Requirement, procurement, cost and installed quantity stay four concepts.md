---
rule: BR-QTY-001
kind: separation
name: Requirement, procurement, cost and installed quantity stay four concepts
area: quantity
sources:
  - PRD §32
  - PRD §59
type: business-rule
---

# Requirement, procurement, cost and installed quantity stay four concepts

**The rule.** §32's five boxes are five different facts about one [[Asset]], and none of them may
be read as another:

```text
Asset                "Porcelain terrace tile"
Requirement          "46.2 m² required"        ← what is needed
Procurement item     "47.52 m² ordered"        ← what was bought
Cost item            "1,661.42 €"              ← what it costs
Installed quantity   "43.8 m² installed"       ← what is in the wall
```

**Why.** Every pair of them is routinely equal and never necessarily equal. Required and ordered
differ by waste and packaging; ordered and installed differ by breakage, offcuts and change; and
a total built by reusing whichever number was to hand is wrong in a way no single figure reveals.
§59 states the load-bearing half explicitly: a [[Procurement item]] *must remain distinct from
the Requirement itself*.

**Where it holds.** Four separate entities, four separate notes, four separate frontmatter
fields. The conversions between them are
[[A quantity flows through seven stages and no stage stands in for another]].

**Checked by.** Not yet. Slice 10 builds the loop end to end and is where a test that reads one
box for another would fail.

**Sources.** PRD §32 · PRD §59.
