# Session 4 kickoff — BP-02 slices 3 and 4

Paste the whole of this file as the opening message of a fresh session.

---

Continue the first-beta readiness work on the Renovation Planner Obsidian plugin, subagent-driven.

## Where you are

Worktree (work only here; do not cd to the parent repository):
D:\Projects\renovation-planner\.claude\worktrees\renovation-planner-beta-handoff-e80bb5

Branch `renovation-planner-beta-handoff-e80bb5`, at `eb78a4bd4`, tree clean, nothing pushed.
`origin/main` was merged in at `e63fd94c9` and had not moved as of 2026-09-16 — check before you
start, and **MERGE rather than rebase** if it has: every review record and the committed tracker
reference this work by commit SHA, and a rebase would point all of that evidence at commits that no
longer exist.

Read first, in this order:
- `CLAUDE.md` — the binding authority for this repository, above any plan document
- `docs/development/adrs/0034-a-write-incident-is-durable-and-vault-scoped.md` — slice 2's decision
  record, and the authority for the mechanism both of your slices touch
- `docs/releases/first-beta-readiness/03-execution-tracker.md` — what is done, every decision and
  limitation (**L-01 and L-04 through L-09 all bear on this session**), and the BP-02 section
- `docs/releases/first-beta-readiness/01-improvement-plan.md` — BP-02's own action list

There is also a working ledger and reconnaissance at `.superpowers/sdd/01-improvement-plan/` —
`progress.md` plus the `bp02-slice2-recon-*` and `bp02-slice2-task*-report` files. That directory is
GITIGNORED and exists only inside this worktree. If it is there, read `progress.md`'s SESSION 3
section before anything else; it carries every ruling with its stated cost. If it is gone, the
tracker carries every conclusion and you re-derive the rest.

## What is already done — do not redo it

- BP-00 complete. BP-01 complete. BP-11 partial.
- **BP-02 slice 1** complete (`81f627b53..92f8f1d31`) — six silent compensation paths now stamp.
- **BP-02 slice 2** complete (`4599a388e..f05d5d62f`, plus tracker commits). ADR-0034; the stamp
  carries affected `{kind, id}` entities; a durable `WriteIncident` persists to its own plugin-local
  file; a registry is seeded at load; `guardCommand` refuses every guarded COMMAND while one is
  open and records new ones on the way out; the diagnostics report names the open incidents and the
  file that retires them; `relocateEvidence` stamps a half-landed rename; the user guide describes
  all of it. **L-02 is closed.**

## Your task: BP-02 slices 3 and 4

Two slices. Slice 3 is small, sharp and independent. Slice 4 is larger, needs a manual test case,
and its scope GREW during slice 2. Do 3 first — it is the shorter path to a finished thing, and
slice 4 will want your remaining budget.

### Slice 3 — an unreadable recovery marker must read as UNKNOWN, not as healthy absence

**Correction, 2026-09-17 (BP-02 slice 3): the defect this section describes is fixed, and the
present tense below is the state of the code when this prompt was written, not now.** Nothing is
discarded and there is no `sequence.marker.discarded` log line any more. An entry
`SequenceMarkerFileStore` cannot read is preserved verbatim across every rewrite, reported through
the `unreadable` half of `SequenceMarkerListing`
(`src/application/ports/SequenceMarkerStore.ts`), logged once per load from `list()` as
`sequence.marker.unreadable`, refused rather than answered as an absence by `read()`, and neither
replayed nor cleared by `recoverInterruptedSequences`. The body below is left as it was written —
it is a dated record of what the session was asked to do.

`SequenceMarkerFileStore.readEnvelope` (`src/infrastructure/obsidian/plugin-data/SequenceMarkerFileStore.ts:104`)
tests `shape.schemaVersion === SEQUENCE_MARKER_SCHEMA_VERSION` — bare equality, and therefore
**direction-blind**: a marker written by a FUTURE version is discarded exactly like a corrupt one,
with a `sequence.marker.discarded` log line, and `list()` never returns it. So
`recoverInterruptedSequences` never sees it and a vault mid-rollback presents as a vault with
nothing outstanding.

