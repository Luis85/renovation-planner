---
type: Issue
parent: "[[View rooms in the Standard Plan View]]"
order: 10
status: New
started: ""
finished: ""
horizon: Now
start: ""
due: ""
risk: ""
priority: high
assignee: ""
iteration: ""
strategic-alignment: ""
customer-value: ""
business-impact: ""
reach: ""
risk-reduction: ""
compliance: ""
time-criticality: ""
enablement: ""
confidence: ""
effort: S
complexity: ""
business-value: ""
business-value-model: ""
---

# The unsupported-width summary presents a partial room count as complete

## The question

When a floor has unreadable records, may the unsupported-width replacement present the number
of readable rooms as the floor's room count without carrying the refusal?

## What is true today

`src/presentation/editor/shell/UnsupportedWidthNotice.vue:42` interpolates
`summary.rooms.length`. Its comment at lines 13-18 explicitly discards
`summary.roomCount`'s `partial` annotation because the sentence is only a glance.

That contradicts the read-path design's §3 clause at
`docs/superpowers/specs/2026-09-02-plan-editor-foundation-read-path-design.md:140-142`:
`roomCount`, `areaCount` and `totalAreaMm2` are partial when records were unreadable, carry the
unreadable count, and never round up to available. It also weakens the parent PBI's extension
1b, which says totals must not pretend missing records are absent.

Measured command:
`rg -n "rooms\.length|roomCount" src/presentation/editor/shell/UnsupportedWidthNotice.vue`
returns the active `rooms.length` read at line 42 and no rendered `roomCount` state. The existing
unsupported-width case at
`tests/presentation/editor/shell/responsiveShell.test.ts:145-160` covers only the complete
fixture and asserts the plain value `1`.

## Why it matters

The narrowest pane is already withholding the canvas. A precise-looking count is therefore one
of the few facts left for orientation, and presenting a lower bound as complete can make the
renovator believe rooms are missing from the plan rather than unreadable by this build.

## What closes it

The smallest fix is to render from `summary.roomCount` and preserve its `partial` state in the
sentence, or omit the count when the sentence cannot carry that qualification. The smallest test
extends `responsiveShell.test.ts` with `unreadable > 0` and asserts that the unsupported-width
body does not present the readable count as an unqualified complete total.

## References

- [[View rooms in the Standard Plan View]]
- [[Distinguish empty unreadable and unavailable floor data]]
- Reviewed at commit 16757d6d.
- PASS 2.
