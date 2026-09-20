# Task report — W10-B (AD18 item 7, and the empty Reference tab panel)

Outcome: **implemented**
Owner / worktree / branch: W10-B / `.worktrees/ad10` / `ad18-trace-checklist`
Base commit / candidate commit: `862f663b1` / **`00dff9914`**, then the fix round at `bc12d1d84` plus this report (see the fix-round section at the end; that is the candidate, not `00dff9914`)
Accepted contract revision: `r1` — rulings **AD12-R1**, **AD18-R4** (taken during the fix round: `Add details` never becomes the current step) (deletes board 02's `Lock reference` step and
only that one) and **AD18-R2** (the Inspector is tabbed `Object | Reference`, which is what makes
`DesignerReferenceStatus` the whole Reference panel and therefore what makes an empty one a defect).
Allowed scope and shared-file leases: EDIT `DesignerReferenceStatus.vue`, `styles/designer-trace.css`,
`{en,de}/designerTrace.ts`; CREATE components under `src/presentation/designer/inspector/` and test
files under `tests/`. `styles/index.css` and `{en,de}/editor.ts` were already wired by the wave base
and are untouched — verified by `git status`, which lists six paths and none of them.

## Changed files and reason

| File | Purpose | Within lease? |
|---|---|---|
| `src/presentation/designer/inspector/DesignerTraceChecklist.vue` | **New.** The five-step guide: the steps, their done-ness read off the design, the current-step rule, the `<ol>`/`<li>`/`aria-current` markup | yes (CREATE under `inspector/`) |
| `src/presentation/designer/inspector/DesignerReferenceStatus.vue` | Mounts the checklist as a SECOND root beside the `v-if` facts block, passing `pending.length`; docblock rewritten to say what the component now draws in each state | yes (EDIT) |
| `src/presentation/i18n/locales/en/designerTrace.ts` | Seven keys: five step labels, the list heading, the one hidden state word | yes (EDIT) |
| `src/presentation/i18n/locales/de/designerTrace.ts` | The German half, typed against the English keys | yes (EDIT) |
| `styles/designer-trace.css` | Block spacing, the `<ol>`, and the two state rules | yes (EDIT) |
| `tests/presentation/designer/designerTraceChecklist.test.ts` | **New.** 14 cases after the fix round: the checklist, the panel-closure, the style declarations, the `setProps` invariant and AD18-R4 | yes (CREATE under `tests/`) |
| `tests/harness/accessibilityDesignerReference.test.ts` | **New, fix round.** axe over the Reference tab with the tab actually selected, plus the instrument check that proves the scan reaches it | yes (CREATE under `tests/`) |

## What was built, and why it is five steps

Board 02 draws six: *choose image → calibrate scale → lock reference → trace footprint → add
details → verify dimensions*. **AD12-R1 deletes step 3 and only step 3** — every designer layer is
built by `designerLayerConfig` with `listening: false` and no tool in `src/presentation/designer/tools/`
moves, scales or nudges the background, so "lock reference" names a property that already holds. A
row for it would be a checklist item that is permanently ticked: the live control that does nothing,
in checklist form. The other five are AD12 card item 1's guided sequence and are not ruled out.

The count is **asserted, not described**. `designerTraceChecklist.test.ts`'s first case pins the five
KEYS in order (`STEPS`), so a sixth arriving without a ruling turns it red, and so does a reordering.
The English locale module's header states "five steps, not six" and that sentence is the one the test
holds. The three places the number is written — the locale header, the component docblock, the test —
all say five, and the test is the one that re-runs.

### Three shape decisions, and what each one refused

AD18's sequencing table records the shipped precedent for this item as **"none"**, so each is argued
rather than copied.

1. **Done-ness is READ off the design, never stored.** The alternative — remembering which step the
   user believes they are on — was refused because it is a second authority for a fact the geometry
   already answers, which is exactly the shape `GetAssetDesign`'s `dimensionsUnscaled` docblock
   refuses one layer down (it will not re-derive a stored flag from a join). A read cursor cannot go
   stale and cannot be wrong about a peer leaf's edit. It costs the ability to tick a step a user
   did without leaving a trace, and there is no such step among the five.
