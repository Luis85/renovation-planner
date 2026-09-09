# Cumulative delivery production comparison

Read-only comparison: Stair delivery `de561869` versus integration
`c920921cd4376b70d30c4fd0b12dc67c287958a0`. There are 46 differing source paths and
zero differing style paths. No source changes were made from this comparison, and
no validation command was run. This is a source audit, not rendered acceptance.

The later cleanup sequence remains deliberately outside the feature reconstruction:
`07853ce2`, `b6d6d581`, `0f12aa9e`, `95a28803`, `4992274d`, `c6052c4d`,
`cb8fdf6a`, `c3e1ed71`, `67932765`. These extract cohesive controls/handlers, share
command admission, clarify public argument types and narrow template data. The snap
service getter-to-method change and ElementRotation caller must transfer together.

Concrete differences predating that cleanup:

- RenovationInspector lacks the integration tree's `rp-room-more-actions` class on
  the standalone Area disclosure. The controls remain present; styling differs.
- RoomRenovationDetails renders rotation controls before its metadata/actions;
  integration renders them after. This changes native focus order, not availability.
- InteractionLayer's single-selected outline uses Curve then Group preview here;
  integration uses Curve preview then saved geometry. Group preview remains included
  in the full candidate map in both trees. The delivery retains the explicit Group
  preview contract; reconcile deliberately rather than overwriting the layer.
- InteractionLayer and StructureLayer require the composed Group facade here;
  integration uses optional access. Both runtime factories are composed in delivery.
- PlanCanvas's per-object nullish fallback is equivalent to integration's document
  fallback because a preview document always contains its objects array.
- Remaining pre-cleanup differences are import order, declaration order and whitespace.

No missing Stair/Arrow/Curve/Opening/Group storage behavior was identified in this
static comparison. Schema order, footprint admission/framing, hosted-opening math,
Group membership and guarded transforms are retained. This does not replace the
pending cumulative tests or all-screen/browser verification.

## Differing paths

Paths below are relative to the repository. Most are expected cleanup; the shared
preview and Inspector exceptions are explained above.

```text
src/application/commands/spatial/GroupGeometryCommand.ts
src/application/commands/spatial/StructureCommand.ts
src/application/commands/spatial/runSpatialCommand.ts
src/domain/spatial/stairGeometry.ts
src/infrastructure/obsidian/repositories/ObsidianZoneRepository.ts
src/infrastructure/persistence/dto/planGeometry.ts
src/presentation/editor/PlanCanvas.vue
src/presentation/editor/elements/ElementRotation.ts
src/presentation/editor/elements/StairEditForm.vue
src/presentation/editor/elements/objectRotation.ts
src/presentation/editor/elements/rotationActions.ts
src/presentation/editor/elements/rotationControl.ts
src/presentation/editor/forms/GeometryNameField.vue
src/presentation/editor/layers/InteractionLayer.vue
src/presentation/editor/planning/EvidenceFields.vue
src/presentation/editor/renovation/RelatedRenovationNavigation.vue
src/presentation/editor/renovation/RenovationEntry.vue
src/presentation/editor/renovation/RenovationInspector.vue
src/presentation/editor/renovation/RenovationNavigationButton.vue
src/presentation/editor/renovation/RoomRenovationActions.vue
src/presentation/editor/renovation/RoomRenovationDetails.vue
src/presentation/editor/renovation/TransformationStage.vue
src/presentation/editor/renovation/TransformationSummary.vue
src/presentation/editor/renovation/renovationSummary.ts
src/presentation/editor/resize/OutlinePointsForm.vue
src/presentation/editor/resize/RoomDimensionButton.vue
src/presentation/editor/resize/RoomDimensionLabels.vue
src/presentation/editor/shell/FloorInspector.vue
src/presentation/editor/shell/FloorSpatialLists.vue
src/presentation/editor/shell/LayerList.vue
src/presentation/editor/shell/LayerRow.vue
src/presentation/editor/shell/PersistentWarningStrip.vue
src/presentation/editor/shell/ReferenceLayerAppearance.vue
src/presentation/editor/shell/TaskDrawingControls.vue
src/presentation/editor/shell/TemporaryToolBanner.vue
src/presentation/editor/snapping/snap-service.ts
src/presentation/editor/structure/StructureFacts.vue
src/presentation/editor/structure/StructureInspector.vue
src/presentation/editor/structure/StructureLayer.vue
src/presentation/editor/structure/StructurePlacementFields.vue
src/presentation/editor/structure/StructureTaskForm.vue
src/presentation/editor/surface/EditorSurface.vue
src/presentation/editor/tools/registerEditorTools.ts
src/presentation/editor/tools/select-tool.ts
src/presentation/i18n/locales/de/editor.ts
src/presentation/i18n/locales/en/editor.ts
```
