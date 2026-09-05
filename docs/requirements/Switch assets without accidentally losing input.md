---
type: PBI
parent: "[[Asset definitions and categories]]"
order: 40
status: Active
started: "2026-09-05"
finished: ""
horizon: "MVP"
start: ""
due: ""
risk: ""
priority: "P0"
assignee: ""
iteration: ""
dependsOn: "[[Explicitly save or discard asset metadata changes]]"
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

# Switch assets without accidentally losing input

Once a draft exists, every other gesture in the library — selecting a row, opening a note, leaving for a project — can destroy it. This note is the guard: a dialog before any action that would drop the draft, and no dialog for the actions that do not.

## Actor

A renovator mid-edit.

## Main flow

1. The renovator changes a draft.
2. They request another selection or a navigation.
3. The protection dialog asks whether to keep editing or discard.
4. They choose, and the library continues accordingly.

## Extensions

- **2a. The action is a search, a group expansion or a width change.** No dialog; the draft is kept.
- **3a. They press Escape.** That is Keep editing.
- **4a. They choose Discard.** The pending action runs exactly once.
- **4b. They choose Keep editing.** The drafted asset stays active with its draft; the requested target does not open.

## Guarantee

**A draft is lost only by an explicit Discard.**

## Acceptance criteria

- With a dirty draft on A, selecting B and choosing Keep editing leaves A active with its draft and B unopened.
- Choosing Discard runs the deferred selection once.
- Escape in the dialog keeps the draft.

## Scope

No silent autosave and no crash recovery: Obsidian's `onClose` offers no veto, so a forced leaf close, a settings remount or a reload can still drop a draft, and that limit is stated rather than papered over.

## Asset-library implementation (2026-09-05)

Missing at baseline. `libraryDraftGuard` fronts the root and inspector actions through `DialogHost`; search, groups and the narrow Back keep the draft. Covered by `assetDraftProtection` and the keyboard tests.

Delivered by pull request #70 (`codex/asset-library-delivery`). The acceptance checklist the package
carries is still unchecked in a real vault, so this note is Active rather than Done. Evidence and the
remaining limitations: [delivery record](../user-experience/asset-library-delivery/delivery-record.md),
row 06.

## Sources

`docs/user-experience/asset-library-delivery/backlog-complete.md` PBI-06 and its package feature
group; screens [AL05](../user-experience/asset-library-delivery/specification/screens/AL05-unsaved-changes.md); `delivery-record.md` row 06. The
`docs/user-experience/asset-library-delivery/pbis/` folder that held the package's own copy of this
item was moved here on 2026-09-05; its `id` was PBI-06.
