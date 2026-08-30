# Design slice 21 — The project detail state

**Date:** 2026-08-30
**Slice document:** none yet. This document is the specification until
`docs/tasks/21-the-project-detail-state.md` exists; where the two later disagree, the slice
document is the authority and this one is the earlier measurement.
**Baseline:** `fix/metadata-cache-modify-parse-lag` at `719528d`, which is `main` plus the
metadata-cache parse-lag fix.
Coverage floors in force: statements 99, functions 99, lines 99, branches 98
(`vitest.config.ts`). Measured on the baseline: 99.21 / 99.04 / 99.43 / **98.06**. Re-measure
with `npm run test:coverage` before relying on any figure here — **branches has roughly one
and a half covered branches of headroom**, which is tighter than slice 16 recorded and is a
real constraint on this slice: an untested new arm does not reduce coverage, it fails the
gate. Plan the test with the code.

**Numbering.** Slices 19 (`the-asset-catalogue-leaves-the-project`) and 20
(`the-currency-the-pipeline-is-told`) are already written and unbuilt. This is 21 and
displaces neither. It depends on neither: it reads `Project` and `Plan` and writes `Plan`,
and slice 19 reshapes `Asset` while slice 20 reshapes `Money`.

## Why

A user clicks a project row in the Renovation Project pane and Obsidian opens `Project.md`.
That is what design slice 16 built and it is what `ProjectList.vue` documents, so it is not a
defect in the sense of code disagreeing with its comment. It is the surface being missing:
there is nowhere else for the row to go.

The consequence is recorded in two places already. `src/plugin/sampleProject.ts` says
`create-sample-project` is still the only source of a Plan, because "nothing in
`presentation/` calls `CreatePlanCommand`, and there is no project-detail surface a 'new
plan' action could live on". `EMPTY_STATE_CONTENT`'s docblock says the same thing from the
other end. Both sentences stop being true when this slice lands, and both are edited here
rather than left to rot — a comment stating a trigger that has fired is worse than no comment.

So: a user can create a project and cannot create a plan. The loop the plugin exists for —
`Zone Geometry → Area → Requirement → Cost` — is reachable only through a scaffolding command
named for the fact that it is scaffolding.

## What this is not

**PRD Epic 3 — Project Home** (`docs/product/prds/renovation-project-workspace.md:423`) is the
eventual home of this surface and it is five features wide: project summary, planning
progress, next actions, recent activity, project shortcuts. Four of them are not buildable.
They read work packages, budget, schedule, spaces, documents and an activity log, and none of
those entities exists — the MVP set is `Project`, `Plan`, `Zone`, `Asset`, `Requirement`.

This slice builds the part backed by entities that exist, and the *Deliberately out of scope*
section below names each omission with its trigger, so the next author inherits decisions
rather than gaps.

## The decisions

### 1. A state inside the existing view, not a third `ItemView`

`SDD §11` names exactly two primary surfaces — Renovation Project and Plan Editor — with
Budget, Schedule, Procurement and Dashboard listed as future. A per-project `ItemView` keyed
by project id (the shape `PlanEditorView` takes for plans) would be a third, which is an
amendment to that list rather than a slice, and it persists a second view type in every
user's workspace layout forever.

The Renovation Project view becomes a **list state and a detail state**, one leaf, with a way
back. That is also what PRD Epic 4 asks for in its own words: "how to return to the project
overview."

The rejected third option — expanding a row in place — is cheapest and forecloses Epic 3: an
expanded row has nowhere to put a summary, progress or next actions, so the Project Home
would have to be built somewhere else later.

### 2. Location lives in Obsidian's view state, not in Pinia

`RenovationProjectView` has no `getState`/`setState` today; it is a stateless singleton. It
gains the pair, carrying `projectId`, exactly as `PlanEditorView` carries `planId`, with the
same validation-not-cast treatment because **the workspace layout is a file the user can
edit** — the trust boundary `settingsFrom` draws around `data.json`, applied to the same class
of input.

