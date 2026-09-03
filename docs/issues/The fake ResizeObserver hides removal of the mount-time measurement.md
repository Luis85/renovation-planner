---
type: Issue
parent: "[[Errors, diagnostics and the test harness]]"
order: 60
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
effort: M
complexity: ""
business-value: ""
business-value-model: ""
---

# The fake ResizeObserver hides removal of the mount-time measurement

## The question

Design spec §5.4 requires the shell to derive its first layout from the mounted root's real
width. `tests/helpers/layout.ts:12-28`, `tests/helpers/editor.ts:138-155`,
`src/presentation/editor/shell/ResponsiveEditorShell.vue:85-89` and
`tests/presentation/editor/shell/responsiveShell.test.ts:32-39` leave the direct mount-time
read and the later observer callback indistinguishable to the suite.

## What is true today

The fake `ResizeObserver` deliberately fires only through `resizeTo`, while every Plan Editor
mount helper calls `resizeTo` after mounting. Removing `ResponsiveEditorShell`'s initial
`measure()` from `onMounted` therefore leaves the suite green: the later synthetic callback
still supplies the expected mode.

Measured by tracing every `resizeTo` caller and by running the focused nine-file set: 127 tests
passed at `16757d6d`, with no case observing layout before the synthetic callback.

That contradicts the standing claim that reading `clientWidth` at mount is independently held.
The suite currently demonstrates only the observer-callback path.

## Why it matters

A host whose observer does not supply an initial callback would leave the editor in the mode
derived from jsdom's zero width. The production fallback exists for that host behaviour, but the
fake makes its removal invisible.

## What closes it

Add a mount case that establishes a non-zero shell width before mount and verifies the mode
before any `resizeTo` callback, or provide a focused fake mode that can drive the mount-time path
without also firing the observer.

## References

- [[Errors, diagnostics and the test harness]]
- [[Keep the editor truthful across failure and narrow layouts]]
- Reviewed at commit `16757d6d`, PASS 3.
