---
type: Task
parent: "[[Architecture and Software Design]]"
---
# Design Slice 16: Form & Inline Validation Feedback

## Purpose

Slice 6 fixed the Inspector's edit pipeline — a field commits on blur/enter, is wrapped
in one `UndoableCommand`, and is pushed through `CommandHistory.run()` exactly once per
commit. It also fixed what happens to the undo stack when that command's `Result` is an
error: nothing is pushed. What it deliberately left open is what the *field itself* does
at that moment — what the user sees, and whether their typed value survives.

This slice answers that. It defines one reusable field-error vocabulary — a rendering
component, a commit-rejection contract, and a routing convention from a command's typed
error to the input(s) it belongs to — reused by every bound input in every view, whether
that input lives in an already-open Inspector editing an existing entity or in a
creation dialog (a "New Asset" form) that does not exist until the user submits it.

Nothing here decides *which* errors reach a field versus a toast or a modal — that
routing, across all of slices 13–16's surfaces, is slice 17's decision table. This slice
only defines what happens once an error has been routed here: how it renders, whether
the field keeps or loses the user's input, and how one command's error maps to one field,
several fields, or none.

## Scope

### In scope

- The field-error rendering vocabulary: one component pairing a bound input with an
  inline, persistent error message, reused verbatim by the Inspector and by creation
  dialogs — never reimplemented per screen.
- The commit-rejection contract: an explicit, justified answer to "does a field revert to
  its last valid value or keep the rejected one?" for both the Inspector's per-field
  blur-commit (slice 6) and a creation dialog's per-form submit-commit (new to this
  slice).
- The error-to-field routing convention: a lightweight, per-form lookup from a command
  error's `code` to the field(s) it belongs to, with an explicit fallback (a form-level
  banner) for an error that is not about any single field.
- Field-level accessibility wiring (`aria-invalid`, `aria-describedby`, non-color-only
  status), per SDD §85 / PRD §44.
- Creation dialogs as a second consumer of this same vocabulary, distinct from an
  Inspector editing an existing entity — hosted inside slice 15's modal container where
  one exists, without redesigning that container.

### Out of scope (covered by other slices)

- Toasts for successful or failed *operations* as a whole (e.g. "Zone created", "Save
  failed") — slice 13. A toast is transient and not anchored to a surviving input; a
  field error is persistent and anchored to exactly one input until corrected.
- The modal/dialog chrome itself — focus trap, backdrop, dismiss affordance, the "are you
  sure" confirmation flow — slice 15. This slice assumes a creation dialog's *fields* may
  render inside that chrome; it does not design the chrome.
- Empty states (no entity selected, no assets in the library) — slice 14.
- The category-to-surface decision table (which `ErrorCategory` becomes a toast, a field
  error, a modal, or a status badge) — slice 17. This slice defines how a field error
  renders once routed here, never which errors get routed here.
- Changing when or how a command is dispatched. Slice 6's transaction boundary (one
  gesture or one field commit → one command → one history entry) is unchanged; this
  slice only defines what happens to the field when that one command's `Result` is
  `Err`.
- The validation rules themselves (`unitCost >= 0`, `wasteFactor` in `[0, 1]`,
  `pointA !== pointB`, and so on) — owned by the domain modules and commands that raise
  them (slices 3, 7, 9, 10). This slice only consumes their typed errors.
- Mapping an Infrastructure exception to a typed `AppError` — slice 11's Error
  Boundary. By the time an error reaches this slice it is always already one of slice
  2's typed categories.

## Dependencies

- Slice 6 (Editor Tool Framework, Undo/Redo & Inspector) — the commit-then-dispatch flow
  this slice attaches to: a field commits on blur/enter, becomes one `UndoableCommand`,
  and is run through `CommandHistory.run()`, which resolves
  `Promise<Result<void, AppError>>` rather than a bare `void`. That return type is what
  this slice depends on: a dispatcher that resolved `void` would leave a field with
  nothing to route, and no way to tell a rejected commit from an accepted one.
- Slice 2 (Core Primitives) — the `BaseError`/`ErrorCategory`/`AppError` shape
  (`ValidationError`, `CalculationError`, etc.) this slice renders. Consumed as-is; not
  redefined, not extended with new required fields.
- Slice 11 (Error Handling, Diagnostics & Data Safety) — `ToUserMessage`, the one
  function that turns an `AppError` into user-facing copy. This slice reuses it rather
  than inventing a second message-authoring path, per slice 11's own rule that a terse
  message and its log entry "must not drift into being produced from two independent
  code paths" — the same applies to a field message and a banner message.
- ADR-004 (Vue 3) — the component and composable shapes below are Vue idioms (`ref`,
  props, slots).
- ADR-005 (Pinia for Presentation State) — why an in-progress field draft is component-
  local state, never written into a Pinia store (see Persistence Impact).

