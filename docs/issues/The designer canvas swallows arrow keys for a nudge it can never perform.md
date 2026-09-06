---
type: Issue
parent: "[[Select part of an object's shape]]"
order: 20
status: New
started: ""
finished: ""
horizon: Next
start: ""
due: ""
risk: ""
priority: ""
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
effort: ""
complexity: ""
business-value: ""
business-value-model: ""
---

# The designer canvas swallows arrow keys for a nudge it can never perform

`DesignerCanvas.vue` defines `const nudgeSelection = (): Promise<void> => Promise.resolve();`
and passes it to `EditorSurface.vue` as the required `nudgeSelection` prop, with its own
docblock explaining why: "this surface's own `selection` never holds anything... so there is
nothing an arrow key here could ever move." `EditorSurface.vue`'s arrow-key branch still calls
`event.preventDefault()` before invoking that no-op, because the prop is required and the
branch cannot tell a real handler from a stub.

## What is true today

Every arrow key press on the Asset Designer canvas is swallowed (its default browser action
prevented) for an action that provably does nothing, because `nudgeSelection` is typed as
required on `EditorSurface.vue`'s props
(`nudgeSelection: (by: Vector) => Promise<void>;`) rather than optional.

## What closes it

Make the prop optional and call it as `props.nudgeSelection?.(nudge)` at the one call site in
`EditorSurface.vue`. That removes `DesignerCanvas.vue`'s stub entirely along with its
`Promise.resolve()` no-op, and stops `preventDefault()` firing for an arrow key the designer
canvas can never act on. A case in `canvasKeyboardGestures.test.ts` (or wherever the designer's
own keyboard tests live) asserting no `preventDefault` on the designer canvas's arrow keys is
what would close it.

## References

- [[Select part of an object's shape]]
- `src/presentation/designer/DesignerCanvas.vue` — the stub and its own docblock explaining why
  nothing there is ever selected.
- `src/presentation/editor/surface/EditorSurface.vue` — the required prop and the
  unconditional `preventDefault()` ahead of it.
