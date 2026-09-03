---
type: Issue
parent: "[[Start one creation task from Add]]"
order: 30
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
effort: S
complexity: ""
business-value: ""
business-value-model: ""
---

# The Add menu survives the canvas that anchored it

## The question

`PlanEditorRoot` owns `addMenuOpen` and the captured `addButton` element outside the canvas
subtree (`src/presentation/editor/PlanEditorRoot.vue:144-149`). At unsupported width,
`ResponsiveEditorShell` removes the canvas slot
(`src/presentation/editor/shell/ResponsiveEditorShell.vue:110-112,130`), which unmounts both the
menu and the Add button but does not reset either root value.

When the pane widens, `PlanCanvas` remounts because `status` is still ready and the still-true
`addMenuOpen` immediately remounts `AddMenu` with the old, detached button as its anchor
(`src/presentation/editor/PlanEditorRoot.vue:258-276`). Design spec §7.2 requires an anchored
menu and meaningful focus return; a removed element satisfies neither.

## What is true today

- `AddMenu` removes its document listener and focuses `props.anchor` on unmount
  (`src/presentation/editor/add/AddMenu.vue:284-287`), but it does not emit `close`; the parent
  state therefore survives an ancestor unmount.
- The unsupported-width test proves only that the canvas disappears and later returns
  (`tests/presentation/editor/shell/responsiveShell.test.ts:145-168`). It never opens Add before
  either transition and cannot see the stale anchor.
- On remount, document-capture and the new Add button's click can close and reopen the surviving
  menu state, but focus restoration still targets the removed button until a new open gesture
  refreshes `addButton`.

## Why it matters

The menu can reappear without a user opening it and can claim focus return to a node no longer in
the document. Responsive failure recovery then restores a stale interaction state rather than a
truthful editor, while the next Add click has to repair state as a side effect.

## What closes it

Retire the Add-menu state when its canvas subtree unmounts and discard the stale anchor. The
smallest discriminating test opens Add, resizes to unsupported, resizes back to full, and
requires the menu to remain closed, `aria-expanded` to be false and a subsequent Add press to
open against the newly mounted button.

## What closed it

**2026-09-04.** `PlanEditorRoot` gained `retireAddMenu` (`addMenuOpen = false; addButton =
null;`), bound `@vue:unmounted` on `<PlanCanvas>` — so the state resets the instant the shell's
own `slot v-if` removes the canvas subtree, whatever unmounted it. Holding test:
`responsiveShell.test.ts` › 'an open Add menu does not survive the canvas being unmounted below
the floor width' — opens Add, resizes to unsupported and back, requires the menu closed and
`aria-expanded="false"`, then opens again and confirms the new button is a live anchor (Escape
returns focus to a connected element). Commit "fix(add-menu): close before activate, root-owned
Escape, focus boundary, wheel and unmount retirement — with tests that count".

## References

- `src/presentation/editor/PlanEditorRoot.vue:144-149,258-276`
- `src/presentation/editor/shell/ResponsiveEditorShell.vue:110-112,130`
- `src/presentation/editor/add/AddMenu.vue:284-287`
- `tests/presentation/editor/shell/responsiveShell.test.ts:145-168`
- `docs/superpowers/specs/2026-09-02-plan-editor-foundation-read-path-design.md:358-365` — §7.2.
- [[Start one creation task from Add]]
- [[Keep the editor truthful across failure and narrow layouts]]
- Reviewed at commit `16757d6d`, PASS 1.
