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
- **Coverage headroom is a handful of branches, and the figure depends on which tree you
  measure.** 98.06% over 2692 branches on the baseline (`719528d`) gives ~1.9 uncovered
  branches before the floor of 98 refuses; re-measured on `main` at `50e1b84` during the
  review round it is 98.16% over 2676 (2627 covered), which gives ~4.6. Both green, both real;
  the parse-lag fix accounts for the difference. This slice lands on a third tree — `main`
  after PR 37 and PR 38 — so the number is re-measured then and the tighter one is planned
  against meanwhile. An untested new arm does not lower a number, it fails the gate.

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
   the error names; it never reverts what was typed. The one refusal that cannot work that
   way — the project vanished while the form was open — returns the user to the list **and**
   tells them why through a notice, because navigating destroys the form the banner would
   have lived in.
5. `Project.md` is still reachable, from an **Open note** action in the detail header.
6. A project id that resolves to nothing, **once the index has been seen populated**, returns
   to the list and re-reads it; a read that *refuses* stays on the detail and shows the mapped
   sentence. The two are distinguishable in a test, and the qualifier is criterion 8's — before
   the scan has run, "resolves to nothing" is a statement about the index rather than about the
   vault.
7. A settings save while the detail state is open leaves the user in the same project.
8. Closing and reopening Obsidian reopens the project that was open — **including when the
   pane is restored before the index scan has run**, which is the ordering Obsidian actually
   uses. A restored detail state that hydrates before the scan completes holds its loading
   state; it does not read the legitimate `ok(null)` as a deleted project and navigate away,
   which would discard the `projectId` this criterion is about and no later read could
   restore it. **And it holds only until the scan COMPLETES, zero entries included** — a vault
   whose last project note was deleted while Obsidian was closed reaches the list, rather than
   spinning for the session waiting for an index that will never have entries in it.
9. The `open-project-detail` command reaches the same state transition as a row click —
   **including when a Renovation project leaf is already open**, which is the normal case; with
   no projects in the vault it reveals the list state, not a picker.
10. Two `open-project-detail` invocations in one tick naming **different** projects leave exactly one
    leaf, and the leaf ends on the later of the two **even when the earlier navigation settles
    last**. The view is a singleton, and a command that can produce a second tab of it has
    broken that however correct each invocation looks alone; the ordering half is separate,
    because coalescing the reveal fixes the tab count and leaves the two state writes racing.

    > **Both of these said `open-project` until a review bot read them against the evidence.**
    > That id was already taken — by the command that merely REVEALS the pane, registered since
    > slice 1, locale-keyed and asserted in two test files — so this slice built
    > `open-project-detail` beside it, deliberately and for the reason the spec itself gives
    > about ids being data a user's hotkey binds to. The deviation was recorded in the summary
    > above and in the pull request, and these two criteria were not brought with it: they went
    > on naming a command that reveals a pane while their evidence tested the one that navigates
    > into a project. A criterion that names the wrong subject is ticked against the wrong
    > behaviour however good the test under it is.
11. The in-app **‹ back** action returns to the list, and a `setState` carrying the list
    sentinel is honoured rather than validated away. A **different mechanism** from criterion
    13's arrow, not a half of it: this action *sets* a state where the arrow asks Obsidian to
    *restore* one. Both carry the same sentinel, which is why a validator modelled on the Plan
    Editor's would have killed both — but only this one is reachable from a test.
12. Every new user-facing string resolves through `t()` in both locale tables, with the German
    checked against the vocabulary rows in `tests/presentation/i18n/strings.test.ts`.
13. **The pane's back arrow returns to the list**, and forward returns to the project. Not
    checkable by any gate here — `FakeLeaf` records asks rather than behaving and jsdom models
    no workspace — so it is left to [[Navigate into a project and back]], which is where it
    gets walked WHEN that case is run. It has not been.
14. `npm run check` passes, coverage floors held.

## Risks

- **The handful of branches of headroom** (see *Evidence* — between ~1.9 and ~4.6 depending on
  the tree). This slice adds a store, two queries, a form, a change source, four context
  members and a navigation path. Tests are planned with the code or the gate fails; there is
  no room to catch up afterwards. Measure on a quiet machine: a single load-induced timeout in
  `tests/build/` or `tests/harness/` suppresses the coverage report entirely, so a run that
  looks like a gate failure can simply be a run that never produced the number.
