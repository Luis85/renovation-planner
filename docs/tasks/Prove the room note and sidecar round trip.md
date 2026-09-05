---
type: Task
parent: "[[Reload the editor without losing room data]]"
order: 10
status: Done
horizon: "MVP"
release: "[[MVP]]"
---

# Prove the room note and sidecar round trip

## Evidence

VS-09 requires one room identity to survive Markdown and sidecar rehydration.

## Why it matters

A green creation flow does not prove that the next session can reconstruct the room.

## Approach

Add contract fixtures for complete, unreadable, and accepted legacy room records. Assert stable
identity, metadata, points, area derivation, user-body preservation, and no write during read.

## Acceptance criteria

- A complete room round-trips without field or identity loss.
- Unreadable and empty are different results.
- Accepted migrations preserve identity and user-owned Markdown.

## Risks

A fixture copied from a mapper can repeat its omission; include a hand-authored vault example.

## Outcome

The persistence boundary proves what room data reload can recover.

## Closing evidence

**2026-09-05**, the trust path increment. `tests/infrastructure/persistence/editorRoundTrip.test.ts`
gained **'reopening over the same vault bytes reads the room back whole'** — a SIBLING of the
existing `CreateZoneCommand` case rather than an extension of it, because a reopen needs its own
stack.

Criterion 1 — **a complete room round-trips without field or identity loss** — is that case, and
what makes it a reopen rather than a re-read is the stack it builds: a fresh `stackFoundation`
over the SAME `FakeVault`, so a fresh `ReconcilingProjectIndex`, a fresh **`EchoWindow`** and a
fresh `PlanGeometryStore`, plus the `rebuildIndex()` the plugin runs at load. The fresh echo
window is the part `rebuildIndex()` on the ORIGINAL stack would not have given: `frontmatterOf`
falls back to what this plugin last wrote while the cache lags, so a read through the writing
stack can be answered by our own memory of our own write, and the case would then prove nothing
about what is on disk.

Criterion 2 — **unreadable and empty are different results** — is pre-existing and unchanged:
`findZonesByPlan` answers `ok({ zones, unreadable })`, which [[A note that cannot be read]]'s own
increment closed. This increment neither widened nor narrowed it.

Criterion 3 — **accepted migrations preserve identity and user-owned Markdown** — is held by the
migration runner's own suite and is **NARROWED where it matters**: every migration table in this
repository is still empty, so `migrateNote` has never executed a non-empty chain outside a
synthetic fixture. This increment changed no schema — design spec §2.10 — so it neither pays that
debt down nor adds to it. CLAUDE.md's `MIGRATION_SET` account is the authority and carries the grep
that re-measures it.

**One fixture fact worth knowing before the next reopen case is written.**
`stack.metadataCache.catchUp()` runs before the reopen scan, and without it the case fails at the
lookup: `FakeVault.pendingParse` models the parse LAG after a write, and a scan with a fresh echo
window asking a cache that has not reached the note finds none of ours. That is a true statement
about the milliseconds after a save and NOT about reopening a vault, so the fixture drains the
queue and says why.
