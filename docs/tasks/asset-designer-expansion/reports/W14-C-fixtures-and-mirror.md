# Task report — W14-C (AD15 rows F08/T16 and T37)

Outcome: partially implemented — **F08/T16 closed with a test; T37 reported as STRUCTURAL and
deliberately given no new case, with the evidence chain under it rebuilt after review.**
Owner / worktree / branch: W14-C · `.worktrees/ad11` · `w14c-fixtures-and-mirror`
Base commit: `7069a3d8b`
Candidate commit (first round): `8fc9d34a8`
Candidate commit (fix round): **`PENDING`** — filled in by the one-line commit on top of it,
because a commit cannot name its own hash. The branch tip is the candidate.
Accepted contract revision: wave 14 base, `r1`
Allowed scope and shared-file leases: CREATE under `tests/vault/legacy-schema/`; EDIT
`tests/vault/legacy-schema/README.md`, `tests/infrastructure/persistence/dto/assetGeometry.test.ts`,
`tests/domain/asset/referenceFrame.test.ts`; CREATE any test file under `tests/`; EDIT any existing
test file this change turns red. **Extended at the fix round** by the coordinator's P3
("your call whether to take it") to `tests/domain/asset/arrangeDetails.test.ts` and
`tests/domain/asset/openGraphicEdits.test.ts` — taken, and flagged here so disjointness can be
re-intersected. **No `src/` change of any kind**: `git diff --stat -- src/` is empty on the
candidate.

## Changed files and reason

| File | Purpose | Within lease? |
|---|---|---|
| `tests/vault/legacy-schema/Library/Geometry/asset-legacy-v1.rpgeo` | Checked-in v1 sidecar; omits all three pending flags, `traced` origin, `-594.005` | Yes — CREATE under `tests/vault/legacy-schema/` |
| `tests/vault/legacy-schema/Library/Geometry/asset-legacy-v2.rpgeo` | Checked-in v2 sidecar; curved footprint, detail with no `kind` and no `pending`, anchor off the origin, facing at three quarter turns | Yes |
| `tests/vault/legacy-schema/Library/Geometry/asset-legacy-v3.rpgeo` | Checked-in v3 sidecar; open graphic, labelled group, clearance with no `clearanceNeedsReview` | Yes |
| `tests/vault/legacy-schema/README.md` | Splits the file in two so the zone note's "proves nothing about a production migration" caveat cannot be carried onto these files, which DO exercise one | Yes — explicit EDIT lease |
| `tests/infrastructure/obsidian/repositories/assetGeometryLegacyFixtures.test.ts` | Reads all three through `ObsidianAssetGeometrySidecar` over the disk-backed fixture vault, each asserting the **whole** `AssetGeometryDocument` | Yes — CREATE any test file under `tests/` |
| `tests/domain/asset/arrangeDetails.test.ts` | One assertion: `factor: -1` at `scaleDetails`, with the mirror argument beside it | **Extended lease (P3)** |
| `tests/domain/asset/openGraphicEdits.test.ts` | One assertion: `sx: -1` at `resizeBox` | **Extended lease (P3)** |

**Two originally-leased files were deliberately NOT edited.**
`tests/infrastructure/persistence/dto/assetGeometry.test.ts` — its literals drive the schema
correctly; F08's gap was the absence of a FILE, not under-assertion there.
`tests/domain/asset/referenceFrame.test.ts` — T37 is structural, below.

## Acceptance coverage

Grades in the matrix's own vocabulary.

