# RESUME — session six's hand-off

**Rewritten 2026-09-19, replacing session five's packet wholesale**, for that file's own stated
reason: a hand-off that is appended to goes stale in a way a reader cannot detect.

Branch `renovation-planner-asset-designer-bc5539`, worktree
`D:\Projects\renovation-planner\.claude\worktrees\renovation-planner-asset-designer-bc5539`.
**Nothing has been pushed, merged to `main`, or tagged.** `main` is untouched at `f3a8864a9`.

## Read this first: the one thing that is waiting on a person

**The live-vault pass is with the user, by their own decision, and `npm run test-build` has been
run to prepare it.** Session six asked and the user chose to walk it themselves rather than have an
agent drive Obsidian's GUI. That is the only outstanding item that blocks AD15 and AD16, and no
amount of further agent work changes it.

**Obsidian IS installed on this machine** — `AppData/Local/Obsidian/Obsidian.exe`, checked rather
than assumed. Every earlier hand-off and the `state.json` blocker said otherwise and were wrong; the
blocker is corrected. What no agent here can do is walk a 45-step human case, which is a different
sentence and the true one.

**There is no pinned Chromium.** `playwright-core` pins revision 1234; the cache holds 1223. Every
capture this session cites went through `RP_CHROMIUM_EXECUTABLE` against 1223, which the script
announces is not the pinned build. Read those pictures as approximate.

## The user's walkthrough, already reduced

102 steps across the three cases. **57 are `suite`, and session six discharged 4 more from the
`browser` column, so the user's share is 30** — 28 `obsidian` and 2 `judgement`.

| Case | browser | obsidian | judgement | suite |
|---|---|---|---|---|
| Compose an asset from parts | 8 (4 passed, 1 blocked, 3 not attempted) | 2 | 0 | 28 |
| Calibrate a sheet and reserve space | 7 (all structurally blocked) | 8 | 1 | 20 |
| Take an asset from the library into a plan | 0 | 18 | 1 | 9 |

Each case's own Runs table carries the detail. Two things there are worth knowing before reading it.

**Step 9 of *Compose an asset from parts* passed in full, and it is the step that case says nothing
in this repository can perform.** Real `Tab` and arrow keys in a real browser: Tab walked Calibrate
→ View → the `Bowl` row → the canvas, so the Parts list is ONE tab stop entered once and left once;
`ArrowDown` moved row to row and did NOT wrap at the last; `End` and `Home` jumped; `ArrowUp` did
not wrap at the first; and `tabindex="0"` followed the focused row every time.

**Every `browser` step of *Calibrate a sheet and reserve space* is STRUCTURALLY out of reach, not
merely un-run.** They all need the asset to have a reference sheet, and
`tests/harness/assetDesigner.ts` sets `background: null` deliberately and says so in its own
comments. `?reference` was tried and does nothing — it is a knob on the PLAN EDITOR branch of
`tests/harness/page.ts`, and `mountAssetDesignerHarness` accepts no background at all. Three of
those steps have a second independent blocker: they look at the clearance-review block, and
`grep -rn clearanceNeedsReview tests/harness/` printed nothing on this date, so no fixture sets the
flag and no capture or scan reaches it. **That confirms session five's "sharpest unverified thing"
rather than closing it.**

## What session six did

**Wave 7, three cards, all merged, each reviewed by an agent that did not write it.** Every review
returned APPROVE conditional; every condition was applied in a fix round by the card's own worker
before the merge. Disjointness was verified by intersecting `git diff --name-only` pairwise on both
the candidates and the fix-round shas — empty in all six pairs.

| Card | Candidate | After fix round | Matrix row now |
|---|---|---|---|
| T25 — DOM-level gesture cancellation | `11b9cb6f1` | `416314f7f` | partial, **narrowed** |
| T40 — quantity isolation under a graphic write | `b787021a3` | `90f5b478d` | **passed** |
| T42 — the compact pane, rendered not declared | `8c941c491` | `69775e5e9` | partial, DOM half closed |

Every card was test-only, one new file each. That was the lease's load-bearing clause and it paid:
with `src/` untouched by every worker, no card could move a coverage floor in the wrong direction,
and the three trees could not collide.

Also done, all integrator-owned: the deferred locale key **decided**; `npm audit fix` (2 high to 0,
lockfile only, `package.json` untouched); 117 captures; a stale stylesheet comment corrected; a
stale `src/` docblock corrected; and the `CLAUDE.md` narrowing described below.

## The six gates, on `0e23880a4`

All six exit 0, run serially on a quiet box, coverage before analyze.

| Gate | Result |
|---|---|
| build | 0 |
| oxlint | 0 |
| eslint | 0 |
| test:coverage | 0 — **1055 test files, 11634 tests, 1 skipped, zero failures** |
| analyze | 0 — 0 above threshold, dead files 0 of 1202, dead exports 0 of 2393, MI 86.8 |
| audit | 0 — `--omit=dev`, 0 vulnerabilities |

**Coverage: 99.22 / 98.05 / 99.26 / 99.67 against 99/98/99/98 — byte-identical to session five's,
and that is the expected result rather than a suspicious one.** Branches are 21635/22065, so 430
uncovered and about eleven arms of margin, unchanged. Every card was test-only, so the denominator
could not move; the numerator did not move either, which says the nineteen new tests reached no
previously-uncovered arm. The per-file read on the one `src/` file this session touched
(`designer-select-tool.ts`, a comment) is 0 uncovered branches, functions and statements.

## Four things that were checked and turned out FALSE

Recorded because each was believed by somebody competent, and the pattern is more useful than the
fix.

