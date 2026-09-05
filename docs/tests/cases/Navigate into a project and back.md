---
type: Test case
parent: "[[Smoke Test the Editor]]"
order: 57
sources:
  - Workspace PRD §13
  - SDD §11
  - SDD §12
status: Ready
---

# Navigate into a project and back

Current project-entry expectations were updated on 2026-09-05; see the [execution record](../../user-experience/renovation-planner-project-specs/implementation/execution-record.md). Earlier capture descriptions below are historical. This update records no new live-vault pass.


Design slice 21's navigation in a real vault: the Renovation project pane's list state and
detail state, and the leaf's own back and forward arrows moving between them.
`docs/tasks/21-the-project-detail-state.md` records what the runs found and points here.

Preconditions: `npm run test-build`, this folder open as a vault, the plugin enabled, and
**at least two** renovation projects, one of which holds at least one plan.
`Create sample renovation project` seeds one of each if the vault is empty.

**Why a human is the only instrument for this.** The suite can assert that
`setState` sets `ViewStateResult.history = true` and nothing more. Whether Obsidian *honours*
it — whether the leaf's arrows actually walk the entries we push — is a fact about the host:

- **`FakeLeaf` records asks rather than behaving.** It stores what `setViewState` was called
  with; it runs no view factory, keeps no navigation stack, and has no arrows. A test asserting
  "back returns to the list" against it would be asserting about our own recording.
- **jsdom models no workspace at all** — no leaf chrome, no header, no history control.
- **`FakeLeaf.setViewState` has already been *faster* than the real one**, establishing view
  state synchronously where Obsidian runs a view factory and `onOpen` first. CLAUDE.md records
  that this once made a duplicate-tab regression case pass against a live defect. The whole of
  this slice's navigation is that round trip.

**What is already discharged elsewhere, so that a runner does not re-derive it.** The detail
state's LAYOUT has a headless capture as of this slice — `npm run harness-shot` writes
`project-detail.png` at 1280 and `project-detail-narrow.png` at 460, the width an Obsidian
sidebar leaf actually has — and the two rules that capture exists for were measured in that
browser rather than judged by eye: `.rp-project-detail`'s `flex: 1` fills an 800px leaf where
without it the shell is its header alone at 123px, and `.rp-plan-list`'s scroll block gives the
list a 677px box over a 780px scroll height under a `Plans` header that does not move. The
no-plans state was looked at the same way, with the harness fixture's plans removed by hand for
one capture: the panel is centred in the 719px the header leaves, with Back and Open note still
above it. Steps 14 and 15 are what a THEMED leaf in a real workspace adds to that, not a first
look.

## Steps

Each step carries a `Reachable by` verdict — the cheapest instrument that could
discharge it as written. [[Smoke Test the Editor]]'s *The triage column* section defines
the five values and what they do not claim.

