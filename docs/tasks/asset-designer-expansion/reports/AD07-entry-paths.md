# Task report — AD07, make presets, measurements and reference setup first-class entry paths

Outcome: **partially implemented** — four of the card's five implementation items in full, the
fifth (an optional descriptive height on the creation form) **DEFERRED**, refused because the
command half of it needed a lease this task never held. See *Implementation items* below and the
card's own **Amendment 1**, which records the deferral with a trigger.

**This revision answers a REQUEST CHANGES on `5e1200a2d`.** One reproducible gate failure and four
accuracy defects; all five are addressed and each is named in *Review round 1* below.

Owner / worktree / branch: AD07 worker ·
`.claude/worktrees/renovation-planner-asset-designer-bc5539/.worktrees/ad07` · `ad07-entry-paths`

Base commit: `13f82f82e` · **Reviewed candidate: `5e1200a2d`** · Fix candidate: the SECOND commit on
`ad07-entry-paths`, the one this revision of the report is committed in — a commit cannot name its own
SHA, so the handoff message carries it. (The first version of this line said `3de814edd`, which is on
no branch here; AD07 review, bookkeeping.)

Accepted contract revision: `r1`

Allowed scope and shared-file leases: the dispatch brief's list, plus **two granted at the review
round** — the new file `styles/designer-presets.css`, and the
SINGLE `@import` line for it in `styles/index.css`, which is otherwise integrator-owned and in which
nothing else was touched (`git diff styles/index.css` is one insertion). The dispatch brief states
those two are recorded in `execution/LEASES.md`; **this worktree's copy of that file, at this base,
lists no leases at all**, so the ledger entry lives in the orchestrator's tree and is not checkable
from here. LEASES.md is orchestrator-owned and was not edited. Everything else changed is
inside the dispatch list except **three existing test files** whose assertions this change
legitimately invalidates or strengthens (`backgroundPicker.test.ts`, `assetPresetForm.test.ts`,
`viewRootCreateAsset.test.ts`) — each named below with what changed and why. No file on the
must-not-touch list was edited; `presentation/designer/parts/DesignerPartsPanel.vue` was READ for its
roving-tabindex pattern and not edited. `src/presentation/views/NewAssetForm.vue`,
`src/application/commands/asset/CreateAsset.ts` and a `tests/presentation/views/newAssetHeight.test.ts`
were written and then **reverted in full**; the candidate contains none of that work, and the reason
it stays out is in Amendment 1 rather than the budget this paragraph used to cite.

## Review round 1 — every finding, and what was done about it

REQUEST CHANGES on `5e1200a2d`. Five findings; all five addressed in the single fix commit that
carries this revision of the report. Nothing was waived and no gate was weakened.

| # | Finding | What was done |
|---|---|---|
| **FIX 1** (blocking) | `tests/build/buttonFocusRing.test.ts` was **RED**. The gallery's pressed rule replaced Obsidian's own focus ring: `button:focus-visible`'s ring IS a `box-shadow` at (0,1,1), the pressed rule scores (0,3,0) and sets `box-shadow` unconditionally, so the ONE pressed button looked identical at rest and when tabbed to | `.rp-preset-choice:focus-visible` with `outline: 2px solid var(--interactive-accent)` and `outline-offset: 2px` — a different property, so it neither replaces the pressed ring nor is replaced by it. Gate watched RED then GREEN, and the rule watched red by mutation |
| **FIX 2** (blocking, one edit with FIX 1) | The ring could not go in `styles/designer.css`: that file stood at exactly 400 lines against the assembler's `MAX_LINES = 400`, so one more line fails `npm run build` | New partial `styles/designer-presets.css` holding the three gallery rules and the new ring, plus ONE `@import` line in `styles/index.css` beside `designer-parts.css`. Measured after: `designer.css` **385**, `designer-presets.css` **53** |
| **FIX 3** (blocking) | The gallery regressed the keyboard model of the `<select>` it replaced: 14 tab stops, no roving tabindex, no arrow keys | Roving tabindex with Home/End and all four arrows, following `DesignerPartsPanel.vue` rather than inventing a second pattern. Six cases, all watched red first |
| **FIX 4** | Three cases in `backgroundPicker.test.ts` still used `wrapper.find('.rp-empty-state__action')`, which now matches three buttons | All three narrowed to the background gesture BY ITS LABEL, through one `referencePath` helper |
| **FIX 5** | Four sentences that were not true: the dead `.rp-designer-entry-path` class, `CHOICES` "at module scope", "eight other callers", and the height deferral's stated reason | Class and sentence deleted; docblock reworded to what `<script setup>` actually does; count re-measured to **four**; the deferral's reason restated as a LEASE and recorded in the card's own Amendment 1 |

### FIX 1 and 2 — what the red said, and why an outline

The gate printed `AssertionError: expected [ Array(1) ] to deeply equal []`, with the received array
holding one entry: `styles/designer.css: .rp-preset-gallery .rp-preset-choice[aria-pressed="true"]`.
1 failed / 95 passed. That is `flattenedWithoutRing` saying the pressed rule takes a button's focus
indicator away and nothing gives one back — verbatim the defect `styles/asset-row.css`'s own comment
records for `.rp-al-row--on`, and exactly what `focusCascade.ts`'s `HOST_FOCUS_RING` exists to catch.

