# Connected planning: coverage ledger

Measured from the complete `npm run check` with `VITEST_MAX_WORKERS=2` on 2026-09-06.
The unchanged gates are 99% statements/functions/lines and 98% branches. No exclusions, skips,
complexity limits or thresholds were added for this feature. `.fallowrc.json` adds only the
new browser entry point.

Scope: every `src/` file in `git diff --name-only origin/codex/renovation-workflow -- src/`,
including newly added files; base head `d433eb6ee3f09851f01e415a95598b5a2b74c608`.
Counts come directly from `coverage/coverage-final.json` and `coverage/lcov.info` of the full run.
Statement/function/branch counters are distinct from source lines, including Vue-generated callbacks.

| Scope | Statements | Branches | Functions | Lines |
|---|---|---|---|---|
| Whole configured suite | 14521/14650 (99.11%) | 9381/9571 (98.01%) | 4026/4063 (99.08%) | 11836/11903 (99.43%) |
| Changed instrumented files | 2755/2783 (98.99%) | 2249/2312 (97.27%) | 835/842 (99.16%) | 1936/1946 (99.48%) |

Full check: **533 test files passed; 7,221 tests passed, 70 existing skips, 7,291 total**.
Test duration: 546.05 seconds on Windows/Node 24.20.0. Build, vue-tsc, both linters and
Fallow dead-code/duplicate/complexity checks passed. Percentages truncate to two decimal
places to match Istanbul's printed summary.

Whole-suite uncovered counts: 129 statements, 190 branches, 37 functions, 67 lines.
At the unchanged gates, headroom is **17 statements, 1 branch, 3 functions, 52 lines**.
The branch margin is narrow and must not be spent without measuring the complete suite.
Changed instrumented files retain **28 statement, 63 branch, 7 function and 10 line gaps**.
These include inherited paths in touched modules; the counters below enumerate all of them.

## Per-file coverage

