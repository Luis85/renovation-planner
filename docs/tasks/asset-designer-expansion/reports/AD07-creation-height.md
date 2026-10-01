# Task report — AD07-H (the optional descriptive height at creation)

Outcome: **implemented**
Owner / worktree / branch: worker · `.worktrees/ad14` · `ad07h-creation-height`
Base commit / candidate commit: `f947d8079` / **`6b6e42087`**
Accepted contract revision: `r1`
Allowed scope and shared-file leases: the Wave 6 row for AD07-H —
`application/commands/asset/CreateAsset.ts`, `presentation/views/NewAssetForm.vue`, a NEW
numeric-field-row component under `presentation/views/`,
`presentation/i18n/locales/{en,de}/newAssetFootprint.ts`, `styles/` only the partial already
declaring the New asset dialog's field rules and only if a rule is genuinely needed, and this
task's own tests. **No stylesheet was touched** — see "Changed files".

## Changed files and reason

| File | Purpose | Within lease? |
|---|---|---|
| `src/application/commands/asset/CreateAsset.ts` | `CreateAssetInput.height`, handed to `Asset.create` unchanged | yes |
| `src/presentation/views/NewAssetForm.vue` | the `height` value, its parse, its error route, its control; width and depth moved onto the extracted row | yes |
| `src/presentation/views/NumericField.vue` (NEW) | the numeric field row Amendment 1 names, now the one spelling of all three | yes (the "NEW numeric-field-row component") |
| `src/presentation/i18n/locales/en/newAssetFootprint.ts` | `form.new-asset.height` + a header correction | yes |
| `src/presentation/i18n/locales/de/newAssetFootprint.ts` | its German value | yes |
| `tests/presentation/views/newAssetFormHeight.test.ts` (NEW) | seven cases over the field | yes |
| `tests/application/commands/asset/assetCommands.test.ts` | four cases in the existing `CreateAssetCommand` describe | yes |
| `tests/presentation/views/newAssetForm.test.ts` | **one existing assertion edited** — see "Existing test edited" | yes, and disclosed |

**No `styles/` edit was needed and none was made.** `NumericField` renders the same
`rp-field-error` / `rp-dialog-field` structure width and depth already rendered, so every rule
that styled them styles the height with no new selector. `styles/forms.css` and
`styles/dialogs.css` are untouched, so the `MAX_LINES = 400` partial cap in
`scripts/styles-assemble.mjs` is not approached from this branch.

## The line measurement, from `npx eslint` rather than `wc -l`

`max-lines` here is `{ max: 400, skipBlankLines: true, skipComments: true }`, so `wc -l` is not
the counted number. Measured by re-running the same rule at `max: 1` so the message prints the
count:

```
npx eslint src/presentation/views/NewAssetForm.vue \
  --rule '{"max-lines":["error",{"max":1,"skipBlankLines":true,"skipComments":true}]}'
```

| Tree | Counted lines |
|---|---|
| base `f947d8079`, before any edit | **399** |
| candidate `6b6e42087`, with the height field and the extraction | **389** |
| `NumericField.vue` (new) | 37 |

Amendment 1 predicted "roughly 355" after the extraction. **That figure was for the extraction
alone; it is not what a reviewer should expect to see here, and the difference is not slack
anybody lost.** Extracting the two rows bought about 18 counted lines of template and the third
field plus its parse, its map entry and its value spent about 8 of them back. 389 is the net.

**One measured surprise a later author should know**: `max-lines`'s `skipComments` does NOT skip
an HTML comment in a `.vue` template — only the script block's JS comments. A nine-line
`<!-- … -->` block explaining the height's placement cost nine counted lines; moving that prose
into `parseHeight`'s JSDoc and leaving a one-line template pointer took the file from 398 to 390
with no content lost. That is why the placement argument lives in the script block.

## Acceptance coverage