That is a defect against SDD §87 rule 7 (*fail closed on unsupported schema versions*) and rule 8
(*never present a missing or refused read as zero, empty or "nothing yet"*). It is a bug against a
recorded rule, not a new design claim, so it needs no ADR.

**The pattern to copy already exists in this branch and was reviewed.** `WriteIncidentFileStore`
deliberately treats an unrecognised record as an OPEN incident — never dropped, never rewritten —
and its docblock states why it differs from its sibling. Slice 3 brings the sibling into line. Read
both stores before designing anything.

Two things to decide and record rather than assume:
- What "unknown" MEANS for a sequence marker, which is not the same as for an incident. A sequence
  marker drives a ROLLBACK; an incident only blocks. Answer what `recoverInterruptedSequences`
  should do when it meets a marker it cannot read — it must not replay one it does not understand,
  and it must not silently drop it either.
- Whether the whole-envelope refusal is right. Today one malformed envelope refuses the WHOLE file,
  so a single bad entry blocks recovery of every valid sibling marker that load. Decide whether that
  stays, and say why.

### Slice 4 — the surfaces the gate does not reach

Its scope is three things now, not two:
- **L-01**: a second Plan Editor pane on the same plan is not gated by an open incident.
- The **Asset Designer**'s hard-coded `writesBlocked: () => false`
  (`src/presentation/designer/runtime.ts:395`), which raises incidents into a store nothing reads.
- **L-05, added in slice 2**: `EditZoneDetailsCommand` and `ReversibleRenameZoneCommand` are
  constructed unguarded against the raw repository at `src/presentation/editor/inspector-wiring.ts:99`
  and `:101`, so `guardCommand` never sees them; and
  `src/presentation/editor/runtime.ts:607`'s `writesBlocked` is
  `projectStore.stale || unsafeHistory()`, where `unsafeHistory` (`:606`) reads the PER-LEAF Pinia
  flag rather than the vault-scoped registry. So an incident raised anywhere else in the vault
  leaves those two commands working.

**L-06 is the same family and you must rule on whether it belongs here**: a stamp raised outside a
`guardCommand` call stack never becomes a durable incident at all — `reversible-delete-zone-command.ts`
stamps inside an undo callback dispatched by `CommandHistory` against the raw `commands.zones` port.
ADR-0034 states that as a CATEGORY and records that **nothing checks it**. CLAUDE.md's own rule is
that a category invariant is checked at the forbidden thing, not by listing the places. Building
that check may be slice 4's most valuable single act, or may be its own increment — decide, and
record what it costs if you are wrong.

Roughly fifty presentation modules read `runtime.writesBlocked`, so changing what feeds it is not
the two-line edit it looks like. Measure that yourself before designing.

## Rulings already made — apply them, do not re-litigate

- **D-08 / ADR-0034**: nothing in the plugin retires a write incident. No control, no reload, no
  later successful write. Retirement is the user removing `write-incidents.json` and reloading.
- **D-06**: an incident is cleared only by a plugin reload; closing and reopening a tab does not.
- **The gate is COARSE by decision** — any open incident refuses every guarded command, vault-wide.
  Intersection gating was refused on measured grounds: command inputs share no derivable id field,
  and the recorded affected-id set is knowingly incomplete at three raise sites.
- **L-09**: deleting the incidents file takes effect only after a plugin reload. The copy now says
  so. **This has never been exercised in a vault** — if you get a vault, check it first.

## Method

Work subagent-driven. Dispatch fresh subagents per task with precisely constructed briefs; do not
let them inherit your context. Review every task with an independent subagent — spec compliance AND
quality, both verdicts — then a scoped re-review of each fix round. Keep a ledger you append to as
you go, because your own context will not survive the session. Never fix a review finding yourself
in the controller session.

