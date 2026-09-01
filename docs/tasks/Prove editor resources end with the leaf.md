---
type: Task
parent: "[[Meet editor performance and cleanup budgets]]"
order: 30
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Prove editor resources end with the leaf

## Evidence

The performance contract requires no retained Konva stages, listeners, or object URLs after close.

## Why it matters

Repeatedly opening plans can otherwise retain canvases, subscriptions, files, and stale behavior.

## Approach

Instrument allocation and disposal for stages, window/vault listeners, object URLs, stores, and
subscriptions. Repeat open/close cycles automatically and inspect a live Obsidian session.

## Acceptance criteria

- Owned resource counts return to baseline after each close.
- A closed leaf receives no later theme, vault, or pointer event.
- Live repeated open/close shows no duplicate stage warning or growing retained set.

## Risks

Garbage-collection timing is nondeterministic; assert explicit disposal before heap observations.

## Outcome

Leaf lifecycle cleanup is both deterministic and live-host verified.
