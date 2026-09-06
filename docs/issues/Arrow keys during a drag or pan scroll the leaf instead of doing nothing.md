---
type: Issue
parent: "[[Plan editor and canvas]]"
order: 80
status: New
started: ""
finished: ""
horizon: Now
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

# Arrow keys during a drag or pan scroll the leaf instead of doing nothing

`EditorSurface.vue`'s `onKeyDown` gates the arrow-key nudge branch below
`if (gestureInFlight()) return;`. That guard is a bare early return with no
`event.preventDefault()` — so an arrow key pressed while a gesture (a drag, a draw, a pan) is
in flight neither nudges the selection nor is prevented, and the browser's native arrow-key
scroll fires on the Obsidian leaf underneath the canvas. The Space branch immediately above it
carries a comment recording that the same shape was already paid for once: Space is handled
ABOVE the camera lock specifically so the modifier does not go dead mid-gesture, which is the
argument the arrow branch's placement does not follow.

## What is true today

```
if (gestureInFlight()) return;
// §85's one operation slice 5 left unreachable by keyboard (E8, Task 14): an arrow key
// nudges whatever `nudgeSelection` finds selected. ...
const nudge = arrowVector(event);
if (nudge !== null) {
	event.preventDefault();
	...
}
```

The `preventDefault()` only runs once `arrowVector(event)` is reached, which never happens
while `gestureInFlight()` is true. A user holding a drag and pressing an arrow key sees the
Obsidian workspace scroll under them.

## What closes it

Either answer `arrowVector(event)` before the `gestureInFlight()` gate so the key can be
prevented even when the nudge itself is refused, or move the `preventDefault()` above the
gate for arrow keys specifically. A test alongside `canvasKeyboardGestures.test.ts` driving an
arrow key mid-gesture and asserting `preventDefault` was called (or that no scroll occurred)
would close it — none of the six canvas input test files currently drives this combination.

## References

- [[Plan editor and canvas]]
- `src/presentation/editor/surface/EditorSurface.vue` — the arrow branch and the Space
  branch's own comment recording the shape this defect repeats.
- Item 4, `.superpowers/sdd/2026-09-05-improvement-and-polish-pass/issues-brief.md` — the T14
  keyboard-nudge follow-up this note answers.
