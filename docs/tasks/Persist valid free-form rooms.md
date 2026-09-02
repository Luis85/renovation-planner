---
type: Task
parent: "[[Create a free-form room]]"
order: 20
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Persist valid free-form rooms

## Evidence

The data-model specification keeps Room metadata in a Zone note and points in the Plan sidecar,
joined by one stable identity.

## Why it matters

Free-form geometry exercises validation and compensation paths more heavily than a rectangle.

## Approach

Submit completed points through the Room/Zone domain factory and reversible creation command.
Exercise note-sidecar compensation, reload mapping, revision handling and derived area with
irregular fixtures. Propagate domain refusals in homeowner language.

## Acceptance criteria

- Only domain-valid completed shapes reach persistence.
- Note and sidecar round-trip under one stable ID.
- Failure at either write boundary leaves no half-created Room.
- Reload derives the same area from restored points.

## Risks

Presentation-side prechecks can drift from domain validation; use them only for feedback.

## Outcome

Valid free-form Rooms persist as coherent, recoverable Room records.
