---
type: Issue
parent: "[[Start one creation task from Add]]"
order: 40
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

## What closed it

**2026-09-04.** The Escape branch was deleted from `AddMenu.onKeydown`; `PlanEditorRoot` gained
`onRootKeydown` (bound `@keydown.capture` on the root, so it sees the key before any descendant,
including the canvas) and `AddMenu` gained `onFocusOut` (bound `@focusout` on `.rp-add-menu`,
excluding the anchor so a second Add press still toggles, and a `null` `relatedTarget` — the
window losing focus — never closes it). Holding tests: `addMenu.test.ts` › 'focus leaving the
menu for another control in the same editor retires it, and nothing else moves' and 'Escape while
the menu is open is the root's, and a drafted polygon under the canvas survives it' (dispatched on
the CANVAS element, which is exactly the keystroke `EditorSurface.onKeyDown` would otherwise
route through `routeEscape` and cancel the draft with). Commit "fix(add-menu): close before
activate, root-owned Escape, focus boundary, wheel and unmount retirement — with tests that
count".

## References

- `src/presentation/editor/add/AddMenu.vue:3-8,197-201,292-295`
- `src/presentation/editor/PlanEditorRoot.vue:144-149,273-276`
- `tests/presentation/editor/add/addMenu.test.ts:25-40,122-133`
- `docs/superpowers/specs/2026-09-02-plan-editor-foundation-read-path-design.md:297-304` — §6.3.
- [[Start one creation task from Add]]
- [[Operate the Add menu by pointer and keyboard]]
- Reviewed at commit `16757d6d`, PASS 2.
