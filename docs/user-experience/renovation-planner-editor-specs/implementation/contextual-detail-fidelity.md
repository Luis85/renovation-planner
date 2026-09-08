# Restore contextual renovation detail hierarchy

## Evidence and scope

The combined source baseline is `a79baa83e8e31d4c97d5b074221b31cbdafd235d`.
Its current browser captures in the release verification worktree show rotation buttons
before the room content, a collapsed nine-destination navigation menu, and repeated
manual/calculated explanations inside every Existing row. The unchanged final runner
stopped in the M00 overview journey: Continue renovation ended below the visible Inspector.
This is a real layout defect, not a passed final run.

Compare the source M00 and M08–M14 images and screen contracts. Keep the accepted
Project/Floor hierarchy, independent Existing/Planned facts and wall geometry,
ADR-0022 financial reconciliation, repository commands and file ownership.

## Implementation

- Use a room/section breadcrumb, contextual heading, and visible Existing → Work →
  Planned controls. Documents/Photos/Notes share visible type controls. Keep other
  linked destinations in a small disclosure and retain native focus after navigation.
- Keep room geometry actions in More actions, after the primary renovation content.
  Wall/opening rotation and room association remain in the existing structural actions.
- Present kind and description in separate row columns, with a concise condition or
  change label. Expand related edit/delete/work/source/material actions on demand;
  focusing the corresponding canvas record expands its actions.
- Put record creation below the records. Distinguish Add planned detail from marking
  an Existing item for change. Hide an empty Decision heading.
- Existing details expose contextual evidence counts, and the selected floor detail
  exposes its geometry-derived area. The M08 photo strip reuses the existing gallery,
  retained evidence projection and date ordering; selecting a photo opens its canonical
  metadata route with the spatial context retained. It replaces the shape popover while
  visible, preserving geometry actions in More actions. Put external library/schedule/
  quotes actions after the contextual content. Expanded work-cost groups expose all
  reconciled totals through the existing financial projection.
- Render overview transformations as short lists. Keep the continuation before
  secondary geometry actions to avoid the reproduced M00 clipping.
- Adapt the keyboard harness to open actual native disclosures, preserving every
  existing persistence, focus, visibility and route assertion.

## Verification

Scoped ESLint and TypeScript pass. The initial five presentation files passed 41 tests
after correcting the text space between the kind and description columns. The later
seven-file run covered 129 tests: 128 passed initially and the corrected photo fixture
passed its exact rerun. That fixture's unassociated wall now uses the existing native
Room-context selector before opening its wall-scoped details; no production authority
was changed to satisfy it.

The later run includes Existing photo navigation/scope/peer-removal focus, section
focus and unsupported-planning behavior, kind/area presentation, planning workflow,
financial boundaries, evidence phase selection and stylesheet checks. The evidence
strip retains camera and vault bytes on navigation, and restores owned keyboard focus
when a peer deletion removes its last thumbnail. The shared keyboard helper leaves a
target summary's own disclosure to the requested activation, preventing double toggles.

`node --check scripts/editor-area-browser.mjs` passes. Native disclosure routes still
require the upcoming committed-source browser journeys. The unchanged integrated gate,
all final screen comparisons and native-host acceptance remain pending. This note does
not certify full design or release acceptance.