```ts
getState(): Record<string, unknown> { return { projectId: this.projectId ?? '' }; }
```

`''` rather than an omitted key, for the reason `PlanEditorView.getState` already gives: a key
that is sometimes absent is a different shape to reason about.

Three reasons this beats a `selectedProjectId` ref in `RenovationProjectStore`:

- **`rebind` survives it.** `rebind` remounts the whole Vue tree on a settings save. State
  held only in Pinia is destroyed by that, so a settings save would bounce the user out of the
  project they are in and back to the list. `projectId` is the view's own field and a remount
  never touches it — the property `PlanEditorView.rebind` relies on for `planId` and states in
  its docblock.
- **A restart lands where the user left off**, which is PRD Epic 6's "Last Context" arriving as
  a consequence rather than as a feature.
- **It is the only authority.** A route or a store field would be the same fact in a second
  place, which is this repository's most-repaid lesson: *two expressions of one question, three
  lines apart, drift immediately.*

### 3. Navigation goes through Obsidian, and buys the back arrow

Navigation is not a store mutation. `ViewRoot` emits an intent; the view calls
`leaf.setViewState({ type, state: { projectId } })`; Obsidian calls `setState` back; `sync()`
decides; the tree redraws.

That round trip exists for one reason beyond tidiness. `ViewStateResult.history`
(`obsidian.d.ts:7643`) is documented as *"Set this to true to indicate that there is a state
change which should be recorded in the navigation history."* Setting it puts each navigation
into **Obsidian's own leaf navigation history**, so the pane's back and forward arrows work,
consistently with every other Obsidian surface.

`PlanEditorView.setState` currently ignores that parameter — its signature is
`setState(state: unknown, _result: ViewStateResult)`. This slice sets it here; the Plan
Editor gets the same one-line win whenever it is next touched.

### 4. vue-router is refused, with a trigger

Considered explicitly, because this slice introduces navigation and a router is the canonical
Vue answer to that. Refused for four reasons:

- **Its product is URL binding, and an `ItemView` has no URL.** It would be instantiated with
  `createMemoryHistory()`, which reduces it to a state machine keyed by path-shaped strings —
  a `v-if` in a `/projects/:id` costume.
- **It would be a second history stack**, competing with the one the user's back arrow drives.
  Nothing errors; the two just quietly disagree, which is worse.
- **It would be a second authority** for the fact decision 2 just gave one owner.
- **The scale does not justify it.** One binary state today; `npm run analyze` fails on a
  dependency nothing meaningfully imports; the bundle is already 670 KB, and this repository's
  convention is that dependencies arrive with their first real use.

**Trigger, to be recorded in CLAUDE.md's *Deliberately absent* section:** a third level of
nesting **and** a genuine need for a history independent of Obsidian's. PRD Epic 4's whole
navigation set (Overview, Spaces, Design, Work, Budget, Schedule) fits in
`{ projectId, section }` in view state, so *"Epic 4 arrives"* is explicitly **not** the
trigger.

### 5. The note stays reachable, as a secondary action

The row navigates; an **Open note** action in the detail header still opens `Project.md`.
`openProjectNote` keeps its coalescing map and its `ProjectNoteOpenOutcome` — a working
capability with a real defect already fixed in it (a shared rejection reported twice) is not
deleted to make a click do one thing instead of another.

Rejected: dropping it (Obsidian's own explorer reaches the note, but the plugin then has no
route to a project's own metadata), and modifier-click (invisible, which is the standing cost
CLAUDE.md already records for the Shift-constrain key, paid for a gesture that has a perfectly
good visible home).

### 6. An `open-project` command, reaching the same state transition

The detail state is reachable from a palette command as well as from a row, mirroring
`open-plan-editor`: a plain `callback` over a `ProjectSuggestModal` — a `FuzzySuggestModal`
of the Project Index's `renovation-project` entries — which then reveals the view with that
project's state.

