# RESUME — session nine's hand-off

**Rewritten 2026-09-20, replacing session eight's packet wholesale**, for that file's own stated
reason: a hand-off that is appended to goes stale in a way a reader cannot detect.

Branch `renovation-planner-asset-designer-bc5539`, worktree
`D:\Projects\renovation-planner\.claude\worktrees\renovation-planner-asset-designer-bc5539`.
PR [#230](https://github.com/Luis85/renovation-planner/pull/230), still **DRAFT** — the user has
not been asked to make it ready and nobody should on their own initiative. `main` is untouched at
`f3a8864a9`; this branch's merge base is `ed5c50b76`.

## Read the CI section before you read a red as a duplication failure

This correction is now two sessions old and has caught two sessions in a row, so it stays at the
top. `duplicates.threshold` defaults to `0`, which fallow's schema documents as **"no limit"** —
so a `✗` beside a duplication count is a GLYPH, not a gate. Read the `Failed:` line and the
`N above threshold` count instead. The `Failed:` line's tail names the top of fallow's
refactoring-target ROI ranking, which fails nothing and is usually a file the branch never
touched. `.fallowrc.json` says so at the config.

## Wave 11 — AD18 item 5, the `Add` rail. ONE card, merged.

| | |
|---|---|
| Base | `720fe6b21` — CI **green on all six** legs |
| Candidate | `f9b43fa27` |
| Fix round | `1fdb75f36` |
| Merged | `912c51bae` |
| Integrator repairs | `f33c14d88` |

**One card rather than a thin wave, and that was a finding rather than a shortage of work.**
AD18-R3 moves the Basic-shape buttons out of the toolbar, so the toolbar's deletion and the rail's
creation are one atomic change — a split wave would have an intermediate state with the four shapes
drawn in both places or in neither. Three workers is a maximum, not a quota.

**Two rulings taken before dispatch**, in `contracts/DECISIONS.md` AND `execution/state.json` in the
same commit, which is the discipline AD12-R1 cost this package once and AD18-R1/R2 cost it again:

- **AD18-R5** — the rail STACKS `Add` above `Parts`, not tabs. The deciding reason is a GATE:
  `.rp-designer-parts` is `v-if="design !== null"` so it survives empty for a loading or failed
  leaf, and AD18-R2 already said in its own words that a tab control must not move that gate. It
  also costs AD08-R1 something — the Parts panel is C05's blessed overlap alternative — and
  declines to spend it. `[role="tab"]` stays 0 deliberately, which AD18 item 5 records as part of
  the gap.
- **AD18-R6** — the `Add` section carries the preset DOOR; `DesignerInspector`'s copy is deleted;
  `DesignerEntryPaths`'s copy stays. `startFromPreset` replaces the whole design, so board 02's
  inline gallery in a panel called `Add` is refused on semantics before measurement.

## What the browser settled, and why it is the first thing you should reach for

`npm run harness` plus the in-app browser is the ONLY instrument here that applies layout. jsdom
lays nothing out and there is no pinned Chromium. Run it on any wave that draws.

**It found that W10-A's 80rem breakpoint rested on a measurement of the toolbar taken BEFORE the
icons that card was adding.** `styles/designer-toolbar.css` claimed *"all fourteen at `top: 32`"* at
1280. Rendered at the wave-11 base: ten at 32, four wrapped to 70, the summary at 72, region 69px.
The cause is arithmetic — AD18 recorded the widest label at **157px** and it measures **179px** with
the glyph, about +22px on every button. This is this repository's own rule (write the sentence from
what the measurement printed AFTER the change) caught one wave late.

**Item 5 repairs it.** After the card: all ten remaining buttons at `top: 33`, summary at 34,
region **32px** — one row, for the first time.

| container | toolbar height | tool-button rows |
|---|---|---|
| 1280 | 69 → **32** | 2 → **1** |
| 760 | 32 → 32 | 1 → 1 |
| 580 | 69 → **32** | 2 → **1** |
| 460 | 69 → **65.9** | 2 → **1** |

At 460 the region is 65.9px on ONE button row, so a second visual row is taken by something else.
**Nobody chased which, and nobody should assert it** — it is recorded as unexplained in the CSS.

**AD18-R5 named a cost it could not measure, and it is measured now.** At 460 `.rp-designer-parts`
goes from exactly full (140/140) to **26.5px of scroll**. It is `overflow-y: auto`, so it scrolls
rather than clips, and **all five Add controls stay above the fold** (bottoms 161 and 191 against a
region bottom of 239). What falls below is the parts empty-state message, not a control. No
horizontal scroll at any width. **Read that narrowly**: `tests/harness/assetDesigner.ts` mounts an
asset with no shape, so this is the Parts panel in its EMPTY state — the weakest case. A
parts-full panel pays more and nothing here can produce one.

