---
type: Issue
parent: "[[Shared UI vocabulary]]"
order: 70
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

# Three dialog openers each double-pass the same busy ref

`openNewAssetDialog` (`src/presentation/views/newAssetDialog.ts:56-71`) passes `deps.busy` to
`openDialog` twice: once inside `props: { busy: deps.busy, ... }` for the form component, and
again as the call's own top-level `busy: deps.busy`. `ViewRoot.vue` does the same for
`newProjectBusy` (lines ~226 and ~233) and for `newAssetBusy`, and `ProjectDetailState.vue`
does it for `newPlanBusy` (lines ~153 and ~180). `ViewRoot.vue`'s own docblock explains why
both passes exist: one ref read and written by two places at once, handed to the form as its
own `busy` prop (which writes `submitting` into it) and read by `DialogHost` (via the
top-level `busy` key) to refuse Escape and disable Cancel while a submit is in flight.

## What is true today

The 2026-09-05 whole-tree review's finding V11 verdict is PLAUSIBLE/low: the double-pass is
correct at all three sites and only the REPETITION of the pattern — the same two-key shape
written out by hand three times — is worth sharing, not the behaviour itself.

## What closes it

An optional two-line helper (e.g. a small `busyDialogProps(busy)` returning `{ busy }` to
spread into both positions, or a thin wrapper over `openDialog` that takes one `busy` ref and
threads it to both places itself) would remove the duplication without changing behaviour at
any of the three sites. The review explicitly did not schedule this; it is a small, optional
cleanup rather than a defect.

## References

- [[Shared UI vocabulary]]
- `src/presentation/views/newAssetDialog.ts` — `openNewAssetDialog`'s two `busy` passes.
- `src/presentation/views/ViewRoot.vue` — the docblock explaining why the ref is read and
  written by two places at once.
- `docs/superpowers/specs/2026-09-05-whole-tree-review-findings.md` — finding V11.
