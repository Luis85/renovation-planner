# Design slice 17 — Presentation-layer error surfacing

**Date:** 2026-08-30
**Slice document:** [`docs/tasks/17-presentation-layer-error-surfacing.md`](../../tasks/17-presentation-layer-error-surfacing.md),
which already carries the decision procedure, the eight-row category table and the Definition
of Done. That document is the authority on *what the table says*; this one is the authority on
*how it binds to code*, and records the measurements taken before any was written.
**Baseline:** `claude/next-increment-ovurmx` at `f94ce6e`, which is `origin/main` — slice 12
merged as PR #39. (Local `main` is stale at `00b6dcd`; read `origin/main`.)

## Why this slice, and what it is not

The slice map reads `Shared UI vocabulary | 13–17 | Mutually independent; 17 integrates them`.
Slices 13, 15 and 16 each built a surface — a toast/save-state system, a dialog framework,
inline field validation — without needing to know which of slice 2's eight error categories
would ever reach them. Slice 14 then *deferred two cases here by name*. This slice is the
wiring rule, and it adds exactly one container of its own.

It is an integration slice, so the temptation is to read it as documentation. It is not: the
measurements below found **two live defects that the Definition of Done names as things to
prove, and which are false today**.

## What was measured before designing

Every claim below was run against the baseline tree, not read from a comment.

### Finding 1 — the autosave path double-reports, today (real; the DoD forbids it)

Definition of Done item 3: *"A Zone-save `PersistenceError` on the autosave path flips slice
13's indicator to Save Error and does not also raise a toast for the same failure."*

It raises both. `runtime.ts`'s `provideEditorRuntime` composes the dispatcher as
`wrapDispatcher(history, withSaveStateTracking(withEditorStateRefresh(history), useSaveStateStore()))`,
so every dispatch passes through the save-state tracker. Then:

- `withSaveStateTracking`'s `track` — `else if (affectsSaveState(result.error)) saveState.resolveErr()`.
  `Persistence` is not in `PRE_WRITE_CATEGORIES`, so this is `true`: the indicator flips to
  **Save Error**.
- `runtime.ts`'s `undo`/`redo` call `notifyIfRefused(reportFault(logger, wrappedDispatcher.undo()))`,
  and `notifyIfRefused` calls `notifyError(result.error)`: a **toast**.

Both fire for one failure. The same holds for every *tool gesture*, through a different door:
`registerEditorTools` gives `SelectTool`, `DrawPolygonTool` and `CalibrateTool` each a
`reportRejected: notifyError`, and all three dispatch through that same tracked dispatcher. So
a zone drag whose save fails reports twice, and slice 11's own illustrative code — which the
slice document cites as the thing this table exists to reconcile — is what the live code still
does.

This is the defect the slice exists to fix, and it is worth stating that it is a defect of
*two mechanisms each being individually right*. Neither `affectsSaveState` nor `notifyIfRefused`
is wrong on its own; there was simply nothing that owned the question of which one should
speak.

### Finding 2 — `calibration.invalid-distance` cannot render inline at all today

Definition of Done item 4 asks that `calibration.invalid-distance` render as an **inline field
error** while `calibration.coincident-points` and `calibration.degenerate-scale` render as
toasts, "both proven by tests distinguishing the two by origin".

The first is currently unreachable as an inline error, structurally rather than by oversight.
The `supplyKnownDistance` that `registerEditorTools` hands `CalibrateTool` opens the
`KnownDistanceForm` dialog, **awaits its result, and returns a plain number**; the dialog is
closed by the time `createCommand()` dispatches and the command refuses. There is no form left
to render a field error in, so the refusal falls to `reportRejected: notifyError` — a toast —
like the other two.

Slice 16 already settled the shape that fixes it and wrote down why: `NewProjectForm` owns its
own dispatch precisely "so a rejection renders under the field it is about and keeps the dialog
OPEN". `KnownDistanceForm` has to take the same shape. That is the single largest piece of work
in this slice and it is not a rewiring — it is a restructuring of one gesture.

### Finding 3 — the toast door has ten call sites, not seven

Counted by grep across `src/`, excluding comments and the import lines:

