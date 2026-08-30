---
type: Task
parent: "[[Shared UI vocabulary]]"
order: 50
dependsOn:
  - "[[11-error-handling-diagnostics-and-data-safety]]"
  - "[[13-notifications-and-save-state-surfaces]]"
  - "[[14-empty-states]]"
  - "[[15-modals-and-confirmation-dialogs]]"
  - "[[16-form-and-inline-validation-feedback]]"
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
# Design Slice 17: Presentation-Layer Error Surfacing

## Purpose

SDD §66's Error Boundary pipeline ends in a step slice 11 named but did not
finish designing:

```text
Infrastructure Exception → Application Error Mapping → Typed Result → Presentation → User Message
```

Slice 11 fixed everything up to and including "an `AppError` reaches
Presentation." (`AppError` — the eight-category union — not `DomainError`, which is one
member of it; slice 11 flags that collision explicitly, and conflating the two is the
easiest mistake to make in a document about error routing.) It also fixed *what* a user
message may contain (domain-level fields only, never a raw exception). It did not fix
*where* that message appears. Meanwhile slices 13, 15, and 16 each built one presentation surface
— a toast/save-state system, a modal/dialog framework, and inline field
validation — without needing to know which of slice 2's eight error
categories would ever reach them.

This slice is the missing link: for each of the eight categories
(`DomainError`, `ValidationError`, `PersistenceError`, `GeometryError`,
`ImportError`, `MigrationError`, `ReferenceError`, `CalculationError`), it
decides which surface a Presentation call site should reach for, and why.
It is the same kind of integration slice 10 is for the domain/cost loop:
no new mechanism, only the wiring rule connecting mechanisms that already
exist.

## Scope

### In scope

- A decision procedure — synchronous-vs-background origin, and
  field/operation/decision attributability — that determines a surface for
  any `AppError`, plus the table that applies it to all eight categories.
- Reconciling the four error sites earlier slices already designed in detail
  against that table: slice 3/4's Zone-save `PersistenceError`, slice 7's
  calibration `CalculationError`, slice 8/10's delete-time `ReferenceError`,
  and slice 10's background `recalculationStatus` cascade failure.
- The relationship between logging (slice 11, unconditional, technical) and
  surfacing (this slice, conditional, simplified): every mapped error is
  logged regardless of which surface — if any — it also receives.
- Naming the general case where no immediate, interruptive surface is
  correct, and what replaces it (a persisted, discoverable marker).
- The two cases slice 14 defers here — a view whose hydrating query failed, and a
  stored entity ID that no longer resolves — neither of which is an `AppError` the
  table can route, and both of which would otherwise land nowhere.

### Out of scope (covered by other slices)

- The toast/save-state widgets, the modal/dialog framework, and inline
  field-error rendering themselves — slices 13, 15, 16 respectively. This
  slice only says which one a given error reaches; it does not design any
  of them. It adds exactly one surface of its own, the in-place view failure
  state, and only because slice 14 identified a case none of the three covers
  (see "Two cases that are not `AppError`s").
- The error category type hierarchy and `Result<T,E>` — slice 2. Referenced
  here, not redefined.
- The Infrastructure-exception-to-`AppError` mapping, logging levels, and
  diagnostics snapshot — slice 11. This slice starts from an already-mapped
  `AppError` and a `Logger` call that has already happened; it does not
  revisit how either got there.
- Message *copy* — the exact string a `ToUserMessage` (slice 11) produces.
  This slice decides the container the string is placed in, not its wording.

## Dependencies

- Slice 11 (Error Handling, Diagnostics & Data Safety) — the eight `AppError`
  categories, the `ToUserMessage` contract, and the unconditional logging
  this slice assumes already ran before any surface is chosen.
- Slice 1 (Plugin Bootstrap & Composition Root) — the settings-load failure it
  deliberately leaves half-surfaced, deferring "where it shows up beyond the settings
  tab" to slices 11 and 17. Answered under "Bootstrap: the failure that precedes every
  row above". Not a build dependency in the other direction: slice 1 ships without this.
- Slice 13 (Notifications & Save-State Surfaces) — assumed to provide
  `notify.success/info/warning/error(message)` and a persistent
  Saved/Saving/Unsaved/Save Error indicator (PRD §67 Autosave).
- Slice 15 (Modals & Confirmation Dialogs) — assumed to provide a modal/
  dialog framework, including the delete-confirmation
  Cancel/Remove-References/Reassign/Delete-Anyway flow (PRD §64 Deletion
  Semantics).
- Slice 16 (Form & Inline Validation Feedback) — assumed to provide
  field-level inline error rendering tied to Inspector/form commits (SDD §59
  Inspector).
- Slice 10 (Assets, Requirements & the End-to-End Loop) — the
  `recalculationStatus` worked example this slice cites as the background-
  failure case.
- Slice 14 (Empty States) — the one slice that hands cases *to* this one rather than
  taking a surface from it. It explicitly defers two: a view whose hydrating query
  resolved `isErr`, and a view whose stored entity ID resolved `ok(null)`. Both are
  answered under "Two cases that are not `AppError`s" below.
- SDD §66 Error Boundary — the pipeline this slice completes.

### Carried forward from the slice 8 review pass (2026-08-25)

The slice 8 review pass produced three facts the routing table above
depends on.

- **A category collision is the failure mode to watch, and it already happened.** The two
  reversible zone adapters minted the identical `zone.nothing-to-undo` code as a
  `Reference` failure in one file and a `Persistence` failure in the other — both
  hand-built `AppError` literals, in a file that already imports the `referenceError`
  factory and uses it a few lines further down. Anything routing on category, which is what this whole table
  does, would have surfaced one logical failure two different ways. Both use the factory
  now; the lesson is that a hand-built literal is how a discriminant drifts.
- **A THROW reaches presentation, and `runtime.ts`'s `reportFault` is where it lands.**
  Every dispatch in a Plan Editor leaf is ultimately bound to a click handler that
  discards its promise, so before this an unexpected technical fault was a console
  unhandled rejection and that button silently stopped working for the session. It
  currently calls `notify()` with a raw `Error.message`. That is a seam, not a decision:
  what a technical fault should say to a user, and whether it is a toast or a persistent
  surface, is this slice's table to answer.