**"One action, every input" holds at `sync()`, not at the reveal.** The row click and the
command necessarily take different doors, because one already holds a leaf and the other must
find or create one — that split is `revealView`'s entire job and is the same one
`openProjectNote` already takes. What matters is that both end at Obsidian calling `setState`,
and `sync()` is the single place that decides what is mounted. A second activation path that
decided for itself is what this rule exists to refuse, and there isn't one.

**It needs no new mechanism.** `revealCandidate` already accepts an optional `state` and keys
its in-flight map by `type` plus the serialized state (`requestKey`, with sorted keys so two
equal states written in different orders do not miss each other). So
`revealView(deps, RENOVATION_PROJECT_VIEW, { projectId })` gets the double-invocation
coalescing for free — the guard that exists because a leaf takes time to exist, and without
which two invocations in one tick both find nothing and both create.

**With no projects in the vault, the command reveals the LIST, not a picker and not a
notice.** `open-plan-editor` answers `notify(tr('plan.none'))` in that situation, and this
deliberately differs. The reason is a property of the surfaces rather than a preference: a
Plan Editor with no plan draws nothing, so a notice is the only thing that command can
usefully do. This view **has** a list state whose empty state carries a Create button, so
revealing it puts the user one click from the thing they were trying to reach. A zero-row
fuzzy picker would be the worst of the three. Stated here so that nobody later "fixes" the
inconsistency by adding a `project.none` notice and quietly removing the better behaviour.

The command id `open-project` is **DATA** — Obsidian binds a user's hotkey to it, so it is
never renamed. `command.open-project` needs an entry in both locale tables. Registration lives
in `src/plugin/`, which `tests/build/registration-locality.test.ts` enforces by reading `src/`
for nine registration members.

## Architecture

```
ProjectList  --open(id)-->  ViewRoot  --navigate(id)-->  RenovationProjectView
                                                              |
                                          leaf.setViewState({ projectId })
                                                              |
                                        Obsidian --setState--> sync() --> re-provide
                                                              |
                              ViewRoot draws ProjectDetail --> ProjectDetailStore.hydrate
```

`sync()` is borrowed from `PlanEditorView` for the reason its docblock gives — `onOpen` and
`setState` race and the order is not something a plugin may assume, so one function decides.
The difference: **both** states mount here, because this view has no "nothing to draw" case.
`sync()` therefore guards on the mounted `projectId` *changing*, and `ViewRoot` switches
within one mounted tree rather than being torn down and rebuilt per navigation.

Nothing outside `presentation/` learns that a detail state exists.

## Components

**New**

| File | Responsibility |
|---|---|
| `views/ProjectDetail.vue` | The detail state's markup: header (name, status, Open note, ‹ back) then `PlanList`. Draws only what it is given; emits `back`, `openNote`, `openPlan(planId)`, `createPlan`. |
| `views/PlanList.vue` | Plan rows plus a `+ New plan` header button — deliberately the shape `ProjectList.vue` already has, so the two read as siblings. Emits `open(planId)`, `create`. |
| `views/NewPlanForm.vue` | One field (`name`), on `useFormCommit`, modelled on `NewProjectForm`. |
| `stores/ProjectDetailStore.ts` | `project`, `plans`, `status`, `error`, `hydrate(queries, projectId)`. |
| `read-models` addition | `PlanSummaryDto` — `{ id, name }`. A summary, not `PlanDto`: a list row needs no background, calibration or layers, and handing a component the full DTO makes it a consumer of fields it does not read. |
| `modals/ProjectSuggestModal.ts` | A `FuzzySuggestModal` over the index's `renovation-project` entries, mirroring `PlanSuggestModal`. |
| `emptyStates` addition | `renovationProject.noPlans`, **with** an `actionLabel`. |

**Changed**

- `RenovationProjectView` — `getState` / `setState` / `sync`, plus `navigate(projectId)` on the
  context.
- `ViewRoot.vue` — switches on `context.projectId`. Keeps its one `DialogHost`, which now has a
  second caller.
- `plugin/` — registers the `open-project` command beside the existing ones.
- `sampleProject.ts` and `emptyStates/content.ts` — the two docblocks whose stated trigger this
  slice fires.

