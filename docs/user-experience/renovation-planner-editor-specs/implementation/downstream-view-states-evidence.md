# Downstream view states — verification and resume

Updated: 2026-09-07. **WIP: source prepared, not yet verified.**

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
- Diff checks: passed for this WIP checkpoint.
- Dependency installation: not yet performed in this fresh worktree.
- Native recovery/navigation tests, types, lint and Fallow: pending the exclusive heavy slot.
- Browser capture and full coverage: not run or claimed by this checkpoint.

The implementation is deliberately pushed as WIP to preserve progress under usage limits.
Do not call the two template findings resolved until the actual Fallow measurement passes.
The DOM, focus/draft/retry/source guards must be verified by the existing native tests.

## Next action

Wait for integration to release its current heavy slot. Then install dependencies and run
the existing downstream saved-source, dialog-focus, lifecycle, unavailable-settings,
Project Work recovery/flow and Quote flow tests. Run type checking, whole Oxlint and scoped
ESLint for the two views. Measure Fallow's template health plus dead code/duplicates using
the preserved full coverage carefully: its source paths refer to a different worktree and
its counter maps precede this refactor, so do not present its coverage/CRAP values as a new
full-tree measurement. Record the exact analysis command and any unrelated findings.

If checks expose a behavior change, fix only this bounded view concern, repeat the relevant
failed check, update this record, and push a verification checkpoint. Report branch/SHA,
results and integration recommendation before releasing the slot. Do not edit root's shared
ledgers or EvidenceInspector, or UI's editor WorkRow. Root coordinates the final integrated
gate and PR #91; no merge is authorized here.

Preserved source analysis:
`%TEMP%/rp-finalization-20260907-88b9ee3d/full-checkpoint-73b0c205/analyze.log`.
Integration task: `01a0786f-b624-7303-987f-b18b94db48d9`.
