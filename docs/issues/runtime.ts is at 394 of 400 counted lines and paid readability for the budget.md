---
type: Issue
parent: "[[Plan editor and canvas]]"
order: 100
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

# runtime.ts is at 394 of 400 counted lines and paid readability for the budget

Measured with the gate's own counter:

```
npx eslint src/presentation/editor/runtime.ts \
  --rule '{"max-lines":["error",{"max":1,"skipBlankLines":true,"skipComments":true}]}'
```

`src/presentation/editor/runtime.ts` counts 394 lines against the 400 cap — 6 lines of
headroom. The call that bought room for E8's arrow-nudge wiring collapsed onto one line:
`const { createRoom, canCreateRoom, roomDraftIncomplete } = createRoomCreationAction({
context, planId, ledger, dispatcher: toolDispatcher, selection, roomDraft, defaultRoomName,
returnToSelect });` is 197 characters. CLAUDE.md's own account of `EditorSurface.vue` records
the same shape happening once already in this file during slice 13, under a comment predicting
that the next change adding a line of code — of any size — would need an extraction rather
than a second collapsed literal.

## What is true today

`EditorSurface.vue`'s own note
([[The canvas has no budget left for the next input rule]]) already tracks this file's sibling
at 399/400. This is the second module the same command surfaces at the edge, not a duplicate
of that note — the two files are different, and the fix each needs is scoped to its own
handlers rather than shared.

## What closes it

The next case added to `runtime.ts` — a new command wiring, a new keyboard branch — should
extract a seam rather than reformat a line. `createRoomCreationAction` and
`createNudgeSelectionAction` are already factored out as top-level functions; the next
extraction candidate is whichever of `buildRuntime`'s remaining inline blocks is largest by
the same comment-stripped share `[[The canvas has no budget left for the next input rule]]`
used to cost `EditorSurface.vue`'s own regions. No test closes a budget note by itself — the
signal is the six lines of headroom shrinking on the next PR that touches this file.

## References

- [[Plan editor and canvas]]
- [[The canvas has no budget left for the next input rule]] — the sibling note for
  `EditorSurface.vue`; do not duplicate its analysis here.
- `src/presentation/editor/runtime.ts:730` — the 197-character collapsed call line.
