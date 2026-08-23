---
type: Issue
status: Open
order: 20
parent: "[[Architecture and Software Design]]"
---

# Zone-less requirements have no in-plugin surface

PRD §64 requires "Delete anyway" as one of the four resolutions when deleting an entity
that other entities reference. Design slice 10 implements it: the referencing
Requirements survive the delete, each marked `recalculation-status: stale`.

For a deleted **Asset** that is enough — the Requirement still belongs to a Zone, so the
Zone's Requirements panel renders it with `missingTarget: 'asset'` and a stale badge. For
a deleted **Zone** it is not. Every read surface the slice map builds is scoped to a
selection or a Plan, and a Requirement whose Zone is gone has no selection left to hang
off. It is persisted, marked, correct, and invisible to the plugin.

## Alternatives considered

- **Ship a `ListOrphanedRequirements(projectId)` query in slice 10.** Rejected: it had no
  caller anywhere in the map, which makes it a dead export `npm run analyze` fails on, not
  a way for a user to find anything. A query is not a surface; declaring one and calling
  the state handled is the "persisted, correct, and invisible" defect one layer up.
- **Build a project-level Requirements list in slice 10.** Rejected: the Renovation
  Project view's populated content is explicitly deferred as feature work by slice 14 and
  by `docs/design/README.md`, and slice 10's own charter is integration — it introduces
  no new rendering surface. Widening it to open the first project-scoped view would make
  the closing slice of the architecture phase the first slice of the feature phase.
- **Refuse `delete-anyway` on a Zone until a surface exists.** Rejected: PRD §64 names the
  action, and refusing it would replace an invisible outcome with a missing one.
- **Route the orphans into slice 11's `DiagnosticsSnapshot`.** Rejected as the *answer*,
  though it remains available as a detection aid: the snapshot is content-free by SDD §68
  — IDs only, no names, no costs — so a user reading it could see that something dangles
  but not what it was or what it cost. That is a bug-report artifact, not a recovery
  surface.

## Decision

Accept the gap for the architecture-only phase, and state it in the design rather than
paper over it. Slice 10 ships the Asset-side read model (`missingTarget`) and guarantees
only what it can check for the Zone-side case: the Requirement note survives untouched,
keeps its dangling `origin` reference and its stale marker, and remains findable through
Obsidian's own search over `Requirements/` — which, per ADR-0001, is where the record
actually lives.

The first surface that lists Requirements across a Project closes this — the Renovation
Project view's populated content, or a Bases view over `Requirements/` (SDD §13, deferred).
`ListOrphanedRequirements`, or whatever query that surface needs, arrives in the same
change as the surface, per this repository's rule that a thing arrives with its first real
use.
