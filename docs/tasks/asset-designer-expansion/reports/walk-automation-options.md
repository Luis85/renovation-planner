# Walk automation options: what else could leave the 22-step manual walk

**Session twenty-two, 2026-09-29. Tree `a01997695`** (CI 36609678141 and E2E 36609678290, both green,
read by run id; `git merge-base HEAD origin/main` = `61fbf1588` = origin/main's tip, so main has not
moved). **This session builds nothing.** It researched six levers with read-only agents, each writing a
gitignored file under `.superpowers/sdd/brainstorm/` (`A-visual-baselines.md`, `B-model-judge.md`,
`C-screen-reader.md`, `D-extra-legs.md`, `E-judgement-steps.md`, `F-artifact-gallery.md`). This file
synthesises them. The user's rulings are recorded as AD18-R35 onward in
[`DECISIONS.md`](../contracts/DECISIONS.md).

**The walk today: 22 human steps, 9 / 1 / 0 / 2 / 4 / 1 / 5**, re-derived this session with
[`MANUAL-PASS.md`](MANUAL-PASS.md)'s counting command, not copied. The rows it matched are exactly the
22 in [`RESUME.md`](RESUME.md)'s table.

**Method.** A step leaves the walk only when every clause is DISCHARGED, by a test or by a ruling
([`auditing-manual-test-cases`](../../../../.claude/skills/auditing-manual-test-cases/SKILL.md)). A proxy
that settles a named part is a GUARD, and its step keeps its tier (AD18-R30). "Removed" below means
removed honestly: every clause has an answer that does not rely on a person re-walking it.

## Ranking

Ranked by (steps honestly removed) × (confidence) ÷ (cost). Costs are estimates unless marked measured.

| Rank | Lever | Steps it could remove | Confidence | Cost | Needs from the user |
|---|---|---|---|---|---|
| 1 | **E + D-scope: retire by ruling** | up to 5: Design 89, Design 121, Take 23, Browse 17, Recover 20 | high for 89/121/17, medium-high for 23, medium for 20 | none to build; one docs task (retag rows, recount) | a ruling per step (Q1) |
| 2 | **D: Windows host-timing job** for Recover 6 and 8 | 2 | medium | first Windows e2e job, 2–3 tasks, flake risk | reverse AD18-R33 for 6/8; read "about a second" (Q4) |
| 3 | **F: CI-image gallery** | 0 (16 of 22 become judgeable from a CI image) | high that it saves setup | ~4 tasks, ~1 min CI per leg, ~8 MB per leg | may a Runs row cite a CI image (Q2) |
| 4 | **C: fix the review notice's live-region pattern** (Calibrate 32) | 0 — but fixes a **probable real defect** | high on the event evidence, inference on speech | 1–2 tasks, a `src/` change | take the fix (Q3) |
| 5 | **A: visual baselines** on the pinned Linux leg | 0 as guards; 1 (Design 103) only under a PR-approval ruling | medium | ~5 tasks, re-baseline in most rounds | may a PR-approved image discharge (Q2) |
| 6 | D: a macOS job for Design 89 | 1 (same step rank 1 retires for free) | medium | 2 tasks, a job no other step uses | amend AD18-R31 |
| 7 | C: a real screen reader (NVDA via guidepup) | 0 — still one reader, one OS: a guard | low | two new devDependencies, first Windows e2e job, high flake | authorize `@guidepup/guidepup` and `@guidepup/setup` |
| 8 | B: a model as judge | 0 — cannot discharge; triage at most | — | small in money, large in trust | not recommended |

**Best case if every recommended option is taken: 22 → 15** (ranks 1 and 2: 89, 121, 23, 17, 20, then
Recover 6 and 8). **Zero-build case: 22 → 17 or 18** (rank 1 alone).

## Lever by lever

### 1. Retire by ruling (E, plus D's scope reading of Design 89)

These steps have no instrument, and no instrument would help. What they ask is either already decided
elsewhere or a fact that only changes through a deliberate code change. A one-time ruling answers them.
Each ruling names its **re-open trigger**, so the next session knows when it has expired.

