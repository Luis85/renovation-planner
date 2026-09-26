# AD18 walk automation round — plan (session twenty, 2026-09-26)

**Authority: rulings AD18-R26 to AD18-R29** in `contracts/DECISIONS.md`, taken on the clause audit in
[`MANUAL-PASS-audit.md`](MANUAL-PASS-audit.md). That audit's per-case tables are in
`.superpowers/sdd/audit/<case>.md` (gitignored, in this worktree): **every task's clause list comes from
there, and each task re-reads its clauses there before writing a test.** If a task would contradict an
earlier ruling (AD18-R1…R29, AD14-R1, AD12-R1, AD11, AD08-R1, C01–C12, r1) or would need a stored field,
STOP and report NEEDS_CONTEXT rather than choosing.

**The pasted brief's premise that no e2e case opens the Asset Designer is FALSE**, and so is its first
task (build the designer slice of the e2e harness). W23-A and W24-A built it: `tests/e2e/designer.ts`
(`createDesignerPage`: `createAsset`, `createToilet`, presets, `selectPart`, `readSidecar`, `notices`,
`canvasPoint`), `designerCanvas.ts`, `designerParity.ts`, `designerFollowups.ts`, `compose.ts`,
`clearance.ts`, `recovery.ts`, `library.ts`, and 144 cases. Every task below builds on those.

**No two tasks own the same file.** Implementers may run in parallel only on disjoint files, and then each
stages **by explicit path only**. **Only one task runs `npm run test:e2e` at a time** (the integrator
sequences them): one Obsidian at a time on a 7.8 GB machine.

## Global constraints (every task)

Everything in [`AD18-followup-round-2-plan.md`](AD18-followup-round-2-plan.md)'s *Global constraints*
binds here too, and is not repeated. Read that section first. In addition:

- **Your clauses are listed in the audit tables, and they are claims, not facts.** Re-read the case row
  and the clause's evidence cell before writing a test for it. If the build does not do what the clause
  says, you have found a CONTRARY clause: do not change `src/`. Pin what the build does, say so in the
  report, and the case row is rewritten under AD18-R27.
- **The mutation gate is required for every clause you close** (`.claude/skills/auditing-manual-test-cases/SKILL.md`):
  break exactly that clause in `src/` or `styles/`, see your test go red ON AN ASSERTION OF THAT CLAUSE
  (a prerequisite red does not count), see no neighbour go red on that clause, restore, and record the
  mutation in your report as `file · change · test · red/green · failing assertion`. A test that cannot
  fail discharges nothing. Before each mutation `git status --short src styles` must show only your own
  intended edits (normally nothing); restore with `git checkout -- <the one file>`. Never `git stash`.
- **E2E** (`tests/e2e/`): `export TEMP=D:/tmp-claude TMP=D:/tmp-claude && npm run test:e2e -- tests/e2e/<file>.e2e.ts`
  builds and runs one file (about two minutes; `-t "<name>"` runs one case). One file at a time. After
  every run, check no Obsidian or chromedriver process is left: `tasklist | grep -i -E "obsidian|chromedriver"`.
  Never leave a background shell or an `until …; sleep` loop running.
- **E2E runs on Windows here and on Linux in CI, and they differ.** Linux's default font is wider, and
  its timing differs (Obsidian saved its layout within 3 s on Linux and not on Windows). Never pin an
  exact pixel width, a font-dependent wrap, or a timing measured on one platform; pin the property with
  a stated tolerance, or pin a relation between two measurements.
- **The canvas has a 40 px edge-scroll band.** Keep every pointer path clear of it, or read drags in
  world coordinates. A pause with the pointer in the band pans the camera. Obsidian's default window is
  1024 × 800 and gives the designer a leaf of about 680 px and a canvas of about 340 px.
- **A held drag is dropped when the window loses focus** (W24-A finding 6). Keep held gestures short and
  do not run anything else that takes focus meanwhile.
