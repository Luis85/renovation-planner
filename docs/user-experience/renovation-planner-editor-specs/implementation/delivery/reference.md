# Reference viewport delivery reconstruction

Status: **validation pending**. Branch `codex/editor-deliver-reference` from Photo Add delivery `6c6699ea9a9fda7e9cfe1a35c5f3b010b4607e3f`. Source/test tip `ac02ab6f01650f34d7665105032f3482f4e09432`; this mapping is a later documentation-only commit.

| Original commit | Reconstructed commit | Scope |
|---|---|---|
| `d2d5d1653e6729ed9cf10922913db400dd902bd0` | `23ceb7a5a4c47e7675b65533771a903a18cf7773` | Full reference viewport concern |
| `9aa4f6c2b3221f44ffe5ee1e5968338c5a389e43` | `9022bf5514a8e0c052c456d549e3a34567ebcd43` | Private pointer helper name and receipt |
| `df0df5f70e4282541d15d83129cd7b53b9b6043f` | `30db9fcb830ede9909a119d3145bbcb867d4c337` | Only referenceViewportControls.test.ts and referenceWorkflow.e2e.test.ts |
| `e02984e24762c38caba1311a268b6328a14ad8e3` | `ac02ab6f01650f34d7665105032f3482f4e09432` | Reference fixture repair and receipt |

Only these owned diffs were transferred. The locale conflict was additive: preserve both Opening and ReferenceViewport imports/spreads in EN/DE, together with existing Input/Shell/Creation labels. No other source conflicts occurred. No Group/Curve schema history, OpeningMove tests, ExistingPhotoStrip tests, Photo-only tests from df0, or supplemental combined journey 185 was added in this concern. Photo's already reconstructed tests remain inherited from the base.

The larger Reference viewport retains the original pixel-anchored A/B calibration, pan/zoom/Fit, bounded reference source choices and native-theme drawing. The private pointer helper is `previewPointerPoint`, keeping the single branded stage-coordinate factory declaration intact. Wheel tests use native event dispatch; the pixel-only theme test synchronizes its real backing before redraw, with pixel/label assertions retained.

## Original provenance and limits

The [original reference work record](../reference-viewport.md) is Git-blob-identical to 9aa4f6c2, and [fixture repair receipt](../reference-fixture-repair.md) to e02984e2. ReferencePreview matches 9aa4f6c2, the viewport control test matches e02984e2, and the workflow test matches df0df5f7. Historical source/check identifiers remain unchanged; they do not describe acceptance of this reconstructed cumulative tip.

These commits supplied no screenshot bundle. All inherited evidence paths remain unchanged; original nine final journeys/eighteen comparisons are preserved. The original combined 408-pass/7-fail result and unverified fixture-repair status in the receipt are historical facts, not new gate results. Fresh visual acceptance must measure actual painted preview size for the relevant viewport rather than treating the nominal old 400×220 canvas as a universal rendered baseline.

Only source review, Git blob comparisons and diff whitespace inspection ran. No tests, lint, types, coverage, browser/native captures, push/PR or integration checkout changes. Fresh cumulative validation remains pending with the parent.

## Changed files

17 concern files before this mapping:

- `docs/user-experience/renovation-planner-editor-specs/implementation/reference-fixture-repair.md`
- `docs/user-experience/renovation-planner-editor-specs/implementation/reference-viewport.md`
- `src/presentation/editor/reference/ReferencePrepare.vue`
- `src/presentation/editor/reference/ReferencePreview.vue`
- `src/presentation/editor/reference/ReferenceSetupForm.vue`
- `src/presentation/editor/reference/referenceAction.ts`
- `src/presentation/editor/reference/referenceSetup.ts`
- `src/presentation/editor/reference/referenceViewport.ts`
- `src/presentation/i18n/locales/de/editor.ts`
- `src/presentation/i18n/locales/de/referenceViewport.ts`
- `src/presentation/i18n/locales/en/editor.ts`
- `src/presentation/i18n/locales/en/referenceViewport.ts`
- `styles/editor-reference-viewport.css`
- `styles/index.css`
- `tests/presentation/editor/referenceViewport.test.ts`
- `tests/presentation/editor/referenceViewportControls.test.ts`
- `tests/presentation/editor/referenceWorkflow.e2e.test.ts`
