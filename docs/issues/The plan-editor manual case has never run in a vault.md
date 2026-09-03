---
type: Issue
parent: "[[Errors, diagnostics and the test harness]]"
order: 90
status: New
started: ""
finished: ""
horizon: Now
start: ""
due: ""
risk: ""
priority: medium
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
effort: M
complexity: ""
business-value: ""
business-value-model: ""
---

# The plan-editor manual case has never run in a vault

## The question

Spec §10 assigns live host focus and real sidebar-width behavior to
`docs/tests/cases/Open a floor and select a room.md:30-57`. Its Runs table at
`docs/tests/cases/Open a floor and select a room.md:79-81` records no execution: which of those
host-only expectations has actually been observed in a vault?

## What is true today

[[Open a floor and select a room]] has a complete ten-step procedure, but its Runs table says
**Not yet run in a vault**. Its pass conditions include Obsidian-owned behaviour that the suite
and browser harness cannot establish: command-palette opening and plan picking, Electron focus
restoration, real leaf width and whether focusing a tab actually reveals it. Its desktop step
also asks a real screen reader to announce the selection-clear guidance.

The branch account relies on live Obsidian for those host behaviours, so the written case is a
plan to verify them rather than evidence that they work.

Measured with `rg "Not yet run in a vault" "docs/tests/cases/Open a floor and select a
room.md"`; it returns the sole Runs row.

## Why it matters

The unrun rows are exactly where a green automated gate is weakest. Treating the authored case
as a completed walkthrough turns the host and assistive-technology expectations it actually
exercises into implied findings. The separate keymap issue remains separate because no step in
this procedure currently invokes that keymap.

## What closes it

Run the case in the test vault, record the build, date and outcome in its Runs table, and file
any host-only failures separately. This is actionable verification work retained by the known
amendment, not a request to widen the automated suite.

## Decision

**2026-09-04.** Not now. Closing this means a person opening the vault built by
`npm run test-build` and walking the eleven steps; no agent here can. It reopens when the Runs
table gains a row. Status stays New.

## References

- [[Errors, diagnostics and the test harness]]
- [[Keep the editor truthful across failure and narrow layouts]]
- [[Open a floor and select a room]]
- Reviewed at commit `16757d6d`, PASS 4.
