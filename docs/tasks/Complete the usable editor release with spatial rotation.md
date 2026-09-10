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

Delivery reconstruction and the latest frozen verification boundary are recorded in [acceptance delivery](../user-experience/renovation-planner-editor-specs/implementation/delivery/acceptance.md): `b10c3b24` passes all 730 files / 8,624 tests, with coverage still below the unchanged gate. This task remains active; final browser/native acceptance and publication are not complete.

Active implementation. The [release expansion](../user-experience/renovation-planner-editor-specs/implementation/release-expansion-2026-09-08.md) additionally requires saved groups, left-drag selection and Pan, automatic Room enclosure, contextual actions, visible edge measurements and curved/free-form Rooms, opening swing geometry and click placement, stairs and arrows, shared Shift constraints, Undo/Redo shortcuts, stable Review navigation, a bounded image-only photo picker, and a large reference calibration viewport with pan/zoom. These additions remain part of completion; the earlier visual checkpoint does not verify them.

As of 2026-09-09, PR #95 head `ba57db14` passes every CI leg and the unchanged full check: 8,238 passing tests, 98.04% branches, and static analysis. Photo addition `cc6c90a9`, reference viewport `d2d5d165`, Review alignment `251dc7c3`, saved-group schema 6 `587f0266`, group interactions `f8028295`/`f7e35ef4`, curved-boundary schema 7 and UI `3192c463`/`6dcb8942`/`af7583b0`, opening Move `ab993f00`, stairs/arrows `d4cc09e8`/`8cc7ac7c`, and group-member deletion `75175e1f` are integrated with focused verification. The combined gate failed at `b758695c`; the [current gate record](../user-experience/renovation-planner-editor-specs/implementation/integrated-gate-2026-09-09.md) distinguishes reproduced defects, outdated control expectations, missing coverage and resource failures. Repairs and meaningful behavioral cases are in progress. Final native/browser acceptance and reviewable concern PR publication remain required. This task remains open.

## Amendments

**2026-09-10** — the gate has since passed on `main`, and what this Task still asks for has owners
of its own. [[Confirm merged main carries the verified editor state]] (Done) records the unchanged
`npm run check` passing at `22772267` and CI green on all four legs of the merge commit `5dcc1f20`,
so the Outcome's coverage shortfall at `b10c3b24` and failed combined gate at `b758695c` describe
the tree before the stack's integration, not `main`. The rest of the gate criterion is split out:
the nine journeys, eighteen reference comparisons and four-scenario inspection to
[[Manually accept the eighteen editor reference comparisons]], the six additional interaction
drivers to [[Run the six additional editor interaction drivers]], and native-host acceptance to
[[Run native Obsidian acceptance H1 to H6 in the repository vault]]. This Task's `status` is left
unchanged: reconciling it is [[Reconcile editor backlog statuses with the merged build]]'s work
and the product owner's call.
