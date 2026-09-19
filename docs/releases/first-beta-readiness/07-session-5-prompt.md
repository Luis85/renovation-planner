# Session 5 kickoff — BP-02 slice 4's remaining two parts

Paste the whole of this file as the opening message of a fresh session.

---

Continue the first-beta readiness work on the Renovation Planner Obsidian plugin, subagent-driven.

## Where you are

Worktree (work only here; do not cd to the parent repository):
D:\Projects\renovation-planner\.claude\worktrees\renovation-planner-beta-handoff-e80bb5

Branch `renovation-planner-beta-handoff-e80bb5`, at `1acbfc2a8`, tree clean, **nothing pushed**.
`origin/main` was merged in at `42d07b14a` on 2026-09-17 and stood at `ed5c50b76`. **Check whether
it has moved before you start, and MERGE rather than rebase if it has** — every review record and
the committed tracker reference this work by commit SHA, and a rebase would point all of that
evidence at commits that no longer exist. Measure the file overlap first (`comm -12` over the two
`git diff --name-only` sets); last time it was exactly one file and the merge was known-cheap before
it was run.

Read first, in this order:
- `CLAUDE.md` — the binding authority for this repository, above any plan document
- `docs/development/adrs/0034-a-write-incident-is-durable-and-vault-scoped.md` — the decision record
  for the mechanism both remaining parts touch. **Read its 2026-09-17 corrections**, not only the
  original text: its "single observation point" claim was false and is superseded, and two of its
  stated counts are marked superseded where a reader meets them.
- `docs/releases/first-beta-readiness/03-execution-tracker.md` — what is done, every decision and
  limitation, and the session 4 log. **L-01, L-03, L-04, L-06, L-07, L-10, L-11 and L-12 all bear on
  this session.**
- `docs/releases/first-beta-readiness/01-improvement-plan.md` — BP-02's own action list

**There is a working ledger and a full set of task briefs at `.superpowers/sdd/01-improvement-plan/`.
That directory is GITIGNORED and exists only inside this worktree — it is the only copy.** If it is
there, read `progress.md`'s SESSION 4 section before anything else; it carries every ruling with its
stated cost, and **two of your three tasks are already fully briefed there**. If it is gone, the
tracker carries every conclusion and you re-derive the briefs from section "Your task" below.

## What is already done — do not redo it

- BP-00 complete. BP-01 complete. BP-11 partial.
- **BP-02 slice 1** complete (`81f627b53..92f8f1d31`).
- **BP-02 slice 2** complete (`4599a388e..f05d5d62f`). ADR-0034. **L-02 closed.**
- **BP-02 slice 3** complete (`60a748423..037782ed0`, nine commits across the change and two fix
  rounds). `SequenceMarkerFileStore` was direction-blind on `schemaVersion` AND destroyed the
  unreadable record on the next write. `list()` now answers
  `SequenceMarkerListing { markers, unreadable }`; an unrecognised entry is preserved verbatim,
  never replayed, never cleared; `read()` refuses rather than answering `null`; a `write()` whose id
  collides with an unreadable entry is refused under `sequence.marker-write-blocked`, which has
  mapped copy in both locales. The envelope-level refusal is unchanged and the two-level distinction
  is written down where the next reader would conflate them.
- **BP-02 slice 4, part 1 of 3** complete (`e6cdd914b..2546d88d8`, five commits, three review
  rounds). **L-05 closed**: `EditZoneDetailsCommand` and `ReversibleRenameZoneCommand` now cross
  guarded factories composed in `src/plugin/planEditorDeps.ts`, mirroring `calibratePlan`, with
  BOTH doors of both guarded. `guardCommand` did not enter `presentation/`.

## Your task: BP-02 slice 4's remaining two parts, then L-06

Do them in this order. The first is the highest-value thing left in the package; the third is a
test and a set of document corrections.

### Part A — the second pane and the Asset Designer (closes L-01)

**Brief, already written: `.superpowers/sdd/01-improvement-plan/bp02-slice4-task-scope-brief.md`.**
Read it; it carries the measurements and the rulings. In summary:

