---
type: Task
parent: "[[Walls and hosted openings]]"
order: 20
status: Done
horizon: "MVP"
release: "[[MVP]]"
dependsOn: "[[Persist a wall as one spatial identity]]"
---

# Host and restore an opening on its wall

## Evidence

M04 and M07 treat doors and windows as hosted by walls, but the current domain and persistence
model has no wall or opening relationship.

## Why it matters

An opening stored as unrelated geometry can drift off its wall and cannot explain what a wall
edit affects.

## Approach

Add the minimum opening identity, host-wall reference and host-relative placement; validate the
relationship in the command and prove a repository round trip restores both endpoints.

## Acceptance criteria

- A valid opening persists with its own ID and one host wall ID.
- Invalid host placement writes nothing.
- Reload restores the same host and placement.
- A missing host produces an unresolved result, never an unattached opening.

## Risks

Absolute and host-relative geometry can become two authorities; persist only the representation
selected by the accepted wall/opening contract.

## Outcome

Not started.

## Closing evidence

**2026-09-08**, the plan-editor stack — landed in 3d08d22a (#86, ADR-0020).

Criterion 1 — **a valid opening persists with its own ID and one host wall ID** — and criterion 3
— **reload restores the same host and placement** — are
`tests/application/commands/structureCommand.test.ts`'s 'composes opening placement, edit,
deletion and reverse order history with shared versions' (`opening-a` on `hostId: 'wall-a'`; three
undos back to the baseline document, three redos back to the loop) over the fresh-stack reload of
'creates walls plus the Room as one history item; reloads the same IDs through a fresh stack'.

Criterion 2 — **invalid host placement writes nothing** — is decided in the domain and checked
again at the write: `tests/domain/spatial/structure.test.ts`'s 'refuses missing hosts, duplicate
IDs and malformed room associations' and 'accepts touching openings and separate hosts, refuses
horizontal overlap even at different heights', and `structureCommand.test.ts`'s 'validates before
writing and preserves a draft command after a recoverable failure'. Refused rather than clamped or
detached, which is the PR's own wording.

Criterion 4 — **a missing host produces an unresolved result, never an unattached opening** — is
refused at every door that could admit one:
`tests/infrastructure/obsidian/repositories/structurePersistence.test.ts`'s 'rejects malformed
spatial schema and valid-shaped dangling hosts before mutation' (a persisted sidecar),
`tests/application/commands/roomBoundaryHistory.test.ts`'s 'refuses missing host walls and
compensates the restored Room without replacing peer geometry' (a Room restore), and
`tests/infrastructure/obsidian/repositories/renovationReviewNotes.test.ts`'s 'refuses invalid
persisted intended hosts and renovation metadata without rewriting their bytes' (#87's intended
structure).
