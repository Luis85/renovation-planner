# Design Slice 15: Modals & Confirmation Dialogs

## Purpose

Slices 8 and 10 both need to stop a destructive action, show the user what it would
break, and let them choose among several mutually exclusive resolutions — PRD §64's
Cancel / Remove References / Reassign / Delete Anyway pattern. Slice 6's Inspector
needs a place to send its "Delete" action (PRD §39) before any command fires. Neither
slice should invent its own overlay, its own focus handling, or its own
resolve-via-callback-prop plumbing; a second dialog built the same way by hand is how
inconsistent Escape handling and stranded focus enter a codebase.

This slice defines that once: a generic, reusable dialog framework — how a dialog
opens, traps focus, cancels on `Escape`, and resolves with a typed result — and two
dialog KINDS built on it. It also walks through the delete-confirmation flow as the
framework's canonical worked example, because that flow is the reason the richer kind
exists and the clearest test of whether the boundary with slices 8/10 holds.

This slice does not decide *which* actions need a confirmation dialog (slice 17), does
not compute reference counts (slices 8/10 already do), and does not decide what
happens after the user picks "Reassign" (slices 8/10 again). Its contract ends at "the
dialog resolved with this typed value."

## Scope

### In scope

- `DialogStore` (Pinia): the single place that tracks whether a dialog is open and
  which one, following slice 5's store-scaffolding pattern.
- `openDialog(descriptor): Promise<…>` — the one entry point every caller uses to open
  a dialog and await its outcome, instead of passing resolve/reject callbacks as props.
  Its result type is derived from the descriptor's `kind`, so a caller cannot ask for a
  result shape the dialog it opened will never produce.
- Focus trap, `Escape`-to-cancel, and focus restoration on close (SDD §85
  Accessibility: keyboard-accessible controls, visible focus).
- `ConfirmDialog` — a binary confirm/cancel dialog for low-stakes actions.
- `DeleteReferenceDialog` — the four-mutually-exclusive-action dialog PRD §64
  specifies, modeled as a distinct kind rather than a variant of `ConfirmDialog`.
- The delete-confirmation flow as the canonical worked example: an Inspector "Delete"
  action opens `DeleteReferenceDialog`, which displays reference counts the caller
  already computed, and resolves to one of the four PRD §64 actions.
- The modal-stacking rule: one dialog at a time, enforced by `DialogStore` itself, with
  a stated rationale.

### Out of scope (covered by other slices)