The gate each Plan Editor leaf computes is `projectStore.stale || planning.failed.value ||
save.unrecoveredWrite` — three PER-LEAF, per-Pinia facts, none of them the vault-scoped
`WriteIncidentRegistry`. So a second pane on the same plan is not gated by an open incident (L-01),
and `src/presentation/designer/runtime.ts` hard-codes `writesBlocked: () => false` so the Asset
Designer is blind entirely.

**The measured fact that decides the shape: `save-state-store.ts` is SHARED.**
`designer/runtime.ts` imports `useSaveStateStore` from the editor's `save-state/`, same
`defineStore('rp-save-state')`, and each `ItemView` mounts its own Pinia (ADR-004). So seeding that
one store from the registry at setup reaches both surfaces and all 69 read sites without threading
anything through 41 modules.

Three things, and the brief has the detail: seed the store from
`activeWriteIncidentRegistry()?.anyOpen()`; mark the leaf on the gate's own refusal code in
`with-save-state-tracking.ts`, so an already-open pane catches up at its first refused write;
and replace the designer's hard-coded `false` with the store's flag.

### Part B — L-06's check and ADR-0034's corrections

**Brief, already written: `.superpowers/sdd/01-improvement-plan/bp02-slice4-task-l06-brief.md`**,
including a section 7 added after the brief was first written. Read it whole.

A static check of the real category is **not buildable** — measured, not argued:
`guardedServices.ts` reaches 1 of 17 stamping modules by import while `composition-root.ts` reaches
929 files, because the guarded relation is made by wrapping an object at runtime and consumed by
calling a port method. What you are building is the pinned raw-port census in
`tests/plugin/guardCategory.test.ts`, whose own header already names it as the missing second
question, plus the ADR corrections. **It buys "the hole cannot get wider", not "the hole is
closed", and every sentence you write about it must say so.**

## Rulings already made — apply them, do not re-litigate

- **D-08 / ADR-0034**: nothing in the plugin retires a write incident. Retirement is the user
  removing `write-incidents.json` and reloading.
- **D-06**: an incident is cleared only by a plugin reload.
- **The gate is COARSE by decision** — any open incident refuses every guarded command, vault-wide.
- **L-01 is closed by SEEDING the shared store, not by making the registry reactive.** The registry
  notifies nothing; a reader must poll. A pane mounts its own Pinia, so a pane opened while an
  incident is open is gated from its first frame, which is L-01's acceptance line exactly. Ruling R1
  (set, never unset) is untouched: seeding adds a way to START true, never a way to become false.
- **L-06 does NOT get the fix that would actually close it.** Moving the recording into
  `markUncompensated` closes the category by construction and is refused deliberately: it makes a
  pure stamping function effectful, and — the reason that decides it — it widens GATING behaviour
  nobody can verify, since `ConstructionMaterialCommand` RETIRES a stamp rather than re-raising it
  and recording at stamp time would turn that into a vault-wide write block. If you want to reverse
  this, it needs an ADR-0034 amendment and an owner, not a subagent's judgement.
- **No fake that pretends to duplicate a leaf.** `duplicateLeaf` has zero hits in the repository and
  `FakeWorkspace` has no split and no layout restore (L-03). The second-pane gesture gets a MANUAL
  case with an unrun Runs table, not a fake.
- **L-12 is a one-word intent call left for an owner**: the user guide says rename link updates go
  "through guarded Plan writes" while that path uses the raw `PlanRepository` port. "Guarded" may
  have meant "version-checked". Decide it or leave it; do not let a subagent guess.

## Method

Work subagent-driven. Dispatch fresh subagents per task with precisely constructed briefs; do not
let them inherit your context. Review every task with an independent subagent — spec compliance AND
quality, both verdicts — then a scoped re-review of each fix round. Keep a ledger you append to as
you go. **Never fix a review finding yourself in the controller session.**

**Run ONE implementer at a time.** The worktree is shared; two agents editing it produce red nobody
can attribute, and a controller measurement taken while an agent is editing measures nothing at all.

Notes for your dispatches: **`SendMessage` is disabled**, so a fix round cannot resume a live
implementer — dispatch a FRESH agent carrying the brief path, the report path and the findings. The
`Explore` agent type **cannot write files**; brief a `general-purpose` agent if you want a report on
disk.

Rule on conflicts, ambiguities and plan defects yourself, and record each decision with what it
costs if wrong. Stop and ask only for something irreversible, security-sensitive, a side effect
outside this worktree, or a plan so broken that every path forward is a guess.

