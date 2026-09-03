---
type: Task
parent: "[[Inspect a selected room]]"
order: 20
status: Done
horizon: "MVP"
release: "[[MVP]]"
---

# Render the selected room Inspector overview

## Evidence

[M00](../user-experience/renovation-planner-editor-specs/screens/M00-kitchen-selected-overview.md) locks room identity, context, truthful overview values and future navigation in one contextual Inspector.

## Why it matters

The selected outline becomes useful only when it leads to understandable room information without leaving the plan.

## Approach

Render Room name/type, floor context, derived area and supported summaries; represent unavailable future sections explicitly and bind every action to the selected stable ID.

## Acceptance criteria

- Heading, overlay and Inspector share one ID.
- Available values use homeowner language.
- Unsupported sections never show invented counts or statuses.
- Empty supported sections have their own empty state.
- Clearing selection restores the floor overview.

## Risks

Locked mockup examples can be mistaken for production fixture values.

## Outcome

A selected room has a useful, honest overview in spatial context.

## Closing evidence

**2026-09-03**, the plan editor foundation's first increment.
`tests/presentation/editor/shell/roomInspector.test.ts` drives the real mounted editor: 'heading,
canvas selection and Inspector share one id; the type and floor are homeowner words' is criteria 1
and 2, with 'falls back to the generic "Other" label for a zone type nothing here labels' holding
the arm a new `ZoneType` would take. Criterion 3 is 'renders the three homeowner questions in
order, each unavailable, with no button and no count' and 'lists costs, documents, photos and
notes as unavailable rows without controls' — no invented count, no invented status, and no
control that would do nothing. Criterion 4 is the Requirements panel, which is the one SUPPORTED
section here and keeps its own empty state (the pre-existing
`tests/presentation/editor/inspector/` cases); 'keeps the Requirements panel and the Delete button'
is what pins it surviving the frame/body split. Criterion 5 is
`tests/presentation/editor/shell/floorInspector.test.ts`. The room name is an `<h3>` under the
frame's `<h2>` rather than a second `<h2>`, which is a heading-order decision stated in
`RoomInspector.vue`'s own docblock and graded by `tests/harness/accessibility.test.ts`.

**2026-09-04** — criterion 1's citation moves to the click-driven case:
`tests/presentation/editor/shell/roomInspector.test.ts`'s 'one real click on Kitchen: store, named
outline, pressed list row and Inspector all carry zone-kitchen', for the reason
[[The cross-surface identity test starts after selection]] gives — the case it replaces wrote
`SelectionStore` directly and never drove a canvas click.