- **Fallow reads `tests/e2e/`**: an exported helper nothing imports fails `unused-exports`, and a block
  cloned between two e2e files fails `dupes`. Put a shared behaviour in the helper file you own, not in
  two test files. Run `npx fallow dead-code` and `npx fallow dupes` before reporting (both are fast and
  need no coverage file) and paste their `Failed:` lines.
- **Existing e2e helper files are owned as listed per task**; `tests/e2e/designer.ts`, `helpers.ts`,
  `session.ts`, `fixture.ts`, `sessionLifecycle.ts`, `diagnostics.ts`, `accessibility.ts`, `compose.ts`
  and `vitest.config.mts` are owned by NOBODY this round — need an edit there, report NEEDS_CONTEXT naming
  the edit.
- Your report lists, per clause: the step, the clause, the bucket it had, the test that now discharges
  it (file and name), and the mutation. A clause you conclude cannot be pinned honestly stays open, and
  the report says why, with what you measured. That is a valid outcome; a test that cannot fail is not.
- Do not touch `docs/`, `CLAUDE.md` or `.superpowers/sdd/audit/`.

## Task 1: Shard the E2E desktop legs (AD18-R29)

**Owns:** `.github/workflows/e2e.yml`, `tests/gates/e2e-wiring.test.ts`. Model: Sonnet.

The desktop legs run 10–12 min under a `timeout-minutes: 20`, and this round adds up to about 36 cases.
Split each DESKTOP leg (1.13.7 and latest) into two shards with vitest's `--shard=<i>/<n>` passed after
`--` to `npm run test:e2e` (`scripts/e2e.mjs` forwards `process.argv.slice(2)` to vitest). Mobile-emulation
stays one job (it ran 1.5 min). Keep the herbstluftwm floating rule and its comment exactly. The
evidence artifact name must stay unique per job (add the shard), and the job name must say which shard.
`tests/gates/e2e-wiring.test.ts` pins the matrix: update it so it asserts the new shape (every desktop
version has every shard; mobile-emulation still present; every leg still runs the script) and watch each
new assertion fail against the old workflow first. Verify `vitest run --shard` works with the e2e config
(`pool: 'forks'`, `fileParallelism: false`) by running `npx vitest list --config tests/e2e/vitest.config.mts --shard=1/2`
and `--shard=2/2` and checking the two lists partition the files. Report the partition.

## Task 2: Recover — the host clauses (B)

**Owns:** new `tests/e2e/assetDesignerRecoveryWalk*.e2e.ts` files, and `tests/e2e/recovery.ts`. Model: Opus.

Clauses: the B rows of `.superpowers/sdd/audit/recover.md` — steps 2 (same canvas and selection after
a refused write), 6 (the early notice clears on its own), 8 (the stale notice arrives unprompted
within about a second), 21 (the second gesture persists and is drawn on reopen; Redo dimmed on reopen;
nothing warned before the tab closed), 23 (no one-frame flash of the failure panel), 25 (the unload
logs no error), 26 (same shape and Inspector on reopen), 29 (no new tab of ANY view type; no other
designer leaf touched), 30 (after the trash: no notice, no offer to remove, the sidecar's size
recorded), 37 (after a repair and a press: the notice, Try again and the header's refresh-needed
clear together, and the canvas shows the repaired file).

Read `tests/e2e/assetDesignerRecovery.e2e.ts` and `assetDesignerRecoveryMore.e2e.ts` first: extend
their fault setups rather than inventing new ones. Steps 8 and 23 are the hard ones: 8 was measured both
ways across machines (W24-A: the host reconciled within 5 s four of four on a quiet machine; W23-A saw
none), and 23 needs a frame sampler (a `requestAnimationFrame` loop in the page recording whether the
failure panel ever exists). Pin them only with a tolerance that holds on both platforms, or report them
as unpinnable with the measurements. "Nothing warned before the tab closed" (21) must close the tab
through a user gesture Obsidian handles, not `leaf.detach()`.

## Task 3: Design an Asset — the host clauses (B)

**Owns:** new `tests/e2e/assetDesignerWalk*.e2e.ts` files, `tests/e2e/designerCanvas.ts`,
`tests/e2e/designerParity.ts`, and `tests/e2e/vault/**` (a new fixture only if the orientation check
needs one). Model: Opus.