Slice 15 (Modals & Confirmation Dialogs) is **not** a structural dependency — per the
slice map, 13–16 are independent UI vocabulary and none depends on another. A creation
dialog's fields work the same whether they render inside slice 15's modal container or
a placeholder host built ahead of it; where slice 15 exists, this slice's forms are
hosted inside it rather than defining their own overlay/backdrop/focus-trap.

## Design

### Three kinds of validation feedback, and why field-level is its own thing

The same underlying failure — a failed `Result` from a command — can surface three
different ways, and confusing them is the mistake this slice exists to prevent:

```text
"Was an input this user is looking at itself invalid?"
    → field-level (this slice): synchronous-feeling, anchored to ONE input,
      appears the instant that input's commit is rejected, never auto-dismisses.

"Did an operation as a whole succeed or fail?"
    → toast (slice 13): transient, not anchored to any surviving input,
      appropriate once the operation has already resolved either way.

"Does proceeding require an action the user must explicitly confirm because it
 is destructive or irreversible?"
    → modal (slice 15): blocks further interaction until answered.
```

A field-level error is never a toast wearing a different CSS class: a toast reports on
an operation that is *finished* (success or failure); a field error reports on an input
that is *still being corrected*. Toasting "Unit cost must be non-negative" and moving on
would tell the user something failed without leaving them anything to fix it against —
the field it was about would already have scrolled past by the time they read it.

### The commit-rejection contract

Slice 6 fixed the dispatch side: one field commit → one command → `CommandHistory.run()`
→ on a failed `Result`, nothing is pushed to the undo stack. It left open what the field
*displays* at that moment. Two candidates:

1. **Revert** — snap the field back to its last known-valid (query-derived) value the
   instant the command rejects it; show the error transiently (e.g. a toast or a
   momentary tooltip).
2. **Keep** — leave the user's typed value in the field, alongside a persistent inline
   error, until they either correct it (triggering a new commit) or explicitly cancel.

**Decision: keep.** A rejected commit keeps the rejected value in the field and shows a
persistent inline error under it. It does not revert.

Reasoning:

- **Reverting destroys the user's own input for no architectural reason.** Slice 6
  already guarantees that a rejected commit writes nothing — the Vault, the domain
  state, and the undo stack are all untouched. Silently replacing what the user typed
  with the old value is a second, presentation-only decision layered on top of that
  guarantee, and it is the worse one: it forces the user to reconstruct what they meant
  to type from a transient message, which is a particularly bad experience for the
  common case of a small mistake (typing `-5` instead of `5` for a unit cost, a
  transposed digit, a stray character) where the fix is one keystroke away from what is
  already on screen.
- **It does not weaken "one commit, one command."** Both candidates satisfy that rule
  equally: a rejected commit is still exactly one `UndoableCommand.execute()` call that
  resolved to a failed `Result`, exactly once, with nothing queued or retried automatically.
  Keeping the value only changes what the *next* keystroke-then-blur cycle starts from —
  correction is a deliberate, separate user action that produces its own new, single
  command dispatch when it commits. Nothing here reopens or resends the rejected
  command; there is no retry loop and no partially-applied state to reconcile.
- **It requires the field to hold draft state independent of the canonical value**, and
  that requirement is itself informative: `InspectorDto` (slice 6) is derived from a
  read-only query against the *actual* selected entity, so on a rejected commit it still
  reflects the old, unchanged value. A field that displayed `dto.value` directly would
  therefore already look "reverted" on the next render, with no error attached, unless it
  keeps its own draft. This slice makes that draft explicit rather than accidental.
- **It gives the user an explicit way out.** Per PRD §39's global `Escape` shortcut (SDD
  §19 already treats drag/tool state this way for canvas gestures), pressing `Escape` on
  a field with a rejected, uncorrected commit discards the draft, clears the error, and
  resyncs the field to the canonical value — the same "abandon this gesture with no
  command ever dispatched" semantics slice 6's `cancel()` gives a canvas tool. Reverting
  is available; it is opt-in, not the silent default.

The field's state machine, independent of whether the eventual command succeeds or is
rejected:

```text
clean      : draft == canonical (from DTO/query); no error
editing    : draft != canonical; no error yet; no command dispatched (keystrokes only)
committing : blur/enter fired; exactly one command in flight; draft unchanged, disabled
             or marked pending
rejected   : command resolved a failed Result; draft UNCHANGED (still the rejected value);
             inline error shown; field stays editable
accepted   : command resolved ok; draft cleared; field re-syncs to the new
             canonical value on the next query/DTO refresh
cancelled  : user pressed Escape from "editing" or "rejected"; draft discarded, error
             cleared, field resyncs to canonical value; no command ever dispatched
```

### Error-to-field routing

A command's failed `Result` carries one `AppError` (slice 2), but not every `AppError` is "about"
one field:

- `CreateAssetCommand`'s `unitCost < 0` (slice 10) is squarely about the `unitCost`
  field.
