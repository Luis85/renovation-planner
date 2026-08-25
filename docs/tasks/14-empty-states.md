---
type: Task
parent: "[[Shared UI vocabulary]]"
order: 20
dependsOn:
  - "[[05-canvas-rendering-and-editor-shell]]"
status: ""
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
---
# Design Slice 14: Empty States

## Purpose

PRD §94 states the requirement in one line: "Every central view should provide
actionable empty states." Today neither central view (SDD §11: Renovation Project,
Plan Editor) has one. `RenovationProjectView` mounts an empty Vue app with no content
at all (slice 1); the Plan Editor renders correctly with zero Zones or no background
(slice 5's render pipeline is a pure function of whatever `ProjectStore` holds,
including nothing), but "renders correctly" and "is comprehensible" are different
claims — an empty Konva stage with no zones and no background is, to a user, a blank
gray rectangle, not a lightbulb.

This slice closes that gap with one reusable component and a small, typed registry of
copy — not a page: the actual affordance (create a project, import a plan's
background, draw a zone) is a command, a modal, or a tool activation another slice
already owns. This slice's job stops at rendering the message and firing the one event
that hands off to it.

## Scope

### In scope

- The `EmptyState` Vue component: an optional icon/illustration slot, a required
  headline, a required body message, and an optional primary action button that emits
  one event on click.
- A content registry mapping each central view's specific empty condition to its
  headline/body/action-label copy — at minimum, three entries: `RenovationProjectView`
  with no Projects, the Plan Editor with no Plan background yet (PRD's own worked
  example), and the Plan Editor with a Plan that has a background but no Zones yet.
  These last two are distinct states with distinct copy; neither is a fallback for the
  other.
- The pure selection logic that turns a view's already-hydrated query result into
  "which empty-state key, if any, applies right now" — table-driven, no DOM, no
  Obsidian.
