---
type: Issue
parent: "[[Selection]]"
order: 10
status: New
started: ""
finished: ""
horizon: Now
start: ""
due: ""
risk: ""
priority: high
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

# A deleted hover target keeps the target cursor active

## The question

Design spec §6.5 requires an identity that disappears on hydrate to be retired, while §6.2
requires the canvas cursor to return to its default when no hover target applies.
`src/presentation/editor/runtime.ts:447-464` retires missing IDs from `selectedIds` only; it
does not inspect `renderState.hoveredObjectId`.

## What is true today

The stale drawing is hidden: `src/presentation/editor/layers/InteractionLayer.vue:87-106`
returns no hover outline when the hydrated zone map no longer contains the hovered ID. The
cursor takes a different path. `src/presentation/editor/surface/EditorSurface.vue:182-191`
emits `rp-plan-canvas-target` whenever the hover ID is non-null, without checking whether that
ID still resolves. The measured retirement case at
`tests/presentation/editor/runtime.test.ts:304-315` asserts only that `selectedIds` becomes
empty, so the stale hover survives its evidence.

## Why it matters

After a hovered zone is deleted or becomes unreadable, the outline disappears but the pointer
still promises that clicking will select a target. The two predictive channels contradict each
other until another pointer move happens to overwrite the stale ID.

## What closes it

Retire `renderState.hoveredObjectId` in the same successful-hydrate watcher when the ID is absent
from the new zone map. Extend the retirement test by seeding both a selected and hovered ID,
hydrating without that zone, and asserting both the hover ID and target cursor class are gone;
keep the surviving-ID direction beside it.

## References

- [[Selection]]
- [[Compose predictive and contextual Select surfaces]]
- Reviewed at commit `16757d6d` — PASS 1
