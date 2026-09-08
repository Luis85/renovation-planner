# Downstream late boundaries — WIP and resume

Updated: 2026-09-07. **WIP: test source prepared, not executed.**

Worktree: `D:/Projects/renovation-planner/.worktrees/downstream-late-boundaries`.
Branch: `codex/downstream-late-boundaries`.
Base: shared integration `ef14c02ec81983c37c1b7fc28b7a2703ac1af8fd`.

Root approved exactly three native cases in the new
`tests/presentation/views/downstreamLateBoundaries.test.ts`, plus this dedicated record:

- A real Supplier note becomes unreadable while a Quote draft is open. Actual cache and
  repository reads retain its unresolved identity; failed Apply preserves raw input/bytes.
  Repair and explicit Apply must produce the only Quote write.
- A second native Work Edit during a held actual baseline result must not start a second
  read or competing dialog; the first result opens the ordinary draft once.
- A real native Undo writes before its result is held. Disposing the Project view then
  releasing that result must preserve the authorized inverse without late read-back,
  notification, focus changes or write replay.

Expected new branch hits are QuoteForm `27:0`/`11:1` and projectWorkActions `11:0`/`21:1`
from the preserved full `73b0c205` report. These are hypotheses, not measured coverage.
The prior counter audit is preserved on the downstream-view-states branch at
`f7b093befbccf358f107c183c836ca0d8c0fb7cf`; no private-handler or impossible-result tests
are proposed for the remaining guarded arms.

Source preparation and diff checks are complete. Dependencies have not been installed in
this worktree; no tests, types, lint, coverage or browser checks have run. Production and
existing tests are unchanged. UI owns the heavy slot. Wait for another explicit root
handoff before installation or execution; report any real production defect separately.

Next: run these three cases and relevant existing native downstream recovery/Quote tests,
then types/lint and one bounded coverage measurement if root requests it. Compare actual
counter maps before claiming new hits. Update this record and push after the next coherent
step; WIP pushes are explicitly authorized to preserve work under usage limits.

Integration recommendation for this WIP: review/test preparation only, not a passing gate.
Root task: `01a0786f-b624-7303-987f-b18b94db48d9`. No active E heavy process.
