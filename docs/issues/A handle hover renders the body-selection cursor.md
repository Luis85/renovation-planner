---
type: Issue
parent: "[[Selection]]"
order: 30
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
effort: M
complexity: ""
business-value: ""
business-value-model: ""
---

# A handle hover renders the body-selection cursor

## The question

Design spec §6.2 distinguishes a `pointer` over a selectable body from a `grab` cursor over a
vertex handle. `src/presentation/editor/selection/resolveSelectionTarget.ts:5-8,23-29` returns
that distinction, but `src/presentation/editor/tools/select-tool.ts:179-186` stores only
`target.id` in `renderState.hoveredObjectId`.

## What is true today

By the time the cursor is computed, the target kind has been erased.
`src/presentation/editor/surface/EditorSurface.vue:182-191` maps every non-null Select hover to
the single `rp-plan-canvas-target` class. The measured resolver cases at
`tests/presentation/editor/selection/resolveSelectionTarget.test.ts:29-34` prove handle and body
resolution separately, but no cursor case carries either result through the render state. The
task amendment currently calls the cursor half landed while also recording that one class
answers both.

## Why it matters

The user receives the same affordance for selecting a room and grabbing one of its editable
vertices. The pointer predicts the right stable ID but the wrong interaction, so the most
precise target on the canvas is communicated as a body selection.

## What closes it

Preserve the resolver's target kind in transient render state and map body to pointer, handle to
grab, and null to the resting cursor. Add one cursor test that hovers the selected room near a
vertex and expects grab, then moves into its body and expects pointer; mutating either branch to
the shared class must fail it.

## What closed it

**2026-09-04.** `RenderState` carries `hoveredTargetKind: 'body' | 'handle' | null` beside
`hoveredObjectId` — a SECOND field rather than a richer id, so none of the id's existing readers
moved (ruling R8) — written and cleared together at all four sites in `SelectTool` and reset with
the id. `EditorSurface`'s `cursorClass` maps `handle` to `rp-plan-canvas-grab`, `body` to
`rp-plan-canvas-target`, and a null hover to no class at all; `styles/editor-cursors.css` declares
`cursor: grab` for the new class. Holding test:
`tests/presentation/editor/canvasNavigation.test.ts` › 'says grab over a vertex handle of the
selected room and pointer over its body', which selects the room, hovers within the grab radius of
its (198,198) vertex, then its body, then empty canvas. Mutation-checked: returning
`rp-plan-canvas-target` from the handle arm reddens it at `expected [ 'rp-plan-canvas-target' ] to
deeply equal [ 'rp-plan-canvas-grab' ]`. `tests/presentation/editor/tools/selectTool.test.ts`'s
two hover cases assert the kind is `'body'` while hovering and `null` after a deactivate and after
a press. Commit "fix(select): the cursor tells a handle from a body, and a deleted hover target is
retired with the selection".

## References

- [[Selection]]
- [[Compose predictive and contextual Select surfaces]]
- Reviewed at commit `16757d6d` — PASS 2
