---
type: Task
parent: "[[Use the editor in Obsidian themes and constrained layouts]]"
order: 50
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Verify constrained editor readability and target size

## Evidence

WP8 requires constrained-leaf and 200% zoom checks. The release contract also binds WCAG 2.2 AA,
but screenshots and jsdom do not measure rendered target size, clipping, wrapping or readable
text.

## Why it matters

A layout can preserve selection and avoid horizontal overflow while its controls become too small
to operate or its labels become unreadable at the supported constrained width.

## Approach

Inspect the first-slice interaction path in a real rendering engine at every supported constrained
breakpoint and at 200% zoom. Measure desktop pointer targets against the accepted WCAG 2.2 target
size or spacing exception, and inspect text wrapping, truncation, overlap and focus visibility in
English and German.

## Acceptance criteria

- Every interactive control in the constrained first-slice path has a rendered target of at least
  24 by 24 CSS pixels or records the applicable WCAG 2.2 exception and equivalent spacing.
- At 200% zoom, required labels, values, errors and status text remain readable without clipping,
  overlap or loss of content.
- Select, Add, room selection, Inspector actions, undo and redo remain reachable at every
  supported constrained width.
- English, German and representative long room names are checked at the narrowest supported width.
- Focus indicators remain visible and no required action depends on hover or color alone.
- Results identify width, zoom, locale, theme, host version and build; failures become defects
  rather than silently changing the breakpoint contract.

## Risks

DOM dimensions from a harness can differ from Obsidian after host styles, fonts and workspace
chrome are applied.

## Outcome

Supported constrained layouts retain desktop-operable targets and readable information through
200% zoom.