| File | Statements | Branches | Functions | Lines |
|---|---|---|---|---|
| `src/application/commands/renovation/MaterialCommand.ts` | 115/115 (100.00%) | 102/104 (98.07%) | 11/11 (100.00%) | 78/78 (100.00%) |
| `src/application/commands/renovation/PlanningServices.ts` | 6/6 (100.00%) | 0/0 | 5/5 (100.00%) | 1/1 (100.00%) |
| `src/application/commands/renovation/RenovationCommand.ts` | 105/105 (100.00%) | 57/57 (100.00%) | 17/17 (100.00%) | 83/83 (100.00%) |
| `src/application/commands/renovation/materialPlanning.ts` | 39/39 (100.00%) | 35/35 (100.00%) | 4/4 (100.00%) | 27/27 (100.00%) |
| `src/application/commands/renovation/planningLinks.ts` | 53/53 (100.00%) | 53/53 (100.00%) | 20/20 (100.00%) | 29/29 (100.00%) |
| `src/application/commands/requirement/RecalculateRequirement.ts` | 38/40 (95.00%) | 26/28 (92.85%) | 2/2 (100.00%) | 35/36 (97.22%) |
| `src/application/commands/requirement/contextualFigures.ts` | 10/10 (100.00%) | 11/12 (91.66%) | 1/1 (100.00%) | 7/7 (100.00%) |
| `src/application/commands/requirement/deriveRequirementFigures.ts` | 13/13 (100.00%) | 14/14 (100.00%) | 2/2 (100.00%) | 10/10 (100.00%) |
| `src/application/event-handlers/requirement/onPlanningChanged.ts` | 31/31 (100.00%) | 28/29 (96.55%) | 7/7 (100.00%) | 20/20 (100.00%) |
| `src/application/ports/EvidenceFiles.ts` | 0/0 | 0/0 | 0/0 | 0/0 |
| `src/application/queries/GetRequirementsForZone.ts` | 25/25 (100.00%) | 12/12 (100.00%) | 3/3 (100.00%) | 20/20 (100.00%) |
| `src/application/queries/buildRequirementRow.ts` | 58/58 (100.00%) | 60/60 (100.00%) | 11/11 (100.00%) | 42/42 (100.00%) |
| `src/domain/cost/reconcileCosts.ts` | 50/55 (90.90%) | 33/39 (84.61%) | 16/16 (100.00%) | 34/34 (100.00%) |
| `src/domain/renovation/PlanningDepth.ts` | 6/6 (100.00%) | 8/8 (100.00%) | 3/3 (100.00%) | 6/6 (100.00%) |
| `src/domain/renovation/Renovation.ts` | 91/91 (100.00%) | 88/89 (98.87%) | 25/25 (100.00%) | 50/50 (100.00%) |
| `src/domain/renovation/renovationTargets.ts` | 34/34 (100.00%) | 47/47 (100.00%) | 17/17 (100.00%) | 18/18 (100.00%) |
| `src/domain/renovation/sameRenovation.ts` | 12/12 (100.00%) | 14/14 (100.00%) | 11/11 (100.00%) | 9/9 (100.00%) |
| `src/domain/renovation/validatePlanningDepth.ts` | 38/38 (100.00%) | 46/46 (100.00%) | 14/14 (100.00%) | 19/19 (100.00%) |
| `src/domain/requirement/Requirement.ts` | 39/39 (100.00%) | 51/54 (94.44%) | 11/11 (100.00%) | 36/36 (100.00%) |
| `src/domain/requirement/RequirementSource.ts` | 53/53 (100.00%) | 76/76 (100.00%) | 13/13 (100.00%) | 32/32 (100.00%) |
| `src/infrastructure/obsidian/repositories/ObsidianEvidenceFiles.ts` | 42/42 (100.00%) | 25/26 (96.15%) | 11/11 (100.00%) | 28/28 (100.00%) |
| `src/infrastructure/obsidian/repositories/ObsidianRequirementRepository.ts` | 61/62 (98.38%) | 23/24 (95.83%) | 20/20 (100.00%) | 55/56 (98.21%) |
| `src/infrastructure/obsidian/repositories/ObsidianReviewNotes.ts` | 48/48 (100.00%) | 27/27 (100.00%) | 7/7 (100.00%) | 29/29 (100.00%) |
| `src/infrastructure/obsidian/repositories/digest.ts` | 23/23 (100.00%) | 8/8 (100.00%) | 7/7 (100.00%) | 22/22 (100.00%) |
| `src/infrastructure/obsidian/repositories/planningReferentialGuard.ts` | 35/36 (97.22%) | 28/30 (93.33%) | 7/7 (100.00%) | 23/23 (100.00%) |
| `src/infrastructure/obsidian/repositories/relocateEvidence.ts` | 23/23 (100.00%) | 16/16 (100.00%) | 4/4 (100.00%) | 15/15 (100.00%) |
| `src/infrastructure/obsidian/repositories/renovationGeometryGuard.ts` | 27/28 (96.42%) | 21/21 (100.00%) | 7/7 (100.00%) | 16/17 (94.11%) |
| `src/infrastructure/persistence/dto/planFrontmatter.ts` | 13/13 (100.00%) | 2/2 (100.00%) | 2/2 (100.00%) | 12/12 (100.00%) |
| `src/infrastructure/persistence/dto/planningDepth.ts` | 7/7 (100.00%) | 0/0 | 1/1 (100.00%) | 5/5 (100.00%) |
| `src/infrastructure/persistence/dto/renovation.ts` | 2/2 (100.00%) | 0/0 | 0/0 | 2/2 (100.00%) |
| `src/infrastructure/persistence/dto/requirementFrontmatter.ts` | 8/8 (100.00%) | 0/0 | 1/1 (100.00%) | 8/8 (100.00%) |
| `src/infrastructure/persistence/mappers/planMapper.ts` | 16/16 (100.00%) | 34/34 (100.00%) | 5/5 (100.00%) | 15/15 (100.00%) |
| `src/infrastructure/persistence/mappers/requirementMapper.ts` | 17/18 (94.44%) | 25/27 (92.59%) | 6/6 (100.00%) | 15/16 (93.75%) |
| `src/infrastructure/persistence/migration/entities/plan/plan.migrations.ts` | 4/4 (100.00%) | 12/12 (100.00%) | 3/3 (100.00%) | 4/4 (100.00%) |
| `src/infrastructure/persistence/migration/entities/requirement/requirement.migrations.ts` | 2/2 (100.00%) | 4/4 (100.00%) | 1/1 (100.00%) | 1/1 (100.00%) |
| `src/plugin/RenovationPlannerPlugin.ts` | 191/193 (98.96%) | 45/46 (97.82%) | 51/52 (98.07%) | 168/169 (99.40%) |
| `src/plugin/composition-root.ts` | 35/35 (100.00%) | 23/23 (100.00%) | 8/8 (100.00%) | 35/35 (100.00%) |
| `src/plugin/evidenceRename.ts` | 7/7 (100.00%) | 4/4 (100.00%) | 1/1 (100.00%) | 5/5 (100.00%) |
| `src/plugin/planEditorDeps.ts` | 5/5 (100.00%) | 6/6 (100.00%) | 3/3 (100.00%) | 5/5 (100.00%) |
| `src/plugin/planningEditorServices.ts` | 22/22 (100.00%) | 7/8 (87.50%) | 9/9 (100.00%) | 15/15 (100.00%) |
| `src/plugin/reviewNoteAction.ts` | 11/11 (100.00%) | 5/5 (100.00%) | 4/4 (100.00%) | 8/8 (100.00%) |
| `src/plugin/slice10Composition.ts` | 13/14 (92.85%) | 4/4 (100.00%) | 9/10 (90.00%) | 13/14 (92.85%) |
| `src/presentation/editor/PlanEditorRoot.vue` | 93/93 (100.00%) | 80/80 (100.00%) | 34/34 (100.00%) | 78/78 (100.00%) |
| `src/presentation/editor/planEditorCommands.ts` | 14/15 (93.33%) | 0/0 | 12/13 (92.30%) | 13/13 (100.00%) |
| `src/presentation/editor/planning/CostFields.vue` | 22/22 (100.00%) | 13/14 (92.85%) | 17/17 (100.00%) | 19/19 (100.00%) |
| `src/presentation/editor/planning/CostRow.vue` | 10/10 (100.00%) | 21/22 (95.45%) | 6/6 (100.00%) | 9/9 (100.00%) |
| `src/presentation/editor/planning/CostTotals.vue` | 3/3 (100.00%) | 0/0 | 1/1 (100.00%) | 2/2 (100.00%) |
| `src/presentation/editor/planning/CostsInspector.vue` | 10/10 (100.00%) | 4/4 (100.00%) | 4/4 (100.00%) | 7/7 (100.00%) |
| `src/presentation/editor/planning/EvidenceFields.vue` | 39/40 (97.50%) | 45/46 (97.82%) | 15/15 (100.00%) | 27/27 (100.00%) |
| `src/presentation/editor/planning/EvidenceInspector.vue` | 42/42 (100.00%) | 38/41 (92.68%) | 23/23 (100.00%) | 24/24 (100.00%) |
| `src/presentation/editor/planning/EvidencePins.vue` | 22/22 (100.00%) | 20/20 (100.00%) | 9/9 (100.00%) | 13/13 (100.00%) |
| `src/presentation/editor/planning/EvidencePreview.vue` | 7/7 (100.00%) | 14/15 (93.33%) | 3/3 (100.00%) | 5/5 (100.00%) |
| `src/presentation/editor/planning/MaterialFields.vue` | 19/19 (100.00%) | 25/26 (96.15%) | 14/14 (100.00%) | 17/17 (100.00%) |
| `src/presentation/editor/planning/MaterialNumbers.vue` | 1/1 (100.00%) | 12/12 (100.00%) | 0/0 | 1/1 (100.00%) |
| `src/presentation/editor/planning/MaterialRow.vue` | 12/12 (100.00%) | 20/20 (100.00%) | 7/7 (100.00%) | 11/11 (100.00%) |
| `src/presentation/editor/planning/MaterialsInspector.vue` | 48/49 (97.95%) | 37/39 (94.87%) | 13/13 (100.00%) | 22/22 (100.00%) |
| `src/presentation/editor/planning/PlanningForm.vue` | 69/72 (95.83%) | 69/69 (100.00%) | 19/22 (86.36%) | 43/46 (93.47%) |
| `src/presentation/editor/planning/PlanningInspector.vue` | 3/3 (100.00%) | 13/13 (100.00%) | 1/1 (100.00%) | 2/2 (100.00%) |
| `src/presentation/editor/planning/PlanningReview.vue` | 6/6 (100.00%) | 3/4 (75.00%) | 3/3 (100.00%) | 5/5 (100.00%) |
| `src/presentation/editor/planning/planningContext.ts` | 61/63 (96.82%) | 43/47 (91.48%) | 12/12 (100.00%) | 36/36 (100.00%) |
| `src/presentation/editor/planning/planningDraft.ts` | 45/45 (100.00%) | 71/71 (100.00%) | 20/20 (100.00%) | 32/32 (100.00%) |
| `src/presentation/editor/planning/planningProjection.ts` | 51/51 (100.00%) | 45/45 (100.00%) | 28/28 (100.00%) | 29/29 (100.00%) |
| `src/presentation/editor/planning/recordChoices.ts` | 13/13 (100.00%) | 7/9 (77.77%) | 12/12 (100.00%) | 7/7 (100.00%) |
| `src/presentation/editor/planning/removalSources.ts` | 10/10 (100.00%) | 8/9 (88.88%) | 4/4 (100.00%) | 6/6 (100.00%) |
| `src/presentation/editor/reference/ReferenceSetupForm.vue` | 163/167 (97.60%) | 154/158 (97.46%) | 41/42 (97.61%) | 93/94 (98.93%) |
| `src/presentation/editor/renovation/RenovationEntry.vue` | 6/6 (100.00%) | 3/3 (100.00%) | 2/2 (100.00%) | 5/5 (100.00%) |
| `src/presentation/editor/renovation/RenovationLayer.vue` | 53/54 (98.14%) | 48/52 (92.30%) | 25/25 (100.00%) | 34/34 (100.00%) |
| `src/presentation/editor/renovation/ReviewInspector.vue` | 48/49 (97.95%) | 50/53 (94.33%) | 11/11 (100.00%) | 29/29 (100.00%) |
| `src/presentation/editor/renovation/RoomRenovationDetails.vue` | 38/38 (100.00%) | 34/35 (97.14%) | 25/25 (100.00%) | 15/15 (100.00%) |
| `src/presentation/editor/renovation/SubjectRow.vue` | 15/15 (100.00%) | 42/43 (97.67%) | 9/9 (100.00%) | 14/14 (100.00%) |
| `src/presentation/editor/renovation/WorkRow.vue` | 16/16 (100.00%) | 18/18 (100.00%) | 9/9 (100.00%) | 14/14 (100.00%) |
| `src/presentation/editor/renovation/renovationActions.ts` | 88/88 (100.00%) | 86/90 (95.55%) | 14/14 (100.00%) | 57/57 (100.00%) |
| `src/presentation/editor/renovation/renovationDeleteGuard.ts` | 21/21 (100.00%) | 14/14 (100.00%) | 3/3 (100.00%) | 13/13 (100.00%) |
| `src/presentation/editor/renovation/renovationSession.ts` | 8/8 (100.00%) | 0/0 | 1/1 (100.00%) | 5/5 (100.00%) |
| `src/presentation/editor/runtime.ts` | 147/147 (100.00%) | 44/45 (97.77%) | 50/50 (100.00%) | 118/118 (100.00%) |
| `src/presentation/editor/selection/selectAndFrame.ts` | 12/12 (100.00%) | 8/8 (100.00%) | 2/2 (100.00%) | 8/8 (100.00%) |
| `src/presentation/editor/shell/EntityInspector.vue` | 13/13 (100.00%) | 13/14 (92.85%) | 4/4 (100.00%) | 10/10 (100.00%) |
| `src/presentation/editor/structure/structureActions.ts` | 94/94 (100.00%) | 67/69 (97.10%) | 22/22 (100.00%) | 53/53 (100.00%) |
| `src/presentation/i18n/locales/de.ts` | 1/1 (100.00%) | 0/0 | 0/0 | 1/1 (100.00%) |
| `src/presentation/i18n/locales/de/planning.ts` | 1/1 (100.00%) | 0/0 | 0/0 | 1/1 (100.00%) |
| `src/presentation/i18n/locales/de/saveState.ts` | 1/1 (100.00%) | 0/0 | 0/0 | 1/1 (100.00%) |
| `src/presentation/i18n/locales/en.ts` | 1/1 (100.00%) | 0/0 | 0/0 | 1/1 (100.00%) |
| `src/presentation/i18n/locales/en/planning.ts` | 1/1 (100.00%) | 0/0 | 0/0 | 1/1 (100.00%) |