An `outline` rather than a layered `box-shadow`, which is the spelling every other control in
`styles/` uses: `box-shadow` is not additive across two separately-specified rules, so a shadow ring
would have to restate the pressed mark; `outline` is a different property and composes with it for
free, and Obsidian's global `:focus { outline: none }` at (0,1,0) loses to this rule's (0,2,0). The
selector is left UNSCOPED by `.rp-preset-gallery` on purpose — `.rp-preset-choice` is drawn nowhere
else, and an unconditional ring covers the pressed site and every unpressed button alike.

Watched both ways: the gate reproduced RED on the reviewed candidate before anything was changed, is
GREEN after, and changing the new rule's `:focus-visible` to `:hover` turns it red again naming the
new file.

### FIX 3 — the keyboard, and what the arrows were allowed to promise

`DesignerPartsPanel.vue`'s pattern, reused rather than re-derived: an id-keyed `focusedId`, a
`tabbableId` that falls back (remembered → chosen preset → first choice left) so the search dropping
a button cannot leave the gallery with no tab stop, one `@keydown` per `role="group"` div, and
`focus()` found by `data-preset` through the form's own ref so a key pressed in one group reaches a
button in another. The gallery is ONE tab stop across all four catalogue groups.

**Left/Right are taken, and Up/Down do the same thing — a decision, and here is why.** The grid is
`repeat(auto-fill, minmax(6rem, 1fr))` resolved against the dialog's width, so the column count is
a fact no code in this component has; a Left/Right that stepped a column and an Up/Down that stepped
a row would each be guessing, and would guess differently at every dialog width. The one order that
IS known is the reading order the DOM is in, so all four arrows walk that single list — Right/Down
next, Left/Up previous — and Home/End are its ends. The ends clamp rather than wrapping, which is
what the Parts panel already does. This is narrower than a true grid model and the docblock says so
rather than implying two axes that do not exist.

Six cases in `assetPresetForm.test.ts`, appended as a `the gallery's keyboard` describe block and
**watched red first**: 6 failed / 14 passed against the unmodified component, 20 / 20 after.

### FIX 4 — and what the mutation actually showed

`referencePath(wrapper)` looks the background action up by its own label and throws when no button
carries it. This fix **cannot be watched red today** and the report says so rather than claiming a
mutation it did not get: the ranking puts the reference path first in the `noBackground` state, so
the old first-match selector is *currently* correct.

What was measured instead is the reviewer's own point, confirmed: pointing the helper at
`empty.asset.no-shape.action` — i.e. pressing the WRONG button — turns exactly **one** of the four
cases red (*"opens the picker from the empty state action and stores what it returns"*, on
`expect(picker.pick).toHaveBeenCalled()`). *"does nothing when the picker is cancelled"* and *"does
nothing if the picker is unbound…"* both stayed **GREEN while pressing Set dimensions**. Those two
are the ones that would pass vacuously under a re-ranking, and naming the label is what closes it.

## Changed files and reason

| File | Purpose | Within lease? |
|---|---|---|
| `src/presentation/designer/AssetDesignerRoot.vue` | The empty state offers all three entry paths; `traceReference()` extracted so the picker gesture has one definition for its two callers | **integrator lease, granted** |
| `src/presentation/components/EmptyState.vue` | One bare `<slot name="actions" />` after the primary button | leased, **additive only** — proof below |
| `src/presentation/designer/presets/AssetPresetForm.vue` | The `<select>` becomes a searchable gallery of thumbnail buttons; the editable-geometry sentence | yes |
| `src/presentation/designer/presets/presetPreview.ts` | `presetThumbnail(preset)` — the preset at its own defaults, `null` when those do not build | yes |
| `src/presentation/i18n/locales/{en,de}/assetEntryPaths.ts` | Three strings each: the search label, the no-matches line, the editable-geometry sentence | yes |
| `styles/designer-presets.css` | **New partial.** The gallery grid, the pressed ring, the thumbnail height and the `:focus-visible` ring the pressed rule takes away | lease granted at the review |
| `styles/designer.css` | The fifteen gallery lines REMOVED again, back to 385 lines | yes |
| `styles/index.css` | ONE `@import` line for the new partial, and nothing else | lease granted at the review, one line only |
| `tests/presentation/designer/assetEntryPaths.test.ts` | **New.** The three paths, both empty states, what each path dispatches, and the `EmptyState` no-change proof | yes |
| `tests/presentation/designer/assetPresetForm.test.ts` | Four cases re-driven through the gallery, one deleted with the guard it covered, seven added | existing file, AD07's own subject |
| `tests/presentation/designer/backgroundPicker.test.ts` | One assertion NARROWED — see below | existing file, **watched red** |
| `tests/presentation/views/viewRootCreateAsset.test.ts` | The cancel case strengthened to assert the criterion it is cited for | existing file |

## What the delta actually is, against what was already there

