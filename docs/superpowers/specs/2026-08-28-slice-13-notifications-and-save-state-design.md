# Design slice 13 — Notifications and save-state surfaces

**Date:** 2026-08-28
**Slice document:** [`docs/tasks/13-notifications-and-save-state-surfaces.md`](../../tasks/13-notifications-and-save-state-surfaces.md)
**Baseline:** `main` at `3b51509` (slice 18 merged).
Coverage floors in force: 99 / 99 / 99 / 98 (statements / functions / lines / branches),
`vitest.config.ts`. No measured figure is quoted here — run `npm run test:coverage` rather
than trusting a number copied into a document.

**Built in parallel with design slice 16.** The two are siblings under *Shared UI
vocabulary* and the slice map states that 13–16 do not depend on one another. Together they
are the last two things standing between the tree and slice 17, which `dependsOn` 13, 14,
15 and 16 — of which 14 and 15 have landed.

## Purpose

Two surfaces, one shared idea: telling a user something without interrupting them.

- A **transient message about one event** — "zone created", a refusal, a mapped fault.
- A **persistent indicator of one ongoing fact** — is this Plan's data safely written?

Slice 5 reserved space for both and filled neither. Slice 11 then built two thirds of the
first one without meaning to.

## What this document changes about the slice document

The slice document remains the specification. Brainstorming on 2026-08-28 found that it was
written before slice 11 landed, and three of its statements no longer survive contact with
the code. Where the two disagree, **this document is the later measurement.**

### The three stale claims

1. **`RenovationPlannerPlugin` already has an `onunload`, and it is a disposer list.**
   Definition of Done item 5 calls the notification app "the plugin's first" thing needing
   disposal. Konva's `window.Konva` global got there first, and the mechanism generalised
   past it: `onunload` drains a `disposers` array, catching each disposer independently so
   one throwing cannot abandon the rest, and `splice(0)` empties the list as it reads so a
   second `onunload` cannot release the same thing twice
   (`src/plugin/RenovationPlannerPlugin.ts:99` and `:384`). **This slice therefore pushes
   one disposer**, and writes no teardown logic of its own.
2. **`reportFault` no longer prints a raw `Error.message`.** The slice document's
   "carried forward" note says it does. Slice 11 replaced it with `notifyFault`, which maps
   the cause to a coded `PersistenceError`, logs it with the original cause under the
   caller's own event name, and prints the mapped copy.
3. **The plugin already has a working toast surface.** `src/presentation/notices/notify.ts`
   — `notify` / `notifyError` / `notifyFault`, on Obsidian's `Notice`. Every refusal in the
   editor already reaches the user through it, via `runtime.ts`'s `notifyIfRefused`. The
   slice document specifies a *replacement* for a door that did not exist when it was
   written.

### The decision that follows from the third

The slice document's Design §4 and §5 build a plugin-global Pinia instance, a second Vue
app, and `NotificationHost.vue`, as an explicit departure from SDD §12 and from
`vue-conventions.md` §5 and §6. Its whole stated reason for not building on `Notice` is one
parenthetical: *"severities, dedup, and manual dismiss need a richer contract than Notice
offers."*

Measured against `node_modules/obsidian/obsidian.d.ts` at the pinned `1.13.0`, three of
those four hold the other way:

| Requirement | `Notice` offers |
|---|---|
| Manual dismiss | `hide()` |
| Persist until dismissed | `duration: 0` |
| Severity markup, roles, a dismiss control | `messageEl` / `containerEl`, real DOM to write into |
| Dedup as an in-place `×N` | `setMessage(...)` |
| Hover-pause of the auto-dismiss timer | **not offered** |
| A visible-slot cap with promotion | **not offered** |

`messageEl` and `containerEl` are `@since 1.8.7`; `manifest.json` declares
`minAppVersion: 1.13.0`, so both are promised at the floor this plugin supports.