**AD18-R6 had a benefit nobody predicted**: deleting the Inspector's preset button took its 460px
overflow from **54px** to **7px**.

**One integrator measurement was WITHDRAWN rather than carried.** A first pass flagged a "clipped"
Add button. False positive: `overflow: visible`, so nothing is clipped, and the 3px is the harness's
own `.rp-host-icon::after { content: "squircle" }` missing-fixture marker — `squircle` is simply a
longer word than `circle`. It is written down as an artifact so nobody re-finds it as a defect.

## The review is still the highest-yield step, and here is this wave's evidence

Twelve findings from an agent that did not write the code, **every one verified by the integrator
before being acted on**. Two were code rather than prose:

1. A `fallow-ignore-next-line` directive above a SELECTOR where CLAUDE.md's own gotcha says it must
   be above the DECLARATION — the mistake that file records as having been made twice already.
2. `tests/harness/assetDesigner.ts`'s `pressTool` answering an unfound button with `?.click()`,
   with its own new docblock naming the defect and shipping it. The repository already refuses
   loudly one function below (`drawInHarness`), so it tested the loud refusal and permitted the
   silence one line apart.

The other ten were counts and ordinals the card's own deletion falsified. Ten went back to the
ORIGINAL worker by `SendMessage` — which keeps full context and again beat what a fresh agent would
produce — and came back fixed in one commit with **nothing refused**.

**Corrections travelled in every direction, which is the test of whether anyone below is reading.**
The reviewer corrected the integrator's brief (AD18's gaps section numbers this work item **3**, not
5; row 5 of the sequencing table is the right pointer). The card corrected the LEASE TABLE: its
*"43 call sites across 26 test files"* conflates two greps — 43 lines in **17** files for
`toolbarButton(`, and 26 for `grep -rln "designerRig"`. Both commands are printed side by side in
that row, which is where the conflation came from. The integrator corrected itself twice while
writing its own repairs (drafted "six lines", grep printed **nine**; drafted "seven lines", grep
printed **five**) and withdrew the clipped-button finding above. And the integrator reversed its own
instruction to the card once, after rendering gave it numbers the card could not take.

**One question was put to the card rather than decided over it**, and the answer decided the shape
of the fix: the rail's `.rp-designer-tool-label` span is dead markup at every width, so should
`DesignerToolButton` still emit it there? The card argued KEEP — `display: none` removes it from the
accessibility tree too, so it costs nothing in either tree; the rail's treatment is one CSS rule
that one line reverses, where deleting the span makes it a component change and teaches
`DesignerToolButton` about its container, the one thing that component is built not to know (it
carries a recorded correction about exactly that shape). That turned a follow-up card into a
narrowed sentence.

## Gates

At the integration sha `f33c14d88`:

- `npm run check:fast` **exit 0, read from the log and not from the wrapper** — 1070 test files,
  11806 passed, 1 skipped, zero failure text. The base was 1068 files.
- `oxlint` and `eslint` run BY HAND over every scripted edit; both exit 0. A scripted edit is
  invisible to `scripts/lint-edited.mjs`.
- CI `npm run check` green on all six at `1343cf4e5` — four `verify` legs, audit, GitGuardian.
  `0 above threshold`, dead files 0, dead exports 0, maintainability 86.8, 1222 files.
- CI `npm run check` green again at `df1c7157e` and at `7c0cf4f95`, verified BY RUN ID. **A watcher
  that polls until the word "pending" disappears reports the PREVIOUS run's result** — it exited on
  the gap before GitHub registered the new run, and the green it printed was not the commit's.
  Watch `gh run view <id> --json status,headSha,conclusion` instead.
- A LOCAL `test:coverage` was run to prove the first directive fix and **exited 1 with 34 failures,
  33 of them `Test timed out`**, every one under `tests/presentation/editor/` or `tests/harness/`
  and none touching a stylesheet. Three were re-run ALONE and all passed, exit 0 — including the
  one non-timeout failure, which was a cascade inside a file whose first case had already timed
  out. Contention, exactly as this file's machine section predicts, on a tree CI had just run green
  with coverage. **Nothing was quarantined and no budget was raised.**
