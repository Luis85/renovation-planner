---
type: Issue
parent: "[[Selection]]"
order: 30
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

## References

- [[Selection]]
- [[Compose predictive and contextual Select surfaces]]
- Reviewed at commit `16757d6d` — PASS 2