- The reference-counting query itself (slice 10's `CountRequirementsReferencing`) —
  slice 10. This slice renders whatever count it is given; nothing under
  `presentation/dialogs/` calls a query, let alone a repository.
- What happens after the dialog resolves — the branching on `'remove-references'` /
  `'reassign'` / `'delete-anyway'`, and which concrete command runs for each — slice
  8's zone-delete command and slice 10's `DeleteAssetCommand`. This slice's contract
  stops at the resolved value.
- Which Inspector actions or error categories open a dialog versus a toast versus an
  inline error — slice 17's decision rules. This slice only notes that
  delete-with-references is a clear case that uses a dialog, never a toast (a
  four-option decision cannot be dismissed as a transient notification).
- Toasts and save-state indicators — slice 13.
- Empty states — slice 14.
- Inline field-level validation feedback — slice 16.
- Non-modal overlays (a context menu, a tooltip, a hover preview) — SDD §15 lists
  "context menu" separately from dialogs in its ephemeral-state catalogue, and nothing
  here changes that; a context menu does not block interaction the way a dialog does
  and is not built on this framework.

## Dependencies

- Slice 5 (Canvas Rendering & Editor Shell) — the Vue + Pinia app instance a
  `DialogStore` and its host component are added to; ADR-005's "Pinia is not the
  persistent source of truth" is exactly the guarantee `DialogStore`'s ephemeral state
  relies on. `DialogHost` mounts into every `ItemView`-scoped app, not the Plan Editor's
  alone — see Interfaces & Contracts.
- Slice 14 (Empty States) — not a build dependency, but the reason the previous point
  matters: slice 14's "Create a project" action opens a dialog from the Renovation
  Project view, which has its own Vue app and therefore needs its own `DialogHost`.
- Slice 6 (Editor Tool Framework, Undo/Redo & Inspector) — the Inspector action
  pipeline (Selection → Inspector Query → Inspector DTO → Vue UI → edit → Command) this
  slice's worked example attaches its "Delete" action to, and the convention that
  `Escape` abandons the current transient interaction with no command dispatched
  (there: an in-progress tool gesture; here: an open dialog).
- Slice 8 (Zone Editing) — `ReversibleDeleteZoneCommand` (the `UndoableCommand`
  wrapping slice 3's plain `DeleteZoneCommand`) that dispatches after this dialog
  resolves, and whose "Deletion & reference-integrity checking" was explicitly
  deferred to slice 10.
- Slice 10 (Assets, Requirements & the End-to-End Loop) — the
  `CountRequirementsReferencing` query that supplies this dialog's rows, and the
  "Deletion & reference integrity" section that names the
  Cancel/Remove-References/Reassign/Delete-Anyway flow this dialog renders and the
  command-side enforcement it does not replace.
- ADR-004 (Vue 3 for Plugin UI) — dialogs are Vue components, not raw DOM built by
  hand.
- ADR-005 (Pinia for Presentation State) — `DialogStore` is UI state, never canonical.
- PRD §64 (Deletion Semantics) and PRD §39 (User Experience Requirements) — the two
  PRD sections this slice's design derives from directly.

## Design

### `DialogStore` and the Promise-based open API

`DialogStore` follows the same `defineStore` pattern slice 5 scaffolds and slice 6
extends. It is not in SDD §14's "recommended stores" list by name — that list predates
this slice the same way it predates `SelectionStore`/`InspectorStore`, which slice 6
already added beyond it. Adding a store for a genuinely new piece of ephemeral UI state
is exactly what §14's list is a starting point for, not a ceiling on.

```text
DialogStore
  current: DialogDescriptor | null

  openDialog(descriptor)  → Promise<result type implied by descriptor.kind>
    → if current is already set: throw — see Modal stacking rule below
    → sets current = descriptor, captures the Promise's resolve function internally
    → returns the Promise; nothing else in the app can construct one directly

  resolve(result)
    → called only by the active dialog component itself, never by an outside caller
    → settles the captured Promise with `result`, then clears `current`
```

One dialog descriptor, one open call, one resolved value — no separate `onConfirm`/
`onCancel` callback props, and no event emitted that a caller must remember to
subscribe to before opening. A caller that wants to act on the outcome simply
`await`s the returned Promise:

```typescript
// No explicit type argument: `kind: 'confirm'` already determines the result type.
const result = await dialogStore.openDialog({
  kind: 'confirm',
  title: 'Duplicate this zone?',
  message: 'A copy will be created in the same plan.',
});
if (result === 'cancel') return;
```

A single `DialogHost` component, mounted once at each `ItemView`-scoped app root,
renders whichever descriptor `current` holds by switching on its `kind` — there is
exactly one live dialog element per view at any time, never one per potential caller.

### Focus trap and `Escape`

Per SDD §85 (keyboard-accessible controls, visible focus):

- On open, `DialogHost` captures `document.activeElement` and moves focus to the
  dialog's first focusable control. The dialog and everything behind it are not both
  reachable by keyboard at once: the background content becomes `inert` (or
  `aria-hidden` where `inert` is unavailable) for the duration.
- `Tab`/`Shift+Tab` cycle only through the dialog's own focusable elements — reaching
  the last wraps to the first and vice versa. This is `DialogHost`'s job, shared by
  both dialog kinds, not reimplemented per kind.
- `Escape` resolves the open dialog as a cancellation and dispatches no command:
  `'cancel'` for `ConfirmDialog`, `{ action: 'cancel' }` for `DeleteReferenceDialog`.
  This is the same meaning slice 6 already gives `Escape` — abandon the current
  transient interaction, commit nothing — extended from "an in-progress tool gesture"
  to "an open dialog." Neither slice 6 nor PRD §39's shortcut list assigns explicit
  ownership of a document-level `Escape` listener; this slice's assumption is that
  `DialogHost` owns it exactly while a dialog is open, and yields it back the instant
  one is not.
- On close (either resolution path), focus returns to the element captured before
  open. A dialog that resolves without restoring focus strands a keyboard user outside
  the document they were editing — this is treated as a defect, not a nicety.

### Two dialog kinds

**`ConfirmDialog`** — binary confirm/cancel, for actions where a single "are you sure"
question is the whole story:

```typescript
type ConfirmDialogResult = 'confirm' | 'cancel';
```

`title`, `message`, optional `confirmLabel`/`cancelLabel` overrides, and an optional
`danger` flag that styles the confirm button as destructive (for an action that is
irreversible but carries no reference-integrity question — e.g. discarding an unsaved
edit). Which Inspector actions from PRD §39's list (Edit, Duplicate, Delete, Link Note,
Create Work Package, Add Cost, Add Task) actually route through `ConfirmDialog` is
slice 17's decision, not this one; this slice only guarantees the dialog exists for
whichever of them need it.

**`DeleteReferenceDialog`** — modeled as a genuinely distinct kind, not a `ConfirmDialog`
variant, because it has four mutually exclusive outcomes, not two, and the caller needs
to distinguish all four:

```typescript
type DeleteReferenceDialogResult =
  | { action: 'cancel' }
  | { action: 'remove-references' }
  | { action: 'reassign' }
  | { action: 'delete-anyway' };
```

It takes an entity label (e.g. the Zone's display name) and an arbitrary-length list of
`{ label, count }` reference rows — supplied entirely by the caller, rendered exactly
as given:

```text
Delete "Kitchen"?

Referenced by:
Requirements: 2

[ Cancel ]  [ Remove References ]  [ Reassign ]  [ Delete Anyway ]
```

The component does not recompute, reformat, sum, or filter the rows it is handed — its
entire job is display plus resolving one of four button clicks to the matching
discriminated result. It does not special-case an empty `references` array either (a
caller with zero references decides for itself whether to skip this dialog kind
entirely, route through `ConfirmDialog` instead, or skip confirmation altogether — see
the worked example below).

**Reassign has no target picker here.** PRD §64 names "Reassign" as one of the four
actions but does not specify what picking a reassignment target looks like — a
zone-picker, an asset-picker, something else, and whether it is a second screen or a
follow-up dialog. `DeleteReferenceDialog`'s result signals only *that* the user chose
Reassign; it carries no target field. Sourcing and validating a target is left as a
follow-up step for whichever of slice 8/10's commands needs it — an explicit gap this
slice does not close, since neither the SDD nor the PRD says what that follow-up looks
like.

### Worked example: Inspector Delete on a Zone

```text
Inspector "Delete" button (slice 6 Inspector action, PRD §39)
  ↓
CountRequirementsReferencing({ kind: 'zone', zoneId })   — slice 10's QUERY, not its
                                                            repository: presentation
                                                            never holds a repository
                                                            handle (§58, §59)
  ↓
count === 0?
  yes → caller's choice: dispatch the delete command directly, or confirm via
        ConfirmDialog — this slice does not decide which (see Out of scope)
  no  → dialogStore.openDialog({
          kind: 'delete-reference',
          entityLabel: zone.name,
          references: [{ label: 'Requirements', count }],
        })
  ↓
await result
  ↓
switch (result.action) { cancel | remove-references | reassign | delete-anyway }
  → the chosen resolution is passed INTO slice 8's zone-delete command as data;
    this slice's contract is satisfied the moment the switch above receives a value
```

The count this dialog displays is for the user's benefit, and the dialog's answer is an
input to the command — not a substitute for the command's own check. Slice 10's delete
commands re-verify references and refuse a bare delete that would orphan referents
(§87 rule 5), because a script or a migration never opens a dialog. Two checks, two
different jobs: this one informs a decision, that one enforces an invariant.

PRD §64's own example lists four reference categories — Work Packages, Tasks, Cost
Items, Documents. At the build stage slices 1–10 reach, only `Requirement` exists as an
entity that can reference a `Zone`; Work Package, Task, and Document arrive in later,
unsliced feature epics (see `docs/design/README.md`, "Explicitly deferred"). The worked
example's actual dialog therefore shows one row, `Requirements: N`, not the PRD's
illustrative four. `DeleteReferenceDialog`'s `references` field is an arbitrary-length
array precisely so each later epic's slice adds its own row (`Work Packages: N`,
`Tasks: N`, ...) without changing this dialog's shape or contract.

The identical shape applies to Asset deletion: slice 10's `DeleteAssetCommand` queries
`requirementRepository.listByAsset(assetId)` and opens the same
`DeleteReferenceDialog` kind with a different `entityLabel` and count — nothing about
the dialog changes between the Zone and Asset cases; only the caller and the query do.

### Modal stacking rule: one at a time, enforced structurally

`openDialog()` throws if `DialogStore.current` is already set — it does not queue a
second descriptor behind the first, and it does not stack a new dialog visually on top
of an open one. PRD §64 states "silent cascading delete should be avoided"; a second
confirmation dialog opening on top of a first one is the same failure mode in a
different shape — it invites a user to click through a stack without reading either.
One blocking dialog per interaction keeps a "delete anyway" click a deliberate act.

This is a programmer-facing invariant, not a user-facing state: a well-behaved caller
never has two dialogs to open at once, because the control that would open a second one
(e.g. the Inspector's Delete button) is not reachable while the first dialog holds
focus and `inert`s the background. If a genuine follow-up dialog is needed later (for
instance, a Reassign target picker after this dialog resolves), it opens only after
`DialogStore.current` has been cleared by the first dialog's resolution — sequential,
never nested, and the same store enforces that ordering by construction rather than by
convention.

## Interfaces & Contracts

```typescript
// presentation/dialogs/dialog-store.ts

// Every user-facing field below is a RESOLVED string, not a StringKey: a dialog's
// title and message are usually built from a specific entity's name ("Delete
// \"Kitchen\"?"), so the caller — which knows both the key and the entity — resolves
// through t() before opening. What must not happen is a literal default inside this
// module: `confirmLabel ?? 'Confirm'` would be an untranslated string in the one
// component every confirmation in the plugin flows through. The defaults are
// StringKeys the host resolves, not English.
interface ConfirmDescriptor {
  kind: 'confirm';
  title: string;
  message: string;
  confirmLabel?: string;   // default: t(lang, 'dialog.confirm')
  cancelLabel?: string;    // default: t(lang, 'dialog.cancel')
  danger?: boolean;        // style the confirm action as destructive
}

interface DeleteReferenceDescriptor {
  kind: 'delete-reference';
  entityLabel: string;
  // `label` is resolved copy ("Requirements"), supplied by the caller from its own
  // StringKey — this dialog renders rows, it does not name entity types.
  references: readonly { label: string; count: number }[];
}

type DialogDescriptor = ConfirmDescriptor | DeleteReferenceDescriptor;

type ConfirmDialogResult = 'confirm' | 'cancel';

type DeleteReferenceDialogResult =
  | { action: 'cancel' }
  | { action: 'remove-references' }
  | { action: 'reassign' }
  | { action: 'delete-anyway' };

// The result type is DERIVED from the descriptor's kind, not supplied by the caller.
// A free `openDialog<TResult>(d: DialogDescriptor<TResult>)` would leave TResult
// unconstrained by the descriptor — `openDialog<DeleteReferenceDialogResult>({ kind:
// 'confirm', ... })` would type-check and then resolve with the string 'cancel',
// which the caller's `result.action` switch would read as undefined. Keying the map
// on `kind` is what makes the pairing a checked contract rather than a convention.
interface DialogResultByKind {
  confirm: ConfirmDialogResult;
  'delete-reference': DeleteReferenceDialogResult;
}
type DialogResultFor<D extends DialogDescriptor> = DialogResultByKind[D['kind']];

interface DialogStore {
  readonly current: DialogDescriptor | null;
  openDialog<D extends DialogDescriptor>(descriptor: D): Promise<DialogResultFor<D>>;
  // Called only by the active dialog component's own button handlers — never by an
  // external caller, which only ever sees the Promise openDialog returned.
  resolve(result: DialogResultByKind[DialogDescriptor['kind']]): void;
}
```

```typescript
// presentation/dialogs/DialogHost.vue
// Mounted once per ItemView-scoped Vue app — which means the Plan Editor's (slice 5)
// AND the Renovation Project view's (slice 1, given content by slice 14), not the Plan
// Editor's alone: slice 14's "Create a project" empty-state action opens a dialog from
// the Renovation Project view, and a DialogHost that only ever mounted alongside a
// PlanCanvas would leave that click with nothing to open.
//
// Deliberately NOT plugin-global, unlike slice 13's NotificationHost. A dialog blocks
// interaction with the view that raised it and must trap focus within that view's own
// content; a toast reports something that may have nothing to do with any open view.
// One DialogStore per view also makes the one-at-a-time rule below mean "one per view,"
// which is the correct scope — two Plan Editor tabs can legitimately each have a dialog.
//
// Switches on dialogStore.current?.kind and renders ConfirmDialog.vue or
// DeleteReferenceDialog.vue; owns the focus-trap, inert-background, and Escape
// wiring shared by both kinds so neither dialog component reimplements it.
```

```typescript
// Worked example call site — presentation/editor/inspector/ (slice 6's Inspector
// action; the query is slice 10's; the command dispatched per branch is slice 8's).
// Note what is NOT here: no repository. The Inspector reads through a query, exactly
// as §59 and slice 6 require, and dispatches through the command dispatcher.
async function onInspectorDeleteZone(
  zoneId: ZoneId,
  zoneName: string,
): Promise<void> {
  const counted = await countRequirementsReferencing({ kind: 'zone', zoneId }); // slice 10
  if (isErr(counted)) return surfaceError(counted.error); // slice 17 decides the surface

  const result: DeleteReferenceDialogResult =
    counted.value === 0
      ? { action: 'delete-anyway' } // or route through ConfirmDialog — caller's choice
      : await dialogStore.openDialog({
          kind: 'delete-reference',
          entityLabel: zoneName,
          references: [{ label: 'Requirements', count: counted.value }],
        });

  if (result.action === 'cancel') return;

  // Every non-cancel branch dispatches — the resolution is the command's input, not a
  // note the UI keeps to itself. `reassignTo` is sourced by the caller for the reassign
  // case (slice 15's dialog deliberately carries no target; see "Reassign has no target
  // picker here"), which is the one branch needing a step beyond this dispatch.
  const reassignTo =
    result.action === 'reassign' ? await pickReassignTarget(zoneId) : undefined;
  if (result.action === 'reassign' && reassignTo === undefined) return; // target picker cancelled

  await commandDispatcher.run(
    reversibleDeleteZone({ zoneId, resolution: result.action, reassignTo }),
  );
  // What each resolution does to the referencing Requirements is slice 10's table.
}
```

The `switch` this example previously ended on is worth calling out as a shape to avoid:
three non-cancel cases falling through to a shared `break` reads as handled, and is
indistinguishable from three buttons that do nothing. If a branch has no dispatch, the
dialog offering it is offering a no-op.

File layout (SDD §7.5 names "dialogs" as presentation-layer content, distinct from
"editor tools" and "inspector panels"; §77's tree does not draw it, so it is a sibling
of `presentation/editor/` rather than nested inside it):

```text
presentation/dialogs/
├── dialog-store.ts
├── DialogHost.vue
├── ConfirmDialog.vue
└── DeleteReferenceDialog.vue
```

## Persistence Impact

None. `DialogStore` holds only which dialog descriptor is currently open and the
in-flight Promise's resolver — ephemeral Pinia state per ADR-005, analogous to SDD
§15's "context menu" entry on the ephemeral-state list (no such entry names dialogs
explicitly; this slice's assumption is that a dialog belongs on that list for the same
reason a context menu does — neither is ever written to the Vault, and losing either
on a crash or reload loses no project data). Nothing under `presentation/dialogs/`
calls a repository or a command dispatcher directly.

Persistence happens only downstream of a resolved dialog, entirely inside whichever
command the caller dispatches in response (slice 8's zone-delete command, slice 10's
`DeleteAssetCommand`, or any future caller of `ConfirmDialog`) — this slice's
contract ends at the typed result, before any write occurs.

## Testing Strategy

- **`DialogStore` unit tests** — `openDialog` resolves with exactly the value passed to
  `resolve()`; calling `openDialog` while `current` is already set throws (assert the
  specific error, not just "it throws" — the instrument being tested is the guard
  itself); after a dialog resolves, `current` is cleared and a subsequent `openDialog`
  call succeeds immediately, not on some later tick.
- **`ConfirmDialog` component test** (Vue Test Utils + jsdom, per SDD §73's explicit
  "dialogs" test target) — opening it moves focus inside the dialog; `Tab` from the
  last focusable element cycles to the first; `Escape` resolves `'cancel'` and returns
  focus to the element that was focused before open.
- **`DeleteReferenceDialog` component test** — given `references: [{ label:
  'Requirements', count: 2 }]`, the rendered output shows that row and no other; given
  a longer array, every row renders, in the order supplied — proving the component
  never recomputes or reorders what it is handed. Each of the four buttons, clicked
  independently, resolves the awaited Promise with the matching discriminated result
  exactly once (a double-click must not resolve twice).
- **Focus-restoration test** for both kinds — focus a known element, open a dialog,
  resolve it via each of its possible outcomes, and assert focus is back on the
  original element every time, not just on the cancel path.
- **Architecture/contract test** (extends slice 12's suite) — `no-restricted-imports`
  (or an equivalent import-boundary check) asserts nothing under
  `presentation/dialogs/` imports a repository, a query, an application command, or the
  event bus; this slice's dialogs are display-and-resolve only, and a future edit that starts
  querying a repository from inside `DeleteReferenceDialog.vue` fails the build rather
  than passing review by accident.
- **Worked-example integration test** — a fixture Zone with two fixture Requirements
  referencing it drives `onInspectorDeleteZone`; assert the dialog that opens carries
  `references: [{ label: 'Requirements', count: 2 }]` sourced from a fake
  `CountRequirementsReferencing` double, and that choosing each of the four actions
  resolves the awaited call with the corresponding value — the test stops at the
  resolved value and does not assert what slice 8's command does with it.

## Definition of Done

1. `openDialog(descriptor)` returns a Promise that resolves exactly once, with
   the typed value the dialog component itself passed to `resolve()`.
2. Pressing `Escape` while any dialog is open resolves it as a cancellation
   (`'cancel'` / `{ action: 'cancel' }`) and dispatches no command — asserted directly,
   not inferred from the absence of a spy call.
3. Focus moves into the dialog on open and back to the pre-open element on close, on
   every resolution path (not only cancel), verified by a component test.
4. `Tab`/`Shift+Tab` cycle only within the open dialog's focusable elements; background
   content is `inert` (or `aria-hidden`) while a dialog is open.
5. `DeleteReferenceDialog` renders an arbitrary-length `references` array exactly as
   supplied — no recomputation, no invented default rows when the caller supplies only
   one.
6. Opening the delete dialog on a Zone referenced by 2 Requirements shows exactly
   `Requirements: 2`, sourced from slice 10's `CountRequirementsReferencing` query —
   verified by an integration test asserting the value passed into the dialog
   descriptor, not a value this slice's component recomputed.
7. Calling `openDialog` while a dialog is already open throws, rather than silently
   stacking or queueing a second one — the modal-stacking rule is enforced by
   `DialogStore`, checked by a unit test, not left to caller discipline.
8. No file under `presentation/dialogs/` imports a repository, a query, an application
   command, or the event bus — enforced by the same import-boundary lint mechanism slice
   12 already runs, not by convention alone.
9. No user-facing English literal appears under `presentation/dialogs/`, including the
   `confirmLabel`/`cancelLabel` defaults; both dialog kinds' fixed copy lives in
   `presentation/i18n/locales/` like every other string in the plugin.
10. Each of `DeleteReferenceDialog`'s four buttons resolves the open Promise with its
    own distinct discriminated result exactly once; no button click leaves the Promise
    pending or resolves it twice.

## References

- PRD §64 Deletion Semantics — the Cancel/Remove-References/Reassign/Delete-Anyway
  pattern `DeleteReferenceDialog` models, and the "silent cascading delete should be
  avoided" principle behind the modal-stacking rule.
- PRD §39 User Experience Requirements — the Inspector actions list (Edit, Duplicate,
  Delete, Link Note, Create Work Package, Add Cost, Add Task) some of which route
  through these dialogs, and the required keyboard-shortcut list naming `Escape`.
- SDD §7.5 Presentation Layer — "dialogs" named as its own presentation-layer content,
  distinct from editor tools and inspector panels.
- SDD §14 State Management — the Pinia store list this slice's `DialogStore` extends
  beyond, the same way slice 6 already extended it.
- SDD §15 Persistent vs Ephemeral State — the ephemeral-state catalogue
  `DialogStore`'s contents are treated as falling under (by analogy to "context menu,"
  not by an explicit "dialog" entry).
- SDD §29 Command Architecture — named here only to distinguish `DialogStore.resolve`
  (a UI-local settle, not a domain command) from the commands a dialog's result feeds.
- SDD §73 Vue Component Tests — explicitly names "dialogs" as a covered test target.
- SDD §85 Accessibility — keyboard-accessible controls and visible focus, the source
  of this slice's focus-trap and focus-restoration requirements.
- ADR-004 Vue 3 for Plugin UI.
- ADR-005 Pinia for Presentation State — `DialogStore` as non-canonical UI state.
- `docs/design/README.md` — slice map, shared conventions, and the `§N`/`PRD §N`
  disambiguation this document follows.
- `docs/design/05-canvas-rendering-and-editor-shell.md` — the Pinia store scaffolding
  pattern (`defineStore`, one app instance per Plan Editor view) this slice follows.
- `docs/design/06-editor-tool-framework-undo-redo-and-inspector.md` — the Inspector
  action pipeline this slice's worked example attaches to, and the `Escape`-cancels-
  the-current-transient-interaction convention this slice extends to dialogs.
- `docs/design/08-zone-editing.md` — "Deletion & reference-integrity checking" section
  (explicitly deferred there to slice 10) and the zone-delete command that dispatches
  after this dialog resolves.
- `docs/design/10-assets-requirements-and-the-end-to-end-loop.md` — "Deletion &
  reference integrity" section naming `requirementRepository.listByZone`/`listByAsset`
  and `DeleteAssetCommand`, whose flow this slice's dialog renders without
  recomputing.
