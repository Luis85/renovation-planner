---
type: Issue
parent: "[[Inspect a selected room]]"
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
effort: M
complexity: ""
business-value: ""
business-value-model: ""
---

# The cross-surface identity test starts after selection

## The question

The plan-editor foundation design §1 promises that a renovator can select a room from the canvas
or list and see the same stable identity in the canvas outline, list and Room Inspector
(`docs/superpowers/specs/2026-09-02-plan-editor-foundation-read-path-design.md:13-17`).
Criterion 1 of [[Inspect a selected room]] makes the same cross-surface claim, and
[[Render the selected room Inspector overview]] requires the heading, overlay and Inspector to
share one ID (`docs/requirements/Inspect a selected room.md:80` and
`docs/tasks/Render the selected room Inspector overview.md:24-28`).

The cited holding case starts after the canvas-to-selection boundary. At
`tests/presentation/editor/shell/roomInspector.test.ts:45-53` it writes
`SelectionStore` directly on line 47 and then checks only the Inspector's `data-rp-id` and copy.
It dispatches no canvas pointer event and inspects no Konva selection outline. The selected
`VLine` at `src/presentation/editor/layers/InteractionLayer.vue:220-229` has no name by which
this test could identify it.

## What is true today

- The implementation does derive the selected outline from the selected stable ID:
  `InteractionLayer.vue:108-119` looks up the sole selected ID in the hydrated zone map, and
  `InteractionLayer.vue:220-229` draws its solid outline.
- The Inspector carries the DTO ID independently at
  `src/presentation/editor/shell/RoomInspector.vue:142-146`.
- Measured with
  `rg -n "useSelectionStore\(\)\.select|pointerdown|pointerup|selection-outline|data-rp-id" tests/presentation/editor/shell/roomInspector.test.ts`:
  the file contains six direct store writes and the Inspector attribute assertion, but no
  pointer event and no named selection-outline assertion.
- The PBI amendment and task closing evidence nevertheless credit this case with the
  canvas/Inspector identity guarantee
  (`docs/requirements/Inspect a selected room.md:103-106` and
  `docs/tasks/Render the selected room Inspector overview.md:42-45`).

## Why it matters

A regression that stops a canvas click from selecting the room leaves this case green because
the test performs the missing transition itself. A second regression that suppresses or
misroutes the selected outline also leaves it green because the test never reads the interaction
layer. The title says three surfaces agree, while the assertions establish only that an Inspector
built from an already-selected ID repeats that ID.

## What closes it

Drive one real primary click on Kitchen through the mounted canvas, then assert in one case that
the resulting `SelectionStore` ID is `zone-kitchen`, a named solid selection outline is present,
the matching Room-list row carries that stable ID and reads pressed, and the Room Inspector's
`data-rp-id` is the same value. Give the selected line a stable test name such as
`selection-outline`; the hover line already uses this pattern at
`InteractionLayer.vue:207-217`. The discriminating mutations are to bypass the canvas selection
write, suppress the selected line, or bind the pressed row to another ID: each must fail the new
case while an Inspector-only assertion still passes.

Until that case exists, amend the PBI and task evidence to describe the narrower Inspector DTO
check rather than marking the cross-surface criterion met.

## References

- [[Inspect a selected room]]
- [[Render the selected room Inspector overview]]
- `docs/superpowers/specs/2026-09-02-plan-editor-foundation-read-path-design.md:13-17` — §1's
  canvas/list/Inspector stable-identity promise.
- `tests/presentation/editor/shell/roomInspector.test.ts:45-53` — the cited case begins with a
  direct selection-store write.
- `src/presentation/editor/layers/InteractionLayer.vue:108-119,220-229` — the independent
  selected-outline path the case does not inspect.
- Reviewed at commit `16757d6d`, PASS 3.
