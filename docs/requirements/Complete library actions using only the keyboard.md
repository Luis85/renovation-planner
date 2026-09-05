---
type: PBI
parent: "[[Searchable asset catalog]]"
order: 100
status: Active
started: "2026-09-05"
finished: ""
horizon: "MVP"
start: ""
due: ""
risk: ""
priority: "P1"
assignee: ""
iteration: ""
dependsOn:
  - "[[Create a new asset without an existing project]]"
  - "[[Use the library in narrow panels and host themes]]"
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

# Complete library actions using only the keyboard

Every other note in this group owes keyboard access as part of its own change. This one verifies the whole flow end to end — search, shelves, selection, forms and dialogs — because a chain of individually accessible parts can still drop focus at a seam.

## Actor

A renovator working without a pointer.

## Main flow

1. The renovator uses search, groups, selection, forms and dialogs from the keyboard.
2. They understand outcomes and status through labels.
3. Focus is recovered after every return.

## Extensions

- **1a. Rows are collapsed.** They cannot receive focus.
- **1b. A dialog is open.** It contains focus and restores it to the element that opened it.
- **1c. Arrow keys are pressed in a text field.** The catalogue does not capture them.
- **1d. Host shortcuts —** remain intact.
- **1e. Escape in the protection dialog.** The draft is preserved and focus returns to the triggering element.

## Guarantee

**Every action the pointer can take, the keyboard can take, and focus is never left on nothing.**

## Acceptance criteria

- Having opened the protection dialog entirely by keyboard, pressing Escape keeps the draft and returns focus to the trigger.
- A collapsed row is not in the tab order.
- The axe-core suite reports no violation on the mounted library.

## Scope

This does not replace the baseline accessibility every other note owes; it verifies the flow. The suite cannot see a focus ring, contrast or hit size (`CLAUDE.md`, the accessibility test's header), so those remain a live-vault check.

## Asset-library implementation (2026-09-05)

Adaptation: native form submission, labelled controls, the existing focus trap and arrow-key handling; Escape keeps the draft. Covered by `assetLibraryKeyboard`, `assetDraftProtection` and the accessibility suite.

Delivered by pull request #70 (`codex/asset-library-delivery`). The acceptance checklist the package
carries is still unchecked in a real vault, so this note is Active rather than Done. Evidence and the
remaining limitations: [delivery record](../user-experience/asset-library-delivery/delivery-record.md),
row 16.

## Sources

`docs/user-experience/asset-library-delivery/backlog-complete.md` PBI-16 and its package feature
group; screens [AL00](../user-experience/asset-library-delivery/specification/screens/AL00-browse.md), [AL03](../user-experience/asset-library-delivery/specification/screens/AL03-create-object.md), [AL04](../user-experience/asset-library-delivery/specification/screens/AL04-edit-definition.md), [AL05](../user-experience/asset-library-delivery/specification/screens/AL05-unsaved-changes.md), [AL10](../user-experience/asset-library-delivery/specification/screens/AL10-narrow-and-theme.md); `delivery-record.md` row 16. The
`docs/user-experience/asset-library-delivery/pbis/` folder that held the package's own copy of this
item was moved here on 2026-09-05; its `id` was PBI-16.
