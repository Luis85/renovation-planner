---
type: Issue
parent: "[[Selection]]"
order: 50
status: Done
started: 2026-09-04
finished: 2026-09-04
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

# The Escape contract clears selection before a Select drag is abandoned

## The question

Design spec §6.3 at
`docs/superpowers/specs/2026-09-02-plan-editor-foundation-read-path-design.md:297-304` nests
draft cancellation under an active non-Select tool, then sends Select with a selection directly
to selection clearing. `src/presentation/editor/escapeRouting.ts:16-34,44-53` deliberately
checks every active tool's draft first.

## What is true today

The implementation's behaviour is safer than the approved text: Escape during a Select drag
abandons the drag and preserves its selection. The measured case at
`tests/presentation/editor/escapeRouting.test.ts:47-52` asserts that order and would fail if
selection were cleared first. Both `src/presentation/editor/escapeRouting.ts:25-34` and the
current [[Selection]] amendment document the deviation, but §6.3 still specifies the opposite
branch.

## Why it matters

The contract tells a future maintainer to restore behaviour that clears the object from under a
pointer while it is being dragged. Code, test, task evidence and approved design cannot all be
true at once, so a contract-driven refactor can turn the deliberate safety improvement into a
regression.

## What closes it

Amend design spec §6.3 to adopt the implemented precedence explicitly: after a running pan, any
active tool with a draft cancels that nearer interaction before Select may clear selection.
Keep the existing Select-drag test as the discriminating check and update the parent/task
closing evidence to cite the amended rule rather than a deviation.

## What closed it

**2026-09-04.** §6.3 amended to the implemented order (R1); holding test `escapeRouting.test.ts` 'Select mid-drag cancels the drag before it would clear the selection'.

## References

- [[Selection]]
- [[Return selection to the safe floor state]]
- Reviewed at commit `16757d6d` — PASS 2
