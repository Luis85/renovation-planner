# Session 7 — BP-03, subagent-driven

Continue the first-beta readiness work on the Renovation Planner Obsidian plugin,
subagent-driven.

## Where you are

Worktree (work only here; do not `cd` to the parent repository):
`D:\Projects\renovation-planner\.claude\worktrees\renovation-planner-beta-handoff-e80bb5`

Branch `renovation-planner-beta-handoff-e80bb5`, at `3a46e78e6`, tree clean, **nothing pushed**.
`origin/main` stood at `ed5c50b76` and `git merge-base HEAD origin/main` printed the same SHA on
2026-09-18, so main is an ancestor and there was nothing to merge. **Re-check before you start,
and MERGE rather than rebase if it has moved** — every review record and the committed tracker
reference this work by commit SHA, and a rebase would point all of that evidence at commits that
no longer exist. Measure the file overlap first (`comm -12` over the two `git diff --name-only`
sets).

Read first, in this order:

* `CLAUDE.md` — the binding authority for this repository, above any plan document
* `docs/development/adrs/0034-a-write-incident-is-durable-and-vault-scoped.md`, **including
  Amendment 1 (2026-09-18)** — the decision record for the write gate, and the record of the one
  decision session 6 reversed
* `docs/releases/first-beta-readiness/03-execution-tracker.md` — package state, every decision and
  limitation, and the session 6 log
* `docs/releases/first-beta-readiness/01-improvement-plan.md` — **BP-03's action list is this
  session's spec**

There is a working ledger and a full set of task briefs and reports at
`.superpowers/sdd/01-improvement-plan/`. That directory is GITIGNORED and exists only inside this
worktree — it is the only copy. **Read `progress.md`'s SESSION 6 section before anything else**;
it carries every ruling with its stated cost, and two controller errors you should not repeat.

## TASK ZERO — run coverage before you write a line, and this is not optional

**Session 6 changed production code and never measured coverage.** It added
`src/presentation/editor/tools/with-incident-gate.ts`, changed `guardAgainstThrowing.ts` and both
runtimes, and ran only `check:fast`, which omits the coverage floors entirely. The floors are
**99/99/99/98** (statements/functions/lines/branches) and were last measured at `9d08aeed4`, two
commits before any of that landed.

So the first thing this session does is:

```
npm run test:coverage
```

Capture the exit code into a file BEFORE any pipe. Expect roughly 23 minutes. Then:

* If the floors hold, record the four figures and the uncovered-arm COUNTS in the tracker's
  "Baseline full gates" row, superseding the `9d08aeed4` measurement, and move on.
* If a floor is breached, **that is this session's first work item** and it belongs to the
  L-16 change. Count in UNITS, not percentage points — one branch is ~0.035pp, below the
  hundredth the summary prints. Read `coverage-final.json` for the CHANGED FILES rather than
  trusting the threshold, which cannot see a single arm.

Doing this first is what keeps attribution clean. A floor breach discovered after BP-03 has
touched the editor lifecycle is a breach nobody can attribute.

## What is already done — do not redo it

* BP-00 complete. BP-01 complete. BP-11 partial. **BP-02's four slices complete.**
* **L-01** closed for the Plan Editor only. **L-02**, **L-05**, **L-12** closed.
* **L-13 RECLASSIFIED** (2026-09-18), not closed: the Asset Designer's forward writes were
  already refused at every guarded door, with the port proven unwritten. What remained was the
  affordance, which is L-14's accepted shape.
* **L-16 CLOSED** (2026-09-18, `3a46e78e6`, ADR-0034 Amendment 1): undo and redo are refused on
  BOTH surfaces while any incident is open, by `withIncidentGate` reading
  `activeWriteIncidentRegistry()` live at dispatch.
* **L-06 narrowed, not closed.** Do not reopen the fix that would close it — recording inside
  `markUncompensated` is refused in ADR-0034 with its cost, and reversing it needs an ADR
  amendment and an owner, not a subagent.

## Your task — BP-03, "Protect pending edits and commands at lifecycle boundaries"

The plan's action list (`01-improvement-plan.md`, BP-03) is the spec. **Open it with DISCOVERY,
not implementation.** Its own Action 1 is a lifecycle table; build that before anything is
briefed, because the table is what tells you how many implementation chunks there are.

The lifecycle states the plan names: clean idle, unsaved form, pointer preview, command pending,
stale read-back, unresolved incident. The disruptive actions: settings change, perspective
switch, width change, close/reopen, plugin unload.

Four things the plan says that are easy to read past, and each is a trap this repository has
already fallen into in a neighbouring form:

