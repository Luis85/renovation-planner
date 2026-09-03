---
type: PBI
parent: "[[Editor foundation]]"
order: 60
status: Active
started: 2026-09-02
finished: ""
horizon: "MVP"
start: ""
due: ""
risk: ""
priority: ""
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
effort: ""
complexity: ""
business-value: ""
business-value-model: ""
release: "[[MVP]]"
---

# Selection

## Actor

[[Private renovator]] choosing one spatial part to understand or change.

## Preconditions

- A floor projection contains at least one selectable record.
- The same records are available through a non-canvas list.
- No modal interaction currently owns input.

## Main flow

1. The renovator points at a room or another supported spatial record.
2. Hover previews the record that the deterministic priority rule would choose.
3. The renovator selects it from the canvas or its list row.
4. One shared selection state stores the stable entity ID and supported type.
5. Canvas overlay, list state and contextual Inspector all project that same identity.
6. Clicking empty canvas or pressing Escape while idle clears the selection and restores the
   Standard Plan View.

## Extensions

- **2a** — Selectable targets overlap. Priority is deterministic: handle → object → opening →
  wall → room → background, with an alternate/cycling route where supported.
- **3a** — The renovator uses only a keyboard. List selection reaches the identical action and
  Inspector result.
- **3b** — The record becomes unreadable or disappears. The selection is retired or surfaced as
  unavailable; it is not silently rebound by label or position.
- **5a** — Theme or layout changes. Selection and viewport survive, while visual treatment adapts.
- **6a** — A temporary task is active. Escape cancels the nearer task before it clears selection.

## Guarantee

At most one record is selected by this workflow, and every selection surface refers to the same
stable ID. Selection is ephemeral and never changes or writes the selected record.

## Out of scope

- Multi-selection and batch actions.
- Creating, moving, resizing or deleting geometry.
- Persisting selection across editor sessions.
- Defining future Wall, Opening or Object entities.

## Acceptance criteria

1. Canvas and list selection of one Room yield the same ID and Inspector DTO.
2. Overlapping targets follow one documented deterministic priority.
3. Hover previews but never changes selection or data.
4. Exactly one identity is selected; selecting another replaces it.
5. Idle Escape and empty-canvas selection return to no selection.
6. Selection uses outline, handles or other non-color-only treatment.
7. Opening or reopening a floor begins with no selected entity.

## Assumptions

- A room-classified Zone is exposed as Room while retaining its `ZoneId`.
- Selection state belongs to the editor session, not individual shapes or persistence.
- Future entity types can join the priority only after they have stable IDs and list routes.

## Sources

- [M00 — Kitchen Selected Overview](../user-experience/renovation-planner-editor-specs/screens/M00-kitchen-selected-overview.md)
- [M01 — Standard Plan View](../user-experience/renovation-planner-editor-specs/screens/M01-standard-plan-view.md)
- [M07 — Wall Selected](../user-experience/renovation-planner-editor-specs/screens/M07-wall-selected.md)
- [Editor implementation plan: Phase 2](../user-experience/renovation-planner-editor-specs/implementation/implementation-plan.md)

## Amendments

**2026-09-03** — advanced, not closed, by the plan editor foundation's first increment.

Met: criterion 1 is `tests/presentation/editor/shell/roomInspector.test.ts`'s 'heading, canvas
selection and Inspector share one id' beside
`tests/presentation/editor/shell/roomSummaryList.test.ts`; criterion 2 is
`tests/presentation/editor/selection/resolveSelectionTarget.test.ts`, where ONE function answers
both the click and the hover — a handle of an already-selected record, then the topmost body, then
nothing — and 'resolves the same target regardless of the order the same candidates arrive in'
pins the determinism; criterion 3 is `tests/presentation/editor/tools/selectTool.test.ts`'s 'a
hover with no gesture predicts the same target a click there would take' with the hover path never
calling `selection.select`; criterion 4 is the pressed-row case; criterion 5 is
`tests/presentation/editor/escapeRouting.test.ts` and 'clicking empty canvas clears the
selection'; criterion 6 is the outline and vertex handles in
`tests/presentation/editor/interactionLayer.test.ts`; criterion 7 is `SelectionStore` starting
empty and `tests/presentation/editor/runtime.test.ts`'s retirement case, which never rebinds by
name.

Remains:

- **Overlap cycling.** Extension 2a's "alternate/cycling route where supported" is out of scope by
  spec §6.1: this increment has one record type, so the only overlap is a room over a room, and
  the resolver's shape leaves room for cycling rather than implementing it. Recorded at
  [[Resolve overlapping selection targets deterministically]].
- **The contextual half of Select.** [[Compose predictive and contextual Select surfaces]] shipped
  hover and the cursor; no direct convenience is rendered on a selection at all, so the criteria
  about their Inspector and keyboard equivalents have no subject.
- **The cursor does not distinguish a body from a handle.** One class,
  `rp-plan-canvas-target`, answers for both, because `renderState.hoveredObjectId` is written from
  body hits only — narrower than spec §6.2's pointer-versus-grab sentence.

**2026-09-03** — `routeEscape` (`src/presentation/editor/escapeRouting.ts`) deviates from §6.3 on
purpose: the draft test runs before the tool test for every tool, not only a non-Select one, so
Escape mid-drag under Select cancels the drag rather than clearing the selection, where §6.3 nests
the draft question under "an active non-select tool" — a deliberate improvement, since a selection
cleared out from under a hand still moving the mouse is worse than the drag being abandoned, pinned
by `escapeRouting.test.ts`'s "Select mid-drag cancels the drag before it would clear the
selection" case.
