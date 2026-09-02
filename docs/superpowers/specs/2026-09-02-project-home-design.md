# Project Home — section navigation and an Overview backed by what exists

**Date:** 2026-09-02
**Slice document:** none yet. This document is the specification until a
`docs/tasks/NN-project-home.md` exists; where the two later disagree, the slice document is
the authority and this one is the earlier measurement.
**Baseline:** `main` at `5702f28` (the asset designer's first increment, PR 43).
**Parent requirement:** [[The project surface]], the MVP subset of
[[Project dashboard and navigation]].
**Sources:** Workspace UXD §7 (navigation model), §10 (Project Home journey), §22
(progressive disclosure); Prototype design spec §10 (routing contract), §A.10 (Project Home
wireframe); editor implementation plan §3 (no hard-coded counts in production UI).

## Why this, and why now

Design slice 21 gave the Renovation Project pane a detail state: one project, its status, an
`Open note` action, a way back, and its plans. It is one flat screen. The workspace UXD asks
for that project to be a **place with sections** — Overview, Spaces, Design, Work, Budget,
Schedule, Documentation (§7) — and the prototype spec's routing contract (§10) asks that a
section be restorable.

The second reason is sharper than the navigation. Slice 10 closed the loop
`Zone Geometry → Area → Requirement → Cost`, and **the only surface in the entire plugin that
shows a cost is the Plan Editor's Inspector, one requirement at a time.** A renovator cannot
ask what their project costs. Project Home's Overview is the first surface that answers it,
which makes this increment the payoff of slice 10 rather than only a navigation frame.

## Why it is parallel-safe

The Plan Editor redesign (`docs/user-experience/renovation-planner-editor-specs/`, Phases
0–9) works in `presentation/editor/` and expands the spatial domain — Zone becomes
Room/Wall/Opening. This increment works in `presentation/views/`, adds one query and adds one
optional parameter to another.

The overlap is confined to `en.ts`/`de.ts`, `styles/index.css`, `composition-root.ts`,
`errorSurfacePolicy`'s origin table and `CLAUDE.md`. Every one of those is append-shaped: a
textual merge, not a design collision.

**What would NOT have been parallel-safe, recorded so it is not attempted next:** anything
under *Spaces*. The Property → Building → Floor → Room hierarchy is exactly what editor
Phases 5–6 redefine, and two branches inventing `Room` independently is the one collision
that costs a rewrite rather than a merge.

## Scope

Built:

- Section navigation over Obsidian's own view state, with the pane's back and forward arrows
  walking sections as they already walk projects.
- **Overview** — status, dates, currency, plan count, zone count, requirement count, and the
  project's aggregated estimated cost with an honest qualifier.
- **Design** — slice 21's plan list and `New plan` form, unchanged, now with an address.

Declared and not built: Spaces, Work, Budget, Schedule, Documentation.

## Decision 1 — the section lives in the view state, and a navigation remounts

The view's state key goes from `{ projectId }` to `{ projectId, section }`.

Three designs were weighed:

| | Restorable | Back arrow walks it | Staleness | Cost |
|---|---|---|---|---|
| **View state + remount** (taken) | yes | yes | unrepresentable | re-reads the project per section switch |
| View state, no remount | yes | yes | needs a reactive `section` in the view context | one read per project |
| Local `ref`, not in view state | no | no | local | cheapest |

**Taken: view state plus remount**, which is slice 21's mechanism one key wider rather than a
second mechanism beside it. `ProjectDetailState` is built from the state it draws, so no
component can hold a section that disagrees with the view's — the property slice 21 bought by
remounting, kept rather than traded.

The rejected middle option is the close one and its price is named rather than implied: it
needs a reactive `section` in `RenovationProjectContext`, which slice 21 refused on the
record — *"the first reactive member any view context in this plugin carries, and a second way
a tree here learns its subject changed"*. It buys fewer reads, and sections switch far more
often than projects do, so **this is a real bill and not a theoretical one**. If a measurement
later shows the re-read is felt, that option is where to go, and the reason it was not taken
first is written here so the next author is choosing rather than discovering.

The local-`ref` option fails §10 outright: a section that is not restorable is not a route.

### Parsing

`projectIdFrom` becomes `viewStateFrom` and keeps its three-way discipline:

- `projectId` unchanged — `''` is the LIST (a state, not an absence) and a non-string refuses
  the whole state, per slice 21's own reasoning.
- `section` is read only when a project is open. An unknown or absent value resolves to
  `'overview'` rather than refusing. Two real inputs land there: a layout written before this
  increment carries no `section` key at all, and a layout written by a LATER build may carry
  `'budget'`. Refusing would leave such a leaf drawing nothing.
- The list state carries no section, so `{ projectId: '', section: 'design' }` normalises to
  the list. One state, one meaning.

**The asymmetry with `projectId` is deliberate and is the point.** An unrecognised project id
refuses because the conservative answer is to go on drawing what is drawn; an unrecognised
section falls back because Overview is always a truthful answer for a project that exists.

### History

`setState`'s guard widens from `parsed.projectId !== this.projectId` to *either field
changed*. Overview→Design is one history entry; a restore that changes nothing records none,
which is the rule slice 21 already states — an unconditional assignment claims a navigation
where there is none.

### Which sections exist

`SECTIONS = ['overview', 'design']` — the built ones, and the only thing the nav renders. The
five unbuilt sections are **hidden rather than disabled**: the repository's own rule from
slice 14 is that a surface renders no control rather than a live one that does nothing, and a
disabled nav item is precisely that control. A section becomes reachable by being added to
this list once its domain exists.

The parse accepts any string and falls back, so hiding a section never strands a leaf.

## Decision 2 — the summary delegates its rows rather than re-deriving them

One new query, `GetProjectSummary`, guarded at the composition root like every other. It
walks:

```text
ListPlansByProject(projectId)      -> plans, unreadable
  FindZonesByPlan(planId)          -> zones                     (per plan)
    GetRequirementsForZone(zoneId) -> RequirementInspectorDTO[]  (per zone)
```

**It calls `GetRequirementsForZone` rather than re-deriving a row.** That query owns the
staleness reading — the persisted marker, a `calculatedFrom` mismatch, a missing target — and
the currency increment recorded exactly what a second derivation costs: `inputsStillMatch`
hand-spelled the three comparisons `assetMatchesCalculatedFrom` already made, so a field added
to one would have left the other comparing the old three. Delegating makes the project total
and the Inspector row unable to disagree about whether a figure is stale, **by construction
rather than by care**.

### The memo

`GetRequirementsForZone.execute` gains an optional currency memo parameter. It already threads
`Map<ProjectId, Currency | null>` through `projectCurrency` as an argument; it is simply built
per-`execute` today. Passing one memo across the whole walk keeps the project read at **one**
rather than one per zone. An absent memo means "scoped to this call", which is today's exact
behaviour, so no existing caller moves.

This is the one shape this repository warns about — an optional parameter with a default — and
the warning does not bite here: the `notify` case was dangerous because the default was a
**no-op that silenced a user-facing failure**. A memo is a pure cache; an absent one changes
the number of reads and no answer.

### The result

```ts
interface ProjectSummary {
	planCount: number;
	/** Zones across every plan of this project, not per plan. */
	zoneCount: number;
	/** Requirement rows reached, whatever their state. */
	requirementCount: number;
	/**
	 * Always denominated in the PROJECT's own currency, and zero — not `null` — when there is
	 * nothing to sum. `null` means the project's currency could not be resolved at all, which
	 * is the only state in which no figure can honestly be printed.
	 */
	total: Money | null;
	/** Rows reading `stale`. They ARE in the total. */
	stale: number;
	/** `ListPlansByProject`'s own count, passed through. */
	unreadablePlans: number;
	/** Plans whose zone read refused. */
	unreadableZones: number;
	/** Rows whose currency the total cannot take. */
	unsummable: number;
}
```

**The three counts are independent, not a partition**, and the qualifier says so rather than
implying arithmetic that does not hold: a row may be both `stale` and `unsummable`, and
`stale + unsummable` is therefore not a count of anything. Each answers its own question.

## Decision 3 — sum everything, qualify the total

A stale row is **in** the total and **counted** beside it. The alternatives were weighed:

- *Sum only current figures* — the headline number understates the project, and any geometry
  edit makes figures stale, so it would understate it most of the time.
- *Refuse a total while anything is stale* — blank in the common case, for the same reason.

So the figure stays useful and never silently claims more than it knows. The qualifier is a
**sentence and not a badge alone** — "3 figures need recalculating" — per SDD §85's rule that
status never rests on colour.

### Why `unsummable` exists rather than being assumed away

`add` refuses `money.currency-mismatch`, and the currency invariant does **not** reach every
writer: `SetRequirementCostOverrideCommand` writes `estimatedCost.override` from a
caller-supplied `Money` with no currency comparison, which `CLAUDE.md` already records as an
open residue, reproducible through `RequirementRow.vue`'s cost override. A foreign-currency
override is therefore reachable today. A summing query that assumed one currency would either
throw on a real input or silently produce a total in the wrong denomination. Those rows are
counted out and named.

**This is not a licence to leave that residue open.** It is the read side declining to hide
it.

### The limitation this surface does not close

The walk starts at zones, so **a requirement whose zone was deleted is invisible to the
total.** `RequirementInspectorDTO`'s own docblock predicts a surface that would close it —
*"the union gains `'zone'` with the project-level surface that can produce it"* — and this is
not that surface: it reaches requirements only through zones it found, so it can never
produce a `missingTarget: 'zone'` row. Closing it needs `listByProject` on the requirement
port, which is its own increment.

Written into the query's header, this spec, and the slice document. Not a TODO.

## Decision 4 — this surface says "Rooms"

The Plan Editor redesign's principle 8 is explicit: the user-facing words are Room, Wall, Area
and Work — never Zone, Polygon, Vertex or Scene. The shipped UI still says Zone
(`editor.layer.zone`, `editor.toolbar.draw-zone`, `editor.inspector.delete-zone`).

This surface is NEW, so it is born in the destination vocabulary rather than shipped in a word
the product has already decided against and renamed later in a screen nobody has reason to
reopen. `Zone` stays the DOMAIN word behind it — the entity, the events, the frontmatter, the
repository and every existing locale key are untouched. Only the copy this screen renders moves.

**The cost is a real inconsistency for the length of one branch** and is accepted rather than
glossed: until the editor branch lands its own rename, a renovator reads `Rooms` on Project
Home and `Zones` in the Plan Editor's layer panel and toolbar. The alternative considered and
rejected was renaming every locale key here, which settles it once and puts a locale-wide diff
on the branch most likely to conflict with the editor's own copy edits.

**Whichever branch lands second owns the reconciliation.** If it is the editor's, this surface
already agrees with it and nothing moves. If it is this one, the editor's rename sweeps the
remaining keys and this surface is already correct. Named here because a temporary
inconsistency that nobody has written down is indistinguishable from an oversight.

## Decision 5 — Overview ships thin

Drawing the mock (`src/prototypes/ProjectHome.vue`) answered the question it was drawn for.
With the wireframe's four unbacked elements refused — planning completeness, next-best-action,
work items, a schedule — Overview is a headline figure, three counts and a strip: roughly a
third of the pane at 460px and less at 1280.

That is accepted. The figure is the first answer this plugin can give to *what does my project
cost*, and a screen that answers one question honestly is worth navigating to; the two
alternatives both cost more than the space is worth. Folding the plan list into Overview fills
it by making Overview and Design stop being distinct, which is a question the prototype spec's
§3 asks out loud. Pulling next-best-action forward fills it properly and roughly doubles the
increment.

**Next-best-action is therefore the next increment on this shell**, and it is buildable from
entities that already exist — uncalibrated plans, plans with no rooms, stale figures. The empty
space is where it goes.

## Components

```text
ProjectDetailState.vue   shell: reads context.projectId + context.section,
                         owns the project store, dialogs, subscriptions
  |- ProjectHeader.vue   name, status, back, Open note, library-overlap marker
  |- ProjectNav.vue      the section switch, rendering only SECTIONS
  \- <section>           ProjectOverview.vue | ProjectDesign.vue
```

`ProjectDetail.vue` splits. Its header becomes `ProjectHeader`; its plan list and `New plan`
form move wholesale into `ProjectDesign.vue`. Nothing about plan creation changes — same
command, same dialog, same `'gone'` handling and the same `dialogs.resolve` on a status
watcher. It acquires an address and nothing else.

`ProjectOverview.vue` is new. When the project has no plans it draws slice 21's existing
`renovationProject.noPlans` empty state, whose action navigates to Design rather than opening
the form in place — the header and nav stay mounted around every section, which is slice 14's
rule arriving on a fourth surface: an empty state that replaces a region hides the thing the
region exists to show, and here that thing is the way back.

`toProjectSummaryDto` lives in the read-model bundle beside every other `to*Dto`, because
`application/` may not name `presentation/`.

## Error handling

Three failure shapes, three surfaces, and they must not collapse into one:

1. **The project is gone** — slice 21's `'gone'` screen, unchanged. The shell decides this
   before any section mounts, so it cannot be reached differently from Overview than from
   Design.
2. **A partial read** — some plans unreadable, some zone reads refused. The section still
   draws, with `.rp-view-notice`'s additive strip naming the count. The plan list already does
   this for `unreadablePlans`; Overview joins it rather than inventing a second treatment.
3. **The summary read faulted** — `ViewFailure` inside the Overview region only, with the
   header and nav still mounted. Retryable, and `viewHydrationOrigin` already withholds the
   retry from a `settings.unrecovered` bootstrap failure, so this surface re-decides nothing.

Every `AppError` reaching Overview goes through `surfaceFor(error, origin)` under one new
origin. Slice 17's `unique symbol` lock means the component cannot reach `notifyError` without
asking, so this is a table entry rather than a discipline.

## Testing

Each case with the mutation that must redden it — a test watched failing against the opposite
mistake, per this repository's rule.

| Area | Case | Mutation |
|---|---|---|
| View state | `{ projectId: '', section: 'design' }` normalises to the list | dropping the normalisation puts the pane in a section of no project |
| View state | an unknown section resolves to Overview | refusing it leaves a restored `'budget'` leaf drawing nothing |
| History | Overview to Design sets `result.history`; a no-change restore does not | an unconditional guard claims a navigation on every restore |
| Remount | the mount sequence is `[null, 'p1:overview', 'p1:design']` | comparing only `projectId` leaves Design drawing Overview |
| Summary | the total sums `cost.effective` across two plans and four zones | — |
| Summary | one stale row is counted AND still in the total | summing only current rows understates it; dropping the count hides it |
| Summary | a foreign-currency override lands in `unsummable` and the total survives | assuming one currency throws on a reachable input |
| Summary | the memo makes it ONE project read for N zones | defeating the memo reads N; pinned on the CALL COUNT, since the figure renders identically either way |
| Delegation | the project total's staleness agrees with `GetRequirementsForZone` | a second derivation passes every other case in the file |
| Errors | a partial read draws the section plus the strip; a faulted read draws `ViewFailure` inside Overview with header and nav still mounted | replacing the whole shell takes the back control with it |
| Accessibility | the Overview scan asserts `.rp-empty-state`, `.rp-project-detail__back` and the nav's current-section marker are in the scanned DOM | grading a component instead of a surface |

**A harness shot**, `?project=project-1&section=overview` at both widths, joining the existing
`project-detail` pair: the nav is a row of controls under a header, and row spacing, wrapping
at 460px and the current-section marker's contrast are measurements no gate here performs.

**A manual case**, `docs/tests/cases/Navigate a project's sections.md`, for the one thing
`FakeLeaf` cannot answer — whether Obsidian's own back arrow really walks section states.
`FakeLeaf` records asks rather than behaving, exactly as slice 21 recorded for its own
navigation case.

## Files

**New:** `src/application/queries/GetProjectSummary.ts`; `src/presentation/views/sections.ts`
(the `SECTIONS` list and the parse); `ProjectHeader.vue`, `ProjectNav.vue`,
`ProjectOverview.vue`, `ProjectDesign.vue`; a `styles/` partial; the manual test case.

**Changed:** `RenovationProjectView.ts` (parse, `sync`, `setState`);
`RenovationProjectContext.ts` (`navigate` gains a section); `ProjectDetailState.vue` (becomes
the shell); `ProjectDetail.vue` (splits); `GetRequirementsForZone.ts` (optional memo); the
read-model bundle; `composition-root.ts` / `guardedServices.ts`; `errorSurfacePolicy.ts` (one
origin); `en.ts` / `de.ts`; `scripts/harness-shot.mjs`; `tests/harness/page.ts`; `CLAUDE.md`.

## Deliberately out of scope

Named so none of it later reads as an oversight.

- **Planning completeness %** (wireframe §A.10). It needs a definition of "complete" that no
  entity supports. A percentage invented for a progress bar is a hard-coded count in
  production UI, which the editor implementation plan forbids by name.
- **Next-best-action** (UXD §11), per Decision 5 — the next increment on this shell, and what
  the space Overview leaves empty is for.
- **Recent activity** (§A.10). There is no activity log and nothing raises one.
- **The five hidden sections** and every entity beneath them.
- **Breadcrumbs** beyond slice 21's back control. The interactive
  `Project / Space / Activity` trail needs the spatial hierarchy — the one thing that collides
  with the editor branch.
- **Orphaned requirements** in the total, per Decision 3.

## Coverage

Floors in force: statements 99, functions 99, lines 99, branches 98 (`vitest.config.ts`).

**Measured on the baseline `5702f28`** with `npx vitest run --coverage` — 342 files, 4941
passed, 65 skipped:

| metric | measured | floor | additional uncovered units the floor still permits |
|---|---|---|---|
| statements | 99.39% (7392/7437) | 99 | ~29 |
| **functions** | **99.07% (1937/1955)** | **99** | **~1** |
| lines | 99.54% (6533/6563) | 99 | ~35 |
| branches | 98.31% (3802/3867) | 98 | ~12 |

The arithmetic, so none of it has to be taken on trust: a floor of `f` permits `U` further
uncovered units where `covered / (total + U) >= f`, i.e. `U <= covered / f - total`.

**Functions is the binding metric here, not branches**, which corrects this document's own
first draft — it carried slice 19's reading forward and said both were at one unit. Branches
has since gained about twelve units of room and functions has not. That matters for how the
two fail: an untested new FUNCTION fails the gate outright, while an untested new BRANCH
disappears into twelve units of slack and says nothing, which is the shape that already cost
slice 16 an uncovered arm found only by reading `coverage-final.json` for the changed files.

So: plan the test with the code, read the floor as a floor, and re-measure rather than trusting
this table once the editor branch has merged — it will land on a third tree nobody has measured.

`viewStateFrom`'s fallback arm and every `unsummable` / `unreadableZones` arm are new branches,
and `GetProjectSummary` is several new functions. Each needs a case in the commit that writes
it, the functions especially.
