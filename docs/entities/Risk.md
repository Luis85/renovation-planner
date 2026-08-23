---
kind: entity
name: Risk
layer: domain
persistence: note
sources: ["PRD §26", "PRD §58", "PRD §28"]
---

# Risk

Something that has not gone wrong yet. §26 gives its properties: probability, impact, exposure,
mitigation, owner, affected area.

**Risk, [[Issue]] and [[Constraint]] are three different things** and §26 keeps them apart
deliberately. A risk *might* happen — asbestos behind the plasterboard. An issue *has* happened
— the delivery arrived damaged. A constraint *is always true* — the doorway is 78 cm and the
bath is 80. Merging them produces a list nobody triages, because the three demand different
responses: mitigate, resolve, design around.

Exposure being a listed property makes it quantitative rather than a label: probability × impact
is a number the [[Project]] can be ranked by, and it is what makes a risk register more than a
worry list. It is also why risk is one of §29's scenario comparison dimensions.

*Affected area* is the spatial hook. §26 asks for spatial issue markers, so a risk can be
attached to a [[Zone]] and shown on the [[Plan]] — the asbestos is *in that wall*, and that is
the most useful thing to know about it.

## Identity and persistence

A Markdown note (§36's `Risks/`) with a stable `id` (§60), probability, impact, exposure,
owner and status in frontmatter — an entity whose value is largely in being sortable.

## Relationships

- Belongs to the [[Project]]; may be attached to a [[Zone]], [[Construction section]] or
  [[Work package]].
- May be shown on a [[Plan]] as a marker [[Spatial object]] (§26).
- Becomes an [[Issue]] if it materialises.
- Accepted, mitigated or transferred by a [[Decision]].
- Relates to contingency, a §74 price component on [[Cost item]].

## Rules

- Exposure is derived from probability and impact, not typed independently.
- A materialised risk becomes an [[Issue]] and the risk is closed as *occurred* — it is not
  edited into an issue, or the register loses its own history.
- A risk with no mitigation and no owner is a worry. §26's property list makes both explicit for
  that reason.

## Sources

PRD §26 · PRD §58 · PRD §28, in
[`docs/prds/obsidian-renovation-planner.md`](../prds/obsidian-renovation-planner.md) and
[`docs/sdds/obsidian-renovation-planner-SDD.md`](../sdds/obsidian-renovation-planner-SDD.md).
