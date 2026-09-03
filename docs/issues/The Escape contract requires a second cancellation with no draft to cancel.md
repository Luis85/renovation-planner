---
type: Issue
parent: "[[Selection]]"
order: 60
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
effort: S
complexity: ""
business-value: ""
business-value-model: ""
---

# The Escape contract requires a second cancellation with no draft to cancel

## The question

Design spec §6.3 at
`docs/superpowers/specs/2026-09-02-plan-editor-foundation-read-path-design.md:299-304` says a
non-Select tool with no accumulated draft receives `cancelGesture()` and then returns to
Select. `src/presentation/editor/escapeRouting.ts:35-40,44-51` calls only
`setTool('select')` because switching tools deactivates the outgoing tool.

## What is true today

The two spellings are equivalent only under today's lifecycle: the `hasDraft()` gate has already
answered false, and `setTool` deactivates the outgoing tool. The source records that dependency
at `src/presentation/editor/escapeRouting.ts:35-40`. The measured no-draft case at
`tests/presentation/editor/escapeRouting.test.ts:38-42` asserts the tool switch but neither
requires `cancelGesture()` nor proves it remains unnecessary, so contract and code disagree
while the suite stays green.

## Why it matters

A future tool can distinguish cancellation from deactivation, or the switching lifecycle can
change, and neither the contract nor the test says which semantics Escape owns. Blindly adding
the contract's second call could also cancel twice once switching deactivates the tool.

## What closes it

Decide and state the equivalence explicitly. The smallest adopted close is to amend §6.3 so a
no-draft temporary tool returns through `setTool('select')`, whose deactivation is the
cancellation boundary, and extend the route test to assert `cancelGesture()` is not called on
that arm. If cancellation must remain a separate contract, call it before switching and add a
ToolManager test proving the pair settles exactly once.

## References

- [[Selection]]
- [[Return selection to the safe floor state]]
- Reviewed at commit `16757d6d` — PASS 2