- **Because that coverage run failed, `coverage-final.json` may be partial, so the HEALTH section of
  the analyze run beside it is not trustworthy.** The duplication section reads no coverage at all,
  which is the only reason the clone-group result above stands. Say which section you are trusting
  and why. The LATER run, for the remaining four directives, was clean on a quiet machine —
  `test:coverage` exit 0 with 1070 files and 11806 tests, `analyze` exit 0, `0 above threshold` —
  so that one's health section IS trustworthy. Two runs of the same command, one trustworthy half
  and one not, is the reason to record which.

**One gate was started and KILLED, and the reason is a mistake worth inheriting.** A `check:fast`
was running in `.worktrees/ad07` when the fix round was dispatched into that same worktree — so the
gate was reading a mutating tree. Killed rather than believed. **Do not dispatch a worker into a
worktree a gate is reading.** What survived from it is real: `oxlint --deny-warnings` and
`vue-tsc -noEmit` had both passed before the suite started.

**CI went green on all six at `1343cf4e5`, and reading the analyze section of that PASSING leg
found a defect no gate here can report.** This is the most transferable thing in this hand-off.

**A `fallow-ignore-next-line code-duplication` directive above a SELECTOR suppresses nothing.** The
directive means the next line LITERALLY, and the selector line sits between it and the first
declaration. `styles/designer-header.css` already states that rule; **seven of the twelve such
directives under `styles/` break it anyway**, and duplication does not gate, so four unsuppressed
clone instances rode a green run without comment.

Measured, not argued. CI reported group `6f96bf57` with FOUR instances —
`designer-add.css:100-117`, `designer.css:120-143`, `editor-shell.css:72-103` and `:135-145`. Line
100 is the `padding:` declaration; the directive was at 98 and the selector at 99. Moving the two
designer directives inside their blocks took that group to TWO instances, the untouched
`editor-shell.css` pair. Exactly the two changed disappeared, which makes it an experiment.

**The contrast that proves it was already in the tree**: W11-A's fix round moved the
`start-preset` directive inside its block, and `start-preset` is ABSENT from the clone report while
the block the card AND its reviewer both cleared is present. Both reasoned that its first
declaration is `padding`, so above-the-selector and above-the-declaration are the same line. They
are not.

**All of them are fixed now.** The user authorized the remaining four after the wave closed, and
`7c0cf4f95` moved them — `.rp-context-bar__button` and `.rp-primary-actions__button` in
`editor-shell.css`, `.rp-layer-list__action` in `editor.css`, `.rp-unsupported-width__action` in
`editor-layout.css`. **Every directive under `styles/` now sits above a declaration: ELEVEN of them,
on TEN rules across SEVEN partials** (`.rp-designer-edit-dimensions` carries two, its margin and
padding families being separate clones).

**The CSS clone group is gone from the report entirely.** Group `6f96bf57` held four instances,
then two, and now does not appear: CI at `7c0cf4f95` prints **3 clone groups** and
`✗ 34 lines (0.0%) duplicated across 4 files`, against 4 groups and 119 lines across 7 files at
`1343cf4e5`. Every group left is TypeScript; there is no CSS group. **Nothing is reported as a
stale or unused suppression**, which was the risk worth checking before moving a directive onto a
line that might have no finding under it.

**Two of the four were not measurable and the sentence has to say so.** `.rp-layer-list__action`
and `.rp-unsupported-width__action` appear in no clone group and are not in `ignoredClones` — which
holds exactly one key, the ZoneSummary prototype pair — so their blocks are simply not detected as
clones of the family. Their directives suppressed nothing AND had nothing to suppress; moving them
is correctness by rule. The `editor-shell.css` pair is what actually removed the group.

**"Seven of twelve" was wrong and the real figure is eleven directives.** The twelfth match was
PROSE inside a block comment naming the directive, not a directive — a grep counting its own
documentation, which this session did four times. `designer.css`'s canonical paragraph had the same
disease and is repaired: it said the directive sat at *"this and four sibling rules"* and then
listed five, written before the rail added two more. It names no list now, because the grep is the
list.

**Two lessons from fixing it, both paid in this session.** Adding the explanatory comment to
`designer.css` pushed it to 405 lines, over the 400 cap — caught by `npm run build`. And that
falsified three "398" sentences written an hour earlier in the same session. **FIVE partials have
carried a line-count figure for `designer.css` and every one was falsified by somebody adding a
comment to that file.** None of them carries a number now; they say `wc -l`.

## Carried forward, not taken

- **An UNREACHABLE guard in `DesignerInspector.vue`**: `dimensions === null && dimensionsUnscaled`
  cannot happen. Removing it recovers a branch arm and is a behaviour change wanting its own commit.