**Decision: `Notice` is the container primitive.** No second Vue app, no plugin-global
Pinia, no departure from SDD §12, and one toast surface in the plugin rather than two.
The two rows `Notice` does not offer are ours to build, and both fall out of one choice:
every notice is constructed with `duration: 0` and we own the timer.

## Design

### 1. What Obsidian owns and what we own

| Concern | Owner |
|---|---|
| Positioning, the stacking container, animation, mobile behaviour, z-index | Obsidian |
| Severity markup — icon, translated severity label, colour from theme variables | us, into `messageEl` |
| `role` / `aria-live`, and a focusable, keyboard-operable dismiss control | us, into `messageEl` |
| Auto-dismiss timing, hover/focus pause, dedup `×N`, the 3-slot cap and promotion | us |

Constructing with `duration: 0` is load-bearing rather than incidental: Obsidian's own
timer is internal and cannot be paused, so a design that let Obsidian time the notice could
not satisfy the accessibility timing rule in the slice document's Design §2.

### 2. The API, and why it is not `notify.success(...)`

The slice document's Design §5 specifies `notify.success/info/warning/error`. **This design
refuses that spelling**, for a reason that is a lint mechanism rather than a taste.

`NOTICE_TEXT_BAN` is this repository's one gate over what reaches a user-facing notice: no
raw `Error.message` or `.stack`, no bare string literal. It rests on `NOTICE_DOOR`
(`eslint.config.mjs:527`):

```js
const NOTICE_DOOR = ":matches(CallExpression[callee.name='notify'], NewExpression[callee.name='Notice'])";
```

It keys on `callee.name`. A member call — `notify.success('...')` — has a `MemberExpression`
callee, which has no `name`, so **every call site written in the new spelling would be
invisible to the rule.** CLAUDE.md already records this exact shape twice under "a guard on
the door nobody dispatches through is a guard nobody has": the wrapper present, the test
green, and the second door raw.

So the severity dimension arrives as bare identifiers the existing selector can name, and
the two existing signatures do not change:

```
notify(message)                     → info      existing door, now carrying a severity
notifySuccess(message)              → success   new
notifyWarning(message)              → warning   new
notifyError(error: AppError)        → error     existing, unchanged
notifyFault(cause, logger, event)   → error     existing, unchanged
```

`notifyError` is not renamed and does not gain a string overload: it is the `AppError` door
and its whole contract is that the caller holds an error rather than text.

**`notify` becomes `info`, and that is a DEFAULT rather than a verdict on the call sites it
already has.** The design review caught this: the plugin has exactly four bare `notify(...)`
calls, and leaving all four at `info` would auto-dismiss two of them after six seconds
despite their copy being precisely the kind of fact the warning tier exists for. Each is
classified deliberately, in the same edit that gives `notify` a severity:

| Call site | Copy | Severity |
|---|---|---|
| `composition-root.ts:291` `cascade.aborted` | "Their figures may be out of date." | **warning** |
| `composition-root.ts:294` `cascade.stale-marker-failed` | "Its figures may be wrong until it is recalculated." | **warning** |
| `planEditorCommands.ts:140` `background.unsupported` | "Only PNG, JPEG and PDF files can be a plan background." | **warning** |
| `planEditorCommands.ts:111` `plan.none` | "This vault has no renovation plans yet." | info |

The two cascade notices are the clearest case in the plugin: they run in the BACKGROUND,
nothing the user clicked is waiting on them, and the thing that failed is the durable marker
that would have let a later reader see a wrong figure as wrong. A notice that vanishes while
the user is looking elsewhere is the same silence that port exists to break.
`background.unsupported` reports that something the user explicitly asked for did not happen,
with a remedy outside the plugin. `plan.none` stays `info`: a statement of fact about an
empty vault, with no failed action behind it.

**`NOTICE_DOOR`'s pattern gains the two new names in the same edit as the functions**, and
`tests/build/notice-text-boundary.test.ts` gains a case per name driven through a real
fixture path. Adding a notice door without extending the gate over it would be widening the
surface and narrowing the check in one commit.