2. **The current step is the first one that is neither done nor OPTIONAL**, not the furthest tick
   plus one. Refused because the steps complete OUT OF ORDER: an asset typed from dimensions has a
   footprint and its measurements and no sheet at all, and a cursor derived from furthest progress
   points at `Add details` while the row actually owed is `Choose a sheet`. That exact swap is one
   of the reverts watched red below. Once no such step is left **nothing** is marked, because a
   finished sequence has no next thing to do.

   **The "nor optional" half is ruling AD18-R4**, taken during the fix round: `Add details` still
   TICKS when detail graphics exist and is skipped when choosing the cursor, so a sheet-traced asset
   finished except for details has no current step rather than reading as permanently unfinished.
   Optionality lives in the same row as the key and the condition, for the reason the row itself
   exists. The component docblock carries the ruling by name and what lost.
3. **The checklist is a SIBLING of the facts block, not a child of it.** This is what closes the
   second half of the card (below). A child would have inherited the `relevant` predicate and drawn
   nothing in the one state the panel was empty. The other candidate — deleting `relevant` so the
   facts block always draws — was refused for two reasons: a block of `None chosen` / `Not
   calibrated` rows is the noise that predicate exists to suppress and its docblock's argument for
   it is still true; and it would have reddened `designerReferencePanels.test.ts`'s *"draws nothing
   at all for an asset typed from dimensions with no sheet"*, an EXISTING test file this card does
   not hold. The sibling shape leaves that case green and correct rather than needing a lease grant.

### What the last step's name promises, and what it checks

`Verify the dimensions` is the one step whose NAME is wider than its check, and the component
docblock, the locale header and the test all say so rather than leaving the wider sentence standing.
A user's own look at the numbers is not observable from here. What IS observable is that the
footprint measures in real units (`design.dimensions !== null`) with no coordinate group left in the
sheet's own pixels (`pendingCount === 0`), which is the state that makes the numbers worth looking
at. That is what the row reports.

`pendingCount` is a PROP rather than a re-derivation: `DesignerReferenceStatus` already reads the
four pending flags once, and reading them twice is how two answers to one question start. It is a
count rather than the list because this component names no group — the four sentences naming which
ones are the facts block's job.

### The empty Reference tab panel

`DesignerInspector.vue`'s template comment recorded the gap: *"for an asset typed from dimensions
with no sheet the answer is nothing — so this panel is EMPTY in that state."* Closed by the
checklist drawing in every state. In the state that was blank it is the whole panel: five rows with
`Choose a sheet` marked current — which says what to do rather than only what is missing, and is a
better answer than the bare "there is no sheet yet" line the gap note proposed.

**That comment in `DesignerInspector.vue` is now STALE and needs correcting at integration.** That
file is not in this lease and was not opened for editing. The sentence to replace is the one
beginning *"`DesignerReferenceStatus` decides on its own whether it has anything to say"* down to
*"that file is outside this card's lease"*.

### Accessibility

Real `<ol>` of real `<li>`s, so position and total are announced by the list rather than by markup
this file invents; `aria-current="step"` on the current row. No `aria-label` on a role-less element —
that exact defect is the one the accessibility gate found on the Plan Editor. Done-ness is a
strike-through in CSS and a `data-rp-done` attribute, and **neither reaches a screen reader**, so a
finished row also carries `designer.trace.done` in a `.rp-visually-hidden` span — the existing
shared utility. **The first version of this sentence called that "its third caller" from memory and
was wrong;** `grep -rn "rp-visually-hidden" src/` prints **nine sites in nine files**, this one
included, so it is the ninth rather than the third. There is deliberately no matching word for a step still to do: an
unmarked checklist item already reads as undone, and a "to do" word would put a second announcement
on every row with nothing to announce.

