---
type: Issue
parent: "[[The project surface]]"
order: 60
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

# The post-await disposed guard in hydratePrices is redundant with the ticket

`ProjectDetailState.hydratePrices` (`src/presentation/views/ProjectDetailState.vue:85-91`)
checks `if (disposed || outcome === 'superseded') return 'superseded';` after awaiting
`detail.hydratePrices(...)`. `onBeforeUnmount` sets `disposed = true` and then calls
`detail.reset()`, which calls `prices.clear()` — and `clear()` in
`ProjectDetailStore.ts`'s `createPriceSection` bumps the section's own ticket
(`latest += 1`). `hydrate`'s own ticket check (`if (request !== latest) return 'superseded';`)
already answers `'superseded'` for exactly the case an unmount produces, before the
`disposed`-only check downstream ever needs to fire — the two mechanisms cover the identical
event.

## What is true today

The final review round of this pass confirmed the file's OTHER `disposed` check (the pre-await
one at line 86) is the one that is genuinely reachable and untested, and that check was fixed
in the fix wave at this branch's HEAD (a test watched red, per the ledger). The ledger's own
deferred note discusses the post-await `disposed ||` at line 89 as the one that may be
redundant given `reloadPrices`'s own guard and the store's ticket, and defers deciding which.

## What closes it

Either drive the case that would make the post-await `disposed` check matter on its own (one
where `reset()` runs WITHOUT going through `prices.clear()`'s ticket bump — if no such path
exists, none does), or delete `disposed ||` from that line and say so in a commit, trusting
`outcome === 'superseded'` alone. Deleting an unreachable guard recovers a branch this file's
own coverage cannot otherwise reach (CLAUDE.md: "an unreachable guard is not free").

## References

- [[The project surface]]
- `src/presentation/views/ProjectDetailState.vue` — the two `disposed` checks in
  `hydratePrices`, pre- and post-await.
- `src/presentation/stores/ProjectDetailStore.ts` — `createPriceSection`'s `clear()`, which
  bumps the ticket `reset()` relies on.
