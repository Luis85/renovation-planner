---
rule: BR-REL-002
kind: constraint
name: Every entity resolves to exactly one project
area: relationships
sources:
  - PRD §59
  - PRD §80
type: business-rule
---

# Every entity resolves to exactly one project

**The rule.** §59's ownership statements, as one rule: a [[Project]] owns 0..n plans, construction
sections, work packages, assets, suppliers and documents; a [[Plan]] belongs to **exactly one**
project; a [[Spatial object]] belongs to one plan; a [[Construction section]] belongs to one project
and may span multiple zones and work packages; a [[Work package]] belongs to one project, optionally
one construction section, and at least one domain scope.

**There is no cross-project reference.**

**Why.** One currency, one plan set, one budget, one folder. A reference that crossed projects would
make every rollup ambiguous ([[A cost rollup is derived along its axis, never stored]]) and would
make deleting a project a graph problem rather than a folder operation — which is why [[Project]]
does not model its own deletion at all: that is deleting the folder, and the folder belongs to
[[The vault]] and its owner.

**What this is not.** It is not one plan per project. §79's multi-plan model is explicit — floors,
site plans and detail plans coexist, and §80's cross-plan relationships stay *within* the project.
"Exactly one project" is the boundary; "one plan" is not.

**Where it holds.** Every entity's frontmatter carries its project id, and every repository query is
project-scoped.

**Checked by.** Not yet. Slice 03 establishes Project/Plan/Zone; slice 04 the repositories.

**Sources.** PRD §59 · PRD §79 · PRD §80.
