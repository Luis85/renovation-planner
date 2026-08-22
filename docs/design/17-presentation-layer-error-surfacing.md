# Design Slice 17: Presentation-Layer Error Surfacing

## Purpose

SDD §66's Error Boundary pipeline ends in a step slice 11 named but did not
finish designing:

```text
Infrastructure Exception → Application Error Mapping → Typed Result → Presentation → User Message
```

Slice 11 fixed everything up to and including "a `DomainError` reaches
Presentation." It also fixed *what* a user message may contain (domain-level
fields only, never a raw exception). It did not fix *where* that message
appears. Meanwhile slices 13, 15, and 16 each built one presentation surface
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

### Out of scope (covered by other slices)

- The toast/save-state widgets, the modal/dialog framework, and inline
  field-error rendering themselves — slices 13, 15, 16 respectively. This
  slice only says which one a given error reaches; it does not design any
  of them, and introduces no fourth surface.
- The error category type hierarchy and `Result<T,E>` — slice 2. Referenced
  here, not redefined.
- The Infrastructure-exception-to-`DomainError` mapping, logging levels, and
  diagnostics snapshot — slice 11. This slice starts from an already-mapped
  `AppError` and a `Logger` call that has already happened; it does not
  revisit how either got there.
- Message *copy* — the exact string a `ToUserMessage` (slice 11) produces.
  This slice decides the container the string is placed in, not its wording.

## Dependencies

- Slice 11 (Error Handling, Diagnostics & Data Safety) — the eight `AppError`
  categories, the `ToUserMessage` contract, and the unconditional logging
  this slice assumes already ran before any surface is chosen.
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
- SDD §66 Error Boundary — the pipeline this slice completes.

## Design

### The decision procedure

A surface is not a function of the error *category* alone — the same
category can reach different surfaces depending on how it arose. Two
questions, asked in order, determine it:

```text
1. Does resolving this require the user to pick between several different,
   real outcomes (not just "OK" / dismiss)?
     → yes: MODAL (slice 15). Rare — reserved for cases like deletion with
       existing referents, where proceeding silently would violate SDD §87's
       "never cascade-delete silently."

2. Otherwise, is the failure attributable to exactly one visible input the
   user just edited (a single Inspector/form field)?
     → yes: INLINE FIELD ERROR (slice 16).

3. Otherwise, did this happen synchronously, as the direct result of an
   operation the user just triggered (a save, a delete, an explicit command)?
     → yes, and the operation is an autosave write with a live Saved/Saving/
       Unsaved indicator already on screen for that entity:
         flip that indicator to SAVE ERROR (slice 13) — no separate toast.
     → yes, otherwise:
         TOAST (slice 13), naming the failed operation.

4. Otherwise — discovered later, not the direct result of a click; a
   background cascade, or a load-time check on an entity nobody opened this
   session:
     → NO INTERRUPTIVE SURFACE. Log it (slice 11, already happened) and
       leave a persisted, discoverable marker on the affected entity —
       `recalculationStatus`-shaped, or slice 11's own
       `DiagnosticsSnapshot.validationIssues` — for whoever looks at that
       entity, or at Diagnostics, next.
```