## Exact uncovered counters

Positions below use one-based lines and zero-based columns from the V8/Istanbul source maps.
`S` names a statement counter; `F` names a function; `B` names a branch counter and arm.
Only nonzero-gap files appear here; all other instrumented changed files have no uncovered counters.
These are remaining verification gaps, not accepted behavior or new coverage exclusions.

### `src/application/commands/renovation/MaterialCommand.ts`

B26.1 at 76:8 (arm unmapped; parent position); B46.1 at 109:9 (arm unmapped; parent position).

### `src/application/commands/requirement/RecalculateRequirement.ts`

S26 at 126:23; S32 at 143:3; B9.0 at 126:2; B12.0 at 142:2.

### `src/application/commands/requirement/contextualFigures.ts`

B4.1 at 20:179.

### `src/application/event-handlers/requirement/onPlanningChanged.ts`

B9.1 at 36:92.

### `src/domain/cost/reconcileCosts.ts`

S7 at 14:15; S23 at 30:16; S26 at 32:21; S48 at 47:25; S52 at 50:22; B2.0 at 14:2; B5.0 at 30:2; B6.0 at 32:2; B14.0 at 47:1; B16.0 at 50:1; B17.1 at 52:163.

### `src/domain/renovation/Renovation.ts`

B35.2 at 127:299.

