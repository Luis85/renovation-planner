# Session 3 kickoff — BP-02 slice 2

Paste the block below into a fresh code-capable session. It is self-contained: it assumes no
memory of the sessions that produced BP-00, BP-01 and BP-02 slice 1.

It starts implementation. It does not authorize pushing, merging, tagging, publishing, or
touching a personal vault.

~~~text
Continue the first-beta readiness work on the Renovation Planner Obsidian plugin, subagent-driven.

## Where you are

Worktree (work only here; do not cd to the parent repository):
D:\Projects\renovation-planner\.claude\worktrees\renovation-planner-beta-handoff-e80bb5

Branch renovation-planner-beta-handoff-e80bb5, at ef4e968b6, tree clean, nothing pushed.
origin/main was merged in at e63fd94c9 and may have moved again — check before you start, and
MERGE rather than rebase if it has: every review record and the committed tracker reference this
work by commit SHA, and a rebase would point all of that evidence at commits that no longer exist.

Read first, in this order:
- CLAUDE.md — the binding authority for this repository, above any plan document
- docs/releases/first-beta-readiness/03-execution-tracker.md — what is done, every decision and
  limitation, and the BP-02 section describing the four slices
- docs/releases/first-beta-readiness/01-improvement-plan.md — BP-02's own action list

There is also a working ledger and reconnaissance reports at .superpowers/sdd/01-improvement-plan/
— progress.md plus bp02-lane-{a,b,c}-*.md. That directory is GITIGNORED and exists only inside
this worktree. If it is there, read progress.md and bp02-lane-b-commands.md before anything else;
they carry the census slice 2 is built on. If it is gone, the tracker's BP-02 section carries every
conclusion and the census has to be re-derived.

## What is already done — do not redo it

- BP-00 complete. Every handoff finding reconciled; one refuted, one already fixed.
- BP-01 complete (67f5acf9c..2af92f8fd). An unrecovered-write incident now survives a settings
  rebind, carried as per-leaf view state through Obsidian's own getState/setState.
