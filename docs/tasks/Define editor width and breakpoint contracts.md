---
type: Task
parent: "[[Use the editor in Obsidian themes and constrained layouts]]"
order: 40
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Define editor width and breakpoint contracts

## Evidence

Phase 0 requires a supported minimum editor width and responsive thresholds; Phase 1 and M16
require full, constrained and unsupported behavior from leaf/container width observation, but
the current backlog names no numeric boundaries or boundary fixtures.

## Why it matters

Terms such as full and constrained are not testable until the measured container, transition
points and behavior on each side are fixed.

## Approach

Measure representative Obsidian leaf arrangements and define numeric full, constrained and
unsupported width ranges in CSS pixels. Assign one owner for container measurement and one
derived breakpoint state consumed by the shell. Create breakpoint fixtures at each threshold,
immediately above and below it, including resize in both directions.

## Acceptance criteria

- Full, constrained and unsupported ranges have non-overlapping numeric thresholds and an
  explicit boundary rule.
- The contract names the editor container or leaf dimension being measured and does not derive
  layout from the application window or device label.
- One measurement owner produces the breakpoint state; panels and controls do not run independent
  width tests.
- Fixtures cover every threshold at the boundary and immediately above and below it.
- Full-to-constrained-to-unsupported and reverse transitions define panel placement, available
  actions and unsupported-width fallback without horizontal scrolling.
- Threshold evidence records the tested Obsidian chrome, zoom assumptions and representative
  split-leaf arrangements.

## Risks

Thresholds chosen from one screenshot can fit that pane while failing under different Obsidian
chrome, locale text or zoom.

## Outcome

Responsive behavior has measurable ranges, one measurement authority and fixtures that can detect
breakpoint drift.
