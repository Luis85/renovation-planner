---
type: Issue
parent: "[[Selection]]"
order: 20
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

# Selection clearing is silent while the constrained Inspector is closed

## The question

Design spec §6.6 requires the return to the floor to be announced exactly once when selection
clears. `src/presentation/editor/shell/EntityInspector.vue:12-48` owns both the selection
watcher and the `role="status"` message, but
`src/presentation/editor/shell/ResponsiveEditorShell.vue:124-129` mounts that Inspector in
constrained mode only while its drawer is open.

## What is true today

Closing the constrained drawer unmounts `EntityInspector`; clearing selection while it is closed
therefore has no watcher to observe the non-empty-to-empty transition. Reopening constructs a
fresh watcher whose previous value is already empty, so its guard at
`src/presentation/editor/shell/EntityInspector.vue:40-47` correctly declines to announce.
The measured case at `tests/presentation/editor/shell/floorInspector.test.ts:68-84` clears
selection only with the Inspector mounted and never exercises the constrained closed state.

## Why it matters

A screen-reader user can clear selection from the canvas while the drawer is closed and receive
no confirmation that the contextual room state has returned to the floor overview. The same
action is announced or silent solely according to whether a visual drawer happens to be open.

## What closes it

Move the transition watcher and its persistent live region to a shell level that remains mounted
in every supported layout, leaving `EntityInspector` responsible only for visible Inspector
content. Add a constrained-layout test that closes the drawer, changes selection from one ID to
none, and observes the guidance once from the still-mounted status region, then proves an
unrelated refresh does not announce it again.

## References

- [[Selection]]
- [[Return selection to the safe floor state]]
- Reviewed at commit `16757d6d` — PASS 2
