---
rule: BR-QTY-007
kind: constraint
name: A requirement names what it is required for
area: quantity
sources:
  - PRD §59
  - PRD §32
  - PRD §63
type: business-rule
---

# A requirement names what it is required for

**The rule.** §59: a [[Requirement]] describes a need and *must have an origin* — a [[Zone]], a
[[Work package]] or an [[Asset]]. A quantity with no source is a typed number, and §32 makes the
origin a first-class property precisely so the derivation stays visible.

**Why.** The origin is what makes the quantity move when the drawing does. *46.2 m² of tile* is
required **because the bathroom floor measures that**; sever the link and the figure freezes
while the polygon keeps changing.

**It is a creation-time guard, not a persistent invariant, and that is deliberate.** The
assignment path refuses a requirement with no origin. What it cannot do is keep one: `delete
anyway` ([[A delete reports what references it and offers four choices]]) **strands** a
requirement whose zone is gone, and so does a hand edit, because Markdown is canonical and the
user is *invited* to edit the vault. The *Validation and vault health* Feature settles the general
question this raises — **a broken reference is a normal state to be reported rather than an
exceptional one to be prevented** — so a stranded requirement is not a hole in the model. It is a
§63 *deleted object*, one of
[[Four kinds of reference failure are detected by name|the four failures detected by name]].

**Two surfaces reach it, and they are not the same thing.** Slice 11's
`DiagnosticsSnapshot.validationIssues` reports *that* an entity has an issue — `entityType`,
`entityId`, a domain-level description — and is deliberately content-free, so it names no zone.
The *Validation and vault health* Feature is the one that answers "what is broken and where"
by name; it is MVP-horizon and not yet assigned to a slice. Neither is a browsable Requirements
list: slice 10 defers that, correctly, because every surface it builds is scoped to a selection or
a plan and a zone-less requirement has no zone to select — which is why it declares no
`ListOrphanedRequirements` query rather than shipping a dead export. Until the health report
lands, the vault itself is the answer: the note is still a note, still findable by search and
still visible to [[Bases]].

**Checked by.** Not yet. Slice 10's "Deletion & reference integrity" states the creation guard and
the stranding; the reporting half belongs to
[[Four kinds of reference failure are detected by name]].

**Sources.** PRD §59 · PRD §32 · PRD §63 · slice 10
([`docs/tasks/10-assets-requirements-and-the-end-to-end-loop.md`](../tasks/10-assets-requirements-and-the-end-to-end-loop.md)) ·
[`docs/requirements/Validation and vault health.md`](../requirements/Validation%20and%20vault%20health.md).