Note for your dispatches: **`SendMessage` is disabled in this environment**, so a fix round cannot
resume a live implementer. Dispatch a FRESH agent carrying the brief path, the report path and the
findings — the report file is the persistent memory either way.

Also note: the `Explore` agent type **cannot write files**. If you want a reconnaissance report on
disk, either brief a `general-purpose` agent or have the Explore seat return the report and write it
yourself.

Rule on conflicts, ambiguities and plan defects yourself, and record each decision with what it
costs if wrong. Stop and ask only for something irreversible, security-sensitive, a side effect
outside this worktree, or a plan so broken that every path forward is a guess.

## Constraints

- Keep the layered architecture and the infrastructure-only vault write boundary.
- Never weaken a lint rule, a budget, a coverage threshold, an architecture check or an assertion to
  get a green result. **Four files sit at or within a few counted lines of a hard 400-line
  `max-lines` cap**: `composition-root.ts`, `RenovationPlannerPlugin.ts` and both locale tables, and
  `createCompositionRoot` sits at a 100-statement cap. Over a cap means EXTRACT.
- A fake must not be kinder, thinner, harsher or faster than the real thing. **Slice 2 found three
  fake defects, none of them by a gate.** Expect more.
- Write the guarantee to the check. A docblock claiming a count or an "only" gets its measurement in
  the same edit. `DispatchOutcome.ts`'s producer census has now gone stale FIVE times, once inside
  the edit that was fixing the fourth.
- German copy is Sie-form throughout.
- Do not push, merge, tag, publish, or submit anything. Do not touch another worktree.
- Do not claim native Obsidian, device, screen-reader or performance verification unless you
  actually performed it. **Nothing on this branch has ever been run in a vault.**

## Things this project will bite you with — all measured, not guessed

- **`npm run check` is RED on this branch and it is NOT this branch's fault.** Its `analyze` leg
  fails on `origin/main` itself: four clone groups and one health target in files this branch has
  never touched. That is limitation **L-04**, with the measurement. Do not spend a subagent
  re-deriving it, and do not try to fix it — it is separate work on main's own duplication. Tell
  your reviewers not to run `npm run analyze`.
- `npm run check` is also ~200 s and contends badly. Use `npm run check:fast -- <paths>`.
- **BUT `check:fast` omits `eslint .`**, which is where file-level budgets live. Run `npx eslint .`
  (~25 s) before believing a branch is green. A previous slice pushed two locale tables over their
  cap and it rode five commits unnoticed for exactly this reason.
- **Piping a command into `tail` makes `$?` report TAIL's status.** Two full-tree runs in an earlier
  session printed "exited with code 0" beside a failing test count. Capture the exit code first.
- A lone test failure in a contended run is usually the documented parallelism artifact. Re-run the
  file, then its whole directory, before believing it.
- **`sed -i` on prose containing apostrophes, backticks or pipes is the wrong instrument** — it
  silently mangled the tracker in session 3 into a 433-line file starting with a table row. Use a
  script that asserts its anchor is present AND unique, and check `git diff --numstat` afterwards: a
  whole-file rewrite where a surgical edit was intended shows up there immediately.
- **Subagents have reported a baseline claim verified against the wrong revision more than once.**
  When one says something is pre-existing, measure it yourself — and prefer checking the CONTENT of
  a failure against the branch's own file list over re-running a baseline.

## At the end

Update `docs/releases/first-beta-readiness/03-execution-tracker.md` — package state, decisions,
limitations, a session log with the exact commands and their outcomes, and one next executable
action. Then report: branch and revision; what each slice completed; files changed; exact tests and
outcomes; evidence locations; what is implemented but unverified; native checks still not performed;
every ruling you made and what it costs if wrong; and the single next step.

Do not mark anything released or beta-ready. The go/no-go decision needs the integrated gates in the
plan and explicit release-owner authorization.
