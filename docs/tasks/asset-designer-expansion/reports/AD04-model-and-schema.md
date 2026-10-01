# Task report — AD04, evolve the asset schema and migrations without data loss

Contract revision: `r1`. Base commit: `fa51ae88d`. Executed serially by the lead agent; no work was
delegated.

## What landed

| Area | Change |
|---|---|
| `src/core/geometry/CurvedPath.ts` | New: the open curved polyline. Two points or more, one bulge per SEGMENT, finite coordinates, some length overall. **Branded** with a `unique symbol` the module never exports, so the only way to hold one is `createCurvedPath` and a path is not interchangeable with a `CurvedPolygon` |
| `src/core/geometry/CurvedPolygon.ts` | `validateBulgeEdge` extracted and shared, so the semicircle ceiling and the representable-radius rule have one spelling for both types |
| `src/core/geometry/Point.ts` | `firstNonFinitePoint` shared by `createPolygon` and `createCurvedPath` — the second copy of that scan was reported as a clone group the moment it appeared |
| `src/domain/asset/AssetDetail.ts` | `AssetDetail` is a union: `ClosedDetail` (`kind?: 'closed'`, `outline: CurvedPolygon`) and `OpenDetail` (`kind: 'open'`, `outline: CurvedPath`). Optional user `label` beside the stable semantic `name`. `mapDetailOutline` keeps a graphic's kind through a point-wise transform |
| `src/domain/asset/AssetShape.ts` | `groups?: readonly AssetGroup[]`, validated: six refusals, never a repair. `validateAssetShape` split into `validateClearance`, `validatePlacement`, `validateGroups`/`validateMembers` to stay inside the complexity budget the addition pushed it over |
| `src/domain/asset/shapeEdits.ts` | `outlineOf` answers `null` for an open graphic, so every outline gesture stays closed-only until AD11; `scaled` is generic over both geometries |
| `src/infrastructure/persistence/dto/assetGeometry.ts` | Schema **v3**: a union on `kind`, optional `label`, `groups`. Reads v1, v2 and v3; emits 3; refuses 4 |
| `src/infrastructure/obsidian/repositories/AssetGeometryStore.ts` | One `SCHEMA_VERSION` constant where two literal `2`s used to be |
| `ObsidianAssetGeometrySidecar.ts` | Carries `kind`, `label` and groups both ways; an open path goes through `createCurvedPath`, and a refusal becomes an empty path the shape validator then refuses — one damaged graphic refuses the document rather than vanishing from the drawing |

## Acceptance criteria

| Criterion | Where it is checked |
|---|---|
| Legacy ids, order, names, bulges, scale flags, calibration, anchor, facing survive migration | `assetGeometry.test.ts` "raises a version 1 document to version 3", "raises a version 2 document to version 3"; `assetGeometrySidecarDetails.test.ts` round-trip |
| Missing optional data distinguished from present malformed data | `assetGeometry.test.ts` "refuses a kind outside the union rather than defaulting it to closed", plus the pre-existing `footprintPending` case |
| Groups hold graphic ids only, no cycles, no dangling, no duplicates | `assetDetail.test.ts` six-case `it.each`, watched red against disabled guards |
| Open paths have finite valid points and are never faked as zero-area polygons | `curvedPath.test.ts` (16 cases), `assetDetail.test.ts` open-graphic cases |
| An older build refuses a newer schema rather than stripping fields | `assetGeometry.test.ts` "is refused by a version-1-only schema"; "refuses a version this build does not know" now asserts 4 |
| Existing consumers compile; old behaviour still works | `vue-tsc` exit 0; 305 inner-layer test files, 3518 cases |

**Not met, and named rather than waived:** *"Failed migration or persistence leaves original content
recoverable"* has no new test here. Nothing rewrites a file on read, and the write path is the
existing conditional one, so the property is inherited rather than established — AD14 is where it is
actually exercised.

## Commands

| Command | Exit | Notes |
|---|---|---|
| `npx vue-tsc -noEmit` | 0 | |
| `npx oxlint --deny-warnings` | 0 | |
| `npm run analyze` | 0 | Reached 0 only after deleting three speculative exports (`detailPoints`, `detailPolyline`, `detailIsClosed`), un-exporting `pathHasCurves`, exporting `DetailBase` to clear two private-type leaks, sharing the finite-point scan to clear a clone group, and splitting four validators back under the cognitive threshold |
| `npx vitest run tests/domain tests/core tests/infrastructure tests/application` | 0 | 305 files, 3518 cases |
| `npx vitest run` (whole suite, before the analyze-driven refactors) | 1 | 1011 of 1017 files passed. **Five failures, none of them this change**: four are 5-second case timeouts that pass when re-run alone (`reversibleWritePathDiscovery`, `buttonSpecificity`, `linearElements.e2e`, `rotationInspectorRoutes`), and `lint-edited.test.ts`'s SFC case exceeded its 60 s budget at 63.8 s — it takes 8.2 s alone. The machine was shared with other agents at ~67% load throughout |
| `npm run check` | — | **not run** on this tree |
| Real Obsidian | — | **not run**; unavailable in this environment |

## Two decisions worth reading

**The brand replaced a rename.** The plan said the open arm's geometry would be called `path`, so an
unnarrowed `detail.outline` read would stop compiling. Measured: that turned ~70 reads red across 20
test files, every one a legitimate assertion about a closed graphic. A `unique symbol` brand on
`CurvedPath` buys the identical guarantee — a path cannot be passed where a polygon is expected —
while `.points` stays readable on the union. `AD04-MODEL-EXTENSION.md` §3 keeps the rejected version.

**`kind` is optional on the closed arm.** Every literal written before AD04 stays valid, and
`validateDetails` stamps the discriminant onto everything it returns, so a validated shape always
carries it. The cost — a new construction site could omit `kind` and mean open — is stated at the
type, and becomes a missing required field on the other arm the day anything can build one.
