---
type: Task
parent: "[[Shared UI vocabulary]]"
order: 30
dependsOn:
  - "[[05-canvas-rendering-and-editor-shell]]"
  - "[[06-editor-tool-framework-undo-redo-and-inspector]]"
status: Active
started: 2026-08-25
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
---
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
opens, traps focus, cancels on `Escape`, and resolves with a typed result — and the
dialog KINDS built on it. The union of kinds is deliberately **open**, and where it is
extended is named in Interfaces & Contracts rather than left to be discovered: slice 14's
create-project action and slice 16's creation forms both need a kind this slice does not
build the contents of. It also walks through the delete-confirmation flow as the
framework's canonical worked example, because that flow is the reason the richer kind
exists and the clearest test of whether the boundary with slices 8/10 holds.

This slice does not compute reference counts or reassignment candidates (slices 8/10
already do), and does not decide what happens once a target is chosen (slices 8/10
again). Its contract ends at "the dialog resolved with this typed value."

**It does, however, own the *test* for which actions need one** — a correction to an
earlier draft that deferred that question to slice 17. Slice 17 is an `AppError` router:
it decides which surface a *failure* takes, and "should Duplicate ask first?" is not a
failure, has no `AppError`, and reaches none of its origins. It never mentioned the
question, and it structurally could not have answered it. Deferring a non-error decision
to an error router is how a decision ends up owned by nobody.