Most of this card's acceptance criteria were already met by shipped code, so the work is the
delta and the report's job is to say which is which:

- **Already there and unchanged:** `NewAssetForm` → `CreateAsset` → `SetAssetFootprintFromDimensions`
  as a staged sequence that pre-validates everything pure, keeps the created id across a retry, and
  freezes the catalogue fields once the note exists; `editDimensions` as the ONE door both the
  inspector and the empty state take; `startFromPreset` with its `replaces` warning and a cancel
  that writes nothing; the background picker port.
- **New here:** all three entry paths offered *at the empty state* rather than one; the preset
  picker as a searchable visual gallery; the sentence saying a preset yields editable geometry.

### The empty state now offers three paths, and the selector's job did not change

`selectAssetDesignerEmptyState` still ranks `noBackground` above `noShape` and still decides
*prominence rather than access* — its own header's words. What changed is that the two paths it
does not rank are now beside the one it does, instead of only in the inspector. The ranked path is
`EmptyState`'s `actionLabel` as before; the other two are buttons in the new slot, and each calls
the very function the other state's ranked action calls (`editDimensions`, `traceReference`), so
there is one definition per gesture and a case drives both callers to the same descriptor.

The buttons carry `.rp-empty-state__action` because that class is not decoration:
`styles/empty-state.css` hangs `pointer-events: auto` and this surface's readable focus ring off it,
and an overlay's children are `pointer-events: none` otherwise. They carry
no second class — `.rp-designer-entry-path` was written as "the hook a case finds them by" and no case
ever did, so it is deleted (AD07 review, FIX 5.1). The cases find these buttons by their WORDS.
**No new CSS was needed for them.**

### `EmptyState.vue` — the lease condition, and the proof

The change is one bare `<slot name="actions" />` with no wrapper element. Two cases in
`assetEntryPaths.test.ts` are the no-change proof over an existing caller's props: a caller that
passes no slot renders one button and a panel with exactly four children (icon, heading, body,
button), and a caller with neither an action nor a slot still renders no button at all. The whole
of `tests/presentation/components` and `tests/presentation/emptyStates` was run and is green.

**Watched red**: deleting the slot line turns 9 of the 11 cases in `assetEntryPaths.test.ts` red
with `the empty state offers no path labelled …`, and leaves both `EmptyState` cases green — which
is the right split, since those two are about the component *not* changing.

### The one existing assertion this change invalidates

`backgroundPicker.test.ts`'s *"draws no background button when no picker is bound"* read
`wrapper.find('.rp-empty-state__action').exists()` to be `false`. That was the same sentence as its
title while the panel had one button, and is a different, wrong one now: the measurements and
preset paths need no port and are correctly still offered. It is narrowed to ask about the
**background gesture by its words**, plus `labels.length > 0` so it cannot pass by the panel
drawing nothing at all. Watched red against the change before it was narrowed — it was the single
failure in a 56-file, 745-case run of `tests/presentation/{designer,components,emptyStates}`.

### The preset gallery

The `<select>` with `<optgroup>`s became a search field plus one `role="group"` per catalogue
group — each with a visible `<h3>` and its own `aria-label` — holding one button per preset with an
SVG thumbnail of that preset at its default values. `aria-pressed` marks the chosen one. Search
matches on the **localised name** a user reads rather than on the catalogue id, trimmed and
case-folded; a group the search empties is dropped, and an empty result says so through a
`no-matches` line rather than drawing headings over nothing.

`choose()` lost its unknown-id guard: a `<select>`'s `change` carries a string that may name
nothing, a gallery button carries the catalogue entry it was drawn from. The case that covered that
guard is **deleted with it** — an unreachable guard costs a branch it can never pay back — and
replaced by one asserting exactly one choice is pressed.

The fourteen thumbnails are built ONCE PER FORM — `CHOICES` sits in `<script setup>`, which is the
`setup()` body, so it is rebuilt each time the dialog opens rather than once at import. What it is
not is a `computed`: a thumbnail is the preset at its own defaults, so nothing about it changes
while the user types, and the cost is fourteen `build` calls per dialog open rather than fourteen
per keystroke. (The docblock claimed module scope; AD07 review, FIX 5.2.)

## Acceptance coverage