**`CreatePlanInput` needs only `projectId` and `name`.** `background` and `layers` are optional
and stay unset: slice 5's background is its own command, and a plan with no background is a
state the editor already draws an empty state for.

## Reads

Two new members on `RenovationProjectQueryServices` rather than a new bundle — that file is
already named for this view, and its own docblock argues that two small files named for their
views beat one growing file named for one of them.

- `getProject(projectId)` → `Result<ProjectSummaryDto | null, RepositoryError>`, wrapping the
  existing `GetProject` query.
- `listPlansByProject(projectId)` → `Result<PlanSummaryDto[], RepositoryError>`, a new
  `ListPlansByProject` application query over `PlanRepository.listByProject`, which already
  exists on the port.

Both guarded at the composition root like every other door, and both given a refusal arm in
`unavailableRenovationProjectQueries` carrying the same `settings.unrecovered` code —
**one logical failure must not arrive under two codes** when something downstream branches
on it.

`ProjectDetailStore.hydrate` carries a **request ticket**, like `ProjectStore.hydrate` and
`InspectorStore`. It has two concurrent callers from day one — its own mount and
`onProjectsChanged` — which is exactly the condition that made the ticket necessary there:
without it the slower earlier read lands on top of the faster later one and content silently
reverts with no error anywhere.

## Error handling

| Case | Response | Precedent |
|---|---|---|
| `getProject` → `ok(null)` | Navigate back to the list **and re-read it** | `ProjectOpenOutcome.'missing'`, which already does exactly this |
| Either read `isErr` | Mapped sentence via `trError` in `.rp-view-message`; **stay on the detail** | `ProjectStoreStatus`'s `missing` / `failed` split |
| Both succeed | `status = 'ready'` | — |

**A failed read is not a missing project**, and navigating away on one would tell a user their
project was deleted because their vault hiccuped. That is the whole reason
`ProjectStoreStatus` keeps the two apart, and it is kept here.

**No partial state.** Two reads, each all-or-nothing; there is no honest picture of a project
whose identity loaded but whose plans did not. Deliberately unlike the list's additive
`unreadable > 0` notice, which is partial because one read returns many independently-readable
rows.

**The empty state is structurally gated** on `status === 'ready'` — the
`RenovationProjectStore.emptyStateKey` shape, not `ProjectStore`'s stated-exception one. This
store has no `keepPreviousOnFailure` need (nothing here re-hydrates after a command that
already wrote), so the guard can be structural, and a failed read can never render as "no
plans yet".

**A create that refuses**, through `useFormCommit` + `routeError` with a per-form
`FieldErrorMap`:

| code | routes to |
|---|---|
| `plan.empty-name` | the `name` field |
| `plan.project-not-found` | banner, **and** back to the list — the project vanished while the form was open |
| anything else | banner |

Every one of those codes needs copy in **both** locale tables, bound to its raise site by a
table copied **from the raise sites** — never from `en.ts`, because a table derived from the
locale file agrees with a typo. Slice 10's ~20 codes shipped with no locale entries at all and
that did not degrade to silence, it degraded to the *wrong sentence*.

The German goes in with `tests/presentation/i18n/strings.test.ts`'s vocabulary rows live:
`Objekt`, never `Material`.

Nothing new reaches for `notifyFault`. Every door here is a guarded command or query, so a
fault is already mapped, logged once at the boundary, and returned as a resolved failed
`Result`.

## Testing

**Node** — the request ticket (a slower earlier read must not land on a faster later one); the
three statuses; the structural empty-state gate; `ListPlansByProject` and its DTO mapping; the
`routeError` field map, driven from the raise sites and `grep`ped in the same edit.

