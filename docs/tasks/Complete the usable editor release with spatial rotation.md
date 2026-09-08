---
type: Task
status: Active
horizon: MVP
release: "[[MVP]]"
---

# Complete the usable editor release with spatial rotation

The 2026-09-08 implementation request covers the landed M00–M17 experience. The user expanded rotation to all free spatial items and walls with their hosted openings, and requested a clearer, easier-to-grab handle. The active [execution and acceptance ledger](../user-experience/renovation-planner-editor-specs/implementation/release-2026-09-08.md) records branches, evidence and dependencies. Independently owned PR #93 was merged externally; main was fast-forwarded to `ec342370`. This task did not modify or merge that PR. After its selection amendment, the user explicitly reconfirmed Object → Opening → Wall → Room.

## Acceptance

- Correct shared hover/click precedence while preserving handles, badges, stable overlap cycling, ordered multiselection and keyboard/list routes.
- Provide a visible rotation handle for each free spatial kind, accessible signed degree input and clockwise/counterclockwise quarter turns with a frozen pivot and rigid baseline preview. Refine the glyph, 44 px grab target, dimension/corner clearance, pivot and angle feedback.
- Rotate walls with hosted openings and connected junctions through reviewed impact/Apply; keep Room outlines independent, preserve opening identity/placement fields and refuse invalid geometry. Selected openings offer Rotate host wall.
- Commit each valid gesture once through existing guarded commands. Cancellation and true no-ops create no history; Undo/Redo exactly restore stored points and metadata. Readback recovery must never replay a successful write.
- Reconstruct repositories, index and runtime from an opening-bearing persisted fixture; verify every opening fact and subsequent edit/history/host guards. Add equivalent rotation round trips.
- Reproduce and settle explicit retyping of rounded room dimensions while keeping untouched coordinates exact.
- Reconcile every M00–M17 use case, interaction and acceptance criterion against code and actual matching-state captures; fix only demonstrated discrepancies.
- Pass the unchanged integrated `npm run check`, preserve capture provenance and all nine journeys/18 reference comparisons, inspect light/dark/custom accent/German constrained results, and perform applicable isolated native-host acceptance.
- Push reviewable concern PRs with exact source/test evidence. Keep unperformed native, physical-device and screen-reader observations explicit. Ask for the next step after PRs are open; do not merge.

## Outcome

Active implementation. The [release expansion](../user-experience/renovation-planner-editor-specs/implementation/release-expansion-2026-09-08.md) additionally requires saved groups, left-drag selection and Pan, automatic Room enclosure, contextual actions, visible edge measurements and curved/free-form Rooms, opening swing geometry and click placement, stairs and arrows, shared Shift constraints, Undo/Redo shortcuts, stable Review navigation, a bounded image-only photo picker, and a large reference calibration viewport with pan/zoom. These additions remain part of completion; the earlier visual checkpoint does not verify them.

PR #95 head `50e5b33c` passes the unchanged global coverage threshold (98.04% branches, 8,237 passing tests). Its newly reached static-analysis findings are being fixed on the same PR. Photo addition commit `cc6c90a9` is integrated with focused verification. Saved-group schema 6 commit `587f0266` is integrated; its canvas/Inspector interaction follow-up, curved geometry, stairs, reference viewport and combined native/browser acceptance are still in progress. This task remains open.