| Criterion | Result | Exact evidence | Remaining issue |
|---|---|---|---|
| A measured 1200 × 450 mm asset can be created without a background or calibration dialog | **met** | `assetEntryPaths.test.ts` *"writes a measured rectangle from the no-background state, with no reference and no calibration"* — 1200 × 450 through the real `ReversibleAssetDesignCommands` over the in-memory vault, asserting the stored `calibration` is `null` and `footprintOrigin` is `typed`. The catalogue-side path was already covered by `newAssetForm.test.ts` *"creates the asset and, when dimensions are given, its rectangle footprint"* | — |
| Preset preview matches committed geometry and subsequent library/plan rendering | **partly met** | `assetPresetForm.test.ts` *"draws the preview from the very shape Apply commits"* — the typed values are changed first, so a build previewing the defaults while committing the typed shape fails | The **library/plan** half is a structural argument (one stored shape; `AssetMark` and `placedOutline` read it and flatten at their own tolerances), not a case that mounts either consumer. AD05 owns those two |
| Cancellation creates no orphan catalogue entry or sidecar | **met** | `viewRootCreateAsset.test.ts` *"opens nothing and creates nothing when the dialog is cancelled"* (strengthened here to assert both commands, not only the navigation); `assetEntryPaths.test.ts` *"writes nothing when the measurements dialog is cancelled"*; pre-existing `assetPresetFlow.test.ts` *"writes nothing when the dialog is cancelled"* | — |
| Invalid units/values retain the draft and explain the error; valid values are not rounded destructively | **met, pre-existing** | `assetPresetForm.test.ts` *"shows the refusal and submits nothing for a value out of range"* (the typed draft survives and the refusal is rendered); `newAssetForm.test.ts` *"accepts a fractional millimetre in either dimension"* and its refusal cases | Nothing here changed this behaviour; it is cited, not re-implemented |
| Changing a preset never silently overwrites manual edits | **met** | `assetPresetForm.test.ts` *"warns that the current design will be replaced when there is one"*; `assetPresetFlow.test.ts` *"takes the whole preset back with one undo"*; new: *"says that a preset yields editable geometry rather than kept parameters"* | A **nested confirm dialog is not available**: `openDialog` throws `DialogStackingError` while a dialog is open, so a confirm over the preset form cannot be opened at all. The warning plus a deliberate `Apply` is the confirmation, and one undo restores the previous design |
| Creation returns a real persisted asset ID and a usable designer/plan transition | **met, pre-existing** | `viewRootCreateAsset.test.ts` *"opens the designer on the asset the dialog created"* and *"opens the designer on an existing asset the dialog resolved to"* | The **plan** half of "designer/plan transition" does not exist in the product: AD01 §1 S10 records that the designer offers no *use in a plan* navigation, and AD13 owns it |

### Implementation items

1. **Offer Start from object, Start from measurements and Trace reference at the appropriate empty
   state** — done, both states, with the picker-less case handled (slice 14's Amendment 1 reaches an
   alternative exactly as it reaches a primary).
2. **Searchable visual preset choices with live previews and a small set of meaningful fields** —
   done. The fields were already a small set decided by each preset's own `fields` table and are
   unchanged.
3. **Named measured rectangle with optional descriptive height; price/category/supplier must not
   block creation** — the *named measured rectangle* half and the *price does not block* half were
   already there and are cited above. **The optional descriptive height is NOT DONE, and the reason
   this report first gave was the wrong one** (AD07 review, FIX 5.4). **The binding constraint is a
   LEASE**: `CreateAssetInput` declares no `height` field at all, so there is nowhere for the value
   to travel from the form to `Asset.create`, and `src/application/commands/asset/CreateAsset.ts` is
   not in AD07's lease — the command half needed a lease this task never held, whatever the form
   measured. The line budget is real and is a SECOND constraint on the same work rather than the one
   that decides: `NewAssetForm.vue` is at **399 counted lines against its 400-line `max-lines`
   budget** at the base commit (measured by running ESLint's own `max-lines` at `max: 1` over the
   file), a height field in this repository's field shape is 22 counted lines, and the working
   implementation that was written was **reverted in full** when `npx eslint` reported `File has too
   many lines (434)`. **The outcome is deferred to a second screen rather than lost**: `Asset.create`
   already validates a height through `checkHeight`, and the designer inspector writes one through
   the existing `SetAssetHeight` command the moment the created asset opens — which is the next
   screen this flow lands on. A user can give the object a height; they cannot give it one *at
   creation time*. The deferral and its trigger are recorded in the card's own **Amendment 1**, not
   only here.
4. **Explain that preset generation yields editable geometry; confirm replacement** — done; see the
   criterion row above for why the confirmation is the warning and not a second dialog.
5. **Keep reference import local and optional; route creation through current catalogue commands
   including recoverable failure between note and sidecar** — met by shipped code, unchanged. The
   reference path is the existing `BackgroundPicker` port over `SetAssetBackground`, offered and
   never required; creation is `CreateAsset` + `SetAssetFootprintFromDimensions` with the created id
   held across retries.

### Required verification, item by item

- **Create-from-measurements and preset flow tests, including repeated submit and cancelled
  forms** — done. Repeated submit: pre-existing `newAssetForm.test.ts` *"drops a second submit while
  the first is still in flight"* and `assetPresetFlow.test.ts` *"opens one picker for two clicks
  landing before the first dialog closes"*. Cancelled forms: three cases named in the criteria table.
- **Fault-inject partial creation and retry; verify no duplicate asset IDs or orphaned
  usable-looking objects** — covered by pre-existing `newAssetForm.test.ts` *"does not create a
  second asset when the footprint write fails and the user retries"*, which faults the footprint
  write, retries, and asserts `createAsset` was called once. **This branch added nothing here** and
  changed nothing on that path; it is cited rather than claimed as new work.
- **Usability scenario U01** — see below.

### U01, answered honestly

