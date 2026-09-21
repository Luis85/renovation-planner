# Task report — W14-C (AD15 rows F08/T16 and T37)

Outcome: partially implemented — **F08/T16 closed with a test; T37 reported as STRUCTURAL and
deliberately given no test.**
Owner / worktree / branch: W14-C · `.worktrees/ad11` · `w14c-fixtures-and-mirror`
Base commit / candidate commit: `7069a3d8b` / see the hand-off message
Accepted contract revision: wave 14 base, `r1`
Allowed scope and shared-file leases: CREATE under `tests/vault/legacy-schema/`; EDIT
`tests/vault/legacy-schema/README.md`, `tests/infrastructure/persistence/dto/assetGeometry.test.ts`,
`tests/domain/asset/referenceFrame.test.ts`; CREATE any test file under `tests/`; EDIT any existing
test file this change turns red. **No `src/` change of any kind** — `git diff --stat -- src/` is
empty on the candidate.

## Changed files and reason

| File | Purpose | Within lease? |
|---|---|---|
| `tests/vault/legacy-schema/Library/Geometry/asset-legacy-v1.rpgeo` | Checked-in v1 asset sidecar; omits all three pending flags, carries `-594.005` | Yes — CREATE under `tests/vault/legacy-schema/` |
| `tests/vault/legacy-schema/Library/Geometry/asset-legacy-v2.rpgeo` | Checked-in v2 sidecar; curved footprint, one detail with no `kind` and no `pending` | Yes |
| `tests/vault/legacy-schema/Library/Geometry/asset-legacy-v3.rpgeo` | Checked-in v3 sidecar; open graphic, group, clearance with no `clearanceNeedsReview` | Yes |
| `tests/vault/legacy-schema/README.md` | Splits the file in two so the zone note's "proves nothing about a production migration" caveat cannot be carried onto these files, which DO exercise one | Yes — explicit EDIT lease |
| `tests/infrastructure/obsidian/repositories/assetGeometryLegacyFixtures.test.ts` | Reads all three through `ObsidianAssetGeometrySidecar` over the disk-backed fixture vault | Yes — CREATE any test file under `tests/` |

**Two leased files were deliberately NOT edited**, and the reason is the row:

- `tests/infrastructure/persistence/dto/assetGeometry.test.ts` — the literals there already drive
  the schema hard and correctly. F08's gap is that there was no FILE, not that the schema was
  under-asserted; adding another literal there would have answered a different question.
- `tests/domain/asset/referenceFrame.test.ts` — T37 is structural, below.

## Acceptance coverage

| Criterion/test ID | Result | Exact evidence | Remaining issue |
|---|---|---|---|
| **F08** legacy v1/v2 files | **closed** (and wider than the row asked: v1, v2 AND v3) | `assetGeometryLegacyFixtures.test.ts`, three cases, over `tests/vault/legacy-schema/Library/Geometry/*.rpgeo` read through `openFixtureVault` → `ObsidianAssetGeometrySidecar.read` → real `vault.read` → `JSON.parse` → `AssetGeometrySchema` → `validateAssetShape` | None. See "the premise was partly false" below |
| **T16** legacy fixtures migrate with semantic equality | **closed** | Same three cases. Each asserts the version the file still DECLARES on disk, the fixture's own `revision`, and the defaults the raise supplies: v1 → `details: []`, `groups: []`, `clearanceNeedsReview: false`, three pending flags `false`; v2 → `kind: 'closed'`, `pending: false`, `groups: []`, bulges preserved; v3 → open graphic with its label, the group, clearance present and `clearanceNeedsReview: false` | None |
| **T37** placement point and front after rotate and mirror | **STRUCTURAL — no test written, regrade proposed** | Argued below with greps | The row's sentence needs narrowing, not a test |

### F08's premise was PARTLY FALSE, and the integrator should know which part

