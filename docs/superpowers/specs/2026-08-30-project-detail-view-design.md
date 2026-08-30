# Design slice 21 — The project detail state

**Date:** 2026-08-30
**Slice document:** none yet. This document is the specification until
`docs/tasks/21-the-project-detail-state.md` exists; where the two later disagree, the slice
document is the authority and this one is the earlier measurement.
**Baseline:** `fix/metadata-cache-modify-parse-lag` at `719528d`, which is `main` plus the
metadata-cache parse-lag fix.
Coverage floors in force: statements 99, functions 99, lines 99, branches 98
(`vitest.config.ts`). Branches is the binding one and it has been measured **twice, on two
different trees**, which is worth carrying because the two disagree by enough to change how
the risk reads:

| tree | statements / functions / lines / branches | uncovered branches that still pass |
|---|---|---|
| baseline `719528d` (`main` + the parse-lag fix), as first written here | 99.21 / 99.04 / 99.43 / **98.06** (2692 branches) | **~1.9** |
| `main` at `50e1b84`, re-measured during the review round | 99.25 / 99.04 / 99.47 / **98.16** (2627/2676) | **~4.6** |

The arithmetic, so neither figure has to be taken on trust: a floor of 98 permits `U`
additional uncovered branches where `covered / (total + U) >= 0.98`, i.e.
`U <= covered / 0.98 - total`. Both trees are green; they differ because the parse-lag fix
adds branches of its own.

**Take the tighter number as the planning constraint and neither as a fact.** This slice will
land on whatever `main` is once PR 37 and PR 38 have merged, which is a third tree nobody has
measured — so **re-measure with `npm run test:coverage` before relying on any figure here**,
and read the floor as a floor rather than as a budget. What both measurements agree on is the
shape: the margin is a handful of branches, not a percentage point, so an untested new arm
does not shave a number, it fails the gate. Plan the test with the code.

One practical note from taking those measurements, because it costs an hour to rediscover:
run the suite **alone**. Three of the four runs made during this review reported a single
failing file — `tests/build/write-boundary.test.ts`, `tests/build/lint-edited.test.ts`,
`tests/harness/harness.test.ts` — every one of them a timeout under machine load rather than
a defect, every one green on a quiet re-run, and a failing file **suppresses the coverage
report entirely**, so the number you came for is not printed. CLAUDE.md records the
parallelism half of this for `tests/build/`; the load half reaches `tests/harness/` too.

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

**`''` is a DESTINATION here, and that is the one place this view must not copy
`PlanEditorView`.** `planIdFrom` refuses an empty id and `setState` then leaves `planId`
alone, which is right for a view whose empty case is *nothing to draw*. This view's empty case
is the **list**, which is a state a user navigates to — so refusing `''` refuses the only
state the back arrow ever restores. Reported in review, and the failure is total rather than
cosmetic: `getState` records `{ projectId: '' }` for the list, so pressing back from a project
restores exactly the value the validator was about to discard, the field keeps the project it
already held, and the pane never leaves the detail state. The in-app **‹ back** action sets
the same `{ projectId: '' }` and would have died with it.

So the parse is three-way, and the third arm is the one the Plan Editor does not have:

```ts
/**
 * `''` is the LIST — a state, not an absence. A value that is not a string at all is a
 * layout this build does not recognise, and the conservative answer to that is to go on
 * drawing whatever is already drawn.
 */
function projectIdFrom(state: unknown): { projectId: string | null } | null {
	if (typeof state !== 'object' || state === null) return null;
	const projectId = (state as Record<string, unknown>)['projectId'];
	if (typeof projectId !== 'string') return null;
	return { projectId: projectId.length > 0 ? projectId : null };
}
```

A leaf restored from a layout written before this slice carries no `projectId` key at all and
lands on the refusal arm — correctly, because a freshly constructed view's field is already
`null` and `null` is the list. That the two coincide is worth stating so that nobody later
"simplifies" the refusal into a default and discovers the difference on a view that has
already navigated.

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

**Back is a navigation like any other** and takes the same door:
`setViewState({ type, state: { projectId: '' } })`. Not a `showList()` method on the view,
because a second way to change which state is drawn is a second decider — and it is the reason
decision 2's sentinel has to be *accepted* rather than validated away.

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
of the Project Index's `renovation-project` entries — which then makes sure the view's leaf
exists and navigates it to that project.

**"One action, every input" holds at `sync()`, not at the reveal.** The row click and the
command differ in exactly one thing: the row already holds a leaf, and the command may have to
create one. That is `revealView`'s entire job and the same split `openProjectNote` takes. Once
the leaf exists the two are the *same* call — see the two steps below — and both end at
Obsidian calling `setState`, with `sync()` the single place that decides what is mounted. A
second activation path that decided for itself is what this rule exists to refuse, and there
isn't one.

**It is TWO steps, and the first draft of this paragraph said one.** That draft read *"it needs
no new mechanism … `revealView(deps, RENOVATION_PROJECT_VIEW, { projectId })` gets the
double-invocation coalescing for free"*, and it was wrong in three independent ways. All three
were reported in review and all three are measured against `reveal.ts` rather than argued:

