---
type: Test case
parent: "[[Smoke Test the Editor]]"
order: 55
sources:
  - PRD §39
  - PRD §44
  - PRD §90
  - PRD §100
  - SDD §12
  - SDD §65
  - SDD §66
  - SDD §85
  - SDD §91
status: Ready
---
# Create a Project

Design slice 16 in a real vault: the field-error vocabulary (`routeError`, `<FieldError>`,
`<FormBanner>`, `useFormCommit`) driven by an actual user through its first real caller,
`NewProjectForm`, mounted inside slice 15's `FormDialog` from slice 14's empty-state action
and from slice 16's own `ProjectList` header button. This file is the **canonical
procedure**; `docs/tasks/16-form-and-inline-validation-feedback.md` records what the runs
found and points here.

Preconditions: `npm run test-build`, this folder open as a vault, the plugin enabled, and
**no** renovation projects in the vault at the start (move `Renovation/` aside and reload if
there are any left over from a previous run of `Create sample renovation project`) — steps
1–2 need the empty state's own button, not the list header's.

**Why a human still matters here.** Three things put this slice's own surface out of every
gate's reach, the same three shapes CLAUDE.md's harness section names for the rest of the
plugin:

- **A specificity fight jsdom cannot referee.** `.rp-dialog-button` (Save and Cancel both
  use it, and neither carries a `-danger` variant on this form) states the same
  `background-color` Obsidian's own `button:not(.clickable-icon)` rule already sets at
  higher specificity — `dialogs.css`'s own comment calls that redundancy "harmless by
  design," but nothing has ever looked at THIS component's two buttons in a live vault to
  confirm the claim holds rather than assumed. `.rp-empty-state__action` and
  `.rp-project-list__create` carry no colour rule of their own at all, for the same reason:
  every button this flow's own CSS touches is styled entirely by Obsidian's theme. Step 3
  is where an eye is the only instrument, and the exact class of defect to be suspicious of
  is the one Calibrate a Plan's case already found once for `.rp-dialog-button-danger` — a
  future edit giving one of these buttons its own colour without the `.rp-dialog` qualifier
  would only be caught here.
- **This is not an Obsidian `Modal`, and nothing here proves that from inside jsdom.**
  `DialogHost`'s own header states it plainly: no `Scope` is pushed anywhere in the
  framework, and `onKeydown` calls `preventDefault()` without `stopPropagation()`, so a key
  pressed inside the panel also reaches Obsidian's own keymap. Steps 9–10 are where that is
  actually exercised, the same way Calibrate a Plan's steps 17–18 exercise it for the
  calibration dialog.
- **A slow write's own visual absence of feedback is not something a fake write can
  demonstrate.** `FormDescriptor.busy` disables every control for the DURATION of a real
  vault write; the suite drives it with a `dispatch` that resolves on the next microtask,
  which proves the flag flips but not that a user watching a real save sees anything held
  still. Step 7 is where that is looked at.

## Steps