1. **`npm run harness-shot -- --width=460`, the previous hand-off's own instruction, is REFUSED by
   the script.** `--width` applies to a named entry and the fixed shots carry their own, which
   `scripts/harness-shot.mjs` states in its own comment. The bare invocation is what captures the
   sidebar-width shots, and the fixed table already carried two designer shots at 460. **An
   instruction nobody has run is a plan, not a procedure.**
2. **`state.json`'s AD15/AD16 blocker said "No Obsidian and no pinned Chromium in this
   environment".** Obsidian is installed here. Corrected.
3. **The wave 7 lease table named three worktrees that do not exist.** The wave reused `ad07`,
   `ad08r` and `ad10`. Corrected in place with the correction left visible — a lease naming a tree
   nobody worked in is wave 4's recorded failure in a different costume.
4. **`CLAUDE.md` said `analyze` covers "duplication" without qualification.** It does not look at a
   `*.test.ts` file at all — see the next section. Narrowed.

And one the integrator got wrong about itself: the first draft of `dropMarquee`'s corrected docblock
carried **two figures written before they were measured**, "fifteen slices" for what `git log` dates
to two days and "both press doors" for what is two arms of one `onPointerDown`. Both were caught by
running the measurement the comment was itself an instance of demanding.

## The instrument finding, which outlives this wave

**`npm run analyze`'s duplication check skips every `*.test.ts` file.** The run prints
`skipped 1055 files matching default duplicates ignores`, and on 2026-09-19
`find tests -name "*.test.ts" | wc -l` was exactly **1055**. So `✓ No code duplication found` is a
statement about `src/`, `scripts/` and `tests/helpers/` and not about the suite.

That boundary is precise rather than approximate, and the repository's own history proves the other
side of it: the `stackFoundation` extraction happened *because* fallow reported `vault.ts` and
`fixtureVault.ts` as the largest clone family — and those are helpers, not test files, so fallow
reads them.

**A clone between two `*.test.ts` files is invisible to every gate this repository has,
permanently.** This matters now because T25's reviewer found one: `band`, `selecting`, `SHAPE`,
`FROM`, `TO` and `held` are declared in both `designerCanvasGestureOwnership.test.ts` and
`designerMarqueeCanvas.test.ts`, **36 identical non-trivial lines** measured with `comm -12`, which
is a fifth of the new file. It was left standing deliberately — no gate demands it and the session
was ending — and it is the first item under the next section.

## What is left, in the order it should be done

1. **The user's 30-step live-vault walkthrough.** `npm run test-build` has been run. This is the
   only thing blocking AD15 and AD16.
2. **Factor the 36 duplicated lines into `tests/helpers/designerRig.ts`**, which already exports
   `click`/`move`/`drag`/`tracePolygon` and is the family's existing home. Two gains, not one: one
   definition, and a definition fallow actually scans. Small, and its whole justification is
   measured above.
3. **T25's two named residual gaps.** The `keyDoors.ts` arm of `gestureInFlight()` is not driven —
   only the wheel door is. And nothing asserts what a release outside the leaf actually does, which
   is COMMIT the gesture, because `onPointerDown` calls `setPointerCapture` on both arms.
4. **T42's next card, sketched by its reviewer**: resolve `styles/designer-narrow.css`'s container
   query by hand with `tests/helpers/selectors.ts`'s `stylesheetRules` against the mounted tree's
   class list, and assert no rule reaching a named control declares `display: none` at 520. That
   closes the file's own stated blind spot and is not `designerStyles.test.ts`'s question. It was
   judged larger than wave 7's lease, correctly.
5. **A designer harness fixture that can carry a background and set `clearanceNeedsReview`.** This
   is what would put seven `browser` steps and the clearance-review block inside an instrument at
   all. Weigh it against the fact that `assetDesigner.ts`'s `background: null` is deliberate and
   argued in its own header — this is a request to change a decision, not to fix an omission.

## Standing constraints for the next session

- `export TEMP=D:/tmp-claude TMP=D:/tmp-claude` before anything that spawns node.
- **Check the box before anything heavy**:
  `powershell -NoProfile -Command "(Get-Process node -ErrorAction SilentlyContinue|Measure-Object).Count"`.
  Running a gate into known contention produces a WRONG red, not a slow one; the signature is
  disjoint failure sets.
- The six gates took **~23 minutes** end to end on this box with coverage on, the suite being almost
  all of it. Workers get narrow `npx vitest run <paths>` only.
- Never pipe a gate through `tail`. Write the full log to a file.
- Never bare `git stash` — the stack is shared across worktrees.
- Do NOT run `npx playwright install chromium`; it emptied `node_modules` once.
- A scripted edit (`sed`, python) is invisible to `scripts/lint-edited.mjs`, which hooks only Edit
  and Write. Run `npx oxlint <files>` and `npx eslint <files>` by hand after one — this session did.
- **A bash heredoc carrying python broke once** on quoting in this shell. Writing the script to the
  scratchpad and running it by path is the spelling that works.
- Eight worktrees under `.worktrees/` carry `node_modules` and all are reusable with `git switch -c`
  off a base commit. Wave 7 used `ad07`, `ad08r`, `ad10`.
- `SendMessage` WORKS here, and a fix round sent to the card's original worker keeps its whole
  context. All three of wave 7's fix rounds went that way rather than to fresh agents.

## What must not be done from here

**Do not label the beta ready.** Runbook §10 forbids it until an Obsidian session has been run, and
it has not. AD15 and AD16 remain `blocked`. Do not push, tag or publish: AD16 item 5 requires the
user's release authorization, which was not given and was not sought. AD17 is post-beta and out of
scope.
