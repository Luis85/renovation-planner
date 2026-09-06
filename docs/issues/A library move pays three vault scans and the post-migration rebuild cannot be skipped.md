---
type: Issue
parent: "[[Asset library]]"
order: 30
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

# A library move pays three vault scans and the post-migration rebuild cannot be skipped

`createCompositionRoot` builds a fresh `ProjectIndex` per root — the
`new ReconcilingProjectIndex(...)` construction in `src/plugin/composition-root.ts` — so a
library-folder move runs the migration's own
step-0 scan, then `applySettings`'s post-migration rebuild, for three full vault scans and
three rebuild publishes in total (finding G8 of the 2026-09-05 whole-tree review). The obvious
fix — have `applySettings` skip its rebuild when the migration just ran one — was tried and
reverted within this pass: a regression assertion in
`tests/plugin/settings/settingsTab.test.ts` went red under `{ rebuild: false }`, because
skipping the rebuild leaves the INCOMING root's index empty rather than merely stale.

## What is true today

`applySettings` still rebuilds unconditionally after a library-folder swap. The migration's
own step-0 scan is kept deliberately — its comment names a `TFolder` rename leaving descendants
at stale paths (the same gap
[[A folder rename never reaches the project index]] describes) — so removing either scan
without addressing what the other buys is not safe on its own.

## What closes it

Carrying the index across a root swap, rather than rebuilding it fresh per root, is what
would let `applySettings` skip a rebuild it just paid for without leaving the incoming root's
index empty. That is a change to what a root OWNS (today `createCompositionRoot` treats the
index as root-scoped state), not a one-line guard in `applySettings`. The regression case
already exists (`settingsTab.test.ts`'s `{ rebuild: false }` assertion) and is the test to
watch red before any fix, then green once the index survives the swap.

## References

- [[Asset library]]
- [[A folder rename never reaches the project index]] — the sibling gap the migration's own
  step-0 scan exists to paper over.
- Ruling T4/G8, `.superpowers/sdd/2026-09-05-improvement-and-polish-pass/progress.md` — why
  this pass withdrew the fix rather than shipping it.