| Criterion/test ID | Result | Exact evidence | Remaining issue |
|---|---|---|---|
| AD07 item 3 — "optional descriptive height" | met | `NewAssetForm height` (7 cases) + `CreateAssetCommand` height cases (4) | — |
| …"price/category/supplier must not block creation" | unchanged and still held | `newAssetForm.test.ts` passes unchanged but for the one disclosed edit; the height adds no required field | — |
| C07 — "Height remains stored/shown/exported but is not an input to vertical clash checks" | held by construction | the value reaches `Asset.create` and stops there; nothing added reads it back. `Asset.height`'s own docblock already records that nothing computes with it | **not positively checked.** No test asserts "no clash check consumes height", because there is no clash check in this tree to point one at. Stated as a narrowing, not a guarantee |
| C07 — "A draft can be saved while unscaled" | unaffected | the height is optional and blank creates exactly as before (`sends null rather than zero…`) | — |
| C12 — English copy through the existing localization mechanism, both locales retained | met | `form.new-asset.height` in `en/` and `de/newAssetFootprint.ts`; `tests/build/localeModuleSentenceCase.test.ts` and `tests/presentation/i18n` pass | — |
| C12 — "Every enabled control must be reachable and functional" | met | the control is never `:disabled`; when the catalogue freezes it becomes `readonly`, which is the framework rule `FormDialog.vue` states | — |

## Executed checks

All at `6b6e42087` unless noted, on this worktree, `VITEST_MAX_WORKERS=2`.

| Command or manual action | Commit / environment | Exit code or observed result | Evidence |
|---|---|---|---|
| `npx vue-tsc -noEmit` (whole program, `src/` + `tests/`) | candidate | **0** | — |
| `npx eslint <the 3 source files> --max-warnings 0` | candidate | **0** | — |
| `npx eslint <the 3 test files> --max-warnings 0` | candidate | **0** | — |
| `npx oxlint --deny-warnings <all 8 files>` | candidate | **0**, no output | — |
| `npx vitest run tests/presentation/views/ tests/application/commands/asset/` | candidate | **0** — **87 files, 921 tests passed** | 197.08s |
| `npx vitest run tests/harness/entries.test.ts tests/harness/accessibilityDialogs.test.ts tests/build/vue-rules.test.ts` | candidate | **0** — 3 files, 63 tests | the new SFC is discovered by the harness index's `import.meta.glob` and breaks no entry case |
| `npx vitest run tests/presentation/i18n tests/build/localeModuleSentenceCase.test.ts` | candidate | **0** — 6 files, 195 tests | — |

## Watched failing — the verbatim red

Each fix was reverted, the case run, the red read, the fix restored. Quoted as printed.

**1. `CreateAsset.ts` — `height: input.height` removed.** Three command cases red; the form
cases stayed GREEN, which is the point of having both layers (the form's `createAsset` is a fake
that records its input and would never have noticed).

```
 FAIL  tests/application/commands/asset/assetCommands.test.ts > CreateAssetCommand > carries an optional descriptive height through to the created asset
AssertionError: expected null to be 900 // Object.is equality
- Expected: 900
+ Received: null
 ❯ tests/application/commands/asset/assetCommands.test.ts:120:35

 FAIL  … > refuses a negative height before anything is written
Error: Expected error, got ok: {"id":"asset-01M2TZ336CYGJHJKE5ZRY6ZN3G","name":"Impossible", … "height":null,"planPattern":null}
 ❯ expectErr tests/helpers/domain.ts:81:9

 FAIL  … > refuses a non-finite height under its own code, never the negative one
Error: Expected error, got ok: {"id":"asset-01M2TZ336F9KRDRWK9TE1BMVZA","name":"Impossible", … "height":null,"planPattern":null}
 ❯ expectErr tests/helpers/domain.ts:81:9

 Test Files  1 failed | 1 passed (2)
      Tests  3 failed | 22 passed (25)
```

**2. `parseHeight` — blank-versus-typed removed (`return Number(height);`).** This is the defect
the field exists to avoid, and it is silent at every other layer: `checkHeight` accepts zero
deliberately, so nothing downstream refuses it.