Step 4 is the one most designs skip: most failures do not need to interrupt
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
| `PersistenceError` | Sync — a Vault write the user's action just triggered: an autosave debounce firing, a completed command's `save()`, or an explicit delete. | Autosave-path write: flips slice 13's persistent Saved/Saving/Unsaved/Save Error indicator to **Save Error** — no separate toast. A one-off write outside that lifecycle (no live indicator for that entity): slice 13 toast. | The indicator is already on screen for every autosaved entity and already has a Save Error state (PRD §67). A second, independent toast reporting the same failure would tell the user the same fact through two widgets that can drift (e.g. the toast dismisses, the indicator doesn't, or vice versa). Reserve the toast for persistence failures with no live indicator to flip. |
| `GeometryError` | Sync, but usually absorbed *before* it becomes a command: slice 8's interaction layer rejects a degenerate drag by snapping the handle back with **no command dispatched** — it never reaches the Error Boundary at all. When it does reach Presentation via a command's `Result` (e.g. programmatic input), it is operation-level, not field-level. | No surface for the pre-command case (nothing changed, nothing to report). Slice 13 toast for the command-`Result` case. | The canvas gesture that produced it has no discrete input to annotate inline, and it is not a decision the user must make — it names a rejected operation, which is exactly what a toast is for. |
| `ImportError` | Sync — the direct result of an explicit user-triggered import, but operation-level: the imported file/entity failed as a whole, not one field. | Slice 13 toast, naming the failed item. A future import that processes several entities in one pass and fails partway reuses slice 15's existing modal (the same enumerate-and-decide shape as the delete flow) only if the user must actually choose how to proceed (skip/retry/abort); if no decision is required, a toast summarizing the count is enough. | No import feature exists yet in slices 1–12 to anchor a built example, but the category is closed and must not be silently skipped. The same field/operation/decision test used everywhere else in this table applies to it once it arrives — it does not need a fourth surface invented for it. |
| `MigrationError` | Discovered when a Plan/Project loads and a repository refuses an entity whose `schema-version` is unsupported (SDD §92 item 13: scoped to that one entity, not the whole plugin) — not the direct result of a click. | A toast once at load time is reasonable to make the refusal visible immediately ("1 Zone could not be loaded"), but the durable record is slice 11's own `DiagnosticsSnapshot.validationIssues` — already designed, already the entity-scoped, content-free record of exactly this failure. | Same shape as `recalculationStatus`: a failure discovered when something is *opened*, not clicked into being. The plugin already has a computable place to keep it discoverable; this slice reuses it rather than inventing a second "broken entities" list. |
| `ReferenceError` | Splits by origin. **(a)** Sync — the direct result of an explicit Delete on an entity with existing referents (slice 8/10's delete flow). **(b)** Async — a background cascade (slice 10's `onZoneGeometryChanged` handler) hits a stale/dangling reference mid-recalculation. | **(a)** Slice 15's modal — the Cancel/Remove-References/Reassign/Delete-Anyway flow (PRD §64). **(b)** No interruptive surface — logged (slice 11), `Requirement.recalculationStatus` stays `"stale"`. | **(a)** is the one case in this table where the user must actually choose between several different, real outcomes — a toast has no room for four buttons, and there is no single field to attach an inline error to (the referents are other entities, not inputs). SDD §87's "never cascade-delete silently" is what forces a decision, not a display. **(b)** is a background retry candidate at the moment it happens, not a decision — see `CalculationError`(c) for the shared reasoning. |
| `CalculationError` | Splits by origin and attributability. **(a)** Sync, tied to one input — e.g. calibration's `calibration.invalid-distance` (the known-distance field). **(b)** Sync, operation-level, no single field — e.g. calibration's `calibration.coincident-points`/`calibration.degenerate-scale` (two canvas point-picks, not a form field) or a `Money.add`/`compare` currency mismatch. **(c)** Async, background — slice 10's `RecalculateRequirementCommand` failing inside the `onZoneGeometryChanged` cascade. | **(a)** Inline field error (slice 16). **(b)** Toast (slice 13). **(c)** No interruptive surface — logged only; `recalculationStatus` stays `"stale"`. | **(a)/(b)**: the category name alone does not decide the surface — what the failure is attached to does, exactly as with `ValidationError` vs. the rest. **(c)** is slice 10's own explicit worked case for "discovered later, not interrupted on": nothing the user directly asked for at that instant failed (a Zone move triggered it indirectly), so nothing is owed synchronously — the persisted stale marker is the entire contract, by slice 10's own design ("so the Inspector never presents a stale value as current"). |
| `DomainError` | Sync — the generic/base category. Per slice 11's own rule ("a mapping site must not default everything to a generic `DomainError`"), an `ExceptionMapper` rarely produces this; it appears where a command's own `Result` type still names it undecorated (e.g. `AssignAssetCommand`'s `Result<Requirement, ValidationError \| DomainError \| ReferenceError \| PersistenceError>`, slice 10, for whichever domain-invariant violation isn't the specific "Asset unit must be m2" `ValidationError` that same command also raises) for a domain-invariant violation that didn't warrant a narrower category — discovered as the direct result of the command that raised it. | Default: toast (slice 13), operation-level ("your action could not be completed"). If a specific `DomainError.code` is in practice field-attributable, route it like `ValidationError` (inline, slice 16) instead. | `DomainError` is a fallback category, not a distinct *kind* of failure with its own typical shape. Always-toast would be as wrong as slice 11 warns against always-mapping-to-it: the same field/operation test used for `CalculationError`/`ReferenceError` applies here too, just exercised less often because slice 11 pushes mapping toward narrower categories first. |