**No automated case can stand in for U01, and the reason is not the automation.** U01 requires
*"invoke Use in plan, place it, reopen both object and plan"*. That gesture does not exist: AD01 §1
S10 records that the designer offers no *use in a plan* navigation, and AD13 owns building it. A
scenario whose middle step is unbuilt cannot be walked by a person either, so nothing is being
substituted for.

What U01's **first and last** paragraphs ask *is* automatable and is covered: a named measured
1200 × 450 object created with category, supplier, price and reference all left alone
(`newAssetHeight`-free path: `newAssetForm.test.ts` plus `assetEntryPaths.test.ts`), and a second
creation cancelled with no orphan entry, sidecar or placement
(`viewRootCreateAsset.test.ts`, strengthened here).

What automation still cannot replace even for those halves: the scenario is about a *novice reading
the screen and knowing what to press*, which is a judgement about copy, ordering and prominence
that no case in this repository grades. The three entry paths' wording and rank are asserted as an
exact ordered list; whether that ordering helps a novice is not.

## Executed checks

All on the candidate tree, in the AD07 worktree, with `TEMP`/`TMP` pointed at `D:\tmp-claude` —
the C: volume on this machine has 0 bytes free and a child process that cannot write a temp file
fails in ways that look like a source defect.

| Command | Exit | Evidence |
|---|---|---|
| `npx vue-tsc -noEmit` | 0 | Whole program, `src/**` + `tests/**` |
| `npx oxlint --deny-warnings <changed files>` | 0 | |
| `npx eslint <changed files> --max-warnings 0` | 0 | This is the run that reported `File has too many lines (434)` at `NewAssetForm.vue` for the height field before it was reverted — a real measurement, and the SECOND constraint on that item rather than the deciding one (Amendment 1) |
| `npx vitest run tests/presentation/designer/assetEntryPaths.test.ts` | 0 | 11 of 11 |
| `npx vitest run tests/presentation/designer/assetPresetForm.test.ts` | 0 | 14 of 14 |
| `npx vitest run tests/presentation/views/viewRootCreateAsset.test.ts` | 0 | 9 of 9 |
| `npx vitest run tests/harness/accessibilityDialogs.test.ts tests/build/styles.test.ts` | 0 | 86 of 86 — the axe scan with the preset form open covers the new gallery's roles, names and heading order; `styles.test.ts` is the 400-line cap and the hard-coded-colour check over the assembled sheet |
| `npx vitest run tests/harness/accessibility.test.ts tests/presentation/emptyStates tests/presentation/components` | 0 | 7 files, 128 cases — the axe scan of the mounted asset designer, and the empty-state registry and component suites |
| `npm run check:fast -- tests/presentation/{designer,views,components,emptyStates,library}` | 0 | `oxlint --deny-warnings` over the whole tree, `vue-tsc -noEmit` over `src/**`+`tests/**`, then **145 files / 1733 cases, all passing**, 445.7s. Started before two later edits (scoping two `assetPresetForm.test.ts` preview assertions to the live preview, and merging a doubled docblock in `viewRootCreateAsset.test.ts`); **both files were re-run individually afterwards — 2 files / 23 cases, exit 0** |
| `npx vitest run tests/presentation/designer` (whole-directory re-run against the final tree) | 0 | **50 files / 669 cases**, 358.9s, started 13:11:28 — after every edit in this candidate, so it is the run that covers the final tree rather than the sweep above |

**Mutation checks, each watched red and restored** (this repository's rule is that an asserted
invariant is watched failing):

| Mutation | What went red |
|---|---|
| Delete `<slot name="actions" />` from `EmptyState.vue` | 9 of 11 in `assetEntryPaths.test.ts`, `the empty state offers no path labelled …`; both `EmptyState` no-change cases stayed green |
| `presetThumbnail` returns a preview instead of `null` on a refused build | *"answers no thumbnail for a preset whose defaults do not build"* |
| The gallery's search predicate always matches | *"narrows the gallery to what the search matches"* and *"says so when the search matches nothing"* |
| (before narrowing) AD07's change against the unmodified `backgroundPicker.test.ts` | *"draws no background button when no picker is bound"* — the one failure in the 745-case run, which is what identified it |


### Executed checks — review fix round, on the fix candidate

Same environment, same `TEMP`/`TMP` on `D:\tmp-claude`. Nothing heavier than one command at a time;
`npm run check`, `test:coverage`, `analyze`, `build`, the harness and every capture stayed unrun, per
the dispatch brief.

