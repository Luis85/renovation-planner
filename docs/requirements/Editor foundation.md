---
type: Feature
parent: "[[Plan editor]]"
order: 10
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

# Editor foundation

This Feature is Increment A of the approved editor sequence. It reconciles the locked homeowner
language with the current model, then establishes the Obsidian-native shell, safe navigation,
layers, selection, contextual inspection, one Add entry point and shared history on which later
spatial and renovation workflows depend.

It owns editor workflows only. It does not introduce Property, Building, Floor, Room, Wall or
renovation-state entities merely to make the screen vocabulary match. Until the consolidation
work and ADRs decide otherwise, `Plan` presents as **Floor** and a room-classified `Zone`
presents as **Room**, with stable current IDs and persistence preserved.

## Outcome

A private renovator can open a floor plan in Obsidian, orient and navigate without entering a
destructive mode, control what is visible, select the same spatial record from canvas or list,
inspect truthful available details, begin one creation task from Add, and reverse editor changes
through one predictable history.

## Sources

- [Editor implementation plan, Increment A and Phases 0–3](../user-experience/renovation-planner-editor-specs/implementation/implementation-plan.md)
- [Vertical-slice plan and data-model specification](../user-experience/renovation-planner-editor-specs/Renovation%20Planner%20—%20First%20Vertical%20Slice%20Plan%20and%20Data-Model%20Specification.md)
- [Editor design specification set](../user-experience/renovation-planner-editor-specs/README.md)

## Progress

**2026-09-03** — the first increment of this Feature has landed on
`claude/plan-editor-foundation-read-path`: the READ PATH and SELECTION, which is the vertical-slice
plan's checkpoints C0 (consolidated model) and C1 (shell and read path). Its design is
`docs/superpowers/specs/2026-09-02-plan-editor-foundation-read-path-design.md` and its plan
`docs/superpowers/plans/2026-09-02-plan-editor-foundation-read-path.md`. It writes nothing new to
the vault and changes no schema.

[[Consolidate the current and target editor data models]] is **Done**. The six remaining PBIs are
**Active**, each with a dated `## Amendments` section saying which of its acceptance criteria this
increment met, with the test that holds each, and which remain. **Seventeen of the thirty-one
Tasks under them are Done; fourteen are Active**, each for a named half: the compact status bar's
View menu, overlap cycling, the Add lifecycle's repeat option and the banner's Finish and Remove
last, contextual dimensions, the homeowner questions' available routes, the two deferred model
ADRs, a warning's severity and actions, a resize-driven overlay close that leaves focus on
`<body>`, nothing disabled while stale, a hidden selected record's coherence, and the four data
states having no capture in either colour scheme. The rule those fourteen were split out by is
stated in each of them: **a whole acceptance criterion whose subject this increment built and
which no instrument holds is an amendment, not a tick.** Two Tasks were moved from Done to Active
by review round 1 under exactly that rule.

Checkpoint C2 — Add Room with a rectangular drag and a name form — is the next increment.
