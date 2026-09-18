# RESUME — session five's hand-off

**Rewritten 2026-09-18, replacing session four's packet wholesale**, for that file's own stated
reason: a hand-off that is appended to goes stale in a way a reader cannot detect.

Branch `renovation-planner-asset-designer-bc5539`, worktree
`D:\Projects\renovation-planner\.claude\worktrees\renovation-planner-asset-designer-bc5539`.
**Nothing has been pushed, merged to `main`, or tagged.** `main` is untouched at `f3a8864a9`.

## Read this first: there is no code obligation left in this package

**Every acceptance criterion AD00–AD14 states is now met.** The two that were outstanding when this
session started are closed:

- **AD13 criterion 3** — ruled as **AD13-R1** and then built. The designer draws a usage scope.
- **AD07 item 3** — the optional descriptive height at creation. Its deferral carried a trigger
  only an orchestrator could fire, and this session fired it.

What remains is **entirely environmental**, and no amount of further work in this environment
changes it. Do not go looking for a card to write.

## What is left, in the order it should be done

1. **Open the plugin in Obsidian** (`npm run test-build`) and walk the three manual cases this
   session wrote: `docs/tests/cases/Compose an asset from parts.md`,
   `Calibrate a sheet and reserve space.md`, `Take an asset from the library into a plan.md`.
   102 steps; 57 are marked `suite` and each names the test it stands on, so a human's time belongs
   on the other 45.
2. **Capture at 460 px**, which is the width an Obsidian sidebar leaf actually has and the one that
   has already hidden a layout defect here that 1280 could not show:
   `npm run harness-shot -- --width=460`. **Start at the clearance-review block** — the reason is
   in the next section.
3. **Decide the one deferred locale key** — a designer-owned impact sentence, with its measured
   homes already recorded in `execution/INTEGRATION-QUEUE.md`. Whoever can SEE the panel is better
   placed to decide whether it needs a second sentence than anyone writing blind.
4. **Close the three thinnest matrix rows** (T25, T40, T42) — named in
   `reports/AD15-validation-matrix.md` with their gaps.
5. **`npm audit fix`** — a lockfile-only change, deliberately not made while three worktrees shared
   this branch. Production is already clean.

**Only after 1 and 2** can AD15 and AD16 move off `blocked`, and only then may anyone consider
whether the beta is ready. **It is not ready now and this session did not label it so** (runbook
§10).

## The sharpest unverified thing, and it should be looked at first

`DesignerClearanceReview.vue` draws a `<section class="rp-designer-clearance">` **directly beneath**
`DesignerClearanceHelper.vue`'s section of the **same class**. That class carries
`border-top: 1px solid var(--background-modifier-border)` in `styles/designer-selection.css`, so two
bordered blocks stack — and **the lower one has no heading of its own**, while carrying the longest
sentence in the designer Inspector.

**No accessibility scan reaches it.** `grep -rn clearanceNeedsReview tests/harness/` prints nothing:
it draws only when the flag is set and no harness fixture sets one, so its `role="status"` live
region and its button's accessible name have been graded by nothing.

Both halves of that were measured this session, not inherited. `Calibrate a sheet and reserve
space.md` carries the steps, including a `judgement` step that asks for prose rather than a verdict,
because whether the notice reads as belonging to the block above it is a question no instrument
settles.

**The second thing to look at** is the new designer usage block's own position: the reviewer's
stated residual concern is that at a sidebar's width it may push the asset's dimensions and its
three action buttons down by up to six lines. Unmeasured.

## What this session did

**Wave 6, two cards, both integrated, each reviewed by an agent that did not write it.**

| Card | Candidate | Integrated | Review |
|---|---|---|---|
| AD13-C3 — the designer's usage scope | `3f73023d0` | `87a31c1d5`, CRs at `ea9215053` | APPROVE, conditional on 3 |
| AD07-H — the height at creation | `6b6e42087` | `0cd6504b8`, CRs at `f43b84ff2` | APPROVE, conditional on 5 |

Both cut from `f947d8079`, a commit that **contains** their lease table — wave 4's recorded failure,
fixed. Disjointness verified by intersecting `git diff --name-only`, not by intention: empty.

**Ruling AD13-R1** was made before either card was dispatched, as the runbook requires.

**Documentation and evidence**, all of which needed no host:

- `docs/using-asset-designer.md` — 365 lines, AD16 item 4, written from the code.
- `reports/AD15-validation-matrix.md` — all 42 behaviour rows, 12 fixtures, 6 scenarios and 7
  performance targets graded. **21 passed, 20 partial, 1 structural.**