Clauses: the B rows of `design-an-asset-1-71b.md` and `design-an-asset-72-129.md`, except 73, 89 and 97
(Task 4, or out of reach): step 7 (the sheet drawn the right way up — sample the drawn raster against a
fixture's known asymmetry), 8 (the `.rpgeo` listed in Obsidian's file explorer), 24 (calibration,
anchor, facing and height each survive a plugin disable/enable on an asset that HAS each of them set,
and BOTH open designers reopen — read the step's own text for what "reopen" means after W24-A's finding
that a disable detaches every leaf), 87 (the preset thumbnail outline's contrast against its background
in BOTH themes, read as computed styles — state the threshold and where it comes from), 96 (the
cleared-selection Ctrl+G variant), 118 (whether Obsidian's own binding also fires for Ctrl+Z in a
focused `<select>` and on the corner-radius slider), 121 (whether an Obsidian binding fires for an
exhausted Ctrl+Z). For 118 and 121, first find out which Obsidian command, if any, binds Ctrl+Z/Ctrl+Y
in a default vault (read `app.hotkeyManager`), and assert against that.

## Task 4: The input the driver does not express natively, and the layout-only clauses

**Owns:** new `tests/e2e/assetDesignerInput*.e2e.ts`, `tests/e2e/assetLibraryWalk*.e2e.ts` and
`tests/e2e/twoDesignersDrag*.e2e.ts` files, `tests/e2e/designerFollowups.ts`, `tests/e2e/library.ts`.
Model: Opus.

Clauses: Design 97 (the real ContextMenu key reaches the canvas — drive it with CDP
`Input.dispatchKeyEvent` through WebdriverIO's CDP access, and say which path you used), Design 73
(Obsidian's own hover tooltip shows the library door's name — hover, then read the host's tooltip
element), Two designers 1 (dragging a designer tab into a new split gives a second leaf on the same
asset — synthetic `DragEvent`s or CDP `Input.dispatchDragEvent`; the reviewer's confidence was moderate,
so an honest "not drivable, here is what happened" is a valid outcome), and the three D clauses whose
only instrument in the gate is a real renderer: Design 70 (every dimension number has a point where
`document.elementFromPoint` returns it, at the vanity's All dimensions state), Browse 11 (the library's
category rail appears at 35rem and widens 240→280 px at 45rem), Browse 26 (the sidebar overlays the
grid rather than pushing it — read the two boxes). Size leaves through `@electron/remote` as
`designerParity.ts`'s `setLeafWidth` does.

## Task 5: Design an Asset — the suite gaps (D)

**Owns:** new test files under `tests/presentation/designer/`, `tests/presentation/editor/` and
`tests/domain/`; no existing test file. Model: Opus.

Clauses: the D rows of both Design tables except 70 (Task 4): 27 (the tank sits against the wall — a
curved-back asset through wall-snap AND `backDepth` together), 32b (no selection change during a hold),
58 (the canvas matches the preset card — both come from the built shape), 72 (the library door's icon
before its words in DOM order), 81 (the scale bar's step matches the rulers' at the same zoom), 102a
(corners stay round through the whole drag, sampled mid-drag), 107 (a typed solve that is NOT a plain
stretch — find an input where the two land differently; the current one cannot fail), 120 (Escape
mid-gesture, then Ctrl+Z undoes normally), 121 (Ctrl+Z is claimed with nothing left to undo).

## Task 6: Recover and Two designers — the suite gaps (D)

**Owns:** new test files under `tests/presentation/designer/` and `tests/application/`; no existing test
file. Model: Sonnet.

Clauses: `recover.md`'s D rows — 3 (after a refused write: no notice paragraph, no panel, every tool
live), 5 (the bowl springs back), 7 (after a failed read-back: the same bowl position, the same
selection, the Inspector still showing the asset's fields), 30 (no diagnostic names the orphaned
sidecar — read the diagnostics report's builder) — and `two-designers.md`'s D row, 8 (no dialog on
the conflict path).

## Task 7: Calibrate — the suite gaps (D)

**Owns:** new test files under `tests/presentation/designer/` and `tests/application/commands/asset/`;
no existing test file. Model: Opus.

Clauses: `calibrate.md`'s D rows — 9 (calibration clears the ANCHOR's and a DETAIL's pending lines; the
review's mutations proved nothing holds either today), 21f (a press on a hidden clearance's edge starts
a marquee, and the selection redraws unchanged after re-showing), 21l (the clearance's geometry is
unaffected by an unrelated write), 32 (the review button is reachable by Tab and its computed accessible
name is exactly "Mark clearance as reviewed" — the review proved `aria-label="Dismiss"` passes today's
tests).