1. **"Drive existing tests first."** Much of this may already hold. Measure what does before
   briefing anything — session 6's whole value came from discovering that the thing the tracker
   said was broken was already working, and that something adjacent was not.
2. **"Use the smallest existing mechanism rather than introducing global draft autosave."** The
   plan explicitly refuses a global mechanism. So does `CLAUDE.md`'s deliberately-absent section's
   posture. A draft-persistence layer nobody asked for is the failure mode here.
3. **Cancellation semantics are the subtle half**: a preview can be cancelled before dispatch; an
   already dispatched command is NOT cancelled merely because its component disappeared. Note
   this now interacts with L-16 — a dispatched command's compensating undo is a write, and the
   write gate refuses undo while an incident is open.
4. **"Do not accidentally promise persistent undo history."** `CommandHistory` is ephemeral and
   per-leaf by design; the acceptance criterion is that nothing in the UI or the docs implies
   otherwise.

**Acceptance (the plan's own):** no hidden write on cancel or reflow; no stale callback mutates a
new context; pending work cannot be reported as saved early; retained text is not moved to
another entity; uncertain outcomes enter recovery rather than showing success.

## Optional, only if BP-03's chunks finish cleanly

* **L-17** — a production docblock family miscounts the asset-design bundle in **eleven sites
  across four files** (the tracker row lists every line). It is prose only, no behaviour, and it
  is NOT a find-and-replace: `ReversibleAssetDesignCommands.ts:63`'s "six doors" geometry list
  omits `setShape`, so it is a wrong GROUPING and repairing it means re-deriving which adapter
  inverts that command. Own task, own review.
* **L-18** — `SetAssetHeightCommand` accepts an absent height and clears the field via
  `Asset.withChanges`. Not reachable today (`height` is a required `number | null` and both call
  sites supply it). Needs a decision on where validation belongs, not a patch.

Do NOT start either on a session's remainder.

## Rulings already made — apply them, do not re-litigate

* **D-08 / ADR-0034:** nothing in the plugin retires a write incident. Retirement is the user
  removing `write-incidents.json` and reloading.
* **D-06:** an incident is cleared only by a plugin reload.
* The gate is **COARSE** by decision — any open incident refuses every guarded command,
  vault-wide.
* **R1 (set, never unset)** is untouched. Seeding adds a way to START true, never to become false.
* **L-14 accepted:** the registry notifies nothing, so an already-open pane catches up at its
  first refused write and a restored leaf seeds clean. A notification mechanism would close both
  halves at once and is its own increment.
* **R-S6-7:** L-16's gate is at the DISPATCHER. An adapter's `undo()` called directly still
  reaches the raw ports; in production every caller goes through `CommandHistory`. That narrower
  sentence is the one ADR-0034 Amendment 1 makes — do not widen it in prose without widening the
  check.
* **The affordance is deliberately not live.** `canUndo`/`canRedo` stay store-backed, because a
  `computed` calling the registry would be read once and cached. A user may press an enabled Undo
  into a paused vault; it will not land.
* **L-03:** no fake that pretends to duplicate a leaf. `duplicateLeaf` has zero hits and
  `FakeWorkspace` has no split and no layout restore. That gesture gets a manual case with an
  unrun Runs table.
* **L-15:** no agent-minted German without native-speaker review. If a change needs copy, say so
  and stop.

## Method

Work subagent-driven. Dispatch fresh subagents per task with precisely constructed briefs; do not
let them inherit your context. Review every task with an independent subagent — spec compliance
AND quality, both verdicts — then a scoped re-review of each fix round. Keep a ledger you append
to as you go. **Never fix a review finding yourself in the controller session.**

**Run ONE implementer at a time.** The worktree is shared; two agents editing it produce red
nobody can attribute, and a controller measurement taken while an agent is editing measures
nothing at all.

`SendMessage` is disabled, so a fix round cannot resume a live implementer — dispatch a FRESH
agent carrying the brief path, the report path and the findings. The `Explore` agent type cannot
write files; brief a `general-purpose` agent if you want a report on disk.

Rule on conflicts, ambiguities and plan defects yourself, and record each decision with what it
costs if wrong. Stop and ask only for something irreversible, security-sensitive, a side effect
outside this worktree, or a plan so broken that every path forward is a guess.

**Put a STOP in any brief whose premise you have not driven yourself.** Session 6's brief did
exactly that and it caught the controller's own reading being wrong; the implementer would
otherwise have built the wrong thing correctly.

## Constraints

* Keep the layered architecture and the infrastructure-only vault write boundary.
* Never weaken a lint rule, a budget, a coverage threshold, an architecture check or an assertion
  to get a green result. Over a cap means EXTRACT.
* A fake must not be kinder, thinner, harsher or faster than the real thing.
* Write the guarantee to the check, and make sure the instrument can see the whole of what the
  sentence claims.
* Do not push, merge, tag, publish, or submit anything. Do not touch another worktree.
* Do not claim native Obsidian, device, screen-reader or performance verification unless you
  actually performed it. **Nothing on this branch has ever been run in a vault.**

## Things this project will bite you with — all measured, not guessed

* **`npm run check` is RED on this branch and it is NOT this branch's fault.** Its `analyze` leg
  fails on `origin/main` itself — limitation L-04, with the measurement. Do not re-derive it, do
  not try to fix it, and tell your reviewers not to run `npm run analyze`.
* **TWO vitest runs contend, and the result is a WRONG red rather than a slow one.** Session 6
  reported 173 failures from a run overlapping another: **157 were `Test timed out in 5000ms`**,
  on a tree whose targeted runs were fully green. Before believing any failure, check whether
  something else was running (`ps -W | grep -ci node`) and re-run on a quiet machine.
* **An interrupted `Agent` dispatch may still have written files.** Session 6's controller told
  the user nothing had run; one dispatch had, and had modified four files. `git status` after any
  interruption, before any measurement. An interruption stops the call, not what the call already
  did.
* **Disk:** `C:` reached 0 bytes free in session 4 and every `vitest` invocation failed `ENOSPC`.
  Set `TEMP`, `TMP` and `TMPDIR` to `D:/tmp-rp` with FORWARD slashes. An empty error body is a
  disk symptom, not a scheduling symptom.
* **`$?` after a pipe reports the PIPE's status — and so does a trailing `echo`.** Capture the
  exit code into a variable or a file BEFORE any pipe, and print that. The harness's own
  completion status is the WRAPPER's, not the command's: session 6 saw a task notification say
  "exit code 0" over a captured `EXIT=1`.
* **Severity 1 is a warning:** `npx eslint <file> --rule max-lines:1` exits 0 with no output. An
  instrument that always succeeds is the same defect as a test that passes for the wrong reason.
* **A lone test failure in a contended run is usually the documented parallelism artifact.**
  Re-run the file, then its whole directory, before believing it.
* **`sed -i` on prose is the wrong instrument** — it mangled the tracker in session 3. Use a
  script that asserts its anchor is present AND unique, then check `git diff --numstat`.
  Beware heredocs too: backticks and quotes in a bash heredoc get interpreted and will silently
  mangle a file. Write the script to a file and run it.
* **A markdown table cell cannot hold an unescaped `|`.** A regex pasted into a tracker row broke
  the table in session 6; spell the alternation out in prose instead.

## The lessons six sessions have paid for

**Revert the fix and report what stayed green.** Session 4 found three tests written one seam away
from the code that decides; the worst left 450 files green with the mechanism fully removed.
Session 5 found the same on the assertion side. Session 6 found it again in work that was
otherwise careful: a test passed only because it performed a refused write between the incident
and the undo — delete that one line and the undo landed. **Asking for "a test" is what produced
all of them.**

**When a sentence claims a set, count the set rather than reading the sentence.** Session 6 was
handed a review naming five sites in two files; the census found eleven in four. Third instance.

**A pin on the spelling of a line is not a pin on its meaning.** `saveStateWiring.test.ts`
asserted `const gated = withStaleGate( tracked ,` by regex and broke when a fourth link wrapped
it, while the invariant it protects was still true. Thirty-six such source-text regex gates remain
(CLAUDE.md's census lists them); if you touch a line one of them pins, re-point it at the call
rather than the assignment.

**A chain traced statically tells you what reads what, and nothing about WHEN.** Session 6's
controller read four files carefully and concluded the Plan Editor's undo was already gated. It
was not: the predicate was a store seeded once, and the sequence that mattered never reached it.
The trace was correct; the timing was never asked about.

## At the end

Update `docs/releases/first-beta-readiness/03-execution-tracker.md` — package state, decisions,
limitations, a session log with the exact commands and their outcomes, and one next executable
action. Then report: branch and revision; what was measured and what it changed; files changed;
exact tests and outcomes; evidence locations; what is implemented but unverified; native checks
still not performed; every ruling you made and what it costs if wrong; and the single next step.

Do not mark anything released or beta-ready. **G1 remains blocked** until BP-03 lands, L-06's
category and L-11's unlisted set are closed or explicitly accepted, and the go/no-go decision
needs the integrated gates in the plan plus explicit release-owner authorization.
