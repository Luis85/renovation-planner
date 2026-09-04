---
type: Issue
parent: "[[Inspect a selected room]]"
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

## What closed it

**2026-09-04.** `InteractionLayer.vue`'s selected `VLine` carries `name: 'selection-outline'`,
matching the hover line's existing `name: 'hover-outline'`. Holding test:
`tests/presentation/editor/shell/roomInspector.test.ts` › 'the Room Inspector, through the real
mounted editor' › "one real click on Kitchen: store, named outline, pressed list row and
Inspector all carry zone-kitchen", which drives one real primary click through the mounted
canvas and asserts, in one case, the resulting `SelectionStore` id, the named
`.selection-outline` Konva line and the Room Inspector's `data-rp-id` — three of the four
cross-surface facts; mutation-checked by bypassing the canvas selection write (red at
`selectedIds`) and by suppressing the selected line (red at `find('.selection-outline')`), both
reverted. The fourth fact — the Room-list row reading pressed — cannot be read from that same
mount: `EntityInspector` renders `FloorInspector` (and with it `RoomSummaryList`) only while
`selectedIds.length === 0`, so the row this click would select is unmounted the instant it
selects. That clause is held instead by the existing
`tests/presentation/editor/shell/roomSummaryList.test.ts` › "marks the row matching the current
selection pressed, and no other". Commit "test(editor): fakes that respect the id and the
width, and six cases whose bodies now hold what their names claim".

**2026-09-04, fix round 1.** Two review findings on the closure above: the first case's title
claimed a "pressed list row" fact its own body never asserted, and the sibling case it cited for
that fact proved only that the pressed row and the selected id shared an ARRAY POSITION, never
that the row carried the id — `RoomSummaryList.vue`'s row had no `data-rp-id` at all. Both are
fixed now, and the fourth cross-surface fact — the Room-list row reading pressed AND carrying
the selected stable id — is genuinely closed:

- `RoomSummaryList.vue`'s row carries `:data-rp-id="record.id"` beside its existing
  `:aria-pressed`.
- `tests/presentation/editor/shell/roomSummaryList.test.ts` › "marks the row matching the
  current selection pressed, and no other" now additionally asserts that the row reading
  `aria-pressed="true"` has `data-rp-id` equal to the selected id, and no other row does;
  mutation-checked by decoupling `data-rp-id` from the pressed row's own id (swapping the two
  fixture ids on the binding) — red at that new assertion specifically, with the pre-existing
  `aria-pressed` assertion staying green, which is what proves the new assertion discriminates
  rather than merely repeating the first; reverted.
- The click-driven case in `roomInspector.test.ts` is retitled to what its own body proves —
  "one real click on Kitchen: store, named outline and Inspector all carry zone-kitchen (the
  pressed row is roomSummaryList.test.ts's case)" — and its docblock now says the sibling case
  proves the id, not only the pressed state.

Holding tests: both cases above, both green; commit "test(selection): the pressed room row
carries its stable id, and the identity case's title matches its body".

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
