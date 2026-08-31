---
type: Task
parent: "[[Shared UI vocabulary]]"
order: 10
dependsOn:
  - "[[05-canvas-rendering-and-editor-shell]]"
  - "[[06-editor-tool-framework-undo-redo-and-inspector]]"
  - "[[11-error-handling-diagnostics-and-data-safety]]"
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
# Design Slice 13: Notifications & Save-State Surfaces

## Purpose

Every view needs two different ways to tell a user "something happened": a transient
message about one event (a zone was created, an import failed) and a persistent
indicator of one ongoing fact (is the current Plan's data safely written?). Nothing
built so far provides either. Slice 5 reserved space for both — its status bar row
carries SDD §60's own three regions (`Status / Measurements / Save State`) and leaves
the third empty, since there are no edits to report before slice 6 — and slice 6 built
the `CommandHistory`/transaction-boundary machinery a save-state indicator would
observe, but neither slice built the indicator itself, and neither built a toast system
at all.

This slice builds both, as shared vocabulary any view or command can use, without
deciding *which* errors should use the toast path versus a modal or an inline field
error — that decision is slice 17's, once slices 13-16 all exist to decide between.

## Scope

### In scope

- `NotificationStore` (Pinia): a queue of transient messages, each with a severity
  (`success | info | warning | error`), a dismiss policy, and dedup behavior for
  repeated identical messages.
- `NotificationHost.vue`: the one component that renders the queue, mounted once per
  plugin instance — not once per view, unlike every store slice 5 introduced.
- `notify` — the public push API (`notify.success(message)`, etc.) any presentation
  code calls, bound once at plugin startup to the single global `NotificationStore`.
- The persistent save-state indicator (PRD §67: `Saved | Saving | Unsaved Changes |
  Save Error`), scoped per open Plan Editor, rendered in the "Save State" third of the
  status bar row SDD §60 names (`Status / Measurements / Save State`).
- `SaveStateStore` (Pinia, per-Plan-Editor instance) and the wiring that drives its
  transitions from `CommandHistory.run()`'s resolved `Result`.
- Explicit reasoning on whether `Unsaved Changes` is a reachable state given slice 6's
  transaction-boundary rule, and what this slice does about it.
- Auto-dismiss timing, stacking/overflow, and accessibility (live-region) rules for
  both surfaces.

### Out of scope (covered by other slices)

- Which `AppError` category becomes a toast, a modal, or an inline field error —
  slice 17 (Presentation-Layer Error Surfacing). This slice only builds the toast
  surface and the API that reaches it; it makes no policy decision about who calls it.
- Empty states — slice 14.
- Modals and confirmation dialogs — slice 15.
- Form and inline validation feedback (a single field's own error message under it) —
  slice 16.
- `CommandHistory`, `UndoableCommand`, and the transaction boundary itself — slice 6.
  This slice only observes the `Result` that boundary already produces; it adds no new
  rule about when a command may run.
- The Error Boundary's mapping pipeline (`Infrastructure Exception → Application Error
  Mapping → Typed Result → Presentation → User Message`) and `toUserMessage` — slice 11.
  This slice's `notify.error(...)` is one place a `User Message` can land; slice 11 does
  not decide that it must.

## Dependencies

- **Slice 5 (Canvas Rendering & Editor Shell)** — the Pinia-store-per-`ItemView`
  pattern `SaveStateStore` follows for its per-Plan-Editor half; the status bar shell
  region (§60) this slice fills the third of; the plain-DOM/CSS theme-integration
  pattern (Obsidian CSS variables) that `NotificationHost` and `SaveStateIndicator.vue`
  use directly, unlike the Konva shapes slice 5 had to resolve at runtime (see Design).
- **Slice 6 (Editor Tool Framework, Undo/Redo & Inspector)** — `CommandHistory`,
  `EditorContext.commandDispatcher`, and the transaction-boundary rule (one gesture →
  one command → one history entry → one persistence operation) this slice's save-state
  transitions are driven by, without modifying it.
- **Slice 2 (Core Primitives)** — `Result<T, AppError>` and its `.ok` discriminant
  (the shared vocabulary in `docs/requirements/Architecture and Software Design.md`: `Result` is data, so this reads
  `if (!result.ok)` or `isErr(result)`, never `result.isErr()`), consumed by
  `withSaveStateTracking` to decide `Saved` vs `Save Error`.
- **Slice 11 (Error Handling, Diagnostics & Data Safety)** — the Error Boundary and
  `ToUserMessage`. Slice 11 deliberately stops at "a `ToUserMessage` string reaches
  Presentation" and leaves the container unnamed; `notify` is the concrete container
  this slice supplies for the toast case, and slice 17 decides when it is the right one.
- **ADR-004 (Vue 3 for Plugin UI)** — "isolated app per `ItemView`" (SDD §12). This
  slice's `NotificationHost` is a deliberate, narrow exception: see Design.
- **ADR-005 (Pinia for Presentation State)** — both stores this slice adds are pure
  ephemeral Pinia state; ADR-005's "cache, not source of truth" applies to both.
- **ADR-007 (Command-Based Mutations)** — "one user intent, one logical transaction" is
  exactly the guarantee `SaveStateStore`'s transitions rely on existing.
- **PRD §67 (Autosave)** — the four state labels this slice implements verbatim, and
  the two stated triggers ("completed commands", "debounced property edits") this
  slice's Design reduces to one mechanism.
- **`src/presentation/i18n/`** — the existing `t(language, key)` lookup and the `en`/`de`
  tables both this slice's surfaces render through. Not a new mechanism: this slice adds
  keys to tables that already exist, per `docs/requirements/Architecture and Software Design.md`'s shared vocabulary.

### Carried forward from the slice 8 review pass (2026-08-25)

The slice 8 review pass changed two things save-state tracking depends on.

- **A redo of a zone creation publishes NO event.** `create -> undo -> redo -> undo` emits
  one `ZoneCreated` and two `ZoneDeleted`, because the redo restores through
  `ZoneRepository.save` rather than re-dispatching the create. Save tracking that counts
  or mirrors the lifecycle drifts permanently and, after a redo, believes a zone that
  exists does not. The review pass left the event contract for slice 10 to settle rather
  than change it silently (`reversible-create-zone-command.ts` states it where the code
  is) — but this slice must not key a "saved" indicator on those events until it is.
- **The stores can be re-read after a command that did NOT succeed.** A thrown technical
  fault says nothing about whether a write landed, so `withEditorStateRefresh` re-hydrates
  the canvas and Inspector on a rejection too. Save state must therefore key on the
  command's own outcome, never on "the stores were refreshed, so it worked".
- **`runtime.ts`'s `reportFault` currently calls `notify()` with a raw `Error.message`.**
  It exists so a fault in a click handler is not a silent unhandled rejection; the text is
  a placeholder, and this slice's toast vocabulary is what belongs there.

  > **ALREADY FIXED, by design slice 11, before this slice started.** `reportFault` calls
  > `notifyFault(cause, logger, event)`, which maps the thrown cause through the vault's
  > `ExceptionMapper` into the same coded `PersistenceError` a guarded service would have
  > produced, logs it with its original cause at that one step, and prints the locale
  > table's sentence. A raw `Error.message` in a notice is now refused by `NOTICE_TEXT_BAN`
  > in `eslint.config.mjs` as well, so this could not come back quietly. Nothing in slice 13
  > was owed here; what slice 13 added is the SEVERITY the resulting notice carries.

## Design

### 1. Notification model

```text
push(severity, message)
  → an identical (severity, message) already queued and not yet dismissed?
      yes → increment its count, restart its auto-dismiss timer, return its id
      no  → append a new entry, return its new id
```

A `Notification` carries enough to render and to time itself out:

```text
id            stable, unique per queue entry
severity      success | info | warning | error
message       plain text — no markup, matching every other user-facing string
              this codebase produces (SDD §66's User Message step). ALREADY
              TRANSLATED by the caller: notify takes a resolved string, not a
              StringKey, because slice 11's ToUserMessage also produces one and
              a queue holding two different kinds of "message" would be worse
              than a caller passing t(...) at the call site.
createdAt     epoch ms; reset on a dedup hit
count         starts at 1; >1 means "this exact message repeated N times"
autoDismissMs number | null — see policy below
```

Dedup exists because a rapid-fire source (e.g. a batch import validating N rows) would
otherwise flood the stack with N copies of the same sentence; a repeat becomes a
"(×N)" suffix on one entry instead of N entries.

### 2. Auto-dismiss policy — an explicit choice, since the SDD/PRD don't specify timing

The SDD names no numbers. This slice picks a simple two-tier rule rather than four
independent timers, because the reasoning is the same for both members of each tier:

```text
success   4000ms   — a glanceable confirmation; nothing to act on
info      6000ms   — same idea, given slightly longer since informational
                      text tends to run longer than a confirmation
warning   persists until dismissed
error     persists until dismissed
```

`warning` is grouped with `error`, not with the auto-dismissing tier, on the reasoning
that a warning by definition flags something the user may need to act on or at least
register — auto-hiding it risks the exact failure mode a warning exists to prevent. The
PRD is silent on warning's timing; treating it like `error` is the more conservative
and easier-to-explain default of the two options, so it is what this slice picks.

A real consequence, stated plainly rather than glossed over: a burst of persistent
(warning/error) notifications can fill every visible slot (below) and block a later
success/info toast from appearing until the user dismisses one. This is accepted, not
hidden — a persistent notification existing to be *not missed* is the same property
that lets it crowd out a transient one.

**Accessibility timing rule**: an auto-dismiss timer pauses while the pointer hovers
the entry or its dismiss button has focus, and resumes (restarting the same duration)
on pointer-leave/blur. The SDD's §85 accessibility line does not spell this out, but a
timed message that can vanish while a user is in the middle of reading or tabbing to it
defeats keyboard accessibility in practice; this rule is this slice's own explicit
answer, not left implicit.

### 3. Stacking, overflow, and dismissal

```text
MAX_VISIBLE_NOTIFICATIONS = 3
```

An explicit, named constant — three is enough to show feedback for a multi-step
operation without the stack covering meaningful canvas area; the SDD gives no number,
so this is this slice's own tunable default, not a value derived from a requirement.

`NotificationHost.vue` renders at most `MAX_VISIBLE_NOTIFICATIONS` entries, oldest
first; anything beyond that waits in `NotificationStore.queue` and is promoted into a
freed slot the instant one dismisses (by timeout or manually). Manual dismissal (a
focusable "×" control on every entry, regardless of severity) always works immediately
and clears any pending timer for that entry — a user is never blocked from dismissing
an entry early just because its severity would otherwise auto-dismiss or persist.

### 4. `NotificationHost` — one per plugin instance, not per view

> **SUPERSEDED, and NOT BUILT.** There is no `NotificationHost`, no `NotificationStore`, no
> plugin-global Pinia instance and no plugin-global Vue app. What shipped is
> `src/presentation/notices/queue.ts` — a plain module-level queue over an injected
> `NoticeHost` port — with `notify.ts` binding that port to Obsidian's own `Notice`. The
> reasoning is in
> [`docs/superpowers/specs/2026-08-28-slice-13-notifications-and-save-state-design.md`](../superpowers/specs/2026-08-28-slice-13-notifications-and-save-state-design.md):
> the parenthesis below dismisses `Notice` on the grounds that "severities, dedup, and manual
> dismiss need a richer contract than `Notice` offers", and that is true of three of those
> four words and false of the one that mattered. `Notice` is a CONTAINER — it owns position,
> stacking, theming and animation, and hands back a `containerEl` and a `messageEl` this
> plugin fills with whatever markup it likes. Severity, dedup and a dismiss control are all
> markup and policy INSIDE that container; the only thing `Notice` genuinely owns that this
> slice needed differently is the timer, and `duration: 0` hands that back.
>
> So the departure from SDD §12 bought nothing and cost a plugin-global Vue app, a second
> Pinia instance, an explicit binding step, and the ambient-active-instance hazard §5 below
> spends four paragraphs on. Everything from "`src/plugin/RenovationPlannerPlugin.ts` today
> has no `onunload`" onward is stale for a second reason as well: the plugin gained one in
> the fix pass after design slice 5's vault walkthrough (`7fe3293`), to release the
> `window.Konva` a reload was leaking, and slice 13's queue is one more entry on its
> `disposers` list rather than the first thing on it.
>
> **The reasoning below is kept rather than deleted because the QUESTION it answers is still
> live** — a toast has to render above every leaf and report things no open view owns, and
> that is exactly why the queue is module-scoped rather than per-view. Only the mechanism
> changed.

Every other Pinia store this codebase has (slice 5's three, slice 6's `SelectionStore`/
`InspectorStore`, and this slice's own `SaveStateStore`) is scoped to one `ItemView`'s
own Vue app and Pinia instance (ADR-004, SDD §12: "each Obsidian view receives an
isolated Vue app"). A toast cannot follow that pattern: it must render above *every*
leaf regardless of which one is focused, and it must be able to report something that
has nothing to do with any currently-open view (a background command, a settings-pane
action). So `NotificationHost` is a deliberate, narrow exception to SDD §12 — the one
Vue app in this plugin that is not `ItemView`-scoped:

```text
RenovationPlannerPlugin.onload()
  ├── settings loaded (existing, unchanged)
  ├── global notification Pinia instance created
  │     └── initNotifications(useNotificationStore(globalPinia)) — binds `notify`
  ├── a DOM node appended once, outside any workspace leaf
  │     (analogous in spirit to Obsidian's own Notice, which also renders above
  │     the workspace rather than inside one leaf's content area — this slice
  │     does not build on top of Notice itself; severities, dedup, and manual
  │     dismiss need a richer contract than Notice offers)
  └── createApp(NotificationHost).use(globalPinia).mount(that node)
      — registration of RENOVATION_PROJECT_VIEW / ribbon / command continues as today

RenovationPlannerPlugin.onunload()
  ├── unmount the notification Vue app
  └── remove its DOM node
```

`src/plugin/RenovationPlannerPlugin.ts` today has no `onunload` at all — its own
comment states why: `registerView`/`addRibbonIcon`/`addCommand` are reversed by the
`Plugin` base class automatically, so nothing yet needs one, and "it arrives with the
first thing that genuinely needs disposing." This slice is that first thing: a
plugin-lifetime Vue app and a DOM node the base class does not know about, so this
slice is what gives the plugin its first real `onunload` body.

### 5. `notify` — the public push API

> **SUPERSEDED in its MECHANISM, upheld in its conclusion.** `initNotifications(store)` does
> not exist and there is no binding step: with `Notice` as the container there is no store to
> bind, so the whole "explicit binding versus ambient Pinia resolution" question below has no
> subject. `activateNotices()` and `disposeNotices()` exist instead, and they are a LIFECYCLE
> rather than a binding — the queue is inert before `onload` calls the first and inert again
> after `onunload` drains the second. Disposal is terminal on purpose: a fire-and-forget
> promise resolving after unload (the cascade and the recovery pass both run that way) must
> drop its push rather than attach a notice to a vault with no plugin left to remove it.
> With no binding step there is nothing for a premature call to precede, so the "throws
> rather than silently no-op-ing" clause below is withdrawn — see the amended
> Definition-of-Done item 6.
>
> The four doors are `notify` (info), `notifySuccess`, `notifyWarning` and `notifyError`,
> plus `notifyFault` for a thrown cause — **bare functions, not `notify.success(...)`**, and
> that is a gate rather than a taste: `NOTICE_DOOR` in `eslint.config.mjs` matches on
> `callee.name`, which a member expression does not have, so every `notify.success('…')`
> call site would have been invisible to the one rule keeping raw `Error.message` and bare
> literals out of a notice.
>
> **The module-global paragraph below survives unchanged and is the part worth keeping.** The
> trade it names is exactly the trade that was taken, and its stated trigger for revisiting —
> a second push surface arriving — is still the trigger.

Bound once, explicitly, at plugin startup — not resolved through Vue/Pinia's ambient
"active instance" mechanism, because this plugin runs a global Pinia instance
alongside a fresh per-`ItemView` Pinia instance every time a Plan Editor opens (slice
5), and installing each of those onto its own Vue app risks reassigning whichever
Pinia instance Vue considers globally "active" out from under the notification store.
Binding explicitly at startup sidesteps that ambiguity entirely — the same reasoning
slice 1's composition root already applies to every other constructor-injected
dependency, just applied to a presentation-layer singleton instead of an application
port.

```text
initNotifications(store)   — called once, in onload(), before any view or command
                              can possibly call notify.*
notify.success(message)    — auto-dismiss per §2
notify.info(message)
notify.warning(message)
notify.error(message)
```

Each returns `void`, not the entry id `NotificationStore.push` produces. A caller that
could hold an id would be a caller that could dismiss someone else's toast, and nothing
in slices 14–17 needs one: every consumer pushes and forgets. The id stays internal to
the store, where the host component and the dedup check use it.

Calling `notify.*` before `initNotifications` runs is a programming error (the
composition root sequencing is wrong), not a recoverable runtime condition — it throws
loudly rather than silently dropping the message, matching this codebase's general
preference for a loud failure at the point a real bug exists over a caller-visible
silent no-op.

**`notify` is an importable module-global, and the Pinia argument above does not defend
that** — it defends *explicit binding* over ambient resolution, which is a different
question and the one that was actually being asked. What an importable global means is
that any file in `presentation/` reaches a toast by adding one import, with nothing in the
type of a component or a decorator recording that it does. So the alternative deserves
naming: **constructor injection**, `notify` handed to whatever needs it the way slice 1
hands the `Logger` port to everything that logs.

Kept as a module-global, for two reasons that hold specifically for this dependency and
are not a general licence:

- **A toast has no second implementation and never will.** The `Logger` port is injected
  because its implementation is chosen at the composition root — console today, file-backed
  if slice 11 adds one — and because `domain/` must be able to *not* have one. `notify`
  is one function over one store, in one layer, in a plugin with one notification surface.
  Injecting it would thread a parameter through every intermediate component that does not
  use it, to reach a leaf, to select between one option.
- **The seam that matters for testing is the store, not the import.** A test drives
  `initNotifications(fakeStore)` and asserts on the fake — which is the same substitution
  injection would buy, one level down, without the plumbing.

What is given up, and therefore what to watch: an import is invisible in a signature, so
"which components can raise a toast" is answerable only by grep. That is the cost, and the
trigger for revisiting is a second push surface (a status-bar message, a modal queue)
arriving — at which point the choice is no longer between one option and the plumbing is
buying something.

### 6. Save-state model, and where it lives

Unlike `NotificationStore`, `SaveStateStore` is scoped **per open Plan Editor** — one
instance per `ItemView`, living in that view's own Pinia instance next to
`ProjectStore`/`EditorStore`/`WorkspaceStore` (slice 5) and rendered in that same
view's own status bar row. This follows directly from slice 6: `CommandHistory` is
itself scoped per open Plan ("`CommandHistory` is scoped per open Plan and lives in
`EditorStore`"), so the save state it produces is a fact about *that Plan's* command
history, not a plugin-global fact — two Plan Editor tabs open at once (slice 5's own
example: Ground Floor and First Floor) can legitimately show different save states at
the same time, one `Saving` while the other is `Saved`.

```text
SaveState = 'saved' | 'saving' | 'unsaved-changes' | 'save-error'
```

PRD §67 states these four labels verbatim in Title Case ("Saved" / "Saving" /
"Unsaved Changes" / "Save Error"). Two things sit between that wording and what renders.

First, this project's sentence-case UI-text rule (CLAUDE.md — a marketplace guideline;
sentence case is *linted* inside `en.ts`, the file the `obsidianmd` locale rules match,
and merely reviewed anywhere else). Second, and more importantly: **rendered copy is not
a literal here at all.** `src/presentation/i18n/` already holds the one lookup every
user-facing string in this plugin goes through, with a German table alongside English,
so a hardcoded label map would be a second string table — untranslated, and outside the
file the locale lint can see.

So `SaveState`'s literal values stay traceable to the PRD's exact wording, and the map
beside them resolves each to a `StringKey` this slice adds to `en.ts` (and `de.ts`):

```text
saved             → 'save-state.saved'            → en: "Saved"
saving            → 'save-state.saving'           → en: "Saving"
unsaved-changes   → 'save-state.unsaved-changes'  → en: "Unsaved changes"
save-error        → 'save-state.save-error'       → en: "Save error"
```

### 7. Save-state triggers

PRD §67 names two autosave triggers: "completed commands" and "debounced property
edits." Slice 6 already collapses these into one mechanism: an Inspector field edit
becomes a command "on blur/enter/change-complete, not per keystroke" — i.e. slice 6's
own debounce *is* the "debounced property edit," and by the time it fires it is
already "a completed command." There is no second, independent autosave trigger for
this slice to design; both PRD triggers arrive at `CommandHistory.run()`.

`SaveStateStore`'s transitions are driven by decorating the dispatcher slice 6 already
defines, not by changing `CommandHistory` itself:

```text
withSaveStateTracking(history, saveStateStore).<op>(...)   for op in run | undo | redo
  → saveStateStore.beginSaving()      pendingCount++; state := 'saving'
  → result = await history.<op>(...)
  → result.ok  → saveStateStore.resolveOk()    pendingCount--
  → !result.ok → affectsSaveState(result.error)
                   ? saveStateStore.resolveErr()  pendingCount--; hasErrorInBatch := true
                   : saveStateStore.resolveOk()   pendingCount--
  → return result unchanged to the caller
```

> **CORRECTED in one line: the non-affecting arm is `resolveNeutral()`, not `resolveOk()`.**
> The store settles a batch three ways, not two — failed, wrote-something, and wrote-nothing
> — and the third is the one the pseudocode above collapses. It is a lie with a real victim:
> after a persistence failure has settled the store to `save-error`, a later field edit
> refused for validation writes nothing, and reporting `saved` for it tells the user the
> earlier failed write is now safe. Only a write that actually succeeded may clear a save
> error, so `resolveNeutral` reverts to whatever the indicator read before the batch opened.
> A fourth path the diagram has no arm for at all: a THROWN technical fault settles the batch
> as an error and re-throws unchanged — decrementing only on resolution would leave
> `pendingCount` permanently above zero and the indicator dead on `saving` forever.

**Not every failed `Result` is a save error, and the decorator filters rather than
flipping on anything.** A field commit that fails a domain rule resolves a
`ValidationError` and **writes nothing** — the repository was never reached. Flipping the
indicator to `Save Error` for it would be wrong twice: it reports a persistence failure
that did not happen, and slice 17 routes a `ValidationError` to an inline field error
*only*, forbidding a second surface for the same fact. The user would get the inline
message they need plus a `Save Error` badge about data that is exactly as safe as it was
before they typed.

So the filter is a predicate over the error's own category:

```typescript
// presentation/stores/saveState/affectsSaveState.ts
// True only for a failure that means "this Plan's data may not be written". A category
// that never reaches a write cannot.
const affectsSaveState = (error: AppError): boolean => error.category !== 'validation';
```

**Which slice owns that predicate is the part worth pinning**, because it is exactly the
kind of rule that ends up stated twice. **Slice 17 owns the mapping from an error to a
surface**; this slice owns the *indicator*, and the indicator is one of slice 17's
surfaces. So the predicate lives here, in `presentation/stores/saveState/`, and it is
**derived from slice 17's table rather than authored beside it**: a category whose row
routes to `save-state` for any origin returns true, and one that never does returns false.
Slice 17's own no-double-reporting test is the check that keeps the two in agreement, and
its scope widens to cover this case — the autosave `PersistenceError` (already covered)
plus the `ValidationError`, which must produce an inline error and **no** indicator
transition.

> **CORRECTED.** Neither of those last two sentences is true of what shipped, and neither
> could be: slice 17 has no table to derive from and no such test — `grep -rn
> "no-double-reporting" src tests` finds one line, and it is a comment. The predicate derives
> from `WRITE_BOUNDARY_CODES` in `src/application/ports/versioning.ts` instead, and the
> `!== 'Validation'` inequality below is not sufficient on its own: two write-boundary
> refusals are `Validation` by CATEGORY and have to be carved back out. See "One claim in
> Design §7 that shipped narrower than it reads", below the Definition of Done.

Stated as an inequality against one category rather than a list of the ones that do count,
deliberately: a new `AppError` category added by a later slice should default to
*affecting* the indicator, because "we might not have written your data" is the safe
answer to give while nobody has thought about it. The unsafe default is silence.

**All three of `CommandHistory`'s operations are decorated, not just `run`.** `undo()`
and `redo()` each execute a command, which means each performs a repository write
(slice 6: `undo()` replays an inverse through the same wrapped command; slice 8's
`ReversibleDeleteZoneCommand.undo()` writes a snapshot back through the repository). A
decorator that covered only `run` would leave the indicator reading `Saved` throughout an
in-flight undo, and — worse — leave it reading `Saved` after an undo that failed with a
`PersistenceError`. The rule the indicator exists to express is "is this Plan's data
safely written", and an undo is a write like any other.

Slice 8 adds a second decorator over the same three operations —
`withEditorStateRefresh`, which re-queries the editor's working state after a command
lands — and nests it *inside* this one, so `Saved` never appears while the canvas still
shows the pre-command state. That decorator returns its wrapped `Result` untouched, so it
changes when this one resolves, never what it reports.

This wraps the same `CommandHistory` instance slice 6 hands to `EditorContext` and to
`InspectorStore`'s commit path — tools, Inspector edits, and the undo/redo keybindings
all funnel through one instance per Plan Editor (slice 6's own "one choke point" rule),
so wrapping it once at the composition root covers every command source without
`ToolManager`, `InspectorStore`, or the keybinding handler needing to know a save-state
store exists.

**Overlapping dispatches are a real case, not a simplification this slice can skip.**
Slice 6's "one choke point" rule serializes commands *per gesture* (one `pointerUp`,
one command), not globally — an Inspector field commit and a canvas gesture can each
independently call `dispatcher.run()` around the same time, so two or more commands
can be in flight against the same Plan Editor simultaneously.

What follows solves the *indicator*, not the data. Two overlapping commands writing the
same plan's geometry sidecar is a lost-update hazard, and a counter in a Pinia store
cannot prevent one — that is prevented in slice 4, which serializes each plan's
read-modify-write inside `PlanGeometryStore.mutate`. This slice assumes that guarantee
rather than restating it, and would be wrong without it: an indicator that reported
`Saved` accurately over silently-lost data would be worse than one that misreported. Naively setting `state`
directly inside `resolveOk`/`resolveErr` breaks the moment that happens: the faster of
two in-flight writes resolving `ok` would flip the indicator to `Saved` while the
slower one is still pending, misreporting data as safely written before it is.
`SaveStateStore` therefore tracks a `pendingCount` (how many dispatches are currently
in flight) and a `hasErrorInBatch` flag, internal to the store, alongside the publicly
visible `state`:

```text
beginSaving()  → pendingCount += 1
                 state := 'saving'                          (a new dispatch always
                                                               shows 'saving' — including
                                                               to supersede a stale
                                                               'save-error' from a prior
                                                               batch that already drained)
resolveOk()    → pendingCount -= 1
                 if pendingCount === 0:
                   state := hasErrorInBatch ? 'save-error' : 'saved'
                   hasErrorInBatch := false                  (batch settled; reset)
                 // else: at least one sibling dispatch is still in flight —
                 //       state stays 'saving', not yet settled either way
resolveErr()   → pendingCount -= 1
                 hasErrorInBatch := true
                 if pendingCount === 0:
                   state := 'save-error'
                   hasErrorInBatch := false
                 // else: state stays 'saving' until the last sibling settles
```

The visible `state` only ever transitions to `'saved'` or `'save-error'` when
`pendingCount` reaches zero — i.e. once every command dispatched since the last time
it was zero has resolved — and a single failure anywhere in that batch makes the
whole batch report `'save-error'`, even if every other concurrent write in it
succeeded. A batch is never reported `'saved'` while any part of it is still
unresolved or failed.

`commandDispatcher.run` resolves `Promise<Result<void, AppError>>` (slice 6's
`CommandHistory.run`, `AppError` from slice 2) — a save-state indicator could not
exist at all against a bare `Promise<void>` signature, since there would be nothing
for `resolveOk`/`resolveErr` to branch on.

`SaveStateStore` initializes to `'saved'` whenever a Plan Editor mounts, for the same
reason `ProjectStore` rebuilds clean on every open (slice 5): a fresh hydration from
already-persisted data has nothing unsaved by construction. If a command's promise is
still in flight when the view closes, the write itself is unaffected (a repository
write is not tied to a Vue component's lifetime) — only the now-destroyed Pinia
instance stops listening for the result, which is correct: there is no indicator left
to update.

### 8. Is `Unsaved Changes` reachable?

Reasoned through explicitly, because it would be easy to implement four symmetrical
states without noticing that one of them has no trigger.

The candidate trigger would be "the user changed something, but no command has run
yet." Slice 6's transaction boundary forecloses this for every source of change this
architecture has:

- **Canvas gestures**: `pointerMove*` "update renderState only... never dispatch";
  `pointerUp` "build ONE `UndoableCommand`... `CommandHistory.run(command)`" — the
  instant a gesture completes, a command is already dispatched (`Saving`), not merely
  "decided but not yet sent."
- **Inspector edits**: keystrokes never dispatch; blur/enter dispatches immediately.
  Same shape.

In both cases, nothing in this architecture ever reaches a state of "a domain-level
edit has been decided and exists, but no command has been dispatched for it yet" —
the moment an edit is decided, it *is* the command dispatch, per slice 6's own stated
rule ("a completed user gesture always produces exactly one command execution"). There
is no intermediate step between "nothing has been decided" (still `Saved`, correctly —
a preview shape mid-drag or a keystroke mid-typing has changed no persisted domain
state at all) and "a command is in flight" (`Saving`).

**Conclusion: `Unsaved Changes` is unreachable through the command pipeline as slices 3-10
define it, and this slice does not invent a mechanism to make it reachable.** It stays
in the `SaveState` type — for PRD-vocabulary fidelity, and so `SaveStateIndicator.vue`
renders it correctly if a future slice ever does introduce a genuine "decided-but-not-
yet-dispatched" edit buffer — but `SaveStateStore`'s own action surface
(`beginSaving`/`resolveOk`/`resolveErr`) contains no action that produces it, and no
caller anywhere in this slice sets it. This is checked directly (see Testing Strategy),
not left as a claim in this paragraph alone.

### 9. Theme and accessibility

Both components are plain DOM + CSS, not Konva — unlike slice 5's `ZoneShape`, which
needed a runtime `getComputedStyle` bridge because Konva cannot read a CSS variable
directly, `NotificationHost` and `SaveStateIndicator.vue` write `var(--text-error)`,
`var(--text-warning)`, `var(--text-success)`, `var(--background-modifier-error)` etc.
straight into their stylesheets, same as the existing `.renovation-planner-view`
pattern — no color is ever hardcoded (SDD §84), and no resolver step is needed here
the way it was for a canvas.

Per SDD §85:

- Every notification entry has a focusable, keyboard-operable dismiss control; the
  stack itself is reachable by keyboard, not mouse-only.
- `success`/`info` entries render with `role="status"`/`aria-live="polite"`;
  `warning`/`error` entries render with `role="alert"`/`aria-live="assertive"`, so a
  screen reader announces a warning/error promptly without demanding it for a routine
  confirmation.
- Severity is never color-only: each entry carries a distinct icon and a translated
  severity label alongside its color, matching the "status not color-only" rule slice 5
  already applies to `ZoneRenderModel.status`.
- `SaveStateIndicator.vue` renders as text, not an icon alone, for the same reason.

## Interfaces & Contracts

```typescript
// presentation/notifications/types.ts
export type NotificationSeverity = 'success' | 'info' | 'warning' | 'error';

export interface Notification {
  readonly id: string;
  readonly severity: NotificationSeverity;
  readonly message: string;
  readonly createdAt: number;             // epoch ms; reset on a dedup hit
  readonly count: number;                 // >1 when an identical message repeats
  readonly autoDismissMs: number | null;  // null => persists until dismissed
}
```

```typescript
// presentation/notifications/notification-store.ts
export interface NotificationStoreState {
  readonly queue: readonly Notification[]; // insertion order
}

export const useNotificationStore: () => {
  readonly queue: readonly Notification[];
  push(severity: NotificationSeverity, message: string): string; // returns entry id
  dismiss(id: string): void;
  clear(): void; // used only by onunload / tests
};
```

```typescript
// presentation/notifications/notify.ts
export interface NotifyApi {
  success(message: string): void;
  info(message: string): void;
  warning(message: string): void;
  error(message: string): void;
}

// Called exactly once, by the composition root, before any view or command
// can run. A second call is a programming error (composition root wiring),
// not a supported re-bind.
export function initNotifications(store: ReturnType<typeof useNotificationStore>): void;

// The integration surface slice 17 routes decided error categories through,
// and that any other presentation code may call directly for a non-error
// confirmation (e.g. "Zone created").
export const notify: NotifyApi;
```

```typescript
// presentation/notifications/NotificationHost.vue — no props; the one
// instance reads directly from the global useNotificationStore(), since it
// is the only component mounted into the one plugin-global Vue app.
// Rendering contract (not prop-driven, stated here for reviewers):
//   - at most MAX_VISIBLE_NOTIFICATIONS entries rendered, oldest first
//   - each entry: message text (+ "(×N)" if count > 1), severity icon+color
//     from theme tokens, a focusable dismiss control
//   - role="status"/aria-live="polite" for success|info;
//     role="alert"/aria-live="assertive" for warning|error
export const MAX_VISIBLE_NOTIFICATIONS = 3;
```

```typescript
// presentation/editor/save-state/save-state.ts
export type SaveState = 'saved' | 'saving' | 'unsaved-changes' | 'save-error';

// Maps a state to its i18n key — NOT to a literal. The copy itself lives in
// presentation/i18n/locales/en.ts (and de.ts), like every other user-facing
// string in this plugin; this map holds no English at all.
export const SAVE_STATE_KEYS: Readonly<Record<SaveState, StringKey>> = {
  saved: 'save-state.saved',
  saving: 'save-state.saving',
  'unsaved-changes': 'save-state.unsaved-changes',
  'save-error': 'save-state.save-error',
};
```

```typescript
// presentation/editor/save-state/save-state-store.ts — one per Plan Editor
// ItemView's own Pinia instance (see Design §6), NOT the global Pinia
// instance NotificationStore lives in. pendingCount/hasErrorInBatch are
// internal bookkeeping for overlapping dispatches (see Design §7); only
// `state` is part of this store's public surface.
export interface SaveStateStoreState {
  readonly state: SaveState;
  readonly pendingCount: number;      // internal; not rendered directly
  readonly hasErrorInBatch: boolean;  // internal; not rendered directly
}

export const useSaveStateStore: () => {
  readonly state: SaveState;
  beginSaving(): void;  // pendingCount += 1; state := 'saving'
  resolveOk(): void;    // pendingCount -= 1; settles to 'saved'/'save-error' at 0
  resolveErr(): void;   // pendingCount -= 1; hasErrorInBatch := true; settles at 0
  // deliberately no action sets 'unsaved-changes' — see Design §8
};
```

```typescript
// presentation/editor/save-state/with-save-state-tracking.ts
// Decorates all three of slice 6's CommandHistory operations that perform a write.
// Transparent: every wrapped method's return value is unchanged from the caller's
// point of view. canUndo/canRedo/clear are passed through untouched — they write
// nothing, so they have no save state to report.
type TrackedHistory = Pick<CommandHistory, 'run' | 'undo' | 'redo'>;

export function withSaveStateTracking(
  history: TrackedHistory,
  saveState: Pick<ReturnType<typeof useSaveStateStore>, 'beginSaving' | 'resolveOk' | 'resolveErr'>,
): TrackedHistory;
```

```typescript
// presentation/editor/save-state/SaveStateIndicator.vue — no props; reads
// this Plan Editor's own useSaveStateStore() (its own Pinia instance) and
// renders t(getLanguage(), SAVE_STATE_KEYS[state]) as text, into the third
// region of SDD §60's status bar row ("Status / Measurements / Save State").
```

File layout (per SDD §77):

```text
presentation/notifications/
├── types.ts
├── notification-store.ts
├── notify.ts
└── NotificationHost.vue

presentation/editor/save-state/    (new subfolder alongside slice 6's tools/,
│                                    snapping/, selection/, inspector/)
├── save-state.ts
├── save-state-store.ts
├── with-save-state-tracking.ts
└── SaveStateIndicator.vue
```

## Persistence Impact

Nothing in this slice is written to the Vault, per SDD §15's persistent/ephemeral
split slice 5 already established for that layer's own stores:

- `NotificationStore`'s queue is transient by definition — a toast describes an event
  that already happened; there is nothing to reload it *as*, and losing it on plugin
  reload or crash loses no information a user needs recovered (unlike, say, an
  undelivered `warn`/`error` log line, which slice 11's local log sink already covers
  separately if durability of the underlying event matters).
- `SaveStateStore`'s current value is a live read of "is the last dispatched command
  for this Plan resolved, and how" — it is derived, not canonical, exactly like slice
  6's `CommandHistory` stacks it is downstream of. Reopening a Plan Editor after a
  crash mid-`Saving` shows `Saved` (a fresh hydration, per §6 above), which is correct:
  whatever the repository write actually completed or did not complete is the truth
  slice 4's persisted data already reflects; this indicator never needs to reconstruct
  a stale in-flight state across a reload.
- Neither store is part of any project export (SDD §68's Diagnostics rule already
  excludes UI-only state of this kind; nothing here is project content in the first
  place).
- The `Unsaved Changes` state, being unreachable (Design §8), is never in the "would
  need to survive a crash" category the PRD's Autosave language might otherwise imply.

## Testing Strategy

- **`NotificationStore` unit tests**: `push` assigns a fresh id; a second `push` with
  the same `(severity, message)` while the first is still queued increments `count`
  and restarts its `createdAt` rather than adding a second entry; `success`/`info`
  entries carry the 4000ms/6000ms `autoDismissMs` values from §2, `warning`/`error`
  carry `null`; `dismiss` removes an entry by id regardless of severity.
- **`NotificationHost` component tests (jsdom)**: given a queue of more than
  `MAX_VISIBLE_NOTIFICATIONS` entries, only the oldest `MAX_VISIBLE_NOTIFICATIONS`
  render; dismissing a visible entry promotes the next queued one; `vi.useFakeTimers()`
  drives an auto-dismiss entry to removal at exactly its `autoDismissMs`, and asserts a
  simulated pointer-hover/focus on that entry prevents removal at that same deadline,
  then removal at a full duration after hover/focus ends (§2's timing-adjustable rule).
- **Accessibility test**: a `success`/`info` entry renders `role="status"`/
  `aria-live="polite"`; a `warning`/`error` entry renders `role="alert"`/
  `aria-live="assertive"` — asserted directly against rendered attributes, not implied.
- **`notify` API test**: calling `initNotifications(fakeStore)` then `notify.error('x')`
  results in exactly one `fakeStore.push('error', 'x')` call; calling any `notify.*`
  method before `initNotifications` throws.
- **`SaveStateStore` unit tests**: initial state is `'saved'`; `beginSaving()` →
  `'saving'`; `resolveOk()` → `'saved'`; `resolveErr()` → `'save-error'`; a subsequent
  `beginSaving()` after `'save-error'` moves on to `'saving'` again (a stale error does
  not get stuck).
- **Overlapping-dispatch test** (the concurrency case Design §7 exists for): call
  `beginSaving()` twice (two dispatches in flight) before either resolves; assert
  `state` is still `'saving'` after the first `resolveOk()` (one sibling remains
  pending); assert it becomes `'saved'` only after the second also `resolveOk()`s.
  Repeat with the first resolving `resolveErr()` and the second `resolveOk()`;
  assert the batch settles to `'save-error'`, not `'saved'` — one failure in a
  batch of concurrent dispatches must not be masked by a sibling's success.
- **Unreachability test for `Unsaved Changes`** (backs Design §8's claim directly,
  rather than leaving it as an assertion in prose): drive `SaveStateStore` through
  every reachable sequence of its three actions from its initial state and assert
  `'unsaved-changes'` never appears as a resulting value; a companion architecture-style
  test enumerates the store's exported action names and asserts none of them is named
  or documented as producing it.
- **`withSaveStateTracking` test**: table-driven over all three wrapped operations
  (`run`, `undo`, `redo`), each against a fake resolving an `ok` Result and then a failed
  one. For each: `beginSaving` is called before the operation resolves,
  `resolveOk`/`resolveErr` after, and the wrapper's return value is identical to what the
  fake resolved (a transparent decorator, not a new contract). Running the table over all
  three is the point — a decorator covering only `run` passes a `run`-only test while
  leaving a failed undo reported as `Saved`.
- **`SaveStateIndicator.vue` render test**: given each of the four `SaveState` values
  directly (including `'unsaved-changes'`, to prove the renderer is defensively correct
  even though no producer test exercises it — see above), asserts the string `t` returns
  for the corresponding `SAVE_STATE_KEYS` entry renders. A companion test asserts every
  key in `SAVE_STATE_KEYS` resolves in `en.ts` — a key with no English entry does not
  compile, but a *stale* key that still compiles would silently render its own name.
- **Two-Plan-Editors-open test**: two `SaveStateStore` instances (one per view's own
  Pinia, per slice 5's mount pattern) transition independently — driving one to
  `'saving'` leaves the other's state untouched.

## Definition of Done

1. `NotificationStore.push` deduplicates an identical, still-queued
   `(severity, message)` pair into one entry with an incrementing `count`, instead of
   appending a duplicate.
2. `success`/`info` notifications auto-dismiss after 4000ms/6000ms respectively;
   `warning`/`error` notifications persist until manually dismissed; an auto-dismiss
   timer pauses on hover/focus and resumes on pointer-leave/blur.
3. `NotificationHost` renders at most `MAX_VISIBLE_NOTIFICATIONS` (3) entries at once;
   an entry beyond that limit is promoted into a freed slot, not dropped.

   > Items 1–3 are met, under different NAMES: there is no `NotificationStore` and no
   > `NotificationHost`, so the subject of all three is the queue `createNoticeQueue`
   > returns, and the constant is `MAX_VISIBLE_NOTICES`. One clause of item 2 shipped
   > STRICTER than it reads: the timer resumes when hover and focus are BOTH clear, not on
   > either event alone — resuming on `pointerleave` while the dismiss control still held
   > focus was one of this slice's review findings. Only the three items below needed their
   > substance amended.
4. **AMENDED** (was: "`NotificationHost` is mounted exactly once for the lifetime of the
   plugin, into a DOM node outside any workspace leaf" — there is no host component and no
   plugin-global Vue app; see the note at Design §4). The notice queue is ONE module-level
   queue, and opening and closing multiple Plan Editor leaves neither creates a second one
   nor loses a queued entry.
5. **AMENDED** (was: "`RenovationPlannerPlugin` gains an `onunload()` … the plugin's first").
   The queue registers **one disposer** on the plugin's existing `disposers` list.
   `onunload` is neither created nor modified by this slice, and the queue is not the first
   thing on that list — `claimKonvaGlobal` got there first, in the fix pass after design
   slice 5's vault walkthrough (`7fe3293`), which is what gave the plugin its `onunload` in
   the first place.
6. **AMENDED** (was: "`notify.success/info/warning/error` … calling any of them before
   `initNotifications` throws"). `notify` / `notifySuccess` / `notifyWarning` each push
   exactly one entry of the matching severity, and `notifyError` / `notifyFault` push at
   `error`. The "throws before `initNotifications`" clause is DROPPED: there is no binding
   step to precede. A push while the queue is inert — before `activateNotices()` or after
   `disposeNotices()` — is dropped, because a toast reports something that already happened
   and there is no surface left to report it to.
7. `SaveStateStore` is scoped one-per-Plan-Editor (its own Pinia instance, per slice 5's
   pattern), transitions `saved → saving → saved` on a successful command and
   `saved → saving → save-error` on a failed one, driven through
   `withSaveStateTracking` wrapping slice 6's `CommandHistory` — with no change to
   `CommandHistory` itself. `run`, `undo` and `redo` are all wrapped: an in-flight or
   failed undo reports exactly as a failed dispatch does, since both are writes.
8. Two overlapping dispatches against the same Plan Editor never show `'saved'`
   while either is still unresolved, and a batch containing at least one failure
   settles to `'save-error'` even if a sibling in that same batch succeeded —
   proven by the overlapping-dispatch test (Testing Strategy), not just by the
   single-dispatch case in item 7.
9. `SaveStateIndicator.vue` renders all four `SaveState` values through `t()`, into the
   "Save State" third of SDD §60's status bar row. No user-facing literal appears in
   `presentation/notifications/` or `presentation/editor/save-state/`; the copy for both
   surfaces lives in `presentation/i18n/locales/`, German included.
10. `'unsaved-changes'` is proven unreachable through `SaveStateStore`'s own action
   surface by an exhaustive-transition test (Testing Strategy), and Design §8's
   reasoning for why is recorded here rather than left as a silently-included fourth
   state with no path to it.
11. Neither `NotificationStore`'s queue nor `SaveStateStore`'s current value is written
    to the Vault, read back after a reload, or included in any project export —
    verified by inspection of both stores' action sets (no repository/Vault import
    reachable from either, matching the layer-dependency lint rule already enforced by
    `npm run lint`).
12. `npm run check` (build, lint, coverage-thresholded tests, fallow) passes with this
    slice's code included.
13. **NEW.** `NOTICE_DOOR` in `eslint.config.mjs` names every notice door this slice adds —
    `notify`, `notifySuccess` and `notifyWarning` beside `new Notice(...)` — driven through
    real fixture paths in `tests/build/notice-text-boundary.test.ts`, including the blind
    spots the selector structurally cannot see. A severity door added without widening that
    rule is a door no gate can see: `NOTICE_TEXT_BAN` is the only thing keeping a raw
    `Error.message` or a bare English literal out of a notice, and it matches on
    `callee.name`.

## What this slice did NOT satisfy, and knew it

`docs/components/Toast.md` and `docs/components/Save-state indicator.md` are component
contracts naming this slice in their own frontmatter, and **this document was written without
opening either** — found by review on 2026-08-28, eleven rounds in, after the design and the
plan were both written. Four of their requirements were knowingly unmet; items 1, 2 and 4 have
since been closed and only item 3 remains. They are recorded
here, and in [[Notices and save state]]'s own contract-gaps section, because the
workspace holding this reasoning is deleted when the slice closes and a gap nobody inherits
is a gap rediscovered from scratch.

1. **~~No mark beside the word.~~ Closed on BOTH surfaces now, by exactly the fix predicted
   here.** The save-state indicator went first, in the review pass on this branch; the Toast
   followed, and the paragraph after this one is what that took. Both
   contracts ask for a mark AND a word ("Both, always, never one"). The slice shipped the
   translated word plus colour, which satisfies SDD §85's "status not colour-only" and does
   not satisfy the contracts; a review bot found it on the indicator. The mark is CSS in
   `styles/editor-status.css` — a settled disc for *Saved*, a ring for *Unsaved Changes*, an
   arc for *Saving*, crossed bars for *Save Error* — drawn in `currentColor` so each takes its
   own state's colour rule and no colour literal appears. `setIcon` is still not called, which
   is what the prediction above was for. The element is `aria-hidden` and carries no text, so
   the word remains the whole accessible name and the existing exact-`.text()` assertions
   still hold.

   Two things it needed that the prediction did not name. **A specimen**, because
   `SaveStateIndicator` reads its store and a standalone harness mount rests at `saved`, so a
   capture of the real component shows one of the four marks: `src/prototypes/SaveStateMarks.vue`
   draws all four, and is the only place *Unsaved Changes* is ever rendered at all. And a
   **selector test** — `saveStateIndicator.test.ts` builds `.rp-save-state-${state}` from the
   same expression the template interpolates and asserts the stylesheet declares it, which is
   the one hole `editor-status.css`'s own header says nothing here can catch, and which had
   already cost this file one defect (`-error` against a template emitting `-save-error`).

   **The Toast half, taken later, and what it added to the account above.** `.rp-notice-mark`
   in `styles/notices.css` — a disc for `info`, a tick for `success`, a triangle for
   `warning`, a cross for `error` — each cut from one filled box with `clip-path` rather than
   drawn from borders, which is the only real difference between the two surfaces' rules. The
   element is built in `notify.ts` beside the severity label, `aria-hidden` and carrying no
   text, so the word stays the whole accessible name and **not one existing assertion in
   `notify.test.ts` had to move**. Three things it needed that the save-state half did not:

   - **A place to put the mark that one `color` declaration per severity can reach.** It is a
     CHILD of `.rp-notice-severity`, inheriting through `currentColor`, rather than a fourth
     flex item on `.rp-notice-body` — a sibling would have needed its own list of four
     severity selectors beside the existing four, and two lists of the same four drift.
   - **The trap that nesting introduces, pinned as behaviour.** `render` may no longer write
     the word with `label.textContent`, which would take the mark with it. The obvious
     spelling is the wrong one, so `notify.test.ts` has a case for it — and the measurement
     corrected the prediction: `render(view)` runs before the append, so the mutation reddens
     all four mark cases rather than the repeat's alone.
   - **No specimen, and that is a gap rather than a decision.** The save-state half got
     `src/prototypes/SaveStateMarks.vue` because a standalone mount rests at one state. A
     notice cannot be drawn in the browser harness AT ALL — `tests/harness/obsidian.css`
     declares no `.notice` and no `.notice-container` rule, so there is no chrome, no position
     and no stacking to draw one into — so there is nothing to capture and nothing to read by
     eye. Whether the four silhouettes are told apart at `0.7em` of `--font-smallest` is
     settled by step 12a of the manual case and by nothing else. The polygons themselves were
     verified by RASTERIZING them rather than by reading them, which is the cheapest thing
     available short of a vault: a `clip-path` one transposition from a tick draws a shape
     nothing in `npm run check` can see.
2. **~~No moving indicator for *Saving*.~~ Closed with item 1.** `Save-state indicator.md`
   cites the Design System's *Loading* row: a moving indicator **and** text. The arc rotates,
   and because it is this stylesheet's first animation it is also the first thing in it that
   owes a `prefers-reduced-motion` answer — the rotation stops and the GAP stays, since the
   gap is what distinguishes it from the ring. The residual that leaves, read off a capture
   rather than argued: held still, arc and ring differ by one gap at this size. It costs
   nothing while *Unsaved Changes* is unreachable, and is written down where the CSS is for
   the slice that makes it reachable.
3. **No retry emit on *Save error*.** The contract says the component "Emits, in the Save
   Error case only, a retry request." **Undesigned rather than merely unbuilt**, which is the
   distinction worth keeping: `SaveStateStore` retains no re-runnable operation — the tracker
   sees a dispatch OUTCOME, not a command — and re-running a failed `undo` is not idempotent,
   so a naive retry could corrupt the history stack.
4. **~~The Toast live-region insertion order.~~ Closed by the review pass on this branch, and
   not by the fix predicted here.** The prediction was to reorder when the attributes go onto
   the notice — construct, clear `messageEl`, set them while empty, populate on a microtask —
   and that would have bought a timing change for a shape still centred on a container that
   appears. What shipped instead takes the region off the notice altogether:
   `activateNotices()` appends two empty live regions to `document.body`
   (`role="status"`/`aria-live="polite"` and `role="alert"`/`aria-live="assertive"`),
   `disposeNotices()` removes them, and a notice announces by writing into the one its
   severity names while carrying neither attribute itself. That is "already in the DOM"
   literally rather than approximately, and it needs no microtask, so nothing this slice's
   tests assert synchronously had to move.

   The residual, which is narrower and is written down in `notify.ts`: a region announces on a
   CHANGE, so an identical message at the same severity, re-raised after the first was
   dismissed, writes the same string and says nothing. A repeat arriving while the first
   notice is still up differs by its `(×N)` suffix and does announce. Closing that means
   clearing the region and writing the text back in a later task — the timing this slice
   declined once already, now for one narrow case rather than for every announcement.

Two smaller divergences, recorded as questions rather than as gaps. `Toast.md` says the
component "has **no focus state** and takes no focus"; the dismiss control SDD §85 requires
carries a `:focus-visible` ring, and the contract's own reasoning is about not STEALING
focus, which this does not do — but the sentence says what it says, and reconciling it
belongs to whoever owns the Design System. And `Toast.md`'s optional "one action — undo,
retry, reveal" has no slot here; optional, so not a conflict, but a later slice adding one
would be widening a shipped contract rather than filling a hole.

## One claim in Design §7 that shipped narrower than it reads

Design §7 says `affectsSaveState` is "derived from slice 17's table rather than authored
beside it", and that "slice 17's own no-double-reporting test is the check that keeps the two
in agreement". **Neither is true of what shipped, and neither could be**: slice 17 does not
exist, so there is no table to derive from and no test to keep anything in agreement.
`grep -rn "no-double-reporting" src tests` finds one hit, and it is a comment.

What the predicate actually derives from is `WRITE_BOUNDARY_CODES`, exported by
`src/application/ports/versioning.ts` — the two codes the version check itself raises. That
is a real derivation with a real single source, and it exists because the first draft's
`error.category !== 'Validation'` was wrong in a way the category alone cannot express:
`revisionConflict` and `externalModification` are `Validation` by category and write-boundary
by meaning — the command reached the repository and the user's edit was refused — so
reporting `saved` for one of them is the false assurance the predicate exists to prevent.

The forward-looking half stands: when slice 17 authors its error-to-surface table, this
predicate is one of the things that table has to agree with, and the agreement will need a
check. `affects-save-state.ts` says that in the future tense now.

**And the pre-write SET was measured wrong twice before it settled.** The first draft counted
every non-`Validation` failure. The second added `Domain`, on a `grep -rn "'Domain'" src/`
that found seven pre-write raise sites and confirmed the widening it had been written to
confirm. `Reference` was never looked at — and it is the category the delete flow and both
reversible adapters refuse through, nineteen raise sites over fourteen codes, every one of
them a referent lookup that came back empty. So confirming a delete dialog whose referent set
had moved raised `reference.set-changed`, whose own developer message reads "nothing was
written", and left a sticky "Save error" badge standing behind it. Found by review, one
click from the Inspector's Delete button.

The generalisable half is about the instrument rather than the category: a grep written to
confirm a widening already decided on measures that widening and nothing else.

**And it happened a THIRD time, found by the review bot on the pull request.** That pass
enumerated `Reference` exhaustively and left `Calculation` in the affecting set, on the
strength of one sentence in `calculationError`'s own docblock — "raised on the path where the
stale marker has already been persisted" — which turns out to describe its CALLER's state (the
cascade persists a stale marker and THEN asks for a recalculation) rather than a write by the
command raising it. All twenty-two `Calculation` raise sites are a derivation refusing its own
inputs: `deriveCalibration` before `geometry.write`, `deriveRequirementFigures` before
`requirements.save`, and the eleven pure-function codes in `costPipeline.ts`,
`quantityEngine.ts` and `Money.ts` that write nothing by construction. Calibrating with two
clicks at the same point left the same sticky badge. The one place a `Calculation` error could
escape a half-written sequence is `deleteResolution.ts`'s inline recalculation, and it cannot:
a failure there is LOGGED, because `DeleteResolutionErrors` has no room for one.

The pre-write set is `Validation`, `Domain`, `Reference` and `Calculation` — half the
vocabulary — enumerated one category at a time in the predicate's docblock with their raise
sites, and `withSaveStateTracking.test.ts` pins the reachable codes of the last two,
transcribed from those sites rather than from the predicate. **A fifth widening should
probably be refused**: at that point the CATEGORY is the wrong axis, which is exactly the
conclusion the next section reaches from the other end.

## The seam that made `ok` mean two things

The same review found the sharper half, and it is a slice 6 contract rather than a slice 13
predicate. `UndoableCommand` resolved `Result<void, AppError>` under a docblock arguing that
`CommandHistory` "only ever needs to know whether a write succeeded, not what it returned" —
true of the two stacks, which is all that existed when it was written, and false of this
slice's indicator, whose whole subject is whether the Plan's data is safely written.
`SaveStateStore` states the rule categorically; `withSaveStateTracking` broke it by inferring
a write from a resolved `Result`.

FOUR dispatch paths succeed having written nothing: `ReversibleAssignAssetCommand.execute`
when the asset is already linked to the zone (`AssignAssetCommand` answers
`ok({ created: false })` from a read), that adapter's `undo` when its recorded outcome is
`'found'`, and `CommandHistory`'s own `undo`/`redo` on an empty stack. Each of them cleared a
`save-error` raised by a real persistence failure. The first is one click in the Inspector,
which is what made it a P1.

**Neither blanket default is safe**, which is why this could not be fixed in the tracker:
reading every `ok` as a write is the defect, and reading every `ok` as a no-write leaves a
genuine save unable to clear the badge for the rest of the session. So the commands report it.
`application/commands/DispatchOutcome.ts` declares `'wrote' | 'no-write'`, REQUIRED — every
`ok(...)` in every reversible adapter became a build error until somebody decided, seventeen of
them, which is the same shape slice 15 records for adding a dialog kind. A `void | 'no-write'`
widening would have changed two call sites and left every other `ok(undefined)` compiling; that
is the SELF-DECLARED shape this repository already refuses elsewhere, and the next command that
wrote nothing and forgot to say so would have reintroduced the defect silently.

A fifth erasing seam turned up in the conversion that nobody had counted: `runtime.ts`'s
`asVoidCommand` reduced every adapter success to `ok(undefined)` under the SAME falsified
sentence. It takes an explicit `outcomeOf` reader now, because the adapters answer differently
shaped payloads and there is nothing to default to.

The change pushed `runtime.ts` to 411 lines against its 400-line cap, which its own note had
predicted — and the note said the answer would be an extraction rather than another collapsed
literal. `presentation/editor/inspector-wiring.ts` is that extraction, and the literal that had
been collapsed to buy three lines is back in its natural shape.

### The marker that outlived its sequence

The last finding of the pull request, and the only one whose remedy landed OUTSIDE this
slice. `runDeleteResolution` logged a failed final `clearMarker` and answered `ok` — which is
accurate, because every write the resolution owed the vault had landed — so the reversible
adapter reported `'wrote'` and this slice's indicator settled on `Saved`. What survived was
the durable marker, and `recoverInterruptedSequences` at the next load restored every referent
from the pre-state and restored the deleted entity: **a completed deletion silently reversed,
hours later, behind an indicator that had correctly called it saved.**

The report proposed propagating the failure into the save state. That was declined, and the
reason generalises: **reporting does not fix this harm, it decorates it.** A sticky
`save-error` leaves the zone coming back on the next load just the same, and names a marker
file the user has never heard of. It also costs exactly what four separate measurements of
`affectsSaveState` were spent avoiding — a permanent badge over data that is, at that moment,
correct.

The harm is in the recovery, so the fix is: **`entityDeleted` means the sequence FINISHED.**
`runDeleteResolution` writes that flag only after `deleteEntity` returns ok, and `deleteEntity`
is the last mutation — everything past it is marker bookkeeping. Recovery clears such a marker
and reverses nothing. A marker saying `false` is the only genuinely interrupted one, and its
entity is by definition still present, so `recoverInterruptedSequences`'s own `restoreEntity`
is deleted for want of any reachable case and `RecoveryDeps` loses `zones` and `assets` with
it. (`undoDeleteResolution`'s member of the same name is the undo path and is untouched: a
user asking for their deletion back is not a crash.)

Three recovery tests encoded the old policy, one of them asserting a
`sequence.recovery.entity-restore-refused` line that now has no producer anywhere. That is
worth recording as a shape rather than as churn: the reversal was **deliberate, tested and
wrong**, so the correction reads as a regression until the ordering argument above is made.

The clear failure is still reported, through this slice's OTHER surface — the one the cascade
precedent already established. `ResolutionOps.notify` mirrors `CascadeDeps.notify` exactly,
optional for the suite's benefit, which is what makes a composition that forgets it compile
and pass in silence; `tests/plugin/sequenceNoticeWiring.test.ts` is the only thing that can
tell the two apart, and it was watched red with the wiring removed. Both its cases assert the
PAIR — the delete still answers `ok` AND the user hears about it — because either half alone
is satisfied by a build nobody wants.

**What this does NOT close, stated rather than implied.** If BOTH marker writes fail — the
`entityDeleted: true` update and the `clear` — the survivor says `false` while the entity
really is gone, and recovery rolls the referents back around a deletion that stands. It takes
two failures where the reported defect took one, and no flag on the marker can see it: only
the vault knows, and asking costs a second read per marker on every load. It is written into
`recoverOne`'s docblock, not closed.

## References

- PRD §67 Autosave — the four literal states and the two stated triggers this slice
  implements and reduces to one mechanism (Design §7).
- SDD §60 UI Layout — the status bar row (`Status / Measurements / Save State`) this
  slice's `SaveStateIndicator.vue` fills the third region of.
- SDD §15 Persistent vs Ephemeral State — both new stores are ephemeral, per
  Persistence Impact.
- SDD §14 State Management — Pinia store scoping conventions this slice follows
  (per-view for `SaveStateStore`) and deliberately departs from (plugin-global for
  `NotificationStore`, see Design §4).
- SDD §9 Plugin Bootstrap — the `onload`/`onunload` order this slice's global
  notification wiring fits into, and the `onunload` it introduces.
- SDD §12 Vue Mounting Strategy — "each Obsidian view receives an isolated Vue app,"
  and this slice's narrow, explicit exception for `NotificationHost`.
- `docs/setup/vue-conventions.md` §5 — "One Pinia per view app… State shared BETWEEN
  views is not Pinia's job." That is the rule `SaveStateStore` follows and the one
  `NotificationStore` departs from (Design §4). Naming it here because the convention
  file states the rule without an exception, and a repository where one document says
  "always" and another quietly says "except here" is the same defect as an unchecked
  comment — a reader arriving from either side should find the other.
- `docs/setup/vue-conventions.md` §6 — "`createApp(ViewRoot)` in the view's `onOpen`…
  `app.unmount()` in `onClose`", and "Nothing outside the view knows it is Vue"
  (CLAUDE.md says the same). This slice's `NotificationHost` app is created in
  `RenovationPlannerPlugin.onload()` and unmounted in `onunload()`, so the composition
  root does know it is mounting Vue. This is the SECOND departure, and it is listed
  because an earlier draft named only the §5 one — which was not a defensible split:
  a plugin-global store needs a plugin-global app to mount its host into, so the two
  are halves of one decision and an inventory carrying one of them is simply wrong.
  What §6's *reasoning* asks for is still honoured: the app is unmounted
  unconditionally on `onunload`, which is what runs every `onUnmounted`/`onScopeDispose`
  in the tree, and the plugin holds no reference to a view.

  The whole exception is one store, one host component, one plugin-global app, created
  and destroyed once per plugin lifecycle. It is not a licence for a second, and slice
  15 states the same in the other direction — its dialog host is deliberately per-view.
- SDD §29-31 Command Architecture, Undoable Editor Commands, Transaction Boundary
  (detailed in slice 6) — the rule this slice's save-state transitions are driven by
  and the reasoning behind `Unsaved Changes`'s unreachability (Design §8).
- SDD §65 Result Pattern, §66 Error Boundary (detailed in slice 11) — the `.ok` field as
  the discriminant this slice's `withSaveStateTracking` inspects, and the `User Message`
  step whose container slice 11 leaves unnamed and this slice supplies as `notify`.
- SDD §84 CSS and Theme Integration — Obsidian CSS variables, no hardcoded palette.
- SDD §85 Accessibility — keyboard operability, live regions, status not color-only.
- ADR-004 Vue 3 for Plugin UI — isolated app per `ItemView`, and this slice's flagged
  departure for the plugin-global `NotificationHost`.
- ADR-005 Pinia for Presentation State — cache/working state, never source of truth.
- ADR-007 Command-Based Mutations — "one user intent, one logical transaction," the
  guarantee this slice's save-state model depends on holding.
- `docs/requirements/Architecture and Software Design.md` — slice map and shared conventions.
- `src/plugin/RenovationPlannerPlugin.ts` — the current `onload`, with no `onunload`,
  that this slice extends.
