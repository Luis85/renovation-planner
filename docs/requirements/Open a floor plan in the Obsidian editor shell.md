---
type: PBI
parent: "[[Editor foundation]]"
order: 20
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

# Open a floor plan in the Obsidian editor shell

## Actor

[[Private renovator]] working from plans and notes in an Obsidian vault.

## Preconditions

- [[Consolidate the current and target editor data models]] has approved the Plan/Floor
  presentation contract.
- The project and its current `Plan` can be identified by stable IDs.
- The editor services and settings are available.

## Main flow

1. The renovator opens a floor from the project surface or the existing editor command.
2. The plugin reveals one Plan editor leaf for that floor identity.
3. The leaf mounts the Obsidian-native context bar, Property/Layers region, canvas, Inspector
   and status region without a product account or standalone application frame.
4. The editor loads the floor projection and enters Select with no active creation task.
5. The shell inherits the current Obsidian theme and remains usable beside another workspace
   leaf.

## Extensions

- **1a** — The same floor is already open. The existing leaf is revealed rather than duplicated.
- **3a** — Settings are unrecovered. The shell shows the established unavailable/failure state
  and offers no control that cannot work.
- **4a** — The floor cannot be read. A coded failure surface replaces uncertain content and
  provides the appropriate retry or close action.
- **4b** — A previously valid projection becomes stale after a successful write. The last valid
  content stays visible with the persistent stale warning; retry repeats only the read.
- **5a** — The leaf becomes constrained. Panels move to the approved rail/drawer pattern without
  resetting the floor, viewport or selection.

## Guarantee

The leaf either shows one trustworthy projection of the requested floor in a safe state or a
clear failure state; opening never creates a duplicate editor, changes vault data or presents an
unreadable floor as empty.

## Out of scope

- Creating or importing the floor and its reference plan.
- Mobile editing or a standalone application shell.
- New Property, Building or Floor persistence.
- Renovation semantics, materials, costs and evidence workflows.

## Acceptance criteria

1. Project navigation and the editor command reach the same reveal function.
2. Repeated opens of one floor reveal one leaf; different floors may coexist.
3. Opening enters Select and activates no destructive or creation task.
4. The shell uses Obsidian semantic theme values and has no plugin theme switch.
5. A read failure and a floor with no rooms render as different states.
6. Constrained layout preserves floor identity, selection and viewport.
7. Closing the leaf releases its listeners, stores and canvas resources.

## Assumptions

- `Plan` is the persisted implementation concept presented as **Floor** in V1.
- Obsidian view state, not a new router, identifies the floor shown by a leaf.
- This PBI assembles the shell around existing services; it authorizes no schema change.

## Sources

- [M01 — Standard Plan View](../user-experience/renovation-planner-editor-specs/screens/M01-standard-plan-view.md)
- [M15 — Stale-Data Warning](../user-experience/renovation-planner-editor-specs/screens/M15-stale-data-warning.md)
- [M16 — Constrained Workspace](../user-experience/renovation-planner-editor-specs/screens/M16-constrained-workspace.md)
- [Editor component library](../user-experience/renovation-planner-editor-specs/components/component-library.md)
- [Vertical-slice plan: WP2 and WP4](../user-experience/renovation-planner-editor-specs/Renovation%20Planner%20—%20First%20Vertical%20Slice%20Plan%20and%20Data-Model%20Specification.md)

## Amendments

**2026-09-03** — advanced, not closed, by the plan editor foundation's first increment.

Met: criterion 2 and criterion 7 were already shipped (`revealPlanEditor`,
`tests/presentation/views/planEditorView.test.ts`) and this increment left them intact;
criterion 3 is `tests/presentation/editor/runtime.test.ts`'s 'activates Select once the plan
becomes ready' — Select is the default state and the toolbar that used to offer camera mode is
gone; criterion 5 is `tests/presentation/editor/planEditorFailure.test.ts` beside
`tests/presentation/editor/emptyStateOverlay.test.ts`; criterion 6 is
`tests/presentation/editor/shell/responsiveShell.test.ts`, which asserts the canvas ELEMENT
survives a full-to-constrained change, so the viewport and the selection survive by construction;
criterion 4's no-theme-switch half is the build's SDD §84 colour check, and its LEGIBILITY half is
the `plan-editor-dark` and `plan-editor-light` captures read by eye — the only pair taken in both
schemes; `plan-editor-selected`, `-add-menu` and `-narrow` are light only. Criterion 1 is
unchanged from before this increment.

**2026-09-04** — criterion 6 strengthened, and the shell's dead panel state removed, by the
review-findings increment.

Met: criterion 6's "does not reset an active temporary task" half now covers the UNSUPPORTED
width too, which is the one layout change that really does destroy the canvas.
`EditorSurface.onBeforeUnmount` releases the interrupted press through the same
`releaseInterruptedInputs` door focus loss takes — so the leaf-scoped `ToolManager` no longer
carries `gestureInFlight` into the remount, where it locked the camera for the session and made
the next press look like a foreign pointer's — and it abandons rather than cancels, so a
multi-click draft crosses the unmount intact.
`tests/presentation/editor/shell/responsiveShell.test.ts` holds both halves: 'an interrupted
Select drag is abandoned when the canvas unmounts below the floor, and the next click selects
normally', and 'a drawing tool keeps its placed vertices across the unmount'. The shell also
lost `layersPanelOpen`/`inspectorPanelOpen` and their two toggles (R11, spec §5.6): both
full-mode panels render unconditionally, and `shell.test.ts`'s five-regions case is what proves
they still compose.

Remains, and each is recorded at the Task that owns it:

- **The compact status bar's View menu.** Spec §5.6 built no View menu, because nothing would be
  in it, and §5.7 scoped "compact" to dropping the pointer readout. Grid and snapping are in
  neither bar, since neither exists as a setting — see
  [[Build full and compact editor status bars]].
- **A warning's heading, busy state and actions.** The strip renders every active warning
  simultaneously, keyed on its own id, in a fixed order, and each now carries its own severity as a
  mark and a word (R5, 2026-09-04) — but an `EditorWarning` still has no accessible heading, no busy
  state and no action, so there is nothing yet for a keyboard user to reach. See
  [[Render independent simultaneous persistent warnings]].
- **`Ground floor has 1 rooms`.** The unsupported-width notice's body is a spec-mandated string
  and `tr` has no plural form, so a single-room floor reads wrong. Recorded at
  [[Keep the editor truthful across failure and narrow layouts]].
- **No measurement of horizontal scrolling below 400px, by any instrument.** jsdom lays nothing
  out, and the only narrow capture is at 460px, which is `constrained` rather than `unsupported`.
  The manual case's step 10 opens that state and watches `Focus this tab`; its expected result
  never asks the tester to look for a sideways scrollbar, so it does not discharge this either.
  An earlier draft of this line named step 10 as the instrument, which was a guess at what the
  step checks rather than a reading of it.
- **No manual case for Undo and Redo beyond one clause.** The context bar carries both controls
  and step 1 of [[Open a floor and select a room]] asserts only that they are present and
  disabled with an empty history; the Undo and redo PBI is not advanced here.
- [[The toolbar-key retirement contract conflicts with the Asset Designer]]
- [[Unsupported width has no horizontal-overflow check]]
- [[The unsupported-width copy pluralizes one room as rooms]]
