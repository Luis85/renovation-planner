---
type: Issue
parent: "[[Quantity, cost and the end-to-end loop]]"
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

# Two changed costs from this pass were never measured

Two changes in this pass traded a concurrency property for a correctness one, and neither was
measured for its performance cost. `ReversibleCalibratePlan.announce`
(`src/application/commands/plan/ReversibleCalibratePlan.ts:243-257`) now publishes each
`ZoneGeometryChanged` event ONE AT A TIME inside a `for` loop with `await` per iteration — the
docblock explains this replaced a concurrent `Promise.all` because the per-object events each
start a recalculation cascade that must not race its siblings. `UpdateAsset.execute`
(`src/application/commands/asset/UpdateAsset.ts:87`) now acquires the asset's reference lock
UNCONDITIONALLY (`await this.locks.acquire([current.id], [])`), regardless of whether the edit
actually changes the asset's unit kind — the docblock says the lock is held "from before
`listByAsset` through the save" because a plain `unitCost` edit landing inside a
kind-change's compensated sequence was the defect this closed.

## What is true today

Both changes are correctness fixes, not regressions to revert — but neither carries a
measurement of what it costs on the case each docblock explicitly calls out: a calibration
touching a LARGE plan (many zones, now serialized one event at a time instead of fanned out),
and an asset edit against a BUSY library (every `UpdateAsset` now contends on the same lock a
kind-change would have needed anyway).

## What closes it

A measurement, not a change: time `announce`'s sequential publish against its old
`Promise.all` shape on a plan with a realistic zone count, and time `UpdateAsset.execute`'s
lock acquisition under concurrent edits to the same asset. If either shows a real cost, the
next work is scoped from that number rather than from a guess.

## References

- [[Quantity, cost and the end-to-end loop]]
- `src/application/commands/plan/ReversibleCalibratePlan.ts` — `announce`'s sequential
  publish and its own docblock's reasoning.
- `src/application/commands/asset/UpdateAsset.ts` — the unconditional lock acquisition.