There is no `initNotifications` and no global Pinia instance, so the slice document's Design
§5 discussion of explicit binding versus ambient Pinia resolution does not apply: there is
no store to bind. The composition root's only new obligation is disposal, in the `onunload`
that already exists.

### 3. Files

```text
presentation/notices/
├── notify.ts      the ONE Notice door — grows two functions and a severity argument
├── severity.ts    the severity union, the auto-dismiss policy, MAX_VISIBLE_NOTICES
└── queue.ts       dedup, the cap, promotion, timers and pause — pure over an injected host
```

A second folder named `presentation/notifications/` beside the existing
`presentation/notices/` is refused: two directories one synonym apart, one of them holding
"the one notice door", is a naming trap that costs a reader every time.

`queue.ts` takes a `NoticeHost` port — roughly `open(content, duration) → handle` with
`hide()` and a liveness read — so every rule it holds is a node test with no Obsidian in
it. `notify.ts` is the only module that binds that port to `new Notice(...)`, which is what
keeps "one door" true as a fact about the import graph rather than as a sentence.

Policy values, from the slice document's Design §2 and §3, unchanged:

```text
success   4000ms
info      6000ms
warning   null   (persists until dismissed)
error     null   (persists until dismissed)
MAX_VISIBLE_NOTICES = 3
```

An auto-dismiss timer pauses while the pointer is over the entry or its dismiss control has
focus, and resumes for a full fresh duration **only once neither holds**. Two conditions,
not one flag: collapsing them lets a pointer-leave resume the timer while the dismiss button
still has focus, so the notice vanishes under a user who is tabbing to dismiss it — which is
the exact failure the rule exists to prevent.

### 4. The slot leak, which is the one real risk in this design

Obsidian can dismiss a notice without telling us — click-to-dismiss is its documented
behaviour for a user, and the typings expose no callback for it either way, so this design
treats *any* dismissal it did not perform itself as unobservable rather than resting on one
gesture. A cap implemented naively would leak one slot per such dismissal, until the queue
could never show anything again — a failure that arrives slowly, in a real vault, and in no
test.

**`containerEl.isConnected` is the authority.** Before promoting a queued entry, the queue
sweeps its tracked handles and drops the disconnected ones. A `click` listener on
`containerEl` is only a *prompt* to sweep, never the mechanism — so if a future Obsidian
changes its dismiss gesture, the behaviour degrades to "the slot frees on the next push"
rather than to a permanently wedged queue.

Stated as a property to test rather than as a paragraph: a notice dismissed by something
other than our own control still frees its slot.

### 5. Save-state: the slice document's design, unchanged

Nothing in the save-state half is contested by anything slice 11 or 18 built, and it is
adopted as written:

- `SaveStateStore`, one per Plan Editor's own Pinia instance, beside slice 5's stores.
- `withSaveStateTracking` over **all three** writing operations — `run`, `undo`, `redo`.
  An undo is a write, and a decorator covering `run` alone reports `Saved` through a failed
  undo.
- `pendingCount` + `hasErrorInBatch`, so two overlapping dispatches never settle to
  `'saved'` while either is unresolved, and a batch with one failure settles to
  `'save-error'` even where a sibling succeeded.
- **Three settlement outcomes, not two.** A batch that failed reports `save-error`; a batch
  that WROTE something reports `saved`; a batch in which nothing was written reverts to
  whatever the indicator read before it opened. The third exists because a validation refusal
  reaches no repository: settling it as `saved` would let a refused field edit clear a
  `save-error` left by a real persistence failure and tell the user unsaved data is now safe.
  **Only a write that actually succeeded may clear a save error.**
