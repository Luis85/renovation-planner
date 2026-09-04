---
type: Issue
parent: "[[Layers]]"
order: 20
status: New
started: ""
finished: ""
horizon: Now
start: ""
due: ""
risk: ""
priority: medium
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

# A shrink below the floor with an overlay open strands focus on body

## The question

[[A resize-driven overlay close strands focus on body]] closed the `constrained → full` half of a
resize that removes an open overlay while it holds focus: `ResponsiveEditorShell.vue`'s
`regionInheritingFocus(next)` (ruling R10) answers a surviving region only when `next === 'full'`.
Does the same loss happen on the OTHER edge — a shrink from `constrained` into `unsupported` while
the Layers overlay or the Inspector drawer is open and focused?

## What is true today

- `src/presentation/editor/shell/ResponsiveEditorShell.vue`'s `regionInheritingFocus` returns
  `null` whenever `next !== 'full'`, so a transition into `unsupported` never asks the question at
  all — the guard was written for the one direction note 5 reported.
- `measure()` calls `workspace.setLayoutMode(next)` unconditionally and returns early on a `null`
  region, so an `unsupported` transition clears the overlay with no focus move of any kind.
- `UnsupportedWidthNotice.vue` renders one control, `.rp-unsupported-width__action` (locale key
  `editor.unsupported-width.action`), which calls `context.focusLeaf()`. Nothing focuses it.
- `tests/presentation/editor/shell/responsiveShell.test.ts` never resizes 460 → 320 with an
  overlay open: its `it.each` at lines 191-209 ('growing back to full while %s is open moves focus
  to the persistent region it stood in for') and at lines 224-252 ('%s does not trap focus: focus
  can leave it for the canvas (R3)') both resize to 1280 or move focus by hand, and neither drives
  a shrink into `unsupported`.

## Why it matters

A keyboard user who has the Layers overlay or the Inspector drawer open and shrinks the pane
below the floor width — the same class of gesture note 5 fixed for the opposite edge — loses
their focus location to `<body>`, with the one control the new screen offers,
`UnsupportedWidthNotice`'s `Focus this tab` button, left unfocused. The regression this closes for
`constrained → full` is still open one edge over.

## What closes it

Extend `regionInheritingFocus` (or add a sibling check reached from `measure`) so that a
`constrained → unsupported` transition with an open overlay moves focus to
`.rp-unsupported-width__action` after the `unsupported` branch renders, the same `nextTick` shape
note 5 already uses for the `full` branch's persistent region. Add one discriminating case beside
the two `it.each` blocks above that resizes 460 → 320 with each overlay open in turn and asserts
`document.activeElement` is the notice's action button rather than `document.body`.

## References

- [[Layers]]
- [[A resize-driven overlay close strands focus on body]] — closed 2026-09-04, the `constrained →
  full` half of this same class of loss.
- `src/presentation/editor/shell/ResponsiveEditorShell.vue` — `regionInheritingFocus`, `measure`.
- `src/presentation/editor/shell/UnsupportedWidthNotice.vue` — the unfocused action button.
- `tests/presentation/editor/shell/responsiveShell.test.ts:191-209,224-252` — the two existing
  focus `it.each` blocks, neither of which drives this transition.
- Reviewed at commit `bc6ca060`.
