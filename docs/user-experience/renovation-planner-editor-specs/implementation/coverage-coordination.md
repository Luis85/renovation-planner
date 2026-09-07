# Coverage ownership coordination

Updated: 2026-09-07, user-requested ownership change.

The user will create a dedicated coverage session and report when it has started.
**Status: reserved, not yet started/registered; no task ID is known.** Root must not
create it or assume it is running. The assignment is in
[coverage-session-brief.md](coverage-session-brief.md).

Once the user reports startup, identify the actual task and record its ID, title,
branch and base here. Confirm ownership and the heavy-verification schedule with
that session. Global coverage analysis and new coverage test packages then belong
to it. Root owns integration and the final acceptance decision.

Existing UI and E tasks have been informed. Root's helper has been instructed to
start no further coverage packages. UI continues regressions necessary for its own
visual/caption fixes; E remains available for actual recovery/hardening defects.

Root has completed the previously running financial/library package:
`planningFinancialBoundaries.test.ts` and `projectLibraryFlows.test.ts`.
The two-file native run passed **8/8 in 43.84 seconds**. Types, whole Oxlint, scoped ESLint and static Fallow have also passed. Read the latest Root evidence before
duplicating those tests. No further Root coverage packages should be started.

Local heavy verification remains serialized through Root, including installation,
builds, native/coverage runs, analysis and browser/performance captures. A silent
task or observation timeout is not a free slot; obtain an explicit handoff or
verify the actual process/session status.
