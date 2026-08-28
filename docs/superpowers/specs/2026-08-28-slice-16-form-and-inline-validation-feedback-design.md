# Design slice 16 — Form & inline validation feedback

**Date:** 2026-08-28
**Slice document:** [`docs/tasks/16-form-and-inline-validation-feedback.md`](../../tasks/16-form-and-inline-validation-feedback.md)
**Baseline:** `main` at `3b51509` (slice 18 merged).
Coverage floors in force: statements 99, functions 99, lines 99, branches 98
(`vitest.config.ts`). Re-measure with `npm run test:coverage` before relying on any figure
here; branches has roughly two covered branches of headroom.

**Built in parallel with design slice 13** (notifications and save-state surfaces,
`docs/superpowers/specs/2026-08-28-slice-13-notifications-and-save-state-design.md`, PR #21).
The two are siblings under *Shared UI vocabulary*; the slice map states 13-16 do not depend on
one another, and together they are the last two things standing between the tree and slice 17.
Each names the other so a reader arriving from either side finds it.

**They meet at exactly one door, and it does not move.** Slice 13's design lists
`notifyError(error: AppError)` as existing and unchanged — it stays the `AppError` door whose
contract is that the caller holds an error rather than text. That is what this slice's
Inspector path relies on when a banner-routed error falls back to a notice, because the
Inspector has no banner region. Slice 13 adds `notifySuccess` / `notifyWarning` and gives
`notify` a severity; this slice calls none of them, and neither slice changes what the other
depends on. Which errors reach a field versus a toast at all remains slice 17's decision, and
both documents defer to it rather than deciding it early.

## Purpose

Slice 6 fixed the Inspector's dispatch side — one field commit is one `UndoableCommand` run
through `CommandHistory.run()` exactly once, and a failed `Result` pushes nothing to the undo
stack. It left open what the **field** does at that moment. This slice answers that, with one
reusable vocabulary shared by an Inspector editing an existing entity and a dialog creating a
new one.

The slice document is the specification and remains so. Brainstorming on 2026-08-28 settled
its four open decisions, found three claims elsewhere in the repository that do not survive
contact with the code, and ran one spike whose answer is recorded below. Where this document
and the slice document disagree, **this document is the later measurement**.

## The four decisions

### 1. The creation form is a Project, not an Asset

The slice document's worked example and its Definition of Done item 1 name a "New Asset" form
dispatching `CreateAssetCommand`. That is superseded, for two reasons that are about the
entity rather than about this slice:

- **Slice 19 reshapes `Asset`.** It loses `projectId` and moves to a vault-level library
  folder. A form built against today's shape is rebuilt there.
- **Nothing selects an Asset.** Slice 19's own document records the gap — `DeleteAssetCommand`
  exists and nothing anywhere selects an Asset for a user to act on. There is no surface from
  which a "New Asset" affordance would be reached.

`CreateProjectCommand` is the better subject on the merits, not merely the available one: it
yields all three routing shapes this slice must prove, from one command.

### 2. The form exposes five fields

`name`, `status`, `description`, `start`, `targetCompletion` — every `CreateProjectInput`
field except `budget`, `contingency` and `locationDescription`.

Money is excluded deliberately. A `Money` input needs a currency, and a `Project` cannot store
one until slice 20's `Project.currency` exists; a form that collected a currency the domain
drops would be a control that does nothing, which is the failure mode slice 14's Amendment 1
exists to refuse.

That exclusion also sidesteps a defect this slice would otherwise have to fix.
`negativeAmount` in `src/domain/project/Project.ts` raises **one** code,
`project.negative-amount`, for **both** `budget` and `contingency`; the field name appears only
in the free-text `message`, which slice 11 defines as developer English that never reaches a
user. `routeError` keys on `code`, so it cannot tell those two fields apart. **This is recorded
as a known gap, not fixed here** — whichever slice first puts a Money field on a form owns
either splitting the code per field or routing it to the banner. Naming it is the point; a
slice that quietly excluded the fields and said nothing would leave the next author to
rediscover it.

### 3. `Escape` inside a dialog cancels the dialog

Definition of Done item 2 says `Escape` on a field with a rejected commit discards the draft
and resyncs it "to the form's initial value in a creation-dialog context". That clause is
**withdrawn as unreachable**, not ticked.

`DialogHost.onKeydown` is bound to `.rp-dialog` and cancels the whole dialog, and slice 15's
rule is that the host "owns every keyboard concern, so no kind reimplements one". A field that
swallowed `Escape` would be a second keyboard owner inside slice 15's chrome, and whether
`Escape` closed the dialog would depend on state the user cannot see. Cancelling the dialog
already discards every draft, which is what the user asked for.

`Escape`-to-revert-one-field stays real in the **Inspector**, which is not inside a dialog.
The clause is narrowed to that context rather than deleted.

### 4. This slice draws the project list

Without it the slice creates something the user cannot see: `emptyStateKey` goes null the
moment a project exists, and `ViewRoot` renders nothing. One `ProjectList.vue`, a row per
`ProjectSummaryDto` from the `listProjects` query that already returns them, each row opening
that project's `Project.md`. It sits **beside** the `.rp-view-notice` for unreadable projects,
never instead of it — slice 14's rule that an empty list with `unreadable > 0` is a vault with
projects this build could not read.

## The three corrections

Each is a claim standing in the repository today that this slice makes false, or that is
already false. All three are corrected in the same change that makes them so.

1. **`ViewRoot.vue:9` and `:49` blame the missing project list on slice 17.** So does
   `CLAUDE.md`. Slice 17's task document is the eight-category error-surfacing decision table
   and never mentions a list. The list was owned by no slice. Both comments and the guide are
   corrected to name this one.
2. **`sampleProject.ts:27` and `CLAUDE.md` say slice 16's creation forms retire
   `create-sample-project`.** This slice creates a *project* — not a plan, not zones — so the
   seed is **not** retired. The claim narrows to what is true rather than being ticked.
3. **`CLAUDE.md` says "No empty state carrying a button is graded by that case or any
   other".** `renovationProject.noProjects` gains its action button here, which makes it the
   first button-carrying empty state on an accessibility-scanned surface. Slice 14's
   `content.test.ts` asserts that button's *absence* on purpose, so updating it is the
   deliberate, tested change slice 14 designed it to be — not an oversight closing quietly.

## The spike: `@vueform/vueform`, measured and refused

A form library was proposed and measured on a throwaway branch against this repository's own
`vite build`, with a five-field form using `TextElement`, `SelectElement`, `TextareaElement`
and two `DateElement`s reachable from the real entry point. Recorded here so the next author
does not repeat it.

| | Baseline | With Vueform | Delta |
|---|---|---|---|
| `main.js` | 657.09 kB | 1,318.87 kB | **+661.78 kB (+101%)** |
| gzip | 207.37 kB | 398.79 kB | +191.42 kB |
| modules transformed | 390 | 449 | +59 |

The library is larger than the entire rest of the plugin — Konva, vue-konva, Pinia, zod,
decimal.js and all of `src/` together — parsed at every Obsidian start for a dialog most
sessions never open.

From Rolldown's own `chunk.modules`: **`axios` reaches the bundle with 53 modules**, and
`moment` with one. `trix`, `lodash`, `nouislider`, `dompurify`, `country-phones` and
`popperjs` tree-shake out — tree-shaking does real work here, it just does not reach the two
that matter. An HTTP client shipped inside a plugin that carries a lint rule banning the
network globals from `infrastructure/logging/` and `application/queries/` is a marketplace
review question and a privacy-guarantee question at once.

Theming was better than feared and still a problem: the theme is driven entirely by **306
`--vf-*` custom properties**, so a remap onto Obsidian's palette is genuinely possible — but
the stylesheet is **80 kB** against this plugin's current 12.84 kB total, it declares those
properties on `:root, :before, :after, *` (a plugin writing custom properties across the whole
Obsidian document), and arriving from `node_modules` it never passes SDD §84's hard-coded
colour check, which only sees `styles/`.

Licence is MIT; that concern is closed.

**Refused.** Not on principle — on the ratio. The form is a text input, a select, a textarea
and two dates. Vueform's value is schema-driven forms with conditional logic and async data,
and its validation half is precisely what this slice already derives from typed `AppError`
codes. This project ejected `pdfjs-dist` at 1728 kB for the same reason, and that dependency
was doing something the plugin genuinely could not do itself.

**One measurement outlives the refusal:** the bundle baseline is **657.09 kB**, not the
"about 60 KB to 488 KB" `CLAUDE.md` records. That figure is stale and is corrected.

## Architecture

### The mechanism

Four modules, as the slice document specifies them.

```text
presentation/
├── components/
│   ├── FieldError.vue      message: string | null, inputId: string
│   └── FormBanner.vue      message: string | null
├── composables/
│   ├── use-field-commit.ts per-field blur-commit    (Inspector)
│   └── use-form-commit.ts  per-form submit-commit   (dialog)
└── errors/
    └── route-error.ts      routeError(error, map, toUserMessage)
```

`presentation/errors/` is a new top-level folder under `presentation/`, a sibling in the same
way `presentation/dialogs/` is — SDD §77's tree does not draw it. Slice 17's
`errorSurfacePolicy.ts` joins it later; slice 17 depends on this slice, so the directory
exists by the time it is needed.

`routeError` keys on `error.code` and never on `category`. A code **absent** from a map is the
explicit statement "this failure is not about one field" and routes to the banner — it is not
an omission to fill in later. `map`'s values are typed `keyof TInput`, so a form's error map is
checked against the real command input shape at compile time.

Both composables keep `DeepReadonly<Ref<…>>` on their returned drafts, with the Definition of
Done item 10 fixture proving that `values.value.name = …` and `v-model="values.name"` each
fail `vue-tsc`. `Readonly<Ref<T>>` is the shape that reads as read-only while permitting both
— it is shallow, so it freezes the binding and not the object, and a ref unwraps in templates.
This is the one part of the slice with a compile-time proof under it and it is cheap to keep.

### Consumer A — the Inspector's two live fields

`RequirementRow.vue`'s quantity and cost overrides are the only bound inputs in the plugin
today, and they carry both failures this slice names:

- A rejected commit becomes an Obsidian notice — `commitEdit`'s `notifyError` call in
  `runtime.ts` — anchored to nothing.
- An **unparseable** draft silently resets to "calculated": `applyQuantity` in
  `RequirementRow.vue` turns a non-finite parse into `null`, which is the reset value, and
  tells the user nothing at all.

Both adopt `useFieldCommit`. The parse failure becomes a field error rather than a silent
reset. `commitEdit` keeps `notifyError` for anything routing to the banner, because the
Inspector has no banner region — the notice door narrows rather than disappearing.

Which errors *should* reach a field at all remains slice 17's decision. This slice defines only
what happens once one has been routed here.

### Consumer B — New Project

A form is a **component**, not a new dialog kind: `FormDescriptor` already carries `component`
and `props`, so none of slice 15's five-edit extension ceremony applies. `NewProjectForm.vue`
takes its `dispatch` through `FormDescriptor.props` and never injects a view context, which
keeps it drivable from a test with a fake.

Its error map, read from `Project.create` rather than invented:

```typescript
const NewProjectErrorMap: FieldErrorMap<CreateProjectInput> = {
  'project.empty-name':          'name',
  'project.unknown-status':      'status',
  'project.target-before-start': ['start', 'targetCompletion'],
  // a PersistenceError from save() has NO entry — deliberately. It is about the
  // vault, not about a field, and routes to the banner.
};
```

That is the whole point of choosing this command: a one-field case, a genuine **two-field**
case proving the array form in a real form rather than only in a unit test, and a banner case.

**This contradicts a slice 15 docblock, and the contradiction is resolved rather than
smuggled.** `FormDialogResult`'s comment says `'submit'` means the form validated, "NOT that
anything was written… Dispatching the command is still the caller's job." Slice 16's Definition
of Done item 1 requires the dialog to **stay open** on a rejection with errors under the
fields, and `openDialog` throws if a dialog is already open, so a caller-dispatches design
cannot reopen it to show them. Therefore the form dispatches through `useFormCommit` and
resolves `'submit'` only after the write succeeded, and **slice 15's docblock is corrected in
the same edit** to say that a form kind may own its dispatch and what that costs.

### The seam this needs

`RenovationProjectDeps` carries `queries` only. It gains `commands`, mirroring
`PlanEditorCommandServices`:

- a new `presentation/views/renovationProjectCommands.ts` — under `views/` rather than beside
  `renovationProjectQueries.ts` in `read-models/`, because a command bundle is not a read
  model, and named for its view the same way `planEditorCommands.ts` is — declaring
  `RenovationProjectCommandServices` and `unavailableRenovationProjectCommands()`, the refusal
  bundle for a session whose settings could not be recovered — the same shape as
  `unavailablePlanEditorQueries` / `unavailablePlanEditorCommands`;
- `CreateProjectCommand` guarded in `src/plugin/guardedServices.ts`, so it is inside slice 11's
  boundary like every other command leaving the composition root.

The composition root already anticipates exactly this door. Its own comment on why it composes
no read side without settings names it: what it refuses is "a stack where one door (creating a
new project's folder) has no answer and every other one works."

**The refusal bundle is the honest stand-in here**, which is worth stating because slice 18's
Testing section records the opposite case: a refusal bundle handed to the browser harness
refused a *read* the fixture could answer, and two shell regions contradicted each other in
silence. Here every member is a write, and a session with unrecovered settings genuinely
cannot create a project's folder, so refusing is what production does.

## Data flow

```text
user types            → draft (component-local ref, via setField / onInput)
                        clearing that field's error as it goes
blur / enter / submit → exactly ONE command through CommandHistory.run()
                        (Inspector) or the guarded CreateProjectCommand (dialog)
failed Result         → routeError(error, map, toUserMessage)
                          ├─ 'field'  → <FieldError> under each named input;
                          │             draft KEPT; dialog stays open
                          └─ 'banner' → <FormBanner> at the top of the form
                                        (Inspector has none → notifyError)
ok Result             → dialog resolves 'submit' and closes; the project list
                        refreshes from its own query
```

Nothing here is written to Pinia. Every draft, error and pending flag is component-local
`ref`, discarded on commit, cancel or unmount, per ADR-005 and SDD §15.

## Error handling

`toUserMessage` is the only place an `AppError` becomes copy, for a field and a banner alike —
one message, produced once, shown in one of two places. A form never authors a second wording
and never a literal. New copy keys land in both `en.ts` and `de.ts`;
`tests/presentation/i18n/strings.test.ts` already requires German for every key `en.ts`
declares, and its two term rows (`Material` → `Objekt`, and `Vault` untranslated) apply to
whatever this slice adds.

Every message is bound to its raise site by a table in `toUserMessage.test.ts` copied from the
**raise sites**, never from `en.ts` — a table derived from the locale file would agree with a
typo.

## Testing strategy

Both composables return refs, so tests dereference `.value`.

- **`routeError`** — node profile, table-driven: a mapped code routes to its field with
  `toUserMessage`'s exact text; an unmapped code routes to a banner with the same text; a
  multi-field entry produces a `fields` array with more than one member. No Vue, no Obsidian.
- **`useFieldCommit` rejection** — a fake `buildCommand` resolving a failed `Result`; assert the
  draft still holds the rejected value, `error` is non-null, `history.run` was called exactly
  once. Then `onInput` a corrected value and assert **both** halves — the draft is written
  (`onInput`'s own job) and `error` clears — because a method that only cleared the error would
  satisfy the second alone. Then `onCancel` and assert the resync.
- **`useFieldCommit` success** — resolving `ok`; the draft clears and the field tracks a
  subsequently updated `canonicalValue`.
- **`useFormCommit` rejection** — `dispatch` returning
  `err({ code: 'project.empty-name' })`; `submit()` resolves `false`, `fieldErrors` holds
  `name`, the typed values survive, and the repository/event spies recorded zero calls. **Then**
  `setField('name', 'Kitchen')` and assert all three: the value is written, that entry is gone,
  and another field's entry is untouched. Order matters — asserting draft preservation after
  that call would be checking for a value just overwritten.
- **Two-field routing, end to end** — `project.target-before-start` puts an error under `start`
  **and** `targetCompletion`, driven through `useFormCommit` rather than only through
  `routeError`. This is the case the Asset example could not have proven.
- **Banner routing** — a `PersistenceError` from `save` produces a banner and no field entry.
- **`<FieldError>` / `<FormBanner>`** — jsdom: `message: null` renders no text and no
  `aria-invalid`; a non-null message renders the text **content** (not merely a class), sets
  `aria-invalid="true"` and points `aria-describedby` at the error element's id.
- **Accessibility** — `tests/harness/accessibility.test.ts` gains the New Project dialog and
  grades `renovationProject.noProjects` **with its button**, the first button-carrying empty
  state any scan has covered. It must `await flushPromises()` before scanning and assert the
  scanned subtree is non-empty, for the reason slice 14 recorded: without it the scan found
  zero elements and passed on an empty subtree, indistinguishable from a pass on a compliant
  one.
- **`ProjectList.vue`** — a row per project; a list rendered **beside** the unreadable notice,
  not instead of it.

Every rejection test asserts on the **command input** or on a spy, never on "a dialog opened" —
slice 10's rule, because a dialog opening is equally true of a caller that dispatched something
else entirely.

## Persistence impact

None. No new repository, sidecar field, schema version or migration. `CreateProjectCommand`,
its repository and `freshProjectFolder` all exist and are unchanged; this slice gives them a
caller that is not scaffolding.

## What this slice does NOT do

- It does not decide **which** error category reaches a field, a toast or a modal — slice 17.
- It does not build toasts or the save-state indicator — slice 13.
- It does not retire `create-sample-project`: that seeds a project, a plan and five zones, and
  this slice creates only a project.
- It does not add a Money field, and therefore does not fix `project.negative-amount`'s
  two-fields-one-code defect. Recorded above as a known gap with an owner.
- It does not change slice 6's transaction boundary. One gesture or one commit is still one
  command and one history entry.