| Criterion/test ID | Proposed grade | Exact evidence | Remaining issue |
|---|---|---|---|
| **F08** legacy v1/v2 files | **passed** | Three checked-in `.rpgeo`, one per version `raiseLegacyVersions` names, read through `openFixtureVault('legacy-schema')` → `ObsidianAssetGeometrySidecar.read` → real `vault.read` → `JSON.parse` → `AssetGeometrySchema` → `validateAssetShape` | None |
| **T16** legacy fixtures migrate with semantic equality | **passed** | Each case asserts the **entire** `AssetGeometryDocument` with `toEqual` — `calibration` and all eleven shape fields — beside the version the file still DECLARES on disk and the fixture's own `revision`. "Semantic equality" is now literally what the case performs | None |
| **T37** placement point and front after rotate and mirror | **structural** | No mirror operation exists; every scale door refuses a negative factor and both are now driven with one. Argued below | The row's sentence needs narrowing; proposed wording below |

### C1 — the four distinguishing values are load-bearing now (the finding I was held for)

The reviewer was right and the hazard was real: `footprintOrigin`, `facing`, `anchor` and
`calibration` were carried by the fixtures and asserted by nothing, so they could have been edited
in the file or dropped by the mapper with all three cases green — which is the tidied-fixture
hazard the test's own docblock claimed to close.

Each case now asserts `snapshot.document` whole, with `toEqual`. That was chosen over the
"at minimum" option deliberately: the brittleness a full `toEqual` buys is **the property
wanted here.** A new field on `AssetShape` turns all three red, and a legacy fixture's whole
job is to state what that field's absence in an old file must read as. A case that stayed green
through a new field would be the instrument reaching nothing again, one version later.

**The expectations were hand-written from the fixture JSON, not copied from a run.** All three
passed first execution, which is the only version of that claim worth making.

### P2 — the T37 evidence chain, rebuilt. All three corrections accepted.

My first report said *"a negative scale is refused at every door"* and cited three. The reviewer
is right on every count, and I withdraw the chain rather than patching it:

- **`scaleSolve.ts` contains no refusal.** `factor = next > 0 ? next : factor / 2;` is a CLAMP.
  Its comment — *"a negative factor is a mirror, which every caller refuses"* — is a pointer to
  somebody else's guard, and I read a delegation as a door.
- **`assetShape.test.ts`'s `asset.non-positive-dimension` cases are not about a scale factor.**
  That code comes from a width and a depth through `footprintFromDimensions`. Wrong citation.
- **The clamp arm is covered by `shapeEdits.test.ts` through `resizeToExtent`**, which I did not
  name because I never looked for it.

**The corrected chain, and it is now stronger than the one it replaces.** There are exactly TWO
doors that refuse:

| Door | Guard | Driven with a negative? |
|---|---|---|
| `scaleDetails` (`arrangeDetails.ts`) | `!Number.isFinite(spec.factor) \|\| spec.factor <= 0` | **Yes, since this commit** |
| `scaleRefusal` (`shapeEdits.ts`, behind `resizeBox`) | `[sx, sy].every((factor) => Number.isFinite(factor) && factor > 0)` | **Yes, since this commit** |

And `scaleSolve.ts` is a third site that neither refuses nor admits a mirror — it halves toward
zero and hands a positive factor on.

### P3 — taken. The claim is now checked at the forbidden thing.

Both doors already had a `non-positive` case driving `0` and `NaN`. A negative shares that
branch, so coverage does not move — but T37's claim is specifically about MIRRORING, and no case
in the repository passed a negative to either door. One assertion each, with the argument written
beside it rather than in this report only.

**Watched red by relaxing both guards** (`spec.factor <= 0` → `=== 0`; `factor > 0` → `!== 0`),
and the red is unusually informative — see the verbatim below: the `ok` value that comes back
shows the detail boxes with **reversed winding** (`720,-40 / 620,-40 / 620,-140 / 720,-140`),
which is the mirror itself, printed by the failure.

### T37 — why it is structural, stated only as wide as the checks reach

1. **Both doors that could produce a mirror refuse one, and both are now driven with a negative.**
   That is the category invariant at the forbidden thing rather than a list of places.
