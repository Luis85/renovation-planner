---
adr: 7
title: Command-Based Mutations
status: Accepted
date: 2026-08-22
area: application
---

# ADR-007: Command-Based Mutations

## Context

Business-changing operations (creating a zone, moving a spatial object, assigning an asset, completing a work package) need a consistent foundation for undo/redo, validation, event generation, persistence, testing, and auditability. Allowing the UI to mutate stores or repositories directly would make these guarantees hard to enforce consistently.

## Decision

All user-visible mutations are routed through explicit application commands (`CreateZoneCommand`, `MoveSpatialObjectCommand`, `AssignAssetCommand`, `CreateRequirementCommand`, `CompleteWorkPackageCommand`, and similar), implementing a common `Command<TInput, TResult>` interface. Editor commands additionally support reversal via an `UndoableCommand` interface (`execute()` / `undo()`), backed by a command history (undo/redo stacks).

## Consequences

- One user intent maps to one logical transaction: for example, a full pointer-down/drag/pointer-up gesture on a zone becomes a single `MoveZoneCommand`, one domain change, one history entry, and one persistence operation — not a write per pointer-move event.
- The UI and editor tools must not call repositories directly; every mutation needs a corresponding command and handler.
- Commands provide a single place to validate operations, apply business rules, and decide what gets persisted.
- Commands are the natural point to emit domain/application events after a successful change (see ADR-008).

## Alternatives

- Direct mutation of Pinia stores or repositories from Vue components — rejected: no single place to hook validation, undo/redo, or events, and every component would need to reimplement transaction boundaries on its own.
- A generic "actions" layer without a formal undo/redo contract — rejected: an explicit `execute()`/`undo()` contract was needed as soon as undo/redo became a requirement, so the weaker shape would only have been replaced later anyway.

## Revisit when

The command surface grows large enough that a more structured command bus — for example, with middleware or command versioning — is needed.