- **`InspectorDto` still has no error variant.** A genuine "no such zone" and a transient
  read failure both land on `{ kind: 'empty' }`, so a failed read on a fresh selection is
  indistinguishable from an empty selection, with nothing surfaced anywhere. Recorded in
  `inspector-store.ts`'s own header as a known gap left for whichever slice adds error
  signalling — this one, if the union is to widen.

### Carried forward from the slice 13 review pass (2026-08-29)

Three exposures the slice 13 branch left standing deliberately. Each is written where the
code is; each is repeated here because it is a decision **this** table owns rather than a
defect that slice could have closed on its own. All three are open.

- **A `Reference` refusal raised AFTER a partial write is reported by nothing, and the
  decision procedure above is half the reason.** `affectsSaveState` treats every `Reference`
  error as pre-write, so the tracker calls `resolveNeutral()` and the indicator settles
  **Saved**; the procedure then routes an autosave-path persistence failure to that indicator
  and deliberately raises no toast beside it. Both halves are defensible alone. Together they
  leave a half-written vault announced nowhere: `requirementResolutionSteps` raises
  `requirement.not-found` after `markStalePersisted` has already written through
  `requirements.markStale`, and `repointAndMarkStale` can refuse for referent N after
  `applyAll` saved 1..N−1 — the failed compensation logged, and nothing else. The
  `ReferenceError` row's (a)/(b)/(c) split has no entry for this: it is not the sync delete
  flow, not a background cascade, and not the persisted aftermath of `delete-anyway`. Left as
  an exposure rather than repaired in slice 13, because carving `requirement.not-found` out
  of the pre-write set buys a false **Save error** at the several sites where it genuinely IS
  pre-write, and re-labelling inside `runDeleteResolution` changes what `toUserMessage`
  prints — both of which are this slice's call, not that one's.
- **This table routes a dozen categories to "slice 13 toast", and a toast is not always
  seen.** `warning` and `error` never auto-dismiss and the queue caps at three, so three
  distinct persistent warnings — `background.unsupported` plus the two `cascade.*`, none of
  which dedup into each other — hide every later ERROR notice, and hide its announcement too:
  `announce` rides `render`, and `render` runs only for a notice actually shown. Whether an
  error preempts a standing warning is queue policy, and the table above is what makes that
  policy load-bearing.
- **`SaveStateIndicator` sits in a `role="status"` region and `beginSaving()` fires on every
  dispatch**, so a screen reader hears "Saving" then "Saved" twice per zone drag — the same
  noise the measurements region in that same `StatusBar.vue` explicitly refuses a live region
  for. Whether the transient `saving` step is announced at all is a surfacing decision, which
  is this slice's subject rather than slice 13's.

## Design

### The decision procedure

A surface is not a function of the error *category* alone — the same
category can reach different surfaces depending on how it arose. Six
questions, asked in order, determine it. **They are labelled, not numbered**,
because everything else in this document refers back to them and a number is
correct only until a question is inserted above it — which is exactly what
adding the BOOTSTRAP question below did:

```text
BOOTSTRAP. Did the plugin fail to load its own settings, so nothing that reads
   a configured location was composed at all (slice 1)?
     → yes: SESSION FAILURE STATE. Asked first because it is the only failure
       that invalidates the questions below rather than being answered by them:
       there is no field to annotate, no operation to name, and no query that
       "failed" — none was ever wired. Every view the plugin renders shows the
       failure in place of its content for the whole session, with NO retry
       action, because recovery is fixing `data.json` and reloading, not a
       button (slice 1: "recovery is a reload, not a repair UI"). Slice 1's
       settings-tab explanation is the other half of this surface and is not a
       second, competing report of the same fact — it is the only place that can
       say what to fix.

DECISION. Does resolving this require the user to pick between several different,
   real outcomes (not just "OK" / dismiss)?
     → yes: MODAL (slice 15). Rare — reserved for cases like deletion with
       existing referents, where proceeding silently would violate SDD §87's
       "never cascade-delete silently."

FIELD. Otherwise, is the failure attributable to exactly one visible input the
   user just edited (a single Inspector/form field)?
     → yes: INLINE FIELD ERROR (slice 16).

OPERATION. Otherwise, did this happen synchronously, as the direct result of an
   operation the user just triggered (a save, a delete, an explicit command)?
     → yes, and the operation is an autosave write with a live Saved/Saving/
       Unsaved indicator already on screen for that entity:
         flip that indicator to SAVE ERROR (slice 13) — no separate toast.
     → yes, otherwise:
         TOAST (slice 13), naming the failed operation.

HYDRATION. Otherwise, did a view's own hydrating query fail, leaving it with no
   content to show at all?
     → IN-PLACE VIEW FAILURE STATE (this slice) — the message replaces the view's
       content, in the slot slice 14's `EmptyState` would otherwise occupy. Never an
       empty state (that would claim the data is legitimately absent) and never a
       toast alone (that would leave a blank region behind it).

BACKGROUND. Otherwise — discovered later, not the direct result of a click; a
   background cascade, or a load-time check on an entity nobody opened this
   session:
     → NO INTERRUPTIVE SURFACE. Log it (slice 11, already happened) and
       leave a persisted, discoverable marker on the affected entity —
       `recalculationStatus`-shaped, or slice 11's own
       `DiagnosticsSnapshot.validationIssues` — for whoever looks at that
       entity, or at Diagnostics, next.
```

The BACKGROUND step is the one most designs skip: most failures do not need to interrupt
the user *at all*, only to be honest and discoverable when they do look.
Slice 10's `recalculationStatus` is the existing, already-designed proof
that this plugin already commits to that idea; this slice generalizes it
into a rule instead of leaving it a one-off.

The category names below therefore describe *typical* origin, not
guaranteed origin — several categories legitimately split across two rows
of the procedure above depending on the call site. Where that happens the
table says so explicitly rather than picking one surface and calling the
other case out of scope.

