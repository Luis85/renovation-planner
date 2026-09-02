---
type: Task
parent: "[[Understand room costs and follow them to their authority]]"
order: 80
status: New
horizon: "V1"
release: ""
---

# Make room cost progress readable without visual bars

## Evidence

M13 requires progress bars to include numeric equivalents and financial stages to remain
text-labelled. A bar's length or colour alone cannot communicate planned, committed or actual
money accessibly.

## Why it matters

Users of assistive technology and users who cannot distinguish the visual encoding need the same
cost relationship and exact values as everyone reading the chart.

## Approach

Give each progress indicator an accessible label, current value, bounds and adjacent formatted
numeric equivalent derived from the same authoritative read model. Keep planned, committed and
actual labels in text and verify keyboard, narrow-pane and high-contrast behavior.

## Acceptance criteria

1. Every cost progress bar has a programmatic name and numeric value or equivalent text.
2. Planned, committed and actual amounts are available as formatted text beside the visual.
3. Colour, width and animation are never the only carriers of stage or progress.
4. Screen-reader output and visible numbers derive from the same authoritative fields.
5. The content remains readable at the supported narrow Inspector width and under zoom.

## Risks

- Independently formatted accessible text could disagree with the visible number.
- Excess labels could become noisy if the group and item hierarchy is not announced clearly.

## Outcome

Room cost progress communicates the same stages and numbers with or without its visual bars.