| Module | Site, by name | Origin it will declare |
|---|---|---|
| `RequirementRow.vue` | the quantity override's `useFieldCommit({ notify })` | `form-field-commit` |
| `RequirementRow.vue` | the cost override's `useFieldCommit({ notify })` | `form-field-commit` |
| `runtime.ts` | `registerEditorTools` → `SelectTool.reportRejected` | `autosave-write` |
| `runtime.ts` | `registerEditorTools` → `DrawPolygonTool.reportRejected` | `autosave-write` |
| `runtime.ts` | `registerEditorTools` → `CalibrateTool.reportRejected` | `explicit-operation`, and `form-field-commit` after Finding 2 |
| `runtime.ts` | `notifyIfRefused` | `autosave-write` |
| `runtime.ts` | `createDeleteZoneAction`'s refused-outcome arm | `explicit-operation` |
| `runtime.ts` | `commitEdit` | `form-field-commit` |
| `sampleProject.ts` | `createAndOpen`'s refusal arm | `explicit-operation` |
| `planEditorCommands.ts` | `applyBackground`'s refusal arm | `explicit-operation` |

An earlier statement in this session put the figure at seven. Ten is the measured number; the
three extra are the `reportRejected` bindings, which are the sites where Finding 1 bites
hardest. Recorded rather than quietly corrected, because the count was used to size the work.

`applyBackground`'s call site is worth reading before editing it: its comment already names
this slice — *"slices 13 and 17 change what an error notice IS, once, at that function"* — and
declines to hand-spell the notice for exactly the reason this slice closes the door. That call
site predicted the change; it should need only its origin added.

### Finding 4 — the preemption remedy is already argued, in `severity.ts`

`severity.ts`'s `AUTO_DISMISS_MS` docblock states the exposure and pre-selects the fix: *"revisiting it means giving
`error` priority over a held `warning` rather than raising `MAX_VISIBLE_NOTICES`, which only
moves the number at which this starts."* Confirmed against `queue.ts`'s `promote`: it
iterates `entries` in insertion order and fills any free slot, with no severity term. So three
standing warnings — `background.unsupported`, `cascade.aborted`, `cascade.stale-marker-failed`,
which are three distinct sentences that never dedup and never expire — hide every later error
*and its announcement*, since `announce` rides `render` and `render` runs only for a shown
notice.

This slice takes that remedy as written. It does not raise the cap.

### Finding 5 — `affectsSaveState` asked for this slice's check, in the future tense

`affectsSaveState`'s docblock closes by narrating that an earlier draft claimed to be
"DERIVED from [slice 17's] table" while no such table existed, and rewrites the claim as a
future obligation: *"when slice 17 authors its error-to-surface table, this predicate is one of
the things that table has to agree with, and the agreement will need a check of its own,
because nothing today can notice the two disagreeing."*

That check is this slice's, and it is what closes the slice document's carried-forward
exposure (a).

## Scope, decided

**In:** the policy module and its table; the enforcement that makes reaching a surface require
having asked; the autosave double-report (Finding 1); the calibration split (Finding 2); the
two view states slice 14 deferred; the bootstrap session-failure state; toast preemption
(Finding 4); the `affectsSaveState` agreement check (Finding 5).

**Out, and staying documented as open:** the `SaveStateIndicator` `role="status"` announcement
noise, and widening `InspectorDto` with an error variant. Both are named in the slice document
as this table's territory; both are declined here, and the honest reason is size rather than
principle — this slice already carries two structural changes. Each keeps its existing written
record; neither is ticked.

## Architecture

### 1. The policy — `presentation/errors/errorSurfacePolicy.ts`

Joins the folder slice 16 opened for `route-error.ts` rather than opening a second one beside
it, which is what the slice document's File-layout note asks for.

```typescript
export type ErrorOrigin =
	| { readonly kind: 'bootstrap' }
	| { readonly kind: 'form-field-commit'; readonly field: string }
	| { readonly kind: 'autosave-write' }
	| { readonly kind: 'explicit-operation' }
	| { readonly kind: 'decision-required' }
	| { readonly kind: 'view-hydration' }
	| { readonly kind: 'background-cascade' };

export type ErrorSurface =
	| { readonly kind: 'inline'; readonly field: string }
	| { readonly kind: 'toast'; readonly level: 'warning' | 'error' }
	| { readonly kind: 'modal' }
	| { readonly kind: 'save-state' }
	| { readonly kind: 'view-failure' }
	| { readonly kind: 'session-failure' }
	| { readonly kind: 'none' };

export function surfaceFor(error: AppError, origin: ErrorOrigin): ErrorSurface;
```

Each member additionally carries a non-exported brand — see §2, which is where the brand earns
its place. It is elided here so the shape reads as the slice document states it.