### Category → surface table

| Error category | Typical origin | Surface | Justification |
| --- | --- | --- | --- |
| `ValidationError` | Sync — a single Inspector/form field commit fails a domain constructor's or schema's rule before any command reaches Infrastructure. | Inline field error (slice 16). | Attributable to exactly one input; a toast would report the failure without saying which field to fix — the one thing the user needs. This is precisely the case slice 16 exists for. |
| `PersistenceError` | Splits by origin. **(a)** Sync — a Vault write the user's action just triggered: an autosave debounce firing, a completed command's `save()`, or an explicit delete. **(b)** Async — a write inside a background cascade, on an entity the user did not touch: slice 10's `markStale()` on a Requirement affected by someone else's Zone edit. | **(a)** Autosave-path write: flips slice 13's persistent Saved/Saving/Unsaved/Save Error indicator to **Save Error** — no separate toast. A one-off write outside that lifecycle (no live indicator for that entity): slice 13 toast. **(b)** Slice 13 toast, naming how many Requirements could not be marked rather than the note behind each — plus the durable half, which is not a surface decision at all: slice 10's `calculatedFrom` comparison makes those Requirements read `"stale"` anyway. | **(a)** The indicator is already on screen for every autosaved entity and already has a Save Error state (PRD §67). A second, independent toast reporting the same failure would tell the user the same fact through two widgets that can drift (e.g. the toast dismisses, the indicator doesn't, or vice versa). Reserve the toast for persistence failures with no live indicator to flip. **(b)** is the one background failure in this table that IS interrupted on, and the reason is exact: what buys silence for `CalculationError`(c) and `ReferenceError`(b) is the persisted stale marker carrying the fact in the user's absence. Here the marker write is precisely what failed, so the same rule that keeps those quiet is the rule that makes this one speak. |
| `GeometryError` | Sync, but usually absorbed *before* it becomes a command: slice 8's interaction layer rejects a degenerate drag by snapping the handle back with **no command dispatched** — it never reaches the Error Boundary at all. When it does reach Presentation via a command's `Result` (e.g. programmatic input), it is operation-level, not field-level. | No surface for the pre-command case (nothing changed, nothing to report). Slice 13 toast for the command-`Result` case. | The canvas gesture that produced it has no discrete input to annotate inline, and it is not a decision the user must make — it names a rejected operation, which is exactly what a toast is for. |
| `ImportError` | Sync — the direct result of an explicit user-triggered import, but operation-level: the imported file/entity failed as a whole, not one field. | Slice 13 toast, naming the failed item. A future import that processes several entities in one pass and fails partway reuses slice 15's existing modal (the same enumerate-and-decide shape as the delete flow) only if the user must actually choose how to proceed (skip/retry/abort); if no decision is required, a toast summarizing the count is enough. | No import feature exists yet in slices 1–12 to anchor a built example, but the category is closed and must not be silently skipped. The same field/operation/decision test used everywhere else in this table applies to it once it arrives — it does not need a fourth surface invented for it. |
| `MigrationError` | Discovered when a Plan/Project loads and a repository refuses an entity whose `schema-version` is unsupported (SDD §92 item 13: scoped to that one entity, not the whole plugin) — not the direct result of a click. | A toast once at load time is reasonable to make the refusal visible immediately ("1 Zone could not be loaded"), but the durable record is slice 11's own `DiagnosticsSnapshot.validationIssues` — already designed, already the entity-scoped, content-free record of exactly this failure. | Same shape as `recalculationStatus`: a failure discovered when something is *opened*, not clicked into being. The plugin already has a computable place to keep it discoverable; this slice reuses it rather than inventing a second "broken entities" list. |
| `ReferenceError` | Splits by origin. **(a)** Sync — the direct result of an explicit Delete on an entity with existing referents (slice 8/10's delete flow). **(b)** Async — a background cascade (slice 10's `onZoneGeometryChanged` handler) hits a stale/dangling reference mid-recalculation. **(c)** Not an event at all — the persisted aftermath of `delete-anyway`: a Requirement whose Zone or Asset the user deliberately deleted out from under it. | **(a)** Slice 15's modal — the Cancel/Remove-References/Reassign/Delete-Anyway flow (PRD §64). **(b)** No interruptive surface — logged (slice 11), `Requirement.recalculationStatus` stays `"stale"`. **(c)** No surface at the moment it happens. A Requirement whose **Asset** is gone carries `missingTarget` on its DTO from then on, rendered as a persisted badge in the Zone's Requirements panel. One whose **Zone** is gone has no panel to carry a badge and no query that returns it — slice 10 states that gap under "Deletion & reference integrity" rather than closing it with a query nothing calls. | **(a)** is the one case in this table where the user must actually choose between several different, real outcomes — a toast has no room for four buttons, and there is no single field to attach an inline error to (the referents are other entities, not inputs). SDD §87's "never cascade-delete silently" is what forces a decision, not a display. **(b)** is a background retry candidate at the moment it happens, not a decision — see `CalculationError`(c) for the shared reasoning. **(c)** was already decided, by the user, in (a)'s modal: re-reporting it as an error would interrupt them about the outcome they chose. What it does owe is visibility later — a badge where a surface exists to carry one, and, for the Zone-less case, an admission that none does yet. Naming a query as the answer would have made this row read as settled while nothing rendered it, which is the failure this table's whole job is to prevent. |
| `CalculationError` | Splits by origin and attributability. **(a)** Sync, tied to one input — e.g. calibration's `calibration.invalid-distance` (the known-distance field). **(b)** Sync, operation-level, no single field — e.g. calibration's `calibration.coincident-points`/`calibration.degenerate-scale` (two canvas point-picks, not a form field) or a `Money.add`/`compare` currency mismatch. **(c)** Async, background — slice 10's `RecalculateRequirementCommand` failing inside the `onZoneGeometryChanged` cascade. | **(a)** Inline field error (slice 16). **(b)** Toast (slice 13). **(c)** No interruptive surface — logged only; `recalculationStatus` stays `"stale"`. | **(a)/(b)**: the category name alone does not decide the surface — what the failure is attached to does, exactly as with `ValidationError` vs. the rest. **(c)** is slice 10's own explicit worked case for "discovered later, not interrupted on": nothing the user directly asked for at that instant failed (a Zone move triggered it indirectly), so nothing is owed synchronously — the persisted stale marker is the entire contract, by slice 10's own design ("so the Inspector never presents a stale value as current"). |
| `DomainError` | Sync — the generic/base category. Per slice 11's own rule ("a mapping site must not default everything to a generic `DomainError`"), an `ExceptionMapper` rarely produces this; it appears where a command's own `Result` type still names it undecorated (e.g. `AssignAssetCommand`'s `Result<AssignAssetResult, ValidationError \| DomainError \| ReferenceError \| PersistenceError>`, slice 10, for whichever domain-invariant violation isn't the specific "Asset unit must be m2" `ValidationError` that same command also raises) for a domain-invariant violation that didn't warrant a narrower category — discovered as the direct result of the command that raised it. | Default: toast (slice 13), operation-level ("your action could not be completed"). If a specific `DomainError.code` is in practice field-attributable, route it like `ValidationError` (inline, slice 16) instead. | `DomainError` is a fallback category, not a distinct *kind* of failure with its own typical shape. Always-toast would be as wrong as slice 11 warns against always-mapping-to-it: the same field/operation test used for `CalculationError`/`ReferenceError` applies here too, just exercised less often because slice 11 pushes mapping toward narrower categories first. |

Every row still passes through slice 11's `ToUserMessage` for its copy; this
table only decides the container.

### Bootstrap: the failure that precedes every row above

Slice 1 defers "where the settings-load failure shows up beyond the settings tab" to
slices 11 and 17 by name. This is that answer, and it needed a new origin rather than a
row in the table above, because **a bootstrap failure is not one of the eight `AppError`
categories reaching a surface** — it is a rejected `loadData()` before any command,
query or repository exists to produce an `AppError` at all. Routing it through
`surfaceFor(error, origin)` with a manufactured category would have been the "map
everything to a generic `DomainError`" mistake slice 11 warns against, one layer up.

| Origin | Surface | Justification |
| --- | --- | --- |
| `{ kind: "bootstrap" }` — `loadData()` rejected, so `settings === null` and the composition root deliberately wired no repositories, no index and no query services (slice 1). | `{ kind: "session-failure" }`: every view the plugin renders replaces its content with slice 11's `ToUserMessage` copy, for the whole session, **with no retry action**. | The plugin is loaded but structurally cannot do anything that touches a configured location, and that is true until the vault is reloaded — so a toast (dismissible, momentary) understates it and an empty state (which claims the data is legitimately absent) misreports it, the same objection slice 14 raises for `view-hydration`. No retry, because slice 1 already refused a repair UI: there is nothing to re-run, and a button that re-read `data.json` on a timer would be guessing at data the user still has. The **actionable** half — what to fix — lives in the settings tab, where slice 1 puts it via the empty-`getSettingDefinitions()` fallback; this surface is what stops a user staring at a blank Plan Editor wondering why. |

Two things this row deliberately does not do. It does not make slice 17 a dependency of
slice 1 — slice 1 ships this failure with the settings tab alone, and views acquire the
session-failure state when slices 5 and 14 give them a content slot to replace. And it
does not touch slice 1's three rules (no write for the session, nothing configured
composed, recovery is a reload); it names where they become visible, which is exactly the
scope slice 1 deferred.

