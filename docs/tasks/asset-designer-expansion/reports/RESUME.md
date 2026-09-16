# Resume packet — asset-designer expansion

Written 2026-09-16 at the end of the first execution session, per the runbook's §9 rule that an
interrupted run hands over a resume packet rather than a completion claim. Start from
[`prompts/04-RESUME.md`](../prompts/04-RESUME.md) with this file beside it.

## Where the work is

**Branch:** `renovation-planner-asset-designer-bc5539` (a worktree at
`.claude/worktrees/renovation-planner-asset-designer-bc5539`). Nothing has been pushed, merged or
tagged. `main` is untouched.

**Last integration commit:** `116c7ced0`. Seven commits since `f3a8864a9`, in order:

| Commit | Card | What it landed |
|---|---|---|
| `fa51ae88d` | AD00–AD03 | the package itself, the baseline audit, contract revision `r1`, the no-op dimension guard, the five queued write doors |
| `2b296d938` | AD04 | `CurvedPath`, the closed/open `AssetDetail` union, labels, shallow groups, schema v3 |
| `f1cbe86ef` | AD05 | the brand made real, and five consumers taught the difference |
| `e3a9ecc6b` | AD06 | the Inspector names the asset and opens the library |
| `26e68b589` | AD08 | a selected set with a derived primary, two routes in, a count |
| `dd7ca6ed7` | — | what `eslint .` caught that `check:fast` cannot see |
| `116c7ced0` | — | the branches the new model left uncovered |

**Contract revision:** `r1`, accepted. Three conflicts were ruled by the product owner in favour of
the repository's own 2026-09-16 decisions; [`contracts/DECISIONS.md`](../contracts/DECISIONS.md)
carries the table.

## Execution mode, stated because the plan requires it

**Everything was executed serially by one agent.** Nothing was delegated to a subagent. The
runbook's own fallback covers this — *"use the same prompts sequentially when the host offers no
parallel delegation"* — and no report here describes work as delegated.

## Task status

| Card | Status | Note |
|---|---|---|
| AD00 | verified | [`reports/AD00-baseline.md`](AD00-baseline.md) |
| AD01 | verified | `r1` + [`contracts/AD01-SCREEN-STATES.md`](../contracts/AD01-SCREEN-STATES.md) |
| AD02 | integrated | most of it had already shipped before this run; only the no-op guard was outstanding |
| AD03 | integrated | all five bypassing write doors queued |
| AD04 | integrated | [`reports/AD04-model-and-schema.md`](AD04-model-and-schema.md) |
| AD05 | integrated | the AD04 brand was **wrong** and this corrected it; see that commit |
| AD06 | integrated | "Use in plan" deferred to AD13; no header chrome, per C12 |
| AD07 | **not started** | presets/measurements/reference entry paths |
| AD08 | integrated, **partial** | marquee, the overlap chooser and per-part locks are NOT in it |
| AD09–AD14 | **not started** | Parts panel, grouping ops, open-line authoring, reference/clearance, library–designer–plan, historical gating |
| AD15, AD16 | **not startable here** | see the blocker below |
| AD17 | out of scope | post-beta |

No leases are outstanding; one agent held everything.

## The blocker that does not go away with more time

**This environment has no Obsidian and no pinned Chromium.** Runbook §10 is explicit: *"If tests or
an actual Obsidian session cannot be run, hand over implemented work and exact remaining
verification steps, but do not label the beta ready."*

- **Obsidian:** unavailable. `npm run test-build` was never run. Every manual case under
  `docs/tests/` remains unrun, including the ones AD15 needs.
- **Chromium:** the pinned revision (1234) could not be installed — `npm` and `playwright-core` both
  fail on `D:\dev-cache\playwright\__dirlock` ("Unable to update lock within the stale threshold")
  on this loaded machine, and clearing the stale lock did not help. The 119 captures that exist were
  taken with revision 1223 named through `RP_CHROMIUM_EXECUTABLE`, which is the script's one
  sanctioned door and prints its own caveat. **Read those pictures as approximate.**

So AD15 (validate the complete workflow) and AD16 (release decision) cannot be completed from here
whatever else is built. They need a machine with Obsidian and the pinned browser.

## What the gates say on `116c7ced0`

| Command | Result |
|---|---|
| `npm run build` | 0 |
| `npx eslint . --max-warnings 0` | 0 |
| `npx oxlint --deny-warnings` | 0 |
| `npx vue-tsc -noEmit` | 0 |
| `npm run analyze` | 0 |
| `npm run test:coverage` | thresholds met — branches 98.04 (floor 98), statements 99.21, functions 99.24, lines 99.66 |
| `npm run check` end to end | **not green in one run**, and the reason is the machine rather than the tree |
| `npm run audit` | not run |
| Real Obsidian | not run |

**About that last row.** Every `npm run check` and full-suite run on this machine reported a handful
of failures — between 1 and 6 files, a different set each time — and **every one of them passed when
re-run alone**. They are 5-second per-case timeouts: this box has 8 logical cores and was shared
with other agents at ~67% load throughout, and `CLAUDE.md` names exactly this hazard for
`tests/build/`. One measured instance: `lint-edited.test.ts`'s SFC case took 63.8 s against its 60 s
budget in a full run and 8.2 s alone.

**Do not "fix" these by raising a budget.** Re-run the named files alone, or run the gate on a quiet
machine or in CI, which is where `CLAUDE.md` says the full gate belongs anyway.

## Two mistakes this session made, so the next one does not repeat them

1. **A backgrounded gate and a foreground lint at the same time reddened the gate.** Ten cases in
   `tests/build/` failed on a tree with no source change. One heavy command at a time.
2. **`npx playwright install chromium` emptied `node_modules`** (`npm error ECOMPROMISED`), which
   made the next suite run fail with "Cannot find module oxlint" and looked like a source defect.
   `npm ci` restored it. Prefer `node node_modules/playwright-core/cli.js install` — and expect the
   dirlock problem above.

## The next dependency-ready task

**AD07** (presets, measurements and reference setup as first-class entry paths) — its prerequisites
AD02, AD03 and AD06 are all integrated, and it touches files nothing else is mid-way through.

**AD09** (the Parts panel) is the other ready one and is the better choice if the goal is to close
AD08's remainder: the overlap chooser and the find-and-unlock route both need it, and AD10's
grouping actions need its selection surface.

Read [`contracts/AD04-MODEL-EXTENSION.md`](../contracts/AD04-MODEL-EXTENSION.md) before touching the
model: it records what the union is, what the brand does and does not hold, and one rejected design
with the measurement that rejected it.
