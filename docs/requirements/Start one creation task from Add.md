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
`returnToSelect`, and `tests/presentation/editor/shell/temporaryToolBanner.test.ts` for the cancel
half.

**2026-09-04** — criterion 3's close half no longer depends on where focus rests: it used to be
provable only by dispatching Escape on the menu element itself, and Tab moving focus out of the
menu (no focus trap, by design) left Escape reaching the canvas instead. The same case now closes
on a focus MOVE with no Escape at all.

Remains:

- **The repeat option.** Criterion 7's "unless repeated creation was explicitly chosen" has no
  subject: repeat is not built, the banner carries no toggle for it, and spec §7.3 and §12 record
  that as a decision. Recorded at [[Run one temporary creation task from Add]].
- **Finish and Remove last on the banner.** The banner offers a name, one instruction and Cancel.
  A polygon finishes by clicking its own first corner and nothing in the banner says so, and
  `DrawPolygonTool` holds a vertex buffer with no way to drop the last one. Recorded at
  [[Show an active creation-task banner with complete controls]].
- **Extension 1a — Add is not blocked in a stale or failed state.** `stale` feeds the warning strip
  and nothing else, so Add stays live over content the last read-back could not confirm; the same
  residue [[Inspect a selected room]] records for Delete.

- [[A Cancel button with a drafted room leaves the creation task active]]
- [[The manual keymap claim points to a step that never invokes the keymap]]
