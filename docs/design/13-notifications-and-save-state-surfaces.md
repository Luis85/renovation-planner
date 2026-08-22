# Design Slice 13: Notifications & Save-State Surfaces

## Purpose

Every view needs two different ways to tell a user "something happened": a transient
message about one event (a zone was created, an import failed) and a persistent
indicator of one ongoing fact (is the current Plan's data safely written?). Nothing
built so far provides either. Slice 5 reserved space for both — its status bar row
already names a "Save state" region and says outright that it "has nothing to show
until slice 6 introduces edits" (SDD §60) — and slice 6 built the
`CommandHistory`/transaction-boundary machinery a save-state indicator would observe,
but neither slice built the indicator itself, and neither built a toast system at all.

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

- Which `DomainError` category becomes a toast, a modal, or an inline field error —
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
- **Slice 2 (Core Primitives)** — `Result<T, AppError>`, and its `.ok` discriminant
  (per slice 11's own usage — `if (!result.ok)`), consumed by
  `withSaveStateTracking` to decide `Saved` vs `Save Error`.
- **Slice 11 (Error Handling, Diagnostics & Data Safety)** — the Error Boundary and
  `ToUserMessage`; its own illustrative example (`toast.show(toUserMessage(result.error))`)
  names the surface this slice gives a real contract to (`notify`, not `toast.show`).
- **ADR-004 (Vue 3 for Plugin UI)** — "isolated app per `ItemView`" (SDD §12). This
  slice's `NotificationHost` is a deliberate, narrow exception: see Design.
- **ADR-005 (Pinia for Presentation State)** — both stores this slice adds are pure
  ephemeral Pinia state; ADR-005's "cache, not source of truth" applies to both.
- **ADR-007 (Command-Based Mutations)** — "one user intent, one logical transaction" is
  exactly the guarantee `SaveStateStore`'s transitions rely on existing.
- **PRD §67 (Autosave)** — the four state labels this slice implements verbatim, and
  the two stated triggers ("completed commands", "debounced property edits") this
  slice's Design reduces to one mechanism.

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
              this codebase produces (SDD §66's User Message step)
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
notify.success(message)    — no-op-safe id return, auto-dismiss per §2
notify.info(message)
notify.warning(message)
notify.error(message)
```

Calling `notify.*` before `initNotifications` runs is a programming error (the
composition root sequencing is wrong), not a recoverable runtime condition — it throws
loudly rather than silently dropping the message, matching this codebase's general
preference for a loud failure at the point a real bug exists over a caller-visible
silent no-op.

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
"Unsaved Changes" / "Save Error"). This project's own sentence-case UI-text rule
(CLAUDE.md, enforced by `npm run lint` per the Obsidian marketplace guidelines) applies
to rendered copy, so the *type*'s literal values stay traceable to the PRD's exact
wording while a separate label map supplies the sentence-cased string that is actually
rendered:

```text
saved             → "Saved"
saving            → "Saving"
unsaved-changes   → "Unsaved changes"
save-error        → "Save error"
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
withSaveStateTracking(dispatcher, saveStateStore).run(command)
  → saveStateStore.beginSaving()      state := 'saving'
  → result = await dispatcher.run(command)
  → result.ok  → saveStateStore.resolveOk()    state := 'saved'
  → !result.ok → saveStateStore.resolveErr()   state := 'save-error'
  → return result unchanged to the caller
```

This wraps the same `commandDispatcher` object slice 6 hands to `EditorContext` and to
`InspectorStore`'s commit path — both tools and Inspector edits already funnel through
one dispatcher instance per Plan Editor (slice 6's own "one choke point" rule), so
wrapping it once at the composition root covers every command source without either
`ToolManager` or `InspectorStore` needing to know a save-state store exists.

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
- Severity is never color-only: each entry carries a distinct icon and the word itself
  (the SAVE_STATE_LABELS text, or an equivalent severity label for a toast) alongside
  its color, matching the "status not color-only" rule slice 5 already applies to
  `ZoneRenderModel.status`.
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

// The only place PRD §67's literal Title Case copy is produced; every other
// reference to a SaveState value uses the kebab-case identifier above.
export const SAVE_STATE_LABELS: Readonly<Record<SaveState, string>> = {
  saved: 'Saved',
  saving: 'Saving',
  'unsaved-changes': 'Unsaved changes',
  'save-error': 'Save error',
};
```

```typescript
// presentation/editor/save-state/save-state-store.ts — one per Plan Editor
// ItemView's own Pinia instance (see Design §6), NOT the global Pinia
// instance NotificationStore lives in.
export interface SaveStateStoreState {
  readonly state: SaveState;
}

export const useSaveStateStore: () => {
  readonly state: SaveState;
  beginSaving(): void;  // → 'saving'
  resolveOk(): void;    // → 'saved'
  resolveErr(): void;   // → 'save-error'
  // deliberately no action sets 'unsaved-changes' — see Design §8
};
```

```typescript
// presentation/editor/save-state/with-save-state-tracking.ts
// Decorates the same commandDispatcher shape slice 6's EditorContext and
// InspectorStore already depend on (`{ run(command): Promise<Result<void,
// AppError>> }`, per slice 6 — see Design §7). Transparent: the wrapped
// object's return value is unchanged from the caller's point of view.
export function withSaveStateTracking(
  dispatcher: { run(command: UndoableCommand): Promise<Result<void, AppError>> },
  saveState: Pick<ReturnType<typeof useSaveStateStore>, 'beginSaving' | 'resolveOk' | 'resolveErr'>,
): { run(command: UndoableCommand): Promise<Result<void, AppError>> };
```

```typescript
// presentation/editor/save-state/SaveStateIndicator.vue — no props; reads
// this Plan Editor's own useSaveStateStore() (its own Pinia instance) and
// renders SAVE_STATE_LABELS[state] as text, into the third region of SDD
// §60's status bar row ("Status / Measurements / Save State").
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
- **Unreachability test for `Unsaved Changes`** (backs Design §8's claim directly,
  rather than leaving it as an assertion in prose): drive `SaveStateStore` through
  every reachable sequence of its three actions from its initial state and assert
  `'unsaved-changes'` never appears as a resulting value; a companion architecture-style
  test enumerates the store's exported action names and asserts none of them is named
  or documented as producing it.
- **`withSaveStateTracking` test**: wrap a fake dispatcher returning a resolved
  `Result.ok`, then one returning `Result.err`; assert `beginSaving` is called before
  the wrapped `run()` resolves, and `resolveOk`/`resolveErr` is called with the correct
  result after, and that the wrapper's own return value is identical to what the fake
  dispatcher resolved (a transparent decorator, not a new contract).
- **`SaveStateIndicator.vue` render test**: given each of the four `SaveState` values
  directly (including `'unsaved-changes'`, to prove the renderer is defensively correct
  even though no producer test exercises it — see above), asserts the corresponding
  `SAVE_STATE_LABELS` sentence-case text renders.
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
4. `NotificationHost` is mounted exactly once for the lifetime of the plugin, into a
   DOM node outside any workspace leaf — verified by a test that opens and closes
   multiple Plan Editor leaves and asserts no second `NotificationHost` app is created
   and no notification is lost when a Plan Editor closes.
5. `RenovationPlannerPlugin` gains an `onunload()` that unmounts the notification Vue
   app and removes its DOM node — the plugin's first, since nothing before this slice
   needed one.
6. `notify.success/info/warning/error` each push exactly one entry of the matching
   severity to the bound `NotificationStore`; calling any of them before
   `initNotifications` throws rather than silently no-op-ing.
7. `SaveStateStore` is scoped one-per-Plan-Editor (its own Pinia instance, per slice 5's
   pattern), transitions `saved → saving → saved` on a successful command and
   `saved → saving → save-error` on a failed one, driven through
   `withSaveStateTracking` wrapping slice 6's `commandDispatcher` — with no change to
   `CommandHistory` itself.
8. `SaveStateIndicator.vue` renders the sentence-cased label for all four `SaveState`
   values, into the "Save State" third of SDD §60's status bar row.
9. `'unsaved-changes'` is proven unreachable through `SaveStateStore`'s own action
   surface by an exhaustive-transition test (Testing Strategy), and Design §8's
   reasoning for why is recorded here rather than left as a silently-included fourth
   state with no path to it.
10. Neither `NotificationStore`'s queue nor `SaveStateStore`'s current value is written
    to the Vault, read back after a reload, or included in any project export —
    verified by inspection of both stores' action sets (no repository/Vault import
    reachable from either, matching the layer-dependency lint rule already enforced by
    `npm run lint`).
11. `npm run check` (build, lint, coverage-thresholded tests, fallow) passes with this
    slice's code included.

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
- SDD §29-31 Command Architecture, Undoable Editor Commands, Transaction Boundary
  (detailed in slice 6) — the rule this slice's save-state transitions are driven by
  and the reasoning behind `Unsaved Changes`'s unreachability (Design §8).
- SDD §65 Result Pattern, §66 Error Boundary (detailed in slice 11) — `Result.ok` as
  the discriminant this slice's `withSaveStateTracking` inspects; the `User Message`
  step slice 11's own illustrative `toast.show(...)` example refers to, realized here
  as `notify`.
- SDD §84 CSS and Theme Integration — Obsidian CSS variables, no hardcoded palette.
- SDD §85 Accessibility — keyboard operability, live regions, status not color-only.
- ADR-004 Vue 3 for Plugin UI — isolated app per `ItemView`, and this slice's flagged
  departure for the plugin-global `NotificationHost`.
- ADR-005 Pinia for Presentation State — cache/working state, never source of truth.
- ADR-007 Command-Based Mutations — "one user intent, one logical transaction," the
  guarantee this slice's save-state model depends on holding.
- `docs/design/README.md` — slice map and shared conventions.
- `src/plugin/RenovationPlannerPlugin.ts` — the current `onload`, with no `onunload`,
  that this slice extends.
