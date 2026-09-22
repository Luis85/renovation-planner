# RESUME — session fourteen's hand-off

**Rewritten 2026-09-22, replacing session thirteen's packet wholesale**, for the reason every packet
before it gave: a hand-off that is appended to goes stale in a way a reader cannot detect.

Branch `renovation-planner-asset-designer-bc5539`, worktree
`D:\Projects\renovation-planner\.claude\worktrees\renovation-planner-asset-designer-bc5539`.
PR [#230](https://github.com/Luis85/renovation-planner/pull/230), still **DRAFT**. Asked directly
whether the beta was ready, the user said **"not ready, keep working"**, and nothing since has
changed that. **Nobody marks it ready on their own initiative.**

| | |
|---|---|
| HEAD | **A hand-off cannot name its own sha** — every correction to this line moves HEAD past what it just said, and the last three attempts at it were stale when written. Confirm yourself: `gh run list --branch renovation-planner-asset-designer-bc5539 --limit 1 --json databaseId,headSha,status` then `gh run view <id> --json status,conclusion,jobs`. Tree clean, pushed |
| Last sha confirmed green **before** the final push | **`9d146abbc`** — run [`35774126753`](https://github.com/Luis85/renovation-planner/actions/runs/35774126753), `verify` ×4 plus `audit`, **all success**, read by run id. That sha carries waves 19 and 20 in full. **Waves 21 and 22 were pushed after it and their run must be read by id** — do not assume |
| Earlier green legs | `56d1dc918` (run `35758375566`) and `e6171b699` (run `35765414243`), both all-success. GitGuardian reports `skipping` on every run, which is neither a pass nor a failure |
| `origin/main` | `ed5c50b76`, and it **IS** the merge base, so nothing rebases. The local `main` ref is stale — fetch before reading it |

## What this session was, in one line

**The session that finished the approved measurement iteration** — increment 2 of three, the last
one owed — and then spent four more waves on defects that only a browser could see.

## What shipped

**Dimensions on canvas (AD18-R11)** — the approved 2026-09-15 spec's **increment 2, in full**.
Overall width × depth, the selected part's size, its four **signed** offsets to the footprint edges,
each a real `<button>` swapping to a real `<form>` with a focused `<input>`, every number read from
`preview ?? design.shape`, an `All dimensions` view row, and no numbers on an unscaled part — gated
per DESIGN **and** per PART, which the card worked out rather than transcribed. **That closes the
iteration**: increment 1 (snapping/guides/grid) and increment 3 (rulers, delivered out of order
under AD18-R9) were already in.

**The stale notice's `Try again` (AD18-R13)** — a retry and nothing else. `writesBlocked` stays
`false` and stays pinned; the write block and the pause disclosure were refused together, on the
merits.

**Collision avoidance for `All dimensions` (AD18-R14)** and **the retry's presentation (AD18-R15)** —
both found by drawing the merged code in a browser, both invisible to every gate here.

**The project on every plan usage row (W19-B)** — two plans both named `Kitchen` in different
projects no longer render as identical lines.

## THE STANDING RULE, UNCHANGED — and this session grew what it covers a lot

**Every vault check is deferred to ONE terminal manual pass, by the user's decision.**
[`MANUAL-PASS.md`](./MANUAL-PASS.md) is the index and was **re-derived against this tree** with the
command it prints: **109 human steps across six cases**, up from 90.

**Read this before walking.**

- **Thirteen new steps in [[Design an Asset]] for dimensions on canvas.** Nothing in it has been seen
  in Obsidian. **Two of the thirteen are regression guards rather than first sightings** — step 63
  (typing back the shown number writes nothing) and step 67 (every label vanishes under a draw tool,
  without which tracing is impossible). Both cover defects a review caught before merge.
- **Six new steps in [[Recover an asset design rather than lose it]] for the retry.** **That state
  cannot be reached by any instrument except a person in a vault** — `page.ts` passes its `stale`
  knob to the PLAN EDITOR branch only, so no fixture and no capture can draw it.
- **Three steps were REWRITTEN and one of them would have failed a passing build.** Steps 10, 12 and
  an out-of-scope bullet all said the designer has no `Try again`. Step 10 read *"There are none"*.
  Step 12's expectation is UNCHANGED and only its reason was false — that notice still heals
  unprompted, and pressing the button to clear it would itself be a defect.
- **Two steps are `judgement` steps over measured residuals**, each naming the number it judges.

**This session did NOT hand over a walk.** The next session is the terminal manual pass.

## The triage was the first deliverable and it produced ZERO cards — fourth session running

`RESUME` and the session brief both named AD18 gaps 3, 5 and 7 as outstanding. **All three were
already closed at the tree.** The toolbar gap had nominated its own instrument —
`grep -rn "HostIcon" src/presentation/designer/`, recorded as returning **0** — and it returns **3**.
`DesignerAddPanel.vue` and `DesignerTraceChecklist.vue` both exist and are mounted.

They are recorded as **corrections rather than decisions**, per AD15-R2's rule: recording a
correction as a decision credits a session with settling what was already settled. `AD18-concept-fidelity.md`
was behind the tree on all three and the hand-off inherited it; the amendment lines are added.

**Plan the round for rulings rather than cards.** Five rulings, five cards.

## The brief's single biggest named unknown was a FALSE PREMISE — fifth in two sessions

It said the overlay slot stops pointer events and that interactive DOM might force a mechanism
change. Measured: `.rp-plan-overlay` declares **no `pointer-events` at all** (its whole rule is
`display: contents`), and `EditorSurface`'s four `.stop` modifiers are **bubble-phase**, shielding
the canvas FROM the overlay rather than the overlay from the user. `RoomDimensionLabels` — the
precedent the spec names — is already this exact feature and is fully interactive.

**Check the requirement at source, never through a summary — including through this file.**

## THE REVIEWS CAUGHT THE INTEGRATOR FIVE TIMES

This is the sharpest thing to carry forward. Every one was a brief or an instruction, not code:

- **The pointer-events premise** above.
- **The C03 rounding fix.** The brief said comparing a typed number against the ROUNDED display value
  would not stop the quantizing write. It is what stops it — the field shows the rounded value, so
  that is the number a user leaves alone. The card produced the red before fixing.
- **`PlanEditorRoot` "wires `retry: hydrate`".** True and misleading: that `hydrate` is a LOCAL
  function calling the keep-previous refresh. The designer's `runtime.hydrate` blanks. W20-A blocked
  itself, wrote a probe and was right.
- **A lease that should have been granted and was not** (W19-B's harness fixtures), and **a lease
  granted against a guess that cost a card a wave** (W19-A never needed `AssetDesignerRoot.vue`).
- **A count repeated without checking.** A review enumerated twelve rules and called them ten; the
  integrator passed "ten" to a card; the grep said twelve. The card then found its own citation had
  falsified its own grep by quoting the declaration verbatim. **Three levels of correction on one
  number.**

**Tell every card to verify fix instructions at the code before applying them.** All five did.

## Instruments lied in BOTH directions, within an hour

- **A probe that reached nothing looked exactly like a clean result.** Setting an inline width on the
  library inspector returned "one line at every width from 328 down to 160" — because a flex track
  overrode it and the host never moved. Caught only by asserting `probeReached` rather than reading
  the numbers.
- **A sweep that over-reported.** A reachability count said zooming made collisions worse (2 → 13 →
  23) because `elementFromPoint` returns null outside the viewport, so CLIPPING was scored as
  COLLISION. Restricted to labels inside the canvas clip, the honest series is 0 → 1 → 0.
- **`node scripts/styles-assemble.mjs` runs nothing and exits 0**, having no CLI entry at all. Three
  of this session's briefs told cards to read its exit code. The gate was never in the command line —
  the build calls `assembleStyles` through a Vite plugin, and `tests/build/styles.test.ts` drives it.
  **Now in `CLAUDE.md`**, with the general shape: a command that exits 0 because it did nothing is
  indistinguishable from one that exits 0 because everything passed.

**Make every DOM probe throw when its selector misses, and judge only what is inside the clip.**

## `src/` findings — one FIXED, one record-only, one not this package's

The user was re-asked once, since the scope had changed again.

- **FIXED: `PlanAssetUsage.projectId`.** Narrower than inherited — it reached **no consumer at all**,
  and `PlanAssetUsage` is imported by no file. Closing it needed a project **NAME**, which the type
  did not carry. **Read the guarantee narrowly**: it separates two differently-named projects and
  nothing more, so two `Kitchen` plans in two projects both named `Flat renovation` still draw
  identically. `withPathsWhereAmbiguous` is the neighbour that escalates to a path.
- **Record-only: `unrecoveredWrite`.** The designer sets it and no designer surface draws it. **The
  inherited phrase "drawn nowhere" is FALSE** — nine consumer files, none under `designer/`. Steps
  **B19, B20**.
- **Not this package's: `settings.units`.** Nothing outside `src/plugin/settings/` reads it. **The
  per-plan units PBI is a PER-PLAN fact this global setting could not satisfy even if something read
  it**, so the honest fix is that PBI. Bears on AD16's ticked *"No unfinished or nonfunctional
  controls advertised"*.

## What is still OWED, so nobody reads the merged shas as completeness

- **The terminal manual pass.** 109 steps. That is the next session.
- **A residual at intermediate zooms**, recorded in AD18-R14: one label of the fourteen still on
  screen has no clickable point one wheel step in from fit. The charter is met at the camera the
  designer opens with; it is not unconditional.
- **No harness knob puts the designer into `stale`**, so the retry has no capture and no fixture.
  Adding one is a separate change nothing has ruled.
- **`dimensionFigures.ts` is 568 raw lines** and holds two rules in two coordinate spaces. A
  `labelSpread.ts` beside it is the seam if a third arrives. It passes `max-lines` because
  `skipComments`/`skipBlankLines` are on.
- **Three `judgement` steps** now sit in the pass over things only a person can settle.

## Carried forward, verified — do not re-inherit blind

- **`max-lines`'s `skipComments` does NOT skip an SFC's TEMPLATE comments.** A long `<!-- -->` block
  counts against the 400-line cap while the same prose in `<script>` does not. In `CLAUDE.md` now.
  `AssetDesignerRoot.vue` sits near 392 of 400 counted.
- **The wrap measurement in AD18 was superseded** — plan usage rows went 1 line to 2 at a 224 px rail
  once the project was added. Bounded: no overflow, no clipping, no horizontal scroll. The figure to
  distrust is the library at 760, where the row survives **by one pixel** against a fifteen-character
  fixture name.
- **German `Vorlage` — WITHDRAWN.** The collision does not exist. Do not carry it again.

## This machine

7.8 GB RAM, **SHARED**. Check WHAT is running, not how many:

```
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Select-Object ProcessId,CommandLine | Format-List"
```

- **Four orphaned `npm run harness` dev servers from the previous session were still running** at the
  start of this one, out of `.worktrees/ad07`. Kill leftovers before starting.
- Prefix every node-spawning command: `export TEMP=D:/tmp-claude TMP=D:/tmp-claude`
- **Workers run narrow `npx vitest run <paths>` only.** `check` / `check:fast` / `test:coverage` /
  `analyze` are the integrator's, and this session ran the full gate **in CI on the PR** throughout,
  which worked and is the workflow to keep.
- Watch CI **by run id**. Do not push repeatedly in quick succession; it cancels in-flight runs.
- **A quoted heredoc breaks on an apostrophe or a typographic dash.** It broke twice this session.
  Write the script to a file and splice by an anchor, and **anchor on content, never a line number**.
- Worktrees under `.worktrees/` carry `node_modules`, reusable with `git switch -c`. This session
  used `ad10`, `ad11`, `ad13b`, `ad13c`, `ad14`.
- **`SendMessage` to the card's ORIGINAL author is still right for a fix round. Eight sessions
  running.** Every card this session verified its fix instructions at the code first, and three found
  an instruction wrong.

## The rule this session paid for

**A card that names what it could not check is what makes the check cheap for whoever holds the
instrument.** W19-B had no browser and named the wrap at the right width; it was there. W19-A named
label collision on a small part as the likeliest real defect in its own work; it was there. W22-A
said no fixture could photograph its result and named the six things a re-capture must measure; all
six were measurable and all six passed.

**And the corollary, which cost three rounds on one card: a prediction is worth more than a claim.**
W21-A round 3 wrote down *"Unclickable: 0. Any non-zero is a failure of this round. Overlapping
pairs: 16. I'm wrong if it's outside 14–18"* before the capture. It measured 0 and 15. **Ask cards
for numbers they can be wrong about**, then go and measure them.
