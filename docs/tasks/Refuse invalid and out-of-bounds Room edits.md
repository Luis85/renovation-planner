---
type: Task
parent: "[[Edit a selected room shape and dimensions]]"
order: 40
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Refuse invalid and out-of-bounds Room edits

## Evidence

The selected-Room workflow permits exact input only when the resulting geometry remains valid and
within the editable Floor.

## Why it matters

An apparently precise value can create unusable geometry or move part of a Room beyond its spatial context.

## Approach

Validate the complete draft at the command boundary, route field-specific and form-level refusals,
and keep the draft available for correction. Exercise invalid dimensions, degeneracy, bounds,
cancel, list/form operation and write refusal.

## Acceptance criteria

- Invalid, degenerate and out-of-bounds results cannot be finished.
- Refusal identifies what can be corrected and preserves the draft.
- The same refusal behavior applies to canvas and non-canvas routes.
- Refusal and cancel write nothing.

## Risks

Presentation-only validation can disagree with the command and falsely enable Finish.

## Outcome

Precise Room editing fails safely and remains recoverable from every route.
