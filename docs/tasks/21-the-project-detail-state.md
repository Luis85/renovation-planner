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
**Open note** action in the detail header. An `open-project-detail` palette command reaches the
same state transition, and with an empty vault reveals the **list** rather than a zero-row
picker.

This paragraph named `open-project` until a review bot read it against criteria 9 and 10, which
had been corrected to the built id one round earlier. That id belongs to the command that merely
REVEALS the pane and has since slice 1; the deviation and its reason are two sections down. A
summary contradicting the criteria in its own document is worse than either being wrong alone —
an implementer reads the approach first.

## Acceptance criteria

1. Clicking a project row opens that project's detail state; it does **not** open
   `Project.md`.
2. The detail state lists exactly the plans of that project, and opening a row reaches the
   Plan Editor through `revealPlanEditor` — the same function the palette command uses,
   proven by a spy on that function rather than by driving both paths and comparing results.
3. A plan can be created from the detail state, through the real `CreatePlanCommand`, and
   appears in the list without reopening the pane.
4. A rejected create keeps the user's typed value and shows an inline error against the field
   the error names; it never reverts what was typed. The one refusal that cannot work that way
   — the project vanished while the form was open — **retires the form and leaves the pane on
   the screen that says the project is gone**, because a banner cannot live in a form whose
   subject no longer exists.

   > **This said "returns the user to the list AND tells them why through a notice" until the
   > improvement pass retired the `'gone'` watcher.** Both halves of that sentence were
   > consequences of the redirect: navigating destroyed the form, so the account had to survive
   > on `document.body`, which is what made it a notice. With no redirect the form is retired
   > deliberately (`dialogs.resolve(cancelResultFor('form'))` from the opener) and the account
   > is the screen — which persists and carries a way back, where a notice is a remark about a
   > gesture. The notice was dropped rather than kept beside it because it resolved
   > `view.project.gone`, the same key the screen's headline resolves: two surfaces saying one
   > sentence at once is slice 17's double-report shape.
5. `Project.md` is still reachable, from an **Open note** action in the detail header.
6. A project id that resolves to nothing, **once the index has been seen populated**, leaves
   the detail state for a screen that says the project is gone and carries a way back to the
   list; a read that *refuses* stays on the detail and shows the mapped sentence. The two are
   distinguishable in a test, and the qualifier is criterion 8's — before the scan has run,
   "resolves to nothing" is a statement about the index rather than about the vault.

   > **This said "returns to the list and re-reads it" until the improvement pass**, and the
   > change is the one criterion 4 records: the corrective redirect went, because
   > `RenovationProjectView.setState` records a history entry for any accepted, changed state
   > and therefore left the DEAD project on the back stack. The list is still one click away
   > and that click is a deliberate navigation, so the entry Obsidian records for it is one
   > somebody asked for.
