# RESUME — session twelve's hand-off

**Rewritten 2026-09-22, replacing session eleven's packet wholesale**, for the reason every packet
before it gave: a hand-off that is appended to goes stale in a way a reader cannot detect.

Branch `renovation-planner-asset-designer-bc5539`, worktree
`D:\Projects\renovation-planner\.claude\worktrees\renovation-planner-asset-designer-bc5539`.
PR [#230](https://github.com/Luis85/renovation-planner/pull/230), still **DRAFT** — the user has not
been asked to make it ready and nobody should on their own initiative. Asked directly whether the
beta was ready, the user said **"not ready, keep working"**.

| | |
|---|---|
| Last CI-verified sha | **`f07002d45`** — run [`35696919541`](https://github.com/Luis85/renovation-planner/actions/runs/35696919541), `verify` ×4 plus `audit`, **all success**, read by run id. GitGuardian reported `skipping` rather than passing, which is not a failure and is recorded as what it was |
| HEAD | **one documentation-only commit above `f07002d45`** — the one correcting this very line, which could not name its own sha. Confirm its own run before trusting it. Pushed, tree clean |
| `origin/main` | `ed5c50b76`. The **local `main` ref is stale** — fetch before reading it. Merge base with `origin/main` IS `origin/main`, so nothing needs rebasing |
| Suite at integration | **1074 test files, 11896 passed, 1 skipped, ZERO failures** (`check:fast`, exit 0, read from the log's own `Test Files` line rather than the exit code) |

## THE STANDING RULE, UNCHANGED

**Every vault check is deferred to ONE terminal manual pass, by the user's decision.** No wave asks
for a walk while agent-closable work remains. [`MANUAL-PASS.md`](./MANUAL-PASS.md) is the index and
was **re-derived against this tree**, not inherited: 84 human steps across six cases, per-case
figures unchanged, with the command that produces them printed beside them.

**This session did NOT hand over a walk, and that was the point of it.**

## What session twelve did

The user authorized, in these words: *"move all manual checks at the end, give me a prompt to drive
implementation subagent-driven to an end."* Four decisions were batched into one round and all four
were taken as recommended: dispatch all three agent-closable halves, land the rest as one ruling,
keep the `src/` findings record-only, and activate no carried-forward candidate.

### The triage was the deliverable that mattered most

Eleven rows were read **at source against the tree**. **Only three were agent-closable.** That is
now twice-confirmed behaviour for this package — wave 14 found three of ten in the same shape — so
**expect most of a triage set to be non-work, and plan the round for rulings rather than cards.**

### Ruling AD15-R2 — six decisions, and two rows that were never open

In [`contracts/DECISIONS.md`](../contracts/DECISIONS.md) and `state.json`, same edit. It says "six"
and "two" rather than "eight" deliberately: recording a correction as a decision credits a session
with settling what was already settled.

**T25 was the sharpest of the two.** Its row named two gaps as the reasons it was not `passed`.
Commit `ef1ba2dff` (2026-09-19) closed **both** — its message literally reads *"close T25's two
residual gaps"* — and the matrix was then edited **three times** (`896a5f6a9`, `8deda6182`,
`4bc2ba5b7`, all 2026-09-21) without regrading it. **A row is re-read by whoever is editing the rows
beside it, and nobody was editing that one.** One of three cards was about to be sent after a case
that already existed.

**T34 was never a triage row at all**: `MANUAL-PASS.md` already assigned it to the deferred pass. It
entered the set by mistake.

### Wave 16 — three cards, three independent reviews, three fix rounds

| | |
|---|---|
| Base | `1157ed28d` — the lease table is IN it |
| Candidates | `29f5d347f` (A) / `4bd5759be` (B) / `ea2a562b9` (C) |
| Fix rounds | `749839cce` / `3430853fa` / `68615d628` |
| Merged | `8093f55d6` / `64b73c1b6` / `ab1c52a02` |

Disjointness was verified across the **fix-round** shas as well as the candidates; the three-way
intersection was empty and **no card touched `src/`**.

- **W16-A / F12** — `shapeWithParts` at 25/250/1000 parts (92/917/3667 vertices, 32/332/1332 curved
  edges), asserted against a hand-written literal table sharing no code with the builder. The
  1000-part case was checked **first**, in case the domain refused a shape that large; it does not.
- **W16-B / F10** — two real saved projects over the real repositories. The watched red is the
  load-bearing part: walking only the first project failed the new case and **left the other seven
  green**, which measures the gap rather than arguing it.
- **W16-C / T32** — the palette flipped through the real `onThemeChange` seam, comparing the Konva
  **scene** rather than the input shape, with an anti-tautology guard in the same case.

### The matrix now, re-measured rather than remembered

**37 passed, 12 partial, 5 structural, 5 not-run, 0 none, 1 refused — 60.** **The `none` column is
empty for the first time**: no row is left with no instrument at all.

**The prose tally under the T-table was stale and this wave did not cause it.** It read *"22 passed,
19 partial, 1 structural — 42"*, re-counted after wave 7, and was still standing against an actual
**27 / 10 / 5** because wave 14 regraded eight rows and AD15-R1 three more. It now carries the `awk`
that produces its figures, and **that command was run verbatim as the document prints it** — an
instruction nobody has run is a plan, not a procedure.

## Five `src/` findings, NONE fixed, by the user's standing decision

Re-asked once this session because the scope had changed since the first answer; the user chose
**record-only** again. The first three are session eleven's, unchanged:

1. **The designer's header reads `Saved` beside its own out-of-date strip**, and
   `save-state.saved-refresh-needed` cannot be produced on that surface at all. Against C08's
   *"Saved must not imply that a stale canvas is current"* this is still **the sharpest open question
   in the package**. Steps **B9, B11**.
2. **`unrecoveredWrite` is set by the designer and drawn nowhere.** Steps **B19, B20**.
3. `runtime.ts`'s `writesBlocked` premise contradicts `assetDesignStore.stale`. A comment, not
   behaviour. No step observes it.
4. **NEW — `PlanAssetUsage.projectId` reaches no view.** Of every `src/` file importing
   `AssetPlanUsage`, the only one naming `projectId` is `ListPlansUsingAsset.ts`, the query that
   produces it; both usage panels draw plan name and placement count only, so **two plans both named
   `Kitchen` in different projects render identically**. That is F10's own stated focus. The sibling
   `AssetInspectorUsedIn.vue` keys on `projectId` *precisely because* two projects may share one
   identity — the same hazard with opposite answers in one directory. **Grep trap**: a bare
   `projectId` search over `src/presentation/library/` is NOT empty; those hits are `ReferencingGroup`
   from a different query, and only the `AssetPlanUsage`-importer grep settles it.
5. **NEW, and NOT this package's** — `settings.units` binds a control and persists through
   `saveSettings`, and **nothing reads it**. Measured three ways, with the display path hard-coded to
   `'en-US'` in `formatLength.ts` and `formatArea.ts`, both docblocks naming *"the per-plan units
   PBI"* as what would change it. Plugin-wide and predating the expansion — but it bears on **AD16's
   release-checklist box *"No unfinished or nonfunctional controls advertised"*, which is ticked.**

## Carried forward — three VERIFIED this session, five not

Verified against the tree, so do not re-inherit them blind:

- **`Show grid` defaulting off — REAL.** One shared `WorkspaceStore.gridVisible`;
  `DesignerCanvas.vue` says so itself. Flipping the designer flips the Plan Editor. A `src/` product
  decision, not test work.
- **German `Vorlage` — STALE, WITHDRAWN.** Three occurrences, all meaning *preset*; the reference
  sheet is `Datenblatt`/`Hintergrund`. **The collision does not exist in this tree.** Do not carry it
  again.
- **`tests/harness/assetDesigner.ts`'s `background: null` — NOT a defect.** Deliberate and
  documented, matching `planEditor.ts` §55. And fixing it would **not** free U04's seven `browser`
  steps: those need `harness-shot` captures and there is no pinned Chromium.

**Not verified this session**, still candidates and nothing more: item 8's ownership, the 460 px
toolbar's second row, 80rem being 1280px of LEAF, `designer-object.css`'s dead rule, the three
test-hygiene items beside it.

**Still unclaimed by any matrix row**: `reversibleAssetDesignWindows.test.ts`, the strongest two-leaf
evidence in the repository. Worth a row rather than a card.

## The next card, if there is one

**T32's geometry half is closed for the committed design's seven marks and OPEN for the selection's
and the gesture's.** `selectionMarks`, `RotateArrowIcon.vue` and `DesignerGestureLayer.vue` each take
theme tokens AND emit coordinates, and W16-C's case selects nothing and draws no gesture. A mount
that does both is a card. **T27's losing side is also live rather than refused**: a source-scan
category check that nothing under `src/presentation/designer/` registers an owner-level key listener
would hold for code not yet written, and lost only on scope.

## What is left is VAULT WORK, and only vault work

Every row the triage found agent-closable is closed. Every row it found otherwise has a ruling
saying why. AD16 item 1's fixture half is built and its measurement half is refused with reasons.
**The next session is the terminal manual pass** — read `MANUAL-PASS.md`, walk
[[Two designers on one asset]] **step 1 first** because it decides eight steps, and fill each case's
own Runs table rather than an aggregate. **An aggregate "looks good to me" is not a filled Runs
table**; the 2026-09-19 walk produced exactly that and the matrix had to say so.

## Nothing is authorized

AD17 and advanced roadmap work need explicit scope activation under runbook §10 and have none.
AD18's **"deliberately absent"** table lists ten board elements that must NOT be implemented back.
Marking PR #230 ready, tagging and publishing a release were **not** requested and **not** given.

## This machine

7.8 GB RAM, SHARED. Check WHAT is running, not how many:

```
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Select-Object ProcessId,CommandLine | Format-List"
```

- Prefix every node-spawning command: `export TEMP=D:/tmp-claude TMP=D:/tmp-claude`
- `check:fast` locally, full `npm run check` in CI. **Seven sessions running.** `check:fast` took
  **>600 s** on this box this session and had to be backgrounded — budget for that.
- Workers run narrow `npx vitest run <paths>` only. `check` / `test:coverage` / `analyze` are the
  integrator's. Run `test:coverage` BEFORE `analyze`.
- Watch CI **by run id**: `gh run view <id> --json status,headSha,conclusion,jobs`. Do not push
  repeatedly in quick succession; it cancels in-flight runs.
- The exit-code trap stands: read the log's own `Test Files` line, never the exit code alone.
- **A shell single-quoted `node -e` breaks on an apostrophe in your prose.** It cost one round this
  session. Write the script to a file.
- CRLF: about twenty files under `src/` and `tests/` are `i/lf w/crlf`; `docs/` is LF throughout.
- Worktrees under `.worktrees/` carry `node_modules`, reusable with `git switch -c`: `ad07`
  (wave 16 C), `ad08r`, `ad10` (wave 16 B), `ad11` (wave 16 A), `ad13b`, `ad13c`, `ad14`, `adq`.
- **`SendMessage` to the card's ORIGINAL author is still right for a fix round. Six sessions
  running.** All three cards this wave verified their fix instructions at the code before applying
  them, and W16-C re-ran its mutation against the FIXED tree unprompted, because a red quoted from a
  tree the fix changed is not evidence about this one.

## The rule this session paid for

**A row nobody is editing is a row nobody re-reads.** T25 sat wrong through three edits of the file
it lives in, and a card was nearly spent on it. The corollary is the one to carry: **corrections
travel in every direction, including into the integrator's own instructions** — a review prompt this
session repeated a card's over-claim back at it instead of checking, and the reviewer caught the
integrator rather than the card.
