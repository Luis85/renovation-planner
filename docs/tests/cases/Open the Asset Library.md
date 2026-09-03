---
type: Test case
parent: "[[Smoke Test the Editor]]"
order: 85
sources:
  - docs/user-experience/asset-library-overview-DESIGN-SPEC.md §2
  - docs/user-experience/asset-library-overview-DESIGN-SPEC.md §6.3
  - SDD §12
status: Ready
---

# Open the Asset Library

Task 11's own surface, walked in a real vault: the Asset library's Obsidian lifecycle, its
registration, its rebind on a settings save, and its two in-app doors plus the palette
command. This case is scoped to what Task 11 built — the view opening, holding a subject
across a restart, and updating in place — and NOT to §3's shelves, inspector or toolbar,
which are Tasks 12–14's own markup and their own case when it exists.

Preconditions: `npm run test-build`, this folder open as a vault, the plugin enabled.

**Why a human still matters here**, the same two shapes CLAUDE.md's harness section names
for every other surface:

- **An icon is a picture, and no gate here looks at one.** The Asset library's tab icon is
  Lucide's `boxes`; the Asset designer's (a different, already-shipped surface) is `box` — one
  crate against several. A Task 11 review round called this "no collision and no defect" by
  name and reading, and also called it "worth an eye in a vault" — a judgement neither `npm
  run harness` nor `npm run harness-shot` can make, since both draw a `<svg>` this tool never
  compares against a sibling for legibility at real tab size. Step 6 is that eye.
- **A settings-save rebind is timed against a human's typing, not against a test's tick.**
  `rootSwapRebind.test.ts` proves the mechanism fires and the tree remounts; it says nothing
  about whether a rebind lands mid-interaction in a way that reads as a glitch. Step 5 is
  where that is looked at.

## Steps

| # | Where | Do | Expect | Why |
| --- | --- | --- | --- | --- |
| 1 | `obsidian` | Open the command palette and run **Open asset library** | A new pane opens, titled to match its ribbon-less door, drawing "No asset selected" | The palette command is one of Task 11's two named entry points into a view with no ribbon icon of its own — §2 gives this surface no ribbon slot, unlike the Renovation project view |
| 2 | `obsidian` | From the Renovation project view's project list, use its header's own **Assets** door | The same pane as step 1 is revealed rather than a second tab opening | `revealCandidate`'s in-flight map and the singleton view type are what stop a second tab; two doors to one subject-less view are exactly the case CLAUDE.md's "One action, every input" rule exists for |
| 3 | `obsidian` | From the empty-project aside (`ViewRoot`'s own no-projects state, on a vault with none yet), use its **Assets** door | Reveals the identical pane a third time, still one tab | The second in-app door, reached from a different empty state than step 2's |
| 4 | `obsidian` | Close Obsidian entirely with the Asset library pane open, then reopen it | The pane is restored to whatever it showed before closing (today: the unselected state, since Tasks 12–14 have not yet built a selectable row) | `getState`/`setState` round-trip through Obsidian's own workspace layout, not through Pinia — the same mechanism `RenovationProjectView`'s detail state already proves for a project id |
| 5 | `obsidian` | With the pane open, go to Settings → Renovation Planner and change any setting (e.g. the units) while watching the pane | The pane's content is momentarily rebuilt (a `rebind`) and returns to the same state it held before the save, with no visible flash of an unrelated screen | `RenovationProjectView.rebind` and `AssetLibraryView.rebind` share the identical shape (`unmount(); mount();`), and this is the one place a human rather than a tick-counted test watches what that swap actually looks like |
| 6 | `obsidian` | With the Asset library pane and an Asset designer pane (open any existing asset, or create one) both visible as tabs in the same sidebar | The two tab icons — `boxes` for the library, `box` for the designer — are distinguishable at a glance, without needing to read either tab's title | The M13 finding this case exists to schedule: reviewed and judged "no collision" once already, and this is the eye check that judgement asked for rather than a repeat of the reading |

## Acceptance criteria

1. Step 1 and the palette command open a view with no ribbon icon, drawing the unselected
   state and nothing else — no error, no stray console warning.
2. Steps 2 and 3 reveal the SAME tab rather than opening a second one, from two different
   empty-state doors.
3. Step 4 survives a full restart with the pane's subject intact.
4. Step 5's rebind is not visually jarring and does not lose the pane's place.
5. Step 6's two icons read as different pictures at real tab size.

## Deliberately NOT checked

- **§3's shelves, categories, the inspector and the toolbar.** None of that markup exists
  yet; Tasks 12–14 build it and get their own case.
- **Colour contrast and hit-target size**, for the same reason every other case in this
  folder excludes them: `tests/harness/accessibility.test.ts` grades roles, names, labels and
  ARIA validity and explicitly not those two.
- **Whether the two new axe-scanned states (unselected, and a selection plus an expanded
  category carried in view state) look right.** `tests/harness/accessibility.test.ts` proves
  they scan clean and that the scan is not vacuous; nothing here re-verifies that by eye,
  since neither state has any visible content beyond the one message this case's steps
  already read.

## Runs

| Date | Build | Outcome |
| --- | --- | --- |
| — | — | Not yet run in a vault. Every row above is an expectation derived from the design spec, the task brief and the code. |

## Outcome

Written after the first walk: which steps passed, and anything only a live vault showed —
step 6's icon-legibility judgement in particular, since that is the one thing this file
exists to move out of a review's prose and into a scheduled check.