| # | Do this | It passes when | It exists to catch |
| --- | --- | --- | --- |
| 1 | With no renovation projects in the vault, open the Renovation project view (ribbon or command) | A centred panel reads "No renovation projects yet", with a "Create a project" button below the body text | The empty state's action arriving with this slice (Task 7) — `renovationProject.noProjects` had no button through design slice 14 |
| 2 | Click that button | A dialog opens, titled "New project", with labelled Name, Status, Description, Start and Target Completion controls, and Save/Cancel buttons | `DialogHost` mounting a real `FormDescriptor.component` for the first time in this plugin — every earlier `form`-kind caller was a test stub |
| 3 | Look at the Save and Cancel buttons | Both render as ordinary themed Obsidian buttons — matching the vault's own button chrome, not plain, unbordered or unstyled | See "Why a human still matters" above. jsdom never resolves `var()` to a colour, so this is the only place this claim can be confirmed for this component |
| 4 | Leave Name empty and click Save | The dialog stays open; an inline error with a non-colour glyph appears under the Name field; the field still shows its (empty) value | `project.empty-name` routes to the `name` field (Task 6's error map) and a rejected submit never closes the dialog (Task 3's `useFormCommit`) |
| 5 | Type a Start date **after** the Target Completion date and click Save | ONE inline error appears under **both** the Start and Target Completion fields together, not under either alone | The cross-field routing case: `project.target-before-start` maps to `['start', 'targetCompletion']` — a single claim about a pair, not two independent messages |
| 6 | With that error showing, correct only the Target Completion date (leave Start alone) and click Save again | Both fields' errors clear together on the next accepted submit | `setField`'s per-key clearing retires the WHOLE routed group, not just the key that was edited — asserted by unit test against `fieldErrors`; this step is the visible result in real markup |
| 7 | Type a valid Name and click Save, watching the dialog while the write is in flight | Every field, and both Save and Cancel, become visibly inert for the moment the write takes — nothing can be typed or clicked until it resolves | `FormDescriptor.busy`/`submitting`: jsdom can assert the `disabled`/`aria-disabled` attributes exist but cannot show what a held-still form actually looks like, or that a real vault write takes long enough to see it at all |
| 8 | Once the write finishes | The dialog closes, and the new project appears as a row in the list — **without** reloading Obsidian or reopening the view | Task 8's `ProjectList` re-hydrating after `onCreateProject`'s own `store.hydrate` call, over Task 5's real `CreateProjectCommand` write landing in the vault |
| 9 | Click the list header's own "Create project" button (the list is no longer empty, so this is a different button from step 1's) | The same "New project" dialog opens | Task 8's list header shares Task 7's one handler rather than opening the form a second, independently-decided way |
| 10 | Open the dialog again, type into any field, then press `Escape` | The dialog closes **entirely** — every typed value is discarded, not merely reset to blank while the dialog stays open | Confirms `docs/tasks/16-form-and-inline-validation-feedback.md`'s Definition of Done item 2 as WRITTEN — "resyncs the field... to the form's initial value in a creation-dialog context" — is not what this build does: `Escape` here is slice 15's whole-dialog cancel, the same one every other dialog kind already has, not a second, narrower Escape scoped to one field. See that task document's reconciliation note for why the clause was withdrawn rather than built |
| 11 | With the dialog open, press `Ctrl+P` | Record what happens. The command palette is EXPECTED to open on top of the dialog | The same honest scope of "modal" Calibrate a Plan's case already established for its own dialog: nothing pushes a `Scope`, so Obsidian's keymap stays live behind this one too. If this vault binds a hotkey to `Escape`, press that too — it fires alongside the dialog's own cancel |
| 12 | Dismiss the palette, then press `Escape` once more | The dialog (if it was still open) closes normally | Confirms the dialog survived the palette opening on top of it, and that focus returned somewhere `Escape` can still reach |
| 13 | Run [[Editor Walkthrough]] steps 1–2 to open a plan with zones, select a zone, and give one of the Inspector's override fields (quantity or cost) an invalid value, then blur it | An inline error, in the same visual language as the New Project form's, renders under that field | Task 9 moved these two fields onto `useFieldCommit` — this is the first time their DOM has been looked at in a live vault since that change |
| 14 | With that error showing, press `Escape` while the field has focus | The field discards the draft and resyncs to its last valid (canonical) value, and the error clears | Task 9's own `@keydown.esc.stop="…onCancel()"` wiring. Contrast with step 10: this Escape resyncs ONE FIELD because there is no dialog here to close — the two contexts' Definition of Done item 2 halves behave differently on purpose, and this is the half that IS built |
| 15 | Switch Obsidian's language to German (Settings → General → Language) and reopen the New Project dialog | Every label, both buttons, the banner (force one — see step 4) and every inline error render in German | Every string this slice added is a `StringKey` resolved through `t`/`tr`; `de.ts` answers all of them, and nothing here has ever been rendered by a gate that reads German |

## Deliberately NOT checked

- **`CreateAssetCommand`'s own worked example.** The slice's task document's Definition of
  Done was written against a "New Asset" form (`{ unitCost: -5, ... }`) that this slice
  never built — there is still no Asset creation affordance anywhere in the plugin. Item 1
  is satisfied by `NewProjectForm` and `CreateProjectCommand` instead; see
  `docs/tasks/16-form-and-inline-validation-feedback.md`'s own reconciliation note. Whoever
  builds an Asset creation dialog inherits the same vocabulary and does not need a second
  walkthrough of this mechanism, only its own.
- **The calibration form's `coincident-points` banner.** `KnownDistanceForm` is slice 7/15's,
  not this slice's, and is unconverted on purpose (see `docs/tasks/16`'s own scope notes).
  `routeError`'s banner path is proven by this case's step 4 and by the unit suite instead.
- **Colour contrast and hit-target size.** `tests/harness/accessibility.test.ts` grades
  roles, names, labels and ARIA validity, and explicitly not these two (jsdom has no
  rendering engine to measure either). This case's step 3 is a narrower, different check —
  "themed, not plain" — not a contrast measurement.
- **A vault write failure during submit.** Forcing a persistence fault by hand inside
  Obsidian is not a step anyone can follow reliably; `newProjectForm.test.ts`'s banner case
  covers it instead, with a fixture that rejects.

## Runs

| Date | Build | Outcome |
| --- | --- | --- |
| — | — | Not yet run in a vault. Every row above is an expectation derived from the design document, the task document and the code, not an observation. |

Fill this table in on the first walkthrough, and treat anything it finds as a defect of
slice 16 rather than of this case — with a test that fails without the fix, per the suite's
own rule.