| Command | Exit | Evidence |
|---|---|---|
| `npx vitest run tests/build/buttonFocusRing.test.ts` (BEFORE any change) | 1 | **1 failed / 95 passed** — the reviewer's red, reproduced verbatim |
| `npx vitest run tests/build/buttonFocusRing.test.ts` (after FIX 1/2) | 0 | **96 of 96** |
| `npx vitest run tests/build/buttonSpecificity.test.ts` (run with the above) | 0 | 213 of 213 across the two files |
| `npx vitest run tests/build/focusReach.test.ts` | 0 | 66 of 66 |
| `npx vitest run tests/build/styles.test.ts` | 0 | 79 of 79. This one matters more than its name: its container-query block calls the real `assembleStyles()` over the real `styles/`, so the assembler's 400-line cap, its hard-coded-colour check and its import resolution all ran over the NEW partial |
| `npx vitest run tests/presentation/designer/assetPresetForm.test.ts` (keyboard cases, BEFORE the component change) | 1 | **6 failed / 14 passed** — every new case red, every existing one green |
| `npx vitest run tests/presentation/designer/assetPresetForm.test.ts` (after) | 0 | **20 of 20** |
| `npx vitest run tests/presentation/designer/backgroundPicker.test.ts` | 0 | 4 of 4 |
| `npx vitest run tests/presentation/designer/{assetEntryPaths,assetPresetForm,backgroundPicker,assetPresetFlow}.test.ts tests/harness/accessibilityDialogs.test.ts` | 0 | 5 files / 50 cases — the axe scan with the preset form open re-run over the roving tabindex |
| `npx vitest run tests/presentation/designer tests/harness/accessibility.test.ts` | 0 | **51 files / 719 cases**, 80.7s — the whole designer directory against the final tree |
| `npx vue-tsc -noEmit` | 0 | Whole program, `src/**` + `tests/**` |
| `npx eslint <the five changed source and test files> --max-warnings 0` | 0 | |
| `npx oxlint --deny-warnings <changed files> tests/presentation/designer/` | 0 | Not free: it caught two `unicorn(consistent-function-scoping)` errors on the new test helpers that `eslint` did not report, and they were moved to module scope |

**Mutations watched red in this round, each restored:**

| Mutation | What went red |
|---|---|
| `.rp-preset-choice:focus-visible` → `:hover` in the new partial | `buttonFocusRing.test.ts`, naming `styles/designer-presets.css: .rp-preset-gallery .rp-preset-choice[aria-pressed="true"]` |
| The six keyboard cases against the unmodified `AssetPresetForm.vue` | all six, on a missing `tabindex` and on `document.activeElement` |
| `referencePath`'s label pointed at `empty.asset.no-shape.action` | ONE of four cases — the two that would pass vacuously under a re-ranking stayed green, which is the finding rather than a failure of the fix |

### Coverage of the new code, read rather than inferred

Coverage cannot be run here (see below), so the new arms are enumerated instead:

- `presetThumbnail` — both arms: `null` by a hand-built incoherent preset through `definePreset`/
  `incoherent`, and non-null by *"answers a thumbnail for every preset the catalogue ships"*.
- `AssetPresetForm.groups` — the empty needle (every case that does not type), a matching needle,
  a needle that matches nothing, and the group-dropping filter (asserted by the `role="group"` count
  falling to one).
- `AssetPresetForm` template's `choice.thumbnail !== null` — the true arm by the fourteen-SVG count;
  **the false arm is not covered by a mounted case**, only by `presetThumbnail`'s own unit case. It
  is reachable in principle (an incoherent catalogue entry) and there is no such entry to mount.
- `AssetDesignerRoot`'s three slot `v-if`s — all four combinations of state and picker are driven
  as exact ordered label lists (four cases in the first `describe`).