- `reports/AD16-release-preparation.md` — the filled release checklist, decision **blocked**.
- Three manual cases, and the suite's step census re-run with its own greps: **505 steps, 47 cases.**
- Seven `CHANGELOG.md` entries — AD09 through AD14 and the queue card had **none at all**.
- A section in `docs/development/agent-guide-increment-history.md`, which is AD16 item 6.

## Five claims that were checked and turned out FALSE

Recorded because each was believed by somebody competent, and the pattern is more useful than the
individual fixes.

1. **Ruling AD13-R1 named a control that does not exist** — *"Edit shared asset"*. The shipped
   string is **"Open in designer"**. The integrator had carried the label from a withdrawal note
   describing the door that was proposed rather than the one that shipped.
2. **`AssetGeometryStore.ts` said the schema knows versions 1 and 2.** It knows 1 through 4.
3. **`DesignerUsePlan.vue` claimed in two paragraphs that the asset hand-off's sender did not
   exist.** It landed at `4521f6acf`, in the previous session.
4. **A survey reported NONE FOUND for C11's capability gating.** `assetCapabilityClaims.test.ts`
   exists and is good; the word "frozen" sits in a `describe` rather than in a case title. **A grep
   over test titles is not a census of tests.**
5. **`DesignerUsageScope.vue` said a grep printed one line when it printed two** — the second being
   that sentence. Caught by review. The invariant held; the sentence did not.

And one the integrator got wrong about itself: **the AD15 report's grade tally was written before it
was counted and was wrong in all four figures**, inside the report about checking things. Corrected
from a mechanical count, in the open.

## Gates

**The authority is the Executed checks table in `reports/AD16-release-preparation.md`, not this
paragraph** — it carries the exit codes and the SHA each gate ran on. No SHA is repeated here,
because a commit that records a gate run cannot contain its own SHA and that line has gone stale in
this file before.

**All six exited 0 on the final SHA**, run serially on a quiet box, coverage before analyze because
analyze reads the map the suite writes: **1052 test files, 11615 tests, 1 skipped, zero failures**,
**99.22 / 98.05 / 99.26 / 99.67** against floors 99/98/99/98, and analyze clean with 0 dead exports
of 2393 and 0 complexity findings above threshold.

**`analyze` failed first, and how it failed is the part worth carrying.** One finding above
threshold — `DesignerUsageScope.vue`'s template at cognitive 18 — factored into
`DesignerUsagePlans.vue` rather than suppressed. But its failure line named
`src/presentation/editor/renovation/renovationSummary.ts`, a file this branch never touched: that
name comes from the pre-existing 53-entry refactoring-target list, not from the finding that failed
the gate. **A tool's summary line is not its finding.**

**The per-file coverage read found nothing, which is the good outcome and still had to be done.**
Every file this wave changed has zero uncovered branches, functions and statements. Branches sit at
98.05% against a 98 floor — 430 uncovered of 22065, so roughly **eleven arms of margin** for the
whole repository. The next card has very little room.

`npm audit`: **2 high**, both reaching only through `eslint-plugin-obsidianmd`'s dev tree.
`npm audit --omit=dev` reports **0 vulnerabilities** — nothing in the shipped bundle.

## Standing constraints for the next session

- `export TEMP=D:/tmp-claude TMP=D:/tmp-claude` before anything that spawns node.
- **Check the box before anything heavy**:
  `powershell -NoProfile -Command "(Get-Process node -ErrorAction SilentlyContinue|Measure-Object).Count"`.
  This session waited rather than running a coverage leg into another session's — running a gate
  into known contention produces a WRONG red, not a slow one, and the signature is **disjoint
  failure sets**.
- Never pipe a gate through `tail`. One real assertion failure hid behind exactly that.
- Never bare `git stash` — the stack is shared across worktrees.
- Do NOT run `npx playwright install chromium`; it emptied `node_modules` once.
- A scripted edit (`sed`, python) is invisible to `scripts/lint-edited.mjs`, which hooks only Edit
  and Write. Run `npx oxlint <files>` and `npx eslint <files>` by hand after one — this session did,
  twice.
- `.worktrees/ad13c` and `.worktrees/ad14` hold wave 6's branches and carry `node_modules`. Reuse
  one with `git switch -c` rather than copying.

## What must not be done from here

**Do not label the beta ready.** Runbook §10 forbids it where an Obsidian session cannot be run, and
it cannot be run here. Do not push, tag or publish: AD16 item 5 requires the user's release
authorization, which was not given and was not sought. AD17 is post-beta and out of scope.
