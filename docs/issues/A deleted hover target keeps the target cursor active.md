---
type: Issue
parent: "[[Selection]]"
order: 10
status: Done
started: 2026-09-04
finished: 2026-09-04
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

## What closed it

**2026-09-04.** `registerSelectionRetirement` takes the leaf's `RenderState` and clears
`hoveredObjectId` — with `hoveredTargetKind` beside it — in the same successful-hydrate watcher
that retires the selection, when the hovered id is absent from the new zone map. So both
predictive channels withdraw together: the outline already did on its own, and the cursor now
does as a fact rather than as a race against the next pointer move. Holding test:
`tests/presentation/editor/runtime.test.ts` › 'a selected AND hovered zone that disappears from
the next hydrate is retired from both, and the cursor stops promising it', which seeds a selected
AND hovered id, asserts `rp-plan-canvas-target` is on the canvas before the hydrate and gone
after, and reads both render-state fields back as `null`. The surviving-ID direction is 'keeps a
selected id that survives the next hydrate untouched', extended to seed and re-read the hover so
an unconditional clear fails there. Both mutation-checked: deleting the watcher's three hover
lines reddens the first at `expected 'zone-kitchen' to be null`. Commit "fix(select): the cursor
tells a handle from a body, and a deleted hover target is retired with the selection".

## References

- [[Selection]]
- [[Compose predictive and contextual Select surfaces]]
- Reviewed at commit `16757d6d` — PASS 1