Pure, no side effects, importing nothing from slices 13/15/16. A `switch` over
`error.category` with **no `default`**, so a ninth category added to slice 2 fails `tsc`.

Two contract points the slice document makes and this implementation has to honour:

- `origin` alone does not decide the answer. It picks the container; `error` supplies what the
  container still needs — the toast's `level` comes from the category.
- `GeometryError` at an `explicit-operation` origin is *"the one pairing that resolves to a
  quieter surface than its origin would suggest"*. Read together with the table (which routes
  the command-`Result` case to a toast), this resolves as a **`warning`-level toast** rather
  than an `error`-level one. The interpretation is recorded here because the slice document
  states it in two places that have to be read together, and a later reader who takes only one
  of them will get a different answer.

### 2. Enforcement — the toast door closes

The slice document specifies `surfaceFor` as a policy a call site *consults*. Consulted-only is
exactly the "guard on the door nobody dispatches through" shape CLAUDE.md records this project
paying for twice, and the Definition of Done makes a **category** claim — *"in every code path
that can trigger it"* — which no list of call sites can hold.

So the toast door stops accepting a bare `AppError` and starts accepting a value **only
`surfaceFor` can produce**:

```typescript
// presentation/errors/errorSurfacePolicy.ts
declare const ROUTED: unique symbol;          // not exported

export type ErrorSurface =
	| { readonly kind: 'inline'; readonly field: string; readonly [ROUTED]: true }
	| { readonly kind: 'toast'; readonly level: 'warning' | 'error'; readonly [ROUTED]: true }
	| …;

export type ToastSurface = Extract<ErrorSurface, { kind: 'toast' }>;

// presentation/notices/notify.ts
export function notifyError(error: AppError, routed: ToastSurface): void;
```

The brand's `unique symbol` is declared and never exported, so **no call site can construct a
`ToastSurface` by hand** — the only way to hold one is to have called `surfaceFor`. That is
held by `tsc`, and it is the same mechanism the editor's screen/world separation already rests
on (`tests/presentation/editor/type-safety.test-d.ts`, in `tsconfig.json`'s `include` so the
proof is actually run).

**State the guarantee narrowly, because it is not "the routing is correct".** What the compiler
holds is *"you cannot reach a surface without asking the policy"*. It does **not** hold that a
call site asked with the *right* origin — a site can pass `explicit-operation` where
`autosave-write` is true and get a toast the table would have refused. That is not closable by
a type, and it is the reason the origin table in Finding 3 is in this spec: declaring an origin
is a reviewable act, and the review is the instrument for that half.

`surfaceError(error, origin, sinks)` sits beside it as the convenience that calls `surfaceFor`
and dispatches to the matching sink, returning the surface it used so a test asserts on the
decision rather than on a spy count. It is not the guarantee; the brand is.

**Why not a lint rule.** A lint rule can say *"you called the toast door"*. It cannot say
*"you called it for an error whose origin routes to the save-state indicator instead"* — and
that split is the entire slice. Findings 1 and 2 are both invisible to any rule of that shape.
A rule would also inherit `NOTICE_TEXT_BAN`'s own documented blind spot, keying on
`callee.name` and missing every member-expression callee.

**An un-export alone would not have done it**, which is worth recording because it was this
spec's first draft: making `notifyError` module-private still leaves whatever module *does*
own the toast importing it, so the guarantee degrades to "only that module may import this
symbol" — an ESLint `no-restricted-imports` claim, not a `tsc` one. The brand is what makes
the narrower sentence above true.

**`SurfaceSinks` and the required fallback.** Not every call site can render every surface: the
Inspector has no banner region, a plugin command has no view to fail in place. So `sinks`
carries the doors this site actually has, plus one **required** fallback for a surface it
cannot render. Required, not optional-with-a-default, for the reason `useFieldCommit.notify`
already states about itself: *"Optional with a `?? noop` default, the forgetting call site is
silent and nothing anywhere errors — the exact shape this repository keeps paying for."* A
policy that routes to a surface the call site cannot draw must degrade to *something*, and the
choice must be the caller's and visible.

**What this does not claim.** `notifyWarning`, `notifySuccess` and `notify` stay exported and
still take resolved strings — they are not `AppError` doors and this slice does not narrow
them. `notifyFault` also stays: it maps a *thrown* cause, which is by definition not an
`AppError` that a policy could have routed, and CLAUDE.md already records it as a door that
should disappear when the repository ports are guarded rather than now.