- **`FakeLeaf.setViewState` was once *faster* than Obsidian** — it established view state
  synchronously, which made a duplicate-tab regression case pass against a live defect. This
  slice's whole navigation is that round trip, so each navigation case is watched failing
  before it is trusted.
- **`sync()` and the `onOpen`/`setState` race.** Obsidian does not promise an order. Deciding
  in one place is what stops a restore mounting twice, and it is the part most likely to look
  correct and be wrong.
- **Four of the design's mechanisms were wrong on first writing, and every one of them would
  have compiled and passed.** The review round on the design PR found: a `setState` that
  changed a plain class field and expected an already-injected Vue tree to notice; a validator
  that would have refused the very sentinel `getState` writes for the list, killing the back
  arrow; a plan list with no subscription that can hear `PlanCreated`; and a palette command
  routed through a reveal that sets state only on leaves it creates and coalesces on a key
  that lets one singleton become two tabs. The spec carries each correction with the
  measurement behind it. The shape to carry into the implementation is that all four were
  **mechanism** defects behind correct-sounding prose: each read as a settled decision and none
  of them had anything under it. They land across the criteria rather than in one place — the
  remount on 7, the subscription on 3, the sentinel on 11, the command on 9 and 10 — and 9 and
  10 are split from each other because one command defect is about the leaf that already exists
  and the other about the leaf that does not.
- **`create-sample-project`'s docblock and `EMPTY_STATE_CONTENT`'s both state a trigger this
  slice fires.** Both are edited here. A comment stating a trigger that has already fired is
  worse than no comment.

## Outcome

The slice closed across thirteen tasks on `claude/slices-17-19-in-flight-bsrfa8`. What shipped:
`ListPlansByProject` and `PlanSummaryDto`; `projectPlansChangeSource`; two guarded reads on
`RenovationProjectQueryServices`; `ProjectDetailStore`; five new context seams; the view's own
`getState`/`setState`/`sync` state machine; `ProjectDetail.vue`, `PlanList.vue` and the shared
`statusLabel`; `NewPlanForm.vue` over the real `CreatePlanCommand`; `ProjectDetailState.vue`
drawing it all from `ViewRoot`; `renovationProject.noPlans` graded by axe; `revealView`
answering the leaf it revealed, with `navigateToProject` above it; the `open-project-detail`
palette command; and this task's documents, harness knob and captures.

### The criteria, one at a time

Ticked means a check exists that fails without the behaviour; the evidence is named so a
reader can go and look rather than take the tick.