- Wiring each empty state's action to the ONE existing entry point it hands off to
  (CLAUDE.md's one-action-every-input rule, applied to a new kind of input): a click on
  the empty state's button is not a second, independently-decided way to create a
  project, import a background, or draw a zone.
- Extending `RenovationProjectView` (slice 1) with its first real data dependency — a
  `ListProjects` query and a Pinia store to hold the result — since slice 1 explicitly
  left this for later: *"Query-service access is constructor-injected... exactly like
  `RenovationProjectView` would be once it has data needs."* This is that data need.
- Extending `ProjectStore` (slice 5) with the Plan Editor's empty-state selection as a
  getter over state it already holds (`plan`, `zones`) — no new store, no new query.

### Out of scope (covered by other slices)

- **What the action actually does.** "Create a project" opens a project-creation
  modal (slice 15) that, on submit, dispatches `CreateProjectCommand` (slice 3).
  "Import a plan" opens slice 5's Vault-file picker, which dispatches that slice's
  `SetPlanBackgroundCommand` (slice 5, Design → §5) — this slice calls it and owns none
  of it. "Draw a zone" activates `DrawPolygonTool` (slice 6/8) by setting
  `EditorStore.activeToolId`. None of the three flows are designed, redesigned, or
  reimplemented here.
- **Modals themselves** — slice 15. An empty state's action *opens* one; it is not one.
- **Loading states.** A query in flight (before its first result arrives) is not this
  slice's concern; neither the PRD nor any slice in this map currently asks for a
  loading skeleton, so none is added speculatively.
- **Error states.** A query that fails (a failed `Result`) is never rendered as an empty
  state — see Design → "Empty is not the same claim as error," and slice 17
  (Presentation-Layer Error Surfacing), which owns what a failed query *does* render as.
- **A "dangling reference" state** — `GetPlan(planId)` succeeding with `Ok(null)` for a
  `planId` that no longer resolves to any Plan (e.g. the file was deleted from outside
  Obsidian). That is not "no Plan yet," it is a broken reference; conflating the two
  would tell a user "you haven't imported a plan" when the real problem is "this tab
  points at something that no longer exists." This slice explicitly does not select an
  empty-state key for that case (see Design, table) and leaves it for slice 17.
- **The Renovation Project view's *populated* content** — an actual list/dashboard of
  existing Projects once `ListProjects()` returns something. No slice in this map
  builds that (it is feature work, same category as the "future" views in SDD §11);
  this slice defines only what renders in its place when the list is empty.
- **Every other empty-state copy the PRD's "every central view" will eventually need**
  once Budget, Schedule, Procurement, or Dashboard views exist (SDD §11, "Future") —
  those views don't exist yet, so there is nothing to register content for.
- Form validation feedback (slice 16) and notifications/toasts (slice 13) — a
  save-state toast and an empty state answer different questions ("did my last write
  succeed" vs. "is there legitimately nothing here yet") and never share a surface.

## Dependencies

- **Slice 1 (Plugin Bootstrap & Composition Root)** — `RenovationPlannerPlugin`'s
  composition root and `RenovationProjectView`'s mount/unmount lifecycle; this slice
  extends the view's constructor rather than replacing it, per the exact seam slice 1
  reserved (a new field, never a second wiring point).
- **Slice 3 (Domain Foundation)** — `CreateProjectCommand` is the action-button target
  for the Renovation Project view's empty state; referenced by name only, not
  redesigned.
- **Slice 4 (Persistence & Repository Layer)** — the `ProjectRepository.listAll()`
  implementation the new `ListProjects` query wraps (the port method itself is slice
  3's), and `GetPlan`/`FindZonesByPlan`'s `Result<T | null, PersistenceError>` shape.
  That shape is load-bearing here, not incidental: this slice's selectors exist to tell
  `ok([])`/`ok(plan-with-null-background)` (legitimately empty) apart from `ok(null)` (a
  dangling reference) apart from `isErr` (a failed read), and all three have to remain
  distinguishable at the query boundary for that to be possible.
- **Slice 5 (Canvas Rendering & Editor Shell)** — the Vue/Pinia shell `EmptyState`
  mounts inside; `ProjectStore`'s existing `plan`/`zones` state, which this slice adds a
  getter over; `PlanEditorQueryServices`, `PlanDto`, `ZoneDto`, `PlanBackgroundRef` —
  consumed, not redefined. The five-region editor shell (§60) is unchanged: the empty
  state occupies the `PlanCanvas` region only; toolbar, layers panel, inspector, and
  status bar stay exactly as slice 5 built them.
- Forward references, not hard dependencies (same relationship slice 5 has to slices
  6–8): slice 6's `EditorStore.activeToolId` / `ToolId` (`'draw-polygon'`), and slice
  15's project-creation modal. This slice's own Definition of Done does not require
  those slices to exist yet — a click on an action button whose target isn't built yet
  is simply not wired, the same way slice 5 shipped `InteractionLayer` empty.

### Carried forward from the slice 8 review pass (2026-08-25)

The slice 8 review pass changed how `ProjectStore` settles, which is what
this slice's selectors read.

- **`hydrate` takes a request ticket: the last hydration STARTED owns the final state, not
  the last to RESOLVE.** It gained a second concurrent caller in slice 8 (the post-command
  refresh, beside the plan-change listener that `ProjectIndexRebuilt` fires on every leaf),
  and without the ticket a slower earlier read overwrote a fresher later one — a
  just-drawn zone vanishing from the canvas with no error. A superseded call now returns
  having touched none of `status`, `plan`, `zones` or `error`, so a selector never sees a
  half-applied older answer.
- **`reset()` invalidates a hydration still in flight**, so a closing leaf cannot have the
  plan it was reading painted back a tick later — which would otherwise be an empty state
  replaced by content nobody asked for.
- **`PlanDto` carries `calibration` now**, `null` while a plan is uncalibrated. That is a
  distinguishable "not ready yet" this slice may want to name, alongside the
  `ok([])` / `ok(null)` / `isErr` distinctions it already turns on.

## Design

### 1. The `EmptyState` component

```text
EmptyState.vue
 ├── slot "icon"       — optional, caller-supplied content, empty by default
 ├── prop  headline     — required, string
 ├── prop  body         — required, string
 ├── prop  actionLabel  — optional, string; button renders iff present
 └── emit  "action"     — fired once per click; component calls nothing itself
```

`EmptyState` imports no command, no query service, no store, and no Obsidian API — it
is pure presentation, reusable by a future Budget/Schedule/Procurement view without
depending on this slice's registry or on Plan/Project types at all. The composing view
supplies copy as props and a handler for `@action`; `EmptyState` does not know or care
what that handler does.

**The icon slot deliberately renders whatever it is given, and nothing on its own.**
CLAUDE.md's "Deliberately absent" list is explicit that icon rendering (`setIcon`) has
no first caller yet, and awaits "the first `setIcon` call" as its own trigger — adding
one here, inside a slot nobody's content registry populates, would be exactly that
trigger arriving as a side effect of an unrelated slice. None of this slice's three
registry entries pass anything into the `icon` slot; it exists as a typed extension
point (a future illustrated empty state does not need a component change), not as a
feature this slice delivers.

### 2. Content registry

The registry holds **`StringKey`s, not copy**. `src/presentation/i18n/` already owns
every user-facing string in this plugin (`t(language, key)`, with `en.ts` as the complete
table and `de.ts` alongside it), and PRD §94's own worked example is written in German —
so an empty state whose headline was an English literal would be the one surface in the
plugin that could not answer the requirement its own PRD section states. The three
entries' copy is added to `en.ts` and `de.ts`; this file maps a state to its keys.

```typescript
export interface EmptyStateContent {
  readonly headline: StringKey;
  readonly body: StringKey;
  readonly actionLabel?: StringKey;
}

export const EMPTY_STATE_CONTENT = {
  renovationProject: {
    noProjects: {
      headline: 'empty.project.no-projects.headline',
      body: 'empty.project.no-projects.body',
      actionLabel: 'empty.project.no-projects.action',
    },
  },
  planEditor: {
    // PRD §94's own worked example ("Noch kein Plan vorhanden…") is the de.ts entry
    // for these keys, not a comment about a translation that does not exist.
    noBackground: {
      headline: 'empty.plan.no-background.headline',   // en: "No plan yet"
      body: 'empty.plan.no-background.body',
      actionLabel: 'empty.plan.no-background.action',
    },
    // Deliberately distinct copy from noBackground — a Plan with a background but no
    // Zones is a different, later stage of the same onboarding flow (PRD §93), not a
    // variant wording of "nothing here yet."
    noZones: {
      headline: 'empty.plan.no-zones.headline',        // en: "No zones yet"
      body: 'empty.plan.no-zones.body',
      actionLabel: 'empty.plan.no-zones.action',
    },
  },
} as const satisfies Record<string, Record<string, EmptyStateContent>>;
```

Typing the fields as `StringKey` rather than `string` is what makes this checkable: a key
with no entry in `en.ts` fails to compile, so "the registry and the locale tables agree"
is a compiler guarantee rather than a review item.

A registry, not a switch statement scattered across two views: adding a fourth entry
(a future central view) is one object literal, never a new `if` chain in a component.

### 3. Trigger conditions

Each trigger is stated as a query's **already-succeeded** result, per SDD §65's
`Result<T, AppError>` — never a raw exception, never a pending state:

| View | Empty-state key | Trigger (all queries have already resolved `Ok`) |
| --- | --- | --- |
| Renovation Project | `renovationProject.noProjects` | `ListProjects()` → `[]` |
| Plan Editor | `planEditor.noBackground` | `GetPlan(planId)` → a Plan whose `background` is `null` |
| Plan Editor | `planEditor.noZones` | `GetPlan(planId)` → a Plan whose `background` is **not** `null`, **and** `FindZonesByPlan(planId)` → `[]` |
| Plan Editor | *(none — not this slice)* | `GetPlan(planId)` → `null` (no such Plan resolves at all) |
| Plan Editor | *(none — normal render, slice 5)* | Plan has a background **and** at least one Zone |

**Precedence.** A Plan Editor can only ever be in one of these states at a time, so the
check is a short-circuit, not independent flags:

```text
if plan === null:            hand off — not an empty state (see below)
else if plan.background === null:  render planEditor.noBackground
else if zones.length === 0:        render planEditor.noZones
else:                               render normally (slice 5)
```

`noBackground` is checked first even though a background-less Plan will also,
necessarily, have zero Zones: PRD §93's own onboarding order is Import Plan →
Calibrate → Create Zone, so a user with neither a background nor a Zone is asked to do
the *first* missing step, not told about the *second*. The two states never render
simultaneously, and this ordering is why: nothing here re-derives "which is more
missing," it is a fixed precedence over an onboarding sequence PRD §93 already fixes.

### 4. `Ok(null)` is not "no Plan yet"

`GetPlan(planId)` returning `Ok(null)` means the ID stored in this leaf's persisted
view state (slice 5's `PlanEditorViewState.planId`) no longer resolves to any Plan —
the note was deleted, moved outside the plugin's index, or the workspace layout is
stale. That is a broken reference, not a legitimate "nothing here yet": the Plan
Editor was *supposed* to have something, and doesn't. Rendering `planEditor.noBackground`
for this case would read to a user as "you haven't imported a plan," which is false —
they may have imported one and then it vanished. This slice's selector returns no key
at all for `plan === null`; what actually renders in that slot is slice 17's decision,
not narrowed here.

### 5. Empty is not the same claim as error

An empty state means *the query succeeded and legitimately returned nothing* — `[]`,
or a Plan with a `null` field, is exactly the data `ListProjects`/`GetPlan` are
supposed to return in that situation, no different in kind from returning a populated
result. A failed query (a failed `Result`, SDD §65) is never silently downgraded into
an empty state: that would hide a real, actionable problem (a persistence error, a
migration failure) behind cheerful onboarding copy telling the user to just create
something. The composing view branches on `result.ok` before ever calling this slice's
selectors; an `Err` is routed to slice 17's error surface and never reaches
`selectPlanEditorEmptyState`/`selectRenovationProjectEmptyState` at all — those two
functions' input types don't admit an error to begin with (see Interfaces & Contracts).

### 6. Action wiring

Per CLAUDE.md's "one action, every input": the empty state's button is one more
caller of the same function every other entry point already calls, never a second
decision-maker.

```typescript
// RenovationProjectView's root component (illustrative). `resolve` maps a registry
// entry's StringKeys through t() once; EmptyState itself never sees a key.
<EmptyState
  v-if="projects.length === 0"
  v-bind="resolve(EMPTY_STATE_CONTENT.renovationProject.noProjects)"
  @action="openCreateProjectModal()"   // slice 15's modal → CreateProjectCommand (slice 3)
/>
```

```typescript
// PlanEditorRoot's canvas region (illustrative) — replaces PlanCanvas, not the shell
<EmptyState
  v-if="projectStore.emptyStateKey === 'noBackground'"
  v-bind="resolve(EMPTY_STATE_CONTENT.planEditor.noBackground)"
  @action="openPlanBackgroundPicker(planId)"   // slice 5's picker → SetPlanBackgroundCommand
/>
<EmptyState
  v-else-if="projectStore.emptyStateKey === 'noZones'"
  v-bind="resolve(EMPTY_STATE_CONTENT.planEditor.noZones)"
  @action="editorStore.activeToolId = 'draw-polygon'"   // slice 6's ToolId, slice 8's tool
/>
<PlanCanvas v-else />
```

Setting `activeToolId` directly (rather than dispatching a command) is deliberate: a
Zone cannot be created with zero user-supplied geometry, so there is no
`CreateZoneCommand` call to make yet — the correct action is putting the user into the
same drawing mode a toolbar button would (slice 6/8), not fabricating an empty Zone.
"Import a plan" and "Create a project," by contrast, do end in a command dispatch,
just not one this slice performs directly — each hands off to exactly one place
(a modal's submit handler, or slice 5's background picker), matching the same rule.

## Interfaces & Contracts

```typescript
// presentation/components/EmptyState.vue — script-setup contract. Takes RESOLVED
// strings, not keys: the component knows nothing about i18n, so it stays reusable by
// a future view (or a test) that has copy from somewhere else. The composing view
// resolves EMPTY_STATE_CONTENT's keys through t() and passes the results down.
export interface EmptyStateProps {
  readonly headline: string;
  readonly body: string;
  readonly actionLabel?: string;
}
// slots: icon (optional, unnamed content passed through as-is)
// emits: (e: 'action'): void
```

```typescript
// presentation/emptyStates/content.ts — keys only; the copy lives in i18n/locales/
export interface EmptyStateContent {
  readonly headline: StringKey;
  readonly body: StringKey;
  readonly actionLabel?: StringKey;
}
export const EMPTY_STATE_CONTENT: {
  readonly renovationProject: { readonly noProjects: EmptyStateContent };
  readonly planEditor: {
    readonly noBackground: EmptyStateContent;
    readonly noZones: EmptyStateContent;
  };
};
```

```typescript
// presentation/emptyStates/selectors.ts — pure, no DOM, no Obsidian
export type PlanEditorEmptyStateKey = 'noBackground' | 'noZones';

// plan is the already-unwrapped Ok value: null only means "no such Plan resolves,"
// never "query failed" — an Err never reaches this function (see Design §5).
export function selectPlanEditorEmptyState(
  plan: PlanDto | null,
  zones: readonly ZoneDto[],
): PlanEditorEmptyStateKey | null {
  if (plan === null) return null;               // broken reference — slice 17, not here
  if (plan.background === null) return 'noBackground';
  if (zones.length === 0) return 'noZones';
  return null;                                    // normal render
}

export function selectRenovationProjectEmptyState(
  projects: readonly ProjectSummaryDto[],
): 'noProjects' | null {
  return projects.length === 0 ? 'noProjects' : null;
}
```

```typescript
// presentation/stores/ProjectStore.ts (slice 5, extended — not a new store)
// Adds one getter over state slice 5 already hydrates; no new field, no new query.
interface ProjectStoreGetters {
  emptyStateKey: PlanEditorEmptyStateKey | null; // selectPlanEditorEmptyState(plan, [...zones.values()])
}
```

```typescript
// presentation/stores/RenovationProjectStore.ts — new; RenovationProjectView's first store
interface RenovationProjectStoreState {
  readonly projects: readonly ProjectSummaryDto[]; // hydrated once, in onOpen, via ListProjects
}
```

```typescript
// application/queries/ListProjects.ts — thin wrapper, same shape as GetPlanQuery (§35).
// Wraps ProjectRepository.listAll(), which slice 3 declared on the port and slice 4
// implemented; introduces no new persistence behavior, only the Get/List/Find-named
// entry point (§80) nothing had consumed until now. `listAll` was declared ahead of
// this consumer precisely so adding one is a query file, not a port change.
interface ListProjectsQuery {
  execute(): Promise<Result<ProjectSummaryDto[], PersistenceError>>;
}
```

```typescript
// presentation/views/RenovationProjectView.ts — constructor extended, not replaced
export interface RenovationProjectQueryServices {
  listProjects(): Promise<Result<ProjectSummaryDto[], PersistenceError>>;
}
// RenovationProjectView(leaf: WorkspaceLeaf, queries: RenovationProjectQueryServices)
```

## Persistence Impact

- **Read-only.** This slice calls `ListProjects()` (new query, wrapping slice 4's
  existing `ProjectRepository.listAll()`) and reuses `GetPlan`/`FindZonesByPlan`
  (slice 5) exactly as already defined. No repository gains a new method; no new
  Vault write path, sidecar, or frontmatter field is introduced anywhere in this slice.
- `ListProjectsQuery` is two lines of wiring around a repository method that already
  existed, in the same shape as `GetPlanQuery` (slice 4) — not new persistence
  architecture, only the missing named query nothing had called yet.
- Both new Pinia additions (`RenovationProjectStore`, `ProjectStore.emptyStateKey`) are
  fully rebuildable from the same queries at any time (ADR-005) — ADR-005's guarantee
  that Pinia holds no canonical data extends unchanged to this slice's own additions.
- An empty-state key is never itself persisted: it is derived, every render, from
  already-hydrated query results, never written back anywhere.

## Testing Strategy

- **`EmptyState.vue` component tests** (`@vue/test-utils`, per §73): headline and body
  always render; the action button renders iff `actionLabel` is passed, and a click
  emits exactly one `action` event with no payload; content passed to the `icon` slot
  renders verbatim, and the slot renders nothing when omitted.
- **Registry content test**: every `StringKey` in `EMPTY_STATE_CONTENT` resolves to a
  non-empty string in `en.ts` (a missing key does not compile, but a stale one would
  render its own name), and the same holds in `de.ts` — PRD §94's worked example is
  German, so the German path is the one this requirement is actually stated against. A
  direct assertion that `planEditor.noBackground` and `planEditor.noZones` resolve to
  different `headline` and `body` strings in every locale — the two states are required
  to read as different problems, not variants of one message, and a translator can
  collapse that distinction as easily as an author can.
- **Selector unit tests** (plain node, no DOM, no Obsidian):
  - `selectRenovationProjectEmptyState([])` → `'noProjects'`; any non-empty array →
    `null`.
  - `selectPlanEditorEmptyState` table-driven over all four combinations of
    `plan.background` (`null`/set) × `zones.length` (`0`/`>0`), plus `plan === null` —
    asserting the exact precedence in Design §3, including that `plan === null` never
    produces `'noBackground'` or any other key.
- **Wiring/regression test**: given a failed-`Result` fixture from `GetPlan` or
  `FindZonesByPlan`, assert the composing view never calls either selector and never
  renders `EmptyState` — the branch on `result.ok` happens first, asserted directly
  rather than trusted by inspection (per CLAUDE.md: "a category invariant is checked at
  the forbidden thing, not by listing the places").
- **Action wiring tests**: clicking each of the three registry entries' action buttons
  invokes the one expected handler (`openCreateProjectModal`,
  `openPlanBackgroundPicker`, `activeToolId = 'draw-polygon'`) exactly once, and no
  test path calls a repository or a command directly from `EmptyState` itself.
- **`ListProjectsQuery` test**: given a fixture `ProjectRepository` with zero, one, and
  several projects, asserts the query's `Result` matches `listAll()`'s own result
  one-for-one — no transformation beyond unwrapping the repository call.
- **Store tests**: `RenovationProjectStore` hydrates from a mocked
  `ListProjectsQuery`; `ProjectStore.emptyStateKey` is asserted against
  `selectPlanEditorEmptyState` with the store's own `plan`/`zones` state, not
  reimplemented inline.
- **Manual/harness verification**: `npm run harness` for both Plan Editor empty states
  and the Renovation Project view's empty state, in light and dark, confirming body
  text wraps and the action button is keyboard-reachable — faithful to Obsidian's
  default themes only, per the harness's documented limits (CLAUDE.md).

## Definition of Done

1. `EmptyState.vue` exists, is imported by both `RenovationProjectView`'s root
   component and the Plan Editor's canvas region, and satisfies its component contract
   (headline/body always render; action button conditional on `actionLabel`; one
   `action` event per click; `icon` slot passes through untouched).
2. `EMPTY_STATE_CONTENT` has exactly the three entries in Design §2, holding
   `StringKey`s rather than literals; every key resolves in both `en.ts` and `de.ts`,
   and the two Plan Editor entries resolve to mutually distinct copy in each. No
   user-facing literal appears anywhere under `presentation/emptyStates/`.
3. `selectRenovationProjectEmptyState` and `selectPlanEditorEmptyState` are pure,
   Obsidian-free, DOM-free functions whose full input/output table (Design §3) is
   covered by tests, including the `plan === null` case producing no key.
4. `RenovationProjectView` is constructor-injected with a `ListProjectsQuery` and
   renders `renovationProject.noProjects` when it resolves to `[]` — this is the
   view's first real data dependency, per slice 1's own forward reference.
5. The Plan Editor renders `planEditor.noBackground` when the open Plan's `background`
   is `null`, `planEditor.noZones` when it is set but `FindZonesByPlan` returns `[]`,
   and neither when both are populated — verified against slice 5's existing
   `ProjectStore` state, with no change to the five-region shell layout outside the
   `PlanCanvas` region.
6. A simulated failed `Result` from either query never renders `EmptyState` and never
   reaches either selector — asserted by a test, not by code review.
7. Each of the three actions invokes exactly the one hand-off named in Design §6 and no
   second, independently-implemented path to the same effect exists anywhere in the
   codebase.
8. `npm run check` (build, lint including the layer-dependency rules, coverage-
   thresholded tests, fallow) passes with this slice's code included.

## References

- PRD §94 Empty States — the requirement this slice satisfies, including its own
  worked example ("no plan yet, import a floor plan, sketch, or garden plan"), stated
  there in German, which is why this slice's copy goes through `t()` rather than
  English literals.
- `docs/requirements/Multilanguage.md` and `src/presentation/i18n/` — the standing
  requirement and the existing `t(language, key)` lookup this slice's three entries
  add keys to.
- PRD §93 Installation & Onboarding — the Create Project → Import Plan → Calibrate →
  Create Zone order that fixes the `noBackground`-before-`noZones` precedence.
- PRD §8 Core Entities — Plan's `background` field, the trigger `selectPlanEditorEmptyState`
  reads. (PRD §8 also lists "linked plans" on Project; slice 3 deliberately does not
  store it as a field, and this slice does not read it — `ListProjects` enumerates
  Projects, which is unrelated.)
- SDD §11 Workspace Views — the two "central" primary surfaces this slice covers;
  Budget/Schedule/Procurement/Dashboard are named as future, out of scope here.
- SDD §35 Query Architecture, §80 Naming Conventions (`ListAssets` as the pattern
  `ListProjects` follows) — the query this slice adds.
- SDD §64 Error Model, §65 Result Pattern — the `Ok`/`Err` distinction underpinning
  "an empty state is a successful, empty result, never a failed one."
- SDD §66 Error Boundary — the hand-off point for an `Err` result; not designed here.
- SDD §84 CSS and Theme Integration, §85 Accessibility — `EmptyState`'s copy and button
  use Obsidian theme tokens and are keyboard-reachable, consistent with slice 5's own
  baseline.
- SDD §92 Architecture Completion Criteria, items 4 ("UI communicates through commands
  and queries") and 15 ("new views can reuse the same application/domain layers") —
  why an empty-state action is always a hand-off to an existing command/query/tool,
  never a new write path invented at the presentation layer.
- ADR-004 Vue 3 for Plugin UI — `EmptyState` is a Vue component, per the same mounting
  strategy slice 1 and slice 5 established.
- ADR-005 Pinia for Presentation State — both this slice's Pinia additions are cache
  only, rebuildable from the same queries.
- `docs/requirements/Architecture and Software Design.md` — slice map, shared conventions, and the bare-§N-vs-PRD-§N
  disambiguation this document follows throughout.
