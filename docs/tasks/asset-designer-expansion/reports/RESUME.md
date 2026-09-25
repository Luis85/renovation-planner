# RESUME — session nineteen's hand-off, for the manual-walk session

**Rewritten 2026-09-25, replacing session eighteen's packet wholesale.** An appended hand-off goes
stale in a way its reader cannot detect.

Branch `renovation-planner-asset-designer-bc5539`, worktree
`D:\Projects\renovation-planner\.claude\worktrees\renovation-planner-asset-designer-bc5539`.
PR [#230](https://github.com/Luis85/renovation-planner/pull/230) is still a **DRAFT**. **Nobody marks it
ready, tags it or publishes it without asking the user.**

| | |
|---|---|
| HEAD | **A hand-off cannot name its own sha.** Confirm it yourself: `gh run list --branch renovation-planner-asset-designer-bc5539 --limit 1 --json databaseId,headSha,status`, then `gh run view <id> --json status,conclusion,jobs`. The tree was clean and pushed when this was written |
| Last code sha confirmed green | Named in the delivery note at the end of AD18-R25 in [`DECISIONS.md`](../contracts/DECISIONS.md), with its run id. `git diff --name-only <that sha>..HEAD` should show only `docs/` files |
| `origin/main` | Last merged at `0d9cdb142`. `git merge-base HEAD origin/main` was still `126f79589` on 2026-09-25, with no new commits on main. Fetch and check again before assuming nothing has moved |

## The next session's job: the manual vault walk

Nothing agent-closable is open in this package. What is left is the deferred terminal pass, which a
person does in a real Obsidian vault (`npm run test-build` builds into this repository, which IS a
vault).

- **The index is [`MANUAL-PASS.md`](MANUAL-PASS.md): 241 human steps across seven cases**
  (111/19/23/27/33/8/20). It was 232. Do not trust the number: run the command the index prints.
  Rows outside the seven counted cases: the Plan Editor zone lock's two rows in `Open a floor and select
  a room`, and this round's chevron row 2a in `Find and resume a project`.
- **Start with grouping and undo** (AD18-R20), then this round's new steps: `Design an Asset` 122–129
  (round shapes that used to be refused, and the typed-size warning), `Calibrate a sheet and reserve
  space` 36b (a calibration re-shows a hidden pending clearance), and `Compose an asset from parts` 26a
  (the shared chevron, a `browser` row).
- **A walk decides nothing on its own.** A step that fails against correct code is a step to fix, and a
  step that passes a defect is worse. Every expectation added this session was checked against source by
  an independent reviewer, and the whole-round review found one step (128) that could not fail as written
  and had it rewritten; but a reviewer of text is not a vault.

## What this session shipped (rulings AD18-R24 and AD18-R25)

Session nineteen verified at source every item the follow-up round had recorded rather than fixed. **Two
of the hand-off's premises were false**: the designer/project-list CSS clone did not predate the branch
(84aad8e38 introduced it), and the tree's "validity island" was a core-geometry false refusal of valid
circles, not a tree quirk. The user took three rulings in one batched round (AD18-R24) and three more
after the reviews (AD18-R25), every one as recommended.

**Ruled:**
- **A typed size that lands more than 0.5 mm from the number typed raises a warning** naming the size that
  landed ("The typed size is out of reach for this shape. It now measures 270 × 270 mm."). Typed doors:
  the inspector's Width and Depth, a canvas size label, and Set dimensions' scaling path. Drags stay
  silent. Only the TYPED axis is checked (AD18-R25).
- **One shared disclosure chevron** (`styles/disclosure-chevron.css`) for the designer's folds and the
  project list's Completed group. Computed styles were byte-identical before and after, both surfaces,
  both themes.
- **Kept:** Ctrl+Z still does nothing while a `<select>` or a range slider has focus, in both editors.
- **Deleted:** `selectionDrag.ts`'s held-drag retry, which Task 1's fix left unreached (AD18-R25).
- **Accepted and recorded:** a residual cusp class in `arcArc` (below).

**Defects fixed without a ruling:**
- **`arcArc` refused valid circles** (`src/core/geometry/circularIntersections.ts`). Two adjacent arcs on
  nearly the same circle produced a phantom intersection just past tolerance, so Set dimensions 2987 ×
  2987 on the tree was refused ("That outline is not a shape this plugin can store."), and so were many
  other W = D sizes and rotations of a four-arc circle; a Plan Editor zone's curved edges reach the same
  validation. It now lands exactly (measured in Chromium before and after).
- **`designerComposition.ts` really is the one definition** of the designer's command bundle; the harness
  helper no longer copies it.
- **A clearance-drag test that could not fail** now discriminates by 72 mm.
- **The walk now covers a calibration re-showing a hidden pending clearance** (36b).

**Already fine, recorded so nobody reopens them:** the edge-scroll band growing a resize (by design,
`edgeScroll.ts`); `samePolygon`'s strict bulge comparison (deliberate; a JSON round trip is exact);
`restingLabels.test.ts` at 448 lines; the tree's 1.5 × 1.5 corner having no preset assertion of its own.

The plan is [`AD18-followup-round-2-plan.md`](AD18-followup-round-2-plan.md). The rulings are AD18-R24
and AD18-R25 in [`DECISIONS.md`](../contracts/DECISIONS.md).

## Known behaviour: the walk must NOT file these as new defects

- **A typed Width on a curved part can move its Depth with no warning** (the toilet: Width 50 lands
  exactly, Depth 700 → 535). The warning is about the typed value, which landed (AD18-R25).
- **A drag past a curved part's reach stops at the nearest size it can reach, silently** (the vanity
  basin stops at 270). Only typed sizes warn.
- **A typed value that misses by exactly 0.5 mm does not warn**, although the field then reads the next
  whole millimetre.
- **A hidden clearance re-shows after ANY read-back that changes its geometry**, including a pending one
  that `Set dimensions` or a calibration rescales, and after an undo of either.
- **A drag whose pointer rests in the canvas's ~40 px edge band pans the camera, and the resize keeps
  growing while it rests there.** Keep drag steps clear of the band.
- **Ctrl+Z does nothing while a `<select>` or the corner-radius slider has focus** (both editors, ruled).
- **Ctrl+Z and Ctrl+Y are claimed even with nothing to undo** (the Plan Editor's rule). Ctrl+G is left to
  Obsidian when there is nothing to group.
- **Ctrl+Z pressed on the open dimension form's buttons undoes the design and leaves the form open.**
- **An overall label may sit over the drawing on a narrow canvas** (280–360 px).
- Carried over and still true: an overall label may slide along its own line, even past its end
  (AD18-R14); the Parts-row icon buttons wrap at a 580 px leaf (AD18-R22); 0 mm offset labels rest; at
  the 760 and 580 leaves the overall depth label straddles the footprint's left edge; `Saved at HH:MM`
  (same day) carries no date; on Windows, arrow keys on a closed `<select>` fire one edit per step.

## Things only the walk can settle (no gate here can)

- **How the new warning notice reads and stacks in a real vault.** The browser harness declares no
  notice styling at all and never calls `activateNotices()`, so no notice shows there without a
  workaround (below).
- **Obsidian's own Ctrl+G (graph view) against the designer's Group key**, and whether any user-assigned
  hotkey on Ctrl+Z or Ctrl+Y goes dead while a designer leaf has focus.
- **Focus after a Group from a Parts row**, seen in Chromium but never in a vault.
- **How the lock toggle, the icon buttons and the save indicator read to a screen reader.**
- **How the chevrons, styled selects, icon rows, 24 px rows, canvas ring and inward labels look in a
  themed vault.** The harness stylesheet is a reduction of Obsidian's.

## Recorded, not fixed (for a later round)

- **The browser harness never calls `activateNotices()`**, so no notice of any kind appears there. This
  session measured notices by importing the page's own `notify.ts` URL (with its `?t=` stamp, or it is a
  second module instance) and calling `activateNotices()`, then reading the mock's `Notice.shown`.
- **No test pins the shared chevron rule**; a `stylesheetRules` pin is a cheap candidate.
- **`arcArc`'s residual cusp class** (AD18-R25): two arcs meeting at a zero-angle cusp on nearly identical
  circles. A few true crossings are accepted and a few valid cusps refused, both fewer than before; only a
  hand-edited sidecar reaches it.
- **The held-drag retry's ceiling** (AD18-R25): an outline nobody has found whose held result validation
  still refuses falls back to the plain scale, and its held side can move (undoable). On the pre-fix
  geometry that was 38 shrub moves.
- Test-helper prose in `designerComposition.ts`'s header (the fallow rationale and a "the one shape"
  sentence) is inaccurate; fix it the next time either helper is touched. The whole-round review's
  triage table lists the rest.

## CI, the browser, and this machine

Every task was pushed and read **by run id**, and every run this session was green on the first attempt.
**Only fallow's `Failed:` line and its `N above threshold` count are the gate.** A local `npx fallow`
without a coverage file cannot run its health half. The Windows leg on
`tests/gates/network-boundary.test.ts` (a 5000 ms timeout) remains a known flake: `gh run rerun <id> --failed`.

**The pinned Chromium (build 1234) is installed** under `D:\dev-cache\playwright`, and `scripts/chromium.mjs`
resolves it with no override. Measurement scripts are in `.superpowers/sdd/measure/` (gitignored); `pw.mjs`
opens the harness (port from `RP_PORT`, default 5173) and hands you the Pinia stores. **Instrument lessons,
all paid for again this session:**
- **Parallel implementers dirty the shared tree, and the harness serves the dirty tree.** One task's
  temporary `node:fs` instrumentation blanked the harness page. This session measured from a detached
  worktree at the committed sha instead (`.worktrees/measure`, which resolves `node_modules` from its
  parent), served on port 5174. Junctions do not work on this volume.
- **Read drags in WORLD coordinates, or keep the pointer's whole path clear of the 40 px edge band.** Two
  of this session's drags entered it and read as a 41 px "held side move" that was the camera panning.
- Measure the selections a reviewer will probe: every handle, several presets, both schemes, German.

7.8 GB RAM, **shared**. Prefix every node-spawning command with `export TEMP=D:/tmp-claude TMP=D:/tmp-claude`.
**Never `git stash`.** When agents share this worktree, each stages **by explicit path only**.

## The rule this session paid for

**A premise in a hand-off is a claim, not a fact.** Two of this session's inputs were false, and each was
caught only because it was checked at source before a task was written: the clone "predating the branch"
was one `git merge-base --is-ancestor` away from false, and the tree's "validity island" turned out to be a
false refusal every round shape in the product could hit. The brief that followed carried a third, a Shift
corner case that could never discriminate, which its implementer proved analytically.