```
 FAIL  tests/presentation/views/newAssetFormHeight.test.ts > NewAssetForm height > sends null rather than zero when the height is left blank
AssertionError: expected +0 to be null
- Expected: null
+ Received: 0
 ❯ tests/presentation/views/newAssetFormHeight.test.ts:99:55

 FAIL  … > cannot produce a non-finite height at all, the control having emptied itself
AssertionError: expected +0 to be null
- Expected: null
+ Received: 0
 ❯ tests/presentation/views/newAssetFormHeight.test.ts:139:55
```

**3. The height's `:readonly="catalogueInoperative"` changed to `form.submitting.value`** — the
copy-paste a shared row invites, and exactly why `NumericField.readonly` is required rather than
defaulted.

```
 FAIL  tests/presentation/views/newAssetFormHeight.test.ts > NewAssetForm height > freezes the height with the catalogue while leaving the two dimensions live
AssertionError: expected false to be true // Object.is equality
- true
+ false
 ❯ tests/presentation/views/newAssetFormHeight.test.ts:173:95
```

**4. `'asset.negative-height': 'height'` removed from `NEW_ASSET_ERRORS`.**

```
 FAIL  tests/presentation/views/newAssetFormHeight.test.ts > NewAssetForm height > routes a refused height under the height field rather than to the banner
AssertionError: expected null to be 'A height cannot be negative.' // Object.is equality
- Expected: "A height cannot be negative."
+ Received: null
 ❯ tests/presentation/views/newAssetFormHeight.test.ts:122:49
```

**5. The height control moved INSIDE the `<template v-else>` dimensions branch**, i.e. hidden in
outline mode.

```
 FAIL  tests/presentation/views/newAssetFormHeight.test.ts > NewAssetForm height > still offers the height when an item outline stands in for the dimensions
Error: Unable to get [data-field="height"] within: <form class="rp-dialog-form"> …
```

## What each new test would catch

| Test | Catches |
|---|---|
| `sends null rather than zero when the height is left blank` | an eager parse recording every new asset as 0 mm tall — silent at every other layer |
| `carries a typed height to the create command as a number` | the value not reaching `createAsset` at all, or reaching it as a string |
| `renders the height beside the two dimensions and sends all three` | the height displacing or breaking the footprint write |
| `routes a refused height under the height field rather than to the banner` | the map entry removed, or the field id drifting from `data-field="height"`; asserted through the control's own `aria-describedby`, so a message rendered elsewhere fails |
| `cannot produce a non-finite height at all, the control having emptied itself` | the control's `type` changing, or the parse ceasing to ask — which is exactly when the deliberately-absent `asset.invalid-height` route would start mattering |
| `still offers the height when an item outline stands in for the dimensions` | the placement collapsing back inside the dimensions branch |
| `freezes the height with the catalogue while leaving the two dimensions live` | the `readonly` binding copied from width/depth, making a post-freeze height edit silently discarded |
| `carries an optional descriptive height through to the created asset` (command) | the field declared on the input and never passed to `Asset.create`; asserts the stored entity too, not only the returned one |
| `creates an asset that says nothing about its height when none is given` (command) | an absent height defaulting to something |
| `refuses a negative height before anything is written` (command) | `checkHeight` bypassed, and — via the list length — `Asset.create` ever moving after `save` |
| `refuses a non-finite height under its own code, never the negative one` (command) | the two codes being conflated, which `NaN < 0 === false` makes possible |

## Existing test edited — disclosed rather than fixed quietly

`tests/presentation/views/newAssetForm.test.ts`, case *"creates the asset and, when dimensions
are given, its rectangle footprint"*, asserts the WHOLE `createAsset` input with `toEqual`. Since
the input genuinely gained a property, that assertion had to gain `height: null`:

```
AssertionError: expected { name: 'Kitchen island', …(5) } to deeply equal { name: 'Kitchen island', …(4) }
+   "height": null,
```