2. **No mirror operation exists to test.** `grep -rniw --include=*.ts mirror src/` prints **29**
   lines. Every count variant, since the number is load-bearing and my first report's "30" matches
   none of them:

   ```
   grep -rni mirror src/                    62
   grep -rni --include=*.ts mirror src/     52
   grep -rnil mirror src/                   44
   grep -rniw mirror src/                   34
   grep -rniw --include=*.ts mirror src/    29
   ```

   Under `-rniw` (34 lines, all files) every hit is the English word inside comment syntax except
   one, `src/prototypes/SaveStateMarks.vue`, which is inside a `<!-- -->` block. **Not one is an
   operation on a shape, a placement or a rendering.**
3. `flipped` is a **different subject that happens to be nearby**, and my first report's
   enumeration of it read exhaustive when it was not. `SpatialElement.ts` pairs `flipped` with
   `kind === 'section'`; there is also a live user gesture — `elementActions.flip`, surfaced by
   `ElementGeometryActions.vue` under `tr('editor.drafting.flip')`. A section line and a door
   swing, neither an asset. The conclusion holds; the enumeration was incomplete and is corrected.

`referenceFrame.test.ts`'s single case is therefore the right instrument for the claim it makes:
`mirroredX` is a test-local reflection of a polygon the test builds, and the case asserts
`anchorPresetPoint` is **equivariant** under reflection — a derivation that remembered which side
it computed from would fail it. The row's two asks name things that cannot exist: there is no
gesture, and no mirrored state to be in parity about.

**Proposed narrowed sentence for the regrade:** *"Placement point and front after rotate,
asserted at six angles across surfaces. MIRROR is asserted once because it is a reflection
EQUIVARIANCE property of `anchorPresetPoint` rather than an operation: no asset can be mirrored,
and both scale doors (`scaleDetails`, `resizeBox`) refuse a negative factor, each driven with
one."*

### F08's premise was partly false, and the integrator should know which part

`tests/vault/valid-project/Library/Geometry/asset-designed.rpgeo` **is** `"schemaVersion": 1` and
is read off disk by `assetGeometrySidecar.test.ts`. What did not exist is a case reading one *as*
a legacy file: that one asserts `revision`, `footprintOrigin` and the raised `Point`s and nothing
about the migration, so a fixture tidied to v4 leaves it green. There was no v2 or v3 file at all.
Corrected sentence for the regrade: *the legacy file that existed was not read as a legacy file.*

### "Writes version 3 back" — two stale, one WITHDRAWN

Settled reading: the case title *"writes version 3 back"* is stale and its assertion `toBe(4)` is
right. It is **not** "a narrower schema in that file's own fixture" — `rawDocument` writes
`schemaVersion: 1` and the store parses it with the same `AssetGeometrySchema` as every read.

**I withdraw my third recommendation.** `describe('schema version 3 fields')` is NOT stale. Its
own docblock reads *"AD04's own fields across the storage boundary"*, and AD04 is v3 — the label
names the version that INTRODUCED the fields, not the version written. The reviewer's tell is
decisive and I checked it: the sibling `describe('asset geometry sidecar, schema version 2')` at
the same top level reads identically, and I did not list it, so the rule I applied was not
consistent with itself.

Two stand, both text-only and both the integrator's: the header's *"every write is v2"*, and the
case title.

## Executed checks

| Command or manual action | Commit / environment | Exit code or observed result | Evidence |
|---|---|---|---|
| `npx vitest run …/assetGeometryLegacyFixtures.test.ts` | fix round, node 22, Windows | 0 | `Test Files 1 passed (1) / Tests 3 passed (3)` |
| `npx vitest run tests/domain/asset/arrangeDetails.test.ts tests/domain/asset/openGraphicEdits.test.ts` | fix round | 0 | `Test Files 2 passed (2) / Tests 81 passed (81)` |
| `npx vitest run` over `legacyFixture`, `fixtureVault`, the new file, `build/encoding`, `build/spec-files` | first round | 0 | `Test Files 5 passed (5) / Tests 32 passed \| 1 skipped (33)` |
| `npx vue-tsc -noEmit` (whole tree, `src/` + `tests/`) | first round | 0, no diagnostics | `TSC CLEAN` |
| `npx eslint` / `npx oxlint` on every `.ts` touched | fix round | 0, no output | `LINT CLEAN` |
| Encoding check on all files created/edited | fix round | no BOM, no CR in any | table below |
| `git status --short -- src/` after every mutation | fix round | empty | restored each time |
| Grep census for `mirror` / `flip` | fix round | five variants tabulated above | written from what printed |

