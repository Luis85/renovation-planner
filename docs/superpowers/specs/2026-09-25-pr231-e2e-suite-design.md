# PR 231 native e2e suite — design

Date: 2026-09-25. Branch: `renovation-planner-beta-handoff-e80bb5` (PR 231), with `main` merged at
`61fbf1588`, which brought the real-Obsidian harness (`npm run test:e2e`, PR 238).

## 1. Intent

PR 231 is first-beta readiness work. Its readiness documents keep saying the same sentence: *nothing
on this branch has been run in an Obsidian vault*. Several release gates wait on exactly that. G1
(data trust) cannot be evaluated until owner questions Q2 and Q3 get "one vault run", which the owner
has said they cannot do soon. BP-04's last open item is a real screenshot. BP-09's mobile guards are
tested in jsdom only.

The suite's job is to **answer the questions only a real host can answer**, for this PR, with
synthetic input in a real Obsidian. It is not a re-run of what jsdom already proves.

**Success**, in order of release impact:

1. Q2 (L-19) and Q3 (L-21) each get a recorded answer from a real host, so the owner can make the
   release call G1 waits on.
2. Every native-evidence row of `04-beta-acceptance-matrix.md` that synthetic input can reach has a
   named e2e case, and each case's manual-case row and the tracker row it answers say so.
3. Each case goes red when the claim it checks breaks. That is shown by a mutation, per the
   repository's rule that an invariant is watched failing.

**Stated by the user:** a proper e2e suite for PR 231, implemented subagent-driven.
**Assumed here:** the scope is PR 231's readiness documents; the harness from PR 238 is used as it is;
nothing in `src/` changes unless a case finds a defect, and then the defect is reported rather than
fixed in this work.

## 2. What is out of scope, and why

- **Physical devices, screen readers, trackpads, host community themes, first-time-user observation.**
  Synthetic WebDriver input in desktop Obsidian cannot stand in for any of them (matrix §1).
  Mobile-emulation is desktop Obsidian in a phone-sized window, and every mobile case says so.
- **Staging a real half-failed write** (Notices 17a). It needs two filesystem permissions held apart
  in a chosen order. Incidents are PLANTED instead, which is the fault setup the manual case already
  blesses.
- **Performance** (A27). BP-08 has its own browser driver and budgets.
- **Anything jsdom already asserts** with no host-dependent clause.

## 3. The cases

Each file is one question area. Every case runs on the desktop legs unless marked mobile. Tiers and
step numbers refer to the named manual case.

### 3.1 `writeIncident.e2e.ts` — exists (d54e959)

The vault-scoped incident: first-frame pause, `duplicateLeaf`, settings rebind, refusal banner,
diagnostics report, reload, restart. Matrix A15, A16, A19. Kept as is.

### 3.2 `leafIncident.e2e.ts` — the leaf-owned incident across the host's persistence

Answers *Notices and save state* 17b, 17c and 17d, and the lifecycle contract's "whether Obsidian
returns `getState()` to a detached leaf". The leaf's `unrecoveredWrite` flag is PLANTED through
`leaf.setViewState({ type, state: { planId, unrecoveredWrite: true } })`, the same state Obsidian
itself would hand back.

- **17b.** A settings change keeps the warning and the refusal.
- **17c.** After `reloadObsidian()`, `.obsidian/workspace.json` holds `"unrecoveredWrite": true` for
  that leaf, and the restored tab still warns and refuses. Both are measured, not assumed.
- **17d.** Closing the tab and opening the plan again through `open-plan-editor` gives a clean tab.
  Reopening the closed tab through Obsidian's own undo-close is recorded as observed.

### 3.3 `settingsDuringCreate.e2e.ts` — Q2 / L-19 / lifecycle F1

The deciding experiment the owner document names. Hold the create open by wrapping `app.vault.create`
in `executeObsidian` so it waits on a promise the test releases. Change the default projects folder
in the real settings window. Release the create.

- Assert the note lands under the PREVIOUS folder. The rig already confirmed this, and it is the
  premise of the question.
- Then **measure the arm**: does the project's row appear in the list without a plugin reload,
  within the index's debounce plus a margin? Repeat three times with fresh projects, and write each
  iteration's arm to evidence.
- **Assert the owner's criterion**: the row appears unprompted. The ruling is "block only if run
  shows it", so a red case here IS the blocker, reported as such and never weakened. If the arms
  disagree across iterations, the case fails on that, because a nondeterministic arm is also a
  blocker.

### 3.4 `unloadWindow.e2e.ts` — Q3 / L-21

The other half of the same vault run. Measure first, then pin what was measured.

- **The premise.** With a Plan Editor open and a debounced field edit pending (a Room Inspector field
  committed through `commitField`), disable the plugin. Record whether the pane is still in the DOM,
  what the leaf's view type is, and whether the pending edit reaches the note within the commit delay
  plus a margin.
- **Defect 2's fix, in the host.** With a planted incident open, disable the plugin and, if a pane is
  still there, attempt a write from it. The write must still be refused, which is `f5a7f219e`'s claim.
- **Assertions are pins, not rulings.** L-21 is an open owner question, so the case asserts the
  OBSERVED behaviour under a name that says "pins", with a comment that it is not a ruling. That is
  the pattern the harness's arrow case uses. It turns red when Obsidian or the plugin changes the
  answer. The tracker's warning about certifying a post-unload write is met by the name and the
  comment, and by never describing the pinned write as correct.

### 3.5 `cornerEditing.e2e.ts` — BP-04, L-31, matrix A05–A07