| Step | Why a ruling settles it | Re-open trigger | Evidence |
|---|---|---|---|
| Design 89 | The row itself says its walk "is a Windows run and never takes" the B clause "a real Mac's Obsidian takes it". The clause the walk does take (Windows menu, one separator, shortcuts) is asserted, and so is the ⌘ label. So the walk re-observes a closed clause and skips the open one. | a macOS leg, or a macOS walker | row 89 and its Automated rows, `Design an Asset.md`; `designerContextMenuMac.test.ts` *labels Group, Ungroup and Duplicate with ⌘…*; `assetDesignerParityMenu.e2e.ts` *opens one menu from the canvas…* |
| Design 121 | Clauses 1 and 2 are asserted. Clause 3 is "the two keys are inconsistent with each other **by design**, and this is where that is checked by eye" — the row's own text. The design is AD18-R23 Task 10. | a change to `editorHistoryShortcut` or `designerShortcut`'s claiming rule | `designerHistoryKeysWalk.test.ts` *is still claimed and goes no further…*; `assetDesignerWalkKeys.e2e.ts` *runs no host command for a Ctrl+Z…* |
| Take 23 | Both labels are fixed locale strings ("Edit shape", "Open in designer"). Whether two names for one destination is acceptable is a naming decision, not an observation. It has never been walked. | either string changes | `src/presentation/i18n/locales/en-assetLibrary.ts` (`view.asset-library.open-designer`); `assetHandoffMore.e2e.ts` |
| Browse 17 | The row already calls it "a judgement rather than a defect": §3.5 asked for an editable notes field and a single-line `<input>` shipped, truncating a 63-character note at the 280 px rail. The decision is whether that is accepted. | the control type changes, or the rail width | row 17 and its acceptance criterion, `Browse the asset library.md` |
| Recover 20 | Every fact it judges is asserted: after the half-undo the screen shows **Save error** in the header and "Not calibrated" in the Reference tab, and nothing connects them (`unrecoveredWrite` is drawn on no designer surface, which RESUME already records). The honest answer to "would a user know" is **no**, and the ruling records that answer as a known gap against U05's recovery-instructions clause, rather than a pass. | any new cue near either field, or `unrecoveredWrite` drawn in the designer | `assetDesignerRecoveryMore.e2e.ts` *restores the sheet but not its scale when the undo cannot write the sidecar, and names neither*; RESUME "Recorded, not fixed" |

**Not candidates.** Calibrate 29: AD18-R33 re-asked it for staleness, and the block keeps changing.
Two designers 10: its premise is false today (see Findings). Design 56, Recover 34 and Browse 11: making
their guards discharge would reverse AD18-R30 with no new evidence.

### 2. Host timing for Recover 6 and 8 (D)

- **Measured (Linux CI):** 105 of 105 `hostMs` readings across 17 E2E runs of this branch were
  unprompted, at 0–4 ms (`D-scratch/timing.tsv`; desktop shard 1 of both versions; the mobile leg skips
  these cases).
- **Why that is only a named part:** D read the 1.13.7 bundle. Obsidian watches files recursively on
  win32 and darwin, and per folder on Linux. So Linux CI pins a different watcher path from the Windows
  walk. W23-A's one 15 s miss was on a Windows dev box under load, with no established cause.
- **What would cover the host half:** a job on `windows-latest` (and Linux), dispatched or nightly, inside
  the existing `e2e.yml` so it can be dispatched against the PR branch. Blur the window before each write,
  as a walker saving from a text editor does. Assert every write arrives unprompted, with host plus plugin
  time ≤ 2 s for step 6 and ≤ 1 s for step 8. D found percentiles pointless on data this uniform.
- **What it still is:** a host fact no `src/` mutation can redden. Removing 6 and 8 needs AD18-R33
  reversed for them. `tests/gates/e2e-wiring.test.ts` reads only `jobs.e2e`, so it must be extended.
- **Cost:** no new dependency; the repo is public, so runners are free. It would be the first Windows
  e2e job: Obsidian's Windows download, no xvfb, window focus owned by the job.

### 3. CI-image gallery (F)