**The assertion was strengthened in place, not weakened.** It is still `toEqual` over the whole
object — the alternative, relaxing it to `toMatchObject`, would have made the case blind to any
future field appearing or disappearing, which is the absorption failure this repository names.
A reviewer should check that this is the only existing assertion touched: it is, and the other 86
files in `tests/presentation/views/` + `tests/application/commands/asset/` pass byte-unchanged.

## Verification not performed

Named individually, none left blank.

- **`npm run check` — NOT RUN, deliberately and by instruction.** The full gate is the
  integrator's on the integration SHA. What that means here: `eslint .` over the whole tree,
  the coverage floors, `vite build` (including the stylesheet assembler), and `fallow` have all
  gone un-run on this branch. My ESLint runs were per-file.
- **`npm run test:coverage` — NOT RUN.** So I have no measurement of what this change does to
  the 99/99/99/98 floors. The reasoned expectation, which is a hypothesis and not a number: one
  new branch (`parseHeight`'s blank-versus-typed, both arms driven), one new function
  (`parseHeight`, driven), and `NumericField.vue`'s render path (driven through the form in both
  the `readonly` states and with and without a message). I added no unreachable guard and removed
  none. **A reviewer should read `coverage-final.json` for the four changed/added source files
  rather than the threshold summary**, per CLAUDE.md's "a passing gate is not a review".
- **`npm run analyze` (fallow) — NOT RUN.** So `private-type-leak`, clone detection over the new
  component, and dependency hygiene are unchecked here. `NumericField.vue`'s props name only
  `StringKey`, which its module imports and `en.ts` exports, so I do not expect a leak — unverified.
- **`npm run harness` / `npm run harness-shot` — NOT RUN, and not runnable.** There is no pinned
  Chromium in this environment; `scripts/chromium.mjs` refuses to hunt a substitute, and
  `RP_CHROMIUM_EXECUTABLE` was not set because no named build exists here either. **So nothing
  this branch draws has been photographed.** The height field's layout, its spacing against width
  and depth, its label wrapping at a 460 px sidebar width, and the extracted row's appearance in
  light and dark are all unmeasured. Those are exactly the class of defect the captures have
  caught ten times and `npm run check` cannot see.
- **Obsidian — NOT RUN, and not runnable.** No vault and no Obsidian in this environment, so
  `npm run test-build` was not attempted. The dialog has not been opened by a human, no height
  has been typed into a real Chromium numeric input, and no note has been read back to confirm
  `height:` appears in its frontmatter. The frontmatter round-trip is existing, tested code
  (`AssetFrontmatterSchemaV1`, `SetAssetHeightCommand`) reached by a new caller; that is a
  reasoned expectation, not an observation.
- **The `1e999` sanitization is jsdom's, observed here; Chromium's is asserted from the HTML
  spec and NOT observed.** Both implement the same value-sanitization algorithm and both should
  empty a non-finite entry, but I could not run Chromium. If Chromium differs, the symptom is a
  refusal landing in the banner instead of under the field — a cosmetic miss, not a bad write,
  since `checkHeight` still refuses it.
- **No axe/accessibility run over the new control specifically.** `accessibilityDialogs.test.ts`
  passed, but I did not confirm it scans this dialog's new field; the label/`for`/`id` wiring
  comes from `FieldError`'s existing slot contract unchanged.
- **Migration, performance and export paths — nothing to run.** No schema version is touched, no
  sidecar field is added, and no export consumer reads a height that did not already read one.

## Data and integration implications

Schema/migration change: **none.** `Asset.height` already exists in the note frontmatter and in
`AssetFrontmatterSchemaV1`; this change adds a second writer of an existing field, not a field.
No sidecar change, no version bump, nothing to re-resolve against another branch's v3.

Relevant renderer/export/revision consumers: **none added.** The height is descriptive (C07,
ADR-0014) and nothing this branch writes reads it back.

Undo/no-op/conflict/failure coverage: the height rides `CreateAssetCommand`, which is a single
`save(…, 'absent')` — the existing conflict story, unchanged. A refused height means nothing is
written at all (case 3 of the command tests asserts the catalogue length is unmoved).