- `affectsSaveState` is the category inequality **plus a carve-out**, and both halves were
  measured: `ErrorCategory` is TITLE case (`'Validation'`, not `'validation'` — a lowercase
  literal does not compile), and `Validation` is not a synonym for "wrote nothing".
  `versioning.ts` raises `revisionConflict` and `externalModification` as `ValidationError`s,
  and both mean the command REACHED the repository and the user's edit was refused. So the
  category is the first cut, the two write-boundary codes are carved back out of it, and the
  suffixes come from a table `versioning.ts` exports rather than a second copy. Stated as an
  inequality so a category added by a later slice defaults to *affecting* the indicator: "we
  might not have written your data" is the safe answer while nobody has thought about it.
- **A REJECTION settles the batch too, and this is the one correction the design review
  added.** The first draft of `track` awaited the operation and decremented only on
  resolution — but SDD §65 reserves throws for technical faults and the dispatcher
  propagates them: `withEditorStateRefresh` re-throws unchanged and `runtime.ts`'s
  `reportFault` is what catches them. So a thrown fault would have left `pendingCount`
  permanently above zero, sticking the indicator on `saving` forever and making every later
  batch unsettleable — a dead indicator rather than a wrong one. `track` decrements in a
  `catch` and re-throws the cause unchanged, and it settles to `save-error` rather than
  `saved` for the same reason `affectsSaveState` defaults that way: a fault says nothing
  about whether the write landed, and "we might not have written your data" is the safe
  answer while nobody knows.
- `'unsaved-changes'` stays in the type and is unreachable through the store's own action
  surface, proven by an exhaustive-transition test rather than asserted in prose.
- `SAVE_STATE_KEYS` maps each state to a `StringKey`; the copy lives in `en.ts` and `de.ts`
  like every other user-facing string.

Wiring, at `src/presentation/editor/runtime.ts:470`:

```text
history → withEditorStateRefresh → withSaveStateTracking → wrapDispatcher
```

`withSaveStateTracking` nests **outside** `withEditorStateRefresh`, so `Saved` never appears
while the canvas still shows the pre-command state, and **inside** `wrapDispatcher`, which
is the one dispatcher a leaf hands out.

`SaveStateIndicator.vue` renders into `.rp-editor-save-state`, the region `StatusBar.vue`
already reserves by name with `role="status"` on it and a docblock naming this slice.

### 6. The German copy

Every key this slice adds to `en.ts` gets a `de.ts` entry in the same edit.
`tests/presentation/i18n/strings.test.ts` already refuses a missing translation. Read its
reach narrowly: it pins completeness plus two German terms, and no gate reads the rest of
that file's grammar or spelling. The four save-state labels and the four severity labels
are short, and they are the kind of string the existing check cannot grade.

## Persistence impact

None. Neither surface is written to the vault, read back after a reload, or included in any
export. The layer-dependency lint rule already makes a repository import from either module
a build failure, so item 11 of the Definition of Done is checked by a rule rather than by
inspection.

## Testing strategy

**Node, no Obsidian** — `queue.ts` against a fake `NoticeHost`: dedup increments a count and
restarts the timer instead of appending; the cap renders at most three and promotes on a
free; `vi.useFakeTimers()` drives an entry to removal at exactly its deadline, hover holds
it past that deadline, and leaving resumes a full fresh duration; a handle whose host
reports it disconnected frees its slot on the next push.

**jsdom, against a widened `Notice` fake** — a `success`/`info` entry renders
`role="status"` / `aria-live="polite"` and a `warning`/`error` entry renders `role="alert"`
/ `aria-live="assertive"`, asserted against rendered attributes; the dismiss control is a
real focusable element, not a click handler on a `div`; severity is never carried by colour
alone.

**Save-state** — the slice document's list is adopted whole, including the two cases that
exist to catch a decorator that looks finished: the table driven over all three of `run`,
`undo` and `redo`, and the overlapping-dispatch case where one of two concurrent dispatches
fails. Plus the case the design review added: a REJECTING operation settles the batch,
re-throws its cause unchanged, and leaves a following dispatch able to settle — driven over
all three operations, because a decorator that handles a rejecting `run` and not a rejecting
`undo` passes a `run`-only test.

