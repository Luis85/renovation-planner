---
type: Task
parent: "[[Define and compare an intended room state]]"
order: 80
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Render and apply the canonical change-state legend

## Evidence

M09 requires unchanged, remove, modify and add classifications to use labels, markers and
patterns, while the shared `ChangeLegend` fixes Existing wall, Wall to remove and New
wall/opening as homeowner-facing meanings.

## Why it matters

If the legend and mutation controls invent separate terms or visuals, identical wall state can
mean different things across the canvas and Inspector.

## Approach

Define one canonical projection for Existing/unchanged, removed, modified and new/added state,
including fixed text, marker and stroke-pattern conventions. Use the same vocabulary to render
the legend and to offer only semantically valid transitions for a selected Wall.

## Acceptance criteria

- The legend presents Existing/unchanged, removed, modified and new/added meanings with fixed
  homeowner-facing text.
- Every state combines a text label with a distinct marker and stroke/pattern treatment; colour is
  supplemental only.
- Canvas overlays and the legend consume the same state-to-presentation mapping.
- A selected existing Wall may be marked Unchanged, Remove or Modify, but not Add.
- A selected proposed new Wall may be marked Add and cannot be marked Remove or Modify as though
  it were an existing source.
- Invalid transitions are absent or carry an explanation and dispatch no command.
- Reload and theme changes preserve semantic state and keep each convention distinguishable.

## Risks

Persistence vocabulary may leak directly into homeowner copy, or Add and new may become separate
states rather than two labels for one meaning.

## Outcome

The legend and Wall actions communicate one canonical renovation-state language and prevent
semantically impossible changes.