- BP-11 partial (cec109688, plus corrections inside BP-01's commits). Three stale documentation
  claims closed.
- BP-02 slice 1 complete (81f627b53..92f8f1d31). Six repository compensation paths that silently
  swallowed a half-written vault now stamp markUncompensated.

## Your task: BP-02 slice 2

Four slices were scoped. Slice 1 shipped. Slice 2 is next and is the one that needs a decision
record. Slices 3 and 4 follow it and are described in the tracker.

Slice 2 has four parts:

1. A DECISION RECORD FIRST. ADR-0019 declined extending the sequence-marker mechanism without one,
   and said the mechanism "is not silently repurposed" — it preserves the mechanism and asks only
   that an extension be recorded. Write that record before the code, following this repository's
   own ADR conventions. It must say what an incident's identity IS, who owns it, where it is
   stored, what retires it, and which command families it covers. It must also state plainly what
   is NOT being built: no automatic replay, no rollback journal, no plugin-decided all-clear. Nine
   recorded declinations name exactly those, and slice 2 must not walk into one.

2. AFFECTED-ENTITY-ID IDENTITY. Today UncompensatedWrite is { uncompensatedWrite: true }. A census
   found the correct identity is a vault-scoped set of the entity ids actually left inconsistent,
   gated by set intersection against each write's own affected ids — not per leaf and not per plan,
   because one asset delete implicates requirements and price overrides spanning arbitrarily many
   plans and projects. The census also found every producer has those ids in scope at the raise
   site. Verify that yourself before relying on it.

3. A DURABLE STORE. Do not invent one. SequenceMarkerFileStore already writes a versioned JSON file
   under the plugin directory before the first mutation, refuses the whole operation if that write
   cannot be recorded, marks finished only after the last mutation, and is read cold at load. That
   is most of what BP-02 asks for, built for one command family. Widening it is the job.

4. THE GATE. Four of slice 1's six stamps currently reach no reader — that is limitation L-02 —
   because their dispatching surfaces never call withSaveStateTracking and the Asset Library
   imports no save-state store at all. Closing L-02 is slice 2's user-visible outcome. The nearest
   chokepoint by reach is withBoundary/guardCommand in application/errors/guardAgainstThrowing.ts,
   which every command passes through and which already inspects every failed Result — but it is
   generic over its input and knows no ids. Whether that is the right home is a real design
   question; answer it in the ADR rather than in a commit message.

Also absorb into this slice: relocateEvidence is a genuine partial-write path with NO compensation
at all, found during slice 1 and left untouched because it was outside that slice's shape.

## Rulings already made — apply them, do not re-litigate

- BP-02's durable marker is INSIDE this repository's recorded refusals, established by evidence
  rather than preference: all nine declinations name an automatic replay-rollback journal, which
  BP-02 also refuses. Tracker decision D-07.
- Stamping came before gating deliberately, because a gate protects against incidents that are
  raised, and five of six paths raised nothing.
- D-06: once an incident is session-scoped, only a plugin reload clears it — closing and reopening
  the tab stops working, because that reset was an accident of view-object lifetime rather than
  evidence of repair. It has a real cost to a user and is marked for the release owner. It binds
  slice 4, not slice 2, but read it before designing the identity model, because it constrains what
  "resolved" is allowed to mean.
- L-03: the two gestures that produce a second editor pane on one plan are Obsidian's own
  duplicateLeaf and a restored layout. Neither is simulable in this repository's test fakes, so
  slice 4 will need a manual case. Do not design slice 2 as though the suite can drive that.

## Method

Work subagent-driven. Dispatch fresh subagents per task with precisely constructed briefs; do not
let them inherit your context. Review every task with an independent subagent — spec compliance AND
quality, both verdicts — then a scoped re-review of each fix round. Keep a ledger you append to as
you go, because your own context will not survive the session. Never fix a review finding yourself
in the controller session.

Rule on conflicts, ambiguities and plan defects yourself, and record each decision with what it
costs if wrong. Stop and ask only for something irreversible, security-sensitive, a side effect
outside this worktree, or a plan so broken that every path forward is a guess.

## Constraints

- Keep the layered architecture and the infrastructure-only vault write boundary. infrastructure →
  application is permitted, and ObsidianZoneRepository already imports markUncompensated.
- Never weaken a lint rule, a budget, a coverage threshold, an architecture check or an assertion
  to get a green result.
- A fake must not be kinder, thinner, harsher or faster than the real thing.
- Write the guarantee to the check, never ahead of it. A docblock claiming a count or an "only"
  gets its measurement in the same edit, from an instrument that can see the whole set.
- Do not push, merge, tag, publish, or submit anything. Do not touch another worktree.
- Do not claim native Obsidian, device, screen-reader or performance verification unless you
  actually performed it. Nothing on this branch has been run in a vault.

## Things this project will bite you with — all measured, not guessed

- npm run check is ~200s and contends badly. Use npm run check:fast -- <paths>, and let CI run the
  full gate on the pull request.
- BUT check:fast omits eslint ., which is where file-level budgets live. Slice 1 pushed both locale
  tables over their 400-line max-lines cap and it rode five commits unnoticed. Run npx eslint .
  before believing a branch is green; it takes about 25 seconds.
- Both locale tables sit near that cap. If you add user-facing copy, the fix is extraction into the
  existing en/ and de/ submodules, never a wider budget — en.ts's own docblock says so.
- German copy is Sie-form throughout. A du-form string is a defect; the gate that catches them was
  widened in slice 1 and its remaining blind spots are written into its own docblock.
- A test failure in a contended full run is usually the documented parallelism artifact. Four files
  did it in one session and every one passed alone. Re-run the file, then its whole directory,
  before believing a failure.
- Piping a command into tail makes $? report TAIL's status. Two full-tree runs printed "exited with
  code 0" beside a failing test count. Capture the exit code before the pipe.
- Subagents have twice reported a baseline claim verified against the wrong revision. When one says
  something is pre-existing, measure it against the branch base yourself.

## At the end

Update docs/releases/first-beta-readiness/03-execution-tracker.md — package state, decisions,
limitations, a session log with the exact commands and their outcomes, and one next executable
action. Then report: branch and revision; what slice 2 completed; files changed; exact tests and
outcomes; evidence locations; what is implemented but unverified; native checks still not
performed; every ruling you made and what it costs if wrong; and the single next step.

Do not mark anything released or beta-ready. The go/no-go decision needs the integrated gates in
the plan and explicit release-owner authorization.
~~~
