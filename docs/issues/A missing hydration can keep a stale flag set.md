---
type: Issue
parent: "[[Open a floor plan in the Obsidian editor shell]]"
order: 20
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

# A missing hydration can keep a stale flag set

## The question

Does every hydration outcome retire a stale warning when there is no longer stale content on
screen?

## What is true today

A failed keep-previous hydration sets `stale` while leaving the ready content visible
(`src/presentation/stores/ProjectStore.ts:34-46`). A later plan- or project-not-found result
calls `markMissing`, which clears the project, plan, zones and unreadable count and sets
`status = 'missing'`, but does not clear `stale`
(`src/presentation/stores/ProjectStore.ts:49-70`,
`src/presentation/stores/ProjectStore.ts:199-219`).

Measured with `rg -n "markMissing|stale" src/presentation/stores/ProjectStore.ts`: `fail`,
successful hydration and `reset` clear the flag; `markMissing` does not. Existing store coverage
asserts the stale flag after a failed re-read and separately asserts a missing project, but never
runs those outcomes in sequence (`tests/presentation/stores/stores.test.ts:303-333`).

## Why it matters

The parent distinguishes a missing floor from stale last-valid content
(`docs/requirements/Open a floor plan in the Obsidian editor shell.md:58-64`). Keeping the flag
after `markMissing` leaves state claiming that content is stale after that content has been
removed, violating the task's requirement that missing and stale states render differently and
SDD §14's rule that Pinia state be a truthful, rebuildable projection.

## What closes it

Include `stale` in `HydrationMissingRefs` and set it to false in `markMissing`, alongside the
content that is being blanked.

Add one store test that hydrates successfully, fails a keep-previous refresh to establish
`stale === true`, then returns `ok(null)` from either the plan or project read and asserts
`status === 'missing'`, `plan === null`, and `stale === false`. That sequence discriminates the
fix from the existing isolated missing and stale cases.

## References

- [[Open a floor plan in the Obsidian editor shell]]
- [[Keep the editor truthful across failure and narrow layouts]]
- `src/presentation/stores/ProjectStore.ts:34-70`
- `src/presentation/stores/ProjectStore.ts:199-219`
- `tests/presentation/stores/stores.test.ts:303-333`
- `docs/requirements/Open a floor plan in the Obsidian editor shell.md:58-64`
- SDD §14, State Management
- Reviewed at commit 16757d6d
- PASS 1
