# RESUME — session eight's hand-off

**Rewritten 2026-09-20, replacing session seven's packet wholesale**, for that file's own stated
reason: a hand-off that is appended to goes stale in a way a reader cannot detect.

Branch `renovation-planner-asset-designer-bc5539`, worktree
`D:\Projects\renovation-planner\.claude\worktrees\renovation-planner-asset-designer-bc5539`.
HEAD `51fdaed89`, **pushed**. PR [#230](https://github.com/Luis85/renovation-planner/pull/230),
still DRAFT. `main` is untouched at `f3a8864a9`; this branch's merge base is `ed5c50b76`.

## CI IS GREEN. Do not go looking for the red the last packet led with.

`gh pr checks 230` on `51fdaed89`: all four `verify` legs pass, plus `audit` and GitGuardian.
1068 test files, `✗ 0 above threshold`, duplication 4 clone groups.

**The red that session seven handed over was diagnosed wrongly in BOTH halves, and the correction
is the single most useful thing in this file.**

### Duplication does not gate. It never did.

`duplicates.threshold` defaults to `0`, which fallow's schema documents as *"no limit"* — not as
zero tolerance, which is exactly what a `✗` beside a duplication count reads like. Proof rather than
argument: `main`'s own **green** CI at `ed5c50b76` prints `● Duplicates (7 clone groups)` and
`✗ 80 lines (0.1%) duplicated across 7 files`. This branch's **green** CI at `c3527450b` prints
4 groups and `✗ 101 lines` — the same duplication output the red run had.

So the `ignoredClones` key-renumbering trap that session seven blamed, and that W9-A's reviewer
raised as finding M4, is real as a mechanism and **was not operating**. The branch had in fact taken
clone groups from **7 to 4**, fixing three in `scripts/editor-usability-*.mjs` and one in
`ObsidianPlanGeometrySidecar.ts`.

**Read the `Failed:` line and the `N above threshold` count. A `✗` on the duplication summary is not
one of them.** That is now written at `.fallowrc.json` itself (`bb1677d66`) so a third session cannot
repeat it.

### The `Failed:` line's tail names a file that is not the problem

It ends *"start with `<file>`"*, naming the top of fallow's **53 refactoring targets** — a quick-win
ROI ranking that fails nothing and is usually a file the branch never touched.
`renovationSummary.ts` was that file, twice, and it is untouched by this branch.

### What actually failed

One `health` finding: `DesignerInspector.vue`'s `<template>` at cognitive **17** against
`maxCognitive` **15** — W9-A's own `Object | Reference` tabs, since every boolean operator inside a
`v-if` counts. Repaired at `c3527450b` by hoisting two compound conditions into named computeds. No
suppression, following `AssetInspectorActions.vue`, `UnreadableStrip.vue` and
`DesignerUsagePlans.vue`, which each refuse `fallow-ignore-next-line complexity` where they refuse it.

**One trap worth inheriting**: a first local run showed **2** findings against CI's 1, the extra being
`editDimensions` at CRAP 71.3. That was **stale coverage** — 7740 functions matched against CI's
7762, so it fell back to the static estimate. A figure read off a stale `coverage/coverage-final.json`
looks exactly like a real regression. Run `test:coverage` before `analyze`, always.

## Wave 10 — two cards, both merged, both reviewed

Authorized by the user at the start of this session: AD18 sequencing items **3+6**, **5** and **7**.

| Card | Candidate | Fix round | Integrated |
|---|---|---|---|
| **W10-A** — icon toolbar (item 3) and canvas proportion 560–900 (item 6) | `84d76fde1` | `4dec45fca` | `14cd708e7` |
| **W10-B** — guided trace checklist (item 7) and the empty Reference panel | `297179e4f` | `653bddce9` | `2f87284dc` |

Leases verified disjoint with `git diff --name-only` **and on both fix-round shas**; intersection
empty every time. Each card reviewed by an agent that did not write it.

**Item 5, the `Add` rail, is AUTHORIZED and was SEQUENCED, not dropped.** Ruling AD18-R3: the
Basic-shape buttons MOVE into the rail. That puts items 3 and 5 on `DesignerToolbar.vue` together, so
they cannot hold disjoint leases in one wave. **It is wave 11's card and the ground is prepared** —
see below.

## Rulings taken this session, all in `contracts/DECISIONS.md` AND in `state.json`

- **AD18-R3** — shape buttons move into the `Add` rail; not duplicated, not left behind.
- **AD18-R4** — `Add details` ticks but never becomes the CURRENT step, because it is optional and
  first-not-done otherwise pins the pointer to it forever. **Decided against a described render
  rather than a drawn one** — nobody had rendered the checklist at the time, and that is recorded
  where the ruling is. If the picture changes the user's mind, that note is where to look.

**AD18-R1 and AD18-R2 were in `DECISIONS.md` and NOT in the ledger** — the exact failure that ledger
already records against AD12-R1, one wave later. Both added with their real dates and the lateness
stated. **Check both files when you take a ruling.**

## What the browser settled, and why you must use it

`npm run harness` plus the in-app browser is the ONLY instrument here that applies layout. jsdom lays
nothing out and there is no pinned Chromium. It settled four things no gate could:

| | Measured |
|---|---|
| Canvas proportion at 580 | **128 / 290 / 162** — canvas 31.0 % → **50.0 %**, matching W10-A exactly |
| Toolbar at 580 | **107 px → 69 px**, tool rows 3 → 2 |
| `DesignerViewMenu`'s `<summary>` | `display: list-item` — the rule narrowing holds |
| Trace checklist fold | inspector `scrollHeight 778 === clientHeight 778` at 1280×900, rail 224 px |

It also found a defect nothing else could: **`font-weight` inherits to `::marker` but `color` does
not**, because Obsidian's sheet sets `ol > li::marker { color: var(--list-marker-color) }` and an
explicit declaration beats inheritance. The current step brightened its words and left its number
behind. One declaration, verified in both schemes (`baec02e8d`).

**Two mistakes I made with it, so you do not**: setting `documentElement.style.width` is NOT a
viewport change — use a real resize; and two element tops 2 px apart are ONE misaligned row, not two,
which is the same distinct-`top` overcount AD18's own note warns about.

## Two documents were corrected by measurement, not by code

- **AD18's *"`Used in plans` wraps badly at 224 px"* is not reproducible.** At a 224 px rail it is
  **one line**; the second appears between 224 and 210. So W10-A's rail caps **INTRODUCE** that wrap
  across 560–800 rather than deepening an existing one — and W10-A's reviewer had reasoned from the
  wrong premise to a conclusion that was directionally right. The amendment is in AD18 itself. The
  copy defect in the same bullet (`placement(s)`, untranslated plural) stands unamended.
- **`designerNarrowQueryResolved.test.ts`'s "blind spot is EMPTY"** is narrowed: W10-A ships the
  first `display: none` reaching a designer toolbar control at a narrow leaf, from a third partial
  that guard does not read. Nothing is red and nothing should be. Widening it to every
  `designer*.css` partial was considered and **refused in the same paragraph**, because the first
  thing such a sweep reports is the deliberate rule, and that is a different instrument.

## Wave 11 — the ground is prepared, and here is exactly what is waiting

**Item 5, the `Add` rail.** `DESIGNER_TOOL_ICONS` now lives in
`src/presentation/designer/tools/designerToolIcons.ts`, beside `DESIGNER_TOOL_LABELS`, carrying a
`group: 'tool' | 'shape'` field — filter it on `'shape'` for the four drawing tools. **It was moved
there for a reason you would otherwise rediscover the hard way**: it was a `<script setup>` const, and
a script-setup binding is not a module export, so the rail could never have imported it. The report
claiming otherwise was false rather than loosely worded.

Wave 11 then deletes `SHAPE_MODES` and `.rp-designer-shape-tools`, and `LEADING_MODES` /
`TRAILING_MODES` collapse into one loop. The shape keys are already named `designer.shapes.*` rather
than `designer.toolbar.*`, so they outlive the toolbar they are currently drawn in.

**How to lease a wave here**, learned twice: `{en,de}/editor.ts` is the ONE composition point for
feature locale copy, so create each card's locale table EMPTY in the wave base and wire it yourself —
two cards each adding an import and a spread line is one file in two rows. Same for a new `styles/`
partial and its `@import`: `scripts/styles-assemble.mjs` refuses a partial no entry file imports, so
the two are one action and cannot be leased apart.

## Carried forward, not taken

- **`assetDimensions.test.ts` says "`DesignerInspector` was the ONLY reader of `dimensionsUnscaled`
  in the tree."** `DesignerSelectionInspector.vue` reads it too. A stale "only".
- **An unreachable guard in `DesignerInspector.vue`**: `dimensions === null && dimensionsUnscaled`
  cannot happen — `GetAssetDesign` sets `dimensions` exactly when `shape !== null` while
  `dimensionsUnscaled` is `footprintPending`. Removing it is a real way to recover a branch arm, and
  it is a behaviour change that wants its own commit. The reason is written at the code.
- **German `Vorlage` means BOTH reference sheet and shape preset** — 18 hits across six locale files,
  confirmed by the reviewer. `Vorlage wählen` in the trace guide can read as "pick a preset" in a
  designer that has a real preset gallery. W10-B took the neighbouring panel's spelling rather than
  minting a third, which is right for its lease; renaming a family is its own card.
- **Three icon glyphs have no harness fixture** — `circle`, `squircle`, `anchor`. The pin exists and
  is non-vacuous. The fixture permission is **insufficient for its own purpose**: an SVG under
  `tests/fixtures/editor-icons/` renders nothing without `tests/helpers/editorIconNodes.ts`, which is
  a generated node map. Grant both or neither.
- **Whether Obsidian's installed catalogue answers `squircle`, `circle`, `anchor`, `land-plot` and
  `square-dashed` at all.** `HostIcon` never substitutes, so an unanswered name is an empty button in
  a vault as well as in the harness. Only `npm run test-build` can answer it.
- **Icon-only at EVERY width** is a ten-line follow-up that needs two integrator-owned files:
  `designerRig.ts` resolves toolbar buttons by `.text()` (17 test files depend on it) and
  `designerToolbar.test.ts` asserts `.text()` in three places. W10-A shipped the Plan Editor's own
  labelled-≥80rem answer instead and said why.
- **80 rem is 1280 px of LEAF, not of window**, so in a real vault the labelled state is effectively
  unreachable. Arguably what the card wanted; nobody has decided it.
- W8-B's declaration case still wants moving to `designerStyles.test.ts`; `designer-object.css` still
  carries a dead `.rp-designer-inspector .rp-designer-asset-name` rule and a stale file header;
  `designerDrawDetails.test.ts` still has a third `held` clone; `designerSelectMarquee.test.ts` still
  says twice that EditorSurface routes "a release outside the leaf" to `abandonGesture`, wrong in the
  third item of each list only.

## This machine

7.8 GB RAM, **SHARED**. Check WHAT is running, not how many — and this is not advice, it happened
again: a full `npm run check` here went red on pure timeouts while another worktree
(`renovation-planner-beta-handoff-e80bb5`) was mid-`test:coverage`.

```
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Select-Object ProcessId,CommandLine | Format-List"
```

CLAUDE.md's rule is the remedy and it works: **`check:fast` locally, full `npm run check` in CI.**
That is what this integration did — `vue-tsc`, `oxlint`, `eslint . --max-warnings 0`, `npm run build`
and 1035 narrow tests locally, with `test:coverage` and `analyze` left to the pipeline, which passed.

- Prefix every node-spawning command: `export TEMP=D:/tmp-claude TMP=D:/tmp-claude`
- Never pipe a gate through `tail`; write the full log to a file. **And make the wrapper propagate
  the exit code** — `cmd > log; echo "EXIT=$?" >> log` reports the *echo's* status. That reported a
  failed gate as green here once.
- Never bare `git stash` — the stack is shared. Use a WIP commit.
- A scripted edit is invisible to `scripts/lint-edited.mjs`. Run `npx oxlint`/`npx eslint` by hand.
- Do NOT run `npx playwright install chromium`; it emptied `node_modules` once.
- Worktrees `ad07` (`ad18-icon-toolbar`) and `ad10` (`ad18-trace-checklist`) carry `node_modules` and
  are reusable with `git switch -c`.
- **SendMessage works.** Both fix rounds went back to the card's ORIGINAL worker, which keeps full
  context. Both produced better fixes than a fresh agent would have.

## The one instruction that earned the most

Every candidate got an independent reviewer that did not write it. This session that caught: a
`TOOL_ICONS` table advertised for wave 11 that **could never have been imported**; two counts written
from memory (52 against a measured 44, and "third caller" against nine); an axe gap where a card's
new ARIA sat behind `display:none` and was graded by nothing; and two stale sentences a card's own
report had missed. Corrections travelled in every direction — a worker corrected its reviewer, a
reviewer corrected a worker, and the integrator corrected a reviewer with a browser measurement it
had asked for.
