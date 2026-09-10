# Post-b10 acceptance test synchronization

Status: **latest global full gate pending**. Acceptance branch `codex/editor-deliver-acceptance`; parent `95449bc89ad3812e1e9a35e95f495675d49a08c5`. This single test-verification commit transfers only the net `b10c3b24..1aef6f0cc8c8ea4fa9d7a5245eec0c11a0f0e34b` changes under `tests/` and the six named coverage receipts below. It does not import integration ancestry or production changes.

## Exact comparison

Comparison target: frozen reviewed integration `1aef6f0cc8c8ea4fa9d7a5245eec0c11a0f0e34b`. The staged payload before this mapping has tree `520a070628172809b761757901b8a1942436f8b1`. Git subtree/blob IDs establish exact identity, not an assumption from equal filenames:

| Scope | Matching Git tree ID | Result |
|---|---|---|
| `src/` | `ef32328ba7dfc113a6e80a3781311d6eeaae514d` | Exact tree match |
| `styles/` | `0ae10d132b625db91dd92c9da4a731a4eb24b7e6` | Exact tree match |
| `tests/` | `bf6c9645ed6e108f04192350f11ad7db4f38c484` | Exact tree match |
| `scripts/` | `9e09c17cf56895d0876fb1f7815dfd0e2a29b503` | Exact tree match |

All 14 checked root configuration/build files and `.github` match exactly: `.fallowrc.json`, `.gitattributes`, `.github`, `.gitignore`, `.oxlintrc.json`, `eslint.config.mjs`, `manifest.json`, `package-lock.json`, `package.json`, `tsconfig.json`, `versions.json`, `vite.config.ts`, `vite.harness.config.ts`, `vitest.config.ts`. No configuration was changed here. Production/style identity was already present through quality reconstruction `2259f0a577f4673e2d834148036e03b3ca095792`; this commit changes tests and receipts only. No source, style, script or checked configuration difference remains against the comparison target.

## Original to reconstructed provenance

The following original commits contributed reviewed tests or owned receipts. Their scoped **net diffs**, including later corrections, map to this one test-verification commit (the commit containing this receipt), with parent and payload tree identified above. Source portions of mixed commits are not copied:

| Original commit | Original subject |
|---|---|
| `1aef6f0cc8c8ea4fa9d7a5245eec0c11a0f0e34b` | Compare inverse zoom coordinates within floating-point precision |
| `9f481088ce36b1112234890325392744cdce7a1e` | Declare the retired metadata write mock contract |
| `edc2934acf99ae97ca456d93b7fb60d611498c91` | Cover legacy Room planning and retired metadata forms |
| `1736a61a3f7396dd78b32392fdda6d969350f871` | Verify shared rotation dispatch across active and retired contexts |
| `ee4f539ce7d0c1c409e0385ae462390ce91a619a` | Cover price-read refusals and remaining spatial quantity boundaries |
| `39fb4ad2c3a0738f38adb00e5ffe7d231224a9a1` | Cover native shell navigation and task completion paths |
| `1cea3b2a5f605f104314831c69ca052c0e071bbd` | Use valid element identity and the Room rotation write boundary |
| `2b319be2e02127697894824d61ba7630146f958e` | Reactively retire wall reviews and correct recovery fixtures |
| `d1156b16127aeea9bbaf81114f1cd1ab066a703d` | Exercise geometric refusal with a schema-valid collapsed curve |
| `d5138c03542574004bdd7745d7a35d21f6378b67` | Match endpoint precision and compensated move expectations |
| `56a63e3281e929bce99916072e4f9d766d9ecf36` | Drive missing Room names through the projection query boundary |
| `68d42ac89fec1215f7e5e8a33a995b0bbebf66b7` | Type the boundary-test mocks and keep async contracts explicit |
| `7a0a1c604494bf7fadc495769db20e757bb379ea` | Exercise grouped action admission and rotation recovery |
| `a8f48dd477eeebd5d4f03422e35efd59437de773` | Cover native modal sizing and navigation ownership races |
| `eb0fa56ceac6a4ed81977c684bb5c7240c9629e1` | Cover element move and native placement admission boundaries |
| `469a01b6b7a384349264d5cddaaf688ba8ad7cbe` | Exercise group membership and frozen geometry version boundaries |
| `bdb0fb013678c46842f77b73a670b96028122447` | Cover wall rotation recovery and retired opening commits |
| `85c3fdef6abb6026cd31c1c76039af8f34ca45c7` | Exercise curved operation refusals and group transform boundaries |
| `b33567b07344c8939d12250841344941a795e97e` | Cover curve pointer completion and tool lifetime boundaries |

