# RESUME — session seventeen's hand-off, for the manual-walk session

**Rewritten 2026-09-24, replacing session sixteen's packet wholesale.** An appended hand-off goes
stale in a way its reader cannot detect.

Branch `renovation-planner-asset-designer-bc5539`, worktree
`D:\Projects\renovation-planner\.claude\worktrees\renovation-planner-asset-designer-bc5539`.
PR [#230](https://github.com/Luis85/renovation-planner/pull/230) is still a **DRAFT**. **Nobody marks it
ready, tags it or publishes it without asking the user.**

| | |
|---|---|
| HEAD | **A hand-off cannot name its own sha.** Confirm it yourself: `gh run list --branch renovation-planner-asset-designer-bc5539 --limit 1 --json databaseId,headSha,status`, then `gh run view <id> --json status,conclusion,jobs`. The tree was clean and pushed when this was written |
| Last sha confirmed green | **`e83202e09`**, run [`36020948497`](https://github.com/Luis85/renovation-planner/actions/runs/36020948497), `verify` ×4 plus `audit`, all success. It carries every `src/`, `styles/` and test change of this round. `git diff --name-only e83202e09..HEAD` should show only `docs/` files |
| `origin/main` | Last merged at `0d9cdb142` (it brought main's `126f79589`). `git merge-base HEAD origin/main` was `126f79589` on 2026-09-24. Fetch and check again before assuming nothing has moved |

## The next session's job: the manual vault walk

Nothing agent-closable is open in this package. What is left is the deferred terminal pass, which a
person does in a real Obsidian vault (`npm run test-build` builds into this repository, which IS a
vault).

- **The index is [`MANUAL-PASS.md`](MANUAL-PASS.md): 215 human steps across seven cases.** Do not
  trust that number: run the command the index prints.
- **Start with grouping.** It is the one defect a user hit in a real vault (below), and the steps for it
  in `Compose an asset from parts` walk every door, at the resting Select and with Pan chosen.
- **A walk decides nothing on its own.** A step that fails against correct code is a step to fix, and a
  step that passes a defect is worse. Every expectation added this session was checked against source by
  an independent reviewer, but a reviewer of text is not a vault.

## What this session shipped (rulings AD18-R20, R21, R22)

**The reported bug: grouping from the right-click menu did nothing, in a vault (AD18-R20).** Nothing in
this repository had ever observed a successful Group from the resting state: every group test clicked
Select first. Two faults, both root-caused in the harness with real mouse events and fixed:
- the designer rested in camera mode (Pan), where the menu and every selection key refused silently;
- a Parts row always replaced the selection, so Shift and `Select multiple parts` built no set.

The menu and keys now work under Pan too, Parts rows extend with Shift or the toggle, and (the user's
ruling) **the designer now opens with Select active**.

**Also under AD18-R20 (defects, no ruling):**
- a clearance re-shows when a read-back brings it back (redo, undo of a removal, a peer's write);
- a selected part that is not drawn (hidden clearance, Parts-hidden graphic) draws no outline or handles,
  and no press hits them;
- a handle resize of any curved graphic or curved footprint keeps the opposite side fixed and lands the
  typed path's size (the vanity basin used to move its fixed edge and miss the pointer);
- focus rings on the designer's selects and checkboxes; left-aligned Library tile names; duplicated test
  helpers moved to `tests/helpers/`.

**AD18-R21 (nine polish items, approved in one round):**
- a handle resize keeps a rounded rectangle's radius;
- a designer canvas focus ring, clear of the rulers on all four sides;
- a small drawing (footprint under 240 px across) rests with the overall width and depth only;
  resting labels keep off the selected part's handles, and an overall label never lands on the drawing;
- the five selects styled like the designer's inputs;
- checkbox label rows at least 24 px tall;
- the Parts row's controls as one row of icon buttons;
- Add-rail shape tiles at one height (`grid-auto-rows: 1fr`, so German's taller labels stay equal);
- a category icon on a Library tile with no design;
- a save from an earlier day says which day, on both surfaces.

**Declined:** one term for the placement point (`Anchor` / `Placement point` both stay).

**AD18-R22 (four questions from the whole-round review):**
- a hidden but selected part refuses the selection keys and menu (the Inspector's buttons still act);
- the Parts-row icon buttons wrap at a 580 px leaf (the rail is 128 px there);
- 0 mm offsets keep resting;
- the Hide and Lock glyphs show the current state (the Plan Editor's convention).

The plan is [`AD18-polish-round-plan.md`](AD18-polish-round-plan.md).

## Known behaviour: the walk must NOT file these as new defects

- **A hidden clearance SWAPPED for a new one** by undo, redo or a peer's write while `Show clearance` is
  off stays hidden. Only an absent-to-present read-back re-shows it.
- **An overall dimension label may slide along its own line, even past the line's end.** The line runs
  on into it. It does this to keep off a handle, usually the rotate handle under the ruler (toilet
  preset, footprint selected, 1280 leaf). Judge on screen whether it reads as attached (AD18-R14).
- **On canvases about 280 to 360 px wide, an overall label may keep its anchor ON a handle** when no slot
  along or outside its line is free. That handle may then be unreachable. Modelled, 205 of 77,964 frames.
- **The rulers' selection band and Shift+2 framing still follow a hidden selected part.**
- **The Parts-row icon buttons wrap onto two lines at a 580 px leaf** (AD18-R22).
- **0 mm offset labels rest** (AD18-R22).
- **A curved clearance's handle drag is still a plain scale** (C07 governs it).
- **At the 760 and 580 leaves the overall depth label straddles the footprint's left edge.** It did before
  this round too: there is no room beside the ruler.
- Carried over from session sixteen and still true: `Saved at HH:MM` (same day) carries no date; on
  Windows, arrow keys on a closed `<select>` fire one edit per step; at the zoomed-out default camera the
  overall depth label can touch detail-1's width.

## Things only the walk can settle (no gate here can)

- **Obsidian's own Ctrl+G (graph view) against the designer's Group key**, with something groupable and
  without, and with the focused part hidden. Written as observe-and-record.
- **Focus after a Group from a Parts row**: from the menu it lands on the canvas once the write drops it;
  after Ctrl+G on a row it follows the panel's own rule. Neither is exercised by a real write in any test.
- **How the styled selects, the icon row, the 24 px rows and the canvas ring look in a themed vault.** The
  harness stylesheet is a reduction of Obsidian's.
- **Screen-reader output** for the icon buttons (the swapping name, no `aria-pressed`) and for the save
  indicator (`Saved` only).

## CI, the browser, and this machine

Every task was pushed and read **by run id**. No red this session. The Windows leg on
`tests/gates/network-boundary.test.ts` (a 5000 ms timeout) remains a known flake: `gh run rerun <id> --failed`.

**The headless browser changed mid-session.** Another session updated the shared `node_modules` to
playwright-core 1.62.1, which pins Chromium build 1234. Captures between that update and the end of the
session used the installed build 1223 through `RP_CHROMIUM_EXECUTABLE`, which the script announces as
approximate. **At the user's request the pinned build was then installed** (`chromium-1234` under
`D:dev-cacheplaywright`, verified: `scripts/chromium.mjs` resolves it with no override and it launches
as 151.0.7922.34), so captures need no override now. The optional headless shell download stopped at a
stale `__dirlock` left by another process; the repository's captures do not use it.

7.8 GB RAM, **shared**. The designer suite ran up to five times slower under load this session, and a
worker-start timeout once turned a fully green run into exit 1. Re-run the named file alone before
believing it.

- Prefix every node-spawning command with `export TEMP=D:/tmp-claude TMP=D:/tmp-claude`.
- The harness (`preview_start "harness"`) must be **restarted after a card creates a new file**, because
  Vite caches a failed import resolve.
- The browser pane's screenshots time out while the window is hidden. `resize_window` to a fixed size
  first, then screenshot, or measure with `getBoundingClientRect` through `javascript_tool`. A headless
  Playwright script against the running harness is the most reliable instrument.
- **Never `git stash`.** When two agents share this worktree, each stages **by explicit path only**.

## The rule this session paid for

**Measure the selection the reviewer will probe, not the one you happened to pick.** The integrator
measured Task 5's labels with the basin selected and nothing selected, and called it clean. The reviewer's
probe then selected the footprint and found the overall width inside the drawing in 9,050 of 77,964
frames. Four fix rounds followed, each one measured before it was accepted. The same pattern held for the
canvas ring: it was accepted on two sides, then on the wrong offset, and only a screenshot of all four
edges settled it.
