# Task report — W17-A (the vanity preset)

Outcome: implemented
Owner / worktree / branch: W17-A / `.worktrees/ad11` / `w17a-vanity-preset`
Base commit / candidate commit: `480dbbc85` / see the commit on this branch
Accepted contract revision: `contracts/DECISIONS.md` ruling **AD18-R8** (2026-09-22)
Allowed scope and shared-file leases: `presetGeometry.ts`, `sanitary.ts`, `{en,de}/assetSymbols.ts`,
`tests/domain/asset/presets/presets.test.ts`, this report — **plus, by an explicit after-the-fact
lease extension for the fix round**, `src/presentation/designer/presets/AssetPresetForm.vue` and
`tests/presentation/designer/assetPresetForm.test.ts`.

**On "the presentation files needed no change", which the first version of this report got half
right with the wrong instrument.** `grep -rn "washbasin\|'toilet'" src/presentation/ | grep -v
locales` does print nothing, and `catalogue.ts` spreads `...SANITARY_PRESETS` while
`AssetPresetForm.vue`, `AssetPresetGallery.vue` and `presetPreview.ts` carry no per-id branch — but
**a per-id grep cannot see a COUNT, and a count is exactly what adding a preset changes.** The
instrument that could see it is `grep -rn "fourteen" src/ tests/` (more durably: grep the current
count word, whatever it is, together with the next one up), and it prints four preset-related hits
outside the original lease. The count itself is
`grep -c "definePreset(" src/domain/asset/presets/*.ts`, read per group file and summed —
`presetGeometry.ts`'s single hit is the DEFINITION of `definePreset`, not a call, so summing that
column blindly answers one too many. **The next card adding a preset should run both.**

## Changed files and reason

| File | Purpose | Within lease? |
|---|---|---|
| `src/domain/asset/presets/presetGeometry.ts` | `'vanity'` added to the closed `PresetId` union, beside `washbasin` | yes |
| `src/domain/asset/presets/sanitary.ts` | the preset itself, placed INSIDE the sanitary block between `washbasin` and `shower-tray`; `TOP_OVERHANG_MM` beside the file's other fitting constants | yes |
| `src/presentation/i18n/locales/en/assetSymbols.ts` | `'preset.vanity': 'Vanity'` and `'designer.detail.cabinet': 'Cabinet'` | yes |
| `src/presentation/i18n/locales/de/assetSymbols.ts` | `'preset.vanity': 'Waschtisch'` and `'designer.detail.cabinet': 'Unterschrank'` | yes |
| `tests/domain/asset/presets/presets.test.ts` | the exhaustive list and its count word; one new case over AD18-R8's dimension claims | yes |
| `src/presentation/designer/presets/AssetPresetForm.vue` | fix round F1 — three docblock sentences that said "fourteen", one of them a cross-file citation of the count word this change moved | yes, under the fix-round extension |
| `tests/presentation/designer/assetPresetForm.test.ts` | fix round F1 — the fourth such sentence, in the `mountAttached` docblock | yes, under the fix-round extension |

## What was built, and why it is shaped this way

- **Fields** — `width` 500–1600 default **800**, `depth` 350–700 default **450**. Both keys are
  existing `PresetFieldKey`s, so nothing widened. The default is board 01's; the range spans
  `references/previous-expansion-concept.md` §11's **1,000 × 500** so that walk stays typeable,
  which is the whole of what AD18-R8 asks the range to do.
- **No `Include basin` toggle.** No field, no new key, no boolean kind — dropped by the ruling.
- **Parts**, all wireframe, no artwork authored: `cabinet` (dashed), `basin` (stadium),
  `tap-hole` (circle). The footprint IS the countertop; the carcass is inset `TOP_OVERHANG_MM`
  at each side and at the front and flush at the back (−y, the wall side), and is DASHED because
  it sits under the top. `rectFitting(width, depth, details)` and `FRONT_REACH_MM` are reused from
  `washbasin`, so the front clearance is the neighbour's.
- **Why a `cabinet` part at all**: without it this preset is `washbasin` at another size, and the
  ruling's own semantics ("a vanity without a basin is a cabinet") make the carcass the thing that
  distinguishes the two in the gallery thumbnail, which `presetThumbnail` derives from the shape.
  Its cost is one line plus one label pair; `semanticLabel` renders it from
  `designer.detail.cabinet`, which both locales now declare.
