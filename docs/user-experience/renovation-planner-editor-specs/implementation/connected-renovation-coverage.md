# Connected renovation workflow: changed-file coverage

Measured from the complete Windows Node 24 coverage run with `VITEST_MAX_WORKERS=2` on 2026-09-06. The source tree is the continuation of PR #86 at `866ccc38e0c853b6c0f0ad7a27173f5c96c1b879`. No coverage exclusion or floor was changed.

## Aggregate measurement

| Metric | Covered / total | Coverage | Floor |
|---|---:|---:|---:|
| Statements | 13096 / 13197 | 99.23% | 99% |
| Branches | 8103 / 8263 | 98.06% | 98% |
| Functions | 3625 / 3655 | 99.17% | 99% |
| Lines | 10855 / 10901 | 99.57% | 99% |

75 changed source files have executable coverage entries. Files containing only types, CSS, documentation or tests are outside that count. These figures cover each entire changed file, including inherited code; they are not a claim of 100% diff coverage.

| Changed-file metric | Covered / total | Coverage |
|---|---:|---:|
| Statements | 2587 / 2604 | 99.34% |
| Branches | 1821 / 1858 | 98.0% |
| Functions | 722 / 731 | 98.76% |
| Lines | 2009 / 2016 | 99.65% |

## Files with remaining uncovered positions

S/F/L/B are statement/function/line/branch percentages. Position columns are source line numbers reported by Istanbul; several branch arms may share a line. “Added-line overlap” identifies uncovered positions intersecting added diff lines, not a semantic classification of an entire function. All other listed positions are outside those added lines.

| File | S / F / L / B | Uncovered statements | Uncovered functions | Uncovered branches | Added-line overlap |
|---|---|---|---|---|---|
| `src/application/commands/plan/ReversibleCalibratePlan.ts` | 98.48 / 100 / 100 / 95.12 | 103 | — | 101, 103 | — |
| `src/domain/renovation/Renovation.ts` | 100 / 100 / 100 / 98.82 | — | — | 120 | 120 |
| `src/domain/renovation/renovationTargets.ts` | 100 / 100 / 100 / 96.42 | — | — | 33 | 33 |
| `src/infrastructure/obsidian/repositories/ObsidianZoneRepository.ts` | 99.25 / 100 / 100 / 97.05 | 462 | — | 454, 462 | — |
| `src/infrastructure/obsidian/repositories/PlanGeometryStore.ts` | 100 / 100 / 100 / 98.24 | — | — | 31 | — |
| `src/infrastructure/obsidian/repositories/renovationGeometryGuard.ts` | 96 / 100 / 93.33 / 100 | 31 | — | — | 31 |
| `src/presentation/editor/planEditorCommands.ts` | 93.33 / 92.3 / 100 / 100 | 206 | 206 | — | — |
| `src/presentation/editor/runtime.ts` | 100 / 100 / 100 / 98.11 | — | — | 273 | — |
| `src/presentation/editor/layers/InteractionLayer.vue` | 100 / 100 / 100 / 97.82 | — | — | 139 | — |
| `src/presentation/editor/renovation/PlannedFields.vue` | 90 / 83.33 / 88.88 / 100 | 38 | 38 | — | 38 |
| `src/presentation/editor/renovation/RenovationForm.vue` | 91.3 / 72.22 / 89.58 / 95.31 | 61, 99, 106, 107, 114, 120 | 99, 106, 107, 114, 120 | 42, 61, 66 | 42, 61, 66, 99, 106, 107, 114, 120 |
| `src/presentation/editor/renovation/RenovationInspector.vue` | 96 / 87.5 / 100 / 94.44 | 17 | 17 | 26 | 17, 26 |
| `src/presentation/editor/renovation/RenovationLayer.vue` | 97.95 / 100 / 100 / 91.3 | 36 | — | 17, 34, 36 | 17, 34, 36 |
| `src/presentation/editor/renovation/ReviewInspector.vue` | 97.05 / 100 / 100 / 94.59 | 22 | — | 22, 24 | 22, 24 |
| `src/presentation/editor/renovation/SubjectRow.vue` | 100 / 100 / 100 / 94.59 | — | — | 76 | 76 |
| `src/presentation/editor/renovation/renovationActions.ts` | 100 / 100 / 100 / 95.34 | — | — | 64, 81, 84, 97 | 64, 81, 84, 97 |
| `src/presentation/editor/renovation/renovationDraft.ts` | 100 / 100 / 100 / 97.14 | — | — | 14 | 14 |
| `src/presentation/editor/shell/EntityInspector.vue` | 100 / 100 / 100 / 92.85 | — | — | 59 | — |
| `src/presentation/editor/shell/RoomInspector.vue` | 100 / 100 / 100 / 96.77 | — | — | 113 | — |
| `src/presentation/editor/structure/structureActions.ts` | 97.59 / 100 / 100 / 95.38 | 69 | — | 50, 52, 69 | 69 |
| `src/presentation/editor/structure/structureTask.ts` | 100 / 100 / 100 / 98.55 | — | — | 42 | — |
| `src/presentation/editor/surface/EditorSurface.vue` | 99.58 / 97.05 / 100 / 97.23 | 1227 | 1335 | 262, 316, 1053, 1227 | — |

