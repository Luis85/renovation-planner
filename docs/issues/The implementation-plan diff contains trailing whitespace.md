---
type: Issue
parent: "[[Errors, diagnostics and the test harness]]"
order: 120
status: New
started: ""
finished: ""
horizon: Now
start: ""
due: ""
risk: ""
priority: low
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
effort: S
complexity: ""
business-value: ""
business-value-model: ""
---

# The implementation-plan diff contains trailing whitespace

## The question

The plan's Global Constraints treat its Git diff as the review record, but
`docs/superpowers/plans/2026-09-02-plan-editor-foundation-read-path.md:498` contains a trailing
space. Why does the branch's own patch fail the standard whitespace-integrity check?

## What is true today

`git diff --check d06d4822..16757d6d` reports trailing whitespace at line 498 of the Plan
Editor foundation implementation plan. The whitespace is part of the reviewed branch diff and
survives at the shipped head.

## Why it matters

Trailing whitespace is low impact, but it makes a standard diff-integrity check fail and adds
noise to later edits of a plan already used as the audit record for this increment.

## What closes it

Remove the trailing whitespace from the affected plan line and confirm the same diff check no
longer reports it.

## References

- [[Errors, diagnostics and the test harness]]
- [[Approve the Editor foundation slice contract]]
- Reviewed at commit `16757d6d`, PASS 5.