### Two cases that are not `AppError`s

Slice 14 defers two situations here, and neither arrives as an `AppError` — so the
decision procedure above cannot route them, and saying "slice 17 owns it" without
saying how would leave both landing nowhere. They are answered by the same
attributability test, applied one level up:

- **A view's hydrating query resolved `isErr`.** This *is* an `AppError` (typically
  `PersistenceError`), but its origin is not in `ErrorOrigin`'s list: nothing the user
  clicked failed — the view simply could not load. It gets its own origin,
  `{ kind: "view-hydration" }`, and a surface the table above does not otherwise
  produce: the view renders a **failure state in place of its content** — the same slot
  slice 14's `EmptyState` would have occupied, with slice 11's `ToUserMessage` copy and
  a retry action, never an empty state's onboarding copy. Slice 14 is emphatic about
  why: "create your first project" shown because the vault read failed is actively
  misleading. A toast is wrong here too — it would leave a blank canvas behind it.
- **`GetPlan(planId)` resolved `ok(null)`.** This is not an error at all: the query
  succeeded and correctly reported that no Plan resolves. It reaches no error surface
  and `surfaceFor` is never called for it. The Plan Editor renders a **dangling-
  reference state** — "this tab points at a plan that no longer exists", with an action
  to close the leaf or pick another plan. It is neither an empty state (slice 14's own
  reasoning: the user may well have imported a plan, and then it vanished) nor an
  `AppError` to route. It is named here because slice 14 defers it here, and a deferral
  with no landing place is how a case gets lost.

Both render through the same in-place slot slice 14's `EmptyState` uses, and both are
distinct from it in copy and in what they offer the user to do next.

### Worked examples, reconciled explicitly

- **Zone save `PersistenceError` (slice 3/4).** Slice 11's illustrative
  `surfaceError(toUserMessage(result.error), origin)` in
  `presentation/stores/zone-store.ts` deliberately leaves the container
  unnamed; this is where it is named. For this specific autosave path: a Zone geometry save
  failing under the debounced-property-edit or completed-command autosave
  path (PRD §67) flips the Saved/Saving/Unsaved/Save Error indicator to
  **Save Error**. It does not additionally call `notify.error(...)` for the
  same failure. A non-autosave persistence failure (e.g. an explicit,
  one-off write with no live indicator) still uses the toast — the
  reconciliation is scoped to the autosave path, not to `PersistenceError`
  as a whole.