The 27 changed test files match the complete integration tests tree, including native mock typings, schema-valid curve fixture, Room rotation write-port correction, reactive wall-review assertions, and inverse-zoom floating-point correction. Six original receipts were copied as exact blobs: `curve-tool-coverage.md`, `element-admission-coverage.md`, `geometry-boundary-coverage.md`, `group-rotation-admission-coverage.md`, `shell-input-coverage.md`, `wall-opening-coverage.md`. Their dated failed/pending statements remain historical provenance and are not rewritten as new acceptance.

## Verification boundary

Root reported the reviewed additions at 190/191 passing, followed by the corrected 14/14 targeted retry. Earlier attempts, including 155/168 and their fixture/runtime corrections, remain in the original logs and receipts. These targeted results belong to the reviewed integration run; no test, lint, types, coverage or capture process ran during this synchronization.

The earlier frozen b10 full run passed 730 files / 8624 tests but failed coverage. A diagnostic coverage union helped locate remaining cases; it is **not** a gate input or acceptance result. The latest unchanged global full gate against the updated integration source is still pending. Do not claim full-gate or visual completion from tree identity or targeted passes.

All inherited capture evidence remains unchanged from the acceptance parent, with original source/build IDs and limitations. Existing nine final journeys/eighteen comparisons are untouched. No push/PR or root integration checkout edit occurred.

## Transferred test files

- `tests/application/commands/requirement/priceReadBoundary.test.ts`
- `tests/core/geometry/curvedOperationBoundaries.test.ts`
- `tests/domain/geometryQuantityRefusals.test.ts`
- `tests/domain/groupMembershipBoundaries.test.ts`
- `tests/infrastructure/obsidian/repositories/groupVersionBoundaries.test.ts`
- `tests/presentation/editor/curvePointerCompletion.test.ts`
- `tests/presentation/editor/curveToolLifetime.test.ts`
- `tests/presentation/editor/elementMoveAdmission.test.ts`
- `tests/presentation/editor/elementNativeBoundaries.test.ts`
- `tests/presentation/editor/groupAdmissionCoverage.test.ts`
- `tests/presentation/editor/groupRotationDispatchBoundary.test.ts`
- `tests/presentation/editor/groupTransformBoundaries.test.ts`
- `tests/presentation/editor/legacyRoomPlanning.test.ts`
- `tests/presentation/editor/linkedSummaryFocus.test.ts`
- `tests/presentation/editor/nativeShellInputBoundaries.test.ts`
- `tests/presentation/editor/openingMove.test.ts`
- `tests/presentation/editor/openingSwingQueuedInput.test.ts`
- `tests/presentation/editor/photoAdd.test.ts`
- `tests/presentation/editor/planningDialogLifecycle.test.ts`
- `tests/presentation/editor/referenceViewportControls.test.ts`
- `tests/presentation/editor/referenceWorkflow.e2e.test.ts`
- `tests/presentation/editor/retiredMetadataForms.test.ts`
- `tests/presentation/editor/rotationRecoveryBoundary.test.ts`
- `tests/presentation/editor/structureDraftAdmission.test.ts`
- `tests/presentation/editor/taskBannerOperationBoundaries.test.ts`
- `tests/presentation/editor/wallRotationFormRecovery.test.ts`
- `tests/presentation/editor/wallRotationRuntime.test.ts`

## Final buffer-test synchronization

This follow-up transfers only the reviewed `1aef6f0c..15e4b0d7d6a76f3681f5695dc0af938f5e418c85` test/receipt diffs onto acceptance `689cf45b5165c129bc887027e0a9ae4e03e04512`:

- `59ae7f648d6e802d5fad999c649833e4665c0507`: zoneDisappearanceBoundaries.test.ts and geometry-boundary-coverage.md.
- `437e8325d51c4d8848e4e9582b6d069148e7864e`: nativeViewCurveBoundaries.test.ts and shell-input-coverage.md.

Both original scoped test runs passed 2/2 cases, four added cases total. Their two receipts remain exact original blobs. These changes are reconstructed as the single commit containing this follow-up, whose pre-mapping staged tree is `d91d81d251e0fdb83ccf025e042c4363a0528d9d`.

Exact comparison against frozen `15e4b0d7d6a76f3681f5695dc0af938f5e418c85`:

| Scope | Matching Git subtree ID |
|---|---|
| `src/` | `ef32328ba7dfc113a6e80a3781311d6eeaae514d` |
| `styles/` | `0ae10d132b625db91dd92c9da4a731a4eb24b7e6` |
| `tests/` | `8d5fb21dff7c8ff86c55944f4cef4ac69f6aef34` |
| `scripts/` | `9e09c17cf56895d0876fb1f7815dfd0e2a29b503` |

The same 14 checked root build/configuration paths and `.github` also match exactly. No source, style, script, configuration or historical evidence was changed by this follow-up. Original capture source/build provenance is unchanged.

The unchanged global check (root session 54808) is still running. **No full-gate pass or global coverage acceptance is claimed.** No heavy check, push/PR or root checkout edit ran during synchronization; Git source/blob comparison and diff whitespace checks only.
