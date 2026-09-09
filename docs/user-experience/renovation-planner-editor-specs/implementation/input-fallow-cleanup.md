# Input and creation analysis cleanup

Source prepared from integrated `e02984e2` for the findings in the unchanged
analysis run recorded in `editor-integrated-analyze-38c821fc.log` on 2026-09-09.
Verification of this revision is pending; historical analysis output is the
diagnostic input, not a passed receipt.

- `validStairOptions` remains the private validator used by `stairPlanGeometry`;
  its unused export is removed. Validation and all geometry math are unchanged.
- `GeometryNameField` shares the native name label/input/error display between
  Stair and outline editing. Parents retain text admission, touched intent,
  validation, focus, preview and dispatch. The component adds no HTML wrapper.
- `ReferenceLayerAppearance` owns the reference lock/opacity display, retaining
  the existing icon/span structure and labels. LayerList retains checkbox IDs,
  visibility actions, disabled reasons and calibration admission.
- StructureTaskForm derives its contextual heading before rendering. Its form
  fields, order and commands remain intact.
- `TaskDrawingControls` contains the existing drawing-specific banner controls
  as a fragment. Finish/Cancel, their guards and banner focus recovery stay in
  TemporaryToolBanner; the name guard and precision focus route move with their
  controls. No field or action changes its position in the DOM.
- EditorSurface delegates only the active camera-override move and canvas Escape
  branches to local helpers. Swallowed-pointer and gesture-owner recording still
  run before pan handling; the tool/chorded-release and default camera paths
  retain their order. Keyboard admission remains first, then Escape, Space,
  modifier replay, nudge, gesture/finish/fit checks and zoom. Escape repeat and
  panning guards are unchanged.

No thresholds, suppression configuration, tests, storage contracts, transforms,
scene geometry or failure handling were changed. Existing Stair/outline form,
shell/layer, structure task, temporary banner, canvas navigation, input and scene
regressions remain the verification targets. Tests, types, linters and Fallow are
unrun for this source-ready patch while the parent owns the serialized check slot.
Only source/diff inspection and `git diff --check` were performed locally.

The subsequent analyzer left LayerList and StructureTaskForm at cognitive 16.
Their complete row/placement responsibilities now live in `LayerRow` and
`StructurePlacementFields`. LayerList retains all six unconditional IDs and the
native `ul`; each row retains its native `li`, checkbox/label associations and
guarded calibration event. The placement fragment retains host selection, numeric
coordinates/dimensions and swing fields; the parent retains the form root, invalid
focus, notices and command actions. No wrapper changes either native structure.
This final extraction is source-ready and unrun; analyzer values and regression
results require the parent's cumulative checks. EditorSurface received no further
changes after its initial helper extraction.