**The gate over the gate** — `tests/build/notice-text-boundary.test.ts` gains a case per new
door name. A door added without one would be a notice surface no lint rule can see.

### The fake, and what it costs to make honest

`tests/helpers/obsidian-mock.ts`'s `Notice` is a six-line recorder that draws nothing. It
becomes what Obsidian actually is: a `.notice-container > .notice` nesting, real
`containerEl` and `messageEl`, a `hide()` that disconnects the element, `setMessage`, and
the `duration` recorded. `Notice.shown` stays, so existing call sites keep their assertion.

This is the "a fake must not be thinner than the real thing" rule, and CLAUDE.md's ledger
says what happens when it is skipped — 65 tests and 86 tests red on two previous occasions
where a fake had been concealing a shipped defect. Expect this widening to turn tests red;
those reds are the finding, not an obstacle to it.

## What this design does not verify, stated plainly

**Toast appearance is verified in a real vault and nowhere else.** `npm run harness` and
`npm run harness-shot` cannot photograph a `Notice`:

- the `obsidian` module the harness shares with the suite is the mock, which draws nothing
  until this slice widens it, and even then draws unstyled DOM;
- `tests/harness/obsidian.css` carries **no `.notice` or `.notice-container` rules at all**
  — `--layer-notice` appears once, on an autocomplete tooltip. The vendored reduction was
  derived from another plugin's driven states, and that plugin never raised a notice.

Re-deriving those rules needs a full `app.css` from a local Obsidian install, which is not
available in this environment. Hand-writing substitutes is refused: inventing what Obsidian
looks like is the same defect as a fake kinder than the real thing, and it would make the
harness confidently wrong rather than honestly silent.

So `docs/tests/` gains a manual case for the toast surface, and this limitation is written
into `notify.ts`'s own header rather than living only in this document. This is not a
regression — `notifyError` has been unphotographable since slice 11 — but it is the reason
"accessible, themed toasts" must not be written any wider than the jsdom attribute
assertions and one manual walkthrough actually reach.

`SaveStateIndicator.vue` has no such limit: it is ordinary DOM inside the Plan Editor, so
the harness draws it and `harness-shot` photographs it like any other shell region.

## Definition of done

The slice document's twelve items, with four amended by this design:

- **Item 4** — "mounted exactly once for the lifetime of the plugin" becomes: the notice
  queue is one module-level queue, and opening and closing multiple Plan Editor leaves
  neither creates a second one nor loses a queued entry.
- **Item 5** — the queue registers **one disposer** on the plugin's existing `disposers`
  list. `onunload` is neither created nor modified by this slice, and the notification queue
  is not the first thing in it; Konva's global was.
- **Item 6** — `notify` / `notifySuccess` / `notifyWarning` each push exactly one entry of
  the matching severity, and `notifyError` / `notifyFault` push at `error`. The "throws
  before `initNotifications`" clause is dropped: there is no binding step to precede.
- **New item 13** — `NOTICE_DOOR` names every notice door this slice adds, driven through
  real fixture paths in `tests/build/notice-text-boundary.test.ts`.

Item 12 is unchanged and is the gate: `npm run check` passes with this slice's code
included.

## References

- PRD §67 Autosave — the four state labels, and the two triggers that reduce to one.
- SDD §60 UI Layout — the status bar row this slice fills the third region of.
- SDD §65 Result Pattern, §66 Error Boundary — the `.ok` discriminant
  `withSaveStateTracking` inspects, and the User Message step whose container this slice
  supplies.
- SDD §84 CSS and Theme Integration, §85 Accessibility.
- ADR-005 Pinia for Presentation State — `SaveStateStore` is ephemeral working state.
- ADR-007 Command-Based Mutations — the transaction boundary the save-state model relies on.
- `eslint.config.mjs:527` — `NOTICE_DOOR`, the reason for §2's departure.
- `src/presentation/notices/notify.ts` — the existing door this slice grows rather than
  replaces.
