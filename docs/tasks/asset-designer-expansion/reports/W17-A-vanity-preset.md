# Task report — W17-A (the vanity preset)

Outcome: implemented
Owner / worktree / branch: W17-A / `.worktrees/ad11` / `w17a-vanity-preset`
Base commit / candidate commit: `480dbbc85` / see the commit on this branch
Accepted contract revision: `contracts/DECISIONS.md` ruling **AD18-R8** (2026-09-22)
Allowed scope and shared-file leases: `presetGeometry.ts`, `sanitary.ts`, `{en,de}/assetSymbols.ts`,
`tests/domain/asset/presets/presets.test.ts`, this report. Nothing outside it was edited —
`catalogue.ts` spreads `...SANITARY_PRESETS`, and `AssetPresetForm.vue`, `AssetPresetGallery.vue`
and `presetPreview.ts` carry no per-id branch (`grep -rn "washbasin\|'toilet'" src/presentation/ |
grep -v locales` prints nothing), so none of them needed one.

## Changed files and reason

| File | Purpose | Within lease? |
|---|---|---|
| `src/domain/asset/presets/presetGeometry.ts` | `'vanity'` added to the closed `PresetId` union, beside `washbasin` | yes |
| `src/domain/asset/presets/sanitary.ts` | the preset itself, placed INSIDE the sanitary block between `washbasin` and `shower-tray`; `TOP_OVERHANG_MM` beside the file's other fitting constants | yes |
| `src/presentation/i18n/locales/en/assetSymbols.ts` | `'preset.vanity': 'Vanity'` and `'designer.detail.cabinet': 'Cabinet'` | yes |
| `src/presentation/i18n/locales/de/assetSymbols.ts` | `'preset.vanity': 'Waschtisch'` and `'designer.detail.cabinet': 'Unterschrank'` | yes |
| `tests/domain/asset/presets/presets.test.ts` | the exhaustive list and its count word; one new case over AD18-R8's dimension claims | yes |

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
| AD18-R8: no `Include basin` toggle | pass | the preset declares exactly `width` and `depth`; `PresetFieldKey` and `PresetField.kind` are untouched (`git diff` on `presetGeometry.ts` is the one union line) | none |
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

## Verification not performed

Named rather than left blank, per the card's own instruction — the card forbids the first four and
this machine cannot do the rest:

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