## Task 8: Take into a plan and Browse — the suite gaps (D), and Browse 32's pin

**Owns:** new test files under `tests/presentation/library/`, `tests/presentation/editor/`,
`tests/presentation/views/`, `tests/plugin/` and `tests/application/`; no existing test file. Model: Sonnet.

Clauses: `take.md`'s D rows — 9 (the duplicate's row joins the shelves), 14 (the hand-off overrides
whatever asset the Add menu last used), 15 (choosing between two open plans opens that one, with the
armed banner and the same asset), 16 (Escape arms nothing in either open editor), 21 (the designer opens
with the footprint drawn), 22 (the item sits under the plans group — read `useCanvasMenuActions.ts`) —
and Browse 32 under AD18-R27: pin where the category icon actually sits relative to the mark (the audit
says centred), so the case row can be rewritten to cite it.

## Task 9: Rewrite the Design an Asset case, and define the new tier (AD18-R27, R28)

**Owns:** `docs/tests/cases/Design an Asset.md`, `docs/tests/suites/Smoke Test the Editor.md` (its
triage-column definition only). Model: Sonnet. **Runs after Tasks 2–8 are complete.**

Under AD18-R28 every step whose clauses are ALL discharged is retagged: `suite` when every clause is
discharged by a vitest, and a new tier **`e2e`** when any clause needs the real host; define `e2e` beside
the existing five tier values, in the same voice. The step's row stays, its text is unchanged except
where AD18-R27 applies, and its *Automated* table rows name the tests. Under AD18-R27 every CONTRARY clause
is rewritten to what the build does, citing the pinning test. Apply the audit tables' OVERCLAIM and
UNRECORDED corrections and the stale *Deliberately NOT checked* passage (placement on a plan exists).
Inputs: the two Design audit tables, `.superpowers/sdd/audit/review.md`, and Tasks 2–5's reports
(`.superpowers/sdd/task-N-report.md`), whose clause lists name the new tests. **Every retag cites a test
you have opened and read.**

## Task 10: Rewrite the other six cases (AD18-R27, R28)

**Owns:** `docs/tests/cases/Take an asset from the library into a plan.md`, `Compose an asset from parts.md`,
`Calibrate a sheet and reserve space.md`, `Recover an asset design rather than lose it.md`,
`Two designers on one asset.md`, `Browse the asset library.md`. Model: Sonnet. **Runs after Tasks 2–8,
may run beside Task 9** (disjoint files; the tier's definition is Task 9's, so use the tier name `e2e`
exactly). Same rules as Task 9, from those cases' audit tables, including Take's stale step-10 bullet and
Browse's stale `none` rows at 1, 3 and 22.

## Task 11: Rewrite MANUAL-PASS.md and re-derive the count (AD18-R28)

**Owns:** `docs/tasks/asset-designer-expansion/reports/MANUAL-PASS.md`. Model: Sonnet. **Runs after
Tasks 9 and 10.** The index points at the audit and states what a human still walks: re-run its own
counting command verbatim (retagged rows fall out of it by construction) and write the number it prints,
per case. Say what was automated this round, by case, naming the new test files, and what stays human
and why (the C residue). **The reviewer of Tasks 9–11 checks every retag against the test BODY.**

## Task 12: Rewrite `reports/RESUME.md` (integrator)

## Task 13: Delivery note in `DECISIONS.md` and `state.json` evidence (integrator)