- **The idea:** the guards that already stage each step's state also save a named picture in both themes
  (`walk-<case>-<step>-<theme>.png`). A ~60-line stdlib script turns a `gh run download` into one local
  `walk.html`. `$GITHUB_STEP_SUMMARY` cannot show artifact images (reported, not tested).
- **Reach:** 16 of 22 steps become judgeable from a picture. **Six still need a live vault:** Design 89
  and 121, Calibrate 32, Recover 6 and 8, and Two designers 10.
- **Already there by accident:** the teardown `screenshot.png` is the right frame, in one theme (light,
  Linux, DPR 1), for Design 56, 70 and 103 (default width), Calibrate 29, Recover 20 and 34, and Browse
  1, 3 and 33. It is the wrong frame for Design 7 (after 20 zoom-ins, with the "No footprint yet" card
  over the sheet) and Browse 11 (only the last width). **No case stages Browse 17's long note.**
- **Best single case, Browse 3:** since `0a0f8b7e1`, a walker can no longer reach *not yet read* by hand.
  The guard's held read is the only practical view of that mark.
- **What it removes:** setup, estimated 25–45 minutes per walk. **No step leaves the count.** Judging
  time is unchanged.
- **What it needs:** a ruling that a Runs row may record a judgement made from a CI image, citing run id
  and head sha. No new tier or column is needed: Runs tables are Date | Build | Outcome, and Browse already
  has a CI-built row. Sub-question: the image is Linux, DPR 1, default themes. The cases prescribe a live
  vault, which on this machine is Windows at DPR 2. Thin lines and small text (Design 7, 57, 70, Browse 3)
  read differently, and a row judged from CI says so.

### 4. The review notice's live-region pattern (C) — a probable real defect

- **Source:** in `src/presentation/designer/inspector/DesignerClearanceReview.vue`, `v-if` sits on the
  `<section>` and the `role="status"` `<p>` is inside it, so the live region is inserted together with its
  text. Verified this session.
- **Probe (Windows 11, Obsidian 1.13.7 / Electron 43.3.0, two identical runs, no dependency: a WinEvent
  listener beside a throwaway copy of the step 32 case):** when the real notice appears, Chromium emits
  **no** `EVENT_OBJECT_LIVEREGIONCHANGED`, **no** `EVENT_SYSTEM_ALERT` and **no** event on any node inside
  the region. It emits only a SHOW on the non-live section and a TEXT_INSERTED on the non-live tabpanel.
  Synthetic controls in the same run separate the cause: an empty `role=status` filled later fired
  `0x8019` on the status node; one inserted with its text fired nothing a live-region consumer reads.
- **Inference, not heard:** NVDA's live-region hook drops both events the notice does produce, so NVDA
  most likely says nothing. Chromium's macOS backend does post a live-region-created notification, so the
  platforms differ on exactly this.
- **The fix, named and not made:** render the `role="status"` element always, and put `v-if` on its text
  and the button. Then `assetDesignerAxTree.e2e.ts` can also assert "an empty polite status exists before
  the resize", which is red on today's code, so its mutation comes free.
- **What it does to the count:** nothing. Step 32's "a screen reader announces it" stays a person's, now
  with a pattern that Windows actually reports. The existing guard's name (*hands a screen reader a polite
  status…*) is true of the tree and misleading about what is sent.

### 5. Visual baselines (A)

- **Measured (Linux CI):** the 20 staged clips the pixel guards already write were byte-identical across
  two commits' runs, separate runner VMs and both legs. Full-window screenshots were not: 9 of 166 differ
  by more than 1000 px, and the random vault name changes every one.
- **No new dependency or LFS:** decode with `@napi-rs/canvas` (already a devDependency) or in the
  renderer, as `pixels.ts` does. The repo already tracks 1002 PNGs (33 MB) without LFS. Update path: a
  mismatch uploads the candidate through the existing evidence step, a person commits it, and GitHub's PR
  image diff is the review. A Windows developer cannot produce a Linux baseline.
- **What it proves:** the pixels have not changed since a person approved them. That is a stronger
  tripwire than a floor and no statement about readability. It adds real coverage for Design 57 and
  Browse 3 (a drawing that changes but stays distinct), Design 70, 109, 103 and Browse 1 (layout drift),
  and Browse 33 (how much fainter).
