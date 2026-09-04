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

**2026-09-04** — the SECOND increment has landed on `claude/plan-editor-add-room`: **Add Room**,
checkpoint C2, designed in
`docs/superpowers/specs/2026-09-03-plan-editor-add-room-design.md`. It belongs mostly to
[[Spatial creation]], and what it closes HERE is two of the three residues this Feature's own
[[Start one creation task from Add]] recorded: the temporary task's **repeat option**, which had
no subject at all, and **Finish** on the banner, which the room task is the first to declare.
[[Run one temporary creation task from Add]] and
[[Show an active creation-task banner with complete controls]] are still Active, each for one
named half: the first for the criterion that is VACUOUS rather than met — Room carries no
selected context, so "passed without creating a second command path" has no subject to test —
and the second for **Remove last**, which a rectangle has no removable step for and which the
one tool that does hold a removable vertex buffer no longer has a door to. Extension 1a stays
open on the PBI itself, for checkpoint C3.

It also settled a vocabulary question this Feature had left half-answered. `editor.zone.default-name`
is gone, and `strings.test.ts` refuses the word "zone" in every `editor.*` and `empty.plan.*` value
of BOTH locales — which turned out to falsify four EXISTING labels rather than only the increment's
own new ones, because "room" is not true of a Garden or a Terrace. They read "room or area", or
they lost the noun altogether ("Delete"). Recorded in
[[Draw and name a rectangular room]]'s amendments and in CLAUDE.md.

Checkpoint C3 — the trust path, where a stale or failed floor disables unsafe follow-up edits — is
the next increment.
