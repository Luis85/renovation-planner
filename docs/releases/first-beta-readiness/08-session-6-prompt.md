# Session 6 kickoff — L-13, and what it turns out to be

Paste the whole of this file as the opening message of a fresh session.

---

Continue the first-beta readiness work on the Renovation Planner Obsidian plugin, subagent-driven.

## Where you are

Worktree (work only here; do not cd to the parent repository):
D:\Projects\renovation-planner\.claude\worktrees\renovation-planner-beta-handoff-e80bb5

Branch `renovation-planner-beta-handoff-e80bb5`, at `35ab0c12d`, tree clean, **nothing pushed**.
`origin/main` stood at `ed5c50b76` and `git merge-base HEAD origin/main` printed the same SHA on
2026-09-17, so main is an ancestor and there was nothing to merge. **Re-check before you start, and
MERGE rather than rebase if it has moved** — every review record and the committed tracker reference
this work by commit SHA, and a rebase would point all of that evidence at commits that no longer
exist. Measure the file overlap first (`comm -12` over the two `git diff --name-only` sets).

Read first, in this order:
- `CLAUDE.md` — the binding authority for this repository, above any plan document
- `docs/development/adrs/0034-a-write-incident-is-durable-and-vault-scoped.md`, **including its
  dated 2026-09-17 corrections** — the decision record for the mechanism this session touches
- `docs/releases/first-beta-readiness/03-execution-tracker.md` — what is done, every decision and
  limitation, and the session 5 log. **L-03, L-04, L-06, L-11, L-12, L-13, L-14 and L-15 all bear
  on this session; L-13 is the subject.**
- `docs/releases/first-beta-readiness/01-improvement-plan.md` — BP-02's and BP-03's action lists

**There is a working ledger and a full set of task briefs at `.superpowers/sdd/01-improvement-plan/`.
That directory is GITIGNORED and exists only inside this worktree — it is the only copy.** Read
`progress.md`'s SESSION 5 section before anything else; it carries every ruling with its stated cost.

## What is already done — do not redo it

- BP-00 complete. BP-01 complete. BP-11 partial.
- **BP-02's four slices are all complete** (`81f627b53..9d08aeed4`). Completing them did **not**
  close the package.
- **L-01 is closed for the Plan Editor only** (`36a4c92f7..4966cbe7b`): the shared `rp-save-state`
  store seeds a vault-pause ref from `activeWriteIncidentRegistry()?.anyOpen()` at setup, and
  `withSaveStateTracking` also marks on the gate's own refusal code, so an already-open pane catches
  up at its first refused write.
- **L-05 closed** (`e6cdd914b..2546d88d8`). **L-02 closed.**
- **L-06 narrowed, not closed** (`e7c24d91b..9d08aeed4`): `tests/plugin/guardCategory.test.ts` pins,
  by exact value, the raw class instances the leaf-side walk reaches. The category is still
  unchecked and the three live sites stay live and stay silent. **Do not reopen the fix that would
  close it** — recording inside `markUncompensated` is refused in ADR-0034 with its cost, and
  reversing it needs an ADR amendment and an owner, not a subagent.

## Your task

### Part A — measure what L-13 actually is, before anything is built

L-13 says the Asset Designer is not gated by an open write incident at all, and the tracker records
it as G1's only remaining blocker. **The evidence behind that row is one grep**:
`grep -rn "writesBlocked()" src/` returns call sites only under `src/presentation/editor/`, so the
correct value `designer/runtime.ts:437` now supplies is read by nothing on that surface.

**Hypothesis to test first, because it changes what the session builds and what G1 needs:**
`src/plugin/guardedServices.ts` composes the designer's commands through `guardBothDoors`, and the
single vault gate lives inside `guardCommand`. If that holds, an open incident **already refuses**
every Asset Designer write at the command, and L-13 is a **feedback** gap — enabled controls that
refuse on use — rather than a data-safety hole. That is the same shape as L-14, which is already
accepted.

Measure it; do not assume it, and do not accept a subagent's report of it. The tracker records two
controller errors of exactly this family: a reconnaissance claim nobody re-ran survived a brief, an
implementation and a report before an outside reviewer ran one grep. The instrument is a test that
dispatches a real designer command with an incident open and asserts the refusal, plus the same test
with the gate removed watched staying green or going red.

Then take the branch the measurement supports:

- **If designer writes are already refused:** L-13 is reclassified, with the measurement written
  into the tracker row and into ADR-0034 if that record names it wrongly. What is left is UI
  feedback — the paused notice and disabled controls the Plan Editor draws — which is an increment
  with a real cost on a surface nothing has run in a vault. Scope it, do not necessarily build it,
  and say plainly what G1 then needs.
- **If they are not refused:** that is a data-safety hole and it is this session's whole subject.
  Gate at the command seam, the way every other surface is gated — not by teaching the designer's
  tool framework to poll.

Either way the row must end the session saying what was measured rather than what was assumed.

### Part B — the two owner calls, if and only if an owner answers

- **L-12** is a one-word intent call: the user guide says rename link updates go "through guarded
  Plan writes" while that path uses the raw `PlanRepository` port. "Guarded" may have meant
  "version-checked". Decide it with the owner or leave it. **Do not let a subagent guess.**
- **L-15** is three locale strings describing a vault-wide pause as this surface's own. Wrong
  emphasis, not wrong information. Fold into the next copy pass; any fix mints German that would be
  an agent's with no native-speaker review, and that must be said where it lands.

### Part C — only if A finishes and G1's answer is clear

BP-03 (protect drafts and in-flight commands) is the next P0 and the last package before G1's
verification. Open it with discovery, not implementation; do not start it on a session's remainder.

