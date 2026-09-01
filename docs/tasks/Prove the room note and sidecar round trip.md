---
type: Task
parent: "[[Reload the editor without losing room data]]"
order: 10
status: New
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