The two CSS state rules carry a cue that is **not a colour** — a strike on the finished rows, a
weight on the current one — so the states survive a colour-blind reader. That is pinned as a
DECLARATION by the last two cases; see "Verification not performed" for what that claim is not.

## Acceptance coverage

| Criterion/test ID | Result | Exact evidence | Remaining issue |
|---|---|---|---|
| AD18 item 7: a guided trace checklist with the current step highlighted | met | `designerTraceChecklist.test.ts` > *draws five steps in board order…* and *marks exactly one step current…* | appearance unverified (below) |
| AD12-R1: no `Lock reference` step | met | same first case — the five keys are pinned in order, so a sixth reddens it | — |
| Current step is the first one owed, including out of order | met | *ticks a step that is done out of order and still points at the first one owed* | — |
| No current step once the sequence is finished | met | *marks no step current once all five are done* | — |
| The last step waits on pending coordinate groups | met | *leaves the last step open while any coordinate group is still in sheet pixels*, and the parent-level *takes its pending count from the facts block beside it* | — |
| The Reference tab panel is no longer empty for a dimensions-typed asset with no sheet | met | *draws the guide where the panel used to draw nothing at all* — asserts BOTH halves: `.rp-designer-reference` still absent, five rows present, `Choose a sheet` current | the stale comment in `DesignerInspector.vue` |
| Heading order (axe grades it) | met | *gives the guide its own h3, after the facts block's* — both `h3`, deliberately the same level because the facts block is the one that disappears | — |
| Done/current distinguished by more than colour | met, as a DECLARATION only | *distinguishes … by something other than colour* (×2) | legibility unverifiable here |
| AD18-R4: `Add details` ticks but never becomes current | met | *never makes the optional Add details the current step (AD18-R4)*, and the `setProps` case whose middle state is that same design | — |
| The new ARIA is graded by axe, with the tab selected | met | `accessibilityDesignerReference.test.ts`: 3 passed, including the planted-violation instrument check | jsdom grades no contrast, focus ring or hit size |
| Existing behaviour unchanged | met | `designerReferencePanels` / `designerReferenceView` / `designerInspectorTabs` / `designerInspector` / `regionsReachable`: 84 passed | — |

## Watched failing first — verbatim

Every invariant asserted above was reverted, run, seen red, and restored. Four reverts, output
copied verbatim from the runs.

**1. The checklist removed from `DesignerReferenceStatus.vue`** (the panel-closure claim):

```
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  |suite| tests/presentation/designer/designerTraceChecklist.test.ts > the Reference tab panel > draws the guide where the panel used to draw nothing at all
AssertionError: expected [] to have a length of 5 but got +0
 FAIL  |suite| tests/presentation/designer/designerTraceChecklist.test.ts > the Reference tab panel > takes its pending count from the facts block beside it
AssertionError: expected undefined to be 'false' // Object.is equality
 FAIL  |suite| tests/presentation/designer/designerTraceChecklist.test.ts > the Reference tab panel > gives the guide its own h3, after the facts block’s
AssertionError: expected [ 'Reference' ] to deeply equal [ 'Reference', 'Tracing steps' ]
      Tests  3 failed | 9 passed (12)
```

**2. `current` changed from "first not done" to "count of done"** (the out-of-order claim):

```
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  |suite| tests/presentation/designer/designerTraceChecklist.test.ts > the guided trace checklist > marks exactly one step current, and it is the first step not done
AssertionError: expected [ 'Add details' ] to deeply equal [ 'Calibrate the scale' ]
 FAIL  |suite| tests/presentation/designer/designerTraceChecklist.test.ts > the guided trace checklist > ticks a step that is done out of order and still points at the first one owed
AssertionError: expected [ 'Trace the footprint' ] to deeply equal [ 'Choose a sheet' ]
 FAIL  |suite| tests/presentation/designer/designerTraceChecklist.test.ts > the Reference tab panel > draws the guide where the panel used to draw nothing at all
AssertionError: expected [ 'Trace the footprint' ] to deeply equal [ 'Choose a sheet' ]
      Tests  3 failed | 9 passed (12)
```

