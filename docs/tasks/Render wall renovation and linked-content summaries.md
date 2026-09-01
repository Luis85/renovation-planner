---
type: Task
parent: "[[Inspect a selected wall]]"
order: 20
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Render wall renovation and linked-content summaries

## Evidence

M07 places Existing, Planned, Work and linked renovation records in the Wall Inspector, and M00
defines the shared Materials, Costs and Evidence summary vocabulary.

## Why it matters

Showing zeros for capabilities not yet available makes incomplete integration look like a
finished wall with nothing planned, costed or documented.

## Approach

Compose the shared Entity Inspector frame with wall-specific measurement, relationship and
summary content. Render Existing, Planned, Work, Materials, Costs and Evidence independently as
available, empty, unavailable, stale or failed, and route available rows to their canonical
authorities.

## Acceptance criteria

- The Inspector shows wall measurements and adjacent-room/opening context before optional
  summaries.
- Each named summary distinguishes supported empty from unavailable.
- A stale or failed summary does not erase successfully read sibling sections.
- Available rows navigate to canonical records without copying their status or totals.
- Full and constrained Inspector presentations reuse the same content components.

## Risks

One generic count shape can erase provenance and capability differences between work, costs and
evidence.

## Outcome

The selected wall exposes renovation context without claiming records or capabilities that do
not exist.