### `src/domain/requirement/Requirement.ts`

B18.0 at 152:45; B19.0 at 152:45; B19.1 at 152:68.

### `src/infrastructure/obsidian/repositories/ObsidianEvidenceFiles.ts`

B1.1 at 17:133.

### `src/infrastructure/obsidian/repositories/ObsidianRequirementRepository.ts`

S33 at 156:4; B5.0 at 155:3.

### `src/infrastructure/obsidian/repositories/planningReferentialGuard.ts`

S16 at 27:18; B0.1 at 15:57; B6.0 at 27:2.

### `src/infrastructure/obsidian/repositories/renovationGeometryGuard.ts`

S27 at 34:19.

### `src/infrastructure/persistence/mappers/requirementMapper.ts`

S13 at 115:2; B7.1 at 78:76; B9.0 at 114:1.

### `src/plugin/RenovationPlannerPlugin.ts`

S176 at 1048:5; S182 at 1123:70; F47 `(anonymous_47)` at 1047:43; B20.0 at 1123:2.

### `src/plugin/planningEditorServices.ts`

B2.1 at 32:55.

### `src/plugin/slice10Composition.ts`

S8 at 137:208; F5 `(anonymous_5)` at 137:208.

### `src/presentation/editor/planEditorCommands.ts`

S6 at 211:37; F5 `(anonymous_5)` at 211:37.