7. A settings save while the detail state is open leaves the user in the same project.
8. Closing and reopening Obsidian reopens the project that was open — **including when the
   pane is restored before the index scan has run**, which is the ordering Obsidian actually
   uses. A restored detail state that hydrates before the scan completes holds its loading
   state; it does not read the legitimate `ok(null)` as a deleted project and navigate away,
   which would discard the `projectId` this criterion is about and no later read could
   restore it. **And it holds only until the scan COMPLETES, zero entries included** — a vault
   whose last project note was deleted while Obsidian was closed settles `'gone'` and draws the
   screen that says so, rather than spinning for the session waiting for an index that will
   never have entries in it.

   That sentence said "reaches the list" until a review bot caught it. It was true of the build
   that shipped first, where a `watch(status)` navigated on `'gone'`; the improvement pass
   retired that redirect precisely because an automatic navigation records a history entry
   nobody asked for, and criterion 6 was rewritten with it. This line was not, so the document
   described a mechanism its own criteria had removed — which is how a later worker
   reintroduces one.
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
| 4 | ✅ | `newPlanForm.test.ts` — *keeps the typed value and shows the field error on a refusal*, *retires the field error as soon as the name is edited*. The vanished-project half is `viewRootProjectDetail.test.ts`'s *retires the form and draws the gone screen when the project vanished while it was open*, asserted as a TRIPLE — the dialog is gone, the screen draws, and nothing navigates — because each of the three is true of a build the other two are wrong about. It read *returns to the list AND notifies*, as a pair, until the improvement pass retired the watcher |
| 5 | ✅ | *opens the project's own note from the header*, plus *draws the gone screen when the header's note turns out to be gone* — the `'missing'` arm re-reads THIS state rather than the list |
| 6 | ✅ | *draws an actionable gone state instead of navigating out of it* against *shows the mapped failure sentence and stays put when a read refuses* — two cases, because the criterion is that the two are DISTINGUISHABLE. The first read *navigates back to the list when the project is gone and the scan has run* until the improvement pass; it now asserts the screen, the absent loading line, `navigate` NOT called, and one navigation on the action's own click |
| 7 | ✅ | `renovationProjectView.test.ts` — *keeps the open project across a rebind* and *remounts the open project on the new bundle*. The first alone passes against a rebind that keeps the field and never redraws |
| 8 | ✅ | *holds the loading line rather than navigating before the scan has run*, *draws the project once the index is rebuilt under a restored leaf*, and the zero-entry half through criterion 6's first case: the gate is `indexScanCompleted()`, which answers "has it RUN" |
| 9 | ✅ | `openProjectDetail.test.ts` — *navigates an already-open leaf to the chosen project* and *reveals the list state rather than a picker in an empty vault*, with an unrecovered-settings twin beside it |
| 10 | ✅ | *leaves exactly one leaf for two invocations naming different projects* and *ends on the later of two invocations even when the first settles last* — the two halves the criterion splits, because coalescing the reveal fixes the tab count and leaves the state writes racing |
| 11 | ✅ | *navigates back to the list with null* and, on the parse, *accepts an empty projectId as the list state* |
| 12 | ✅ | Every new key is in `en.ts` and `de.ts`; `tests/presentation/i18n/strings.test.ts` holds completeness and its two vocabulary rows. Read the tick narrowly, as that file's own header asks: it pins two TERMS, not the language, so the German register of this slice's copy was settled by reading (Task 9 changed one body from the informal *Füge* to *Fügen Sie*) and by nothing automatic |
| 13 | ⛔ **Not verified** | `docs/tests/cases/Navigate into a project and back.md` steps 3 and 4 are WRITTEN and **not yet run** — that case's own Runs table says "Not yet run in a vault", and no gate here can reach the question: `FakeLeaf` records asks rather than behaving, so the suite asserts only that `ViewStateResult.history` was set, never that Obsidian walked it. **This row said "Walked, not ticked" until a review bot checked it against the Runs table it cites.** Nobody walked anything; the case was authored. The two are a whole verdict apart, and this is the one row in the table whose entire job is to be honest about evidence |
| 14 | ✅ | `npm run check` exit 0 at this task's commit, coverage floors held — see the commit message for the four figures |

### The improvement pass

A second pass over this slice after it closed. Each entry is a defect, its mutation and what
the mutation printed.

- **The retirement had to be keyed on the STATUS, and finding that out is the pass's own
  recurring lesson arriving in the commit that quotes it.** `d4f2adc` gave `onProjectGone` an
  explicit `dialogs.resolve` because with no remount there is no `DialogHost.onBeforeUnmount`
  to settle the form. That is correct for the command path and blind to the READ path: the
  project note is deleted while the New plan dialog is up, `onProjectsChanged` fires, `hydrate`
  is answered `ok(null)` against a completed scan, and `'gone'` is reached without
  `onProjectGone` ever running — a form left modal over the screen saying its project does not
  exist. Before the redirect was retired that path was covered BY ACCIDENT, since the
  navigation remounted the tree, so retiring it moved a guarantee from a side effect to
  nowhere. **"I fixed the case in the report" is not "I fixed the class", committed by the
  author who had just written that sentence into the commit message.** Reported by a review
  bot. The fix is a `watch(status)` that retires an open dialog on `'gone'` and REPLACES the
  call-site resolve rather than sitting beside it — two answers to one question is what
  produced the gap. Watched red at the ASSERTION rather than at a selector, which took a second
  attempt: the case's first draft reached for `.rp-plan-list__create` on a fixture with no
  plans and failed at `Unable to get`, a red that proved nothing and read exactly like one that
  did.