- `traceReference` — the bound-picker arm and the unbound arm (the latter through
  `backgroundPicker.test.ts`'s *"does nothing if the picker is unbound by the time the click is
  handled"*, which still drives the ranked action). The **cancelled-pick arm** is covered by that
  file's *"does nothing when the picker is cancelled"*.
- `choose()` — no branches left; the guard was removed with its case.

## Verification not performed

**This list is the fix candidate's, not the reviewed candidate's — it was re-checked rather than
carried over, and it is longer in one place and shorter in another.** Shorter: the stylesheet
assembler really did run over the new partial (inside `tests/build/styles.test.ts`). Longer: a focus
ring and a keyboard model are both things that can only be judged where they are drawn, and nothing
here draws.

- **The new focus ring has never been SEEN.** jsdom resolves no `:focus-visible` and paints no
  outline, so `tests/build/buttonFocusRing.test.ts` proves the cascade and nothing proves the
  picture. Unverified: whether `outline: 2px` at `outline-offset: 2px` reads as a ring beside the
  pressed rule's own 2px inset shadow or as one 4px band, in either scheme, and whether the accent
  colour has contrast against a themed vault's button background. The same open question
  `styles/asset-row.css` records for `.rp-al-row--on:focus-visible` and leaves to an eye.
- **The keyboard was never pressed.** The six cases dispatch synthetic `keydown` events; no real
  browser, no real focus ring following the roving `tabindex`, and no screen reader. In particular
  nothing here checks that a user can TAB into the gallery and then out of it again in one press,
  which is the property a roving tabindex exists to give.
- **Real Obsidian.** No Obsidian and no vault in this environment. `npm run test-build` was not run
  and no manual case under `docs/tests/` was walked. Unverified as a result: how the three stacked
  entry-path buttons look in a themed vault, whether the gallery's default Obsidian button chrome
  reads as a *choice* rather than as an action, and the `<h3>` group headings' default spacing
  inside a dialog.
- **Browser captures.** No pinned Chromium here, and `npx playwright install chromium` is
  explicitly forbidden in this environment. `npm run harness` and `npm run harness-shot` were not
  run. **This is the check most likely to find a defect in this task**: a fourteen-thumbnail grid in
  a dialog and three stacked buttons in an overlay are both *layout*, and no layout engine in this
  repository measures layout. The 460 px narrow-leaf width in particular is unseen.
- **Coverage.** `npm run test:coverage` was not run in either round — the environment forbids it
  while other workers share the box. The floors (99/99/99/98) are unverified for this candidate, and
  the fix round ADDED arms to that unmeasured surface: `movedTo`'s six key comparisons, `tabbableId`'s
  two `??` fallbacks and two optional chains in `onKeydown`. Every one of those was planned with a
  case and is driven by the six keyboard cases — except the two optional chains (`root.value?.` and
  `?.focus()`), whose null arms are unreachable while the gallery has a button to press. They are
  copied from `DesignerPartsPanel.vue`, which carries the identical pair. The arm-by-arm reading is a
  substitute for the instrument and is weaker than it.
- **`npm run check`, `npm run build`, `npm run analyze`.** Not run, per the dispatch brief; the
  integrator runs the full gate serially on the integration SHA. So: no bundle-size figure, no
  fallow duplication/complexity/dead-code report, and no assembled-stylesheet build beyond what
  `tests/build/styles.test.ts` covers.
- **The whole suite.** Across both rounds: the five presentation directories, four `tests/build/`
  files and two harness files. Nothing outside those was executed against the fix candidate — in
  particular no `tests/infrastructure/`, no `tests/application/`, no `tests/domain/` and no
  `tests/plugin/`, none of which this change reaches.
- **Every other `tests/build/` gate.** Four were run because they judge this change
  (`buttonFocusRing`, `buttonSpecificity`, `focusReach`, `styles`). The rest of that directory —
  the lint-scope, suppression, i18n-literal and registration checks among them — was not.
- **U01 and every other scenario in ACCEPTANCE-AND-QA §2.** Not walked; U01's own blocker is
  recorded above.
- **`npm audit`.** Not run; it is its own CI job.

## Data and integration implications

**Schema/migration change:** none. No DTO, no mapper, no schema version. The reverted height work
would have carried none either — `Asset` already holds a height in note frontmatter.

**Relevant renderer/export/revision consumers:** unchanged. r1's C10 names three (the authoring
canvas, `ListAssetOutlines` → `AssetMark.vue`, and plan placement); this change writes exactly the
same `AssetShape` through exactly the same commands, so none of them sees anything new. There is no
export subsystem.

**Undo/no-op/conflict/failure coverage:** every write on this surface still joins the leaf's ONE
write chain. The measurements path is `editDimensions` → `runtime.setFootprintFromDimensions` or
`runtime.editShape`; the preset path is `runtime.applyShape`; the reference path is
`runtime.setBackground`. Nothing new dispatches, and no new door was added — the slot's buttons call
functions that already existed. One completed gesture is still one history entry
(`assetPresetFlow.test.ts` *"takes the whole preset back with one undo"*). A cancelled dialog and a
cancelled pick both dispatch nothing.

**Identity/unit/quantity/calibration invariants:** the measurements path writes a `typed` footprint
and touches no calibration — asserted. The gallery shows no measurement of its own; the thumbnails
are unit-less SVG viewBoxes over the preset's own default millimetres. No id is minted anywhere in
this change.

**Shared root/runtime/locales wiring still required:** none. `AssetDesignerRoot.vue` and both
locale modules are in this candidate. `runtime.ts`, `ports.ts` and the context are untouched.

**Rollback/recovery considerations:** reverting this candidate loses no user data — nothing here
writes a field that did not exist. It restores the `<select>` picker and the one-action empty state;
the three gestures themselves all predate it and remain reachable from the inspector.

## Integration change requests

1. ~~**`styles/index.css` — add `@import "./designer-presets.css";` for a new partial.**~~
   **GRANTED AND DONE at the AD07 review** (FIX 2). `styles/designer-presets.css` exists, holds the
   gallery rules and the focus ring, and `styles/index.css` gained the one import line beside
   `designer-parts.css`. Measured after the move: `styles/designer.css` **385 lines**,
   `styles/designer-presets.css` **53 lines**, both against the assembler's 400-line `MAX_LINES`.

