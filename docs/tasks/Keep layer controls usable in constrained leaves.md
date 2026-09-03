---
type: Task
parent: "[[Layers]]"
order: 30
status: Active
horizon: "MVP"
release: "[[MVP]]"
---

# Keep layer controls usable in constrained leaves

## Evidence

[M16](../user-experience/renovation-planner-editor-specs/screens/M16-constrained-workspace.md) moves Property/Layers into one rail-triggered overlay while preserving values and viewport.

## Why it matters

Renovators routinely keep a source note beside the plan; hiding layer controls at that width breaks the core workflow.

## Approach

Reuse the same LayerList content in persistent and overlay containers, with keyboard focus management, text labels and state preserved across threshold changes.

## Acceptance criteria

- Full and constrained modes expose the same available layer actions.
- Only one temporary panel opens at a time.
- Opening and closing restores focus predictably.
- Resizing preserves layer values, selection and viewport.
- No essential control relies on an unlabeled icon.

## Risks

Forking constrained markup can drift from the persistent panel.

## Outcome

Layer control remains complete and accessible while the editor shares the workspace.

## Amendments

**2026-09-03** — criteria 1, 2 and 5 landed. The persistent panel and the constrained overlay
render the SAME `LayerList` (spec §5.1), so the available actions cannot differ;
`tests/presentation/editor/shell/responsiveShell.test.ts`'s 'opens one overlay at a time from the
rail, closes on Escape, and returns focus to the rail button' is criterion 2 and half of
criterion 3, and its 'keeps selection and viewport across the change' is half of criterion 4;
`PanelRail`'s two controls are TEXT buttons rather than icons, graded for an accessible name by
`tests/harness/accessibility.test.ts`'s constrained-overlay scan, which is criterion 5.

Criterion 3 holds for the ESCAPE close and NOT for the resize-driven one: growing the pane back to
`full` closes the overlay through the store and leaves focus on `<body>`. Nothing in spec §5.5
required otherwise, which is why it shipped, and it is a real gap against this criterion rather
than a decision. Criterion 4's 'preserves layer values' half is true by construction — visibility
lives in Pinia, which no layout change touches — and is asserted by no case.
