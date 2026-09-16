---
type: Issue
parent: "[[Open a floor plan in the Obsidian editor shell]]"
order: 110
status: Done
started: 2026-09-16
finished: 2026-09-16
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

# A settings save clears the unrecovered-write warning without repairing the vault

`useSaveStateStore`'s `unrecoveredWrite` field
(`src/presentation/editor/save-state/save-state-store.ts:73`) is documented as sticky for the
MOUNT's life, not the leaf's: nothing in the store ever clears it once set, `resolveOk`
included. But a Plan Editor leaf remounts on every settings save — `saveSettings` →
`rebindOpenViews` → `PlanEditorView.rebind` calls `unmount()` then `sync()`, and `sync()`'s
`mount()` runs `app.use(createPinia())`, a fresh Pinia with a fresh `unrecoveredWrite` starting
at `false`. So a user who sees the warning and then saves ANY setting — units, currency,
verbose logging, one of the library rows — with that leaf still open loses the warning with
the vault unrepaired. Reopening the leaf has the same effect for the same reason.

## Closed, 2026-09-16

The incident is `PlanEditorView`'s own `unrecoveredWrite` now — a field on the view, emitted by
`getState` and read back by `setState` beside `planId`, with `mount` seeding each fresh store
through `markUnrecovered` and a sync watcher handing a newly raised one back. So a settings
save, a close-and-reopen of the leaf and a restart all keep the warning, and nothing clears it
(R1's other half is untouched: this layer still cannot tell a repairing write from any other).
The pinned case below asserts survival now, under the title "keeps a leaf’s unrecovered-write
flag across a rebind, re-seeded into the fresh Pinia";
`tests/presentation/views/planEditorIncident.test.ts` raises the incident through the real
dispatch path and walks the lifecycle.

**Not closed by it:** a SECOND Plan Editor leaf on the same plan is still ungated by the first
leaf's incident, with or without a rebind — a pre-existing hole needing an affected-identity
model — and the Asset Designer and the project view's work section each still hold a
mount-local flag of their own.

## What was true before it

Pinned rather than closed: `tests/plugin/rootSwapRebind.test.ts` "drops a leaf’s
unrecovered-write flag on rebind — the recorded gap, not the desired behaviour" asserted the
window existed, it did not refuse it. Ruling R1
already accepts a stale warning over a false all-clear as the lesser defect — the only
in-session event that actually repairs a half-written vault is a successful retry of the same
delete resolution over the same rows, which the dispatch wrapper cannot identify — and this
ruling (T12) is the narrower half of that same trade: sticky for the mount rather than for the
leaf.

## What closes it

Carry the flag as view-owned state the way `planId` already is, rather than as Pinia store
state that a rebind discards. That is a change with its own test, outside the scope this pass
gave E3, and it is what would let `rootSwapRebind.test.ts`'s pinned case flip from asserting
the drop to refusing it.

## References

- [[Open a floor plan in the Obsidian editor shell]]
- `src/presentation/editor/save-state/save-state-store.ts` — the `unrecoveredWrite` field's own
  docblock, which records Ruling R1 and the mount-vs-leaf distinction in full.
- Ruling T12, `.superpowers/sdd/2026-09-05-improvement-and-polish-pass/progress.md` — why this
  pass narrowed the claim rather than closing the gap.