| # | Verdict | Evidence |
| --- | --- | --- |
| 1 | ✅ | `viewRootProjectDetail.test.ts` — *navigates into a project from a list row rather than opening its note* |
| 2 | ✅ | Presentation half: *opens a plan row through context.openPlan*. **The spy this criterion asks for** is `renovationProjectWiring.test.ts` — *binds openPlan to the real revealPlanEditor*, which `vi.mock`s the MODULE (the composition root imports the binding directly) and asserts the call. `renovationProjectOpenSeams.test.ts`'s *opens a leaf carrying the plan id* is a real case and is NOT that spy — it asserts the resulting leaf state, which is what criterion 2 explicitly refuses as evidence; an earlier draft of this row named it as the spy |
| 3 | ✅ | *shows a created plan in the rows without reopening the pane*, and *creates a second plan from the plan list's own header button* — the second is what pins the two controls onto ONE handler |
| 4 | ✅ | `newPlanForm.test.ts` — *keeps the typed value and shows the field error on a refusal*, *retires the field error as soon as the name is edited*. The vanished-project half is `viewRootProjectDetail.test.ts`'s *returns to the list AND notifies when the project vanished while the form was open*, asserted as a PAIR: the navigation alone is equally true of a build that says nothing |
| 5 | ✅ | *opens the project's own note from the header*, plus *returns to the list when the header's note turns out to be gone* — the `'missing'` arm re-reads THIS state rather than the list |
| 6 | ✅ | *navigates back to the list when the project is gone and the scan has run* against *shows the mapped failure sentence and stays put when a read refuses* — two cases, because the criterion is that the two are DISTINGUISHABLE |
| 7 | ✅ | `renovationProjectView.test.ts` — *keeps the open project across a rebind* and *remounts the open project on the new bundle*. The first alone passes against a rebind that keeps the field and never redraws |
| 8 | ✅ | *holds the loading line rather than navigating before the scan has run*, *draws the project once the index is rebuilt under a restored leaf*, and the zero-entry half through criterion 6's first case: the gate is `indexScanCompleted()`, which answers "has it RUN" |
| 9 | ✅ | `openProjectDetail.test.ts` — *navigates an already-open leaf to the chosen project* and *reveals the list state rather than a picker in an empty vault*, with an unrecovered-settings twin beside it |
| 10 | ✅ | *leaves exactly one leaf for two invocations naming different projects* and *ends on the later of two invocations even when the first settles last* — the two halves the criterion splits, because coalescing the reveal fixes the tab count and leaves the state writes racing |
| 11 | ✅ | *navigates back to the list with null* and, on the parse, *accepts an empty projectId as the list state* |
| 12 | ✅ | Every new key is in `en.ts` and `de.ts`; `tests/presentation/i18n/strings.test.ts` holds completeness and its two vocabulary rows. Read the tick narrowly, as that file's own header asks: it pins two TERMS, not the language, so the German register of this slice's copy was settled by reading (Task 9 changed one body from the informal *Füge* to *Fügen Sie*) and by nothing automatic |
| 13 | ⛔ **Not verified** | `docs/tests/cases/Navigate into a project and back.md` steps 3 and 4 are WRITTEN and **not yet run** — that case's own Runs table says "Not yet run in a vault", and no gate here can reach the question: `FakeLeaf` records asks rather than behaving, so the suite asserts only that `ViewStateResult.history` was set, never that Obsidian walked it. **This row said "Walked, not ticked" until a review bot checked it against the Runs table it cites.** Nobody walked anything; the case was authored. The two are a whole verdict apart, and this is the one row in the table whose entire job is to be honest about evidence |
| 14 | ✅ | `npm run check` exit 0 at this task's commit, coverage floors held — see the commit message for the four figures |

### Withdrawn, and residues carried forward

- **Nothing in the criteria list is withdrawn.** All thirteen assertable ones are ticked; the
  fourteenth, criterion 13, is **unverified** — its manual case is written and has not been run
  in a vault. Withdrawal was available and the previous two slices each used it, which is worth
  stating plainly; so is the correction, because this sentence read "and the fourteenth is
  walked" and that was not true of anything that had happened.
- **One `onOpen`/`setState` ordering still mounts twice**, and it is pinned as behaviour
  (`renovationProjectView.test.ts` asserts the mounted list as `[null, 'project-01JAAA']`)
  rather than fixed. `setState` before `onOpen` is closed by an `opened` flag; the other
  ordering needs a deferred, coalescing mount, which turns a synchronous mount asynchronous
  for every caller and every case in that file. That is an increment with its own argument.
  A build that starts coalescing fails at that assertion and has to come and say so.
- **A command's `name:` literal is caught by no gate.** `I18N_LITERAL_BAN` reaches four call
  sites and `addCommand({ name })` is none of them; measured, a raw English literal there
  stays green. Recorded in `openProjectDetail.test.ts`'s own docblock rather than fixed
  inside this slice, because widening that selector touches every existing call site's
  evidence.
- **`NewPlanForm.onSubmit`'s own `submitting` guard is a second, local statement of a refusal
  `useFormCommit` already makes**, kept for the narrower reason its comment gives: a refused
  press must not also run the focus move onto a control carrying the in-flight submit's error.
  Whether that second path is reachable at all was raised on this branch and is NOT settled
  here — it needs a case that fails without the guard, and there is none. Carried into the
  whole-branch review rather than removed on a reading.
- **The detail state's layout was captured for the first time in Task 13**, and the two
  capture-only defects it found are fixed in the same commit: a back control whose two
  declarations against stretching could neither of them work (`flex-basis` is the main size
  in a row flex container), and plan names centred by Obsidian's own `button {
  justify-content: center }` under a rule that said `text-align: left`. CLAUDE.md's slice 21
  section carries both with their measurements.
