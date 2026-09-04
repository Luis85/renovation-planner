---
type: Task
parent: "[[Consolidate the current and target editor data models]]"
order: 30
status: Done
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

## Closing evidence

**2026-09-03**, the plan editor foundation's first increment. ADR-0016
(`docs/development/adrs/0016-a-room-classified-zone-presents-as-room.md`) and ADR-0017
(`0017-plan-presents-as-floor.md`) each compare three alternatives, name their compatibility
effects and record the trigger that would revisit them. Both decisions are held by CODE as well
as by prose: `tests/presentation/read-models/spatialRecords.test.ts` asserts a Room-classified
zone projects as `kind: 'room'` with the `ZoneId` unchanged, every other zone type as `'area'`,
and the plan as a Floor beside its project. Criterion 3 is
`tests/infrastructure/persistence/editorRoundTrip.test.ts`: the persisted `zone-type` stays the
kebab-case `room` it always was, so no homeowner label became a persistence discriminator.