- **Trap 1 (catalogue order)**: placed between `washbasin` and `shower-tray` inside
  `SANITARY_PRESETS`, so `rect-table` is still first and `bed` still last.
- **Trap 2 (the `"TAB"` search)**: **checked** — neither `Vanity` nor `Waschtisch` contains the
  substring `tab` in any case (`Waschtisch` has `tisch`, not `tab`), so
  `assetPresetForm.test.ts`'s four-table search result is unchanged; it was run, green, below.
- **`typedExtent`** needed **no new arm**: the vanity's extent is its `width`/`depth`, which is that
  switch's `default`. Confirmed by the 65-test `describe.each` block passing on the first run, before
  the test file was touched at all.

## Acceptance coverage

| Criterion/test ID | Result | Exact evidence | Remaining issue |
|---|---|---|---|
| AD18-R8: a `vanity` preset in the `sanitary` group | pass | `offers all fifteen presets` lists `'toilet', 'washbasin', 'vanity', 'shower-tray', 'bathtub'` | none |
| AD18-R8: default 800 × 450 | pass | `builds the vanity at board 01’s default and at the scenario’s 1,000 × 500` | none |
| AD18-R8: range spans 1,000 × 500 | pass | same case builds at `{ width: 1000, depth: 500 }` and measures the footprint | none |
| AD18-R8: no `Include basin` toggle | pass | **executably pinned**: `expect(defaultValues(vanity)).toEqual({ width: 800, depth: 450 })` — `defaultValues` maps over `preset.fields`, so a third field of any kind turns that case red rather than merely being noticed in review. Beside it, `PresetFieldKey` and `PresetField.kind` are untouched (`git diff` on `presetGeometry.ts` is the one union line) | none |
| AD18-R8: wireframe, no artwork | pass | three ordinary outlines; nothing authored outside `sanitary.ts` | none |
| AD15-R2 / §4 row 2: the fixture is the preset | pass | no `tests/helpers/assetShapes.ts` builder was written; the fixture is `ASSET_PRESETS.find((p) => p.id === 'vanity')` | none |
| Generic preset contract (valid shape at default/min/max, extent, details inside the footprint, out-of-range refusal) | pass | the existing `describe.each` picked the preset up; 74 → 75 tests in the file | none |

## Executed checks

| Command or manual action | Commit / environment | Exit code or observed result | Evidence |
|---|---|---|---|
| `npx vitest run tests/domain/asset/presets` (preset added, test file NOT yet touched) | working tree, node/vitest 4.1.11 | exit 1 — the intended automatic red | `Test Files  1 failed \| 1 passed (2)` / `Tests  1 failed \| 73 passed (74)`, on `offers all fourteen presets` |
| `npx vitest run … -t "board 01"` with `default: 800` mutated to `600` | mutated tree | exit 1 | `expected { width: 600, depth: 450 } to deeply equal { width: 800, depth: 450 }` |
| `npx vitest run … -t "board 01"` with `depth` `max: 700` mutated to `480` | mutated tree | exit 1 | `Expected ok, got error: … "vanity.depth must be within 350–480; got 500."` |
| `npx vitest run … -t "board 01"` with the carcass offset's sign flipped (flush at the FRONT) | mutated tree | exit 1 | `AssertionError: expected [ 20, +0 ] to deeply equal [ +0, 20 ]` |
| `npx vitest run tests/domain/asset/presets tests/presentation/designer tests/presentation/i18n` | restored tree | exit 0 | `Test Files  77 passed (77)` / `Tests  1167 passed (1167)` — this is the run that covers trap 2, `assetPresetForm.test.ts`'s `"TAB"` search and its first/last keyboard pins |
| `npx vitest run tests/domain/asset/presets` (final, restored tree) | restored tree | exit 0 | `Test Files  2 passed (2)` / `Tests  75 passed (75)` |
| **fix round** — `npx oxlint` over both fix-round files | fix-round tree | exit 0, no output | — |
| **fix round** — `npx eslint src/presentation/designer/presets/AssetPresetForm.vue --max-warnings 0` (by hand, since only a `.vue` gets ESLint in the edit-loop hook) | fix-round tree | exit 0 | — |
| **fix round** — `npx vitest run tests/presentation/designer/assetPresetForm.test.ts tests/presentation/designer/assetPresetFlow.test.ts tests/domain/asset/presets` | fix-round tree | exit 0 | `Test Files  4 passed (4)` / `Tests  103 passed (103)` |
| **fix round** — `grep -rn "fourteen\|fifteen"` over both fix-round files | fix-round tree | exit 1 (no hits) — no count word is left in either | — |
| `npx oxlint` over all five edited files (twice — both locale edits and the mutation/restore were scripted, so the hook never saw them) | restored tree | exit 0, no output | — |

