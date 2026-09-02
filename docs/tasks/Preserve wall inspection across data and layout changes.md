---
type: Task
parent: "[[Inspect a selected wall]]"
order: 40
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Preserve wall inspection across data and layout changes

## Evidence

The shared component contract requires responsive layout not to reset selection or viewport, and
M07 requires linked-content navigation to preserve wall selection.

## Why it matters

An Inspector that silently changes subject or loses available context after a refresh cannot be
trusted for renovation decisions.

## Approach

Refresh wall inspection by stable ID after relevant vault changes, retain last-valid sections
with explicit stale state where allowed, retire selection when the wall disappears, and reuse the
same Inspector content in full and constrained layouts.

## Acceptance criteria

- Supported refreshes keep the same selected Wall ID and floor viewport.
- A failed linked-section refresh is visibly stale or failed and does not become empty.
- Deleting or losing the selected wall retires selection without choosing a replacement.
- Opening and closing the constrained Inspector drawer preserves meaningful focus.
- Live-vault checks cover wall selection from the list, constrained layout and a disappearing
  wall.

## Risks

Retaining last-valid data without section-level freshness can present old measurements as
current.

## Outcome

Wall inspection remains stable, honest and keyboard usable as data and workspace layout change.