**3. A sixth step inserted, and the hidden `Done` word suppressed** (the count claim and the
announcement claim, together):

```
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 6 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  |suite| tests/presentation/designer/designerTraceChecklist.test.ts > the guided trace checklist > draws five steps in board order, and no Lock reference step (AD12-R1)
AssertionError: expected [ 'Choose a sheet', …(5) ] to deeply equal [ 'Choose a sheet', …(4) ]
 FAIL  |suite| tests/presentation/designer/designerTraceChecklist.test.ts > the guided trace checklist > marks no step current once all five are done
AssertionError: expected <li …(3)></li> to be null
 FAIL  |suite| tests/presentation/designer/designerTraceChecklist.test.ts > the guided trace checklist > leaves the last step open while any coordinate group is still in sheet pixels
AssertionError: expected null to be 'step' // Object.is equality
 FAIL  |suite| tests/presentation/designer/designerTraceChecklist.test.ts > the guided trace checklist > announces a finished step and says nothing extra about an unfinished one
AssertionError: expected undefined to be 'Done' // Object.is equality
 FAIL  |suite| tests/presentation/designer/designerTraceChecklist.test.ts > the guided trace checklist > is an ordered list of list items, not labelled divs
AssertionError: expected [ 'LI', 'LI', 'LI', 'LI', 'LI', 'LI' ] to deeply equal [ 'LI', 'LI', 'LI', 'LI', 'LI' ]
 FAIL  |suite| tests/presentation/designer/designerTraceChecklist.test.ts > the Reference tab panel > draws the guide where the panel used to draw nothing at all
AssertionError: expected [ Array(6) ] to have a length of 5 but got 6
      Tests  6 failed | 6 passed (12)
```

**4. `text-decoration` and `font-weight` deleted from the partial** (the not-colour-alone claim):

```
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  |suite| tests/presentation/designer/designerTraceChecklist.test.ts > what the trace partial declares > distinguishes .rp-designer-trace-step[data-rp-done="true"] by something other than colour
 FAIL  |suite| tests/presentation/designer/designerTraceChecklist.test.ts > what the trace partial declares > distinguishes .rp-designer-trace-step[aria-current="step"] by something other than colour
AssertionError: expected [] to have a length of 1 but got +0
      Tests  2 failed | 10 passed (12)
```

`git diff --stat` after the last restore confirmed the tree was back to the candidate's content.

## Executed checks

| Command or manual action | Commit / environment | Exit code or observed result | Evidence |
|---|---|---|---|
| `npx vue-tsc -noEmit` | candidate, win32 | 0 | `TSC OK`. It type-checks `src/**` AND `tests/**`, so the new test file is checked against the real types — it caught a hand-spelled `Calibration` missing four fields, which is why the file imports `CALIBRATION` from `tests/helpers/assetDesignHarness.ts` instead of minting a third copy |
| `npx oxlint --deny-warnings <6 changed paths>` | candidate | 0 | `OXLINT OK` |
| `npx eslint --max-warnings 0 <6 changed paths>` | candidate | 0 | `ESLINT OK`. This is the run that applies `obsidianmd/ui/sentence-case-locale-module` to `en/designerTrace.ts` — the rule `tests/build/localeModuleSentenceCase.test.ts` exists to prove is configured |
| `npx vitest run tests/presentation/designer/designerTraceChecklist.test.ts` | candidate | 0 | `Test Files 1 passed (1) / Tests 12 passed (12)` |
| Four revert-and-watch runs | patched trees, restored | 3 / 3 / 6 / 2 failed | verbatim above |
| `npx vitest run designerReferencePanels designerReferenceView designerInspectorTabs regionsReachable designerInspector` | candidate | 0 | `Test Files 5 passed (5) / Tests 84 passed (84)` |
| `npx vitest run accessibilityDesignerSelection accessibilitySidePanels assetDesignerRoot designerStyles` | candidate | 0 | `Test Files 4 passed (4) / Tests 41 passed (41)` — axe-core over the real mounted designer surfaces, with the new list in the tree |
| `npx vitest run tests/build/styles.test.ts tests/presentation/i18n/strings.test.ts` | candidate | 0 | `Test Files 2 passed (2) / Tests 104 passed (104)` — the assembler's partial cap, its `@import` resolution and SDD §84's colour check over `designer-trace.css` (66 lines, well under 400) |
| Narrow coverage run, `--coverage.reportsDirectory` pointed at the scratchpad | candidate | per-file reading below | never wrote to `coverage/`, so nothing contended with the integrator's gate |