- **`revealView` takes no `state` parameter.** Its signature is `(deps, type)`. `state` is
  `revealCandidate`'s fourth argument and `revealView` forwards the first three, so there is
  nothing to pass one through — the call that draft wrote does not compile.
- **`revealCandidate` sets the state only on a leaf it CREATED**, and deliberately — its own
  comment says setting it on an existing leaf "rebuilds a view the user has already scrolled,
  filtered or panned". That is exactly right for the Plan Editor, whose candidate filter
  already guarantees the leaf holds that plan. The NORMAL case for this command is a Renovation
  Project leaf that is already open, so the state would have been passed, ignored, and the user
  left on the list or on whichever project they were last in.
- **`requestKey` is `type` plus the serialized state, and for a SINGLETON that is the wrong
  key.** Two `open-project` invocations naming different projects produce two different keys,
  so neither joins the other; an in-flight leaf does not answer `getLeavesOfType` yet, so both
  create one. Two tabs of the view whose whole premise is that there is one — the defect
  `activating` exists to prevent, walking straight through it, because the key describes the
  REQUEST where the guard needs to describe the LEAF.

**The remedy leaves `reveal.ts` untouched**, which is most of the argument for it. Three cases
pin that module's coalescing, its release and its one-report-per-failure, and its key
derivation is load-bearing for `revealPlanEditor`, where two plans genuinely are two leaves.
Widening it was considered and refused: every shape of the widening ends in a parameter whose
two callers want opposite answers to *does the candidate predicate already imply the state* —
one boolean deciding both the key and whether an existing leaf is re-stated, in a module whose
docblock already argues that a subtlety re-remembered per caller is one that eventually is not.

Instead the command does what it actually means, in the order it means it:

```ts
await revealView(deps, RENOVATION_PROJECT_VIEW);          // guarantee the leaf — unchanged
const leaf = deps.workspace.getLeavesOfType(RENOVATION_PROJECT_VIEW)[0];
if (leaf === undefined) return;                            // activation faulted; already reported
await leaf.setViewState({ type: RENOVATION_PROJECT_VIEW, active: true, state: { projectId } });
```

**Uniqueness** falls out rather than being added: it is `revealView`'s existing coalescing,
keyed on the type because that call carries no state — so two invocations in one tick produce
one leaf whether they name the same project or different ones. **Navigation** is the second
line, and it is *literally the call a row click makes*, which turns this decision's "one
action, every input holds at `sync()`" from an argument into a fact about the source: there is
one `setViewState({ projectId })` shape and both doors reach it.

**ORDERING does not fall out, and the sentence that said it did was wrong.** That sentence
read "two invocations naming different projects serialize on that one leaf and the later
wins", and nothing in the three lines above serializes anything: both calls await the SAME
coalesced `revealView` promise, so they resume in the same tick and then issue
`leaf.setViewState` concurrently. Awaiting each locally orders nothing between them — the
earlier call can settle last, remount last, and win. "Serialize" was a word doing work no code
was doing. Reported in review, against the fix for the finding one round earlier, which is
the shape this branch keeps producing: the repair closed uniqueness and left the property it
claimed in the same breath.

The ordering is a **latest-request ticket**, the idiom `ProjectStore.hydrate` and
`InspectorStore` already use, applied to a write instead of a read:

```ts
const ticket = ++latestNavigation;
await revealView(deps, RENOVATION_PROJECT_VIEW);
if (ticket !== latestNavigation) return;   // a later choice arrived; it owns the leaf
const leaf = deps.workspace.getLeavesOfType(RENOVATION_PROJECT_VIEW)[0];
if (leaf === undefined) return;            // activation faulted; already reported
await leaf.setViewState({ type: RENOVATION_PROJECT_VIEW, active: true, state: { projectId } });
```

Superseded calls **drop their write** rather than queueing behind it, which is the difference
between a ticket and a chain and is the right one here: a user who picked twice wants the
second project, not a remount to the first followed by a remount to the second. The counter is
module-scoped beside the helper, for the reason the coalescing map next door is — a subtlety
re-remembered per caller is one that eventually is not.

The early return is not defensive padding. `revealView` does not reject; it answers every
fault through `reportFault`, once per activation. So an activation that failed leaves no leaf
and has already been reported, and declining to navigate one that is not there is all that is
left to do. The pair lives in `infrastructure/obsidian/workspace/` beside its siblings, because
`plugin/` composing the two steps for itself would be the second activation path this decision
refuses.

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
                                        Obsidian --setState--> sync() --> remount
                                                              |
                              ViewRoot draws ProjectDetail --> ProjectDetailStore.hydrate