### `src/presentation/editor/planning/CostFields.vue`

B2.1 at 28:93.

### `src/presentation/editor/planning/CostRow.vue`

B10.0 at 52:115.

### `src/presentation/editor/planning/EvidenceFields.vue`

S8 at 15:52; B0.0 at 15:1.

### `src/presentation/editor/planning/EvidenceInspector.vue`

B6.1 at 20:55; B10.1 at 25:101; B11.1 at 25:153.

### `src/presentation/editor/planning/EvidencePreview.vue`

B3.1 at 16:21.

### `src/presentation/editor/planning/MaterialFields.vue`

B12.1 at 86:34.

### `src/presentation/editor/planning/MaterialsInspector.vue`

S34 at 26:49; B9.0 at 26:1; B16.1 at 68:7.

### `src/presentation/editor/planning/PlanningForm.vue`

S67 at 92:18; S70 at 113:18; S71 at 119:18; F17 `(anonymous_17)` at 92:18; F20 `(anonymous_20)` at 113:18; F21 `(anonymous_21)` at 119:18.

### `src/presentation/editor/planning/PlanningReview.vue`

B0.1 at 7:137.

### `src/presentation/editor/planning/planningContext.ts`

S36 at 47:72; S61 at 68:121; B8.1 at 43:79; B10.0 at 47:2; B19.1 at 58:56; B21.0 at 68:109.