The brief and the matrix both say "There is **no checked-in legacy `.rpgeo` fixture**".
`tests/vault/valid-project/Library/Geometry/asset-designed.rpgeo` is `"schemaVersion": 1` and is
read off disk by `assetGeometrySidecar.test.ts` ("reads a designed asset's shape off the
checked-in sidecar"). So a legacy file existed.

What did **not** exist is what the row actually needs: that case asserts `revision`,
`footprintOrigin` and the raised `Point`s — nothing about the MIGRATION. A fixture tidied up to
`"schemaVersion": 4` would leave it green. There was no v2 or v3 file at all. The new fixtures
close the real gap; the corrected sentence for the regrade is *"the legacy file that existed was
not read AS a legacy file"*.

### T37 — STRUCTURAL. There is no mirror to test.

**Mirroring an asset is not an operation this product has.** Measured three ways:

1. `grep -rni "mirror" src/` returns 30 hits. Every one is the English word in a comment
   ("mirrors `Plan.ts`", "the mirror of `expectOk`", a reactive mirror of `ToolManager`).
   **Not one is an operation on a shape, a placement or a rendering.**
2. `grep -rni "flip" src/` finds `SpatialElement.flipped`, which
   `SpatialElement.ts`'s own line states belongs to a **section line** (`(element.kind ===
   'section') !== (typeof element.flipped === 'boolean')`), and `flippedOpening` for a door
   swing. Neither is an asset.
3. **A negative scale is refused at every door that could produce a mirror**, and the source
   says so in those words: `shapeEdits.ts` — *"Only a mirror flips a bulge's sign, which is why
   a non-positive factor is refused"*; `scaleSolve.ts` — *"a negative factor is a mirror, which
   every caller refuses"*; `arrangeDetails.ts` — *"A non-positive or non-finite factor is
   refused"*. All three refusals are already covered
   (`arrangeDetails.test.ts` "refuses a non-positive or non-finite scale factor",
   `openGraphicEdits.test.ts` "…and a non-positive scale factor", plus `assetShape.test.ts`'s
   `asset.non-positive-dimension` cases). **The category invariant is checked at the forbidden
   thing**, which is the strongest form this guide asks for.

The existing `referenceFrame.test.ts` case is therefore not thin coverage of a feature — it is
the right and complete instrument for a different claim. `mirroredX` is a TEST-LOCAL reflection
of a polygon the test builds, and the case asserts that `anchorPresetPoint` is **equivariant**
under reflection: a derivation that remembered which side it computed from would fail it. That is
a property of `referenceFrame.ts`'s arithmetic, watched red by its siblings' recorded
`max.x`/`min.x` mutation.

**The row asks for two things that cannot exist**: "no designer mirror gesture test" — there is no
gesture; "no designer→plan mirror parity" — there is no mirrored state to be in parity about. A
case asserting either would assert the absence of a state the types cannot express, which
CLAUDE.md names as a branch that can never pay itself back.

**Proposed regrade: T37 → complete, with the row's sentence narrowed** to *"placement point and
front after rotate; mirror is a reflection EQUIVARIANCE property of `anchorPresetPoint`, asserted
once because an asset cannot be mirrored — every scale door refuses a non-positive factor."*

### The "writes version 3 back" question — the matrix's guess is wrong, and the reading is simple

`assetGeometrySidecarDetails.test.ts`'s case is titled *"reads a version 1 file as a shape with no
details, and writes version 3 back"*, and its assertion is
`expect(JSON.parse(...).schemaVersion).toBe(4)`. So **the assertion is right and the TITLE is
stale** — it was written when the DTO topped out at 3 and was not renamed when v4 landed.

It is **not** about "a narrower schema in that file's own fixture", which was the matrix's
reading: that file's `rawDocument` writes `schemaVersion: 1`, the store parses it with the same
`AssetGeometrySchema` every other read uses, and the same file's own `describe('schema version 3
fields')` block asserts `toBe(4)` too. Nothing narrower is in play.

**Two more stale sentences in the same file**, found by the same look and reported rather than
fixed: its header says *"a v1 file still reads, and every write is v2"* (writes are v4), and the
`describe('schema version 3 fields')` label. **I did not fix any of the three** — the brief says
not to fix without establishing the reading, and having established it, the file is outside my
lease and my change does not turn it red. **Recommended for the integrator**: rename to "writes
version 4 back", fix the header's "every write is v2", and relabel the describe. All three are
text-only.

## Executed checks

| Command or manual action | Commit / environment | Exit code or observed result | Evidence |
|---|---|---|---|
| `npx vitest run tests/infrastructure/obsidian/repositories/assetGeometryLegacyFixtures.test.ts` | working tree, node 22, Windows | 0 | `Test Files 1 passed (1) / Tests 3 passed (3)` |
| `npx vitest run` over `legacyFixture`, `fixtureVault`, the new file, `build/encoding`, `build/spec-files` | working tree | 0 | `Test Files 5 passed (5) / Tests 32 passed | 1 skipped (33)` |
| `npx vue-tsc -noEmit` (whole tree, `src/` + `tests/`) | working tree | 0, no diagnostics | `TSC CLEAN` |
| `npx oxlint <new test file>` | working tree | 0, no output | exit code read, not output |
| `npx eslint <new test file>` | working tree | 0, no output | `ESLINT CLEAN` |
| Encoding check on all five created/edited files | working tree | no BOM, no CR in any | table below |
| `git diff --stat -- src/` | candidate | empty | no `src/` change |

### Encoding evidence (required by the brief, `node`-read bytes and not by eye)

```
tests/vault/legacy-schema/Library/Geometry/asset-legacy-v1.rpgeo         bom=false CR=false bytes=347
tests/vault/legacy-schema/Library/Geometry/asset-legacy-v2.rpgeo         bom=false CR=false bytes=686
tests/vault/legacy-schema/Library/Geometry/asset-legacy-v3.rpgeo         bom=false CR=false bytes=1161
tests/infrastructure/obsidian/repositories/assetGeometryLegacyFixtures.test.ts bom=false CR=false bytes=6917
tests/vault/legacy-schema/README.md                                      bom=false CR=false bytes=3539
```

`tests/build/encoding.test.ts` also covered them in the run above and passed: its file set is
`git ls-files --cached --others --exclude-standard`, and all three `.rpgeo` were still untracked
at that moment, so `--others` reached them. That is not a lucky pass — the same set reaches them
once tracked.

## Watched red — verbatim

Every red below was produced by breaking the behaviour in `src/` temporarily and restoring it
with `git checkout --` immediately after. **No `src/` change is in the candidate.**

### Red 1 — `raiseLegacyVersions` returns `input` unchanged (the raise removed)

All three cases red, each naming its own file:

```
 × raises a version 1 file to a shape with no details, no groups and no review flag 148ms
 × raises a version 2 file, defaulting each graphic to closed and keeping its curves 134ms
 × raises a version 3 file, reading its open graphic and its group and leaving the clearance unflagged 136ms

Error: Expected ok, got error: {"category":"Validation","code":"asset-geometry.schema-invalid","message":"Sidecar Library/Geometry/asset-legacy-v1.rpgeo failed validation: Invalid input: expected 4","sidecarPath":"Library/Geometry/asset-legacy-v1.rpgeo"}
Error: Expected ok, got error: {"category":"Validation","code":"asset-geometry.schema-invalid","message":"Sidecar Library/Geometry/asset-legacy-v2.rpgeo failed validation: Invalid input: expected 4","sidecarPath":"Library/Geometry/asset-legacy-v2.rpgeo"}
Error: Expected ok, got error: {"category":"Validation","code":"asset-geometry.schema-invalid","message":"Sidecar Library/Geometry/asset-legacy-v3.rpgeo failed validation: Invalid input: expected 4","sidecarPath":"Library/Geometry/asset-legacy-v3.rpgeo"}
```

### Red 2 — `ClosedDetailSchemaV3`'s `kind` stops defaulting to `'closed'`

Exactly the two files whose details omit `kind`:

```
 × raises a version 2 file, defaulting each graphic to closed and keeping its curves 100ms
 × raises a version 3 file, reading its open graphic and its group and leaving the clearance unflagged 85ms

Error: Expected ok, got error: {"category":"Validation","code":"asset-geometry.schema-invalid","message":"Sidecar Library/Geometry/asset-legacy-v2.rpgeo failed validation: Invalid input","sidecarPath":"Library/Geometry/asset-legacy-v2.rpgeo"}
Error: Expected ok, got error: {"category":"Validation","code":"asset-geometry.schema-invalid","message":"Sidecar Library/Geometry/asset-legacy-v3.rpgeo failed validation: Invalid input","sidecarPath":"Library/Geometry/asset-legacy-v3.rpgeo"}
```

### Red 3 — `clearanceNeedsReview` defaults to `true`

All three, and **v3 is the one that catches it as an ASSERTION** rather than as a validator
refusal, which is why v3 carries a clearance at all:

```
 × raises a version 1 file to a shape with no details, no groups and no review flag 99ms
 × raises a version 2 file, defaulting each graphic to closed and keeping its curves 90ms
 × raises a version 3 file, reading its open graphic and its group and leaving the clearance unflagged 112ms

Error: Expected ok, got error: {"category":"Validation","code":"asset.absent-clearance-cannot-need-review","message":"A shape with no clearance has no boundary to review.","sidecarPath":"Library/Geometry/asset-legacy-v1.rpgeo"}
Error: Expected ok, got error: {"category":"Validation","code":"asset.absent-clearance-cannot-need-review","message":"A shape with no clearance has no boundary to review.","sidecarPath":"Library/Geometry/asset-legacy-v2.rpgeo"}
AssertionError: expected true to be false // Object.is equality
```

### Red 4 — the fixture is actually READ (no `src/` change; the file was moved away)

```
 × raises a version 3 file, reading its open graphic and its group and leaving the clearance unflagged 119ms
Error: ENOENT: no such file or directory, open 'D:\tmp-claude\rp-vault-PmH5di\Library\Geometry\asset-legacy-v3.rpgeo'
      Tests  1 failed | 2 passed (3)
```

**This is the red the brief asked for specifically**, and it is worth reading closely: it shows
the fixture reaching the port through the temp-dir CLONE `openFixtureVault` makes, so the bytes
under test are the checked-in bytes. It also demonstrates why the declared-version read is in the
helper: **this port answers an absent sidecar with a SUCCESS** (`{ calibration: null, shape: null }`
at revision 0), so without it a deleted fixture would have produced a quieter and more confusing
failure than ENOENT.

## Verification not performed

- **`npm run check`, `check:fast`, `test:coverage`, `analyze`, `build`, `harness`,
  `harness-shot`, `test-build`** — all explicitly not this card's to run; two other cards were
  working on the same machine. CI on the PR is where they belong.
- **Coverage floors** — not measured. The change adds test files and three JSON fixtures and no
  `src/` line, so it cannot lower a floor; it may raise measured coverage of
  `raiseLegacyVersions` and `ObsidianAssetGeometrySidecar`'s mapping arms, which is CI's to
  report.
- **`npm run analyze` (fallow)** — not run. Worth naming: fallow's duplication half skips
  `*.test.ts` entirely, so the new test file is invisible to it either way; the new fixtures are
  `.rpgeo` data.
- **`eslint .` over the whole tree** — only the one new file was linted (plus oxlint on it). The
  README is Markdown and the `.rpgeo` are data; neither is linted.
- **A live vault (`npm run test-build`)** — nothing here draws, and no Obsidian API is newly
  assumed. Not applicable, not skipped for convenience.
- **Whether `assetGeometrySidecarDetails.test.ts`'s stale title is the ONLY stale one in that
  file** — I read its header, the named case and the `describe` labels, and report three. I did
  not audit every docblock in it.

## Data and integration implications

Schema/migration change: **none.** No `src/` change; `raiseLegacyVersions` and every schema
version are untouched. What changed is that three legacy documents now exist as BYTES that the
suite reads, so any future non-additive change to v1/v2/v3 reading turns these red.

Relevant renderer/export/revision consumers: none. The fixtures are read-only input to one test
file; `openFixtureVault` copies the tree to a temp dir and discards it.

Undo/no-op/conflict/failure coverage: not in scope — the new cases are reads. The write half is
already owned by `assetGeometrySidecar.test.ts` and `assetGeometrySidecarDetails.test.ts`.

Identity/unit/quantity/calibration invariants: each fixture declares `"unit": "mm"` (ADR-009) and
an `assetId` matching its filename, so the store's `asset-id-mismatch` guard passes rather than
being bypassed. `calibration` is `null` in all three — deliberately: calibration is not what these
rows are about, and claiming otherwise would be a sentence wider than the check.

Shared root/runtime/locales wiring still required: none.

Rollback/recovery considerations: reverting the commit removes three fixtures and one test file
and restores the README. Nothing in `src/` depends on any of it.

### Two findings for the integrator, neither fixed here

1. **`FixtureStack` does not declare `libraryFolder`, but `openFixtureVault` returns it.**
   `tests/helpers/fixtureVault.ts` sets `libraryFolder: DEFAULT_LIBRARY_FOLDER` on the returned
   object; the exported interface omits it, so `vue-tsc` reports
   `TS2339: Property 'libraryFolder' does not exist on type 'FixtureStack'` at any consumer that
   names it. `RepositoryStack` (the in-memory sibling) *does* declare it, so the two stacks
   disagree — which is the exact drift `stackFoundation` was extracted to end. I worked around it
   by spelling the fixture path literally, with a comment saying why, rather than editing a shared
   helper two other cards could be in. **One line on the interface is the fix.**
2. The three stale sentences in `assetGeometrySidecarDetails.test.ts`, listed above.

## Reviewer and integrator acceptance

Reviewer outcome and findings:
Integrated commit:
Post-integration checks/evidence:
Final status: integrated / verified / blocked
