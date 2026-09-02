---
type: Task
parent: "[[Consolidate the current and target editor data models]]"
order: 30
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Decide Room Zone and Floor Plan boundaries

## Evidence

The [vertical-slice plan](../user-experience/renovation-planner-editor-specs/Renovation%20Planner%20—%20First%20Vertical%20Slice%20Plan%20and%20Data-Model%20Specification.md) requires Room/Zone and Plan/Floor ADRs before any schema or competing entity is introduced.

## Why it matters

UI vocabulary can change cheaply; persisted identity and ownership cannot.

## Approach

Evaluate facade/specialization/new-entity options against current IDs, storage, future hierarchy and locked workflows; record accepted ADRs for Room/Zone and Plan/Floor, with consequences and revisit triggers.

## Acceptance criteria

- Each ADR compares alternatives and names compatibility effects.
- The decision preserves `Plan` as Floor and room-classified `Zone` as Room unless evidence justifies migration.
- No homeowner label becomes an accidental persistence discriminator.

## Risks

A decision optimized only for the first screen can block Walls, Floors or renovation semantics later.

## Outcome

Accepted ADRs define the semantic boundary without premature schema churn.