- **Discharge only under a ruling:** "a person approved this CI image in the PR that changed it" could
  move a "reads as" judgement from the walk to PR review. A recommends that only for Design 103, a one-off
  comparison against a static board. It rejects it for Design 104, where the reviewer already knows what
  every icon means.
- **Risks:**
  - fonts come from the runner image, so an `ubuntu-latest` bump could red every text-bearing baseline at
    once (pinning `runs-on` needs authorization);
  - in-place clips (needed for 70, 109, 103, Browse 1) have unmeasured determinism;
  - re-baselining can become a rubber stamp.

### 6–8. Not recommended

- **A macOS job for Design 89 (D).** It would settle the Mac clause as a host pin, running only the
  step-89 case with the expected list chosen by `process.platform`. But rank 1 retires the step at no cost.
  Running the whole suite on macOS is not viable: 9 of 44 e2e files send Ctrl chords or pin Ctrl-bound
  hotkeys.
- **A real screen reader (C).** Orca is unavailable: guidepup has no Orca driver, and `@guidepup/setup`'s
  Linux path needs Ubuntu 26 or later. NVDA needs two devDependencies and the first Windows e2e job, which
  must own the foreground. It would still be one reader on one OS, so a guard.
- **A model as judge (B).** No `seed` parameter, and temperature 0 is not bit-reproducible, so it cannot
  pass the mutation gate. For Design 104, a model naming icons from training data is not evidence that a
  first-time user recognises them. For Design 103, the board is a concept image that the package's own QA
  plan says "never count[s] as execution evidence". The step uses it as the target a walker compares
  against, which is allowed, but no machine verdict against it would be a discharge. Most usable form: a
  local, non-CI triage script over downloaded artifacts, with plain `fetch` and no SDK. Not worth a ruling
  now.

## Findings this research made (premises found false)

1. **Two designers steps 9 and 10 ask about a badge the build does not draw.** Step 8 was rewritten
   CONTRARY under AD18-R27: leaf B reads plain **Saved**, with no badge. Step 9 (`suite`) still opens
   "With the **Save error** still showing in leaf B". Step 10 asks whether **Save error** read as being
   about the gesture. The CI teardown agrees with step 8. Verified at source this session. **Step 10 cannot
   be walked as worded.** Rewriting 9 and 10 to the build falls under AD18-R27's standing rule.
2. **The `latest` E2E legs run Obsidian 1.13.7 today.** All 170 `environment.json` files of run
   36609678290's two `latest` shards report `appVersion` 1.13.7 (verified). The matrix exercises no
   version drift at present.
3. **Calibrate 32's pattern emits nothing a live-region consumer reads on Windows** (see lever 4).
   "Least reliably" (audit 2) understated it.
4. **The pixel guards never set a theme.** A local Windows run rendered dark and CI rendered light (A).
   CI's `page.html` files are light in 341 of 346 cases, and the five dark ones switch on purpose (F).
5. **`environment.json`'s `commit` is the PR's merge commit, not the head** (D, F).
6. **`tests/e2e/designer.ts`'s `reconcile` docblock** says `assetDesignerRecovery.e2e.ts` pins "never
   reconciles". That case pins neither outcome (D).
7. **Audit 2's "per-machine, never cross-machine"** is too strong for staged clips on Linux runners, which
   produced byte-identical bytes across VMs (A).
8. **Design 104's "Add rail tiles"** carry visible text labels (`designerAddRail.test.ts` *labels each
   tile with the shape's own short name…*, verified). "On sight" really bites on the Arrange icons alone.

## Rulings (2026-09-29) and the build outline

Ruled by the user in one batched round, recorded as **AD18-R35 to AD18-R38** in
[`DECISIONS.md`](../contracts/DECISIONS.md) and `execution/state.json`:

- **R35:** retire Design 89, Design 121, Take 23, Browse 17 and Recover 20 by ruling, each with the
  re-open trigger in the rank-1 table above. Recover 20's answer is recorded as **no**, a known gap
  against U05, not a pass.
