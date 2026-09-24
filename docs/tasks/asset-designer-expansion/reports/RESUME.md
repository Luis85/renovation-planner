# RESUME — session eighteen's hand-off, for the manual-walk session

**Rewritten 2026-09-24, replacing session seventeen's packet wholesale.** An appended hand-off goes
stale in a way its reader cannot detect.

Branch `renovation-planner-asset-designer-bc5539`, worktree
`D:\Projects\renovation-planner\.claude\worktrees\renovation-planner-asset-designer-bc5539`.
PR [#230](https://github.com/Luis85/renovation-planner/pull/230) is still a **DRAFT**. **Nobody marks it
ready, tags it or publishes it without asking the user.**

| | |
|---|---|
| HEAD | **A hand-off cannot name its own sha.** Confirm it yourself: `gh run list --branch renovation-planner-asset-designer-bc5539 --limit 1 --json databaseId,headSha,status`, then `gh run view <id> --json status,conclusion,jobs`. The tree was clean and pushed when this was written |
| Last sha confirmed green | **`79239ba33`**, run **[`36060951473`](https://github.com/Luis85/renovation-planner/actions/runs/36060951473)**, `verify` ×4 plus `audit`, all success. It carries every `src/`, `styles/` and test change of this round. `git diff --name-only 79239ba33..HEAD` should show only `docs/` files |
| `origin/main` | Last merged at `0d9cdb142`. `git merge-base HEAD origin/main` was still `126f79589` on 2026-09-24, with no new commits on main. Fetch and check again before assuming nothing has moved |

## The next session's job: the manual vault walk

Nothing agent-closable is open in this package. What is left is the deferred terminal pass, which a
person does in a real Obsidian vault (`npm run test-build` builds into this repository, which IS a
vault).

- **The index is [`MANUAL-PASS.md`](MANUAL-PASS.md): 232 human steps across seven cases**
  (103/19/23/26/33/8/20). It was 215. Do not trust the number: run the command the index prints.
  Two further rows for the Plan Editor's zone lock sit in `Open a floor and select a room`, outside
  the seven counted cases.
- **Start with grouping and undo.** Grouping is the one defect a user hit in a real vault (AD18-R20).
  This session is the first to watch a successful Group in a browser (below), and the designer only
  now answers Ctrl+Z at all.
- **A walk decides nothing on its own.** A step that fails against correct code is a step to fix, and a
  step that passes a defect is worse. Every expectation added this session was checked against source by
  an independent reviewer, who found two wrong ones and had them fixed, but a reviewer of text is not
  a vault.

## What this session shipped (ruling AD18-R23)

Session eighteen verified at source each item the polish round had recorded rather than fixed. The
user then took four rulings in one batched round. Two defects were found during the round, one while measuring
and one by a review, and fixed under the same ruling.

**Ruled (all four as recommended):**
- **A clearance a read-back changes re-shows it.** While `Show clearance` is off, an undo, redo or
  peer write that changes the clearance's geometry turns the switch back on. A write that leaves the
  geometry alone keeps it hidden.
- **An overall dimension label steps onto the drawing before it covers a handle.** This only happens
  when no slot along or outside its line is free, on 280–360 px canvases. It used to sit on the handle
  in 205 of 77,964 modelled frames, and now does in none.
- **A curved clearance's box-handle drag solves like every other curved part.** The side opposite
  the handle holds, and the dragged side lands on the pointer, as a typed size does.
- **The browser harness has a `&writable` knob** over the real command bundle and an in-memory vault:
  `?view=asset-designer&preset=<id>&writable`. It is test tooling only.

**Defects fixed without a ruling:**
- the rulers' selection band and Shift+2 no longer follow a hidden selected part;
- the Plan Editor's zone lock toggle drops `aria-pressed`, the same contradiction 3405aab95 removed
  from the designer. Its two stylesheet rules now key on `data-rp-locked`, so an unlocked padlock in
  the Layers list still hides until hover or focus, and a locked one is still emphasized;
- **the designer answers Ctrl+Z, Ctrl+Shift+Z and Ctrl+Y** (Cmd on macOS) through the Plan Editor's
  own `editorHistoryShortcut`. Before this there was no binding at all, although a manual step
  already expected one. Found by watching `&writable` in Chromium;
- **a size typed or dragged past what a curved part can reach now stops at the limit.** Before, it
  jumped up to 587 mm the wrong way (`solveScale`). Found by Task 5's review, and it took four fix
  rounds, one of them for a corner drag the fix itself had broken.

**Already fine, recorded so nobody reopens them:** arrow keys on a hidden selected part stay claimed
(`keyDoors.ts`, Finding B). An Ungroup whose group includes a hidden member is allowed, because
Ungroup is metadata only (C06).

The plan is [`AD18-followup-round-plan.md`](AD18-followup-round-plan.md). The ruling and its defect
list are AD18-R23 in [`DECISIONS.md`](../contracts/DECISIONS.md).

## Known behaviour: the walk must NOT file these as new defects

- **A hidden clearance re-shows after ANY read-back that changes its geometry**, not only undo, redo
  or a peer. A pending clearance that `Set dimensions` or a calibration rescales therefore comes back
  into view, and so does an undo of either.
- **A typed or dragged size a curved part cannot reach lands on the nearest size it CAN, with no
  notice.** An oval-table clearance dragged inward stops at 700 mm. A hand-drawn quad typed to Width 67
  lands on 202.5, where a refusal used to explain why.
- **A drag whose pointer ends in the canvas's ~40 px edge band pans the camera, and the resize keeps
  growing while it rests there.** This is true for every part and predates this round. Keep drag steps
  clear of the band.
- **Ctrl+Z does nothing while a `<select>` or the corner-radius slider has focus.** The shared helper
  leaves those to the browser, and neither has native undo. The Plan Editor has the same gap.
- **Ctrl+Z and Ctrl+Y are claimed even with nothing to undo** (the Plan Editor's rule). Ctrl+G is
  left to Obsidian when there is nothing to group.
- **Ctrl+Z pressed on the open dimension form's buttons undoes the design and leaves the form open**
  (Plan Editor parity).
- **An overall label may now sit over the drawing on a narrow canvas** (280–360 px): that is the ruled
  trade for keeping a handle reachable.
- Carried over and still true:
  - an overall label may slide along its own line, even past its end (AD18-R14);
  - the Parts-row icon buttons wrap at a 580 px leaf (AD18-R22);
  - 0 mm offset labels rest;
  - at the 760 and 580 leaves the overall depth label straddles the footprint's left edge;
  - `Saved at HH:MM` (same day) carries no date;
  - on Windows, arrow keys on a closed `<select>` fire one edit per step.

## Things only the walk can settle (no gate here can)

- **Obsidian's own Ctrl+G (graph view) against the designer's Group key**, and now whether any
  user-assigned hotkey on Ctrl+Z or Ctrl+Y goes dead while a designer leaf has focus.
- **Focus after a Group from a Parts row**, now that a successful Group has been seen in Chromium but
  never in a vault.
- **How the lock toggle reads to a screen reader** ("Lock Kitchen", "Unlock Terrace", no pressed
  state), and the designer's icon buttons and save indicator.
- **How the styled selects, icon rows, 24 px rows, canvas ring and inward labels look in a themed vault.**
  The harness stylesheet is a reduction of Obsidian's.

## Recorded, not fixed (for a later round)

- `assetDesignHarness.ts` still builds its own copy of the command bundle and spec-sheet list, which
  `tests/helpers/designerComposition.ts` now defines once (final review N2).
- The tree footprint's validation refuses a scale factor of 1.4999944 but accepts 1.50192: a fragility
  in footprint validation, not in the solver.
- `samePolygon` compares bulges with strict `===`, so a round-tripped float could over-reveal a
  clearance. That is the safe direction.
- fallow's CSS clone between `designer-selection.css` and `project-list.css` predates this branch and
  does not gate.

## CI, the browser, and this machine

Every task was pushed and read **by run id**. Two red runs this session, each root-caused and fixed:
- **a fallow `private-type-leaks` error** in `tests/harness/assetDesigner.ts`. fallow reads
  `tests/harness/` and `tests/helpers/` exports too;
- **a fallow health finding**: `solveScale`'s cognitive complexity went over threshold, so it was split.

**Only fallow's `Failed:` line and its `N above threshold` count are the gate.** A local
`npx fallow health` flags about 170 more without coverage data; CI's coverage-aware run is the
authority. The Windows leg on `tests/gates/network-boundary.test.ts` (a 5000 ms timeout) remains a known
flake: `gh run rerun <id> --failed`.

**The pinned Chromium (build 1234) is installed** under `D:\dev-cache\playwright`, and `scripts/chromium.mjs`
resolves it with no override. Measurement scripts from this session are in `.superpowers/sdd/measure/`
(gitignored). `pw.mjs` opens the harness and hands you the Pinia stores. **Two instrument lessons:**
- Read a drag's handles in WORLD coordinates, or end it well clear of the 40 px edge-scroll band. A
  screen-pixel read of a drag that entered the band reported a 246 px "drift" that was the camera
  panning.
- Measure the frames a reviewer will probe: every selection, all eight handles, both schemes.

7.8 GB RAM, **shared**. Prefix every node-spawning command with `export TEMP=D:/tmp-claude TMP=D:/tmp-claude`.
Restart the harness (`preview_start "harness"`) after a change adds a new file. **Never `git stash`.**
When agents share this worktree, each stages **by explicit path only**.

## The rule this session paid for

**A fix is measured against every caller, not the one that asked for it.** Task 11 fixed the solver
for the oval clearance's side drag, and its review found that the fix broke a shrub detail's corner
drag in 12 of 8,550 moves. The fix round that closed that took held-side violations over 38,456 moves
to zero, where there had been 2,194 before the task began. The first measurement that said "fixed"
was true for the frame it measured and for no other.
