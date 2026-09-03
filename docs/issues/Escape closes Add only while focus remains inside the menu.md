---
type: Issue
parent: "[[Start one creation task from Add]]"
order: 40
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

# Escape closes Add only while focus remains inside the menu

## The question

Design spec §6.3 says an open Add menu closes before the canvas acts and that the root owns this
precedence (`docs/superpowers/specs/2026-09-02-plan-editor-foundation-read-path-design.md:297-304`).
The root has no Escape handler. The only implementation is `AddMenu.onKeydown`, reached through
the menu root's local `@keydown.stop`
(`src/presentation/editor/add/AddMenu.vue:197-201,292-295`).

The component deliberately has no Tab focus trap (`src/presentation/editor/add/AddMenu.vue:3-8`).
Once Tab moves focus outside `.rp-add-menu` while the menu remains open, Escape no longer reaches
its handler; it reaches the canvas or another focused surface and can cancel a draft, return a
tool to Select or clear a selection instead.

## What is true today

- `PlanEditorRoot` stores and renders the open state at
  `src/presentation/editor/PlanEditorRoot.vue:144-149,273-276`, but a search of that file finds
  no `keydown` binding or Escape branch.
- A search of `tests/presentation/editor/add/addMenu.test.ts` finds no Tab case. Its Escape cases
  dispatch directly on the menu element at lines 34 and 129, so focus never leaves the only
  node that owns the handler.
- [[Start one creation task from Add]] criterion 3 requires keyboard users to open, traverse,
  choose and close the menu; close currently depends on where focus happens to remain.

## Why it matters

Escape is a precedence rule, not just a menu-local shortcut. After focus leaves the menu, the
same key can modify the active canvas interaction while leaving Add open above it, so the user
cannot rely on Escape cancelling the topmost temporary surface first.

## What closes it

Put the menu-open Escape precedence at the owning root and retire the menu when focus leaves its
interaction boundary, without introducing a document-global handler that closes menus in other
editor leaves. Add a mounted-tree test that moves focus from a menu item to another control in
the same editor, presses Escape, and requires only the menu to close while tool, draft and
selection remain unchanged.

## References

- `src/presentation/editor/add/AddMenu.vue:3-8,197-201,292-295`
- `src/presentation/editor/PlanEditorRoot.vue:144-149,273-276`
- `tests/presentation/editor/add/addMenu.test.ts:25-40,122-133`
- `docs/superpowers/specs/2026-09-02-plan-editor-foundation-read-path-design.md:297-304` — §6.3.
- [[Start one creation task from Add]]
- [[Operate the Add menu by pointer and keyboard]]
- Reviewed at commit `16757d6d`, PASS 2.
