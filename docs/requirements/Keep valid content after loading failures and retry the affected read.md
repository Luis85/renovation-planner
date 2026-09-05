---
type: PBI
parent: "[[Asset definitions and categories]]"
order: 80
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
dependsOn: "[[Inspect the complete definition of a selected asset]]"
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

# Keep valid content after loading failures and retry the affected read

A refresh that fails must not take the catalogue with it. Whatever loaded last stays on screen with a notice, the retry repeats only the read that failed, and a library the parser cannot read is a failure and not an empty vault.

## Actor

A renovator whose vault or plugin has just refused a read.

## Main flow

1. The library, or one of its sections, loads.
2. When it fails, a specific explanation is shown.
3. Valid previous content stays where there is any.
4. The renovator retries the failed read.

## Extensions

- **1a. The very first read fails.** A failure draws, not the empty state.
- **1b. The library holds only unreadable files.** That is a failure, not an empty library.
- **1c. A note declares a newer schema.** The plugin asks to be updated rather than repairing fields.
- **4a. They retry.** Only the read repeats; nothing is written.

## Guarantee

**A failed read is never presented as an empty dataset.**

## Acceptance criteria

- With a valid catalogue shown and a later refresh failing, the rows stay with a notice and Refresh repeats only the read.
- A first read that fails does not draw the empty-library state.

## Scope

No blanket leaf reset, and no write during a read retry.

## Asset-library implementation (2026-09-05)

Adaptation: the catalogue refresh retains the last successful rows and a warning; initial failures stay failures; shape and usage carry local retry buttons. Covered by the library and selection-store tests.

Delivered by pull request #70 (`codex/asset-library-delivery`). The acceptance checklist the package
carries is still unchecked in a real vault, so this note is Active rather than Done. Evidence and the
remaining limitations: [delivery record](../user-experience/asset-library-delivery/delivery-record.md),
row 13.

## Sources

`docs/user-experience/asset-library-delivery/backlog-complete.md` PBI-13 and its package feature
group; screens [AL09](../user-experience/asset-library-delivery/specification/screens/AL09-loading-and-errors.md); `delivery-record.md` row 13. The
`docs/user-experience/asset-library-delivery/pbis/` folder that held the package's own copy of this
item was moved here on 2026-09-05; its `id` was PBI-13.
