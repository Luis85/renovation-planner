---
rule: BR-REL-002
kind: constraint
name: Work belongs to one project, catalogues belong to the vault
area: relationships
sources:
  - PRD §59
  - PRD §80
type: business-rule
---

# Work belongs to one project, catalogues belong to the vault

**The rule.** §59's ownership statements, as one rule, and it has two halves.

*Work* resolves to exactly one project: a [[Project]] owns 0..n plans, construction sections, work
packages and documents; a [[Plan]] belongs to **exactly one** project; a [[Spatial object]] belongs
to one plan; a [[Construction section]] belongs to one project and may span multiple zones and work
packages; a [[Work package]] belongs to one project, optionally one construction section, and at
least one domain scope. **Between two projects' work there is no reference.**

*Catalogues* belong to the vault: [[Asset]], [[Supplier]] and [[Trade]] are defined once, in §36's
`Library/` beside the project folders, and **any project may reference any of them**. A catalogue
entry has no owning project, so "which project is this tile in" is not a question with an answer.

**Why the line falls there.** The first half protects a rollup and a deletion: a reference between
two projects' *work* would make every total ambiguous
([[A cost rollup is derived along its axis, never stored]]) and would make deleting a project a
graph problem rather than a folder operation,
which is why [[Project]] does not model its own deletion at all — that is deleting the folder, and
the folder belongs to [[The vault]] and its owner. Neither cost is incurred by the second half. A
catalogue entry is *referenced by* work and references none, so it enters no rollup of its own and
deleting a project never deletes something another project is using.

**Why catalogues are shared.** A tile, a builders' merchant and an electrician exist independently
of any one renovation. Scoping them per project made a renovator define white wall paint again for
their second bathroom, which is the library becoming the problem it was built to solve — the same
argument [[Searchable asset catalog]] already makes *within* a project, applied across them.

**What this is not.** It is not one plan per project. §79's multi-plan model is explicit — floors,
site plans and detail plans coexist, and §80's cross-plan relationships stay *within* the project.
"Exactly one project" is the boundary for work; "one plan" is not.

Nor does it make a catalogue entry's *use* shared. A [[Requirement]], a [[Quote]] line and a
[[Cost item]] each belong to the project that raised them, however widely the [[Asset]] they name is
shared. The definition is common; every consequence of using it is not.

**Where it holds.** Work carries its project id in frontmatter and every repository query over work
is project-scoped. A catalogue entry carries no project id at all — an absent id is the rule being
kept, not a migration that has not run.

**Renamed 2026-08-26.** This note was *Every entity resolves to exactly one project*, which the
product owner's decision to share the three catalogues made literally false. `BR-REL-002` is
unchanged, because an id is an address and is never renumbered; the basename changed because in
this folder a basename **is** the rule stated as a sentence, and a false sentence is a worse
address than a moved one.

**Checked by.** Not yet. Slice 03 establishes Project/Plan/Zone; slice 04 the repositories, which
is where the two scopes become two query paths rather than one.

**Sources.** PRD §59 · PRD §79 · PRD §80.