**jsdom** — `ProjectDetail` and `PlanList` markup and emits; `NewPlanForm` keeping the user's
typed value on a rejected commit and dropping a second submit while the first is in flight
(slice 16's two rules); `content.test.ts` flipping `noPlans` to assert its action is
**present**, the way slice 16 flipped `noProjects`.

**View level** — the `getState`/`setState` round trip; validation refusing a non-string and an
empty id; `sync()` not mounting twice on the `onOpen`/`setState` race; `rebind` keeping
`projectId`. Plus one case that exists because nothing else would notice it: **`result.history
= true`**. That single assignment is the entire reason the back arrow works, and every other
test in this slice passes without it.

**The command** — that `open-project` reveals with `{ projectId }` state; that two invocations
in one tick coalesce into one activation (the `revealCandidate` guard, driven through the
real door rather than asserted of the map); and that an empty vault reveals the **list** state
rather than opening a zero-row picker. That last one needs its own case because every other
test passes with either behaviour.

**Wiring** — that the root hands the view both new queries, guarded, and that the refusal
bundle carries them. This needs its own case for the `slice10CascadeWiring` reason: a
composition that forgets a dependency compiles and passes everything else. Also **verify, not
assume**, that `guardCategory.test.ts`'s walk reaches the new queries — it finds doors by
shape, and its own header lists what it cannot see.

**Accessibility** — the detail state joins `tests/harness/accessibility.test.ts`, awaiting
`flushPromises()` before scanning and asserting the real markup is in the scanned DOM. That
file has already been burned by scanning one tick early and passing against an empty subtree,
which is indistinguishable from a pass on a compliant one. `noPlans` is scanned **with its
button**: CLAUDE.md records `noZones` as the one action-carrying empty state no axe scan
reaches, and this slice must not make that two.

**Harness** — an index entry for the detail state, captured in both schemes and at
`--width=460`. Spacing, wrapping and contrast are outside every gate this repository has, and
that width has already hidden a real layout defect once.

### Two limits stated rather than left for a green run to imply

**`FakeLeaf.setViewState` was FASTER than Obsidian** — CLAUDE.md's fourth face of the
fake-too-thin rule. It established view state synchronously, where the real one runs a view
factory and `onOpen` first, and that made a duplicate-tab regression case pass against a live
defect. This slice's entire navigation is that round trip, so the rig must keep the fake's
async honesty, and each navigation case must be watched failing when it should.

**No gate here can see whether Obsidian's back arrow walks our history entries.** `FakeLeaf`
records asks rather than behaving; jsdom models no workspace. The suite can assert only that
`history: true` was set. Whether Obsidian honours it belongs in a manual case under
`docs/tests/cases/`, alongside appearance.

## Deliberately out of scope

Each with a trigger.

- **PRD Epic 3's other four features** — planning progress, next actions, recent activity,
  project shortcuts. Three of them read entities that do not exist. *Trigger: the entity lands.*
- **The counts summary** (plans / zones / assets / requirements). Buildable today; left out
  because it needs an aggregate query reading four repositories per project, whose cost grows
  with the vault. *Trigger: someone wants it* — it is then one query and one line of markup,
  because the detail header already exists to hold it.
- **vue-router.** Reasoned above; goes in CLAUDE.md's *Deliberately absent* section with its
  own trigger.
- **Retiring `create-sample-project`.** This slice retires the *plan* half — the last thing
  that module is the only source of — but the command stays: it is the vault-side equivalent
  of `npm run harness`, and it still seeds zones, an asset and a requirement in one gesture.
  Its docblock changes. *Trigger: a surface exists for every entity it seeds.*
- **Plan rename and delete.** Deleting a plan means deciding what happens to its zones, which
  is `deleteZoneFlow`'s question one level up. *Trigger: a `DeletePlanCommand` exists.*
- **Two detail panes side by side.** The view stays a singleton; wanting this is wanting the
  third `ItemView` decision 1 rejected. *Trigger: an `SDD §11` amendment.*

## Open questions

None. The one this document carried on 2026-08-30 — whether the detail state should also be
reachable from a palette command — was settled the same day and is decision 6 above. It is
recorded as a decision rather than deleted because its empty-vault behaviour deliberately
differs from `open-plan-editor`'s, and a difference nobody wrote down is a difference somebody
later removes.