- `ReversibleCalibratePlanCommand`'s `calibration.coincident-points` (slice 7) is not
  about `pointA` or `pointB` individually — either point alone is perfectly valid; it
  is the pair that is wrong. Attaching it under just one of the two fields would
  misdescribe the problem.

Slice 2 deliberately does not enumerate `code` values centrally ("None of these
enumerate their own code values here — that catalog is [each error-producing module's]
own"). This slice therefore does not attempt one global code registry either; it defines
a small, per-form lookup that a form or Inspector panel declares alongside the fields it
renders, and a pure function that applies it:

```typescript
// presentation/errors/route-error.ts
type FieldErrorMap<TInput> =
  Readonly<Record<string /* error code */, keyof TInput | readonly (keyof TInput)[]>>;
// a code with no entry in the map is NOT an omission to fill in later — it is the
// explicit statement "this failure is not about one field", and routes to the banner.

type RoutedError<TInput> =
  | { readonly kind: 'field'; readonly fields: readonly (keyof TInput)[]; readonly message: string }
  | { readonly kind: 'banner'; readonly message: string };

function routeError<TInput>(
  error: AppError,
  map: FieldErrorMap<TInput>,
  toUserMessage: (error: AppError) => string, // slice 11's port, language already bound
): RoutedError<TInput> {                       //   by the caller — see below
  const fields = map[error.code];
  const message = toUserMessage(error);
  return fields === undefined
    ? { kind: 'banner', message }
    : { kind: 'field', fields: Array.isArray(fields) ? fields : [fields], message };
}
```

`map`'s values are typed as `keyof TInput`, so a form's error map is checked against the
real command input shape at compile time — a typo'd field name, or a field the command
was refactored to remove, fails to type-check rather than silently pointing an error at
nothing. This is the same category of guarantee slice 5's `ScreenPoint` brand gives the
editor: the mapping is a real, checked contract, not a naming convention a later edit
can quietly break.

`message` comes from the same `toUserMessage(error)` call whether it ends up at a field
or in a banner — one message, one place it is produced, shown in one of two places. A
form never authors a second, field-specific wording for the same error, and never a
literal: slice 11's `ToUserMessage` resolves copy through `presentation/i18n`'s
`t(language, key)`, so a field error is translated for free. `routeError` takes it as a
pre-bound `(error) => string` rather than taking a language of its own, which keeps the
routing function pure and language-agnostic — it decides *where*, never *what*.

Worked examples:

```text
CreateAssetInput = { name, category, unit, unitCost, wasteFactorDefault?, ... }
AssetFormErrorMap: FieldErrorMap<CreateAssetInput> = {
  'asset.unit-cost.negative': 'unitCost',
  'asset.waste-factor.out-of-range': 'wasteFactorDefault',
}
→ ValidationError{ code: 'asset.unit-cost.negative' } routes to the unitCost field.

CalibratePlanInput = { planId, pointA, pointB, knownDistance }
CalibrationFormErrorMap: FieldErrorMap<CalibratePlanInput> = {
  'calibration.invalid-distance': 'knownDistance',
  // 'calibration.coincident-points' has NO entry — deliberately, not an oversight
}
→ CalibrationError{ code: 'calibration.coincident-points' } has no map entry → banner:
  "Point A and Point B must be different locations."
```

The calibration case is the clearest illustration of *why* the fallback exists, and it
is worth being precise about the surface it applies to. Slice 7's calibration panel is
not a four-field form: `pointA` and `pointB` come from two canvas clicks, and the only
thing the user types is `knownDistance`. That is exactly the point — `knownDistance` is
the one input a field error can attach to, and `coincident-points` is a failure of a
pair the user expressed by clicking, with no input under which to render it. A design
that insisted every error code map to *some* field would have had to invent one here.

This routing is category-agnostic: a `ValidationError` and a `CalculationError` (e.g. a
derived cross-field figure a command rejects, distinct from a single bad input) are
routed by exactly the same `routeError` call, keyed off `code`, never a branch on
`category`. Whether a given category is even allowed to reach a field versus a toast or
a modal is slice 17's decision; once it has been routed here, this slice treats every
category identically.

### Shared component vocabulary

One component renders a field-level error; one renders the banner fallback. Both live in
`presentation/components/` (SDD §77) and are imported by name, never re-implemented:

```text
<FieldError>                          <FormBanner>
┌─────────────────────────┐           ┌──────────────────────────────────┐
│ Unit cost                │           │ ⚠ Point A and Point B must be    │
│ ┌─────────────────────┐ │           │   different locations.            │
│ │ -5                  │ │ ← draft   └──────────────────────────────────┘
│ └─────────────────────┘ │             anchored at the top of the form/
│ ⚠ Must be zero or more   │ ← error     dialog, not to any one input
└─────────────────────────┘
```

- `<FieldError>` wraps a caller-supplied input via its default slot and renders the
  error text beneath it; it sets `aria-invalid="true"` on that input while an error is
  present, and `aria-describedby` pointing at the error text's element id. It does not
  own the input's value — the composables below hold the draft, so `<FieldError>` takes
  only `message` and `inputId` and stays usable by any bound control. The error is always rendered as text plus a non-color glyph (`⚠` or
  equivalent) next to the input's own border-color change — per SDD §85 / PRD §44,
  "status not encoded only by color."
- `<FormBanner>` renders the fallback case: a single message anchored to the form/dialog
  as a whole, not to any input. It is not a toast (it does not auto-dismiss, and it lives
  inside the form's own layout, not a global notification region) and not a modal (it
  does not block interaction with the rest of the form).
- Neither component knows about `AppError`, `routeError`, or any command. They take a
  plain `message: string | null` prop (and, for `<FieldError>`, the bound value/draft).
  Everything error-shaped is resolved before it reaches them — this keeps them reusable
  outside this slice's own composables if a future need (a settings-pane field, e.g.)
  wants the same rendering without the command-commit machinery below.

### Two hosting contexts, one contract

**Inspector (existing entity, per-field blur-commit — slice 6's flow).** Each bound row
in the Inspector uses a per-field composable that owns the draft/error/pending state
described above and dispatches through the same `CommandHistory` instance tools use:

```typescript
// presentation/composables/use-field-commit.ts
interface UseFieldCommit<T> {
  // Read-only for the same reason as UseFormCommit below, and by the same rule: the
  // composable owns this state and its three methods are the write paths. DeepReadonly
  // on the draft because T may be an object field; see there for why Readonly is not
  // enough when it is.
  readonly draft: DeepReadonly<Ref<T>>;
  readonly error: Readonly<Ref<string | null>>;
  readonly pending: Readonly<Ref<boolean>>;
  // Draft only — per slice 6 a keystroke never dispatches. It ALSO clears `error`, for
  // exactly the reason setField does: a rejected commit's message must not outlive the
  // user correcting the value it is about. Same rule, both commit boundaries.
  onInput(value: T): void;
  onCommit(): Promise<void>;  // blur/enter — exactly one command dispatch
  onCancel(): void;           // Escape — discard draft, clear error, resync to canonical
}

function useFieldCommit<T, TInput>(options: {
  // MaybeRefOrGetter, not Ref: `docs/setup/vue-conventions.md` §4 asks composables to
  // accept a value, a ref OR a getter and normalize with toValue() inside the tracking
  // context. The caller here is an Inspector panel reading one field off an InspectorDto,
  // which is most naturally a computed getter — a Ref-only signature would have forced
  // every call site to wrap one. Read-only in this composable either way.
  canonicalValue: MaybeRefOrGetter<T>;          // sourced from InspectorDto, read-only here
  buildCommand: (value: T) => UndoableCommand;  // wraps whichever plain command owns
                                                //   this entity's properties (slice 8)
  history: Pick<CommandHistory, 'run'>;         // the same instance EditorContext hands tools
  errorMap: FieldErrorMap<TInput>;
  field: keyof TInput;
}): UseFieldCommit<T>;
```

**Creation dialog (new entity, per-form submit-commit — new to this slice).** A "New
Asset" dialog has no entity yet, so there is nothing to blur-commit per field against;
its natural commit boundary is the explicit submit action, across every field at once.
The same contract still applies at that boundary: one submit is one command dispatch,
and a rejection keeps every typed value, routes the error to its field(s) or the banner,
and does not close the dialog:

```typescript
// presentation/composables/use-form-commit.ts
interface UseFormCommit<TInput> {
  // Read-only to the component: setField is the ONLY write path, and a mutable shape
  // cannot enforce that (see Interfaces & Contracts below). DEEP, not `Readonly<Ref<T>>`:
  // that spelling freezes the binding and not the object, so it still permits both of
  // the writes this shape exists to refuse — `values.value.unitCost = x` from script,
  // and `v-model="values.unitCost"` from markup, since a ref unwraps in templates.
  // This interface is stated twice in this document (here and there); they must not drift.
  readonly values: DeepReadonly<Ref<TInput>>;           // every field's current draft
  // Not deep, and does not need to be: `ReadonlyMap` already refuses `set`/`delete`, and
  // its values are strings, so nothing below `.value` is left to freeze.
  readonly fieldErrors: Readonly<Ref<ReadonlyMap<keyof TInput, string>>>;
  readonly banner: Readonly<Ref<string | null>>;
  readonly submitting: Readonly<Ref<boolean>>;
  // Writes the field AND clears that field's entry in fieldErrors. Editing a field the
  // server just rejected must retire its message: a form showing "must be positive"
  // over a value the user has since corrected is telling them something untrue.
  setField<K extends keyof TInput>(key: K, value: TInput[K]): void;
  submit(): Promise<boolean>;   // true only on an ok Result; caller closes the dialog then
}

function useFormCommit<TInput, TResult>(options: {
  initial: TInput;
  dispatch: (input: TInput) => Promise<Result<TResult, AppError>>; // e.g. CreateAssetCommand
  errorMap: FieldErrorMap<TInput>;
}): UseFormCommit<TInput>;
```

**One rule covers both composables' returned state: the composable owns it, the component
reads it, and the named methods are the only write paths.** Every member of both
interfaces is therefore read-only to the caller — `draft`, `error`, `pending`, `values`,
`fieldErrors`, `banner`, `submitting` — and this is stated once here rather than
member-by-member, because deciding it per member is how the pair drifted in the first
place. `vue-conventions.md` §4 is silent on read-only returns and asks only for a plain
object of refs, which readonly refs still are: destructuring them preserves reactivity,
so nothing here departs from §4.

The rule has behaviour under it and not just types, and that behaviour is what makes the
sole write path worth enforcing. `setField` clears the edited field's error; **`onInput`
clears `error` for the same reason**. A first version of this slice gave the form path
that behaviour and left the Inspector path without it, which contradicted the paragraph
above — the two composables were supposed to differ only in commit boundary, and would
instead have differed in whether editing a rejected field retires its stale message. An
Inspector field would have gone on displaying "must be zero or more" under a value the
user had already corrected, until they committed or pressed `Escape`. That is the exact
untruth the form path names as its justification, so having it on one side only was the
rule going unmirrored rather than a deliberate asymmetry.

`submit()` returning `false` is the whole contract for "stay open": the dialog host
(slice 15's modal, or a placeholder host) never inspects the error itself to decide
whether to close — it only checks the boolean, keeping slice 15's container ignorant of
form-specific error shapes. Both composables call the exact same `routeError` and render
through the exact same `<FieldError>`/`<FormBanner>` pair; the only difference between
them is the commit boundary (one field vs. every field at once), not the vocabulary.

## Interfaces & Contracts

```typescript
// presentation/errors/route-error.ts
type FieldErrorMap<TInput> =
  Readonly<Record<string, keyof TInput | readonly (keyof TInput)[]>>;

type RoutedError<TInput> =
  | { readonly kind: 'field'; readonly fields: readonly (keyof TInput)[]; readonly message: string }
  | { readonly kind: 'banner'; readonly message: string };

// Not under `presentation/composables/`: it is a pure function, and
// `docs/setup/vue-conventions.md` §4 scopes that directory to `use*` composables —
// things that bind reactivity or a lifecycle. `routeError` binds neither. That is the
// whole reason; the directory has no bearing on how this is tested, which slice 12's
// profiles decide (see File layout).
function routeError<TInput>(
  error: AppError,               // slice 2 — consumed, not redefined
  map: FieldErrorMap<TInput>,
  toUserMessage: (error: AppError) => string, // slice 11's port, language pre-bound
): RoutedError<TInput>;

// presentation/composables/use-field-commit.ts — Inspector, per-field blur-commit
interface UseFieldCommit<T> {
  readonly draft: DeepReadonly<Ref<T>>;
  readonly error: Readonly<Ref<string | null>>;
  readonly pending: Readonly<Ref<boolean>>;
  onInput(value: T): void;    // draft AND clears `error` — see the Design section
  onCommit(): Promise<void>;
  onCancel(): void;
}

// presentation/composables/use-form-commit.ts — creation dialog, per-form submit-commit
interface UseFormCommit<TInput> {
  // `DeepReadonly`, not `Readonly` — see the Design section: `Readonly<Ref<TInput>>`
  // freezes the binding and not the object, so it would permit exactly the two writes
  // that walk past setField. Produced by Vue's own `readonly()`, which is also a runtime
  // proxy: a bypass that evades the compiler (an `any`, a cast) still fails to write.
  readonly values: DeepReadonly<Ref<TInput>>;
  // A Ref, not a bare ReadonlyMap. The bare form was not merely off-§4 — it does not
  // work: a plain Map handed out of a composable is a snapshot, so a form whose submit()
  // was rejected would compute its field errors and render none of them. `banner` and
  // `submitting` beside it were already refs, which is what made the odd one out easy to
  // miss and is also the reason it is not a departure worth declaring: the conforming
  // shape is the one that behaves.
  readonly fieldErrors: Readonly<Ref<ReadonlyMap<keyof TInput, string>>>;
  readonly banner: Readonly<Ref<string | null>>;
  readonly submitting: Readonly<Ref<boolean>>;
  setField<K extends keyof TInput>(key: K, value: TInput[K]): void;
  submit(): Promise<boolean>;
}

// presentation/components/FieldError.vue — props (script surface, not markup)
interface FieldErrorProps {
  readonly message: string | null;   // null → no error, no aria-invalid, nothing rendered
  readonly inputId: string;          // the bound input's id, for aria-describedby wiring
}

// presentation/components/FormBanner.vue
interface FormBannerProps {
  readonly message: string | null;
}
```

File layout. SDD §77 already draws `presentation/components/` and
`presentation/composables/`, which this slice populates rather than adds. It does add one
sibling — `presentation/errors/` — for the one module here that is not a composable:

```text
presentation/
├── components/
│   ├── FieldError.vue
│   └── FormBanner.vue
├── composables/
│   ├── use-field-commit.ts
│   └── use-form-commit.ts
└── errors/
    └── route-error.ts
```

`route-error.ts` sits outside `composables/` because
`docs/setup/vue-conventions.md` §4 scopes that directory to `use*` composables — things
that bind reactivity or a lifecycle — and `routeError` is a pure function that binds
neither.

That is the whole reason, and it is worth saying what the reason is **not**. A draft of
this paragraph claimed the move is what keeps `routeError` node-testable rather than
reachable only through jsdom. That is false, and slice 12 says so directly: the test
environment is chosen by the test file's own profile, not by the directory the source
sits in, and slice 12 already lists `routeError` among the node-profile pure functions —
it did so while the file was still under `composables/`. Nothing about this move changes
how it is tested. Left standing, that sentence would have taught an implementer that a
pure helper under `composables/` needs jsdom, which would be a worse error than the
misplacement it was justifying.

`presentation/errors/` is a new top-level folder under `presentation/`, so this slice no
longer claims to add none — the same refinement of §77 that slice 15 makes for
`presentation/dialogs/`, and made the same way: §77's tree does not draw it, so it is a
sibling rather than something nested inside a folder it does not belong to.

**This slice creates the folder and slice 17 joins it**, which is a fact rather than a
plan. Slice 17's `errorSurfacePolicy.ts` — its routing table from an `ErrorOrigin` to a
surface — already sits there, and slice 17 depends on this one (the README's table: 16
needs 6 and 11; 17 needs 11 and 13–16), so the directory exists by the time slice 17
needs it. An earlier version of this paragraph said "if a later slice gives that mapping
a home", which was a forward promise over something a document away had already done;
slice 17 now names this slice back, so a reader arriving from either side finds the
other. Slice 11 owns error *mapping* and names no presentation directory at all, so
nothing of its is waiting on this one.

## Persistence Impact

None. This slice reads slice 2's error types and slice 11's `toUserMessage` port; it
writes nothing new to the Vault and adds no repository, sidecar field, or schema.

Every piece of state this slice introduces — a field's draft value, its pending/error
flags, a form's per-submission field-error map and banner text — is component-local
(Vue `ref`/`reactive`), never written into a Pinia store, per ADR-005 and SDD §15's
ephemeral-state list. It exists only for the duration of an in-progress edit or an open
dialog and is discarded on commit, cancel, or unmount; none of it survives a plugin
reload, and none of it is the source of truth for anything — the DTO/query result slice
6 already defines remains that.

## Testing Strategy

Both composables return refs, so **test code dereferences `.value`** —
`values.value.unitCost`, `fieldErrors.value.get('unitCost')`, `draft.value`. The
unwrapping that lets a template write `values.unitCost` is a template feature and does
not apply here. Stated once because every assertion below touches one of these members,
and a spec written in the template's spelling would not type-check as a test.

- **`routeError` unit tests** — pure-function, table-driven: a code present in the map
  routes to its field(s) with `toUserMessage(error)`'s exact text; a code absent from the
  map routes to a banner with the same text; a map entry naming multiple fields produces
  a `fields` array with more than one entry. No Vue, no command, no Obsidian.
- **Field commit-rejection test** — drive `useFieldCommit` with a fake `buildCommand`
  whose `execute()` resolves a failed `Result` carrying a `ValidationError`; assert `draft` still holds
  the rejected value (not the pre-edit canonical one), `error` is non-null, and
  `history.run()` was called exactly once. Then call `onInput` with a corrected value and
  assert **both** halves: `draft.value` now holds that value — `onInput`'s primary job —
  and `error` clears, with no further `history.run()`. Both, because an `onInput` that
  cleared the error and never wrote the draft would satisfy the second alone; a method's
  own job has to be asserted beside its side effect or the side effect becomes the whole
  contract. Finally call `onCancel()` and assert `draft` resets to `canonicalValue` and
  `error` clears. The mirror assertion belongs to the creation-dialog test below, since a
  rule proven on one composable and assumed on the other is how this pair drifted.
- **Field commit-success test** — same setup resolving `ok(...)`; assert `draft` clears and
  the field's displayed value tracks a subsequently updated `canonicalValue` (simulating
  the DTO refresh after a successful write).
- **Creation-dialog rejection test (the worked example)** — drive `useFormCommit` with a
  `CreateAssetCommand`-shaped `dispatch` fixture returning
  `err(validationError({ code: 'asset.unit-cost.negative' }))` for
  `{ unitCost: -5, ... }`. The order matters, because the last step changes what the
  earlier ones assert. First: `submit()` resolves `false`; `fieldErrors.value` holds an
  entry for `unitCost`; `values.value.unitCost` is still `-5` — draft preservation, which
  is the point of the test; and the fixture's repository/event-publish spies recorded zero
  calls (no `AssetCreated`, no write). **Then** call `setField('unitCost', 5)` and assert
  all three: `values.value.unitCost` is now `5` — the write, which is `setField`'s primary
  job — the `unitCost` entry is gone from `fieldErrors.value`, and any other field's entry
  is untouched. The write is asserted for the same reason as on the field path above: a
  `setField` that only cleared errors would pass a spec that checked only the clearing.
  Asserting draft preservation after this call would instead be checking for `-5` in a
  field just set to `5`, which is why it belongs in the block before it.
- **Creation-dialog success test** — same fixture resolving `ok(...)`; assert `submit()`
  resolves `true` (the signal the dialog host uses to close, per slice 15's container
  contract) and `fieldErrors`/`banner` are empty.
- **Banner-routing test** — a `ReversibleCalibratePlanCommand`-shaped fixture returning
  `CalibrationError{ code: 'calibration.coincident-points' }`; assert `routeError` (and,
  through it, `useFormCommit`) produces a `banner` result and that neither `pointA` nor
  `pointB` receives an entry in `fieldErrors`.
- **`<FieldError>` component test (Vue Test Utils, per PRD §100)** — the component
  takes an already-resolved `message`, so these tests pass literals directly and involve
  no locale table; `message: null` renders no error text and no `aria-invalid`; a non-null message renders the text
  content itself (not only a CSS class), sets `aria-invalid="true"` on the input, and
  sets `aria-describedby` to the error text element's id.
- **No-color-only assertion** — for a rendered field error, assert the accessible text
  content is non-empty independent of any class name, satisfying SDD §85 / PRD §44's
  "status not encoded only by color" without relying on a snapshot of computed styles.

## Definition of Done

1. Submitting `{ unitCost: -5, ... }` on the Asset creation form dispatches
   `CreateAssetCommand` exactly once, which resolves a failed `Result` carrying a
   `ValidationError` before
   any repository write (per slice 11's "validate before write" rule); the dialog does
   not close; an inline error renders under the `unitCost` field specifically; no
   `AssetCreated` event is published and no Vault write occurs.
2. The same rejection leaves `-5` visible in the `unitCost` input — it is not reverted to
   a prior or blank value. Pressing `Escape` afterward discards the draft, clears the
   error, and resyncs the field (to the last valid value in an Inspector context, or to
   the form's initial value in a creation-dialog context).
3. An Inspector field's rejected commit behaves identically to (1)–(2): the draft is
   kept, the inline error renders, and no entry is pushed to the undo stack (consistent
   with slice 6's own Definition of Done item 5). The field only adopts a new displayed
   value after a subsequent commit resolves `ok(...)` and the DTO/query is refreshed.
4. `ReversibleCalibratePlanCommand`'s `calibration.coincident-points` renders as a
   form-level banner, never as an inline error under `pointA` or `pointB`
   individually — proven by a `routeError` unit test, not asserted only in prose.
5. `<FieldError>` and `<FormBanner>` are the only two components used to render a
   validation error anywhere in the plugin's forms; no Inspector-specific or
   dialog-specific error-rendering component exists alongside them.
6. Every rendered field error carries non-empty accessible text and sets
   `aria-invalid`/`aria-describedby`; nothing communicates an invalid field by border
   color or class name alone.
7. `routeError` has no Vue, Obsidian, or command dependency and is unit-tested as a pure
   function; `useFieldCommit`/`useFormCommit` are unit-tested against fake commands/
   dispatch functions, independent of a live canvas or Vault.
8. No new Pinia store, repository, or persisted field was introduced by this slice; all
   draft/error/pending state is traceable to component-local `ref`/`reactive` state that
   does not outlive the component or dialog it belongs to.
9. No user-facing literal appears under `presentation/components/` or
   `presentation/composables/` — every message a field or banner renders arrived through
   slice 11's `ToUserMessage`, which resolves it from the locale tables.
10. The composables' returned state is read-only to the component **by type**, not by
    convention, so the named methods are the only write paths. With `useFormCommit`'s
    result in hand, `values.value.unitCost = -5` and a component binding
    `v-model="values.unitCost"` each fail `vue-tsc -noEmit`; the same holds for
    `useFieldCommit`'s `draft` against `onInput`. Both spellings are checked on each,
    because they fail for different reasons — one is a property write through the ref,
    the other through template unwrapping — and the shallow `Readonly<Ref<TInput>>` this
    slice started with permits both while looking like it forbids them. Proven by a
    fixture that stops failing if the type is widened back, in the manner slice 1's
    Definition of Done requires of its Vue rules, never by the interface reading as
    though it were read-only.
11. Editing a rejected field retires its message on **both** commit boundaries:
    `setField` clears that field's entry in `fieldErrors`, and `onInput` clears `error`,
    each asserted directly rather than inferred from the other. Neither dispatches a
    command while doing it. This is the one behavioural rule the read-only types above
    exist to protect, so a version of this slice that enforced the write path without it
    would be guarding an entry point that does nothing worth guarding.

## References

- SDD §59 Inspector Architecture — selection → query → DTO → UI → command; this slice
  covers the last step's failure path only.
- SDD §64 Error Model — the eight error categories this slice renders without
  redefining.
- SDD §65 Result Pattern — `Result<T,E>` as the only channel an expected failure travels
  through; this slice never receives a raw exception.
- SDD §66 Error Boundary — the mapping pipeline (slice 11) that produces the typed error
  this slice consumes; this slice is the last stage, "User Message," applied specifically
  to a field.
- SDD §77 Proposed Repository Structure — `presentation/components/` and
  `presentation/composables/`, populated, not newly added, by this slice; plus
  `presentation/errors/`, which this slice DOES add, for `route-error.ts` (see File
  layout).
- `docs/setup/vue-conventions.md` §4 — the composable rules this slice's two `use*`
  modules follow, and the reason `route-error.ts` is not among them. **Both conform; the
  slice declares no departure.**

  It briefly did. `values` was a `Reactive<TInput>`, declared as a departure on the
  reasoning that a creation dialog's field set is the one place a mutable reactive object
  is the natural shape, since `v-model="values.unitCost"` beats a per-field `Ref` map to
  write and to read. That justification was self-defeating in its own sentence: `v-model`
  on a mutable reactive property assigns to it directly, which walks straight past
  `setField` — named as the sole write path in the same clause. Two mutation contracts,
  and anything centralised in `setField` reachable only by the path nobody was told to
  take.

  So `values` is a `DeepReadonly<Ref<TInput>>`, bound for reading and written only through
  `setField` — `:model-value="values.unitCost"` with
  `@update:model-value="v => setField('unitCost', v)"`, never `v-model`. `setField` now
  earns the exclusivity by doing something with it: it clears that field's error, so a
  message the user has already corrected stops being displayed. Conforming and behaving
  turned out to be the same shape here, which is why the departure was withdrawn rather
  than restated with a better argument.

  The depth is the whole repair and not a detail of spelling. The first version of this
  paragraph said `Readonly<Ref<TInput>>`, which is the shape that *reads* as read-only
  while refusing only the one write nobody was going to attempt: `Readonly<T>` is a
  shallow mapped type, so it marks `.value` immutable and stops there. `TInput`'s own
  properties stay mutable, so `values.value.unitCost = -5` type-checks, and a ref unwraps
  in templates, so `v-model="values.unitCost"` does too. That is the departure's original
  self-defeating sentence surviving into the fix that was meant to retire it — the same
  two write contracts, one of them reachable without saying so. `DeepReadonly` is Vue's
  own type and what `readonly()` returns, so both spellings fail to compile and the proxy
  refuses the write at runtime besides.
- `docs/design/12-testing-and-architecture-enforcement-infrastructure.md` — the node
  profile `routeError` is assigned to, which is where its test environment is decided and
  is unaffected by which directory it lives in.
- SDD §85 Accessibility — "semantic labels," "status not encoded only by color,"
  "visible focus," applied to `<FieldError>`.
- PRD §39 (User Experience Requirements: Inspector actions, the `Escape` shortcut) — not
  to be confused with the SDD's own §39 (Sidecar Files).
- PRD §44 (Non-Functional Requirements: Accessibility, Error Handling) — not to be
  confused with the SDD's own §44 (Schema Versioning).
- PRD §90 Validation — schema/reference/business-rule/geometry validation levels, each of
  which can surface at a field via this slice's routing convention.
- PRD §100 Component Tests — "validation feedback" named explicitly as a component-test
  target.
- ADR-004 — Vue 3 for Plugin UI.
- ADR-005 — Pinia for Presentation State — why draft/error state stays component-local.
- `docs/design/02-core-primitives.md` — `BaseError`/`ErrorCategory`/`AppError`, reused
  as-is.
- `docs/design/06-editor-tool-framework-undo-redo-and-inspector.md` — the commit-then-
  dispatch flow and `CommandHistory`/`InspectorStore` contracts this slice attaches to.
- `docs/design/07-calibration.md` — `ReversibleCalibratePlanCommand`'s
  `calibration.coincident-points` as the concrete no-single-field example.
- `docs/design/10-assets-requirements-and-the-end-to-end-loop.md` — `CreateAssetCommand`/
  `AssignAssetCommand` and their per-field validation rules as the concrete single-field
  example.
- `docs/design/11-error-handling-diagnostics-and-data-safety.md` — `ToUserMessage`, reused
  rather than reimplemented.
- `docs/design/README.md` — slice map; slices 13–16 as independent, parallel UI
  vocabulary; slice 17 as the integration point this slice does not preempt.