```

`sync()` is borrowed from `PlanEditorView` for the reason its docblock gives — `onOpen` and
`setState` race and the order is not something a plugin may assume, so one function decides.

**It REMOUNTS, exactly as the Plan Editor does, and the first draft of this document said the
opposite.** That draft had `ViewRoot` switching "within one mounted tree rather than being torn
down and rebuilt per navigation", and there is no mechanism under it: `RenovationProjectDeps` is
a plain object, `app.provide` runs once before `mount`, and a component that has already run
`inject()` holds the value it was handed. Changing a class field invalidates nothing, so the
tree would have gone on drawing the list forever, after a `setState` that had done everything it
was asked. Reported in review, which offered a provided reactive ref as the alternative. The
remount is taken instead, for three reasons and one cost.

- It is the mechanism this repository already has, in the sibling view, under a docblock that
  argues for it. A `DeepReadonly<Ref>` in the context would be the first reactive member any
  view context here carries, and a second way a Vue tree in this plugin learns its subject
  changed.
- It makes the staleness **unrepresentable** rather than refreshed: the tree is built from the
  `projectId`, so the two cannot disagree. CLAUDE.md has paid three times for the other order.
- `rebind` already relies on it. `RenovationProjectView.rebind` is `onClose(); onOpen();` today
  and becomes the Plan Editor's `unmount(); sync();` with no new reasoning — `projectId` is the
  view's own field and a remount never touches it, which is criterion 7.

**The cost, stated rather than glossed.** Every navigation discards the tree, so returning to
the list re-reads it and loses its scroll position, and a dialog open at that moment is settled
by `DialogHost.onBeforeUnmount` with its kind's cancel result. Both are correct for a
deliberate navigation, and both are the residual `PlanEditorView.rebind` already records; the
re-read is also the honest answer, since a user navigating back to the list is a user who last
saw it before creating a plan in it.

**One difference from `PlanEditorView` survives, and it is in the GUARD rather than in the
strategy.** There, `planId === null` means *nothing to mount*, so `sync()` returns on it. Here
`null` means *mount the list*, which is a real state — so the guard needs a `mounted` flag
beside `mountedProjectId`, or a first open of the list (`null === null`) is skipped and the
pane draws nothing at all.

```ts
private sync(): void {
	if (this.mounted && this.projectId === this.mountedProjectId) return;
	this.unmount();
	this.mount(this.projectId);   // null draws the list, a string draws that project
}
```

The context is rebuilt per mount and carries `projectId` as a plain field, the way
`PlanEditorContext` carries `planId`. `ViewRoot` reads it once and draws one of the two states.
A fresh `createPinia()` comes with each mount, which is a quiet dividend of this choice: the
detail store has no cross-navigation lifetime, so it needs no `reset` and cannot carry one
project's rows into another's.

**Borrow the STRATEGY from `PlanEditorView`, not the `mount` body — they attach to different
elements and only one of them is right here.** `PlanEditorView.mount` does
`contentEl.createDiv('renovation-plan-editor-view')` and mounts into that wrapper;
`RenovationProjectView.onOpen` mounts onto `contentEl` **directly**, under a comment that says
why — "so the component's root element IS the `.renovation-planner-view` the stylesheet keys
off, with no wrapper in the height chain." That is load-bearing: `styles/view.css` gives that
root `height: 100%`, which resolves against its parent, and a wrapper `div` between them has
`height: auto`. The editor's wrapper is fine because `styles/editor.css` declares a rule for
it; a copied project-view wrapper would have none, and the pane would collapse — the exact
defect the browser harness caught in slice 1 and the exact kind no gate here can see, since
jsdom lays nothing out. So `mount` keeps `app.mount(this.contentEl)` after `this.contentEl.
empty()`, and `containerEl.addClass('renovation-planner-container')` stays in `onOpen`, where
it is a fact about the leaf rather than about the mount.

Nothing outside `presentation/` learns that a detail state exists.

## Components

**New**

| File | Responsibility |
|---|---|
| `views/ProjectDetail.vue` | The detail state's markup: header (name, status, Open note, ‹ back) then `PlanList`. Draws only what it is given; emits `back`, `openNote`, `openPlan(planId)`, `createPlan`. |
| `views/PlanList.vue` | Plan rows plus a `+ New plan` header button — deliberately the shape `ProjectList.vue` already has, so the two read as siblings. Emits `open(planId)`, `create`. |
| `views/NewPlanForm.vue` | One field (`name`), on `useFormCommit`, modelled on `NewProjectForm`. **No new dialog KIND** — it is another `component` under the existing `kind: 'form'`, the way `NewProjectForm` already is, so CLAUDE.md's "a new dialog kind is FIVE edits" does not apply. The caller needs `ViewRoot.onCreateProject`'s in-flight guard with it, because `openDialog` THROWS `DialogStackingError` while a dialog is open and two clicks in one tick would otherwise reach it twice. |
| `stores/ProjectDetailStore.ts` | `project`, `plans`, `status`, `error`, `hydrate(queries, projectId)`. |
| `read-models` addition | `PlanSummaryDto` — `{ id, name }`. A summary, not `PlanDto`: a list row needs no background, calibration or layers, and handing a component the full DTO makes it a consumer of fields it does not read. |
| `modals/ProjectSuggestModal.ts` | A `FuzzySuggestModal` over the index's `renovation-project` entries, mirroring `PlanSuggestModal`. |
| `application/events/projectPlansChangeSource.ts` | "The set of plans in THIS project changed" — the third change source, and the only one that can hear `PlanCreated`. See *Reads*. |
| `infrastructure/obsidian/workspace/` addition | Reveal the singleton, then navigate it — the two steps decision 6 spells out, kept out of `plugin/` so there is no second activation path. |
| `emptyStates` addition | `renovationProject.noPlans`, **with** an `actionLabel`. |

**Changed**

- `RenovationProjectView` — `getState` / `setState` / `sync` / `mount` / `unmount`, and the
  `mounted` and `mountedProjectId` fields the guard above needs. `rebind` becomes
  `unmount(); sync();`.
- `RenovationProjectDeps` — **five new members, and the first draft of this table named
  one.** Listing them matters more than it looks: `presentation/` may not reach
  `infrastructure/`, so every one of these is a seam the composition root has to fill, and a
  component emitting an event no context member answers compiles and does nothing.
  - `projectId: string | null` — which state to draw, fixed per mount (see *Architecture*).
  - `navigate(projectId: string | null): void` — the `setViewState` round trip, `null` for the
    list. The only writer of that state.
  - `openPlan(planId: string): Promise<void>` — bound to `revealPlanEditor` at the root, the
    same shape and for the same reason as the existing `openProject`. **`ProjectDetail` emits
    `openPlan` and nothing was declared to receive it**, which would have left criterion 2 —
    "opening a row reaches the Plan Editor through `revealPlanEditor`" — with no route from the
    layer that raises the event to the layer allowed to import that function.
  - `onPlansChanged(projectId, listener): () => void` — the third change source, see *Reads*.
    Returns its own disposer and is registered as an unmount hook, because Obsidian reuses a
    view and a subscription outliving its Vue app stacks another on every reopen.
  - `indexScanCompleted(): boolean` — has the initial index scan run, zero entries included.
    What makes an `ok(null)` authoritative rather than a race against layout-ready; see
    *Error handling* for why the count is the wrong question and why `onProjectsChanged`
    cannot answer this one.
- `ViewRoot.vue` — draws the list or `ProjectDetail` on `context.projectId`, read once per
  mount. Keeps its one `DialogHost`, which now has a second caller.
- `plugin/` — registers the `open-project` command beside the existing ones.
- `sampleProject.ts` and `emptyStates/content.ts` — the two docblocks whose stated trigger this
  slice fires.
- **`CLAUDE.md`** — **two** paragraphs stop being true here, counted by reading that file
  rather than estimated, and they are the same class of defect as the two docblocks above
  rather than housekeeping, because it is the guide the next author reads FIRST. The
  `create-sample-project` paragraph says the plan half "is what this module is still the only
  source of", on the stated grounds that "there is no project-detail surface a 'new plan'
  action could live on". The two-surfaces paragraph says the Renovation project view "now
  draws **a project list**" and stops there. Both are edited in this slice, not after it. The
  vue-router entry is an ADDITION to *Deliberately absent* in the same pass, with decision 4's
  trigger — not a falsification, which is why it is not one of the two.

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
`InspectorStore`. It has concurrent callers from day one, which is exactly the condition that
made the ticket necessary there: without it the slower earlier read lands on top of the faster
later one and content silently reverts with no error anywhere.

**Which callers — and the first draft named two that between them cannot see this slice's own
write.** It listed the store's mount and `onProjectsChanged`, and
`createProjectListChangeSource` subscribes to `ProjectIndexRebuilt`, `ProjectCreated`, and
`ProjectIndexEntryChanged` filtered to `entityType === 'renovation-project'`. `CreatePlan`
publishes `PlanCreated`, which is on none of those lists, and a plan's index entry is dropped
by the third. So a plan created from `NewPlanForm` would not have appeared until the pane was
reopened — on a form whose whole job is to add a row to the list beside it, which is the shape
that invites a user to press Create again and get two. Reported in review.

There are **four** callers, and the fourth is a mechanism rather than a call, for the reason
`projectListChangeSource`'s own docblock gives about the project side:

- **the store's mount**;
- **`onProjectsChanged`**, which stays — this store reads a *project* as well as its plans, so
  a project note renamed, retyped or deleted out of band is its business exactly as it is the
  list's;
- **an awaited `hydrate()` after a successful create**, answering an ORDERING its own handler
  needs — the list is fresh before that handler returns, which a fire-and-forget bus delivery
  cannot promise. `ViewRoot.onCreateProject`'s shape exactly;
- **`onPlansChanged(projectId, listener)`**, answering the CATEGORY: *some plan of this project
  changed, from anywhere*. A new `application/events/projectPlansChangeSource.ts` — a third
  source beside the two that exist, because it asks a third question. `planChangeSource` is
  "this plan changed" and every caller of it binds a plan id; `projectListChangeSource` is "the
  set of projects changed" and is unfiltered. This is "the set of plans in THIS project
  changed", filtered on `PlanCreated`'s payload, which already carries the owning project —
  verified: `CreatePlan.execute` publishes `planCreated({ planId, projectId })`.

**Both paths stay, and the doubled hydrate is bounded rather than tolerated**, by the same
argument the project side already makes: the ticket settles the two racing reads as one. Leaving
the subscription out *because* the form re-reads is precisely the reasoning a review round has
already rejected on the other surface — `create-sample-project` creates a plan through the same
command, and a plan note copied in or arriving through sync reaches the index through
`VaultChangeAdapter` and no form at all.

**Its `ProjectIndexEntryChanged` arm cannot be filtered by project, and that is a stated cost
rather than an oversight.** `ProjectIndexEntryChangedPayload` carries `entityId` and
`entityType` and no owning project — measured — so the arm fires for a change to any plan note
in the vault, and this one leaf re-reads one project's plans. Affordable exactly because the
view is a singleton and the query is project-scoped, which is what makes it different from the
"once per synced zone note" the project list's own filter exists to avoid. *Trigger to narrow
it: that payload gaining the owning project id.*

## Error handling

| Case | Response | Precedent |
|---|---|---|
| `getProject` → `ok(null)`, initial scan completed | Navigate back to the list **and re-read it** | `ProjectOpenOutcome.'missing'`, which already does exactly this |
| `getProject` → `ok(null)`, scan not yet completed | Hold the loading state and wait for the re-hydrate — see below | the restored-leaf hazard `onProjectsChanged` exists for |
| Either read `isErr` | Mapped sentence via `trError` in `.rp-view-message`; **stay on the detail** | `ProjectStoreStatus`'s `missing` / `failed` split |
| Both succeed | `status = 'ready'` | — |

**A failed read is not a missing project**, and navigating away on one would tell a user their
project was deleted because their vault hiccuped. That is the whole reason
`ProjectStoreStatus` keeps the two apart, and it is kept here.

**Nor is an EMPTY INDEX a missing project, which is what the table's first two rows are split
over.** Found while repairing the hydrate callers rather than reported in review, and written
out here because an unqualified `ok(null)` arm would have collided with criterion 8: it is the
same defect the project list already has a subscription for, made worse by this state having
somewhere to go. The index scan runs from `onLayoutReady` and Obsidian
restores its leaves *before* that (SDD §47), so a detail leaf restored with the app hydrates
against an empty index and `getProject` answers a perfectly legitimate `ok(null)`. On the list
that draws the wrong empty state until a rebuild corrects it. Here it would **navigate**, set
`{ projectId: '' }`, and destroy the very view state criterion 8 exists to preserve — a
correction no later rebuild can undo, because the project the user was in is no longer recorded
anywhere.

So the `ok(null)` arm may not fire on a read that could have raced the scan.

**The first version of that constraint said "populated at least once" and would have hung a
pane forever.** Reported in review, and the counter-example is exact: a vault whose only
project note was deleted while Obsidian was closed rebuilds to a legitimately EMPTY index, so
"populated" never becomes true, the `ok(null)` arm never fires, and the restored detail state
holds its loading line for the rest of the session. Trading a destroyed `projectId` for a
permanent spinner is not a fix.

**The question is whether the SCAN HAS RUN, not whether it found anything**, and those are the
same question only in a vault that still has projects. `RenovationPlannerPlugin.startPersistence`
publishes `projectIndexRebuilt()` unconditionally after `index.rebuild(...)` — verified, there
is no count in the call and no branch above it — so a completed empty rebuild announces itself
exactly like a completed full one. The constraint, rather than the implementation, since this
is one for the plan: **navigating away on a missing project requires the initial index scan to
have COMPLETED**, zero entries included. Until then an `ok(null)` holds the loading state; from
then on it is authoritative.

**That needs a seam, and it is a fifth context member rather than a reuse**, which is worth
saying because the obvious reuse does not work. `onProjectsChanged` collapses three events into
one payload-less callback by design — its own docblock argues for that — so a listener cannot
tell a completed rebuild from a `ProjectCreated`, and treating any callback as proof of a scan
would make a create in another leaf authorise the navigation. `RenovationProjectDeps` therefore
takes `indexScanCompleted: () => boolean`, composed at the root over a flag the plugin sets in
the same step that publishes the event. A predicate rather than a subscription because the
store needs the answer AT HYDRATE TIME and the re-hydrate already arrives through
`onProjectsChanged`; adding a second subscription would be a second thing to dispose for a fact
that never goes back to false.

Its own case, driven in the order the hazard is about, and a second one for the empty vault —
because the first passes under both the wrong constraint and the right one, and only the second
tells them apart.

**No partial state at the STORE.** The two reads COMBINE all-or-nothing: either both answered
and the detail draws, or neither did and it does not. There is no honest picture of a project
whose identity loaded but whose plans did not. That is a rule about the pair, and it says
nothing about what happens INSIDE either one.

**But the contrast the next sentence used to draw was false, and the difference is a real
exposure rather than a wording slip.** It read "deliberately unlike the list's additive
`unreadable > 0` notice, which is partial because one read returns many
independently-readable rows" — and `PlanRepository.listByProject` returns many
independently-readable rows too. Measured, its loop does two different things with them:
`if (!one.ok) return one` fails the WHOLE list for one bad note, and
`if (one.value) loaded.push(...)` **silently drops** an indexed id whose `getById` answers
`ok(null)`. So this read is not the list's shape and it is not "all-or-nothing" either; it is
strict in one direction and lossy in the other, and the store above it cannot tell the
difference because both arrive as a successful array.

Neither half is closed by this slice, and both are written down rather than left to be
rediscovered:

- **The lossy half is bounded and self-correcting.** `ok(null)` for an indexed id means the
  note is gone, which `VaultChangeAdapter` corrects on its next pass. A row vanishing for a
  moment is the honest picture of a note that is not there.
- **The strict half is the one with teeth.** A single plan note written by a newer build
  refuses as a `MigrationError`, and that refuses the entire detail state — every other plan
  in the project hidden behind one file's schema version, where the project LIST would have
  shown its readable rows and counted the rest. That asymmetry is inherited from the port,
  not chosen here: changing it means changing `listByProject`'s contract, which
  `ListAssets` and `ListReassignmentTargets` also read through their own repositories.
  *Trigger: a second surface wanting per-row resilience, or the first report of a project
  made unopenable by one plan note.*

**The empty state is structurally gated** on `status === 'ready'` — the
`RenovationProjectStore.emptyStateKey` shape, not `ProjectStore`'s stated-exception one, so a
failed read can never render as "no plans yet".

**The reason for that had to be rewritten, because the first one stopped being true three
paragraphs above.** It read *"this store has no `keepPreviousOnFailure` need — nothing here
re-hydrates after a command that already wrote"*, and the repaired caller list adds exactly
that: an awaited `hydrate()` after a successful create. The decision survives its reason, on
the sibling rather than on the absent condition. `RenovationProjectStore` already re-hydrates
after `ViewRoot.onCreateProject`'s write, already carries a vault-wide subscription, and still
blanks structurally — because the two things that made slice 8 need the option are both absent
from this surface: there is no Konva stage to unmount and rebuild, and no `SaveStateStore`
(one per Plan Editor) for a blanked read to contradict. A plan list replaced by its mapped
sentence is an honest picture; a canvas replaced by nothing was not.

**What is NOT optional is the re-hydration guard, and it is one line that no test names.**
`hydrate` must drop `status` to `'loading'` only when it is not already `'ready'` —
`RenovationProjectStore.hydrate`'s own line, whose docblock records that this store's earlier
draft omitted it and *"every successful create flipped the pane from the empty state to the
`.rp-view-message` loading line and back, a real and avoidable flicker on the one flow this
mechanism exists to serve."* Here the exposure is wider than there, and that is the new part:
`onPlansChanged`'s index arm fires for **any** plan note in the vault, so without the guard a
background sync flickers the whole detail state through its loading line while the user is
reading it. Inheriting the guard costs a condition; discovering it costs a bug report from a
vault nobody can reproduce.

**A create that refuses**, through `useFormCommit` + `routeError` with a per-form
`FieldErrorMap`:

| code | routes to |
|---|---|
| `plan.empty-name` | the `name` field |
| `plan.project-not-found` | a **notice**, and back to the list — the project vanished while the form was open |
| anything else | banner |

**That middle row said "banner, and back to the list" and could not have both**, which is the
remount decision reaching somewhere nobody looked. Navigating rebuilds the tree, the tree
carries `DialogHost`, and `onBeforeUnmount` settles an open dialog with its kind's cancel
result — so the form holding the banner is destroyed in the same gesture that would have
drawn it, and the user is returned to the list having been told nothing at all. Two ways out
and the notice is the better one: keeping the user in a detail state for a project that no
longer exists, so that a banner has somewhere to live, is a worse answer than returning them
to the list, and slice 13's queue renders on `document.body` and therefore outlives the
remount that destroys everything else. This is also the one refusal on this surface that
reaches the user through neither of `useFormCommit`'s two doors, so it is the row most likely
to be re-simplified back into a banner by someone reading the other two.

Every one of those codes needs copy in **both** locale tables, bound to its raise site by a
table copied **from the raise sites** — never from `en.ts`, because a table derived from the
locale file agrees with a typo. Slice 10's ~20 codes shipped with no locale entries at all and
that did not degrade to silence, it degraded to the *wrong sentence*.

The German goes in with `tests/presentation/i18n/strings.test.ts`'s vocabulary rows live:
`Objekt`, never `Material`.

**And the UI strings are enumerated here rather than left as "every new string", because a
list is checkable and an adjective is not.** Criterion 12 asks for every one of them in both
tables; an omission degrades to the fallback, which hides the gap from everyone except the
reader it is wrong for. Modelled on the keys the sibling components already use
(`view.project.list-title`, `view.project.create`, `form.new-project.name`,
`dialog.form.submit`):

| key | where |
|---|---|
| `view.project.back` | the detail header's ‹ back action |
| `view.project.open-note` | the detail header's Open note action |
| `view.project.plans-title` | `PlanList`'s header, beside `view.project.list-title` |
| `view.project.create-plan` | `PlanList`'s `+ New plan` button, beside `view.project.create` |
| `form.new-plan.name` | `NewPlanForm`'s one field |
| `form.new-plan.title` | the dialog descriptor's `title`, resolved by the CALLER |
| `command.open-project` | the palette entry |
| `renovationProject.noPlans` (body + `actionLabel`) | through `EMPTY_STATE_CONTENT`, which holds `StringKey`s and never literals |

Two of those are worth their row for a reason beyond completeness. `form.new-plan.title` is
resolved by the caller and not by the dialog — slice 15's rule, and neither half of it is
caught by lint, since a descriptor's `title:` is none of `I18N_LITERAL_BAN`'s four call sites.
And **the detail header's status reuses `PROJECT_STATUS_LABELS`**, which is not a new key at
all: `ProjectList` already renders it through a local `statusLabel` helper, so the second
consumer is the moment that helper becomes shared rather than copied — two expressions of one
question, three files apart.

Nothing new reaches for `notifyFault`. Every door here is a guarded command or query, so a
fault is already mapped, logged once at the boundary, and returned as a resolved failed
`Result`.

## Testing

**Node** — the request ticket (a slower earlier read must not land on a faster later one); the
three statuses; the structural empty-state gate; `ListPlansByProject` and its DTO mapping; the
`routeError` field map, driven from the raise sites and `grep`ped in the same edit. Plus
`projectPlansChangeSource`: that it delivers `PlanCreated` for its own project and **not** for
another's, and that its `ProjectIndexEntryChanged` arm fires for a plan entry regardless of
project — the stated cost above, pinned as behaviour so that narrowing it later is a deliberate
change rather than a silent one. And `ListPlansByProject` gets the two cases its port's own
loop makes possible and its return type hides: **one unreadable plan refuses the whole list**,
and **an indexed id whose note is gone is dropped from it**. Both are today's behaviour rather
than this slice's choice, so both are pinned here — the first so that softening it is
deliberate, the second so that the row count silently disagreeing with the index is a fact
somebody chose rather than one nobody noticed.

**jsdom** — `ProjectDetail` and `PlanList` markup and emits; `NewPlanForm` keeping the user's
typed value on a rejected commit and dropping a second submit while the first is in flight
(slice 16's two rules); `content.test.ts` flipping `noPlans` to assert its action is
**present**, the way slice 16 flipped `noProjects`. Plus three more. An accepted create puts the
new plan **in the rendered rows** without a reopen — asserted on the markup and not on
"hydrate was called", because the latter is equally true of a build whose subscription hears
nothing and whose create happens to re-read. And a create refused with
`plan.project-not-found` leaves the user on the LIST **and** raises a notice: both halves in
one case, because "it navigated" is equally true of the build that tells the user nothing, and
"a notice appeared" is equally true of the build that strands them in a dead detail state.
A re-hydration must also not flip a `'ready'` detail state through its loading line — the
guard named in *Error handling*, whose absence is a flicker no assertion about final content
can see.

**View level** — the `getState`/`setState` round trip; validation refusing a non-string while
**accepting `''` as the list**, and the detail → list → detail round trip that only passes if
it does; `sync()` not mounting twice on the `onOpen`/`setState` race; `sync()` mounting the
**list** on a first open, which is what the `mounted` flag exists for and what a bare
`projectId === mountedProjectId` guard silently skips; a navigation between two projects
actually remounting, which is the whole of the first review finding and which every other case
here passes without; `rebind` keeping `projectId`. Plus one case that exists because nothing
else would notice it: **`result.history = true`**. That single assignment is the entire reason
the back arrow works, and every other test in this slice passes without it.

And the restored-leaf ordering, in **two** cases, because one of them passes under the wrong
rule as well as the right one:

- a detail state hydrating **before the scan completes** holds its loading state rather than
  navigating to the list, and lands on the project once `onProjectsChanged` fires. Driven in
  the order the hazard is about — hydrate first, rebuild after — since hydrating a scanned
  index passes either way, and the failure this guards is a destroyed `projectId` no later
  read can restore;
- a restored detail state whose project really is gone, in a vault with **no projects at
  all**, reaches the list rather than holding forever. This is the case that discriminates
  `indexScanCompleted()` from the "seen populated" rule it replaced: under that rule the pane
  spins for the session, and every other test in this slice passes anyway.

**The command** — four cases, one per property, because each of the first three FAILS against
the design this document shipped with, and nothing else here would:

- it navigates an **already-open** leaf. Started from a leaf that exists, asserted on that
  leaf's resulting state — not on `setViewState` having been called, which the create branch
  satisfies too;
- two invocations in one tick naming **different** projects leave exactly **one** leaf. Driven
  with two different projects on purpose: the same project passes against a key that coalesces
  on the request, and the singleton breaks only where they differ;
- the later of those two is the project the leaf ends on, **with the FIRST navigation
  deliberately settling last** — the ordering is a ticket, not an accident of scheduling, and
  a case whose two calls happen to resolve in issue order passes against a build that has no
  ordering at all;
- an empty vault reveals the **list** state rather than opening a zero-row picker.

**Wiring** — that the root hands the view both new queries, guarded, and that the refusal
bundle carries them; and that it hands the view `openPlan` and `onPlansChanged` bound to the
real `revealPlanEditor` and the real bus. This needs its own case for the
`slice10CascadeWiring` reason: a composition that forgets a dependency compiles and passes
everything else. `onPlansChanged` needs the sharper version of that case, the one
`renovationProjectWiring` already learned — a root handed a FRESH `createEventBus()` also
compiles and also announces into an object nothing subscribed to, so the case drives a real
`PlanCreated` through and asserts on what a subscriber hears. Also **verify, not assume**,
that `guardCategory.test.ts`'s walk reaches the new queries — it finds doors by shape, and its
own header lists what it cannot see.

**And `tests/helpers/makeRenovationProjectView.ts` grows with the interface, in the same
edit.** It is one of the four entries in `tsconfig.json`'s `include` and it is there for
exactly this: its docblock promises that a grown constructor requirement "meets every consumer
at the same time", and that promise has already been broken once — slice 16 gave
`RenovationProjectDeps` a `commands` bundle and the helper built it out of `createProject`
alone, so `ViewRoot` handed `useFormCommit` a `logger: undefined` that would have TypeErrored
inside the very catch a fault reaches somebody through. This slice adds **four** members to
that same interface. The helper's defaults must answer rather than merely satisfy the type —
its own comment already draws that line for `openProject` — so `openPlan` records the ask and
`onPlansChanged` returns a real disposer.

**Accessibility** — the detail state joins `tests/harness/accessibility.test.ts`, awaiting
`flushPromises()` before scanning and asserting the real markup is in the scanned DOM. That
file has already been burned by scanning one tick early and passing against an empty subtree,
which is indistinguishable from a pass on a compliant one. `noPlans` is scanned **with its
button**: CLAUDE.md records `noZones` as the one action-carrying empty state no axe scan
reaches, and this slice must not make that two.

**Harness** — an index entry for the detail state, captured in both schemes and at
`--width=460`. Spacing, wrapping and contrast are outside every gate this repository has, and
that width has already hidden a real layout defect once. One thing to look for by name, since
it is the risk the `mount` note above describes: **the detail state fills its leaf.** A
collapsed pane is what a stray wrapper in the height chain produces, jsdom cannot see it, and
it is what the harness caught the first time in slice 1.

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
- **Retiring `create-sample-project`.** The command stays; the reason it stays had to be
  measured, because the first version of this entry gave one that is not true. It said the
  command "still seeds zones, an asset and a requirement in one gesture" — it seeds neither an
  asset nor a requirement. `sampleProject.ts` calls exactly three commands,
  `CreateProjectCommand`, `CreatePlanCommand` and `CreateZoneCommand`, for one project, one
  plan and the five entries in `SAMPLE_ZONES`.

  That matters because it removes the entry's own justification. With slice 16 having given
  the project half a real surface and this slice giving the plan half one, **every entity this
  command seeds is now reachable by hand** — zones since slices 6 and 8 gave `DrawPolygonTool`
  a way to draw one. So the honest reason is the smaller one its docblock already leads with:
  it is the vault-side equivalent of `npm run harness`, one gesture that produces something
  worth LOOKING AT, and a scene assembled by hand is six gestures that a reviewer will skip.
  A convenience, no longer a sole source. Its docblock changes here, and the paragraph that
  changes is the one naming the plan gap. *Trigger: it stops being used — nobody reaches for
  it when opening a vault to look at the canvas.*
- **Plan rename and delete.** Deleting a plan means deciding what happens to its zones, which
  is `deleteZoneFlow`'s question one level up. *Trigger: a `DeletePlanCommand` exists.*
- **Two detail panes side by side.** The view stays a singleton; wanting this is wanting the
  third `ItemView` decision 1 rejected. *Trigger: an `SDD §11` amendment.*
- **`PlanEditorView.setState` setting its own `ViewStateResult.history`.** Decision 3 says the
  Plan Editor "gets the same one-line win whenever it is next touched", and left at that it is
  the shape CLAUDE.md has a rule against: *a deferral written into a comment is a deferral
  nothing schedules* — no gate reads a trigger, and the slice that trips one has no reason to
  open the file stating it. So it is listed here instead, where the register can see it.
  Deliberately not folded into this slice: the parameter is currently `_result`, changing it
  means deciding whether a plan swap in one leaf is a history entry, and that question belongs
  to whoever owns the editor's navigation. *Trigger: the next change to `PlanEditorView`'s
  state handling.*

## Open questions

None. The one this document carried on 2026-08-30 — whether the detail state should also be
reachable from a palette command — was settled the same day and is decision 6 above. It is
recorded as a decision rather than deleted because its empty-vault behaviour deliberately
differs from `open-plan-editor`'s, and a difference nobody wrote down is a difference somebody
later removes.