## Constraints

- Keep the layered architecture and the infrastructure-only vault write boundary.
- Never weaken a lint rule, a budget, a coverage threshold, an architecture check or an assertion to
  get a green result. **Over a cap means EXTRACT** — session 4 did it twice, once at exactly the
  wall (`eslint` reporting `too many lines (463)`), and both times extraction was correct.
- A fake must not be kinder, thinner, harsher or faster than the real thing.
- Write the guarantee to the check, **and make sure the instrument can see the whole of what the
  sentence claims** — session 4 shipped a grep that ran, was quoted, and pointed at the wrong set.
- German copy is Sie-form throughout. **The German minted in session 4 has had no native-speaker
  review**; if you add more, say so.
- Do not push, merge, tag, publish, or submit anything. Do not touch another worktree.
- Do not claim native Obsidian, device, screen-reader or performance verification unless you
  actually performed it. **Nothing on this branch has ever been run in a vault.**

## Things this project will bite you with — all measured, not guessed

- **`npm run check` is RED on this branch and it is NOT this branch's fault.** Its `analyze` leg
  fails on `origin/main` itself — limitation **L-04**, with the measurement. Do not spend a subagent
  re-deriving it and do not try to fix it. Tell your reviewers not to run `npm run analyze`.
- **The coverage floors were measured at `2546d88d8` and all four are MET**: statements 99.21%,
  branches 98.06%, functions 99.24%, lines 99.65% against 99/99/99/98. That run exited **1** on 26
  test failures, **22 of them 5000 ms timeouts over 2363 seconds** against the ~160 `CLAUDE.md`
  records — environmental, attributed by three separate checks. Do not re-derive that; do re-measure
  the floors if you change branch coverage.
- **`C:` reached 0 bytes free during session 4 and every `vitest` invocation failed `ENOSPC`.** The
  remedy that worked: set `TEMP`, `TMP` and `TMPDIR` to `D:/tmp-rp`, with FORWARD slashes —
  backslashes get mangled into a relative path. Nothing reports this before a run fails, and one
  "0 test, no error body" failure was first misdiagnosed as the parallelism artifact because of it.
  **An empty error body is a disk symptom, not a scheduling symptom.**
- **`$?` after a pipe reports the PIPE's status — and so does a trailing `echo`.** Session 4's
  harness reported "exited with code 0" while the captured exit code was 1. Capture into a variable
  and print it; never read the harness's own line.
- A lone test failure in a contended run is usually the documented parallelism artifact. Re-run the
  file, then its whole directory, before believing it. `tests/build/lint-edited.test.ts` produced
  one at 83.7 s red under load and 23.56 s green quiet.
- **`sed -i` on prose is the wrong instrument** — it mangled the tracker in session 3. Use a script
  that asserts its anchor is present AND unique, then check `git diff --numstat`: a whole-file
  rewrite where a surgical edit was intended shows up there immediately.
- **Subagents have reported a baseline claim verified against the wrong revision more than once**,
  and a controller has repeated an unverified claim out of a report. Measure it yourself, and prefer
  checking the CONTENT of a failure against the branch's own file list over re-running a baseline.

## The one lesson session 4 paid four review rounds for

**Three times, a test was written one seam away from the code that decides, and every one was found
only by REVERTING the fix and watching what stayed green — never by adding more tests around the
change.** The worst instance: reverting the two `inspector-wiring.ts` arms, reopening L-05
completely, left **450 files / 3611 tests green, exit 0**. A fourth instance of the same family,
three separate times: a count stated in N places with N−1 updated.

So: **require every implementer and every reviewer to revert the fix and report what stayed green.**
Asking for "a test" is what produced all three.

## At the end

Update `docs/releases/first-beta-readiness/03-execution-tracker.md` — package state, decisions,
limitations, a session log with the exact commands and their outcomes, and one next executable
action. Then report: branch and revision; what each part completed; files changed; exact tests and
outcomes; evidence locations; what is implemented but unverified; native checks still not performed;
every ruling you made and what it costs if wrong; and the single next step.

Do not mark anything released or beta-ready. G1 is still blocked by L-01 until part A lands, and the
go/no-go decision needs the integrated gates in the plan and explicit release-owner authorization.