Identity/unit/quantity/calibration invariants: the height is millimetres (ADR-009), same as every
other world coordinate, and is named as such in the label rather than left to a placeholder —
the convention `form.new-asset.width` already set. It is not an input to any quantity, cost,
area, clash or calibration.

Shared root/runtime/locales wiring still required: **none.** `newAssetFootprintEn`/`De` are
already spread into `en.ts`/`de.ts`, so the new key needs no `en.ts`/`de.ts` edit and none was
made.

Rollback/recovery considerations: reverting the commit removes an optional field. An asset
created with a height and then read by the reverted build still carries it — `Asset.height`
predates this change and the designer inspector still edits it.

## Integration change requests

Two, both one-line, both cosmetic, and **neither blocks integration.** I did not make either:
both are outside AD07-H's lease and each was checked before being proposed.

1. **`src/presentation/i18n/locales/en.ts`, the comment above the `form.new-asset.*` block.**
   It reads *"The width, depth and footprint/outline copy is `newAssetFootprintEn`, spread in
   above"*. It is now one key short — the height is in that module too. Proposed: add "height"
   to that list. *How I checked*: `grep -rn "newAssetFootprint\|form.new-asset.width"` over
   `src/` and `tests/` printed exactly this comment, its German counterpart's absence, and the
   two spread sites; nothing else names the module. Editing it changes no behaviour and no test
   reads that comment.

2. **`src/presentation/composables/use-field-input.ts`'s docblock** says "`NewAssetForm` had
   stated that once for its seven fields". `NewAssetValues` now has eight. *I recommend leaving
   it alone*, and I am naming it only so a reviewer who greps "seven" is not surprised: the
   sentence is past tense about the state of the tree when the composable was extracted, which
   makes it a historical record rather than a stale count. If the integrator disagrees, the fix
   is one word.

## What I am unsure of, stated plainly

- **Whether the height belongs in a module named "footprint" at all.** It does not, and the
  dispatch asked me to say so rather than create a third locale module. A height is a note field;
  a footprint is sidecar geometry. Both remedies — renaming the export, or a new
  `newAssetHeight.ts` — need an `en.ts`/`de.ts` edit this task does not lease. **My proposal for
  a later card: rename the export to `newAssetMeasurementsEn`/`De` and the files with it**, which
  is a two-line change in `en.ts`/`de.ts` plus the two module headers, and costs nothing at
  runtime. I widened both module headers to say "MEASUREMENT copy" and wrote the mismatch into
  the English one so it is findable from the code side as well as from this report.
- **Whether `asset.invalid-height` should have been routed anyway.** I removed it after watching
  the `1e999` case fail — jsdom empties the control, so the code is unreachable from this form.
  That reasoning rests on jsdom matching Chromium, which I could not check (above). The
  conservative alternative — route it and accept a map entry nothing reaches — is one line, and I
  would not argue hard against an integrator who prefers it.
- **Whether freezing the height with the catalogue is the behaviour a user wants.** It is
  certainly the behaviour the code requires (a frozen retry never re-dispatches `createAsset`, so
  an editable height would be silently discarded). But the *nicer* answer is a form that re-sent
  the catalogue fields through `UpdateAssetCommand` — which `NewAssetForm`'s own `catalogueFrozen`
  docblock already considered and refused for the other five fields. I followed that existing
  decision rather than reopening it, and the height inherits both its benefit and its awkwardness.
- **The `readonly` prop name on `NumericField`.** `vue-tsc`, ESLint and oxlint are all silent on
  it and `vue/no-reserved-props` does not list it, but it shadows a familiar Vue import name and a
  reviewer may prefer `inoperative` or `frozen`. I have no evidence it causes a problem.

## Reviewer and integrator acceptance

Reviewer outcome and findings:
Integrated commit:
Post-integration checks/evidence:
Final status: integrated / verified / blocked

*Only the integrator/reviewer fills the four fields above. This worker's completion statement is
the body of the report, not this section.*