### Encoding evidence (bytes read in `node`, not by eye)

```
tests/vault/legacy-schema/Library/Geometry/asset-legacy-v1.rpgeo         bom=false CR=false bytes=347
tests/vault/legacy-schema/Library/Geometry/asset-legacy-v2.rpgeo         bom=false CR=false bytes=686
tests/vault/legacy-schema/Library/Geometry/asset-legacy-v3.rpgeo         bom=false CR=false bytes=1161
tests/infrastructure/obsidian/repositories/assetGeometryLegacyFixtures.test.ts bom=false CR=false bytes=6917
tests/vault/legacy-schema/README.md                                      bom=false CR=false bytes=3539
```

`tests/build/encoding.test.ts` also covered them and passed. **It always would have**, and my
first report treated that as luckier than it is: its file set is
`git ls-files --cached --others --exclude-standard`, so untracked files arrive through `--others`
and tracked ones through `--cached`. Either way.

## Watched red — verbatim

All `src/` mutations were restored with `git checkout -- src/`, verified by `git status`.

### Red 1 — `raiseLegacyVersions` returns `input` unchanged

```
 × raises a version 1 file to a shape with no details, no groups and no review flag 148ms
 × raises a version 2 file, defaulting each graphic to closed and keeping its curves 134ms
 × raises a version 3 file, reading its open graphic and its group and leaving the clearance unflagged 136ms

Error: Expected ok, got error: {"category":"Validation","code":"asset-geometry.schema-invalid","message":"Sidecar Library/Geometry/asset-legacy-v1.rpgeo failed validation: Invalid input: expected 4","sidecarPath":"Library/Geometry/asset-legacy-v1.rpgeo"}
Error: Expected ok, got error: {"category":"Validation","code":"asset-geometry.schema-invalid","message":"Sidecar Library/Geometry/asset-legacy-v2.rpgeo failed validation: Invalid input: expected 4","sidecarPath":"Library/Geometry/asset-legacy-v2.rpgeo"}
Error: Expected ok, got error: {"category":"Validation","code":"asset-geometry.schema-invalid","message":"Sidecar Library/Geometry/asset-legacy-v3.rpgeo failed validation: Invalid input: expected 4","sidecarPath":"Library/Geometry/asset-legacy-v3.rpgeo"}
```

### Red 2 — `ClosedDetailSchemaV3`'s `kind` stops defaulting to `'closed'`

```
 × raises a version 2 file, defaulting each graphic to closed and keeping its curves 100ms
 × raises a version 3 file, reading its open graphic and its group and leaving the clearance unflagged 85ms

Error: Expected ok, got error: {"category":"Validation","code":"asset-geometry.schema-invalid","message":"Sidecar Library/Geometry/asset-legacy-v2.rpgeo failed validation: Invalid input","sidecarPath":"Library/Geometry/asset-legacy-v2.rpgeo"}
Error: Expected ok, got error: {"category":"Validation","code":"asset-geometry.schema-invalid","message":"Sidecar Library/Geometry/asset-legacy-v3.rpgeo failed validation: Invalid input","sidecarPath":"Library/Geometry/asset-legacy-v3.rpgeo"}
```

### Red 3 — `clearanceNeedsReview` defaults to `true`

v3 catches it as an ASSERTION rather than as a validator refusal, which is why it carries a
clearance at all:

