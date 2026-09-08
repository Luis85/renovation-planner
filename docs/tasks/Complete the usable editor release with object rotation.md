---
type: Task
status: Active
horizon: MVP
release: "[[MVP]]"
---

# Complete the usable editor release with object rotation

The 2026-09-08 implementation request covers the landed M00–M17 experience plus rotation of a single free Object. The active [execution and acceptance ledger](../user-experience/renovation-planner-editor-specs/implementation/release-2026-09-08.md) records branches, evidence and dependencies. Main was revalidated at `7d4bc381`; the independently owned docs-only PR #93 must remain untouched.

## Acceptance

- Correct shared hover/click precedence while preserving handles, badges, stable overlap cycling, ordered multiselection and keyboard/list routes.
- Provide a visible Object rotation handle, accessible signed degree input and clockwise/counterclockwise quarter turns with a frozen pivot and rigid baseline preview.
- Commit each valid gesture once through existing guarded commands. Cancellation and true no-ops create no history; Undo/Redo exactly restore stored points and metadata. Readback recovery must never replay a successful write.
- Reconstruct repositories, index and runtime from an opening-bearing persisted fixture; verify every opening fact and subsequent edit/history/host guards. Add equivalent rotation round trips.
- Reproduce and settle explicit retyping of rounded room dimensions while keeping untouched coordinates exact.
- Reconcile every M00–M17 use case, interaction and acceptance criterion against code and actual matching-state captures; fix only demonstrated discrepancies.
- Pass the unchanged integrated `npm run check`, preserve capture provenance and all nine journeys/18 reference comparisons, inspect light/dark/custom accent/German constrained results, and perform applicable isolated native-host acceptance.
- Push reviewable concern PRs with exact source/test evidence. Keep unperformed native, physical-device and screen-reader observations explicit. Ask for the next step after PRs are open; do not merge.

## Outcome

Active implementation. This task does not close or rewrite PR #93's historical task records. Its new evidence can be reconciled there by that PR's owner after review.