- **Calibration `CalculationError` (slice 7).** `calibration.invalid-distance`
  is tied to the known-distance input in the calibration tool's panel — it
  is an inline field error. `calibration.coincident-points` and
  `calibration.degenerate-scale` are not attached to any single field (they
  arise from the two canvas point-picks, or from a defensive floor on the
  derived scale) — both are toasts. The same `CalibrationError` type
  (`BaseError<'Calculation'>`, narrowed by `code`) therefore produces two
  different surfaces, decided by attributability, not by which domain module
  raised it.
- **Deletion reference-integrity (slice 8/10).** Explicitly a **modal**, not
  a row this table defaults to a toast for — it is the one case requiring a
  real decision (Cancel/Remove-References/Reassign/Delete-Anyway, PRD §64),
  called out separately in the table's `ReferenceError` row as case (a).
- **`recalculationStatus` (slice 10).** The worked example for "does not get
  an immediate interruptive surface at all." A failed
  `RecalculateRequirementCommand` inside the `onZoneGeometryChanged` cascade
  is logged (`logger.error('requirement.recalculation.failed', …)`, slice 10's own code)
  and leaves `Requirement.recalculationStatus: "stale"` — no toast, no
  modal, no inline error, because nothing the user directly clicked just
  failed. The Inspector (slice 6) surfaces the stale badge whenever that
  Requirement is next viewed; that is the entire user-facing surface, by
  design.

### Logging is unconditional; surfacing is not

Slice 11 already logs every mapped error at the Application Error Mapping
step, before Presentation makes any choice covered by this slice. Nothing
here changes that. "No interruptive surface" (the BACKGROUND step) means *no
additional UI beyond the persisted marker* — it never means "not logged,"
and it never means a call site is allowed to skip `logger.error` because it
decided a toast/modal/inline error was unwarranted. The two are produced by
different steps: logging happens once, at mapping time, for every error
without exception; surfacing is a Presentation-layer decision made *after*
that, using this slice's table, and may legitimately be "none."

## Interfaces & Contracts

This slice adds one small, presentation-local policy — not a new component,
a routing decision a call site consults after slice 11 has already produced
a `Result`. It goes in `presentation/errors/`, which **slice 16 creates** for
`route-error.ts` and which this slice joins rather than opening a second
folder beside it: slice 16 lands first (it needs 6 and 11; this slice needs
it), so the directory is there by the time this module does. Slice 16's File
layout section is where that ownership is written down.

```typescript
// presentation/errors/errorSurfacePolicy.ts

type ErrorOrigin =
  | { kind: "bootstrap" }                            // → session failure state
  | { kind: "form-field-commit"; field: string }   // → slice 16 territory
  | { kind: "autosave-write" }                      // → slice 13 save-state territory
  | { kind: "explicit-operation" }                  // → slice 13 toast territory
  | { kind: "decision-required" }                    // → slice 15 modal territory
  | { kind: "view-hydration" }                       // → in-place failure state
  | { kind: "background-cascade" };                  // → persisted marker, no UI —
                                                     //   except a PersistenceError,
                                                     //   which is the marker failing

type ErrorSurface =
  | { kind: "inline"; field: string }
  | { kind: "toast"; level: "warning" | "error" }
  | { kind: "modal" }
  | { kind: "save-state" }
  | { kind: "view-failure" } // in place of the view's content — see "Two cases" above
  // Every view, whole session, no retry action. Distinct from view-failure: that one
  // is per-view and retryable because a query can be re-run; this one is neither,
  // because nothing was composed to re-run (slice 1).
  | { kind: "session-failure" }
  | { kind: "none" }; // logged already; a persisted marker, not this policy's concern

// Pure — no side effects, no import of slice 13/15/16's concrete APIs. A call
// site combines this policy's answer with whichever of notify.error(...),
// the save-state store, or the modal framework it already has in scope.
function surfaceFor(error: AppError, origin: ErrorOrigin): ErrorSurface;
```

Contract notes:

- `origin` is supplied by the call site, not inferred from `error` alone —
  the table above shows the same category (`CalculationError`,
  `ReferenceError`) resolving to different surfaces depending on it. A
  policy keyed on `error.category` alone cannot express that split; keying
  on the pair is what makes the split explicit and testable.
- The converse is worth stating too, since it is not obvious from the table: `origin`
  alone does not decide the answer either. It picks the *container*, and `error`
  supplies what the container still needs — the `level` on a toast (`warning` for a
  recovered-from failure, `error` otherwise) comes from the category, and
  `GeometryError` at an `explicit-operation` origin is the one pairing that resolves to
  a quieter surface than its origin would suggest. If a future edit finds `error` truly
  unused, the honest fix is to drop the parameter, not to keep an argument the function
  ignores.
- `surfaceFor` returning `{ kind: "none" }` is a valid, common answer (the
  background-cascade row) — it is not an omission or a TODO. Slice 10's
  `recalculationStatus` marker is written by the command itself, not by
  this policy; `"none"` only tells the call site "do not also show a
  toast/modal/inline error for this."
- This function is exhaustive over `ErrorCategory` (slice 2): a `switch`
  over `error.category` with no `default` case, so adding a ninth category
  to slice 2 fails `tsc`, not silently falling through to a generic surface
  — the same "narrowest applicable, never a silent fallback" discipline
  slice 11 already applies to `ExceptionMapper`.
- `surfaceFor` names no slice 13/15/16 type or function beyond the
  `notify.success/info/warning/error(message)` shape assumed of slice 13 —
  it returns a description of *which* surface, and the call site (a Pinia
  action, a composable) is what actually invokes the sibling slice's API.
  Slices 13/15/16 retain final say over their own exact signatures; this
  slice does not pin them down.

## Persistence Impact

- No new persisted fields, frontmatter keys, or sidecar entries. This slice
  routes to two persisted markers that earlier slices already designed —
  `Requirement.recalculationStatus` (slice 10) and
  `DiagnosticsSnapshot.validationIssues` (slice 11, computed on demand, not
  itself a stored file) — rather than introducing a third.
- The Saved/Saving/Unsaved/Save Error indicator (slice 13) is session-local
  Presentation state, not Vault-persisted; this slice does not change that.
- `errorSurfacePolicy.ts` is pure and stateless; it reads nothing from and
  writes nothing to the Vault.

## Testing Strategy

- **Policy unit tests** (no jsdom, no Obsidian mock needed — `surfaceFor` is
  a pure function): for every `(category, origin)` pair this slice names,
  assert the exact `ErrorSurface` the table specifies, including the split
  cases — `CalculationError` + `form-field-commit` → `inline`;
  `CalculationError` + `explicit-operation` → `toast`; `CalculationError` +
  `background-cascade` → `none`; `ReferenceError` + `decision-required` →
  `modal`; `ReferenceError` + `background-cascade` → `none`;
  `PersistenceError` + `autosave-write` → `save-state`; `PersistenceError` +
  `explicit-operation` → `toast`; `PersistenceError` + `background-cascade` →
  `toast`, the one pair where `background-cascade` does not resolve to `none`.
  That pair is worth a test of its own rather than a row in the table's loop: it
  is the exception, and an implementation that folded `background-cascade` into a
  single early return would pass every other case in this list.
- **Exhaustiveness test**: assert `surfaceFor` is defined for all eight
  `ErrorCategory` values from slice 2, and that the implementation contains
  no `default` branch that would silently swallow a category slice 2 adds
  later (checked structurally — e.g. a lint rule or a switch-exhaustiveness
  compiler check — not by enumerating call sites).
- **Worked-example regression tests**, one per site named above: a failed
  Zone save under the autosave path produces a `save-state` surface and
  zero toast calls; the calibration `calibration.invalid-distance` case
  produces `inline`, `calibration.coincident-points` produces `toast`; a
  delete with existing referents produces `modal` and never reaches
  `notify.*`; a failed background recalculation produces `none` and leaves
  `recalculationStatus: "stale"` with zero toast/modal/inline calls.
- **Logging-is-unconditional test**: for every `(category, origin)` pair,
  including every one that resolves to `"none"`, assert `logger.error` (a
  test double, per slice 11's own pattern) was still called before
  `surfaceFor` was consulted — proving surface choice never gates logging.
- **No double-reporting test**, in both directions. For the autosave-write
  `PersistenceError`, assert that choosing `save-state` does not also invoke
  `notify.error` — the reconciliation with slice 13 is a behavior, not just
  a sentence, and gets a test that fails if a future edit reintroduces the
  duplicate toast slice 11's own illustrative code showed. And for a
  `ValidationError` on a field commit, assert the inline error is raised and
  slice 13's indicator does **not** transition: the category never reaches a
  write, so `Save Error` would report a persistence failure that did not
  happen alongside the inline message that did. Slice 13's
  `affectsSaveState` predicate is derived from this table, so this test is
  what keeps the two in agreement rather than a comment in each.

## Definition of Done

Ticked against what a check actually proves. Two items are amended rather than ticked, and
both amendments are below the list they belong to — an item ticked over a hole is the defect
this whole slice is about, one document up.

- [x] All eight `AppError` categories from slice 2 appear in the decision table
    with a typical origin, a surface, and a justification — none silently
    defaulted to "toast" or omitted.
- [x] `surfaceFor(error, origin)` is implemented, pure, and exhaustive over
    `ErrorCategory` with no `default` fallthrough case. Measured: deleting an arm reports
    `TS2322` at the exhaustion assignment.
- [x] A Zone-save `PersistenceError` on the autosave path flips slice 13's
    indicator to Save Error and does not also raise a toast for the same
    failure — proven by a test, not left as a sentence in this document.
    (`tests/presentation/editor/runtime.test.ts`, which asserts the PAIR: two existing cases
    had encoded the double-report and were rewritten rather than deleted.)
- [ ] **AMENDED — see Amendment 1.** Calibration's `calibration.invalid-distance` renders as an inline field
    error; `calibration.coincident-points` and `calibration.degenerate-scale`
    render as toasts — both proven by tests distinguishing the two by origin.
- [x] `PersistenceError` from a `background-cascade` resolves to a toast while every
    other category from that same origin resolves to `none` — the failed stale marker
    is the one background failure with nothing left to carry it (slice 10). Its own case,
    not a row in a loop, for the reason the Testing section gives.
- [x] A Requirement left with a missing target by `delete-anyway` reaches no surface
    through `surfaceFor` at all — it is a persisted read-model state (slice 10's
    `missingTarget`), and the table says so rather than leaving a reader to assume
    an unrouted case was forgotten.
- [x] **For the one code path that exists.** A delete on an entity with existing referents reaches slice 15's modal
    and never a toast or inline error, in every code path that can trigger it
    (Zone delete, Asset delete). `deleteZoneFlow.ts` is the Zone path. **There is no Asset
    path**: `grep -rn "deleteAsset" src/presentation/` prints nothing, so `DeleteAssetCommand`
    is composed in the root and reachable from no surface. That half is vacuous rather than
    satisfied, and it is written here so the next slice to give Assets a delete control knows
    it inherits this item rather than finding it ticked.
- [x] A failed background recalculation (`onZoneGeometryChanged` cascade)
    produces zero toast/modal/inline calls; `recalculationStatus` remains the
    only user-facing trace until the affected Requirement is next viewed. Verified by
    reading `composition-root.ts`'s `cascadeNotices`, which has exactly two members —
    `cascadeAborted` and `staleMarkerFailed`, both persistence-side. Neither fires per
    recalculation.
- [ ] **NOT DONE, and not started — see Amendment 2.** Every error routed through `surfaceFor`, including every one resolving to
    `"none"`, is independently provable to have already been passed to
    `logger.error` — logging is never conditional on the surface chosen.
- [x] A view whose hydrating query resolved `isErr` renders an in-place failure state with
    `ToUserMessage` copy and a retry action — never slice 14's empty-state copy, and
    never a toast over a blank region. A `GetPlan` that resolved `ok(null)` renders a
    dangling-reference state and reaches no error surface at all, since it is not an
    error. Both are proven by tests, and both close deferrals slice 14 made to this slice.
    (`viewRootFailure.test.ts`, `planEditorFailure.test.ts`. The bootstrap origin withholds
    the retry, which is a THIRD state this item did not anticipate and is described below.)
- [x] The only surface this slice adds beyond slices 13/15/16 is that in-place view failure
    state, and it is added because slice 14 identified a case none of them covers — not
    because a fourth container looked useful. Every other routed error lands on a toast, a
    modal, an inline field error, the save-state indicator, or a persisted marker slices
    10/11/13 already define.

### Amendment 1 (2026-08-30): the inline calibration error is WITHDRAWN, because no user can reach it

The item asked for `calibration.invalid-distance` to render as an inline field error. Building
that would have meant restructuring the calibration gesture so the dialog owns its dispatch —
the shape slice 16 settled for `NewProjectForm` — and this slice's own spec named that as its
largest piece of work and its schedule risk.

**It was not built, because reading the guards showed the refusal is unreachable from the UI
through three of them**, and the outermost is the one that matters:

1. `KnownDistanceForm` computes `parsed` as `null` unless the typed value is non-empty, finite
   and positive, and **disables its submit button** on `parsed === null`. A user cannot submit
   an invalid distance at all.
2. `runtime.ts`'s `supplyKnownDistance` returns `null` for anything that is not a number.
3. `CalibrateTool.complete` returns early on a non-positive or non-finite distance.

So `deriveCalibration`'s `calibration.invalid-distance` arm cannot be reached by any gesture.
Rendering an inline error for it would have been a surface for a failure nobody can produce —
and validating at the input, which is what the form already does, is *better* than dispatching
and rendering a refusal. The honest conclusion is that this item asked for the weaker design.

**The other two thirds of the item are done, and one of them was a real defect.**
`calibration.degenerate-scale` already reached a toast through `reportRejected`.
`calibration.coincident-points` did not reach anything: `CalibrateTool.complete` refused a
zero-length measurement and returned **silently**, wiping the anchor the user's first click had
drawn. Two clicks in one place discarded a placed point with no reason given. It raises the
domain's own coded refusal now, through one exported factory both sites share, and
`calibrateTool.test.ts` pins it.

What is NOT closed by that: the inline half stays unbuilt, and if a future caller can supply a
distance without passing through `KnownDistanceForm` — a script, an import, an undo replay —
the refusal becomes reachable and this amendment becomes wrong. That is the trigger.

### Amendment 2 (2026-08-30): the logging item is untouched, not partially met

Nothing in this slice checks that every routed error was already logged. The guarantee is
believed to hold by construction — slice 11's `guardCommand`/`guardQuery` log at the mapping
step, before any `Result` reaches Presentation — but "believed to hold by construction" is what
that slice's own review rounds kept finding to be false, and this slice added no instrument for
it.

It is left unticked rather than argued for, because the item asks for something
*independently provable* and no such proof exists. The shape it needs is a check at the
forbidden thing rather than a walk of call sites: every door that reaches a surface takes an
error whose logging already happened, which is a claim about the boundary and not about
`surfaceFor`.

### Amendment 3 (2026-08-30): a third view state this document did not anticipate

The `view-hydration` item describes two states. There are three, and the third is the reason
`viewHydrationOrigin` exists: a session whose settings never loaded refuses every query with
`settings.unrecovered`, and that is a `bootstrap` origin rather than a hydration failure. It
renders the same container with **no retry**, because nothing was composed to re-run and slice
1 already refused a repair UI.

This document's own "Bootstrap: the failure that precedes every row above" section called for
exactly that, so the state was designed here; what was missing was any Definition of Done item
covering it. Both views implement it and both have cases for it.

### Amendment 4 (2026-08-30): the dangling-plan state has its action

The `ok(null)` half of the view-hydration item asks for "an action to close the leaf or pick
another plan". It shipped for one commit with NO action and the reason was recorded here:
`PlanEditorContext` carried no door to close a leaf, and reaching for the global `app` is what
the marketplace rules refuse.

`PlanEditorContext.closeLeaf()` is that door now — a narrow callback the VIEW partially applies
from its own `WorkspaceLeaf`, which is the shape `onPlanChanged` already had and the reason
`onThemeChange` gives for not handing the `Workspace` down. The composition root is untouched:
it composes services and knows nothing about which leaf this is.

Two things the wiring turned up. The failure state's single button now means two OPPOSITE
things — retry a read that really failed, close a tab whose plan is gone — so the handler
branches on the status rather than the component learning which caller means what; both
directions are mutation-checked, because a handler that always retried, or always closed, looks
correct against a suite testing only one. And the widening was met at compile time by both
context constructions, the test harness and the browser-harness fixture, which is what
`tests/helpers/makeRenovationProjectView.ts`'s own docblock promises for the other view.

"Pick another plan" is still not built: the plan picker is `open-plan-editor`, a plugin command
outside the editor's bundle, and offering it here is the same seam problem one level further
out. One action rather than two, and this names the missing half rather than implying the item
is fully met.

### Amendment 5 (2026-08-30): a FAULT keeps its sentence; a REFUSAL goes where the indicator did not

The table routes an autosave-path `PersistenceError` to the save indicator with no toast beside
it, and reviewing that rule against the code found it under-specified in one direction.

`makeCommitField` maps a **thrown** fault into a resolved `Result` carrying a coded
`PersistenceError`, so by the time it reaches a reporting site it is structurally identical to
a refusal the command returned. Routed identically, a technical fault would show a badge
reading "Save error" and no cause at all — trading the user's only account of it for
consistency. SDD §65 already draws the line this needs: a throw is a technical fault, a
refusal is expected.

So `faultError` stamps every mapped fault (`presentation/errors/technical-fault.ts`), which is
sound because that function is the ONE place a thrown cause becomes an `AppError` — its
definition plus four callers, all catch blocks. `commitEdit` asks, and a fault takes the
notice while a refusal takes `reportDispatchRefusal`.

**`reportDispatchRefusal` asks `affectsSaveState`, the same predicate the indicator asked**,
rather than assuming every dispatched refusal was carried by it. That assumption was false for
a PRE-WRITE category — `Calculation`, `Domain`, `Validation`, `Reference` — where the indicator
resolves neutral: a calibration whose scale collapsed after dispatch and before
`geometry.write` reached nobody at all.

The delete flow deliberately stays on the notice. Its failed arm carries a failed referents
QUERY and a failed DISPATCH through one branch, and no predicate can separate them — a failed
query is a `Persistence` error exactly like a failed write. A toast for both over-reports the
dispatched case and correctly reports the query case; the unsafe direction is silence.

### Amendment 7 (2026-08-30): the stamp is a TYPE obligation, and the two report doors merge

**Amendment 5's central claim was false, and the sentence naming it is where the defect was.**
It says `faultError` "is the ONE place a thrown cause becomes an `AppError` — its definition
plus four callers, all catch blocks". `application/errors/guardAgainstThrowing.ts` holds a
second, and it is the one EVERY guarded command and query goes through: its `catch` maps the
cause through the vault's `ExceptionMapper` and returns a resolved failed `Result`, with no
stamp on it. So a repository exception under a dispatched editor command — `MoveSpatialObjectCommand`
against a vault that threw — reached Presentation looking exactly like a refusal the command had
chosen to return. `Persistence` is not a pre-write category, so `affectsSaveState` answered
true, the routing sent it to the save-state sink, and the mapped sentence reached nobody while
the badge went up. Reported by a review bot; the claim had never been grepped.

**The repair is not a second `markTechnicalFault` call.** `ExceptionMapper`'s declared return
type is `AppError & TechnicalFault` now, so the obligation is discharged by the compiler at
every mapper, including the geometry and import ones that file's own docblock promises are
coming. `guardAgainstThrowing` is unchanged — it already returns what its mapper gave it.
`faultError` drops its hand-written stamp, because `mapUnexpected` is an `ExceptionMapper`.
The module moved from `presentation/errors/` to `core/errors/technical-fault.ts`, since its
writer is now in `application/` and its reader in `presentation/`, on opposite sides of it.

**`reportCommitFailure` is gone, merged into `reportDispatchFailure`.** It existed as a second
function ONLY because its callers were the only ones whose faults carried a stamp, so the fault
arm would have been dead in its sibling — a split kept alive by the defect rather than by a
distinction. With both doors able to see a fault there is one rule and one function holding it,
which is what this document's own earlier amendment asked for. The module is `report-failure.ts`
rather than `report-refusal.ts`, because a refusal is precisely what the function distinguishes
from a fault.

The proof is `tests/application/errors/exceptionMapper.test-d.ts` (a claim about mappers not yet
written has no runtime form) and one behavioural case in `toolRefusalSurfaces.test.ts` that
drives the REAL `guardCommand` around a throwing command and requires the toast — watched red
against an unstamped mapper, with the file's other two cases staying green, which is what
distinguishes the fix from "toast everything".

### Amendment 6 (2026-08-30): a canvas showing stale data says so, without being replaced

`withEditorStateRefresh` re-reads after every committed write with `keepPreviousOnFailure`, and
`ProjectStore` honours that by keeping `status === 'ready'` and the previous scene when the
read fails, recording the error beside it. Nothing rendered that pair: the write succeeded, the
indicator read **Saved**, and the canvas silently showed pre-command geometry.

The in-place failure state is the wrong surface for it, which is why this needed its own
answer rather than a widened guard. The data on screen is valid — only stale — and
`keepPreviousOnFailure` exists precisely to keep showing it; replacing it would hide a plan the
user can still work on in order to report a read that failed.

`editor.refresh-failed` is an ADDITIVE strip in the region the two background notices already
use, shown while `status === 'ready' && error !== null`. It persists as long as the condition
does, which a toast would not.

## References

- SDD §66 Error Boundary — the pipeline this slice completes (the
  "Presentation → User Message" step specifically).
- SDD §64 Error Model — the eight-category closed set this table routes
  (defined in slice 2, referenced here).
- SDD §67 Logging — the unconditional-logging guarantee this slice assumes
  and does not weaken (slice 11; not to be confused with PRD's own §67).
- SDD §87 Data Safety, rule 5 ("never cascade-delete silently") — the reason
  deletion reference-integrity is this table's one true modal case.
- SDD §92 Architecture Completion Criteria, item 13 — a `MigrationError` is
  scoped to one entity, which is why it is discoverable per-entity rather
  than blocking plugin load.
- SDD §59 Inspector — where slice 16's inline field errors and slice 10's
  `recalculationStatus` badge both render.
- PRD §67 Autosave — Saved/Saving/Unsaved/Save Error states (slice 13; not
  to be confused with the SDD's own §67, Logging).
- PRD §64 Deletion Semantics — the Cancel/Remove-References/Reassign/
  Delete-Anyway flow (slice 15; not to be confused with the SDD's own §64,
  Error Model).
- PRD §63 Reference Integrity — the detection rules behind the
  `ReferenceError` category's delete-time case.
- PRD §39 User Experience Requirements — Inspector actions including
  Delete, the trigger for the reference-integrity modal case.
- Slice 2 (`02-core-primitives.md`) — `AppError`/`ErrorCategory` definitions,
  referenced not redefined.
- Slice 7 (`07-calibration.md`) — the `CalibrationError` worked example this
  slice splits across inline and toast surfaces.
- Slice 8 (`08-zone-editing.md`) — the pre-command `GeometryError` snapback
  case.
- Slice 10 (`10-assets-requirements-and-the-end-to-end-loop.md`) —
  `recalculationStatus` and the delete reference-integrity flow, both
  reconciled explicitly above.
- Slice 11 (`11-error-handling-diagnostics-and-data-safety.md`) — the
  `AppError`/`Logger`/`ToUserMessage` contracts this slice consumes, and the
  deliberately unnamed `surfaceError(...)` container its illustrative code
  leaves for this slice's table to fill in.
- `docs/requirements/Architecture and Software Design.md` — slice map, shared conventions, and the
  `§N`/`PRD §N` disambiguation this document follows throughout.
