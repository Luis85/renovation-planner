# One-shot brief: implement the locked Plan Editor design, M00–M17, end to end

> **For agentic workers:** this is the PROGRAM brief that sits above the per-increment plans in
> this directory, not an implementation plan itself. It carries no checkbox tasks: each increment
> below produces its own design spec under `docs/superpowers/specs/` and its own wave-structured
> plan beside this file, and those are what `superpowers:subagent-driven-development` executes.
> Read §5 before dispatching anything — the parallelism here is bounded by constraints that turn a
> naive fan-out into a WRONG red rather than a slow one.

**Date:** 2026-09-04
**Scope:** every screen M00–M17 of `docs/user-experience/renovation-planner-editor-specs/`,
`implementation-plan.md`'s Phases 0–12, and checkpoints C3 and C4 of the vertical-slice plan.
**Baseline:** `main` at `5c366737` (PR #67, the trust-path documents). Checkpoint C2 (Add Room) is
in development on an unpushed branch and is fenced off in §2.
**Status:** proposed. Nothing here has been executed.

You are picking up a vertical slice this repository started and left half-built. Your outcome is
the **fully implemented locked editor design** — every screen M00–M17 of
`docs/user-experience/renovation-planner-editor-specs/`, working against real read models and
commands, in a real Obsidian vault, with `npm run check` green and the traceability matrix full.

You are an **orchestrator**. You fan the work out across subagents and worktrees wherever the
dependency graph allows, and you serialize only what §5 says must be serialized. You do not stop
at the first increment. You do not report the program complete until §8's exit conditions all hold
and you have said so with evidence.

---

## 1. Read before you plan anything

Authorities, in this order. Where two disagree, the earlier one wins and the later one is the bug:

1. `docs/development/sdds/obsidian-renovation-planner-SDD.md` — the architecture. It has already
   refused things that look obvious from the code alone.
2. `CLAUDE.md` — the agent guide. Every recurring defect class this repository has paid for is in
   it. Read the plan-editor sections, "Claims, and the checks under them", "Testing", "Gotchas",
   and "Definition of done" before writing a line.
3. `docs/user-experience/renovation-planner-editor-specs/` — the locked design:
   - `README.md` — the ten core principles and the screen index.
   - `screens/M00…M17-*.md` — one contract per screen, each embedding its mockup.
   - `components/component-library.md` — the shared component contracts.
   - `implementation/implementation-plan.md` — Phases 0–12, their screens, tasks, tests and exit
     criteria, plus §4's dependency notes and §9's per-screen Definition of Done.
   - `Renovation Planner — First Vertical Slice Plan and Data-Model Specification.md` — the C0–C4
     checkpoints, the §5 data model, §8's five acceptance scenarios, §12 Definition of Done.
   - `Renovation Planner — Editor Interaction & Mental Model Specification.md` and the UX research
     study beside it.
   - `docs/user-experience/renovation-canvas-concept-interaction-design.md`.
4. `docs/requirements/` — the PBIs. Each screen's behaviour is owned by one or more of them
   (`Plan editor.md`, `Editor foundation.md`, `Spatial creation.md`, `Renovation semantics.md`,
   `Planning depth.md`, `Release hardening.md` and their children). `docs/tasks/` holds the task
   notes those PBIs decompose into — ~200 of them, and they are acceptance criteria, not decoration.
5. `docs/development/consolidation/2026-09-editor-model-consolidation.md` — its §6 lists five model
   ADRs recorded as DEFERRED, each with a first consumer and a trigger. Several of your phases ARE
   those triggers. Accept or re-decide each one where its consumer lands; never build past a
   deferred ADR silently.

Read the three existing plan-editor design specs and their plans before writing your first spec.
They are the house shape, and copying it is cheaper than inventing one.

## 2. Ground truth

Re-derive all of this yourself before acting; a count in a brief is a fact about the moment it was
written, and two of the three facts below moved in the last two days.

**Landed on `main`** — checkpoints C0 and C1 (Phase 0–1 plus parts of 2 and 3):

- The Obsidian-native responsive shell: `ResponsiveEditorShell`, `EditorContextBar`, `PanelRail`,
  the overlay panel and the Inspector drawer, `layoutMode.ts`'s 900/400 thresholds.
- The read path: Floor and Rooms as presentation projections over `Plan` and `Zone`
  (ADR-0016, ADR-0017 — no entity, frontmatter key or schema version moved).
- Select active by default and nothing selected; the old toolbar deleted; Add and Select floating
  over the canvas; `AddMenu.vue`; Calibrate moved to the Reference plan layer's **Set scale**.
- `INSPECTOR_SECTIONS` as a CLOSED union of seven, every member `unavailable` — an unbuilt section
  is a stated absence, never an empty one and never a control that does nothing.

**C2 — Add Room: IN DEVELOPMENT RIGHT NOW, by someone who is not you.**
`docs/superpowers/specs/2026-09-03-plan-editor-add-room-design.md` and
`docs/superpowers/plans/2026-09-03-plan-editor-add-room.md` (71 tasks) are on `main`; the code is
on an unpushed branch elsewhere. **Do not build C2. Do not touch the files it owns** —
`runtime.ts`, `AddMenu.vue`, `PlanEditorRoot.vue`, `NewRoomInspector.vue`,
`TemporaryToolBanner.vue`, the `draw-room` tool and `registerEditorTools.ts`. Your first act is the
prerequisite gate in §3.

**C3 — the trust path: DESIGNED AND PLANNED, MERGED TO `main`** (PR #67, commit `5c366737`).
`docs/superpowers/specs/2026-09-04-plan-editor-trust-path-design.md` and
`docs/superpowers/plans/2026-09-04-plan-editor-trust-path.md` — 16 tasks in three waves, no code.
That plan opens with its own prerequisite gate that STOPS unless the add-room pull request has
merged, because Tasks 5, 8, 9 and 11 edit files C2 is rewriting. Honour it.

**Open review notes:** derive with `grep -l "^status: New" docs/issues/*.md` and read each one
before deciding it is yours. Several are plan-editor's; several belong to other surfaces.

**Never designed:** checkpoint C4 (acceptance) and Phases 5–12 — walls and openings, floor
acquisition and the reference-plan workflow, Existing/Planned semantic state, Work and readiness,
materials, costs, evidence, and the hardening pass. Those are yours to design as well as build.

## 3. First act: the prerequisite gate

```bash
git fetch origin && git checkout main && git pull
gh pr list --state merged --search "plan-editor-add-room" --json number,mergedAt
grep -rn "canCreateRoom" src/presentation/editor/runtime.ts | head -2
grep -rn "'draw-room'" src/presentation/editor/tools/editor-tool.ts | wc -l
```

- **C2 merged** (`canCreateRoom` present, `draw-room` registered): start the program at Increment 1
  below, and run Increments 0 and 2 in parallel with it per §5.
- **C2 not merged:** say so, and start with the work that cannot collide with it — Increment 0
  (the open notes that touch none of C2's files) and the **design fan-out** of Increments 3–11,
  which writes only `docs/`. Re-run this gate before every increment that touches `src/`. Do not
  build C2 yourself and do not "help" by editing its files.

## 4. The program

Run it as a sequence of increments, each designed, planned, built, reviewed and merged. The
increments come from `implementation-plan.md` §5's release increments, with the two designed
checkpoints slotted in:

| # | Increment | Phases | Screens | Depends on |
|---|---|---|---|---|
| 0 | Close the open plan-editor review notes | — | — | nothing |
| 1 | C3 — the trust path (design and plan exist; execute them) | 12 (partial) | M15 | C2 merged |
| 2 | Selection model completion and Inspector routing | 2 | M00, M01, M07, M11 | C2 merged |
| 3 | Precise wall and opening model | 5 | M04, M07 | 2 |
| 4 | Floor acquisition and reference-plan workflow | 6 | M05, M06 | C1 only — can run early |
| 5 | Existing and Planned semantic state | 7 | M08, M09 | 2, 3 |
| 6 | Work and readiness relationships | 8 | M10, M17 | 5 |
| 7 | Materials and geometry-derived quantities | 9 | M12 | 3, 6 |
| 8 | Costs | 10 | M13 | 6, 7 |
| 9 | Evidence integration | 11 | M14 | 2 |
| 10 | C4 — acceptance and release hardening | 12 | all, M16 | everything |

Re-order only where `implementation-plan.md` §4 forces it, and record why in the ledger.

**For each increment, in order:**

1. **Design.** `docs/superpowers/specs/<date>-<slug>-design.md`, in the shape the three existing
   plan-editor specs use: what it delivers; the PBI and `docs/tasks/` table it closes; numbered
   Decisions, each naming the alternative and why it lost; the data and command contracts; the
   acceptance scenarios; what it deliberately does NOT build, with a named trigger for each; and a
   §12 baseline note. Increment 1 already has its spec — read it, do not rewrite it.
2. **Plan.** `superpowers:writing-plans` → `docs/superpowers/plans/<date>-<slug>.md`, organised in
   **waves** exactly as the three existing plans are: a File Structure table naming every file per
   wave, tasks within a wave touching **disjoint files**, waves strictly sequential, and a
   prerequisite gate at the top that STOPS on an unmet dependency. The wave table is what makes
   §5's parallelism safe — a plan whose two tasks name one file is a planning defect, not a merge
   problem.
3. **Execute.** `superpowers:subagent-driven-development`, one subagent per task, fanned out across
   a wave per §5. TDD, each test watched failing **at its assertion** before the code exists — a
   red from a missing selector proves nothing.
4. **Review.** `superpowers:requesting-code-review` (fanned out per §5.4), then
   `superpowers:receiving-code-review`. Expect findings that are sentences promising more than
   their checks deliver — this repository's most common defect, and a real finding.
5. **Gate and merge.** `npm run check` green, alone, in the foreground, on a quiet tree. Then merge
   to the program branch and start the next increment. Never carry a red gate forward.

## 5. Parallelism — how to fan out, and what must stay serial

Use `superpowers:dispatching-parallel-agents`. Dispatch every independent unit in **one message
with multiple tool calls** so they actually run concurrently; a sequence of single-agent messages
is not parallelism.

### 5.1 You are the orchestrator

You do not edit `src/`. You own: the git operations, the branch and worktree layout, the
prerequisite gates, the full `npm run check`, the rulings ledger, and the checkpoint reports. That
separation is what makes the serial constraints in §5.5 enforceable — nobody else is allowed to
start a full gate, so nobody can.

### 5.2 Axis one — design fan-out (the widest, and available immediately)

Increments 2–10 need design specs, and a design spec is a document. Dispatch **one agent per
increment**, concurrently, each writing exactly one file under `docs/superpowers/specs/`. They read
the same authorities and write disjoint paths, so there is no conflict to manage. Do this while C2
is still in flight — it is the whole reason the program does not idle waiting for someone else's
branch.

Two constraints on the fan-out: an increment whose contracts depend on an earlier increment's
Decisions (5 on 3, 7 on 6, 8 on 7) is dispatched only after that spec exists, and every returning
spec is read by you against the ones beside it, because two agents designing sibling surfaces will
invent two vocabularies for one concept unless somebody compares them.

### 5.3 Axis two — within-wave task fan-out (the workhorse)

Inside one increment, a wave's tasks touch disjoint files by construction. Dispatch one subagent
per task in the wave, all in one message. Each subagent:

- works in the shared worktree (disjoint files, so no merge is needed);
- runs `npm run check:fast -- <its own paths>` between edits and **never** the full gate;
- watches its test fail at its assertion, applies its mutation check, and reports the red it saw;
- commits its own task with explicit paths.

You wait for the whole wave, run one full `npm run check`, and only then open the next wave. A wave
boundary is a synchronisation barrier and it is not optional: Wave 2 of every existing plan
explicitly builds on files Wave 1 creates.

**Refuse a wave whose tasks collide.** Before dispatching, read the plan's File Structure table and
check that no file appears under two tasks of the same wave. If one does, split the wave — it is
cheaper than reconciling two agents' edits to one file.

### 5.4 Axis three — review fan-out

A whole-increment review is naturally several independent readings. Dispatch them concurrently, one
agent per dimension, each returning findings rather than edits:

- correctness and the layer/architecture bans;
- tests that cannot fail — vacuous assertions, tests passing on the wrong refusal, tests whose name
  outruns their body, fakes thinner or kinder than the real thing;
- prose against its checks — every docblock, CLAUDE.md paragraph and spec sentence that promises
  more than the code delivers;
- accessibility, i18n (`en`/`de` parity, formal Sie, sentence case) and the user-facing vocabulary
  ban (no Zone, Polygon, Vertex, Scene, Calibrate tool);
- layout, read from captures (§5.5 — captures are serial).

Then apply the findings yourself or in a second fan-out over disjoint files.

### 5.5 What must stay serial — and why a naive fan-out produces a WRONG red rather than a slow one

- **Exactly one `npm run check` on the machine at a time, ever.** Two runs share `coverage/` and
  destroy each other's temp files; the failure prints as `Something removed the coverage directory`
  plus an `ENOENT` on `coverage/.tmp/coverage-N.json`. Twelve ESLint-booting `tests/build/*` files
  contend on top of that and blow their `beforeAll` budget. Only you run the full gate.
- **The full gate needs a QUIET, CLEAN tree** — no other gate-capable process, and nothing holding
  a source mutation. A reviewer mid-mutation makes the tree lie, and the red is indistinguishable
  from a real one until you read that agent's log. Tell every subagent to hold mutations inside its
  own task and to revert before reporting.
- **The tell for contention is BIMODALITY**: a case that runs in ~30 ms timing out at 5006 ms is a
  blocked lock or a starved machine, not a regression. A genuinely load-fragile test degrades
  toward its limit. Re-run serially (`npx vitest run --no-file-parallelism`) before believing any
  `tests/build/` `beforeAll` timeout — serial is the diagnostic, never the remedy, and it costs
  about double.
- **Captures are serial.** `npm run harness-shot` spawns Chromium and writes to a fixed
  `harness-shots/` folder; two concurrent runs collide on filenames and on CPU. Take them yourself,
  one at a time, and READ the PNGs.
- **Coverage floors are a property of the MERGED tree.** Every subagent passing `check:fast` says
  nothing about the floors, because `check:fast` has none. After merging a wave, read
  `coverage/coverage-final.json` for the CHANGED files — the summary percentage cannot see one
  uncovered arm, and the headroom here is about one covered unit on the tight metrics.
- **One `npm run test-build` vault at a time**, and one Obsidian instance driving it.

### 5.6 When to spend a worktree

Same worktree for tasks inside one wave — disjoint files, no merge, no cost. A **separate worktree
under `.worktrees/`** for a genuinely independent increment running beside another (Increment 0
beside a design fan-out; Increment 4, whose only dependency is C1, beside Increment 2). Never two
worktrees editing the same `src/` file, and never a second full gate — the one-gate rule in §5.5 is
machine-wide, not worktree-wide.

`.worktrees/` is inside the repository and gitignored, deliberately: a worktree outside it is
invisible to `git status` and has already stranded uncommitted work here. `.worktrees/**` is in
`eslint.config.mjs`'s global `ignores`; leave it — flat config reads no `.gitignore`, walks into
dot-directories, and a second `tsconfig.json` fails every file with "multiple candidate
TSConfigRootDirs are present".

### 5.7 What every dispatched subagent must be told

Its task, its files, its tests, its wave, the global constraints from §6, and these four:
`check:fast` only; hold and revert your mutations; commit with explicit paths; report the red you
actually saw, at which assertion, and every claim you narrowed. A subagent's report is the only
evidence you will have of work you did not watch.

## 6. Rules that are not negotiable

Every one has already cost this repository a defect; `CLAUDE.md` carries the account.

- **`npm run check` is the definition of done** — build + lint + coverage-thresholded tests +
  fallow, in the FOREGROUND with a 600000 ms timeout. `npm run check:fast [-- paths]` is the inner
  loop and is NOT a smaller definition of done: it omits `eslint .` (the layer bans, the write
  boundary, both text bans) and every coverage floor.
- **Every new function and every new arm ships with the test that reaches it, in the same task.**
  An unreachable guard is not free — restructure so the arm does not exist.
- **Layer bans are lint rules**: `presentation → application → domain → core`;
  `infrastructure → application`; only `plugin/` composes. `presentation/dialogs/` may not import
  `application/`. Nothing outside `infrastructure/` writes to the vault.
- **No user-facing string literal.** Every key lands in `src/presentation/i18n/locales/en/editor.ts`
  AND `de/editor.ts` in the same edit (`de` is `Record<keyof typeof editorEn, string>`, so a
  missing key is a build error). German is formal (Sie) and says *Objekt*, never *Material*.
  English is sentence case — a capitalised word mid-sentence fails the build.
- **No colour literal in `styles/`** — Obsidian variables only. `max-lines` is 400 for every
  `src/**` file and every `styles/*.css` partial. A budget bought back by reformatting is a budget
  already spent — extract instead.
- **No production UI exposes Zone, Polygon, Vertex, Scene or Calibrate tool.** The user-facing
  vocabulary is Room, Wall, Area, Reference plan, Work, Floor (`implementation-plan.md` §9).
- **No fake data in production UI.** Until a domain exists the section is `unavailable` and says so.
  A live control that does nothing is refused by design slice 14's own amendment. A paused control
  is `aria-disabled` with `aria-describedby` naming the reason, never `:disabled`.
- **Anything whose symptom is a measurement no layout engine performs** — spacing, wrapping,
  overflow, alignment, contrast, hit size — is verified by `npm run harness-shot` and by READING
  the PNG. jsdom lays nothing out; ten such defects have reached `main` green. Capture at
  `-- --width=460` too: that is an Obsidian sidebar leaf's real width and it has already hidden a
  defect 1280 could not show. If `scripts/chromium.mjs` cannot find the pinned browser, set
  `RP_CHROMIUM_EXECUTABLE`; a substitute prints its own caveat and its captures are approximate.
- **A fake must not be kinder, thinner, harsher or faster than the real thing.** Widen it in the
  same commit as the code that needed it, and expect the widening to turn existing tests red —
  that redness measures what the fake was concealing.
- **A docblock saying "the only place X" gets a `grep` in the SAME edit**, and the sentence is then
  written from what the grep printed. A number in prose is a dated measurement: date it, or state
  the rule instead.
- **When a fix is a REFUSAL, write the widened mutation and run it. When it is an ORDERING, write
  the partial reordering. When it guards ONE of several gestures, drop the other arms.** Each has
  passed the whole suite here while leaving a defect live.
- **Write files with Write/Edit, never PowerShell** (`Set-Content`/`Out-File` write a BOM and
  `JSON.parse` refuses one). Stage explicit paths; never `git add -A` or `commit -a`.
- Commits end with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`; PR bodies end with
  `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

## 7. Report at each checkpoint

- the increment, its screens, and the PBIs and `docs/tasks/` notes it closed or advanced;
- how it was parallelised — waves, agents per wave, what you refused to fan out and why;
- `npm run check`'s actual output — four coverage figures against four floors, test and file counts,
  bundle size if it moved;
- the captures taken and what READING them showed;
- every claim you narrowed rather than met, with the sentence you wrote in its place;
- every residual left standing, where it is written down, and its trigger;
- every deferred ADR accepted, re-decided, or left deferred.

## 8. Exit conditions — the program is done when all hold

1. Every screen M00–M17 satisfies `implementation-plan.md` §9's per-screen Definition of Done.
2. All five acceptance scenarios of the vertical-slice spec's §8 pass — A (Create Kitchen),
   B (Cancel room creation), C (Reload), D (Write succeeded, refresh failed), E (Native theme
   change) — and its §12 Definition of Done is met item by item.
3. `npm run check` is green on the merged branch, twice, on a quiet tree.
4. Every PBI under the editor epics is ticked in its own document, or its unticked criterion carries
   a dated amendment saying what was WITHDRAWN and why. A criterion that quietly keeps its old
   wording is how the gap between promise and check reopens.
5. Every screen ID appears in the requirement/test traceability matrix Phase 0 asks for.
6. The manual cases under `docs/tests/` this work touches have been RUN in a real vault
   (`npm run test-build`) and their Runs tables say so. An unrun manual case is a plan to find out,
   not a finding — this repository has already shipped an outcome row claiming a walkthrough that
   never happened.
7. `CLAUDE.md` carries what each increment taught, written to what its checks actually deliver.

## 9. When the design and the code disagree

The design set is locked and the SDD is the authority. When a screen asks for something the
architecture refuses, do not build a workaround and do not silently narrow the screen: record a
ruling (what, why, and the cost if it is wrong), amend the screen spec in place with a dated
amendment, and say so in the checkpoint report. Where a Definition of Done item asks for the weaker
design, WITHDRAW it explicitly rather than ticking it over a hole — three increments here have done
exactly that and each is better for it.

When you find a defect outside the increment you are in, write it as a note under `docs/issues/` in
the shape those notes already use, with a `## What closes it` section. Do not fix it inline — and
do not hand it to a parallel agent working a different increment.