```
 × raises a version 1 file to a shape with no details, no groups and no review flag 99ms
 × raises a version 2 file, defaulting each graphic to closed and keeping its curves 90ms
 × raises a version 3 file, reading its open graphic and its group and leaving the clearance unflagged 112ms

Error: Expected ok, got error: {"category":"Validation","code":"asset.absent-clearance-cannot-need-review","message":"A shape with no clearance has no boundary to review.","sidecarPath":"Library/Geometry/asset-legacy-v1.rpgeo"}
Error: Expected ok, got error: {"category":"Validation","code":"asset.absent-clearance-cannot-need-review","message":"A shape with no clearance has no boundary to review.","sidecarPath":"Library/Geometry/asset-legacy-v2.rpgeo"}
AssertionError: expected true to be false // Object.is equality
```

### Red 4 — the fixture is actually READ (no `src/` change; the v3 file was moved away)

```
 × raises a version 3 file, reading its open graphic and its group and leaving the clearance unflagged 119ms
Error: ENOENT: no such file or directory, open 'D:\tmp-claude\rp-vault-PmH5di\Library\Geometry\asset-legacy-v3.rpgeo'
      Tests  1 failed | 2 passed (3)
```

**This red proves one file directly, and the reviewer is right that the STRUCTURE proves all
three**: `readLegacy` is a shared helper and its `readFileSync` runs per case, before the port
read, against the clone. Moving two more files would have re-demonstrated the same helper.

### Red 5 — C1's new assertions. One edited VALUE per fixture, all three previously unasserted.

`footprintOrigin` `traced`→`typed` in v1, `facing` `4.71238898038469`→`0` in v2, a clearance
`y` `900`→`800` in v3. No `src/` change; `git checkout -- tests/vault/legacy-schema/Library/Geometry/`
restored them.

```
 × raises a version 1 file to a shape with no details, no groups and no review flag 157ms
 × raises a version 2 file, defaulting each graphic to closed and keeping its curves 118ms
 × raises a version 3 file, reading its open graphic and its group and leaving the clearance unflagged 109ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected { calibration: null, shape: { …(11) } } to deeply equal { calibration: null, shape: { …(11) } }
- Expected
+ Received
-     "footprintOrigin": "traced",
+     "footprintOrigin": "typed",
AssertionError: expected { calibration: null, shape: { …(11) } } to deeply equal { calibration: null, shape: { …(11) } }
- Expected
+ Received
-     "facing": 4.71238898038469,
+     "facing": 0,
AssertionError: expected { calibration: null, shape: { …(11) } } to deeply equal { calibration: null, shape: { …(11) } }
- Expected
+ Received
-           "y": 900,
+           "y": 800,
      Tests  3 failed (3)
```

### Red 6 — P3's negative-factor assertions, with both guards relaxed

`spec.factor <= 0` → `spec.factor === 0` in `arrangeDetails.ts`; `factor > 0` → `factor !== 0` in
`shapeEdits.ts`. Restored.

```
 × refuses a graphic and a clearance the shape has not got, and a non-positive scale factor 21ms
 × refuses a non-positive or non-finite scale factor 10ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
Error: Expected error, got ok: {"footprint":{"points":[{"x":-1000,"y":-500},{"x":1000,"y":-500},{"x":1000,"y":500},{"x":-1000,"y":500}]},"footprintOrigin":"typed","footprintPending":false,"clearance":null,"clearancePending":false,"anchor":{"x":0,"y":0},"anchorPending":false,"facing":0,"details":[{"id":"detail-1","name":"detail-1","line":"solid","pending":false,"kind":"closed","outline":{"points":[{"x":720,"y":-40},{"x":620,"y":-40},{"x":620,"y":-140},{"x":720,"y":-140}]}},{"id":"detail-2","name":"detail-2","line":"solid","pending":false,"kind":"closed","outline":{"points":[{"x":470,"y":-160},{"x":270,"y":-160},{"x":270,"y":-220},{"x":470,"y":-220}]}},{"id":"detail-3","name":"detail-3","line":"solid","pending":false,"kind":"closed","outline":{"points":[{"x":-10,"y":130},{"x":-50,"y":130},{"x":-50,"y":90},{"x":-10,"y":90}]}}],"clearanceNeedsReview":false,"groups":[]}
AssertionError: expected { ok: true, value: { …(11) } } to match object { Object (error) }
      Tests  2 failed | 79 passed (81)
```