## Rulings already made — apply them, do not re-litigate

- **D-08 / ADR-0034**: nothing in the plugin retires a write incident. Retirement is the user
  removing `write-incidents.json` and reloading.
- **D-06**: an incident is cleared only by a plugin reload.
- **The gate is COARSE by decision** — any open incident refuses every guarded command, vault-wide.
- **R1 (set, never unset) is untouched.** Seeding adds a way to START true, never a way to become
  false.
- **L-14 is accepted scope**: the registry notifies nothing, so an already-open pane catches up at
  its first refused write, and a leaf restored with the workspace seeds clean. A notification
  mechanism would close both halves at once and is its own increment.
- **No fake that pretends to duplicate a leaf** (L-03). `duplicateLeaf` has zero hits and
  `FakeWorkspace` has no split and no layout restore. That gesture gets a manual case with an unrun
  Runs table.

## Method

Work subagent-driven. Dispatch fresh subagents per task with precisely constructed briefs; do not
let them inherit your context. Review every task with an independent subagent — spec compliance AND
quality, both verdicts — then a scoped re-review of each fix round. Keep a ledger you append to as
you go. **Never fix a review finding yourself in the controller session.**

**Run ONE implementer at a time.** The worktree is shared; two agents editing it produce red nobody
can attribute, and a controller measurement taken while an agent is editing measures nothing at all.

**`SendMessage` is disabled**, so a fix round cannot resume a live implementer — dispatch a FRESH
agent carrying the brief path, the report path and the findings. The `Explore` agent type **cannot
write files**; brief a `general-purpose` agent if you want a report on disk.

Rule on conflicts, ambiguities and plan defects yourself, and record each decision with what it
costs if wrong. Stop and ask only for something irreversible, security-sensitive, a side effect
outside this worktree, or a plan so broken that every path forward is a guess.

## Constraints

- Keep the layered architecture and the infrastructure-only vault write boundary.
- Never weaken a lint rule, a budget, a coverage threshold, an architecture check or an assertion to
  get a green result. **Over a cap means EXTRACT.**
- A fake must not be kinder, thinner, harsher or faster than the real thing.
- Write the guarantee to the check, **and make sure the instrument can see the whole of what the
  sentence claims.**
- German copy is Sie-form throughout, and the German minted on this branch has had **no
  native-speaker review**; say so if you add more.
- Do not push, merge, tag, publish, or submit anything. Do not touch another worktree.
- Do not claim native Obsidian, device, screen-reader or performance verification unless you
  actually performed it. **Nothing on this branch has ever been run in a vault.**

## Things this project will bite you with — all measured, not guessed

- **`npm run check` is RED on this branch and it is NOT this branch's fault.** Its `analyze` leg
  fails on `origin/main` itself — limitation **L-04**, with the measurement. Do not re-derive it,
  do not try to fix it, and tell your reviewers not to run `npm run analyze`.
- **The coverage floors were measured at `9d08aeed4` and all four are MET**: statements 99.21%,
  branches 98.08%, functions 99.27%, lines 99.65% against 99/99/99/98, exit 0 over 1035 files in
  1410.87 s. Counted in UNITS: uncovered arms are 225 / 410 / 61 / 72. Re-measure only if you change
  branch coverage.
- **Disk:** `C:` reached 0 bytes free in session 4 and every `vitest` invocation failed `ENOSPC`.
  Set `TEMP`, `TMP` and `TMPDIR` to `D:/tmp-rp` with FORWARD slashes. **An empty error body is a
  disk symptom, not a scheduling symptom.**
- **`$?` after a pipe reports the PIPE's status — and so does a trailing `echo`.** Capture the exit
  code into a variable or a file BEFORE any pipe, and print that; never read the harness's own line.
- **Severity 1 is a warning**: `npx eslint <file> --rule max-lines:1` exits 0 with no output. A
  session already handed that instrument down in two briefs. An instrument that always succeeds is
  the same defect as a test that passes for the wrong reason.
- A lone test failure in a contended run is usually the documented parallelism artifact. Re-run the
  file, then its whole directory, before believing it.
- **`sed -i` on prose is the wrong instrument** — it mangled the tracker in session 3. Use a script
  that asserts its anchor is present AND unique, then check `git diff --numstat`.
- **Subagents have reported a baseline claim verified against the wrong revision more than once**,
  and a controller has repeated an unverified claim out of a report.

## The lesson five sessions have paid for, in its two faces

**Revert the fix and report what stayed green.** Session 4 found three tests written one seam away
from the code that decides, every one caught only that way — the worst left 450 files / 3611 tests
green with L-05 fully reopened. Session 5 found the same thing on the assertion side: a negative
assertion, and a case whose setup was never itself asserted, each passed with the mechanism under
them fully removed. Asking for "a test" is what produced all of them.

**And when a sentence claims a set, count the set rather than reading the sentence.** Session 5's
final round was told a reviewer's list is a reading and not a census, and its own sweep found the
falsehood in three homes where the reviewer had named one.

## At the end

Update `docs/releases/first-beta-readiness/03-execution-tracker.md` — package state, decisions,
limitations (L-13 reclassified or closed, with the measurement, not the assumption), a session log
with the exact commands and their outcomes, and one next executable action. Then report: branch and
revision; what was measured and what it changed; files changed; exact tests and outcomes; evidence
locations; what is implemented but unverified; native checks still not performed; every ruling you
made and what it costs if wrong; and the single next step.

Do not mark anything released or beta-ready. G1 remains blocked until L-13 is closed **or explicitly
accepted by a release owner**, BP-03 remains, and the go/no-go decision needs the integrated gates in
the plan and explicit release-owner authorization.
