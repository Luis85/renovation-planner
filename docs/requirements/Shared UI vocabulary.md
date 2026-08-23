---
type: PBI
parent: "[[User Interface]]"
order: 0
dependsOn: "[[Design System]]"
status: New
started: ""
finished: ""
horizon: "MVP"
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: "[[1 - Iteration]]"
---
# Shared UI vocabulary

Slices 13 to 17: the reusable presentation patterns every view draws from, and the rules
deciding which one a given failure gets.

| Slice | Increment | Primary SDD sections |
| --- | --- | --- |
| [13 — Notifications & Save-State Surfaces](../tasks/13-notifications-and-save-state-surfaces.md) | — | PRD §67 (Autosave: Saved/Saving/Unsaved/Save Error) — not to be confused with the SDD's own §67 (Logging) |
| [14 — Empty States](../tasks/14-empty-states.md) | — | PRD §94 |
| [15 — Modals & Confirmation Dialogs](../tasks/15-modals-and-confirmation-dialogs.md) | — | PRD §64 (Deletion Semantics), PRD §39 (Inspector actions) — PRD §39/§64 are unrelated to the SDD's own §39 (Sidecar Files) and §64 (Error Model) |
| [16 — Form & Inline Validation Feedback](../tasks/16-form-and-inline-validation-feedback.md) | — | SDD §59 (Inspector), SDD §64 (Error Model, applied) |
| [17 — Presentation-Layer Error Surfacing](../tasks/17-presentation-layer-error-surfacing.md) | — | SDD §66 (Error Boundary, the Presentation half) |

Slices 13–16 each define one reusable pattern — a toast, an empty-state slot, a dialog, a
field-level error — that any view can use, and **none of them depend on each other**.

**Slice 5 is not sufficient for all four**, and reading "parallel" as "unblocked by slice 5"
is the mistake this paragraph exists to prevent. Only slice 14 is buildable on slice 5
alone. Slice 13 additionally needs slice 6's `CommandHistory` and slice 11's
`ToUserMessage`; 15 needs slice 6; 16 needs slice 6 and slice 11. Read "parallel" as
"independent of each other". Each slice's `dependsOn` is the authority.

**Slice 17 is this group's integration point**, the same role slice 10 plays for the
domain/cost loop: it introduces no new UI vocabulary, only the decision rules connecting
slice 11's error categories to slices 13–16's surfaces — which category becomes a toast,
which an inline field error, which a blocking modal, and which a persisted status badge like
slice 10's `recalculationStatus`. Slice 14 is in its dependency list because it is the one
slice that hands cases *to* slice 17 rather than taking a surface from it: a view whose
hydrating query failed, and a view whose stored entity ID no longer resolves, are both
explicitly deferred there and must land somewhere in slice 17's table.

## Outcome

A failure reaches the user through exactly one surface, chosen by a rule written down rather
than by whichever component caught it — and no two surfaces report the same fact twice.