Worth reading that `ok` value rather than skipping it: every detail box comes back with
**reversed winding** (`720,-40 / 620,-40 / 620,-140 / 720,-140`). The mirror the guard exists to
prevent is printed by the failure.

## Verification not performed

- **`npm run check`, `check:fast`, `test:coverage`, `analyze`, `build`, `harness`,
  `harness-shot`, `test-build`** — none this card's to run; other cards share the machine. CI on
  the PR is where they belong.
- **Coverage floors** — not measured. No `src/` line changed, so no floor can fall. P3's two
  assertions share an existing branch, so they move no number — that is stated as the reason they
  are worth having anyway, not as a claim that they raise coverage.
- **`npm run analyze` (fallow)** — not run. Its duplication half skips `*.test.ts` entirely, so
  the new test file is invisible to it regardless; the fixtures are `.rpgeo` data.
- **`eslint .` tree-wide** — only the three `.ts` files touched were linted. The README is
  Markdown and the `.rpgeo` are data; neither is linted.
- **`vue-tsc` after the fix round's edits** — the first round's whole-tree run was clean, and the
  fix round adds only assertions inside existing test bodies with no new imports or types. **Named
  rather than claimed**: it was not re-run, and the vitest runs above do not type-check.
- **A live vault (`npm run test-build`)** — nothing here draws and no Obsidian API is newly
  assumed. Not applicable.
- **Whether the two stale sentences are the ONLY stale ones in
  `assetGeometrySidecarDetails.test.ts`** — I read its header, the named case and both `describe`
  labels. I did not audit every docblock in it.

## Data and integration implications

Schema/migration change: **none.** No `src/` change. What changed is that three legacy documents
exist as BYTES the suite reads, so a future non-additive change to v1/v2/v3 reading turns these
red — and, because each case asserts the whole document, so does a mapper that drops a field.

Relevant renderer/export/revision consumers: none. The fixtures are read-only input to one test
file; `openFixtureVault` clones to a temp dir and discards it.

Undo/no-op/conflict/failure coverage: not in scope — the new cases are reads. The write half is
owned by `assetGeometrySidecar.test.ts` and `assetGeometrySidecarDetails.test.ts`.

Identity/unit/quantity/calibration invariants: each fixture declares `"unit": "mm"` (ADR-009) and
an `assetId` matching its filename, so the store's `asset-id-mismatch` guard passes rather than
being bypassed. `calibration` is `null` in all three and **is now asserted as `null`** rather than
merely being so.

Shared root/runtime/locales wiring still required: none.

Rollback/recovery considerations: reverting removes three fixtures and one test file, restores the
README and drops two assertions. Nothing in `src/` depends on any of it.

### One finding for the integrator (the other two are now theirs by their own message)

**`FixtureStack` does not declare `libraryFolder`, but `openFixtureVault` returns it.**
`tests/helpers/fixtureVault.ts` sets `libraryFolder: DEFAULT_LIBRARY_FOLDER` on the returned
object while the exported interface omits it, so `vue-tsc` reports
`TS2339: Property 'libraryFolder' does not exist on type 'FixtureStack'` at any consumer naming
it. `RepositoryStack` does declare it, so the two stacks disagree. Worked around by spelling the
fixture path literally with a comment saying why, rather than editing a shared helper with two
sibling cards live.

## Reviewer and integrator acceptance

Reviewer outcome and findings:
Integrated commit:
Post-integration checks/evidence:
Final status: integrated / verified / blocked