- **Criterion 13 is still unverified, and the improvement pass did not change that.** Running
  [[Navigate into a project and back]] was attempted and is not possible in this environment:
  `npm run test-build` builds the plugin into this repository's own vault and launches nothing,
  and there is no Obsidian binary here. The Runs table and the criterion's row are left exactly
  as they are — an unrun manual case is a plan to find out, and a verdict upgraded on reasoning
  is the defect that row exists to refuse. The case gained a step 17 for the redirect this pass
  retired, which is more ground for the same walk rather than a substitute for it.

- **A corrective redirect recorded a history entry, and the `'gone'` watcher is retired.**
  `ProjectDetailState` used to `watch(status)` and call `context.navigate(null)` on `'gone'`;
  `RenovationProjectView.setState` sets `ViewStateResult.history` for any accepted, CHANGED
  state and cannot tell a correction from a deliberate navigation. Measured by driving the
  view directly — list→project, project→list (the correction) and a back-arrow-shaped restore
  all answer `history === true` — so Obsidian's back stack held the DEAD project, and Back
  restored it, re-read it, found it still gone and bounced forward again.

  Two candidates were raised on PR 42 and the ARGUMENT for taking the second is not the line
  count. Threading a `corrective` flag keeps the redirect and adds a context seam, a mutable
  one-shot flag on a view instance, and a lifetime question — `navigateToProject` DROPS a
  superseded write, so a flag set and never consumed poisons the next navigation — and
  everything it buys lives in Obsidian's history semantics, which `FakeLeaf` cannot answer and
  no gate here can see. Retiring the watcher removes the entry, the bounce and a mechanism,
  and what replaces it is checkable in this repository: Back restores the dead project and the
  screen draws, which is a true and actionable picture rather than a redirect that reads as
  nothing having happened. **Prefer the fix whose result a gate can see to the one whose
  correctness lives somewhere no gate reaches.**

  Two consequences were followed rather than glossed. The form had to be RETIRED — with no
  remount there is no `DialogHost.onBeforeUnmount` to settle it, so a New Plan form would have
  floated over the screen saying its project does not exist — which makes
  `ProjectDetailState` a second caller of `dialogStore.resolve`. Both docblocks claiming
  `DialogHost` was the only one are rewritten from the grep, and the rule they were reaching
  for survives narrower and truer: no KIND COMPONENT settles, because that is what keeps
  single-settle, focus restoration and the `inert` release on one seam — all three of which
  hang off the store's `current` watcher and therefore run for whoever cleared it. And the
  notice went with the redirect, because it resolved `view.project.gone`, the key the screen's
  own headline resolves.

  Watched red three ways rather than one, because a partial fix reads exactly like a complete
  one: restoring the watcher reddens three cases; dropping ONLY the dialog resolution reddens
  the vanished-project case alone; and `viewRootOpenProject.test.ts`'s `'missing'` case had to
  be rewritten because it asserted the redirect from the Open note path.

  **What this does NOT settle** is whether Obsidian honoured the entry in the first place —
  criterion 13's unrun ground. The defect is that the code ASKED for one; whether the bounce
  the ask produces is what a user sees is still a question only a vault can answer.

### Withdrawn, and residues carried forward

- **Nothing in the criteria list is withdrawn.** All thirteen assertable ones are ticked; the
  fourteenth, criterion 13, is **unverified** — its manual case is written and has not been run
  in a vault. Withdrawal was available and the previous two slices each used it, which is worth
  stating plainly; so is the correction, because this sentence read "and the fourteenth is
  walked" and that was not true of anything that had happened.
- **`planEditor.noZones` is scanned by axe now**, which is not this slice's own gap but was the
  last of its kind and one fixture away. It stayed unscanned for seven slices because the Plan
  Editor's accessibility case mounts the default fixture, whose plan carries no background, so
  the selector answers `noBackground` — the buttonless entry — and `noZones`'s button was
  exercised by `emptyStateOverlay.test.ts` alone, which asserts behaviour and grades no
  semantics. A plan with a background and no zones reaches it; the case asserts
  `.rp-empty-state__action` is present before scanning, because a scan of a subtree without
  the control passes exactly like a scan of one with it. Both mutations measured: restoring
  the default fixture fails at that assertion rather than at the scan, and stripping the
  action button's accessible name reddens this case alongside the two already-scanned ones.
- **The notice on the vanished-project path is dropped rather than deferred.** It is not a
  gap waiting for someone: two surfaces resolving one key at one instant is a double report,
  and the surviving surface is the one that persists and carries a way out. If a future round
  wants a notice back on that path, it needs its own sentence — the failure of a PRESS is a
  different claim from the state of a project — and that is new copy in two locale tables
  rather than a re-added call.