### Verbatim red 1 — the exhaustive list, automatic

```
 FAIL  |suite| tests/domain/asset/presets/presets.test.ts > preset refusals that are not ranges > offers all fourteen presets
AssertionError: expected [ 'rect-table', 'round-table', …(13) ] to deeply equal [ 'rect-table', 'round-table', …(12) ]

- Expected
+ Received

@@ -6,10 +6,11 @@
    "chair",
    "armchair",
    "sofa",
    "toilet",
    "washbasin",
+   "vanity",
    "shower-tray",
    "bathtub",
```

### Verbatim red 2 and 3 — the new case, watched failing on a mutation of each half it claims

```
 FAIL  … > builds the vanity at board 01’s default and at the scenario’s 1,000 × 500
AssertionError: expected { width: 600, depth: 450 } to deeply equal { width: 800, depth: 450 }
```

```
 FAIL  … > builds the vanity at board 01’s default and at the scenario’s 1,000 × 500
Error: Expected ok, got error: {"category":"Validation","code":"asset.preset-value-out-of-range","message":"vanity.depth must be within 350–480; got 500."}
```

### Verbatim red 4 — the docblock's flush-at-the-back claim, watched failing

The comment says the carcass is inset at the sides and the front and flush at the back. Flipping the
sign of its offset (flush at the front instead) turns that assertion red:

```
 FAIL  … > builds the vanity at board 01’s default and at the scenario’s 1,000 × 500
AssertionError: expected [ 20, +0 ] to deeply equal [ +0, 20 ]
```

## Fix round (second commit on this branch)

**F1 — the count this change falsified in files it did not touch.** Verified at the tree before
acting: `grep -rn "fourteen" src/ tests/` prints ten hits, four of them about presets — three in
`AssetPresetForm.vue` (the `CHOICES` docblock, the comment above the `preset` `shallowRef`, the
roving-tabindex docblock above `focusedId`) and one in `assetPresetForm.test.ts` (above
`mountAttached`). The other six are about unrelated things — fourteen error codes, fourteen call
sites, fourteen scans, fourteen assertions, fourteen Sie-form imperatives — and are untouched.

**The number, measured before it was written:** `grep -c "definePreset(" src/domain/asset/presets/*.ts`
prints `plantsBeds.ts:3`, `sanitary.ts:5`, `seating.ts:3`, `tables.ts:4` — fifteen — with
`presetGeometry.ts:1` being the DEFINITION rather than a call. Confirmed by a second instrument,
`grep -h "definePreset(" … | grep -c "definePreset('"`, which counts only calls with a quoted id
and also prints 15. The coordinator's "fifteen" is correct and this is the measurement, not the
citation.

**None of the four rewrites carries a number, and that is the decision rather than an oversight.**
The precedent is `designerIconToolbar.test.ts`'s `TOOLBAR_LABELS` docblock, which derives its set
from `DESIGNER_TOOL_ICONS` so that *"the day a fifth shape is added this list loses it exactly as
the toolbar does"* — a sentence that cannot go stale because it states the rule instead of the
count. Taken one at a time, since each had to be checked for whether the argument needs a number:

| Sentence | Now reads | Why no number |
|---|---|---|
| `CHOICES` docblock | "one `build` call per preset per dialog open rather than one per preset per keystroke" | the argument is per-OPEN versus per-KEYSTROKE; the multiplier is the catalogue either way and never entered it |
| above the `preset` `shallowRef` | "`presets.test.ts` pins the whole catalogue as an ordered list of ids" | this was the blocking one — a cross-file citation of another file's count word. What `offers all fifteen presets` actually pins is the ORDERED LIST, which is both stronger and stable, so the citation now names the thing rather than its length |
| `focusedId` docblock | "a gallery of plain buttons is one tab stop PER PRESET" | the regression is one-stop-per-button against the `<select>`'s one; "per preset" states it exactly and a count only illustrated it |
| `mountAttached` docblock | "a gallery of plain buttons is one tab stop per preset" | same sentence, same reason — the two are deliberately kept saying the same thing |