### 3. The three view states

A new `presentation/components/ViewFailure.vue`, a **sibling** of `EmptyState.vue` rather than
a mode of it. `EmptyState` is deliberately generic (resolved strings in, `action` out) and
could have been reused, and that is the reason not to: the slice document's rule is that a
failure must *never* read as an empty state, and reusing the component would make that a copy
convention rather than a structural fact. A distinct `.rp-view-failure` class also keeps the
existing assertions (and the axe case) that key on `.rp-empty-state` meaning what they mean.

| State | Where it replaces content | Action | Origin |
|---|---|---|---|
| `view-failure` | `ViewRoot` (`.rp-view-message` failure arm) and `PlanEditorRoot` (`status === 'failed'`) | **Retry** — re-runs the hydrating query | `view-hydration` |
| dangling reference | `PlanEditorRoot` (`status === 'missing'`) | close the leaf / pick another plan | **none — never routed** |
| `session-failure` | every view, whole session | **none, deliberately** | `bootstrap` |

Three notes on what changes versus today:

- `ViewRoot` already renders `trError(error)`, so the copy is right and the **retry is
  missing**; it also shares one region with the loading line, which this separates.
- `PlanEditorRoot` renders a fixed `tr('editor.plan-failed')` string — **not** `ToUserMessage`
  copy — so an unrecovered-settings failure and a vault fault currently say the same sentence.
  That is the defect slice 11 fixed in the *other* view and never carried here.
- The `ok(null)` dangling case reaches `surfaceFor` **never**, because it is not an error. That
  absence gets a test of its own, so a later edit that starts routing it fails rather than
  passing quietly — an absence nothing asserts is indistinguishable from an omission.

### 4. Toast preemption

`queue.promote()` gains a severity term: an `error` may take a slot held by a **held**
`warning`, demoting it rather than dropping it. `MAX_VISIBLE_NOTICES` stays 3, per Finding 4.
The demoted warning is not lost — it returns to the held set and is promoted into the next
freed slot, which is the property the queue already guarantees for everything else.

### 5. The agreement check

`affectsSaveState(error) === (surfaceFor(error, { kind: 'autosave-write' }).kind === 'save-state')`
asserted across the categories and codes both can see, so the two cannot drift. This is what
closes the slice document's exposure (a): the post-write `Reference` refusal gains an explicit
entry in the table, bound to `leftWritesBehind` rather than to the category axis, which is the
report `affects-save-state.ts` already prefers over its own inference.

## Testing strategy

Following the slice document's own list, plus what the findings above require.

- **Policy unit tests** — pure, no jsdom. Every `(category, origin)` pair the table names,
  including the six split cases it enumerates. `PersistenceError` + `background-cascade` →
  `toast` gets a test **of its own** rather than a row in a loop: it is the one exception, and
  an implementation that folded `background-cascade` into a single early return would pass
  every other case.
- **Exhaustiveness** — a compile-level proof, not an enumeration. This repo already has the
  pattern (`tests/application/ports/diagnostics.test-d.ts` is in `tsconfig.json`'s `include`
  for exactly this reason), and a `switch` with no `default` plus a `never`-typed exhaustion
  arm is checked by `vue-tsc` in `npm run build`.
- **The door is closed** — a `*.test-d.ts` proving a hand-built `{ kind: 'toast', level:
  'error' }` does **not** satisfy `ToastSurface`, via `@ts-expect-error`, plus one line
  asserting a real `surfaceFor` result does. It joins `tsconfig.json`'s `include`, since an
  unenforced `@ts-expect-error` is just a comment. This is the one instrument here that holds
  for code not yet written, and the file states what it does not reach: a call site that asks
  with the wrong origin.
