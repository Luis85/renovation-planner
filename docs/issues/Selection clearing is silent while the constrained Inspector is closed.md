---
type: Issue
parent: "[[Selection]]"
order: 20
status: Done
started: 2026-09-04
finished: 2026-09-04
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

## What closed it

**2026-09-04.** The transition watcher and its `role="status"` region moved out of
`EntityInspector.vue` into a new shell-level `src/presentation/editor/shell/SelectionGuidance.vue`
(R15), mounted by `PlanEditorRoot.vue` in the warnings region beside `PersistentWarningStrip`, so
it is mounted in every supported layout rather than only while `EntityInspector` happens to be —
`EntityInspector` is unmounted in `constrained` layout while its drawer is closed. The selector
renamed from `.rp-inspector-guidance` to `.rp-selection-guidance`, and its rule moved with it from
`styles/editor-inspector.css` to `styles/editor.css`, the partial that already lays out the
warnings region. Holding tests: `tests/presentation/editor/shell/responsiveShell.test.ts` ›
'announces the return to the floor once even while the constrained drawer is closed, and not
again on a refresh' (the new case, clearing selection with the drawer closed and the Inspector
unmounted), beside `tests/presentation/editor/shell/floorInspector.test.ts` › 'announces guidance
once when the selection clears, and not on a refresh' (the pre-existing full-layout case,
selector renamed). Commit "fix(shell): the return-to-floor announcement is mounted in every
layout, not only while the Inspector is".

## References

- [[Selection]]
- [[Return selection to the safe floor state]]
- Reviewed at commit `16757d6d` — PASS 2
