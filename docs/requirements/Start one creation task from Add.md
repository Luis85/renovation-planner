---
type: PBI
parent: "[[Editor foundation]]"
order: 90
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

# Start one creation task from Add

## Actor

[[Private renovator]] who knows what they want to add but should not need to choose a technical
geometry tool first.

## Preconditions

- The editor is loaded in an editable, non-stale state.
- Select is the safe active state.
- A declarative catalogue identifies which creation capabilities are available.

## Main flow

1. The renovator activates the single Add control from the no-selection or selected context.
2. An anchored menu opens, focuses the recommended available item and groups choices in
   homeowner language.
3. The renovator navigates or searches the localized catalogue.
4. They choose one available item.
5. The menu closes and invokes exactly one canonical temporary-task entry point, carrying the
   current context where applicable.
6. Finishing or cancelling that task returns to Select unless repeated creation was explicitly
   chosen by the task.

## Extensions

- **1a** — A stale or failed state blocks creation. Add is unavailable with a reason rather than
  starting an unsafe task.
- **2a** — A catalogue item is planned but unsupported. It is omitted or disabled with an
  explanation; selecting it cannot open a dead control.
- **3a** — The catalogue grows. Search matches localized labels and approved synonyms without
  exposing internal terms.
- **4a** — The renovator presses Escape or clicks outside. The menu closes and writes nothing.
- **5a** — A selected Room provides context. The started task may be pre-linked through its
  canonical input without creating a second command path.
- **6a** — A task refuses or fails. Draft state is retired according to that task's contract and
  the last valid persisted plan remains visible.

## Guarantee

One Add activation starts at most one available temporary creation task, and closing the menu
or cancelling before commit changes no domain or vault data.

## Out of scope

- Implementing Room, Wall, Opening, Area, Measurement or Note creation.
- The detailed draft, validation and persistence behavior of any selected task.
- Reference-plan upload and calibration.
- A permanent creation-tool toolbar.

## Acceptance criteria

1. Add is one visible scalable entry point in the standard editor state.
2. The menu contains no Zone, Polygon, Vertex, Scene or Calibrate-tool vocabulary.
3. Keyboard users can open, traverse, search, choose and close the menu.
4. Choosing one item invokes exactly one canonical task entry point.
5. Escape closes the menu without changing data and returns focus meaningfully.
6. Unsupported items cannot be mistaken for supported empty workflows.
7. Completion and cancellation return to Select by default.

## Assumptions

- Feature A owns the menu and temporary-task lifecycle, not the creation implementations.
- Room is the recommended first choice once Spatial creation supplies it.
- Repeated creation is opt-in and belongs to each task's explicit completion contract.

## Sources

- [M02 — Add Menu](../user-experience/renovation-planner-editor-specs/screens/M02-add-menu.md)
- [M01 — Standard Plan View](../user-experience/renovation-planner-editor-specs/screens/M01-standard-plan-view.md)
- [Editor implementation plan: Phase 3](../user-experience/renovation-planner-editor-specs/implementation/implementation-plan.md)
- [Editor component library: AddMenu and temporary creation components](../user-experience/renovation-planner-editor-specs/components/component-library.md)

## Amendments

**2026-09-03** — advanced, not closed, by the plan editor foundation's first increment.

Met: criterion 1 is `tests/presentation/editor/shell/floatingPrimaryActions.test.ts` — Add is one
control anchored over the canvas, beside Select, in the standard state; criterion 2 is
`tests/presentation/editor/add/creationCatalogue.test.ts`'s 'contains no internal vocabulary in
either locale', which asks the question of both locale tables rather than the English one;
criterion 3 is the cases in `tests/presentation/editor/add/addMenu.test.ts` — open,
traverse enabled and disabled items alike, search, choose, close; criterion 4 is 'Enter on Room
starts exactly one tool and emits exactly one close' (a spied `setTool` asserted
`toHaveBeenCalledTimes(1)`, not merely called with the right argument) plus
`creationCatalogue.test.ts`'s own `toHaveBeenCalledTimes(1)`, with an unsupported entry's
`activate` THROWING rather than doing nothing, so a menu that called one would fail loudly in a
test; criterion 5 is 'Escape while the menu is open is the root's, and a drafted polygon under
the canvas survives it' (design spec §6.3's precedence, owned by `PlanEditorRoot.onRootKeydown`
rather than by the menu) and 'focus leaving the menu for another control in the same editor
retires it, and nothing else moves'; criterion 6 is 'an unsupported item is
aria-disabled with its reason and Enter on it changes nothing'; criterion 7's default half is
`tests/presentation/editor/tools/drawPolygonTool.test.ts`'s `onCompleted` cases bound to
`returnToSelect`, and `tests/presentation/editor/shell/temporaryToolBanner.test.ts`'s 'Cancel
returns to Select whether or not a draft exists, and a drafted room is discarded with it' for the
cancel half.

**2026-09-04** — criterion 3's close half no longer depends on where focus rests: it used to be
provable only by dispatching Escape on the menu element itself, and Tab moving focus out of the
menu (no focus trap, by design) left Escape reaching the canvas instead. The same case now closes
on a focus MOVE with no Escape at all.

**2026-09-04** — the Add Room increment closed two of the three residues below. They are struck
through in place rather than deleted, because a residue that vanishes reads as one that was never
there.

- ~~**The repeat option.**~~ CLOSED. `Keep adding rooms` is a checkbox on the New room form,
  off by default and reset by `beginTask`, and criterion 7's "unless repeated creation was
  explicitly chosen" has a subject at last: `tests/presentation/editor/roomCreation.e2e.test.ts`'s
  'Keep adding rooms restarts the task on the created room and re-counts the default name' —
  which asserts the created room selected, the tool still `draw-room`, the rectangle cleared and
  the next default name COUNTED (`Room 3`), so a build that restarted the task without re-reading
  the plan fails on the name rather than passing on the tool. Recorded at
  [[Keep adding Rooms only by explicit choice]].
- ~~**Finish on the banner.**~~ CLOSED for the room task. `TemporaryToolBanner`'s `TASKS` table
  gained a `finish?: true` flag, and a task that declares it renders a Finish button — labelled
  "Create room" — `aria-disabled` with its reason until the draft is valid, calling the identical
  `runtime.createRoom()` the form's own Create calls. Held by
  `tests/presentation/editor/shell/temporaryToolBanner.test.ts`'s 'names the room task and offers
  Finish, aria-disabled with its reason until the draft is valid', 'offers no Finish under the
  calibrate tool, which finishes by gesture' and 'Finish creates the room through the same action
  as the form, and focus lands on the canvas'. Calibrate and draw-polygon declare no `finish`,
  which is what keeps criterion 2's "when their task contract permits them" a property of the
  table rather than of the component.

Remains:

- **Remove last** stays open, and for the room task it is now open for a REASON rather than for
  want of work: a rectangle has no removable step, and the tool that does hold a removable vertex
  buffer — `DrawPolygonTool` — has no door in the Plan Editor at all after this increment (design
  spec §2.1). Recorded at [[Show an active creation-task banner with complete controls]].
- **Extension 1a — Add is not blocked in a stale or failed state.** `stale` feeds the warning strip
  and nothing else, so Add stays live over content the last read-back could not confirm; the same
  residue [[Inspect a selected room]] records for Delete.