So: **the slice that owns an action decides whether it confirms, against the two-part
test stated here.** An action confirms if it is (a) irreversible or destructive from the
user's point of view — data they authored stops existing, or stops being reachable — or
(b) reference-bearing, meaning something else in the vault points at what it touches
(PRD §64's deletion semantics, which this slice already derives from). Everything else
dispatches directly; an "are you sure" on a reversible action trains people to click
through the ones that matter.

Worked against PRD §39's Inspector list, so the test has been exercised rather than just
asserted: **Delete** confirms under both (a) and (b) — a `DeleteReferenceDialog` when
referents exist, a `ConfirmDialog` when they do not. **Edit**, **Duplicate**, **Link
Note**, **Add Cost**, **Add Task** and **Create Work Package** confirm under neither:
each is reversible through undo (slice 6), and creating a thing is not destroying one.
The one caller outside that list is slice 7's `CalibrateTool`, which confirms under (a) —
a recalibration reinterprets every coordinate already drawn, and undo restores it, but
the user cannot see what they are about to lose before it happens.

### What landed, and what did not (2026-08-26)

The framework is complete and in use: `DialogStore`, `DialogHost`, all four kinds, the focus
trap, `Escape`, background `inert`, focus restoration, the stacking guard, the import
boundary and its meta-test. Definition of Done items 1, 2, 3, 4, 5, 7, 9, 10 and 11 are met.

**Items 8 and 8a were met by slice 10 (2026-08-26); items 6 and 6a were not.** All four are
the Zone-delete worked example, and every collaborator they name — `ListRequirementsReferencing`,
`ListReassignmentTargets`, and a `reversibleDeleteZone` taking `resolution` /
`resolvedReferents` and refusing with `reference.set-changed` — belongs to slice 10, which
was in flight while this slice was built. Declaring those shapes here would have been a
second derivation of contracts slice 10 owns, which this document's own "Out of scope"
section forbids. `DeleteReferenceDialog` and `EntityPickerDialog` were built and tested with
no production caller for the same reason: that was the plan, not dead code.

**Both have a caller now.** `presentation/editor/deleteZoneFlow.ts` is it, reached from the
Inspector's Delete button through `runtime.ts`'s `createDeleteZoneAction`. Items 8 and 8a are
covered where that flow lives: `tests/presentation/editor/deleteZoneFlow.test.ts` asserts the
decisions on the COMMAND INPUT (a zero count carries no `resolution`; every resolution carries
the exact `resolvedReferents` the row was built from; `reference.set-changed` re-asks once and
a second one is surfaced), and
`tests/presentation/editor/shell/deleteZoneWithReferences.test.ts` drives the real mounted
editor with the real `DialogHost` — which is what would catch a flow with the right logic and
a query nobody passed it.

**Item 6 stayed open, and it stayed open because it changed underneath that flow.** The
shared-catalogue amendment (§59, 2026-08-26) rewrote it after `deleteZoneFlow.ts` was built:
it now asks for referents grouped **per project**, each group carrying `projectName` and — for
any group whose name is not unique on screen — `projectPath`. `ListRequirementsReferencing`
returns a flat `readonly RequirementId[]`, so nothing downstream can build those rows. The
flow satisfies the item this document carried when it was written and not the item it carries
now, which is the honest state and not a regression in the flow.

Item **6a** is unmet for a different reason again, and it is worth separating: `t`
interpolation is not slice 10's, it is this slice's own, and it was not built because nothing
had asked for it — every string the framework itself renders is fixed text, and the first
interpolated one is item 6's row label. So it lands when item 6 does. `t(language, key)` in
`src/presentation/i18n/strings.ts` still takes two arguments; the executable example below
spells the three-argument form the row label needs, and that is a specification rather than a
description of what ships today.

**Both land in
[19 — The Asset Catalogue Leaves the Project](19-the-asset-catalogue-leaves-the-project.md)**,
because the amendment that rewrote item 6 is the one that slice implements.

**What this slice DID reach:** `CalibrateTool`, which slice 7 built and slice 8 shipped
registered nowhere. It is in `registerEditorTools` and in the toolbar now, its recalibration
confirmation is a `ConfirmDialog` and its `supplyKnownDistance` is a `form` dialog over
`KnownDistanceForm`. A user can calibrate a plan.

Note what the framework does NOT claim, because the word "modal" reads wider than it is:
`inert` takes the VIEW away from the user, never the application. This is not an Obsidian
`Modal` — nothing pushes a `Scope` and the keydown handler does not `stopPropagation()` — so
Obsidian's own keymap stays live behind an open dialog.

### What slice 19 closed (2026-08-31)

**Items 6 and 6a were met by slice 19 (2026-08-31.)** Every Definition of Done item in this
document is now met. The row mapping is `rowsFor` in
`src/presentation/editor/deleteZoneFlow.ts`, asserted in
`tests/presentation/editor/deleteZoneFlow.test.ts` — against the mapping directly, which is
what item 6 asks for — and through the mounted editor in
`tests/presentation/editor/shell/deleteZoneWithReferences.test.ts`. `t`'s third parameter
lives in `src/presentation/i18n/strings.ts`, with `tr` forwarding it, driven by
`tests/presentation/i18n/strings.test.ts` (the fill, the unmatched hole left standing, the
unchanged two-argument call, and the per-key hole parity between `de.ts` and `en.ts`).

Two corrections to the item text above rather than silent drift. The keys are
`reference.row.project` (`'{name}'`) and `reference.row.project-at-path`
(`'{name} — {path}'`), not the `entity.requirement.plural.in-project*` pair this document
spelled: the row names the project and no longer names the entity type, so
`entity.requirement.plural` had no caller left and was removed from both locales. And
`ListRequirementsReferencing` answers the groups — the flat referent set the command
compares is derived from them inside the flow, so the ambiguity decision stays the query's
and is made once.

### What the walkthrough found (2026-08-26)

`docs/tests/cases/Calibrate a Plan.md` is the procedure and carries the run. Everything
passed except the calibration gesture, which **drew nothing at all**: two clicks, then a
dialog, with no indication of which two points had been picked.
`CalibrateTool.pointerMove` was an empty method under a comment deferring the preview "until
a rendering seam exists for tool overlays" — and that seam had existed since slice 8 wired
`RenderState` into `runtime.ts`. The comment outlived its own condition, and an empty method
has no behaviour for a test to disagree with, which is how it passed every gate.

Fixed with `RenderState.measurement` and a solid two-marker segment on the interaction
layer, held from the first click through both dialogs. Written up where the code is; the
case's step 3 covers it.

One thing was recorded rather than fixed: the dialog is centred over the pane, so it can sit
on top of the segment it is asking about. It was first written up as a positioning problem —
"the fix is where every dialog in the plugin sits" — and that was wrong. No alignment escapes
a canvas that fills the pane: top-aligned covers the zone captions, bottom-aligned covers the
status bar, right-aligned still crosses about a third of the canvas and reads as an Inspector
popover. Moving the panel relocates what it hides and gives up the conventional centre.

So the rule is a CONTENT one, and it lives in `dialog-store.ts` beside the descriptors it
constrains: **a descriptor says what it is about in words and may not lean on anything behind
it being visible.** Both callers in this slice already comply — `KnownDistanceForm` prints the
measured distance and every `ConfirmDescriptor` carries its own title and message — so this
cost nothing to adopt. Slice 10's delete-with-references is the caller that will feel it, and
its own document now says so: for a delete the user's confidence comes from knowing WHICH
zone goes, which is what `entityLabel` is a required resolved string for.

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
- `EntityPickerDialog` — picks one entity from a caller-supplied candidate list,
  supplying the Reassign target `DeleteReferenceDialog` deliberately does not carry.
- The delete-confirmation flow as the canonical worked example: an Inspector "Delete"
  action opens `DeleteReferenceDialog`, which displays reference counts the caller
  already computed, and resolves to one of the four PRD §64 actions.
- The modal-stacking rule: one dialog at a time, enforced by `DialogStore` itself, with
  a stated rationale.
- **Placeholder interpolation in `t`**, because this slice is the first thing in the
  plugin that needs a user-facing string with a value inside it: the reference rows name
  a project. Every string shipped before this one is fixed text, which is why
  `t(language, key)` takes no parameters today. This slice cannot compose the label from
  fragments instead — its own call-site rule is that a COMPLETE label is resolved through
  `t()`, since word order and punctuation around an interpolated name are the
  translator's to choose — so the row label and the interpolation arrive together or
  neither does. See *Interpolation* under Interfaces & Contracts.

### Out of scope (covered by other slices)

- The reference-counting query itself (slice 10's `ListRequirementsReferencing`) and
  the reassignment-candidate query (`ListReassignmentTargets`) — both slice 10. This
  slice renders whatever count or candidate list it is given; nothing under
  `presentation/dialogs/` calls a query, let alone a repository, and no dialog applies
  an eligibility rule of its own.
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
  `ListRequirementsReferencing` query that supplies this dialog's rows, and the
  "Deletion & reference integrity" section that names the
  Cancel/Remove-References/Reassign/Delete-Anyway flow this dialog renders and the
  command-side enforcement it does not replace.
- ADR-004 (Vue 3 for Plugin UI) — dialogs are Vue components, not raw DOM built by
  hand.
- ADR-005 (Pinia for Presentation State) — `DialogStore` is UI state, never canonical.
- PRD §64 (Deletion Semantics) and PRD §39 (User Experience Requirements) — the two
  PRD sections this slice's design derives from directly.

### Carried forward from the slice 8 review pass (2026-08-25)

The slice 8 review pass made one of this slice's preconditions real and
left one piece of wiring for it.

- **`EditorContext.activePlan.calibration` is a REAL value now**, which it was not when
  slice 7 wrote the dialog it hands to this slice. It was a hard-coded `null` behind a
  field `EditorContext` declares as the plan's calibration, so any tool reading it saw
  "uncalibrated" on every calibrated plan, with the type satisfied and no gate able to see
  it. `PlanDto` carries the field now and the tool context is rebuilt per activation.
  Note what this does and does not change: slice 7's confirmation triggers on the plan
  already having **spatial objects**, not on it already having a calibration, so the
  TRIGGER is unaffected. What the real value buys is the dialog's CONTENT — a
  recalibration prompt can state the scale being replaced instead of describing the change
  in the abstract.
- **`CalibrateTool` is registered NOWHERE, and this slice is the natural place to finish
  it.** Slice 7 built the tool, the reversible command and the sidecar port; slice 8's
  toolbar shipped without it, so no user can calibrate a plan and every area the Inspector
  prints is background pixels relabelled as millimetres at the placeholder scale of 1.
  What is missing is two things: a row in `EditorToolbar.vue`'s `MODES` table, and a real
  `supplyKnownDistance` — a `KnownDistanceSupplier` that asks the user for the measured
  length. That prompt is a modal, which is this slice.
- **The toolbar is a DATA table now.** `MODES` is a
  `readonly { id: ToolId | null; label: StringKey }[]` rendered by one `v-for`; a new mode
  is a row, and the label key stays type-checked. It was three near-identical ten-line
  `<button>` blocks, each repeating its own id in three places.

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
// `title` and `message` are RESOLVED strings, and resolving them is the CALLER's job
// (see Interfaces & Contracts) — so the canonical example resolves them, because this
// is the example every call site will be copied from. An English literal here would
// teach the one thing `docs/requirements/Multilanguage.md` forbids, and
// I18N_LITERAL_BAN cannot catch it: its selectors see .setText() and the `text:`
// option of createEl/createDiv/createSpan, not an object property in a call argument.
const result = await dialogStore.openDialog({
  kind: 'confirm',
  title: t(lang, 'dialog.zone.duplicate.title'),
  message: t(lang, 'dialog.zone.duplicate.message'),
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

### The two dialog kinds this slice builds

Two of the four `kind`s in Interfaces & Contracts are designed and built here.
`entity-picker` is a thin list the delete flow's Reassign branch needs (worked example
below), and `form` is the container slice 16 fills — neither has design worth a section
of its own, which is precisely why both were nearly left out of the union entirely.

**`ConfirmDialog`** — binary confirm/cancel, for actions where a single "are you sure"
question is the whole story:

```typescript
type ConfirmDialogResult = 'confirm' | 'cancel';
```

`title`, `message`, optional `confirmLabel`/`cancelLabel` overrides, and an optional
`danger` flag that styles the confirm button as destructive (for an action that is
irreversible but carries no reference-integrity question — e.g. discarding an unsaved
edit). Which of PRD §39's Inspector actions route through `ConfirmDialog` is answered by
the two-part test in **Purpose** above — owned by whichever slice owns the action, and
worked through that list there. Of the seven, only Delete confirms.

One caller outside that list is already named: slice 7's `CalibrateTool` opens a
`ConfirmDialog` before recalibrating a Plan that already has geometry, since the
rescale reinterprets every existing coordinate. It is a `ConfirmDialog` rather than a
`DeleteReferenceDialog` for exactly the reason the two kinds are separate — the
question is binary and nothing is being deleted, so there are no referent rows to
enumerate.

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

**`DeleteReferenceDialog` carries no target; a second dialog supplies one.**
`DeleteReferenceDialog`'s result signals only *that* the user chose Reassign. PRD §64
never says what picking a target looks like, so this slice adds the third dialog kind
it needs:

**`EntityPickerDialog`** — `{ title, candidates: readonly { id: string; label: string }[] }`,
resolving to `{ id: string } | 'cancel'`. It renders the candidates it is handed, in the
order given, and knows nothing about Zones, Assets, projects or unit kinds — the same
display-only contract `DeleteReferenceDialog` has for its reference rows. Eligibility is
slice 10's `ListReassignmentTargets` query, because deciding which targets are legal is
a domain question and a dialog that answered it would be a second place those rules
live.

The caller opens it only when that query returns a non-empty list; with nothing eligible
it reports Reassign as unavailable rather than opening a picker whose only action is
Cancel. Two dialogs in sequence, never nested — the modal-stacking rule below holds,
because the first has resolved and cleared `DialogStore.current` before the second opens.

### Worked example: Inspector Delete on a Zone

```text
Inspector "Delete" button (slice 6 Inspector action, PRD §39)
  ↓
ListRequirementsReferencing({ kind: 'zone', zoneId })   — slice 10's QUERY, not its
                                                            repository: presentation
                                                            never holds a repository
                                                            handle (§58, §59)
  ↓
groups.length === 0?    — the query returns referents GROUPED BY PROJECT (slice 10).
                          A Zone always yields exactly one group; the shape is what lets
                          the Asset flow show a row per project. A group is never empty,
                          so zero groups means zero referents.
  yes → dispatch the delete command with NO resolution — the form slice 10's table
        makes safe: the command refuses with a ReferenceError if referents exist after
        all. Whether a plain ConfirmDialog precedes that dispatch is the caller's
        choice, which this slice does not decide (see Out of scope); what the caller
        may NOT do is turn a zero count into a resolution the user never chose
  no  → dialogStore.openDialog({
          kind: 'delete-reference',
          entityLabel: zone.name,
          references: groups.map((g) => ({
            label: <the project's name, plus its path when that name is not
                     unique among these groups — one `t()` key per form; the
                     executable example below is the spelling>,
            count: g.requirementIds.length,
          })),
        })
  ↓
await result
  ↓
switch (result.action) { cancel | remove-references | reassign | delete-anyway }
  → the chosen resolution is passed INTO slice 8's zone-delete command as data,
    together with `resolvedReferents: groups.flatMap((g) => g.requirementIds)` — the
    exact IDs that were on screen, FLATTENED: grouping is how they are shown, and the
    set consented to is their union. This slice's contract is satisfied the moment the switch above
    receives a value; carrying the IDs onward is the caller's job, not the
    dialog's (the dialog is handed rows and never learns what an ID is)
  ↓
command returns 'reference.set-changed'?
  → the set moved while the dialog was open: re-read, re-ask once against what
    exists now. A different set is a different question
```

The count this dialog displays is for the user's benefit, and the dialog's answer is an
input to the command — not a substitute for the command's own check. Slice 10's delete
commands re-verify references and refuse a bare delete that would orphan referents
(§87 rule 5), because a script or a migration never opens a dialog. Two checks, two
different jobs: this one informs a decision, that one enforces an invariant.

**The same staleness cuts both ways, and only one direction is recoverable by refusing.**
The zero branch below covers referents appearing after an empty read. The mirror case —
referents appearing after a *non-empty* read, while the dialog is open — is worse,
because the command would not refuse anything: the user's `remove-references` is valid
consent, just not for the set that now exists, so a Requirement they were never shown
gets deleted along with the ones they approved. That is why the resolution travels with
`resolvedReferents` and the command compares sets before writing (slice 10). This slice's
part is small and strictly caller-side: pass forward what was displayed, and re-ask when
told the answer no longer fits the question.

**Which is why a zero count may not become a `delete-anyway`.** The read happens before
the dialog; the command runs after it, and a Requirement can be created in between — by
another view, a Vault change, or the user's own second tab. Handing the command
`delete-anyway` because the count *was* zero converts an advisory read into consent the
user was never asked for, and consent is precisely what the re-check cannot argue with:
the one path that would have refused instead marks the new Requirement stale and strands
it. The absent-resolution form has the opposite failure mode — it refuses, and a refusal
is recoverable by asking. So the zero branch dispatches without a resolution and treats
a `ReferenceError` as the signal to open the dialog after all, which is the same
decision the non-zero branch makes, reached one round-trip later.

PRD §64's own example lists four reference categories — Work Packages, Tasks, Cost
Items, Documents. At the build stage slices 1–10 reach, only `Requirement` exists as an
entity that can reference a `Zone`; Work Package, Task, and Document arrive in later,
unsliced feature epics (see `docs/requirements/Architecture and Software Design.md`, "Explicitly deferred"). The worked
example's actual dialog therefore shows one row per referencing **project** — for a Zone
always exactly one, since a Zone belongs to one Plan and that to one Project — labelled
with the entity type *and* that project's name, not the PRD's illustrative four.
`DeleteReferenceDialog`'s `references` field is an arbitrary-length array precisely so each
later epic's slice adds its own rows (`Work Packages`, `Tasks`, …) without changing this
dialog's shape or contract.

**The row is project-qualified even in the single-row Zone case**, and that is deliberate
rather than incidental: the same rows are what an Asset deletion renders, where a shared
catalogue entry may be referenced from several projects at once (§59, amended 2026-08-26),
and a bare `Requirements: N` there would read as "in the project I am looking at". A label
shape that is only correct in the Zone case would be rebuilt the first time an Asset used it.
A project's *name* is the qualifier only while it is unique, which nothing guarantees; what
the rows fall back to when it is not is the executable example's, stated once there.

The identical shape applies to Asset deletion: slice 10's `DeleteAssetCommand` queries
`ListRequirementsReferencing({ kind: 'asset', assetId })` and opens the same
`DeleteReferenceDialog` kind with a different `entityLabel` and, usually, **more than one
row** — nothing about the dialog changes between the Zone and Asset cases; only the caller,
the query and the number of groups do.

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

// Supplies the Reassign target DeleteReferenceDialog deliberately does not carry.
// Candidates come from slice 10's ListReassignmentTargets — this dialog renders
// them in the order given and applies no eligibility rule of its own.
// Its own interface rather than a bare arm spliced onto DeleteReferenceDescriptor with
// a `|`, which is how it ended up declared-but-not-in-the-union in an earlier draft.
interface EntityPickerDescriptor {
  kind: 'entity-picker';
  title: string;
  candidates: readonly { id: string; label: string }[];
}

// A form a user fills in and submits — slice 16's creation dialogs (its "New Asset"
// form) and slice 14's "Create a project" empty-state action, which routes here. This
// slice supplies the container, the focus trap, the Escape semantics and the resolution
// Promise; it holds NO field knowledge, so the descriptor names a component rather than
// describing fields. Slice 16 owns what renders inside it and its per-form
// submit-commit; a resolved 'submit' means the form validated, not that anything was
// written — dispatching the command is still the caller's.
interface FormDescriptor {
  kind: 'form';
  title: string;
  // The Vue component slice 16 built for this form. Rendered inside the dialog's
  // content region; a form component never draws its own overlay, backdrop or trap.
  component: Component;
  props?: Readonly<Record<string, unknown>>;
}

// THE EXTENSION POINT, named because three later slices already need it and a union
// that looks closed is how a needed kind ends up rendered outside the framework. A new
// dialog kind is TWO additions and nothing else: a member here, and its result type in
// DialogResultByKind below. DialogHost switches on `kind` exhaustively, so a member
// added without a result entry fails to compile rather than falling through to a blank
// dialog. `entity-picker` was declared above and left out of this union in an earlier
// draft, which is exactly that failure with the type checker's half missing.
type DialogDescriptor =
  | ConfirmDescriptor
  | DeleteReferenceDescriptor
  | EntityPickerDescriptor
  | FormDescriptor;

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
  // The picked candidate's id, or a cancellation. An id rather than the whole
  // candidate: the caller supplied the list, so it already has the rest.
  'entity-picker': { readonly id: string } | 'cancel';
  // 'submit' means the form validated and the user confirmed — not that anything was
  // written. The payload is whatever slice 16's component emitted, typed by that
  // component rather than here, for the same reason FormDescriptor carries a component
  // and not a field list.
  form: { readonly action: 'submit'; readonly values: unknown } | 'cancel';
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
  const listed = await listRequirementsReferencing({ kind: 'zone', zoneId }); // slice 10
  if (isErr(listed)) return surfaceError(listed.error); // slice 17 decides the surface

  if (listed.value.length > 0) return askThenDelete(zoneId, zoneName, listed.value);

  // Zero referents: dispatch the ABSENT-resolution form, never `delete-anyway`. The
  // read is advisory and already stale by the time this line runs; the command's own
  // re-check is the authority, and it can only refuse a delete it was not handed
  // consent for (slice 10's resolution table, *(absent)* row).
  const deleted = await commandDispatcher.run(reversibleDeleteZone({ zoneId }));
  if (!isErr(deleted)) return;
  if (deleted.error.category !== 'Reference') return surfaceError(deleted.error);

  // Refused: a Requirement appeared between the read and the dispatch. Ask, exactly as
  // the non-empty branch would have. The referents come from the query, not from the
  // error — slice 2's `ReferenceError` names them in `message` and carries no
  // structured payload, and re-reading is what the dialog's row needs anyway.
  const relisted = await listRequirementsReferencing({ kind: 'zone', zoneId });
  if (isErr(relisted)) return surfaceError(relisted.error);
  // Came and went: report the refusal rather than open a dialog listing nothing. One
  // retry, not a loop — a second race is a report, so this cannot spin.
  if (relisted.value.length === 0) return surfaceError(deleted.error);
  return askThenDelete(zoneId, zoneName, relisted.value);
}

// `groups` rather than a flat id list: slice 10's `ListRequirementsReferencing` returns
// referents grouped by project, because a shared Asset's referents may sit in projects
// other than the one on screen (§59, amended 2026-08-26). A Zone target always yields
// exactly ONE group — a Zone belongs to one Plan, which belongs to one Project — so this
// flow renders one row as it always did; the shape is what lets the Asset flow render
// several without a second query. Dispatch still takes a FLAT set: grouping is how the
// referents are SHOWN, and the set consented to is their union.
async function askThenDelete(
  zoneId: ZoneId,
  zoneName: string,
  groups: readonly ReferencingProject[],
  isRetry = false,
): Promise<void> {
  const referents = groups.flatMap((g) => g.requirementIds);
  // The names that appear more than once, computed over the whole set before any row is
  // built. Keyed by name rather than by group so that BOTH colliding rows are qualified:
  // qualifying only the second one leaves the first reading as though it were the only
  // "Kitchen", which is worse than qualifying neither.
  const ambiguousNames = new Set(
    groups.map((g) => g.projectName).filter((name, i, all) => all.indexOf(name) !== i),
  );
  const result: DeleteReferenceDialogResult = await dialogStore.openDialog({
    kind: 'delete-reference',
    entityLabel: zoneName,
    // Resolved by the caller from its own StringKey — the dialog renders rows, it does
    // not name entity types (see ReferenceRow in Interfaces & Contracts).
    // One row per project. For a Zone that is always one row; the label carries the
    // project name so the Asset flow's several rows are distinguishable, and a count with
    // no project on it would read as "in the project I am looking at".
    //
    // A NAME does not always distinguish them. Nothing refuses a second project called
    // "Kitchen" — `Project.create` trims and rejects only an empty name — so two groups
    // can carry one name and the rows a user is deciding between become identical. The
    // path qualifies those rows and only those: always showing it would put a vault path
    // on every row of the overwhelmingly common case where the names already differ, and
    // a row is a thing to read at a glance. The qualification is therefore a property of
    // the SET on screen, not of a group, which is worth stating because it means no test
    // of a single row can establish it.
    //
    // ONE key per label with everything interpolated, never a translated fragment with a
    // name concatenated after it: word order and punctuation between the parts are the
    // translator's to choose, and `'Requirements' + ' — ' + name` takes both away. That
    // is why the qualified form is its OWN key rather than the plain key plus a suffix.
    // This file's own call-site rule is that every COMPLETE row label is resolved through
    // `t()`, and a template literal wrapping a `t()` call satisfies the letter of it
    // while breaking what it is for.
    references: groups.map((g) => ({
      label: ambiguousNames.has(g.projectName)
        ? t(lang, 'entity.requirement.plural.in-project-at', {
            project: g.projectName,
            path: g.projectPath,
          })
        : t(lang, 'entity.requirement.plural.in-project', { project: g.projectName }),
      count: g.requirementIds.length,
    })),
  });

  if (result.action === 'cancel') return;

  // Every non-cancel branch dispatches — the resolution is the command's input, not a
  // note the UI keeps to itself. Reassign is the one branch needing a step beyond this
  // dispatch: DeleteReferenceDialog carries no target, so a second dialog supplies one.
  let reassignTo: ZoneId | undefined;
  if (result.action === 'reassign') {
    const targets = await listReassignmentTargets({ kind: 'zone', zoneId }); // slice 10
    if (isErr(targets)) return surfaceError(targets.error);
    // Nothing eligible: say so, rather than opening a picker whose only action is
    // Cancel. The first dialog has already resolved, so this is sequential, not nested.
    if (targets.value.length === 0) return surfaceUnavailable('reassign.no-targets');

    const picked = await dialogStore.openDialog({
      kind: 'entity-picker',
      title: t('dialog.reassign.title'),
      candidates: targets.value,
    });
    if (picked === 'cancel') return;
    reassignTo = picked.id as ZoneId;
  }

  // `resolvedReferents` is what the user actually saw. The command re-reads the live set
  // and refuses if it moved, so a Requirement added in this window cannot be swept up by
  // a `remove-references` the user gave for a different set (slice 10, "A resolution
  // consents to a specific set of referents").
  const deleted = await commandDispatcher.run(
    reversibleDeleteZone({
      zoneId,
      resolution: result.action,
      reassignTo,
      resolvedReferents: referents,
    }),
  );
  if (!isErr(deleted)) return;

  // The set changed under the open dialog: re-read and ask again, against what exists
  // now. Bounded to one retry for the same reason the zero-referent path above is —
  // a second race is reported, not re-prompted, so this cannot spin.
  if (deleted.error.code === 'reference.set-changed' && !isRetry) {
    const relisted = await listRequirementsReferencing({ kind: 'zone', zoneId });
    if (isErr(relisted)) return surfaceError(relisted.error);
    if (relisted.value.length === 0) {
      // Every referent went away; the plain delete is now the honest operation.
      const retried = await commandDispatcher.run(reversibleDeleteZone({ zoneId }));
      if (isErr(retried)) surfaceError(retried.error);
      return;
    }
    return askThenDelete(zoneId, zoneName, relisted.value, true);
  }

  surfaceError(deleted.error);
  // What each resolution does to the referencing Requirements is slice 10's table.
}
```

The retry is deliberately a re-ask rather than a silent re-dispatch with the new set.
The user consented to a resolution over a set they were shown; a different set is a
different question, and answering it on their behalf is the exact substitution the
`resolvedReferents` check exists to prevent. Re-opening the dialog costs one click and
keeps the consent attached to what it was given for.

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

### Interpolation: `t` gains a third parameter

The shipped signature is `t(language: string, key: StringKey): string`
(`src/presentation/i18n/strings.ts`), and every string in `en.ts` today is fixed text.
The reference rows are the first strings in the plugin with a value inside them, so this
slice extends it:

```typescript
type Interpolations = Readonly<Record<string, string>>;

// `params` is optional, so every existing two-argument call is unchanged — this is an
// addition, not a migration. `tr(key, params?)` takes the same third argument and
// forwards it, since it is `t` in the app's own language and nothing more.
function t(language: string, key: StringKey, params?: Interpolations): string;

// A template names its holes as `{name}`:
//   'entity.requirement.plural.in-project':    'Requirements in {project}'
//   'entity.requirement.plural.in-project-at': 'Requirements in {project} ({path})'
```

Four rules, because each is a decision that could have gone the other way:

- **ONE pass over the template, never a `replace` per parameter.** Iterating the
  parameters means a substituted value is itself scanned by the next iteration: a project
  a user named `{path}` would have the real vault path substituted into its own name.
  A single `replace(/\{(\w+)\}/g, …)` over the template cannot do that, because it only
  ever visits the template's own text.
- **An unmatched placeholder is left standing**, rendered literally as `{project}`, not
  replaced with an empty string. Both are wrong; one is visible. A blank where a project
  name belongs is a row a user cannot read and a defect nobody reports.
- **The compiler cannot check that a key's parameters match its template.** `StringKey`
  is a union of key names and carries nothing about holes, so `t(lang, 'x.in-project')`
  with no params compiles and renders `{project}` to a user. Saying so is the honest
  sentence; what IS checkable is the *locale* half, below.
- **A locale's translation must name the same holes as `en`'s.** `de.ts` is a
  `Partial<Record<StringKey, string>>` on purpose — an incomplete locale falls back and
  is safe — but a PRESENT translation that spells `{projekt}` renders a literal brace to
  a German user and to nobody else. `tests/presentation/i18n/strings.test.ts` already
  asserts `de` translates every key `en` declares; it gains the placeholder-set
  comparison, which is a set equality over the same regex, per key.

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
- **`EntityPickerDialog` component test** — renders exactly the candidates supplied, in
  the order given, with no filtering or sorting of its own; picking one resolves
  `{ id }` for that candidate; `Escape` and the cancel control both resolve `'cancel'`.
  A candidate list this dialog reordered or filtered would be applying an eligibility
  rule that lives in slice 10.
- **Reassign sequencing test** — `DeleteReferenceDialog` resolving `'reassign'` opens
  `EntityPickerDialog` *after* the first has cleared `DialogStore.current`, never
  nested (asserted against the stacking guard, which would throw). With an empty
  candidate list, no second dialog opens at all and the caller reports unavailability.
- **Focus-restoration test** for all three kinds — focus a known element, open a dialog,
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
  `references: [{ label: t(lang, 'entity.requirement.plural.in-project', { project: 'Kitchen Refit' }), count: 2 }]`
  sourced from a fake `ListRequirementsReferencing` double **returning one
  `ReferencingProject` group** — which is what a Zone target always yields, since a Zone
  belongs to one Plan and that to one Project. Then assert that choosing each of the four
  actions resolves the awaited call with the corresponding value — the test stops at the
  resolved value and does not assert what slice 8's command does with it.
- **Grouped-rows test**, which no Zone fixture can reach: a double returning two groups
  produces **two rows**, each counting its own group. It is worth its own test precisely
  because every Zone case is single-group, so a caller that rendered `groups[0]` and ignored
  the rest would pass every other test in this file.
- **Interpolation tests** (`tests/presentation/i18n/strings.test.ts`, extending what is
  there). `t` with no third argument is byte-identical to today for every existing key —
  the addition is checked not to be a migration. A template's holes are filled from
  `params`; a hole with no matching parameter renders as its own `{name}`; and a
  parameter VALUE containing `{path}` is passed through untouched while the template's
  real `{path}` is filled from `params` — the one-pass property, which an implementation
  that iterated `replace` per parameter would fail and no other assertion here would
  notice. Plus the locale half: for every key `de` translates, its placeholder set equals
  `en`'s, which is a real gap today rather than a hypothetical — an incomplete locale is
  safe by design, a *mis-holed* one renders a brace to exactly one language's users.
- **Same-name test**, which the grouped-rows test does not reach either: a double returning
  two groups **whose `projectName` is the same string** produces two rows carrying
  `entity.requirement.plural.in-project-at` with each group's own `projectPath`, and a
  third group with a distinct name in the same set still carries the plain key. Three
  assertions, because the rule has three halves and dropping any one of them still passes
  the other two: **both** colliding rows are qualified (not just the second), the
  unaffected row is **not** qualified, and the two qualified rows differ from each other.
  It is a property of the set on screen, so the single-group fixtures above can no more
  reach it than they can reach grouping itself.

  **It cannot be driven through `onInspectorDeleteZone`**, which hard-codes the Zone query,
  `ZoneId` and `reversibleDeleteZone` — feeding it two groups would assert a Zone result
  that cannot occur. The multi-group case belongs to the **Asset** delete caller, and NO
  slice in the register specifies one. `DeleteAssetCommand` is slice 10's, but slice 10's
  in-scope Inspector work is the Requirements panel *for the selected Zone* — there is no
  surface anywhere that selects an Asset, so there is nowhere for a user to press Delete on
  one. An earlier version of this paragraph said the entry point "arrives with" the command;
  that was a pointer at a slice which does not carry it, and pointing at a wrong owner is
  worse than naming a gap, because it reads as assigned. Slice 10 records the gap on its own
  side under *Deletion & reference integrity*. So this test targets the **row-mapping**
  directly rather than a flow, and the end-to-end version is owed by whichever slice first
  gives an Asset a delete affordance. Naming that here rather than leaving a test nobody can
  write: the mapping is the part this slice owns, and it is testable today.
- **Stale-count test**, the one the zero branch exists for: a query double answering `[]`
  and a command double refusing with a `ReferenceError`. Assert on the command's *input*
  — the first dispatch carries no `resolution` — because a test that only checked "a
  dialog opened" is equally satisfied by a caller that sent `delete-anyway` straight to
  the command and opened nothing. Then assert the refusal opens the dialog with the
  re-read count, and that a re-read of `[]` surfaces the refusal instead of opening a
  dialog with an empty row.
- **Consented-set test**, the mirror of the above and the one that protects data rather
  than clarity: a query double answering one group whose `requirementIds` are `[r1, r2]`,
  then a command double returning `reference.set-changed`. Assert the first dispatch
  carried `resolvedReferents: [r1, r2]` exactly — **flattened**, since grouping is how the
  referents are shown and the consented set is their union — the IDs the dialog's row was built from, not a count and not the
  live set — then assert the dialog re-opens with the re-read set, and that the second
  dispatch carries the *new* IDs. Assert on the input again for the same reason as
  above: a caller that dropped `resolvedReferents` entirely would still open a dialog
  and still dispatch, and the deletion it silently widened is invisible from the
  outside.
- **Bounded-retry test**: a command double returning `reference.set-changed` on *every*
  dispatch. Assert the dialog opens exactly twice and the error is surfaced — the retry
  is one round, not a loop, so a permanently churning reference set cannot trap the user
  in a reopening dialog.

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
6. **Met by slice 19 (2026-08-31)** — see *What slice 19 closed* above for the two key
   names that changed.
   Opening the delete dialog on a Zone referenced by 2 Requirements shows exactly **one**
   row counting 2, its label naming the owning project through a single localized key
   per label — the plain form here, since one group's name cannot collide with another's,
   and `entity.requirement.plural.in-project-at` carrying `projectPath` for **each** row
   whose `projectName` is not unique among the groups on screen, which a separate
   row-mapping test drives with two same-named groups plus a third distinct one —
   sourced from slice 10's `ListRequirementsReferencing` query, verified by an
   integration test asserting the value passed into the dialog descriptor, not a value
   this slice's component recomputed. **One row because a Zone always yields one group.**
   That an Asset referenced from two projects renders two rows is asserted against the
   **row-mapping directly**, not through a flow: no slice in the register specifies an Asset
   delete caller — `DeleteAssetCommand` is slice 10's, but nothing anywhere selects an Asset
   for a user to delete — so the end-to-end version belongs to whichever slice first gives an
   Asset a delete affordance. The mapping test still
   earns its place here, because every Zone fixture is single-group and would pass a caller
   that read `groups[0]` alone.
6a. **Met by slice 19 (2026-08-31).**
    `t(language, key, params?)` fills `{name}` holes from `params` in a single pass over
    the template, leaves an unmatched hole standing as `{name}`, and is unchanged for
    every two-argument call that exists today. `tr` forwards the same third argument.
    `de.ts`'s translation of any key names the same holes as `en.ts`'s, asserted per key
    rather than for the two keys this slice adds — the rule is about the locale files,
    not about these labels, and a check that enumerated them would go stale on the next
    interpolated string.
7. Calling `openDialog` while a dialog is already open throws, rather than silently
   stacking or queueing a second one — the modal-stacking rule is enforced by
   `DialogStore`, checked by a unit test, not left to caller discipline.
8. A zero reference count never produces a `resolution` on the dispatched command: the
   worked example's zero branch dispatches the absent-resolution form, and a
   `ReferenceError` back from it opens the dialog rather than being reported as a failed
   delete. Asserted on the command input, so a caller that inferred `delete-anyway` from
   a count that resolved zero fails this check rather than passing it by looking right.
8a. Every dispatch carrying a `resolution` also carries `resolvedReferents` holding the
    exact IDs the dialog's row was built from — asserted on the command input. A
    `reference.set-changed` refusal re-reads and re-opens the dialog once against the
    live set, and a second such refusal is surfaced rather than re-prompted, so a
    churning reference set cannot loop the dialog.
9. No file under `presentation/dialogs/` imports a repository, a query, an application
   command, or the event bus — enforced by the same import-boundary lint mechanism slice
   12 already runs, not by convention alone.
10. No user-facing English literal appears under `presentation/dialogs/`, including the
    `confirmLabel`/`cancelLabel` defaults; both dialog kinds' fixed copy lives in
    `presentation/i18n/locales/` like every other string in the plugin. **The same
    holds at every `openDialog` CALL SITE**, wherever it lives — `title`, `message`,
    `entityLabel` and each `ReferenceRow.label` are resolved through `t()` by the
    caller, since this module resolves nothing on its own behalf. Stated as its own
    clause because the module-scoped half is the easy half: every string a user reads
    in a dialog is authored outside `presentation/dialogs/`.

    **Neither half is caught by lint, and the honest sentence is that both rest on
    review.** `I18N_LITERAL_BAN` fires at exactly four call sites — `.setText(...)` and
    the `text:` option of `.createEl`/`.createDiv`/`.createSpan` — and a descriptor's
    `title:` or `label:` property is none of them; a Vue template's interpolation is not
    either. What can be checked cheaply is the *inverse*: every `StringKey` the dialogs
    and their call sites name exists in `en.ts`, which `tests/presentation/i18n/` already
    does for the keys that exist. That catches a typo'd key, not a bypassed one. Adding
    a fifth selector for these property positions is a real option and the trigger is a
    second literal getting past review here; until then this box is ticked by reading
    the diff, and saying so is better than implying a gate that does not exist.
11. Each of `DeleteReferenceDialog`'s four buttons resolves the open Promise with its
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
- `docs/requirements/Architecture and Software Design.md` — slice map, shared conventions, and the `§N`/`PRD §N`
  disambiguation this document follows.
- `docs/tasks/05-canvas-rendering-and-editor-shell.md` — the Pinia store scaffolding
  pattern (`defineStore`, one app instance per Plan Editor view) this slice follows.
- `docs/tasks/06-editor-tool-framework-undo-redo-and-inspector.md` — the Inspector
  action pipeline this slice's worked example attaches to, and the `Escape`-cancels-
  the-current-transient-interaction convention this slice extends to dialogs.
- `docs/tasks/07-calibration.md` — "Confirming a recalibration", the one named
  `ConfirmDialog` caller outside PRD §39's Inspector-action list.
- `docs/tasks/08-zone-editing.md` — "Deletion & reference-integrity checking" section
  (explicitly deferred there to slice 10) and the zone-delete command that dispatches
  after this dialog resolves.
- `docs/tasks/10-assets-requirements-and-the-end-to-end-loop.md` — "Deletion &
  reference integrity" section naming `ListRequirementsReferencing` and
  `DeleteAssetCommand`, whose flow this slice's dialog renders without recomputing,
  and "A resolution consents to a specific set of referents", which is why this
  slice's caller carries `resolvedReferents` into the dispatch.
