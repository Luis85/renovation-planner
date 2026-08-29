---
rule: BR-DATA-003
kind: derivation
name: A manual override is stored as an override, beside what it replaced
area: data
sources:
  - PRD §89
type: business-rule
---

# A manual override is stored as an override, beside what it replaced

**The rule.** §89: calculated values must support **visible** manual overrides. An override is
stored in its own field, marked as an override, and the calculated value remains derived and
remains visible next to it. Typing a number never overwrites the derivation that produced the old
one.

**Why.** The user is often right — a tiler's own allowance beats a computed one, and a quoted
figure beats an estimate. What the user cannot do is notice, six weeks later, that the drawing has
since changed and their override is now based on a floor plan that no longer exists. Keeping both
values is what preserves that comparison; overwriting the derivation destroys the only signal that
would raise it.

**Where it holds.** [[Requirement]] is the primary case — calculated quantity, waste factor and
manual override are three separate §32 properties. The same shape applies wherever
[[A derived value is recomputed on read, not persisted]] leaves a user wanting the last word.

It also holds over a value that is **shared rather than derived**, since §59 was amended
(2026-08-26): an [[Asset]]'s default price belongs to a catalogue every project reads, so a project
that disagrees with it — most sharply when its currency differs (§72) — records a per-project
override and the shared default stays visible beside it. The reason is the rule's own: overwriting
the shared value would carry one project's disagreement into every other project that reads it.

**Checked by.** Not yet.

**Sources.** PRD §89 · PRD §32.
