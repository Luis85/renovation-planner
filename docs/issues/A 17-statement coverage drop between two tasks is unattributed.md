---
type: Issue
parent: "[[Errors, diagnostics and the test harness]]"
order: 150
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

# A 17-statement coverage drop between two tasks is unattributed

Coverage moved from 99.26/98.10/99.18/99.58 to 99.10/98.05/99.08/99.39
(statements/branches/functions/lines) between Task 15 and Task 16 of this pass. The
controller's quiet re-run reproduces the lower figures, so it is real rather than parallelism
contention — but a baseline run with only `src`/`tests` rewound to Task 15's commit
(`bf1077a3`) failed three unrelated tests and wrote no usable report, and the final review's
reviewer cleared every file in Task 16's OWN diff by inspection (every added statement
reached, nothing made unreachable). Neither traced the drop to a specific file.

## What is true today

Ruling T16 records the drop as REAL and UNATTRIBUTED: floors still pass (99.10 ≥ 99,
98.05 ≥ 98), so nothing here is red, but roughly 17 statements somewhere outside Task 16's own
files went from covered to uncovered (or were added uncovered) between the two measurements,
and no report names which ones.

## What closes it

A script that diffs two `coverage-final.json` files per file — which lines/branches were
covered in one run and not the other — turns "chase it for another 6 minutes of gate per
attempt" into a single diff. That script is the improvement; running it against the two
commits this ruling names (`a757dc37`/`bf1077a3` before, `248d7a91`/`bf1077a3` after) is what
would finally attribute the 17 statements, once it exists.

## References

- [[Errors, diagnostics and the test harness]]
- Ruling T16, `.superpowers/sdd/2026-09-05-improvement-and-polish-pass/progress.md` — the full
  account of what was and was not tried.
