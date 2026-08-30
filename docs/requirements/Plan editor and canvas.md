---
type: PBI
parent: "[[Architecture and Software Design]]"
order: 50
status: Done
started: ""
finished: 2026-08-25
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: "[[1 - Iteration]]"
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
horizon: Now
---
# Plan editor and canvas

Slices 5 to 8: the canvas renders, tools act on it through a command framework with undo,
the plan gets a scale, and zones can be drawn and edited. This is the group a user first
sees.

| Slice | Increment | Primary SDD sections |
| --- | --- | --- |
| [5 — Canvas Rendering & Editor Shell](../tasks/05-canvas-rendering-and-editor-shell.md) | 4 | §11–19, §54–55, §60 (layout), §84–85 |
| [6 — Editor Tool Framework, Undo/Redo & Inspector](../tasks/06-editor-tool-framework-undo-redo-and-inspector.md) | — | §20–21, §29–31 (undo), §56–59 |
| [7 — Calibration](../tasks/07-calibration.md) | 5 | §25 |
| [8 — Zone Editing](../tasks/08-zone-editing.md) | 6 | §26–28 |

Slice 8 depends only on slice 6. Slice 7 depends on slice 6 too, and additionally on slice
15 for one branch — `CalibrateTool` opens a `ConfirmDialog` before recalibrating over
existing geometry (07 *Dependencies*, and its Definition of Done). A **first** calibration,
which is all Increment 5 requires, dispatches without a dialog, so slice 7 is buildable and
shippable against slice 6 alone; only the recalibration branch waits for slice 15.

**That is why slice 7's `dependsOn` names slice 6 and not slice 15.** The property says what
must land before a slice can be built, and a `dependsOn` naming 15 would report slice 7 as
blocked by a group scheduled after it — false, and false in the direction that stalls work.
The recalibration branch's dependency is real; it is recorded here and in slice 7's own
*Dependencies*, where a sentence can carry the qualifier that frontmatter cannot.

Slices 7 and 8 can be built in either order. The PRD's own MVP scope wants calibration
before zone measurements are meaningful, but nothing in the architecture forces that
sequencing.

## Outcome

A user opens a plan, sets its scale, draws a zone, and undoes it — on a canvas whose pan and
zoom are one transform and whose every mutation went through the command history.