### `src/presentation/editor/planning/recordChoices.ts`

B1.1 at 8:203; B2.2 at 10:158.

### `src/presentation/editor/planning/removalSources.ts`

B3.1 at 10:106.

### `src/presentation/editor/reference/ReferenceSetupForm.vue`

S100 at 89:19; S111 at 98:27; S114 at 100:26; S157 at 153:17; F32 `(anonymous_32)` at 153:17; B34.0 at 89:1; B37.0 at 98:1; B38.0 at 100:1; B42.1 at 108:19 (arm unmapped; parent position).

### `src/presentation/editor/renovation/RenovationLayer.vue`

S44 at 43:33; B8.1 at 19:292; B20.1 at 41:95; B21.1 at 41:51; B22.0 at 43:1.

### `src/presentation/editor/renovation/ReviewInspector.vue`

S25 at 30:66; B6.1 at 26:18 (arm unmapped; parent position); B7.0 at 30:1; B9.1 at 32:75.

### `src/presentation/editor/renovation/RoomRenovationDetails.vue`

B7.1 at 27:259.

### `src/presentation/editor/renovation/SubjectRow.vue`

B17.2 at 78:95.

### `src/presentation/editor/renovation/renovationActions.ts`

B24.1 at 65:19 (arm unmapped; parent position); B31.1 at 82:8; B33.1 at 85:20 (arm unmapped; parent position); B41.1 at 98:20 (arm unmapped; parent position).

### `src/presentation/editor/runtime.ts`

B1.1 at 291:2 (arm unmapped; parent position).

### `src/presentation/editor/shell/EntityInspector.vue`

B0.1 at 60:107.

### `src/presentation/editor/structure/structureActions.ts`

B11.1 at 52:146; B12.0 at 54:44.

## Acceptance boundary

The linked [evidence report](connected-planning-evidence.md) separates pure calculations, actual
repositories over FakeVault, production-root hydration, browser keyboard journeys and inspected
screenshots from unperformed live Obsidian/mobile/screenreader acceptance. Coverage is evidence
of executed counters, not proof of exhaustive platform behavior or durable crash recovery.