| # | Reachable by | Do this | It passes when | It exists to catch |
| --- | --- | --- | --- | --- |
| 1 | `obsidian` | Open the Renovation project pane from the ribbon | The **list** draws, one row per project | The pane still opening on the state it always did — this slice gave the same view a second one |
| 2 | `suite` | Click a project row | The pane swaps to that project's **detail** state: its name, its status, and its plans beneath. **`Project.md` does not open** | Criterion 1. The row opened the raw note for five slices; a click that still opens one is the whole defect this slice was reported for |
| 3 | `obsidian` | Press the leaf's **back** arrow | The pane returns to the list | Criterion 13, and the half no gate can reach: the suite can only see that `setState` set `history = true`, never that Obsidian walked it |
| 4 | `obsidian` | Press **forward** | The pane returns to the same project | The other end of the same entry. A `history` that records the departure and not the arrival looks identical at step 3 |
| 5 | `suite` | Click the detail header's own **‹ Back to projects** | The pane returns to the list | Criterion 11. A DIFFERENT mechanism from step 3 and worth its own step: the arrow asks Obsidian to *restore* a state we recorded, while this action *sets* one — both carrying the same `''` list sentinel, which a validator modelled on the Plan Editor's would have refused |
| 6 | `obsidian` | Return to the detail state, then click **Open note** | `Project.md` opens in its own tab, and the Renovation project pane still shows the detail state | Criterion 5. The note has to stay reachable now that the row no longer opens it, and reaching it must not cost the pane its place |
| 7 | `suite` | Click a plan row | The Plan Editor opens on that plan | Criterion 2 — the same `revealPlanEditor` the palette command uses, rather than a second way in |
| 8 | `obsidian` | Go back to the Renovation project pane | It is still on the same project | A leaf Obsidian reuses re-runs `onOpen`; the project it draws must come from the state, not from a field that survived by luck |
| 9 | `suite` | Click **New plan**, give it a name, submit | The plan appears in the list **without** reopening the pane | Criterion 3 — the first user-facing caller of `CreatePlanCommand`, plus `ProjectDetailState.onCreatePlan`'s re-read. A created plan that never appears is indistinguishable from a create that silently failed |
| 10 | `obsidian` | Open **Settings → Renovation Planner**, change the default projects folder, and save | The pane is **still on the same project**, not back at the list | Criterion 7. `rebind` tears the whole Vue tree down, which is exactly why the open project lives in Obsidian's view state rather than in Pinia |
| 11 | `obsidian` | Close Obsidian entirely and reopen it, watching the pane as it appears | The pane reopens **on the same project**. It may show its loading line for an instant; it must never show the LIST and must never settle on "this project no longer exists" | Criterion 8, and the ordering Obsidian actually uses: leaves are restored BEFORE `onLayoutReady`, and the index scan runs from it. A restored detail state that read the empty index's legitimate `ok(null)` as a deleted project would draw "this project no longer exists" over the very `projectId` this step is about — and until the improvement pass it would also have navigated to the list, destroying it |
| 12 | `obsidian` | Empty the vault of project notes (move `Renovation/` aside), reload, and open the pane | It reaches the LIST with its empty state — it does not sit on a loading line for the session | The other half of criterion 8, and the reason the gate is "has the scan RUN" rather than "has the index been populated": a vault whose last project note was deleted while Obsidian was closed has an index that will never have entries in it |
| 13 | `obsidian` | **With the pane already open on a project**, run **Go to renovation project** from the palette and pick the *other* project | The pane shows that one, in the **same leaf** — no second Renovation project tab appears. Press back; the pane returns to where it was | Criteria 9 and 10. The already-open leaf is the normal case and the one the first design could not navigate: a reveal sets state only on a leaf it creates |
| 14 | `browser` | Open a project with many plans, then narrow the pane | The body scrolls under the header; the project name wraps and actions remain reachable without horizontal overflow | Narrow layouts retain readable names and controls |
| 15 | `browser` | Create a project before giving it any plans | Successful creation enters its details directly. Optional guidance, New plan, Project prices, Back and Open note remain available | Empty plans do not block the core project actions |
| 16 | `obsidian` | Switch Obsidian's language to German (Settings → General → Language) and repeat steps 2, 5 and 9 | The detail header, the `Plans` region, the empty state and the New plan dialog all render in German | Every string this slice added is a `StringKey` resolved through `t`/`tr`. `tests/presentation/i18n/strings.test.ts` pins that `de.ts` answers every key and two terms; it renders nothing, so nobody has looked at this copy in a running app |
| 17 | `obsidian` | With the pane open on a project, delete that project's `Project.md` from the vault, then watch the pane; press the leaf's **back** arrow, then **forward** | The pane draws "this project no longer exists" with a **Back to projects** action — it does not jump to the list on its own. Back and forward move between the list and that screen; neither bounces the pane somewhere the arrow did not ask for | The improvement pass's own step, and the half no gate can reach. The suite can see that nothing calls `navigate` and that the screen draws; only a vault can show what Obsidian's arrows do with the entries `setState` recorded. The build this replaced redirected automatically, and `setState` records `history` for any accepted changed state — so back restored the DEAD project, re-read it, found it gone and bounced forward again |

## Acceptance criteria

1. Step 2 opens the detail state and opens no note.
2. Steps 3 and 4 move back and forward through the two states using Obsidian's own arrows, and
   step 5 reaches the list through the header's own action.
3. Step 6 opens the note without losing the pane's place.
4. Step 9's new plan appears without a manual reopen.
5. Step 10 keeps the user in the project across a settings save.
6. Step 11 keeps the user in the project across a restart, without a flash of the list state.
7. Step 12 reaches the list rather than waiting for an index scan that will find nothing.
8. Step 13 navigates the leaf that is already open and creates no second tab of a singleton.
9. Steps 14 and 15 leave no strip of dead pane and no unreachable plan row.
10. Nothing in steps 1–16 draws a plan or project the vault does not hold.

## Deliberately NOT checked

- **Whether the pane mounts once or twice on a restore.** One ordering of `onOpen` and
  `setState` still mounts the list and then remounts the project, which is invisible to a user
  — the first tree is replaced before a frame is painted — and is pinned as behaviour in
  `renovationProjectView.test.ts` rather than left to be noticed here. `docs/tasks/21` carries
  the follow-up.
- **Colour contrast and hit-target size.** `tests/harness/accessibility.test.ts` grades roles,
  names, labels and ARIA validity, and explicitly not those two. Step 14's claim is about
  layout, not about measured contrast; the one element on this surface with a colour of its own
  is the status label, measured at 6.69:1 in light and 8.13:1 in dark against the pane behind
  it when its capture was taken.

## Runs

| Date | Build | Outcome |
| --- | --- | --- |
| — | — | Not yet run in a vault. Every row above is an expectation derived from the design document, the task document and the code — except steps 14 and 15's layout, which was measured in a headless Chromium (a substitute build, not the pinned one) at 1280 and 460. |

## Outcome

Written after the first walk: which steps passed, and anything only a live vault showed.