- **`assetDimensions.test.ts` says `DesignerInspector` was the ONLY reader of `dimensionsUnscaled`.**
  `DesignerSelectionInspector.vue` reads it too. A stale "only".
- **German `Vorlage` means BOTH reference sheet and shape preset** — 18 hits, six locale files. It
  matters more now: the rail has a real preset door, so `Vorlage wählen` in the trace guide reads as
  "pick a preset" more easily than it did. Renaming a family is its own card.
- **`designer.inspector.start-preset` is drawn in the rail now**, under an inspector-shaped key, the
  same staleness class as `designer.toolbar.draw-*`. All are deliberately unrenamed: a locale key is
  data nothing is bound to, so a stale one is churn to fix rather than breakage to leave.
  `en/designerAdd.ts` carries the argument.
- **`tests/harness/assetDesigner.ts` binds neither `openLibrary` nor `usePlan`**, so no capture can
  photograph the full header. Still AD18's own outstanding fixture item.
- **Three icon glyphs have no harness fixture** (`circle`, `squircle`, `anchor`), and the harness
  marks them by rendering the NAME — which is what produced this session's withdrawn finding. The
  fixture permission is insufficient for its own purpose: an SVG under `tests/fixtures/editor-icons/`
  renders nothing without `tests/helpers/editorIconNodes.ts`, a generated node map. Grant both or
  neither.
- **Whether Obsidian's installed catalogue answers those names at all is unknown.** `HostIcon` never
  substitutes, so an unanswered name is an empty button in a vault — and since item 5 the rail is
  icon-only at EVERY width, so a missing glyph there is a button with nothing in it and no text to
  fall back on. **This is the single strongest argument in the package for `npm run test-build`**,
  which is the only instrument that can answer it.
- **80rem is 1280px of LEAF, not window**, so the labelled toolbar state is effectively unreachable
  in a real vault. Nobody has decided whether that is fine — and it is now the state the repaired
  measurement describes, so deciding it is cheaper than it was.
- `designer-object.css` carries a dead `.rp-designer-inspector .rp-designer-asset-name` rule and a
  stale header; W8-B's declaration case wants moving to `designerStyles.test.ts`;
  `designerDrawDetails.test.ts` has a third `held` clone; `designerSelectMarquee.test.ts` says twice
  that EditorSurface routes "a release outside the leaf" to `abandonGesture`, wrong in the third item
  of each list only.

## AD18: what is left, and what is NOT authorized

The user authorized items 3, 5 and 7 by the SEQUENCING TABLE's numbering. **All three have
shipped** — 3 and 6 in wave 10, 7 in wave 10, 5 in wave 11. **Nothing in AD18 is currently
authorized. Ask before starting any of it.**

Unowned and unauthorized: item 8 (the vanity fixture, assigned to AD15), `Show grid` defaulting off,
and the untranslated `placement(s)` plural. AD18's **"deliberately absent"** table lists ten board
elements that must NOT be implemented back — implementing one is worse than doing nothing.

## This machine

7.8 GB RAM, **SHARED**. Check WHAT is running, not how many:

```
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Select-Object ProcessId,CommandLine | Format-List"
```

- Prefix every node-spawning command: `export TEMP=D:/tmp-claude TMP=D:/tmp-claude`
- `check:fast` locally, full `npm run check` in CI. It worked again this session.
- Workers run narrow `npx vitest run <paths>` only. `check` / `test:coverage` / `analyze` are the
  integrator's. Run `test:coverage` BEFORE `analyze` — stale coverage makes CRAP fall back to a
  static estimate and invents a finding that looks exactly like a regression.
- Never pipe a gate through `tail`; write the full log to a file and **capture the exit code before
  echoing it** (`cmd > log; ec=$?; echo "EXIT=$ec"`). And read the LOG, not just the code.
- A failing file under load is usually a TIMEOUT. Re-run it ALONE. Never raise a budget.
- Never bare `git stash` — the stack is shared. Use a WIP commit.
- A scripted edit is invisible to `scripts/lint-edited.mjs`. Run `npx oxlint` and `npx eslint` by
  hand. **oxlint prints NOTHING on a clean run** — check the exit code, not the output.
- Do NOT run `npx playwright install chromium`; it emptied `node_modules` once.
- Kill harness dev servers when you are done measuring; two were left running this session and had
  to be reaped before a gate.
- Worktrees under `.worktrees/` carry `node_modules` and are reusable with `git switch -c`. `ad07`
  is on `ad18-add-rail`.
- **`SendMessage` works and is the right tool for a fix round.** Three sessions running, sending
  findings back to the card's ORIGINAL worker has beaten dispatching a fresh agent.
