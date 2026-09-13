---
type: Feature
parent: "[[Professional handoff]]"
order: 30
status: New
horizon: "V1"
release: "[[Mighty Dragon]]"
---

# Versioned handoff packages

This feature assembles a recipient-focused artifact from canonical project records, lets the
renovator review exactly what leaves the vault, and freezes what was issued. A package identifies
its purpose, recipient, issue date, included records and source revisions, unresolved questions,
warnings and attachments. Later changes create a visible delta and a new issue rather than
rewriting history.

The product requirement is an immutable issued snapshot and portable output. Whether the snapshot
is represented by an owned Markdown note, a manifest plus files or another local format is an
architecture decision owed when this feature is sliced; the package may not become a second
authority for the renovation records it projects.

## Outcome

The homeowner and recipient can identify what was sent, which version it represented and whether
it is still current, using files understandable without Renovation Planner.

## Evidence

The competitive landscape explicitly identifies a contractor brief/scope export as a strategic
opportunity, while PRODUCT.md and the SDD require local-first, Markdown-native, portable and
version-aware data. Research also identifies partner-friendly snapshots and printable room briefs
as useful before real-time collaboration exists.
