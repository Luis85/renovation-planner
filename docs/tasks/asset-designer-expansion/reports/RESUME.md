# RESUME — session thirteen's hand-off

**Rewritten 2026-09-22, replacing session twelve's packet wholesale**, for the reason every packet
before it gave: a hand-off that is appended to goes stale in a way a reader cannot detect.

Branch `renovation-planner-asset-designer-bc5539`, worktree
`D:\Projects\renovation-planner\.claude\worktrees\renovation-planner-asset-designer-bc5539`.
PR [#230](https://github.com/Luis85/renovation-planner/pull/230), still **DRAFT**. Asked directly
whether the beta was ready, the user said **"not ready, keep working"**, and nothing since has
changed that. Nobody marks it ready on their own initiative.

| | |
|---|---|
| Last CI-verified sha | **`2dbc7b39a`** — run [`35737160544`](https://github.com/Luis85/renovation-planner/actions/runs/35737160544), `verify` ×4 plus `audit`, **all success**, read by run id. GitGuardian reported `skipping`, which is not a pass and not a failure |
| HEAD | above that sha. A second run was started on `a901cb746` and **its result is not recorded here** — confirm it, or the run on whatever HEAD you find, by run id before trusting anything above `2dbc7b39a` |
| `origin/main` | `ed5c50b76`, and it IS the merge base, so nothing rebases. The local `main` ref is stale — fetch before reading it |

## What this session was, in one line

**The first session in six to write `src/`.** Every wave before it was docs and tests, so gates that
had been green *by construction* were live for the first time — the coverage floors, the stylesheet
build, `eslint .` and `analyze`. They passed. Say that plainly, because the previous five hand-offs
could not.

## What shipped

**The vanity preset** (AD18-R8) — the fifteenth in `ASSET_PRESETS`, in the `sanitary` group,
**800 × 450 mm** default with a range spanning the package scenario's 1,000 × 500. No `Include basin`
toggle: `PresetFieldKey` is a closed ten-key union with no boolean and no `height`, and a vanity
without a basin is a cabinet while `washbasin` already ships for that case. Wireframe only — the
thumbnail is derived by `presetThumbnail` from the built shape, so no artwork exists to review.

**Canvas rulers** (AD18-R9) — the approved 2026-09-15 spec's **increment 3, in full**, including the
selection's extent. Top and left millimetre rulers following the camera, as a **DOM overlay** in
`EditorSurface`'s overlay slot on `designerGrid`'s step function.

**Four more gaps closed** — a category scan that nothing under `src/presentation/designer/` registers
a DOM listener; a test pinning that the designer's device slot really is separate from the Plan
Editor's; a dead CSS rule deleted and a third `held` clone retired; and the designer's `Saved` label
stopped claiming a stale canvas is current.

## THE STANDING RULE, UNCHANGED — and this session grew what it covers

**Every vault check is deferred to ONE terminal manual pass, by the user's decision.**
[`MANUAL-PASS.md`](./MANUAL-PASS.md) is the index and was **re-derived against this tree** with the
command it prints, run verbatim: **90 human steps across six cases**, up from 84.

**Read this before walking, because it is the part that will otherwise waste your time.**

- **Six steps ADDED** to [[Design an Asset]], in a section of its own — four for the rulers, two for
  the vanity. **Neither has ever been seen in Obsidian.** The rulers were drawn in the browser
  harness, which applies layout but declares none of a themed vault's colours; the vanity was
  measured for geometry and **never looked at as a picture in any instrument**. These are first
  sightings, not regression checks.
- **Five steps REWRITTEN** in [[Recover an asset design rather than lose it]] — 9, 10, 11, 12a, 12b —
  **with none added, so that case's count did not move.** Those steps recorded a defect that has
  since been fixed, and **a walker following the old text would report a pass as a failure.** Step 9
  said in as many words that `Saved · refresh needed` *"cannot be produced by this surface at all"*.
  It can now. That step is a regression guard that fails if the bare word comes back.

**This session did NOT hand over a walk.** The next session is the terminal manual pass.

## Both headline features have been MEASURED and barely LOOKED AT

This is the sharpest thing to carry forward and it is not a defect in either card.

- The rulers were rendered and measured in a real browser — canvas share **68.8 % at 1280 and 50.0 %
  at 580, identical to the hundredth of a pixel with and without them**, because the overlay draws
  inside the canvas rather than displacing it. The browser earned its place twice: it found the left
  strip drawing `250` as `25(` (three digits in 18 px, fixed with `writing-mode`), and the card went
  back and **looked** at a reviewer's reasoned-but-unseen occlusion finding rather than arguing about
  it. But the harness is not a vault: it declares no `.notice` chrome at all and none of a themed
  vault's accent.
- The vanity preset has no capture and no vault sighting. Its own card says it was *"measured and
  never LOOKED at"*.

**`npm run harness-shot` is still unavailable** — there is no pinned Chromium on this machine and
`npx playwright install chromium` is forbidden here because it emptied `node_modules` once.

## The triage was the first deliverable, and most of it was not work — third session running

Fourteen rows read **at source against the tree**; **five were real work**. Wave 14 found three of
ten, wave 16 eight of eleven were rulings. **Plan the round for rulings rather than cards.**

**Four inherited premises were FALSE**, and this is the pattern worth carrying rather than the rows:

- **Rulers were said to be "on no list at all".** They are increment 3 of an approved spec that had
  already chosen their mechanism and already refused Konva. Finding that out changed the job before a
  line was written.
- **"No ruler anywhere and no precedent to copy."** `rulerGeometry.ts` exists. It is the calibration
  segment's screen-pixel marks and is **not** reusable — which is the honest form of the claim, not a
  contradiction of it.
- **`Show grid` "flipping the designer flips the Plan Editor".** False in both halves: the slots are
  `designer-view` and `editor-view` and each view mounts its own Pinia. The default-off is the
  spec's own §2.6. The source of the error was one parenthetical about layer visibility.
- **`reversibleAssetDesignWindows.test.ts` "claimed by NO matrix row".** Row **T08** already cites
  it. That is the T25 shape one session later: a hand-off claim nobody re-ran against the document it
  was about.

## The reviews caught the INTEGRATOR twice

Same lesson session twelve recorded, arriving twice more:

- A suspicion the integrator wrote into W17-C's review brief — that the "all ten" arithmetic could
  not be right — was **disproved by the reviewer in the card's favour**.
- The grep the integrator recommended for counting presets **over-counts by one**, because
  `presetGeometry.ts` holds `definePreset`'s own definition. W17-A found that with a better
  instrument rather than taking "fifteen" on trust.

**Corrections travel in every direction, including into your own instructions to a card.** Tell every
card to verify fix instructions at the code before applying them; all six did, and all six were right
to.

## Five cards found something their brief did not predict

The argument for the independent-reviewer step, six sessions running, and for briefing cards to
report rather than expand:

- **W17-C** — `designerRig`'s `onThemeChange` was `() => () => undefined`, **a source that never
  fires**, so no case built on that rig could flip a theme at all. The gap was reachability, not
  behaviour.
- **W17-B** — the browser found `25(`; and its review found the extent band read the *committed*
  shape while every other reading of "where the selection is" follows the preview, with the comment
  defending it arguing against the option it had taken.
- **W18-B** — settled a contradiction between two test files from `EditorSurface` and `tool-manager`
  rather than from either test, because two tests disagreeing cannot decide between themselves.
- **W18-C** — repairing an over-claiming comment, wrote a fresh false "only"; fixing that turned up
  **the same over-claim living in a second file its first commit was never pointed at**.
- **W17-A** — corrected the integrator's grep.

## `src/` findings — two FIXED this session, three still record-only

The user was re-asked once, since the scope had changed, and chose to fix 1 and 3.

1. **FIXED.** The designer's header read `Saved` beside its own stale strip, and
   `save-state.saved-refresh-needed` could not be produced there at all. One optional `stale` prop,
   with `AssetDesignerRoot` passing the same `staleAfterRefresh` that draws the notice, so the two
   cannot disagree. **Against C08 this was the sharpest open question in the package and it is
   closed.**
3. **FIXED.** `runtime.ts`'s `writesBlocked` comment contradicted `assetDesignStore.stale`. Narrowed,
   behaviour untouched — and the same over-claim was found duplicated in `designerRefresh.test.ts`.

Still record-only, unchanged:

2. **`unrecoveredWrite` is set by the designer and drawn nowhere the designer renders.** Note the
   inherited wording "drawn nowhere" is wrong: nine consumers exist, none under `designer/`. Steps
   **B19, B20**.
4. **`PlanAssetUsage.projectId` reaches no view**, so two plans both named `Kitchen` in different
   projects render identically. **Grep trap**: a bare `projectId` search over
   `src/presentation/library/` is NOT empty; those hits are `ReferencingGroup` from a different
   query, and only the `AssetPlanUsage`-importer grep settles it.
5. **NOT this package's** — `settings.units` binds a control, persists, and nothing reads it. Bears
   on **AD16's ticked** *"No unfinished or nonfunctional controls advertised"*.

**And one opened by this session's own fix**: whether a designer write should be **blocked** while
the canvas is stale. It is now three questions rather than one — `writesBlocked`, a retry action, and
the pause disclosure the Plan Editor's strip carries. `writesBlocked: () => false` is unchanged and
deliberate; the Plan Editor blocks, and C08's reconcile-before-retry points the same way.

## What is still OWED on AD18, so nobody reads the merged shas as completeness

- **Increment 2 of the 2026-09-15 spec — dimensions on canvas.** It has **neither a spec nor a plan
  document written**. Rulers (increment 3) were delivered *before* it, deliberately; AD18-R9 records
  that so nobody takes their presence as evidence that 2 landed.
- **AD18 items 3, 5 and 7** of its own gap list: the `Add` rail's remaining half, the toolbar, and
  the guided trace checklist.
- **A numbering trap now named in AD18 itself**: that document carries two schemes — gap sections
  1–8 and a sequencing table 1–7 — so *"item 6"* means two different things. **Cite by title.**

## Carried forward, verified — do not re-inherit blind

- **The 460 px toolbar's second row is still unexplained**, and `designer-toolbar.css` says so
  itself. Needs a real browser.
- **`80rem` IS 1280 px of LEAF**, not viewport — `@container rp-designer` on the Vue root with
  `container-type: inline-size`.
- **German `Vorlage` — WITHDRAWN.** The collision does not exist. Do not carry it again.

## Three stale-citation repairs landed, and the lesson under them

W18-B's change falsified three sentences in files it had no lease on; it found one, the review found
another, it found the third when asked. Its own lesson, recorded: **it ran the collateral grep for
the table label it changed and never for the header sentence it changed.** A changed sentence
deserves the same grep a changed identifier gets.

`LEASES.md`'s stale paragraph was **marked rather than rewritten**, because it records why a past
lease was drawn where it was and editing it would falsify that record.

## This machine

7.8 GB RAM, **SHARED** — another session was running a gate in a different worktree throughout this
one. Check WHAT is running, not how many:

```
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Select-Object ProcessId,CommandLine | Format-List"
```

- Prefix every node-spawning command: `export TEMP=D:/tmp-claude TMP=D:/tmp-claude`
- **Workers run narrow `npx vitest run <paths>` only.** `check` / `check:fast` / `test:coverage` /
  `analyze` are the integrator's, and this session ran the full gate **in CI on the PR** rather than
  locally — which worked, and is the workflow to keep.
- Watch CI **by run id**: `gh run view <id> --json status,headSha,conclusion,jobs`. Do not push
  repeatedly in quick succession; it cancels in-flight runs.
- The exit-code trap stands: read the log's own `Test Files` line, never the exit code alone.
- **A quoted heredoc broke on this session's prose too** — write the script to a file, or use
  `python` with index-based splicing for anything containing a typographic dash.
- **The docs use typographic dashes.** An exact-string edit against them fails silently in a shell;
  splice by index.
- Worktrees under `.worktrees/` carry `node_modules`, reusable with `git switch -c`. This session
  used `ad07`, `ad10`, `ad11`, `ad13b`, `ad13c`, `ad14`; `ad08r` and `adq` were untouched.
- **`SendMessage` to the card's ORIGINAL author is still right for a fix round. Seven sessions
  running.** All six cards this session verified their fix instructions at the code first, and one
  **reproduced the reviewer's prediction** — a green run with the mutation applied — before fixing
  it, then re-took the red against the FIXED tree.

## The rule this session paid for

**A brief is not evidence, including one written by the last session that finished.** Four of this
session's inherited premises were false, and the two that mattered most — that rulers were ungoverned
and that a preset fixture had been overlooked — would each have produced the wrong work. Both were
settled by reading the governing document at source rather than through any summary of it.

The corollary, for whoever writes the next brief: **§4 row 2 says "fixture" and every summary of it
says "vanity"**. Check the requirement at source, never through a summary — including through this
file.
