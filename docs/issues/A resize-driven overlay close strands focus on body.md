---
type: Issue
parent: "[[Layers]]"
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

# A resize-driven overlay close strands focus on body

## The question

`src/presentation/editor/shell/ResponsiveEditorShell.vue:56-58` sends every measured width to
`WorkspaceStore.setLayoutMode`. When a pane grows from `constrained` to `full`,
`src/presentation/stores/WorkspaceStore.ts:47-51` clears the overlay directly. That path bypasses
`ResponsiveEditorShell.closeOverlay` at
`src/presentation/editor/shell/ResponsiveEditorShell.vue:79-83`, the only close path that moves
focus back to the rail button.

The focused overlay is then removed by the full-layout render branch, leaving
`document.activeElement` on `<body>`. Is a layout-driven close allowed to discard the keyboard
user's focus location when [[Layers]] criterion 5 says opening and closing restore focus
predictably?

## What is true today

- Design spec §5.5 at
  `docs/superpowers/specs/2026-09-02-plan-editor-foundation-read-path-design.md:241-247`
  requires focus return for Escape, but says nothing about a resize-driven close.
- [[Keep layer controls usable in constrained leaves]] records the wider acceptance criterion
  and its amendment at `docs/tasks/Keep layer controls usable in constrained leaves.md:50-54`
  names this resize path as the unmet half.
- `tests/presentation/editor/shell/responsiveShell.test.ts:125-143` resizes an open Inspector
  drawer from 460px to 1280px and checks that the drawer and rail disappear and the persistent
  panels return. It never checks `document.activeElement`.
- Measured with
  `rg -n "setLayoutMode|closeOverlay|activeElement" src/presentation/editor/shell/ResponsiveEditorShell.vue src/presentation/stores/WorkspaceStore.ts tests/presentation/editor/shell/responsiveShell.test.ts`:
  the only `activeElement` assertions are the explicit Escape/close-button cases at
  `responsiveShell.test.ts:88,122`; the resize case has none.

## Why it matters

A keyboard user who resizes a constrained leaf loses the control they were operating and has
no predictable next Tab position. The overlay disappears successfully, so the existing test
and visible UI both look correct while criterion 5's focus half is broken.

## What closes it

Keep the resize decision in the shell long enough to retain which overlay owned focus, then,
after the full layout renders, move focus to an explicit surviving target in the corresponding
persistent Layers or Inspector region. Add one discriminating case beside
`responsiveShell.test.ts:125-143` that focuses each open overlay, resizes to full, and asserts
the designated surviving target is `document.activeElement`.

Calling the existing `closeOverlay` is not sufficient: it focuses a rail button that the same
transition removes, returning focus to `<body>`. Leaving focus to browser fallback preserves
the defect, while keeping a constrained overlay open in full mode contradicts the store's
one-layout-state rule.

## References

- [[Layers]]
- [[Keep layer controls usable in constrained leaves]]
- Reviewed at commit 16757d6d
- PASS 4 — documentation truth
