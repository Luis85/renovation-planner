---
type: Issue
parent: "[[The project surface]]"
order: 50
status: New
started: ""
finished: ""
horizon: Now
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

# onPriceCancel has no readOnly guard

`AssetPriceRow.vue`'s four price-mutating functions each open with a paused-state guard.
`onPriceInput`, `onPriceCommit` and `onClear` all check `price.pending.value || props.readOnly
|| props.refreshBlocked`. `onPriceCancel` (line 106) checks only
`price.pending.value || props.refreshBlocked` — `props.readOnly` is missing from its guard,
the one function in the set that omits it.

## What is true today

Unreachable through the DOM today: both draft-action buttons (`showClear`, `showDraftActions`)
and the whole price `<input>` are `v-if="!readOnly"`, so a read-only row draws no control that
calls `onPriceCancel` by click or by `keydown.esc`. It IS reachable through
`watch(() => props.draftReset, onPriceCancel)` (line 130), which fires on any `draftReset`
change regardless of `readOnly` — a discard-drafts dialog elsewhere in the same session bumps
`draftReset` and this watcher runs `onPriceCancel()` on every mounted `AssetPriceRow`,
read-only ones included.

## What closes it

Add `|| props.readOnly` to `onPriceCancel`'s guard, matching its three siblings. A case
driving `draftReset` on a read-only row and asserting `price.onCancel()`/`dirty.value` did not
change would close it — watched red against today's code first.

## References

- [[The project surface]]
- `src/presentation/views/AssetPriceRow.vue` — `onPriceCancel` and its three sibling guards.
