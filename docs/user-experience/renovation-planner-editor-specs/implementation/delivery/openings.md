# Opening schema 5 delivery reconstruction

Status: **validation pending**. Branch `codex/editor-deliver-openings`, based on Room-edge delivery `93b9d2b49b7bc718248b4db7a63ab065f65028e9`. Source tip `785af2e207f56f496ee1d85cd95c2d4b480cecc6`; the commit containing this mapping changes documentation only.

| Original commit | Reconstructed commit |
|---|---|
| `ae1d1c304e0b9e56baad85dbd59745635b8b7e4b` | `c95b60a32f22009ae845d51616618e75cb305dc5` |
| `618531b8b253e0d1bf5f93ab34e57f52521aca0a` | `785af2e207f56f496ee1d85cd95c2d4b480cecc6` |

Only these two original concern diffs were transferred. No inherited integration history or schema 6/7/8 changes are included.

## Contract and context resolution

The optional Door/Window swing object has `hinge: start|end`, `side: left|right`, and finite angle 0–180. Missing metadata remains missing; rendering defaults to Door 90 degrees and Window 0. Plain Opening has no leaf or swing. Current and intended metadata trigger writer version 5; legacy no-swing documents retain their lower writer version. Registered migration ends at 5.

Placement uses the pointer as the opening center, clamps valid bounds, preserves leading-edge offset storage and renders native cuts/frames/leaves. This stage retains the original reviewed move-to-point method; later explicit Move tooling and curved-host projection belong to their separate concerns.

The one content conflict was in `StructureLayer.vue` imports/props: retain the existing `useEditorStore`, assigned `props`, `draftViewport` computation and `WallDraftOverlay :viewport` binding from the Room-edge/hover base. Add the opening-specific validated draft preview and symbol component alongside those behaviors. No controls, prior hover behavior, creation flow, shell or Room-edge code were removed. Locale additions merged additively.

## Original evidence and validation

The original [opening work record](../opening-usability.md) is Git-blob-identical to `618531b8b253e0d1bf5f93ab34e57f52521aca0a`. Its historical 20/20 foundation and 61/61 continuation results remain attributed to the original work; they are not verification of this reconstructed cumulative tip. These two commits supplied no screenshot bundle. All inherited evidence paths are unchanged from the Room-edge base, with original capture identifiers retained. No new browser/native visual acceptance is claimed.

Only Git source review, historical document blob comparison and `git diff --check` were performed. No tests, lint, types, coverage, browser/native capture, push, PR or integration checkout changes were run. Fresh cumulative validation remains pending with the parent.

## Changed-file audit

31 concern files before this mapping: ADR/work record, schema/domain/repository projection handling, opening forms/rendering/placement, additive EN/DE labels, and focused tests. No dependency manifests changed.

- `docs/development/adrs/0020-connected-walls-and-hosted-openings.md`
- `docs/user-experience/renovation-planner-editor-specs/implementation/opening-usability.md`
- `src/application/commands/spatial/sameGeometryDocument.ts`
- `src/domain/spatial/Structure.ts`
- `src/domain/spatial/openingGeometry.ts`
- `src/domain/spatial/openingSwing.ts`
- `src/domain/spatial/structureGeometry.ts`
- `src/infrastructure/obsidian/repositories/PlanGeometryStore.ts`
- `src/infrastructure/persistence/dto/planGeometry.ts`
- `src/infrastructure/persistence/migration/geometry/plan/plan-geometry.migrations.ts`
- `src/presentation/editor/structure/OpeningSwingFields.vue`
- `src/presentation/editor/structure/OpeningSymbols.vue`
- `src/presentation/editor/structure/StructureEditForm.vue`
- `src/presentation/editor/structure/StructureLayer.vue`
- `src/presentation/editor/structure/StructureTaskForm.vue`
- `src/presentation/editor/structure/StructureTool.ts`
- `src/presentation/editor/structure/openingSwingDraft.ts`
- `src/presentation/editor/structure/spatialMessage.ts`
- `src/presentation/editor/structure/structureActions.ts`
- `src/presentation/editor/structure/structureDraft.ts`
- `src/presentation/editor/structure/structureTask.ts`
- `src/presentation/i18n/locales/de/editor.ts`
- `src/presentation/i18n/locales/de/opening.ts`
- `src/presentation/i18n/locales/en/editor.ts`
- `src/presentation/i18n/locales/en/opening.ts`
- `tests/domain/spatial/openingGeometry.test.ts`
- `tests/infrastructure/obsidian/repositories/openingSwingPersistence.test.ts`
- `tests/infrastructure/obsidian/repositories/structurePersistence.test.ts`
- `tests/plugin/persistence-wiring.test.ts`
- `tests/presentation/editor/openingUsability.test.ts`
- `tests/presentation/editor/structureDraft.test.ts`
