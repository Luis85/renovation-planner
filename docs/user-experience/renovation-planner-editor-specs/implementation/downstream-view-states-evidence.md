# Downstream view states — verification and resume

Updated: 2026-09-07. **Bounded verification completed.** The original source was pushed as
WIP `46dd866138d49d0283849b3b59a130cb9f3a9ed3`; the implementation needed no correction.

## Scope and basis

Worktree: `D:/Projects/renovation-planner/.worktrees/downstream-view-states`.
Branch: `codex/downstream-view-states`.
Base: integration `b6d8934e11fc5b8d5a1445551827c58c7f4744e0`.
Both affected views were compared byte-for-byte with the current integration worktree
immediately before editing; neither had pending root changes.

The preserved full `73b0c205` analysis reports no dead code or clone groups, but template
cognitive complexity exceeds the unchanged ceiling of 15 in QuoteComparisonState (18),
ProjectWorkState (19) and EvidenceInspector (16). Root owns EvidenceInspector. This
checkpoint changes only the two downstream views and this dedicated record.

QuoteComparisonState derives its saved-status message key and incomplete-read state in
named computed values. ProjectWorkState derives a nullable recovery-source view state
containing the actual source ID and blocked status. The templates consume those states
instead of repeating nested conditional expressions. No new component, wrapper element,
event handler, storage path, gate or suppression is introduced. The Quote message is still
translated in the template; the computed value supplies only its key.

## Verification state

- Source comparison against current root: passed before edits.
- Diff checks: passed.
- `npm ci --ignore-scripts --no-audit --no-fund`: passed, 567 packages installed.
- Native tests: 34/34 passed in seven files, 47.96 seconds. These cover downstream
  saved-source, dialog focus, lifecycle, unavailable settings, Project Work recovery/flow
  and Quote flow. Draft, Retry, source-opening and history behavior passed unchanged.
- `vue-tsc --noEmit`, whole-tree Oxlint and scoped ESLint for the two views: passed.
- Fallow dead code/duplicates: passed, zero issues and zero clone groups.
- Fallow template health: neither changed view exceeds the unchanged cognitive ceiling
  of 15. The sole remaining cognitive finding is root-owned EvidenceInspector at 16.
- Browser capture and full coverage: not run or claimed by this checkpoint.

The initial WIP push preserved progress under usage limits. The 34 native tests now verify
the DOM behavior and focus/draft/retry/source guards after deriving the view states.

Analysis commands were `node node_modules/fallow/bin/fallow --skip health --fail-on-issues
--format json` and a separate `fallow health --coverage <preserved-full-73-JSON> --format json`.
The first exited 0; the second exited 1. The preserved full coverage uses another worktree's
absolute source paths, and the health report confirms **zero of 18,807 Istanbul positions
matched**. Its 95 additional estimated-CRAP findings are therefore not evidence of new
production defects, and this is not a complete health/CRAP pass. Template cognitive
measurements are independent of that coverage mismatch and show both targeted findings
removed. No config, threshold, suppression or coverage input was rewritten to hide findings.
Fallow also reported the existing skipped `.claude` directory; it was not changed.

Machine output remains at `%TEMP%/rp-e-downstream-states-native.json`,
`rp-e-downstream-states-static.json` and `rp-e-downstream-states-health.json`. A compact
derived record is committed as
[`downstream-view-states-verification.json`](evidence/downstream-view-states-verification.json).

## Next action

The exclusive heavy slot was explicitly released to integration after every process
terminated. Root verifies its EvidenceInspector and CI changes next, then UI receives its
turn. No further heavy command is authorized for this contributor until another handoff.

Integration can cherry-pick the WIP source commit followed by this verification record,
then verify complete health against fresh correctly addressed combined coverage. This
checkpoint does not claim the integration's separate EvidenceInspector finding is fixed.

Next contributor work is read-only: inspect the preserved full `73b0c205/missing-counters.json`
for QuoteForm.vue and work/projectWorkActions.ts (six missing branch arms each), and propose
a bounded package of real native lifecycle/late-result cases before any source edits. Avoid
private handlers or impossible service results. Preserve the next audit as its own small
documentation commit and push before a long pause.

If checks expose a behavior change, fix only this bounded view concern, repeat the relevant
failed check, update this record, and push a verification checkpoint. Report branch/SHA,
results and integration recommendation before releasing the slot. Do not edit root's shared
ledgers or EvidenceInspector, or UI's editor WorkRow. Root coordinates the final integrated
gate and PR #91; no merge is authorized here.

Preserved source analysis:
`%TEMP%/rp-finalization-20260907-88b9ee3d/full-checkpoint-73b0c205/analyze.log`.
Integration task: `01a0786f-b624-7303-987f-b18b94db48d9`.