- **R36:** build the gallery. A Runs row may cite a CI image by run id and head sha. No baselines.
- **R37:** fix Calibrate 32's live-region pattern. The step stays human.
- **R38:** AD18-R33 stands for Recover 6 and 8.

**Expected walk after the build: 22 → 17 (7 / 0 / 0 / 2 / 3 / 1 / 4).** Re-derive it with the counting
command; do not trust this line.

**Build outline, for a later session.** It is not a plan yet: `superpowers:writing-plans` turns it into
one. Each task is reviewed independently.

1. **Calibrate 32 pattern fix (R37), test first.**
   - Add to `assetDesignerAxTree.e2e.ts` an assertion that an empty polite `role="status"` exists in the
     Object tab before the resize. Watch it go red on today's code.
   - Then change `DesignerClearanceReview.vue`: the status element always renders, with no visible box
     while empty, and `v-if` moves to its text and the button.
   - Pass the mutation gate: restoring the old `v-if` must turn only the new assertion red.
   - Keep the jsdom name test (`designerClearanceReviewName.test.ts`) green. Re-run the Windows WinEvent
     probe once to confirm `0x8019` now fires (the method is in `C-screen-reader.md` §3; it needs no
     dependency).
   - **A read-only census, not a fix:** `role="status"` appears in 20+ `src/` components. List which ones
     insert the region together with its text, and record the list for the user. Fixing them is not
     authorized by R37.
2. **Gallery helper (R36).**
   - Add `walkShot` beside `captureBrowser` in `tests/e2e/diagnostics.ts`. It uses both themes via
     `legibility.ts`'s `inBothThemes`, and try/catches into `diagnostic-errors.json` so a capture never
     reddens a guard.
   - Add the call sites, after each guard's own assertions, at the places `F-artifact-gallery.md` §2
     names. That covers 16 steps, including Browse 11's filmstrip and Design 7 at the opening camera, and
     names Browse 3's clips by state.
   - Add one new staging: a long `notes:` fixture for Browse 17. Its step is retired now, so this is
     optional; drop it.
   - Drop the call sites for the other steps R35 retired too.
   - A Linux-only question to settle by running CI: Design 109's 1280 px frame may not fit the 1280×1024
     xvfb screen.
3. **`scripts/walk-gallery.mjs` (R36).**
   - node stdlib only. It globs `**/walk-*.png` in a `gh run download` directory, groups by case and step,
     pulls each case directory's evidence JSON and the `system-out` lines in `junit.xml`, and writes
     `walk.html` with relative image paths.
   - It dedupes legs by `environment.json`'s `appVersion`, since `latest` is 1.13.7 today.
   - Add a gate test in `tests/gates/` over a fixture directory, watched red.
   - Record the image's head sha from the run, not from `environment.json`'s `commit`, which is the merge
     commit.
4. **Case rewrites (R35, R36, R27).**
   - Retag the five retired rows to a tier the counting regex does not match. No gate constrains the tier
     vocabulary, and `ruled` citing AD18-R35 is the proposal. The build session confirms the name before
     using it.
   - Each retired row states its answer and its re-open trigger.
   - Rewrite Two designers 9 and 10 to the build (plain **Saved**, no badge) under AD18-R27.
   - Say in each case's Runs preamble that a row may cite a CI image (run id, head sha, Linux DPR 1,
     default themes).
5. **Index and hand-off.**
   - Re-derive the count in `MANUAL-PASS.md`.
   - Add R37's mutation row to `AD18-walk-automation-evidence.md`.
   - Rewrite `RESUME.md` wholesale. Carry these recorded findings: the `latest` legs run 1.13.7;
     `designer.ts`'s `reconcile` docblock overclaims; the pixel guards set no theme; `environment.json`'s
     commit is the merge commit; the `role="status"` census.
   - CI and E2E green, read by run id. PR #230 stays a draft.

## What no lever reaches

After every option: Design 7, 56, 57, 70, 103, 104 and 109, Calibrate 29 and 32, Recover 34, Two
designers 10, and Browse 1, 3, 11 and 33. Each is a "reads as" / "noticed" / "announced" judgement where
a person is the instrument. The gallery (Q2) makes all of them except Calibrate 32 and Two designers 10
judgeable from CI images.