2. **AD07's optional descriptive height needs a lease on `src/application/commands/asset/
   CreateAsset.ts` AND room in `src/presentation/views/NewAssetForm.vue` — both, and the lease is
   the one that decides.** `CreateAssetInput` has no `height` field, so the command half was never
   writable from this task. The form half is the second constraint: 399 counted lines against a
   400-line `max-lines`. The cheapest fix for it is to extract the numeric-field row (`FieldError` + `label` +
   `input`) that width, depth and a height would each spell identically into one small component —
   three usages would take the file from 399 to roughly 355 and leave room. That needs a NEW file
   under `src/presentation/views/` or `src/presentation/components/`, which is outside this lease.
   The command half is trivial and was measured working before the revert: `CreateAssetInput` gains
   `height?: number | null` and `CreateAssetCommand.execute` passes `input.height ?? null` into
   `Asset.create`, which already runs `checkHeight` inside the smart constructor — so the value is
   refused before the repository is reached, there is no second write, and the codes
   `asset.invalid-height`/`asset.negative-height` already exist with copy in both locales and only
   need routing to a `height` field in `NEW_ASSET_ERRORS`.

3. **The two empty-state bodies still describe TWO ways in, and there are three.** WRITTEN HERE,
   DELIBERATELY NOT IMPLEMENTED: both strings live in `src/presentation/i18n/locales/{en,de}.ts`,
   which is on this task's must-not-touch list. `empty.asset.no-shape.body` says a footprint comes
   *"from typed dimensions or from an outline traced over a spec sheet"* while a preset is now a
   third button under it; `empty.asset.no-background.body` talks only about backgrounds while two
   buttons that need no background at all sit beneath it. Exact proposed replacements, sentence-case
   and the same length class as what they replace:

   | Key | Proposed |
   |---|---|
   | `empty.asset.no-shape.body` (en) | `An asset gets its footprint from a preset shape, from typed dimensions, or from an outline traced over a spec sheet. Any of the three makes it something a plan can hold.` |
   | `empty.asset.no-shape.body` (de) | `Ein Objekt erhält seinen Umriss aus einer Vorlage, aus eingegebenen Maßen oder aus einer über ein Datenblatt gezeichneten Kontur. Alle drei machen daraus etwas, das ein Grundriss aufnehmen kann.` |
   | `empty.asset.no-background.body` (en) | `Set a photograph, drawing or datasheet as this asset’s background, then calibrate it so a traced outline comes out in real units. A preset or typed dimensions need no background at all.` |
   | `empty.asset.no-background.body` (de) | `Legen Sie ein Foto, eine Zeichnung oder ein Datenblatt als Hintergrund dieses Objekts fest und kalibrieren Sie es, damit eine gezeichnete Kontur in echten Einheiten herauskommt. Eine Vorlage oder eingegebene Maße brauchen gar keinen Hintergrund.` |

   Two things whoever takes this should check in the same edit, because neither is visible from the
   strings alone. `tests/presentation/emptyStates/content.test.ts` asserts over this registry and may
   pin length or wording. And the German keeps `Objekt` for asset and `Vorlage` for preset — the
   locale file's own comment forbids `Material`, which is a category here and not a synonym.

## Risks a reviewer should look at first

1. ~~**`styles/designer.css` at exactly its cap.**~~ Closed at the review: the gallery rules moved
   to `styles/designer-presets.css` and `designer.css` is back to **385** lines, the new partial
   **53**. AD06 gets its file back with headroom.
2. **The gallery has never been looked at.** No capture, no vault. Fourteen buttons in a grid inside
   a dialog, each with a 48 px SVG, relying on Obsidian's own default button chrome for everything
   but the pressed ring. Whether `box-shadow: 0 0 0 2px var(--interactive-accent)` reads as
   *selected* against Obsidian's own button shadow is unverified in both schemes.
3. **Three stacked buttons in an overlay panel.** `.rp-empty-state__panel` is a column flex with a
   gap, so the alternatives stack under the primary action and all three are the same visual weight.
   That is a deliberate consequence of reusing `.rp-empty-state__action` (which is what makes them
   clickable over the canvas at all) and it means the ranked path is distinguished only by ORDER.
   A designer may want the two alternatives quieter; that is a CSS change and a fourth partial line.
4. **The narrowed assertions in `backgroundPicker.test.ts`.** Read them and agree that the new
   sentences are the ones the titles always meant. One assertion was weakened in any sense at all,
   and it gained a `length > 0` guard precisely so it cannot pass vacuously; the review round then
   narrowed three FURTHER cases in that file by label (FIX 4), with the measurement showing two of
   them could have passed vacuously written down above.
5. **The deleted case in `assetPresetForm.test.ts`.** *"keeps the current preset when a change names
   no catalogue id"* is gone because the guard it covered is gone with the `<select>`. If a reviewer
   thinks the guard should have stayed, the case should come back with it.
6. **The `choice.thumbnail === null` arm draws no picture and is not mounted anywhere**, because no
   shipped preset reaches it. It is unit-covered on `presetThumbnail` and structurally reachable.
7. **The roving tabindex has never been driven by a real keyboard**, only by synthetic `keydown`
   events in jsdom. jsdom resolves no `:focus-visible` at all, so the ring FIX 1 added is checked by
   a stylesheet gate and by nothing that draws it — and whether `outline-offset: 2px` clears the
   pressed rule's own 2px shadow without the two reading as one 4px band is an eye question, the
   same one `styles/asset-row.css` records and leaves open for its own pair.
8. **The gallery's arrows move one choice per press on both axes** (FIX 3). In a browser the grid is
   two-dimensional and Up/Down will not do what a user of a true grid expects. The alternative was a
   guessed column count; a real one needs a measurement this component does not take.

## Reviewer and integrator acceptance

Reviewer outcome and findings:
Integrated commit:
Post-integration checks/evidence:
Final status: integrated / verified / blocked

Only the integrator/reviewer fills final acceptance. This worker's completion statement is not
this field.