Every row still passes through slice 11's `ToUserMessage` for its copy; this
table only decides the container.

### Worked examples, reconciled explicitly

- **Zone save `PersistenceError` (slice 3/4).** Slice 11's own illustrative
  code (`toast.show(toUserMessage(result.error))` in
  `presentation/stores/zone-store.ts`) predates slice 13 and is superseded,
  for this specific autosave path, by the rule above: a Zone geometry save
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
  is logged (`errorBoundary.logRecalculationFailure`, slice 10's own code)
  and leaves `Requirement.recalculationStatus: "stale"` — no toast, no
  modal, no inline error, because nothing the user directly clicked just
  failed. The Inspector (slice 6) surfaces the stale badge whenever that
  Requirement is next viewed; that is the entire user-facing surface, by
  design.

### Logging is unconditional; surfacing is not

Slice 11 already logs every mapped error at the Application Error Mapping
step, before Presentation makes any choice covered by this slice. Nothing
here changes that. "No interruptive surface" (procedure step 4) means *no
additional UI beyond the persisted marker* — it never means "not logged,"
and it never means a call site is allowed to skip `logger.error` because it
decided a toast/modal/inline error was unwarranted. The two are produced by
different steps: logging happens once, at mapping time, for every error
without exception; surfacing is a Presentation-layer decision made *after*
that, using this slice's table, and may legitimately be "none."

## Interfaces & Contracts

This slice adds one small, presentation-local policy — not a new component,
a routing decision a call site consults after slice 11 has already produced
a `Result`:

```typescript
// presentation/errors/errorSurfacePolicy.ts

type ErrorOrigin =
  | { kind: "form-field-commit"; field: string }   // → slice 16 territory
  | { kind: "autosave-write" }                      // → slice 13 save-state territory
  | { kind: "explicit-operation" }                  // → slice 13 toast territory
  | { kind: "decision-required" }                    // → slice 15 modal territory
  | { kind: "background-cascade" };                  // → persisted marker, no UI

type ErrorSurface =
  | { kind: "inline"; field: string }
  | { kind: "toast"; level: "warning" | "error" }
  | { kind: "modal" }
  | { kind: "save-state" }
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
  `explicit-operation` → `toast`.
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
- **No double-reporting test**: for the autosave-write `PersistenceError`
  case specifically, assert that choosing `save-state` does not also invoke
  `notify.error` — the reconciliation with slice 13 is a behavior, not just
  a sentence, and gets a test that fails if a future edit reintroduces the
  duplicate toast slice 11's own illustrative code showed.

## Definition of Done

- All eight `AppError` categories from slice 2 appear in the decision table
  with a typical origin, a surface, and a justification — none silently
  defaulted to "toast" or omitted.
- `surfaceFor(error, origin)` is implemented, pure, and exhaustive over
  `ErrorCategory` with no `default` fallthrough case.
- A Zone-save `PersistenceError` on the autosave path flips slice 13's
  indicator to Save Error and does not also raise a toast for the same
  failure — proven by a test, not left as a sentence in this document.
- Calibration's `calibration.invalid-distance` renders as an inline field
  error; `calibration.coincident-points` and `calibration.degenerate-scale`
  render as toasts — both proven by tests distinguishing the two by origin.
- A delete on an entity with existing referents reaches slice 15's modal
  and never a toast or inline error, in every code path that can trigger it
  (Zone delete, Asset delete).
- A failed background recalculation (`onZoneGeometryChanged` cascade)
  produces zero toast/modal/inline calls; `recalculationStatus` remains the
  only user-facing trace until the affected Requirement is next viewed.
- Every error routed through `surfaceFor`, including every one resolving to
  `"none"`, is independently provable to have already been passed to
  `logger.error` — logging is never conditional on the surface chosen.
- No new UI component, widget, or fourth surface is introduced by this
  slice; every routed error lands on a toast, a modal, an inline field
  error, the save-state indicator, or a persisted marker slices 10/11/13/15/16
  already define.

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
  illustrative `toast.show(...)` call this slice's `PersistenceError` row
  supersedes for the autosave path.
- `docs/design/README.md` — slice map, shared conventions, and the
  `§N`/`PRD §N` disambiguation this document follows throughout.