Remaining new-code gaps are primarily optional/missing-data and disposed-response branches, fallback labels for incomplete records, and Vue-generated model-replacement callbacks. The field components mutate properties of the root-owned draft; the compiler still generates replacement listeners whose separate invocation is not exercised by those input routes. These are disclosed rather than excluded. Spatial draft lifecycle and legacy calibration fallback branches remain listed alongside them.

The coverage result is supplemented by actual repository failure/peer-history tests and browser keyboard evidence. It does not prove crash recovery, host filesystem atomicity, screenreader behavior or full M08–M17 acceptance. See [workflow evidence](connected-renovation-evidence.md).

## Changed files at 100% in all four metrics

- `src/application/commands/renovation/RenovationCommand.ts`
- `src/application/commands/spatial/sameGeometryDocument.ts`
- `src/application/commands/zone/restore-zone.ts`
- `src/application/commands/zone/reversible-create-zone-command.ts`
- `src/application/commands/zone/reversible-rename-zone-command.ts`
- `src/application/editor/recordRelatedWrite.ts`
- `src/application/events/planChangeSource.ts`
- `src/application/ports/PlanGeometrySidecar.ts`
- `src/application/ports/ReviewNotes.ts`
- `src/application/ports/versioning.ts`
- `src/domain/plan/Plan.ts`
- `src/domain/renovation/sameRenovation.ts`
- `src/infrastructure/obsidian/repositories/ObsidianPlanGeometrySidecar.ts`
- `src/infrastructure/obsidian/repositories/ObsidianPlanRepository.ts`
- `src/infrastructure/obsidian/repositories/ObsidianReviewNotes.ts`
- `src/infrastructure/obsidian/repositories/digest.ts`
- `src/infrastructure/obsidian/workspace/openReviewNote.ts`
- `src/infrastructure/persistence/dto/planFrontmatter.ts`
- `src/infrastructure/persistence/dto/planGeometry.ts`
- `src/infrastructure/persistence/dto/renovation.ts`
- `src/infrastructure/persistence/mappers/planMapper.ts`
- `src/infrastructure/persistence/migration/entities/plan/plan.migrations.ts`
- `src/infrastructure/persistence/migration/geometry/plan/plan-geometry.migrations.ts`
- `src/plugin/guardedRenovation.ts`
- `src/plugin/planEditorDeps.ts`
- `src/plugin/reviewNoteAction.ts`
- `src/presentation/editor/PlanCanvas.vue`
- `src/presentation/editor/PlanEditorRoot.vue`
- `src/presentation/editor/add/AreaCornerEditor.vue`
- `src/presentation/editor/renovation/DecisionFields.vue`
- `src/presentation/editor/renovation/DecisionList.vue`
- `src/presentation/editor/renovation/ExistingFields.vue`
- `src/presentation/editor/renovation/PlannedGeometryFields.vue`
- `src/presentation/editor/renovation/RenovationEntry.vue`
- `src/presentation/editor/renovation/RoomRenovationDetails.vue`
- `src/presentation/editor/renovation/WorkFields.vue`
- `src/presentation/editor/renovation/WorkRow.vue`
- `src/presentation/editor/renovation/plannedGeometry.ts`
- `src/presentation/editor/renovation/renovationDeleteGuard.ts`
- `src/presentation/editor/renovation/renovationMessage.ts`
- `src/presentation/editor/renovation/renovationRemoval.ts`
- `src/presentation/editor/renovation/renovationSession.ts`
- `src/presentation/editor/shell/EditorContextBar.vue`
- `src/presentation/editor/shell/PropertyLayerPanel.vue`
- `src/presentation/editor/structure/StructureLayer.vue`
- `src/presentation/editor/tools/reversible-move-zone-command.ts`
- `src/presentation/i18n/locales/de.ts`
- `src/presentation/i18n/locales/en.ts`
- `src/presentation/i18n/locales/de/renovation.ts`
- `src/presentation/i18n/locales/en/renovation.ts`
- `src/presentation/read-models/PlanDto.ts`
- `src/presentation/read-models/planEditorQueries.ts`
- `src/presentation/stores/ProjectStore.ts`
