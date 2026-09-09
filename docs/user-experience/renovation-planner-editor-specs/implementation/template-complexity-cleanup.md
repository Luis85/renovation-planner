# Detail template complexity cleanup

Base: `e02984e24762c38caba1311a268b6328a14ad8e3`. Source-only follow-up to the unchanged integrated Fallow gate at 38c821fc. Original log: `C:/Users/lum/.codex/tmp/editor-integrated-analyze-38c821fc.log`.

The gate reported template cyclomatic/cognitive complexity of 26/39 for RenovationEntry, 21/34 for TransformationSummary, 15/20 for RoomRenovationDetails, 14/16 for EvidenceFields, 14/16 for RenovationInspector, 10/18 for StructureInspector and 10/17 for PersistentWarningStrip. It also reported the duplicated Add-door keyboard loop in the curve and opening-move browser drivers.

## Source changes

- `RenovationNavigationButton` owns one keyed navigation button with the same root, icons, labels and native event forwarded synchronously. RenovationEntry retains the disclosure opener, navigation command and post-update focus restoration. Named view predicates remove repeated template conditions.
- `TransformationStage` renders each existing/work/planned stage with the same div/heading/list-or-paragraph hierarchy. Work still shows four expanded items and three compact items; existing/planned show three. Planned list interpolation and compact string formatting retain their different handling of absent descriptions. Translation helpers run at render time.
- `RoomRenovationActions` retains the exact More actions details subtree, naming/outline/rotation controls and conditions. `StructureFacts` owns only the existing definition list; StructureInspector retains edit, Move, rotation, Curve and Delete controls and native focus recovery.
- EvidenceFields derives presentation predicates from its existing single working/paused state. File import, caption editing, note creation, Details focus and callbacks are unchanged.
- RenovationInspector keeps its root and focus watcher. PersistentWarningStrip keeps every element and both update hooks; named severity/busy/action helpers retain the same busy source and refusal behavior.
- `chooseAddEntry` shares the actual bounded ArrowDown/focus assertion/Enter interaction. Both drivers retain their prior menu waits, task readiness, field entry and assertions. This is an imported browser helper, not a standalone CLI entry.

## Verification

Status: **source ready, validation pending**. Only source review and `git diff --check` ran. No Fallow, lint, types, tests, coverage, browser/native capture, push or PR was run in this worktree. Root owns the combined gate and final metrics.

Use the existing detail navigation/overview/subject kind, planning/photo, persistent warning focus, structure lifecycle/opening/curve and host icon suites to verify preserved behavior, plus the unchanged source/style/locale gates. No suppressions, complexity limits, coverage thresholds, assertions, timeouts or stylesheet changes were introduced.

## Static follow-up

The combined post-cleanup Fallow run reported zero duplicated blocks. RenovationEntry remained at 11 cyclomatic / 18 cognitive template complexity, and FloorInspector was newly assigned at 11 / 20 (`editor-integrated-analyze-repaired-20260909.log`). Extract the related-mode nav into `RelatedRenovationNavigation`, retaining its opener/ref and focus restoration in RenovationEntry. Extract only the guidance/Room/Area list fragment into `FloorSpatialLists`, retaining the same order and conditional rendering without a wrapper. Floor aggregate/planning behavior stays in FloorInspector.

This follow-up is source-ready and unverified beyond source review / `git diff --check`. EvidenceFields is unchanged; its CRAP metric awaits coverage matched to current source. No additional heavy check was run here.
