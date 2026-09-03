---
type: Issue
parent: "[[View rooms in the Standard Plan View]]"
order: 30
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

# The completed floor-summary task promises a stale aggregate no model can represent

## The question

Can a Done task claim that stale is distinct for every aggregate when the aggregate model has no
stale state?

## What is true today

`docs/tasks/Present the truthful floor summary and selection guidance.md:30-33` requires
supported zero, unavailable, unreadable and stale to be distinct for every aggregate. The same
task's Closing evidence at lines 63-64 says the opposite: stale is represented by the additive
warning strip because `Aggregate<T>` has no stale member.

The implementation confirms the latter.
`src/presentation/read-models/spatialRecords.ts:55-58` defines exactly three states:
`available`, `partial` and `unavailable`. The read-path design's §3 contract at
`docs/superpowers/specs/2026-09-02-plan-editor-foundation-read-path-design.md:112-125` defines
the same closed union and no stale aggregate.

Measured command:
`rg -n "state: '(available|partial|unavailable)'|stale" src/presentation/read-models/spatialRecords.ts "docs/tasks/Present the truthful floor summary and selection guidance.md"`
finds the three source states and the task's incompatible stale criterion; it finds no model
state that could satisfy that criterion.

## Why it matters

The task is Done, so its criteria read as delivered promises. A future reader can either add a
fourth aggregate state that the approved design did not choose, or trust Closing evidence that
does not meet the criterion above it. Both readings make the completion record unreliable.

## What closes it

The smallest fix is a task amendment: narrow the criterion to the three aggregate states the
model represents and state separately that floor-level staleness is an additive global warning.
Update Closing evidence to map those two promises independently. No product test is needed; the
existing closed TypeScript union is the check for the three aggregate states, and the amendment
removes the impossible fourth promise rather than implementing it.

## References

- [[View rooms in the Standard Plan View]]
- [[Present the truthful floor summary and selection guidance]]
- Reviewed at commit 16757d6d.
- PASS 4.
