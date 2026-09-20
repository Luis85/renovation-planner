# RESUME — session seven's hand-off

**Rewritten 2026-09-19, replacing session six's packet wholesale**, for that file's own stated
reason: a hand-off that is appended to goes stale in a way a reader cannot detect.

Branch `renovation-planner-asset-designer-bc5539`, worktree
`D:\Projects\renovation-planner\.claude\worktrees\renovation-planner-asset-designer-bc5539`.
HEAD `e84da5ae2`. **The branch IS pushed** — PR
[#230](https://github.com/Luis85/renovation-planner/pull/230), still DRAFT, and it was pushed
before this session too. Session six's packet said *"Nothing has been pushed"* and that was already
false when written; `main` is untouched at `f3a8864a9`, which is the part of that sentence that was
true.

## READ THIS FIRST: CI IS RED on `d6a7778fd`, and the cause is diagnosed but NOT fixed

Run `gh pr checks 230`. All four `verify` legs fail; `audit` and GitGuardian pass. **The suite and
the linters are GREEN** — build, oxlint, `eslint .` and `test:coverage` all pass. **`npm run analyze`
is what fails**, on two findings:

```
✗ 101 lines (0.1%) duplicated across 6 files
✗ 1 above threshold · 8109 analyzed · maintainability 86.8 (good)
Failed: dupes (4 clone groups), health (1 above threshold):
  start with src/presentation/editor/renovation/renovationSummary.ts
```

**None of the reported files was touched by this branch** — verified with
`git diff --name-only ecae21ab2..HEAD` against every one of them. The reported clone groups are
`styles/designer.css:120-143` + `styles/editor-shell.css` (32 lines, 3 instances, `dup:6f96bf57`)
and three pre-existing `src/presentation/editor/` groups.

**The mechanism is the trap `.fallowrc.json`'s own comment documents, and it was predicted.**
W9-A's reviewer raised it as finding M4 and said only an `analyze` run could settle it; neither the
worker nor the reviewer was allowed to run one, and the local box was held by another session all
day, so it reached CI unverified. That config comment says a key is *"the id fallow PRINTS plus
`:<instance count>`"* and that the `-N` group index *"renumbers whenever any group appears or
disappears, INCLUDING because another key hid one."* `ignoredClones` holds exactly one key,
`dup:7fd5d625:2`. The run reports `note: hid 1 reviewed clone group` — W9-A's new
`.rp-designer-title-bar` block in `styles/designer-header.css`, suppressed by its
`fallow-ignore-next-line` — and the group that remains now prints a DIFFERENT id and instance
count than the stored key, so a clone this repository had already reviewed is reported again.

**What is diagnosis and what is still unknown.** The duplication half is traced to a mechanism the
config already warns about; it has NOT been reproduced locally, because no `npm run analyze` has
been run on this tree. The complexity half — `renovationSummary.ts`, one function above
threshold — is **not explained at all**: that file is untouched by this branch and by wave 9.
Fallow measures complexity AGAINST COVERAGE, so a coverage change elsewhere can move it; that is a
hypothesis, not a finding.

**Do not "fix" this by relaxing a threshold, widening `ignore`, or deleting a check.** The honest
repair is to re-run `npm run analyze` locally on a quiet box, read what it actually prints, and
update the reviewed-clone KEY to what the report now shows — the same ratchet discipline every
floor here was set by.

**Before anything heavy, check WHAT is running and not just how many**:
`Get-CimInstance Win32_Process -Filter "Name='node.exe'"` shows the command lines. A count alone
did not reveal that another worktree, `renovation-planner-beta-handoff-e80bb5`, was mid-`npm run
check` for most of session seven.

## The thing that was blocking everything is DONE, and it is not what a reader expects

**The live-vault pass was walked by the user, in a real Obsidian vault, on the `test-build` of
`ecae21ab2`.** Runbook §10's condition — *"if tests or an actual Obsidian session cannot be run"* —
no longer holds, and **AD15 is off `blocked`**.

**It is NOT a filled Runs table, and nothing in this repository pretends it is.** The user gave a
whole-surface verdict (*"looks good to me"*) and one named defect. **No individual `obsidian` step
in any of the three cases was confirmed one by one**, and each case's new Runs row says so in its
own words rather than implying otherwise. The stale *"not yet run in a vault"* placeholder in each
was amended rather than deleted, so the correction stays visible.

What WAS answered, because it was asked directly:

| Question | Answer |
|---|---|
| *Calibrate a sheet and reserve space* step 29 — does the clearance-review notice read as belonging to the Clearance block, or as a fourth unnamed block? | **Belonged to Clearance.** The step's other half — whether that first-glance reading changed once the sentence was read — was not answered and stays open |
| The designer at a sidebar leaf's width | **Usable** |
| Is the beta ready? | **"Not ready — keep working."** This is the user's call under §10 and is recorded as given, not interpreted |

Steps 17 and 23, the other two `judgement` steps, were **not put to the user** and stay open.

## The defect the user found, which no gate here could

> *"the preview images for presets look strange as they are inside buttons and overlapping them"*

Real, reproduced, measured, fixed (`fe82a15bf`). `.rp-preset-choice` never overrode Obsidian's own
`button` rule — `height: var(--input-height)` (30px), `flex-direction: row`, `white-space: nowrap`.
Measured in the browser against the real assembled stylesheet and the vendored `obsidian.css`, at a
300px form:

| | before | after |
|---|---|---|
| button height vs a 48px thumbnail | **30px** — the picture hung **9px out, top and bottom**, across the 4px grid gap into the next row | 77px, thumbnail inside on all four sides |
| thumbnail width, short label | 43px / 62px | 116px |
| thumbnail width, `Peninsula worktop with return` | **0px**, label overflowing by 16px | 116px, label wraps |

Three other project buttons already meet that host rule and neutralise it — `.rp-evidence-filters`,
`.rp-evidence-gallery`, `.rp-item-color`'s swatch. The preset choice was the fourth site and the
only one doing nothing.

**Why no gate saw it, and this is the durable lesson:** jsdom computes no layout, so all 20 cases in
`assetPresetForm.test.ts` are green with the fix and without it. `tests/build/buttonBoxNeutralised.test.ts`
therefore checks the DECLARATIONS and says so — a narrower claim than "the thumbnail fits". It was
watched failing on all three declarations. **Its first draft reached NOTHING** while three
assertions passed vacuously underneath, caught by its own non-empty case; the premise was false,
because a CSS selector need not name the element it descends through.

## Wave 8 — two cards, both merged

Two, not three: the hand-off's items 2 and 3 touch the same two files, so they were one card.

| Card | Candidate | Fix round | Integrated |
|---|---|---|---|
| **W8-A** — share the designer sweep vocabulary; close T25's two residual gaps | `ef1ba2dff` | `dded01474` | `160fab6f5` |
| **W8-B** — resolve the container query against the mounted tree | `6d0bb73c1` | `265b3505` | `ced90913c` |

Both test-only. Neither touched `src/`, `styles/` or `docs/`. Disjointness verified on the
fix-round shas as well as the candidates: empty both times.

**W8-B's card premise was wrong and its worker fixed the RESOLVER rather than the sentence.**
Resolving only the width meant retitling the block to `@container rp-other` left all eighteen cases
green while in a browser it had stopped reaching the designer entirely.

**The sharpest finding of the wave**, reasoned by W8-B's reviewer and then MEASURED by its worker:
the mounted guard case is **strictly weaker** than the three-line declaration case beside it.
`hiddenControls` fires only on a rule whose subject contains a focusable control, and
`.rp-designer-canvas` contains none — so `display: none` on the canvas, the worst regression that
layout can suffer, leaves the guard green. Confirmed by adding it in a scratch run.

**Three corrections travelled UPWARD**, which is the part worth keeping: W8-A's worker corrected the
integrator's `SHAPE` census (four, not five — one is a different shape under the same name) and then
corrected its own reviewer with a grep; W8-B's worker corrected the integrator on `CLAUDE.md`, which
led to an unmeasured causal claim being withdrawn (`1e6f37b6c`).

## The gates, and this is NOT how earlier waves closed

**The full local `npm run check` was NOT run, deliberately, and the reason is a finding.** Another
session is running one right now in a different worktree — `renovation-planner-beta-handoff-e80bb5`,
visible as `npm run check` plus an `eslint . --max-warnings 0` at 1.8 GB. Node process count reached
**nine**. CLAUDE.md's own rule covers exactly this: agents working in parallel run `check:fast`, and
the full gate runs **in CI on the pull request**, so there is no local gate to contend with.

What was run, on the integration SHA:

| Check | Result |
|---|---|
| `npx vitest run tests/presentation/designer tests/build/buttonBoxNeutralised.test.ts tests/build/lint-scope.test.ts` | **0 — 67 files, 923 tests**, 212s (against the workers' ~100s, which is the contention) |
| CI `verify`, four legs | **RUNNING** at hand-off time on `e84da5ae2` — run `35467140329`. `audit` and GitGuardian already pass |

**Check `gh pr checks 230` FIRST and treat a red leg as the report to act on.** No coverage figure
was measured this session; do not carry session six's forward as if it were current.

## What the user asked for next, and it is a new body of work

> *"overall it also does not look like the design-concepts I provided in
> `docs/user-experience/renovation-planner-asset-designer-plan`"*
> *"proceed implementing the design when wave 8 and AD15/16 are finished"*

**`reports/AD18-concept-fidelity.md` is the plan and is where to start.** Eight gaps ranked by cost,
each measured against the running harness. It also lists the **ten board elements that are
deliberately absent and correct** — the logo and banner, a second Save button, the library as a
permanent sidebar, the green "fits well" card, fixed clearance numbers, the compass, fixed blue
styling, the freehand icon, the artwork, and board 02's Lock reference step. **Implementing any of
those back would be worse than doing nothing.**

Order, with the two that need no decision first:

1. **Zoom readout.** Confirmed small: `editorStore.viewport` is already in `AssetDesignerRoot.vue`
   for `gridStep`, `StatusBar.vue` has the exact computed (`Math.round(viewport.zoom * 100)`), and
   `designer.status.grid` sits in `en`/`de` `assetSymbols.ts` where `designer.status.zoom` goes.
   One computed, one span, two locale keys.
2. **The restrained header** — AD06 item 1, re-opened. `EditorContextBar.vue` is the pattern.
3. Icon toolbar · 4. Tabbed inspector · 5. Add rail · 6. Canvas proportion · 7. Guided trace.

**Two questions are the user's and are NOT taken**, both flagged in AD18: whether a header restating
the asset name means the inspector stops drawing it (two places answering *"which asset is this"* is
the shape this repository refuses elsewhere), and which inspector tab set to build — **the boards
contradict each other**, three tabs on board 01 and two on board 02.

## AD06 is re-opened, and the reason is a misread citation

`state.json` justified the missing header as *"No header chrome, per C12"*. **C12 says
*"No account, logo, compass or marketing header"*** — a ban on MARKETING chrome, which is the same
thing AD06 item 1's own *"no account/logo chrome"* already excludes. The two documents agree a
restrained header is wanted; the blocker generalised a narrow ban into a total one and the card was
closed on that reading. Status is now `in_progress`; the delivered half (`DesignerInspector.vue`
draws `.rp-designer-asset-name`) stays and is named.

## Carried forward, not taken

- **Move W8-B's declaration case to `designerStyles.test.ts`**, where it needs no DOM. Both the
  reviewer and the worker think it belongs there; the worker's caveat is that it leaves the mounted
  guard as the weaker case standing alone and invites the question of whether that file earns its
  47s. A cost question and a card of its own.
- **A third `held` clone** in `tests/presentation/designer/designerDrawDetails.test.ts`, taking
  pre-converted SCREEN corners. The next lease touching that file should import the rig's `held`.
- **`tools/designerSelectMarquee.test.ts` carries the refuted sentence twice** — its `it.each`
  docblock and that table's label both say `EditorSurface` routes *"a release outside the leaf"* to
  `abandonGesture`. Its CASES are sound; only the third item in each list is wrong. W8-A points at
  it from the other side.
- **The designer harness fixture** (`background: null`, no `clearanceNeedsReview`) — still the
  reason seven `browser` steps and the whole clearance-review block are outside every instrument.
  `tests/harness/assetDesigner.ts`'s header argues the current choice; this is a request to change
  a decision.

## Standing constraints

- `export TEMP=D:/tmp-claude TMP=D:/tmp-claude` before anything that spawns node.
- **Check the box before anything heavy**, and check WHAT is running, not just how many:
  `Get-CimInstance Win32_Process -Filter "Name='node.exe'"` shows the command lines. A count alone
  would not have revealed that another worktree was mid-`npm run check`.
- Workers get narrow `npx vitest run <paths>` only. Never pipe a gate through `tail`.
- Never bare `git stash` — the stack is shared across worktrees.
- Do NOT run `npx playwright install chromium`; it emptied `node_modules` once. **There is no
  pinned Chromium** — `playwright-core` pins 1234, the cache holds 1223, and
  `RP_CHROMIUM_EXECUTABLE` is the sanctioned door with the caveat travelling.
- **`npm run harness-shot -- --width=460` with no entry id is REFUSED**
  (`entryShots.mjs`: *"--width applies to a named entry, and the fixed shots carry their own"*).
  This has now been written down as though it worked twice. CLAUDE.md names both refusals since
  `8be2444de`.
- A scripted edit (sed, python) is invisible to `scripts/lint-edited.mjs`. Lint by hand after one.
- `SendMessage` works; a fix round sent to the card's ORIGINAL worker keeps its whole context. All
  three fix rounds this session went that way.

## What must not be done from here

**Do not label the beta ready** — the user was asked directly and said not ready. **Do not mark
PR #230 ready for review** without asking. Do not tag or publish: AD16 item 5 needs the user's
release authorization, which was sought and refused. AD17 is post-beta and out of scope.