**F4 — taken.** The acceptance row for the dropped toggle now cites the executable pin
(`defaultValues(vanity)` over `preset.fields`) rather than prose and a diff.

**F3 — not acted on**, as instructed: the exact `toEqual([20, 20])` beside the `toBeCloseTo` siblings
is left alone.

**The four reds quoted above were NOT re-taken, and here is why that is honest**: this fix round
changed comments in two presentation files and nothing else, so
`git diff --stat HEAD -- src/domain tests/domain src/presentation/i18n` printed **nothing** against
the commit those reds were taken from — the code under each mutation and every assertion is
byte-identical. What was re-run after the fix round is the affected suites, green below.

## Verification not performed

Named rather than left blank, per the card's own instruction — the card forbids the first four and
this machine cannot do the rest:

- **The fix round's own blind spot**: `grep -rn "fourteen" src/ tests/` found the tokens that
  SPELL the count. A sentence that stated the same count in digits, or as "the catalogue's 14", or
  in a file the fix round did not grep (`docs/`, `styles/`, `scripts/`) is outside what that grep
  saw. The coordinator holds the two `docs/` instances; nothing checks this class automatically.
- **`npm run check`**, and each of its legs run whole — `build` (`vue-tsc`, so the German locale
  record's exhaustiveness and the `PresetId` union are UNCHECKED here; the de file was edited by
  script and only oxlint has read it), `lint` (`eslint .` — layer bans, budgets, the locale
  sentence-case rule over `'Vanity'`, `'Cabinet'`, `'Waschtisch'`, `'Unterschrank'`),
  `test:coverage` (the coverage floors — three new statements and one new arrow function in
  `sanitary.ts` are covered by the `describe.each`, but no floor was measured) and `analyze`.
  The card reserves all four for the integrator on a shared machine.
- **`npm run check:fast`** — forbidden by the card for the same reason.
- **The rest of the suite**: everything outside `tests/domain/asset/presets`,
  `tests/presentation/designer` and `tests/presentation/i18n` was not run. The likeliest unrun
  neighbour is `tests/presentation/library/`, which draws assets rather than presets.
- **The browser harness and captures** (`npm run harness`, `npm run harness-shot`): not run. So the
  vanity's gallery thumbnail and its parts have been measured for geometry and **never LOOKED at**
  — the dashed carcass, the basin proportion and the tap hole are unreviewed as a picture, which is
  exactly the class of defect the captures exist to catch.
- **A live vault** (`npm run test-build`): not run; no Obsidian here.
- **No migration, no performance work**: nothing to check.

## Data and integration implications

Schema/migration change: none. A preset is a builder of an `AssetShape` that already validates;
nothing is persisted by adding one, and an asset created from it is an ordinary asset.
Relevant renderer/export/revision consumers: `ASSET_PRESETS` (via `catalogue.ts`),
`AssetPresetForm.vue`, `AssetPresetGallery.vue` and `presetThumbnail` — all generic over the
catalogue, none edited.
Undo/no-op/conflict/failure coverage: unchanged — applying a preset is the existing replace-design
command, and `designer.preset.replaces` already says undo restores the previous design.
Identity/unit/quantity/calibration invariants: millimetres throughout; the shape is
`footprintOrigin: 'typed'`, `facing = PRESET_FACING`, anchored at the origin, exactly as
`definePreset` composes for every other preset.
Shared root/runtime/locales wiring still required: none — both locales ship in this commit. A
reviewer should note the two NEW detail label keys (`designer.detail.cabinet`) alongside
`preset.vanity`.
Rollback/recovery considerations: reverting the commit removes the union member, the preset, the
labels and the test; nothing else references `'vanity'`.

## Reviewer and integrator acceptance

Reviewer outcome and findings:
Integrated commit:
Post-integration checks/evidence:
Final status: integrated / verified / blocked

Only the integrator/reviewer fills final acceptance. A worker's completion statement is not this field.