### Per-file coverage for the changed files

Read out of `coverage-final.json` for the changed files, which is the instrument that can see ONE
arm; the threshold cannot. Collected from `designerTraceChecklist` + `designerReferencePanels` +
`designerReferenceView` + `designerInspectorTabs` only, so these are a LOWER BOUND on what the full
suite measures — a narrower run can only miss arms, never invent them.

| File | Statements | Functions | Branch arms |
|---|---|---|---|
| `DesignerTraceChecklist.vue` | 13/13 | 4/4 | **10/10** |
| `DesignerReferenceStatus.vue` | 25/25 | 8/8 | 26/26 |
| `en/designerTrace.ts` | 1/1 | — | — |
| `de/designerTrace.ts` | 1/1 | — | — |

**All ten new branch arms are covered.** They are: the three `&&` short-circuits in the `steps`
computed (`shape !== null && shape.details.length > 0`, `dimensions !== null && pendingCount === 0`,
and AD18-R4's `!step.done && !step.optional`), the `aria-current` ternary, and the `v-if` on the
hidden `Done` span — each two arms. The figure was **8/8** before the fix round added the ruling. The card's
warning that "a five-step checklist with a current-step highlight is a lot of new branches" is the
reason the component is written the way it is: the step table is built as `{ key, done }` PAIRS with
no parallel indexing and no per-step `v-if`, and `:data-rp-done="step.done"` renders `"true"`/`"false"`
rather than branching. Net effect on the repository's ~16 arms of branch margin: **zero uncovered
arms added**. Nothing was removed, so no margin was recovered either.

## Verification not performed

Named rather than left blank. Nothing below was skipped for convenience; each is either outside this
worktree's reach or explicitly the integrator's.

- **`npm run check`, `npm run test:coverage`, `npm run analyze`** — forbidden by the card; they are
  the integrator's, run serially on a shared box. So: the repository-wide coverage thresholds
  (99/99/99/98), `eslint .` over the whole tree, the full `vite build`, and fallow's dead-file,
  duplication, complexity and dependency passes have **not** been run on this candidate. The
  per-file coverage above is the narrower instrument I could run without touching `coverage/`.
- **A full unfiltered `vitest`** — forbidden. Ten test files were run (12 + 84 + 41 + 104 + the four
  revert runs). The rest of the 1065-file suite is unrun on this candidate. The files most likely to
  be affected are the ones that mount the designer or read its markup, and those are among the ten.
- **Any appearance or layout claim.** jsdom lays nothing out and there is no pinned Chromium in this
  worktree, so **nothing here is a measurement of how the checklist looks.** Specifically unverified:
  whether five rows plus a heading fit a 224 px inspector rail without pushing the pending warnings
  further below the fold (AD18-R2's whole subject was that this panel overflowed); whether the
  strike-through is legible at `--font-ui-small` against `--text-faint`; whether the weight change
  on the current row is visible enough to read as a highlight at all; whether the `<ol>` markers and
  `padding-inline-start: var(--size-4-5)` leave the labels room before they wrap; and how any of it
  looks in light vs dark or in a themed vault. The style cases pin what the rules **DECLARE**, which
  is the narrower claim `designerStyles.test.ts` makes about its own partial. **The integrator's
  in-app browser is the only instrument for all of it** — and the current-step highlight is the one
  thing the card is actually about, so it is worth a deliberate look rather than a glance.
- **`npm run harness` / `npm run harness-shot`** — not run. No pinned Chromium here; AD18's own
  report records `playwright-core` pinning revision 1234 against a cache holding 1223, and
  `npx playwright install chromium` is forbidden by the card (it emptied `node_modules` once). No
  capture was taken, so no picture of this exists.
- **`npm run test-build` and a vault** — not run; no Obsidian here. Appearance in a real vault, and
  the real `setIcon`/theme behaviour around this rail, are unverified.
- ~~**axe over a state where the checklist has a CURRENT row**~~ — **CLOSED in the fix round, and
  the original bullet understated the problem.** It said I had not confirmed which state the
  accessibility suites seed. The confirmed answer was: NONE of them grade this markup in ANY state,
  because `DesignerInspector`'s `activeTab` defaults to `'object'`, the panels are `v-show`, and axe
  skips a CSS-hidden subtree. `tests/harness/accessibilityDesignerReference.test.ts` closes it and
  demonstrates the gap rather than describing it. axe in jsdom still does not check colour contrast,
  focus visibility or hit size.
- **German copy reviewed by a German speaker** — not done. The strings are typed against the English
  keys (so none can be missing) and follow the vocabulary already in `de/assetReference.ts`, but
  nobody who reads German has read them.
- **`tests/build/localeModuleSentenceCase.test.ts`** — not run as a file (it boots ESLint and is in
  the serialised `build-lint` project). The rule it proves is configured was applied directly by the
  `npx eslint` run above, which is the same rule reaching the same file.

## Data and integration implications

Schema/migration change: **none.** Nothing is persisted. Every step's state is derived from
`AssetDesignDto` at render time, so the sidecar document and the note are byte-identical before and
after — this card adds no write path at all.
Relevant renderer/export/revision consumers: none. No command, no port, no query changed.
Undo/no-op/conflict/failure coverage: not applicable — the checklist has no control and dispatches
nothing. It re-derives from whatever `design` currently is, so a peer leaf's write, an undo and a
refresh all reach it through the same path the facts block already uses.
Identity/unit/quantity/calibration invariants: untouched. The last step READS the pending flags via a
count and the existing `dimensions`; it does not re-derive either and does not join them (the join
`GetAssetDesign`'s `dimensionsUnscaled` docblock refuses).
Shared root/runtime/locales wiring still required: **none.** `{en,de}/editor.ts` already spread
`designerTrace*` and `styles/index.css` already imports `designer-trace.css`, both from the wave
base; neither was touched. `DesignerTraceChecklist.vue` is reachable from `AssetDesignerView.ts`
through `DesignerReferenceStatus` — `regionsReachable.test.ts` passed, which is what asserts that.
Rollback/recovery considerations: reverting the commit removes the guide and restores the empty
Reference panel. No data is left behind and no user state depends on it.

## Things I believe are wrong, or worth the integrator's attention

1. **The gap comment in `DesignerInspector.vue` is now false** and that file is outside this lease.
   Named above with the exact sentence; flagged so it does not go stale, per the card's instruction.
2. **AD18's own item 7 row will need its "shipped precedent: none" reading updated** once this lands,
   because the next card that wants a progress indicator now has one.
3. **The German word `Vorlage` is overloaded, and this card did not fix it.** `de/assetReference.ts`
   translates the reference SHEET as `Vorlage`, and `de/assetSymbols.ts` and `de/assetEntryPaths.ts`
   translate a shape PRESET as `Vorlage` too — both families print from
   `grep -rn "Vorlage" src/presentation/i18n/locales/de/` (18 hits across six files, this card's own
   included). So German has one word where English has two, and a German user reading
   `Vorlage wählen` in the trace guide could reasonably think it means "pick a preset". This card's
   string takes the spelling the panel beside it already uses rather than minting a third; renaming
   either family is a change to locale modules it does not hold. **This is pre-existing and is
   reported, not half-fixed.** The German comment in `de/designerTrace.ts` records it in place.
4. **Nothing in the card is wrong.** The one thing worth saying about its framing: it asked for "a
   line inside that component saying there is no sheet yet" as the honest fix for the empty panel.
   The checklist is a strictly better answer to the same problem and made that line unnecessary, so
   no such sentence was added and no locale key exists for one. If a reviewer specifically wants the
   words "no sheet yet" present, that is a copy decision rather than a defect, and the facts block's
   existing `designer.reference.sheet.none` (`None chosen`) is the string that already says it —
   though it draws only once the block itself is relevant, which in that state it is not.

## Fix round — five items, after the independent review

Code at **`bc12d1d84`**, on top of `297179e4f`; this report sits on top of that, and its own SHA is the candidate. The review verified the central claims and found
four things; a fifth (ruling **AD18-R4**) arrived mid-round and is folded into the same commit.

### 1. axe had graded NONE of this markup — closed

The disclaimer in the original report was too kind to itself. The confirmed mechanism:
`DesignerInspector`'s `activeTab` defaults to `'object'` and the panels are `v-show`, so the
Reference panel carries `display: none` in every scan, and **axe skips a CSS-hidden subtree**. No
`accessibility*.test.ts` selects the tab. So the `<ol>`/`<li>`/`aria-current="step"`/visually-hidden
combination — the most new ARIA this card added — was outside the gate entirely.

`tests/harness/accessibilityDesignerReference.test.ts` closes it: `runOptions` shared through
`./axeOptions` (no second copy of the rules this suite cannot grade), `designerRig` for the real
designer, the tab found by its WORDS rather than by index, and the panel asserted visible and
five-rows-deep BEFORE the scan so a clean result cannot come from scanning nothing. Two states,
because they are different markup: with a sheet, and with none — the state that used to be empty.

**Its second case is the instrument check, and it demonstrates the gap rather than describing it.**
One mount, one planted violation on a checklist row, two scans: the default Object tab reports
nothing about plainly broken markup, and selecting Reference reports it. A dangling
`aria-labelledby` was tried first and is refused in the file with its measurement — axe answers
`incomplete` for a missing reference, not `violations`, so that probe would have landed in the
wrong bucket. The probe is an invalid `aria-*` attribute instead.

### 2. A `setProps` case for "read off the design, never stored"

The invariant was asserted in the docblock and checked by nothing: every case mounted fresh. The
new case drives both directions through `setProps`, which is the shape the real surface takes — the
design arrives as a NEW DTO on the same mounted tree, never as a remount, so a cursor cached at
setup would survive a peer leaf's calibration.

### 3. Two counts rewritten from a grep instead of from memory

- `.rp-visually-hidden` — **nine sites in nine files** (`grep -rn "rp-visually-hidden" src/`), mine
  the ninth. The report had said "third caller". Corrected in place above.
- The `CALIBRATION` import comment claimed it was "the one calibration this suite has, rather than a
  third hand-spelled copy". Wrong on both halves: `grep -rln "knownDistance:" tests/` prints **36
  files** that spell one of their own, `designerReferencePanels.test.ts` — which mounts the very
  component the same block mounts — among them. The comment now says what the import actually buys:
  one copy fewer, not the one definition.

### 4. Left alone, as instructed

The now-false case name in `designerReferencePanels.test.ts` and the second stale premise in
`DesignerInspector.vue` (the `tabindex="0"` paragraph justifying itself with "draws nothing at all
for an asset typed from dimensions with no sheet" — the attribute is still right, its stated reason
is dead). Both are the integrator's. The `<ol>` marker question is also untouched: `::marker` takes
Obsidian's own colour and `line-through` does not reach it, which are appearance claims for a
browser rather than guesses from here.

### 5. Ruling AD18-R4 — `Add details` never becomes the current step

Folded into the same commit. It still ticks when detail graphics exist; it is skipped when choosing
which step is current. `optional` lives in the same row as the key and the condition — a parallel
list would reintroduce the by-one-index drift the row shape exists to prevent.

**The coordinator's reading was checked against the code rather than taken, and it held on all
three points.** A sheet-traced asset finished except for details now has NO current step, which is
the all-done rule reached by another route. A typed-from-dimensions asset is UNCHANGED — image and
scale are both undone and both non-optional — and the existing out-of-order case stayed green; its
docblock now records WHY it is still correct rather than leaving a green run to imply it. The case
that pinned the old rule was re-graded, not deleted.

### Watched failing first — the fix round, verbatim

**5. The `setProps` invariant, against a component that snapshots its props at setup:**

```
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  |suite| tests/presentation/designer/designerTraceChecklist.test.ts > the guided trace checklist > re-reads the design on every change rather than remembering where the user was
AssertionError: expected [ 'Calibrate the scale' ] to deeply equal [ 'Add details' ]
      Tests  1 failed | 12 passed (13)
```

**6. The accessibility file with both `tab.click()` calls removed** — the first two cases go red on
the visibility guard placed before the scan, which is that guard doing its job, and the instrument
case goes red on the half that proves reachability:

```
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  |suite| tests/harness/accessibilityDesignerReference.test.ts > the designer’s Reference tab > reports no violations with the guide visible (sheet: true)
AssertionError: expected 'none' not to be 'none' // Object.is equality
 FAIL  |suite| tests/harness/accessibilityDesignerReference.test.ts > the designer’s Reference tab > reports no violations with the guide visible (sheet: false)
AssertionError: expected 'none' not to be 'none' // Object.is equality
 FAIL  |suite| tests/harness/accessibilityDesignerReference.test.ts > the designer’s Reference tab > grades the checklist only once the tab is selected, and not before
AssertionError: expected [] to have a length of 1 but got +0
      Tests  3 failed (3)
```

**7. The `<ol>` replaced by a `<div>` in the component** — the strongest of the seven, because it
proves the new file grades MY markup rather than only a planted attribute, and this is a real
violation no gate in this repository could see before the file existed:

```
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  |suite| tests/harness/accessibilityDesignerReference.test.ts > the designer’s Reference tab > reports no violations with the guide visible (sheet: true)
AssertionError: expected [ { id: 'listitem', …(6) } ] to deeply equal []
- Expected
+ Received
+     "helpUrl": "https://dequeuniversity.com/rules/axe/4.13/listitem?application=axeAPI",
+     "id": "listitem",
```

**8. AD18-R4, watched red BEFORE the skip existed** — the two cases that had to fail first, and the
second message names `Add details` as the current step, which is exactly what the ruling removes:

```
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  |suite| tests/presentation/designer/designerTraceChecklist.test.ts > the guided trace checklist > never makes the optional Add details the current step (AD18-R4)
AssertionError: expected <li …(3)></li> to be null
 FAIL  |suite| tests/presentation/designer/designerTraceChecklist.test.ts > the guided trace checklist > re-reads the design on every change rather than remembering where the user was
AssertionError: expected [ 'Add details' ] to deeply equal []
      Tests  2 failed | 12 passed (14)
```

### Fix-round checks

| Command | Result |
|---|---|
| `npx vue-tsc -noEmit` | 0 |
| `npx oxlint --deny-warnings` over the changed files | 0 |
| `npx eslint --max-warnings 0` over the changed files | 0 |
| `npx vitest run designerTraceChecklist` | **14 passed** |
| `npx vitest run accessibilityDesignerReference` | **3 passed** |
| `npx vitest run` over the four neighbours | **55 passed** |
| narrow coverage over five files, scratchpad directory | `DesignerTraceChecklist.vue` **10/10 branch arms**, 13/13 statements, 4/4 functions; `DesignerReferenceStatus.vue` 26/26 branch |

**Still not run, unchanged from the original list**: `npm run check`, `npm run test:coverage`,
`npm run analyze`, the unfiltered suite, `harness`, `harness-shot`, `test-build`, and every
appearance claim. The new accessibility file grades ROLES, NAMES and ARIA in jsdom; it measures no
colour, no focus ring and no hit size, and it draws nothing.

## Reviewer and integrator acceptance

Reviewer outcome and findings:
Integrated commit:
Post-integration checks/evidence:
Final status: integrated / verified / blocked
