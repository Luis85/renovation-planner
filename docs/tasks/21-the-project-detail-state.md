---
type: Task
parent: "[[The project surface]]"
order: 10
dependsOn:
  - "[[14-empty-states]]"
  - "[[15-modals-and-confirmation-dialogs]]"
  - "[[16-form-and-inline-validation-feedback]]"
status: ""
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
---

# 21 — The project detail state

The Renovation project view gains a second state: clicking a project row opens **that
project**, listing its plans and offering a way to add one, with a way back.

The design is
[`docs/superpowers/specs/2026-08-30-project-detail-view-design.md`](../superpowers/specs/2026-08-30-project-detail-view-design.md)
and is not restated here — six decisions, each with its rejected alternatives. This note is
the evidence that justified the work and the criteria it is finished against. Where the two
disagree, the spec is the later measurement of *how*; this note owns *whether it is done*.

## Evidence

Measurements, taken on `main` at `719528d`.

- **No user-facing path reaches `CreatePlanCommand`.** `grep -rn "CreatePlanCommand" src/`
  finds the command, the composition root, and `sampleProject.ts` — nothing in
  `presentation/`. `src/plugin/sampleProject.ts`'s own docblock states it: `create-sample-project`
  remains the only source of a Plan because "there is no project-detail surface a 'new plan'
  action could live on".
- **That command cannot add a plan to an existing project.** It seeds a project, a plan and
  five zones in one gesture, through the real commands, and opens the editor on what it made.
- **`open-plan-editor` lists every plan in the vault**, unfiltered by project
  (`planEntries(index)` in `src/plugin/planEditorCommands.ts` filters on
  `type === 'renovation-plan'` and nothing else). The project a renovator is working in
  narrows nothing.
- **The row opens `Project.md`.** `ProjectList.vue` emits `open`, `ViewRoot` calls
  `context.openProject`, the composition root binds that to `openProjectNote`. A plain note:
  it cannot be drawn on and it cannot add up.
- **`RenovationProjectView` has no `getState`/`setState` at all** — measured, zero matches.
  It is a stateless singleton, so it has nowhere to record which project is open.
- **`EMPTY_STATE_CONTENT`'s docblock names the same gap** from the other end, as the reason
  `planEditor.noBackground` carries no action.
- **Coverage headroom is 1.6 branches.** 98.06% measured against a floor of 98
  (`npm run test:coverage`, 2692 branches). An untested new arm does not lower a number, it
  fails the gate.

## Why it matters

A renovator can create a project and cannot create a plan. `Zone Geometry → Area →
Requirement → Cost` — the loop the plugin exists for, closed by design slice 10 — starts at a
plan, so every capability past that point is unreachable except through a command named for
the fact that it is scaffolding.

The reported symptom is smaller and is the same defect seen from the user's side: a row that
looks like it opens a project opens a text file instead. Fixing only that would be a better
click into the same dead end.

This is the first slice under [[The project surface]], and it is what makes that PBI's
outcome true for the first time.

## Approach

Per the spec. In one paragraph so this note stands alone: the view becomes a **list state and
a detail state**, one leaf, because SDD §11 names exactly two primary surfaces and a
per-project `ItemView` would be a third. Which project is open lives in **Obsidian's view
state**, not in Pinia — `rebind` remounts the Vue tree on a settings save, and a
Pinia-held selection would throw the user out of the project they are in. Navigation goes
through `leaf.setViewState` and sets `ViewStateResult.history`, so the leaf's back arrow walks
it. `vue-router` is refused with a recorded trigger. The note stays reachable as an
**Open note** action in the detail header. An `open-project` palette command reaches the same
state transition, and with an empty vault reveals the **list** rather than a zero-row picker.

## Acceptance criteria

1. Clicking a project row opens that project's detail state; it does **not** open
   `Project.md`.
2. The detail state lists exactly the plans of that project, and opening a row reaches the
   Plan Editor through `revealPlanEditor` — the same function the palette command uses,
   proven by a spy on that function rather than by driving both paths and comparing results.
3. A plan can be created from the detail state, through the real `CreatePlanCommand`, and
   appears in the list without reopening the pane.
4. A rejected create keeps the user's typed value and shows an inline error against the field
   the error names; it never reverts what was typed.
5. `Project.md` is still reachable, from an **Open note** action in the detail header.
6. A project id that resolves to nothing returns to the list **and re-reads it**; a read that
   *refuses* stays on the detail and shows the mapped sentence. The two are distinguishable in
   a test.
7. A settings save while the detail state is open leaves the user in the same project.
8. Closing and reopening Obsidian reopens the project that was open.
9. The `open-project` command reaches the same state transition as a row click; with no
   projects in the vault it reveals the list state, not a picker.
10. Every new user-facing string resolves through `t()` in both locale tables, with the German
    checked against the vocabulary rows in `tests/presentation/i18n/strings.test.ts`.
11. **The pane's back arrow returns to the list**, and forward returns to the project. Not
    checkable by any gate here — `FakeLeaf` records asks rather than behaving and jsdom models
    no workspace — so it is walked in [[Navigate into a project and back]].
12. `npm run check` passes, coverage floors held.

## Risks

- **The 1.6 branches of headroom.** This slice adds a store, two queries, a form and a
  navigation path. Tests are planned with the code or the gate fails; there is no room to
  catch up afterwards.
- **`FakeLeaf.setViewState` was once *faster* than Obsidian** — it established view state
  synchronously, which made a duplicate-tab regression case pass against a live defect. This
  slice's whole navigation is that round trip, so each navigation case is watched failing
  before it is trusted.
- **`sync()` and the `onOpen`/`setState` race.** Obsidian does not promise an order. Deciding
  in one place is what stops a restore mounting twice, and it is the part most likely to look
  correct and be wrong.
- **`create-sample-project`'s docblock and `EMPTY_STATE_CONTENT`'s both state a trigger this
  slice fires.** Both are edited here. A comment stating a trigger that has already fired is
  worse than no comment.

## Outcome

Written when the slice closes: what shipped, what the review rounds found, and which of these
criteria moved.