*Edit a zone corner by typing its position*, its `obsidian` rows, on the sample project that
`create-sample-project` seeds through the real commands.

- **Steps 1 and 2.** Obsidian's own `Menu` offers **Edit corners** on a right-clicked zone, and it
  opens the dialog.
- **Steps 3 and 4.** The Inspector button opens the same dialog for a Room and for the Garden.
- **Steps 7 and 8.** Type an X with a comma decimal and submit. Read the plan's geometry sidecar:
  that corner has exactly the typed value and every other corner is byte-identical.
- **Step 10.** Ctrl+Z restores the exact prior outline and Ctrl+Y re-applies it, through Obsidian's
  keymap.
- **Steps 13 and 14.** In Renovate the entry is greyed and titled **Edit geometry in plan**. In
  Review it is absent.
- **Step 17**, if Obsidian's language can be switched in the harness: both doors read
  **Eckpunkte bearbeiten**. If it cannot be switched, the case is not written and the reason is
  recorded.
- **The real-screenshot clause (L-31).** Save screenshots of the dialog and of the marked corner as
  named evidence. Evidence is not an assertion, and the case's Runs table says so.

### 3.6 `mobile.e2e.ts` — BP-09, A26, L-43 (mobile-emulation leg only)

*Read projects on mobile*, steps 2, 4, 6, 7 and 8, plus the Asset Library guard that case does not
yet check. Seed read-only content by writing fixture notes into the vault through
`app.vault.adapter`, adapted from `tests/vault/valid-project/`, then reload the plugin.

- **Step 2.** The list's write controls are drawn and disabled. Its read controls are not disabled.
- **Step 4.** A project row still navigates. **New plan** and the plan rows are present and disabled.
- **Step 6.** The guarded commands are unavailable. Measure how the palette decides first: its
  `checkCallback` answer, or the palette's own list.
- **Step 7.** Plan Editor and Asset Designer leaves set on mobile draw one refusal sentence and no
  canvas, and switching away and back does not stack a second sentence.
- **Step 8.** Closing both leaves throws nothing.
- **L-43.** The Asset Library's write controls are drawn and disabled.

### 3.7 `accessibility.e2e.ts` — the surfaces PR 231 added, in a real renderer

axe WCAG A/AA with colour contrast graded, in both themes, over the harness's existing
`AxeBuilder` pattern:

- the Plan Editor on the seeded sample plan
- the Plan Editor paused, with the incident strip and the stale strip
- the diagnostics modal with an open incident, which sits on `document.body` outside every jsdom scan
- the New plan dialog showing the writes-paused banner

Each scan asserts that `color-contrast` actually ran, as the existing case does. The existing
project-view scan stays in `renovationPlanner.e2e.ts`.

### 3.8 `smoke.e2e.ts` — A01, and Empty States step 4

- **No unhandled error across every route.** Before a disable and re-enable, install a collector
  for `console.error`, `error` and `unhandledrejection` in the renderer. Then walk: the project view,
  `create-sample-project` into the editor, the asset library, the diagnostics report, the asset
  designer on a seeded asset (skipped with a reason if no seeded asset is reachable), and a disable
  and re-enable. Assert nothing was collected. That also covers Konva's "Several instances" error.
- **The global a dependency installs.** `window.Konva` is released after disable.
- **Empty States step 4.** The seeded plan draws its five zones on the Konva stage, read from
  `window.Konva.stages`, and no FloorStart or empty-state overlay is drawn.

## 4. Shared structure

- **Helpers move only when two files use them.** `openPlan`, `tryNewPlan`, the incident planters and
  a `seedSampleProject(ui)` built on the `create-sample-project` command go into
  `tests/e2e/planner.ts`. `writeIncident.e2e.ts` imports them from there.
- **Suffix and wiring.** Every case file ends in `.e2e.ts`, so `tests/gates/e2e-wiring.test.ts`
  keeps holding.
- **Selectors are the app's own classes and `data-rp-*` attributes.** Text assertions use the
  English copy, and the host is already forced to `--lang=en`.
- **Waiting.** Use `expect.poll`, never a fixed sleep. The one exception is a measured window, such
  as "does the row appear within the debounce plus a margin". That window is a named constant with
  its reason written beside it.
- **Evidence.** A measurement the owner needs is written with `writeEvidence` under
  `e2e-results/cases/`, which CI uploads.

## 5. Verification rule for every case

1. The case passes locally in `npm run test:e2e -- <file>`, and the whole suite passes together.
2. **Mutation.** Break exactly the clause in `src/`, see the case go red on that assertion, restore,
   and record the mutation in the commit message. A pin in §3.4 is mutated by changing the plugin
   behaviour it pins, where one exists. When the pinned fact belongs to Obsidian, the commit says so.
3. `npx vue-tsc -noEmit`, `npx oxlint --deny-warnings` and `npx eslint --max-warnings 0` pass on the
   changed files.
4. The manual case's Runs table, and the tracker row the case answers, are updated in the same
   commit with what was measured. That includes anything unexpected, recorded rather than fixed.

## 6. Order

1. Shared helpers.
2. Q2, then Q3. These are the G1 blockers.
3. `leafIncident`.
4. `cornerEditing`.
5. `smoke`.
6. `accessibility`.
7. `mobile`, which needs the mobile-emulation leg run locally with `OBSIDIAN_UI=mobile-emulation`.

Each task is implemented sequentially by one subagent and reviewed before the next starts. Two real
Obsidian runs at once contend for the machine.