- **One `onOpen`/`setState` ordering still mounts twice**, and it is pinned as behaviour
  (`renovationProjectView.test.ts` asserts the mounted list as `[null, 'project-01JAAA']`)
  rather than fixed. `setState` before `onOpen` is closed by an `opened` flag; the other
  ordering needs a deferred, coalescing mount, which turns a synchronous mount asynchronous
  for every caller and every case in that file.

  **The improvement pass measured the remedy rather than taking it, and the measurement is why
  it is still not taken.** Deferring `onOpen`'s mount by one microtask and returning that
  promise collapses the pair to `['project-01JAAA']` when the caller does NOT await `onOpen`,
  and leaves it at `[null, 'project-01JAAA']` when it does. So the cheap fix's entire benefit
  rests on a fact about the HOST: whether Obsidian awaits `onOpen` before calling `setState`.
  If it awaits, no deferral inside `onOpen` helps and the change is pure cost — a first mount
  that is asynchronous for every caller, bought for nothing.

  That turns this from an increment with a design argument into one whose FIRST task is a
  measurement, and the measurement is not available anywhere this repository can reach:
  `FakeLeaf` records asks rather than behaving, and an eye in a vault cannot settle it either
  — a visible flash of the list before the project says which ORDERING happens, never whether
  the host awaited. Reading Obsidian's own view-loading sequence, or instrumenting `onOpen`
  and `setState` with log lines in a real vault, is what would.

  **And the pin promises more than it delivers, which is the second half of the finding.**
  Its docblock said "a build that starts coalescing must fail HERE"; measured, the microtask
  variant passes all 31 cases in that file with the coalescing live in one of the two call
  shapes. It catches a fix that defers past the case's own `await view.onOpen()` and no other.
  The docblock now says that, because a pin on a fix nobody has written is a pin on the shape
  its author imagined.
- ~~**A command's `name:` literal is caught by no gate.**~~ **Closed by the improvement
  pass.** The deferral's own reason was wrong and re-measuring is what showed it: widening
  "touches every existing call site's evidence" — it touches none. All five `addCommand` calls
  in `src/` and the one `addRibbonIcon` already pass `tr(...)`, which is a `CallExpression`
  and not a `Literal` at the position the selector checks, so the widening is green on the
  tree it lands on. `I18N_LITERAL_BAN` reaches six call sites now, and the two it gained are
  Obsidian's own registration API — the two user-visible strings that go through no DOM helper
  and were therefore unreachable from the other four. `id` is deliberately not covered: a
  command id is data a user's hotkey binds to. See the improvement-pass section above.
- ~~**`NewPlanForm.onSubmit`'s own `submitting` guard**~~ **— settled by the improvement pass,
  and the answer is that its stated reason was false.** The guard claimed to keep a refused
  press from running the focus move "onto whichever control still carries an error from the
  submit currently in flight". Driven exactly as written — a first press refused with a field
  error, a second that hangs, a third refused mid-flight — focus stayed on the button and the
  in-flight count of `aria-invalid` controls was **0**, with the guard and without it:
  `useFormCommit.submit` clears `fieldErrors` BEFORE it sets `submitting`, and
  `focusFirstInvalidControl` awaits `nextTick` and re-queries, so there is nothing to land on.
  Removed from `NewPlanForm` AND from `NewProjectForm`, because the comment was identical in
  both and fixing the one it was reported against would have left the same false claim next
  door. `newPlanForm.test.ts` now pins the MECHANISM instead of the line, and it discriminates:
  moving that clear to after the dispatch turns it red, with focus landing on the input — the
  exact harm the guard was written for, reachable only once the thing that really prevents it
  is broken. `newProjectForm.test.ts`'s in-flight case had credited the guard in a comment
  while passing without it, and now says what holds it.
- **The detail state's layout was captured for the first time in Task 13**, and the two
  capture-only defects it found are fixed in the same commit: a back control whose two
  declarations against stretching could neither of them work (`flex-basis` is the main size
  in a row flex container), and plan names centred by Obsidian's own `button {
  justify-content: center }` under a rule that said `text-align: left`. CLAUDE.md's slice 21
  section carries both with their measurements.
