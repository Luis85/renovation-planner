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

## How to check

1. Open the Renovation project pane from the ribbon. The **list** draws, with a row per
   project.
2. Click a project row. The pane swaps to that project's **detail** state: its name and
   status, and its plans beneath. **`Project.md` does not open.**
3. Press the leaf's **back** arrow. The pane returns to the list.
4. Press **forward**. The pane returns to the same project.
5. Click the detail header's own **‹ back**. The pane returns to the list. A different
   mechanism from step 3 and worth its own step: the arrow asks Obsidian to *restore* a state
   we recorded, while this action *sets* one — both carrying the same list sentinel, which a
   validator modelled on the Plan Editor's would have refused.
6. Return to the detail state, then click **Open note**. `Project.md` opens in its own tab, and
   the Renovation project pane still shows the detail state.
7. Return to the pane and click a plan row. The Plan Editor opens on that plan.
8. Go back to the Renovation project pane. It is still on the same project.
9. Click **New plan**, give it a name, submit. The plan appears in the list without reopening
   the pane.
10. Open **Settings → Renovation Planner** and change the default projects folder, then save.
    Return to the pane: it is **still on the same project**, not back at the list.
11. Close Obsidian entirely and reopen it. The pane reopens **on the same project**.
12. **With the pane already open on a project**, run the **Open project** command from the
    palette and pick the *other* project. The pane shows that one, in the **same leaf** — no
    second Renovation project tab appears. Press back; the pane returns to where it was. The
    already-open leaf is the normal case and the one the first design could not navigate: a
    reveal sets state only on a leaf it creates.
13. Move every project note out of the vault, reload, and run **Open project** again. The pane
    reveals the **list** with its empty state and its Create button — not a picker with no
    rows, and not a notice.

## Acceptance criteria

1. Step 2 opens the detail state and opens no note.
2. Steps 3 and 4 move back and forward through the two states using Obsidian's own arrows, and
   step 5 reaches the list through the header's own action.
3. Step 6 opens the note without losing the pane's place.
4. Step 9's new plan appears without a manual reopen.
5. Step 10 keeps the user in the project across a settings save.
6. Step 11 keeps the user in the project across a restart.
7. Step 12 navigates the leaf that is already open and creates no second tab of a singleton.
8. Step 13 reveals the list, not a zero-row picker.
9. Nothing in steps 1–13 draws a plan or project the vault does not hold.

## Outcome

Written after the first walk: which steps passed, and anything only a live vault showed.
