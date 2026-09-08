# M06 — Reference Plan Setup

![M06 — Reference Plan Setup](../images/M06-reference-plan-setup.png)

## Screen description

Reference Plan Setup is a contextual three-step workflow for preparing an imported PDF/image, setting real-world scale, and reviewing the resulting locked layer. It replaces a permanent Calibrate toolbar tool.

## Entry conditions

- User uploads a supported image/PDF or chooses to replace/reconfigure a reference plan.
- Source can be read and previewed.

## Primary use cases

1. Crop/rotate the imported plan.
2. Set scale from one known distance.
3. Review opacity, lock state, and calculated scale.
4. Retry or replace an unreadable source.

## Workflow

1. **Prepare plan:** rotate, crop, choose page for PDF.
2. **Set scale:** draw over a known distance and enter its real length.
3. **Review:** confirm scale, opacity, alignment, and lock.

## Interactions

| Trigger | Result |
|---|---|
| Draw measurement line | Set two image-space endpoints |
| Enter known length | Calculate scale preview using project units |
| `Choose another distance` | Clear calibration draft but retain prepared source |
| Change opacity | Preview immediately; persist on final confirmation |
| Toggle Locked | Default on; show consequences before allowing off |
| `Apply scale` | Validate and advance to Review |
| Finish setup | Persist reference metadata and layer configuration as one transaction |
| Cancel setup | Restore prior reference state, if any |

## Used components

- `ReferencePlanSetup`
- `SetupStepper`
- `ReferenceImageLayer`
- `KnownDistanceOverlay`
- `KnownDistanceForm`
- `OpacitySlider`
- `LockToggle`
- `ReferencePlanInspector`
- `EditorStatusBar`

## Data and state requirements

- Source file link, page, crop, rotation, opacity, lock state
- Image-space endpoints and real-world known length
- Derived scale and unit conversion
- Draft vs previously committed reference configuration
- Background load/readability status

## Accessibility and themes

- Known length is operable without precise pointer placement after endpoints exist.
- Measurement line uses endpoints, label, and focus state.
- Setup step is announced and keyboard navigable.
- Reference opacity remains readable in light and dark themes.

## Acceptance criteria

- Calibration is only exposed inside reference-plan context.
- Applying scale produces a deterministic unit conversion.
- Cancel restores the previous committed reference plan.
- Completed references default to visible and locked.


## Implementation contract — 2026-09-06

See [ADR-0019](../../../development/adrs/0019-floor-reference-configuration.md) for the persisted
schema, coordinate order, calibration and history contract. The existing reference layer's
Set scale gesture remains contextual; Configure reference opens the complete three-step task.
There is no permanent Calibrate toolbar action.

Source selection uses supported vault-file suggestions and a vault-relative path (PNG/JPG/JPEG
or PDF). The source is not copied or rewritten. Crop and endpoint fields use source raster
pixels; PDF rasterization remains two pixels per PDF point. Rotation is clockwise around the
cropped origin. Keyboard users can enter all four endpoint coordinates and the known distance
in metres, including decimal comma. Pointer picking is an alternative, not a prerequisite.
Apply scale validates and advances; only Finish writes. Review explicitly acknowledges the
existing complete-plan rescale when rooms/areas are present and the factor changes.

New references default to 0.65 opacity, visible and locked. Opacity previews immediately.
Unlocking records the preference and explains that position changes still use setup; direct
reference dragging is not introduced. Layer visibility can still be toggled for the current
session. Committed preferences seed visibility when the configuration loads or changes.

The root dialog survives wide/constrained shell changes. Source-change notifications invalidate
stale rasters; late responses cannot revive a cancelled/disposed task. Missing/unreadable source
errors provide load/retry/replacement. Stale and version-conflict refusals retain the draft and
pause writing. Compensated failures retain the previous reference; failed compensation uses the
existing unrecovered-write warning. Cross-file forced-process crash recovery is not claimed.

See [Configure a reference plan](../../../tests/cases/Configure%20a%20reference%20plan.md) for
criterion-level evidence and open live-host/screenreader acceptance.