- **No double-reporting, both directions** — the DoD asks for both. An `autosave-write`
  `PersistenceError` reaches `save-state` and raises **zero** toasts (Finding 1's regression);
  a `form-field-commit` `ValidationError` renders inline and the indicator does **not**
  transition.
- **The calibration split** — `calibration.invalid-distance` inline,
  `calibration.coincident-points` and `calibration.degenerate-scale` toast, distinguished by
  origin, driven through the restructured dialog rather than through the policy alone. A test
  that only asks `surfaceFor` would pass against Finding 2 while the tool still cannot render
  it.
- **Logging is unconditional** — for every pair including every `none`, `logger.error` was
  already called before `surfaceFor` was consulted.
- **Preemption** — an error pushed behind three standing warnings is shown *and* announced.
  The announcement half matters: `announce` rides `render`, so a test asserting only visibility
  would pass against a build that still says nothing to a screen reader.

That `*.test-d.ts` makes `tsconfig.json`'s `include` list **six** entries. CLAUDE.md currently
says five and narrates, in that same sentence, having sat at the wrong number for a whole slice
by remembering rather than counting — so the count is updated in the same edit that adds the
entry, or this spec has reproduced the defect it is quoting.

### Two things a test here cannot see, stated rather than implied

- **Appearance.** `tests/harness/obsidian.css` declares no `.notice` and no `.notice-container`
  rule at all, so neither `npm run harness` nor `npm run harness-shot` can show a notice.
  Preemption is verifiable in a real vault and nowhere else;
  `docs/tests/cases/Notices and save state.md` is the instrument, and gains steps.
- **The new view states' accessibility.** `tests/harness/accessibility.test.ts` scans
  `contentEl`, which does reach `ViewFailure` — so unlike the toast work, this half *is*
  gradeable, and the case should scan the retry button the same way slice 16 made it scan
  `.rp-empty-state__action`.

## Coverage — measured on the baseline, and the binding metric is not the expected one

Floors in force: statements 99, functions 99, lines 99, branches 98 (`vitest.config.ts`).
Measured with `npm run test:coverage` on `f94ce6e` — 256 files, 3705 passed, 65 skipped:

| Metric | Measured | Floor | Headroom, in uncovered units |
|---|---|---|---|
| Statements | 99.23% (5352/5393) | 99 | ~13.1 |
| **Functions** | **99.04% (1349/1362)** | **99** | **~0.6 — i.e. none** |
| Lines | 99.47% (4768/4793) | 99 | ~23.2 |
| **Branches** | **98.08% (2660/2712)** | **98** | **~2.3** |

The arithmetic, so no figure has to be taken on trust: a floor `f` permits `U` further
uncovered units where `covered / (total + U) >= f`, i.e. `U <= covered / f - total`. For
functions: `1349 / 0.99 - 1362 = 0.63`.

**CLAUDE.md says branches is the binding metric. On this tree it is not — functions is**, and
by a wide margin: the branch budget is a little over two, and the function budget is *zero*.
**One uncovered function fails the gate.** That is a sharper constraint than any recent slice
has planned against, and it lands on precisely the shape this slice adds most of: small
single-purpose functions — a policy, a dispatcher, per-sink closures, a Vue component's
handlers. A `ViewFailure.vue` retry handler that no test presses is, on its own, a red build.

Read both floors as floors rather than budgets, and re-measure rather than trusting this table
after any merge — CLAUDE.md records two occasions where the figure *fell* on merging. The
operative consequence: every function this slice adds needs a test that calls it, written with
it rather than after it.

## Risks

- **The calibration restructuring (Finding 2) is the schedule risk.** It changes a gesture, not
  a wiring: `CalibrateTool` must dispatch from inside the dialog instead of awaiting a number
  out of it. CLAUDE.md records four separate defect classes already found in this tool's
  interruption handling (`generation` counters, `abandonGesture` versus `cancel`, the restored
  first point), and every one of them is live across this change. It should be its own task,
  late, with the existing calibration cases run before and after.
- **Closing the toast door touches ten call sites**, three of which are tool registrations
  whose behaviour changes (Finding 1). The risk is not the edit; it is that a site declares a
  *wrong* origin and the policy then routes it confidently to the wrong surface. Origins are
  reviewable in one table — the one in Finding 3 — which is why that table is in this spec.
- **A demoted warning is a behaviour change to a shipped surface.** Preemption is right, and it
  means a user can now see a warning leave the screen without dismissing it. The queue keeps
  it, so the failure mode is confusion rather than loss.

## What this slice does NOT do

- It does not design any of slices 13/15/16's widgets. It says which one an error reaches.
- It does not revisit slice 11's mapping, logging levels, or diagnostics snapshot. It starts
  from an already-mapped `AppError` whose `logger.error` has already run.
- It does not decide message **copy**. `toUserMessage` owns the string; this slice owns the
  container it is placed in.
- It does not widen `InspectorDto`, and it does not change the `SaveStateIndicator`
  announcement. Both stay open, with their existing records.
- It does not guard the repository ports, so `notifyFault` and both `runtime.ts` fault doors
  stay where they are.
