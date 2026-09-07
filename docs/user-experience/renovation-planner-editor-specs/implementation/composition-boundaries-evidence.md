# Composition boundary cases — source checkpoint

Status: **WIP, unverified**. Prepared on the root topic worktree from `95e7510b` on
2026-09-07. Only five existing test files and this document were changed. No
production code, thresholds, suppressions, fixture helpers or shared status files
were changed. Root owns checkpointing and verification; UI held the heavy slot
during preparation.

## Cases added

| Existing test file | Public behavior exercised | Evidence required from the pending run |
| --- | --- | --- |
| `tests/plugin/planningEditorServices.test.ts` | First composed renovation on a Plan with no register, followed by Undo and Redo | Register appears, disappears, and returns with identical facts and IDs; geometry remains unchanged. Uses `renovationStack`, whose Plan has no preseeded renovation. |
| `tests/plugin/projectWork.test.ts` | Newly assigned Trade becomes unreadable after a real external schema edit | Actual repository schema refusal reaches the command; all vault bytes stay unchanged; restoring the original Trade bytes permits explicit retry of the same command. |
| `tests/plugin/projectWork.test.ts` | Canonical Project, Plan and Room index events reach composed Work subscriptions | Each relevant event notifies; an Asset event does not; disposal stops subsequent notifications. Uses `projectIndexEntryChanged` with real fixture identities. |
| `tests/infrastructure/obsidian/repositories/namedCatalogueRepository.test.ts` | Host refuses a real catalogue-note create, followed by retry | Repository returns `trade.write-failed`; no note, index entry or created event appears. Removing the FakeVault failure allows one Trade under the same identity and one event. The failure path comes from the production `freshNotePath`. |
| `tests/infrastructure/obsidian/repositories/quoteRepository.test.ts` | Comparison read after the owning Project note disappears, followed by repair | Returns `project.not-found` without writes; restoring the original bytes restores complete Work and Quote results. |
| `tests/plugin/editorWorkspaceNavigation.test.ts` | Work/Quote destination navigation survives a failed host state change | Correct destination/origin reaches the reused Project leaf; the editor remains intact; one mapped fault is reported, and explicit subsequent navigation succeeds. Only the actual host `setViewState` promise is faulted. |

All new subscriptions, composition subscriptions, host spies and injected failure
keys have explicit cleanup. External file mutations are confined to per-test
in-memory vaults. Existing cases are preserved.

## Coverage provenance and limits

The audit used the original full-run `coverage-final.json` and
`missing-counters.json` in
`%TEMP%/rp-finalization-20260907-88b9ee3d/full-checkpoint-73b0c205/`.
The audited production files were unchanged between that source checkpoint and
the preparation base. Estimated reachable additions are **7 branch arms and
6 statements**, not a measured improvement:

- `planningEditorServices.ts`: branches `2:1`, `3:1`, `5:1` at lines 36/38.
- `tradeAssignments.ts`: branch `3:0` at line 14.
- `projectWorkServices.ts`: branch `3:0` at line 21.
- `NamedCatalogueServices.ts`: branch `5:0` at line 31.
- `QuoteServices.ts`: branch `0:0` at line 36.
- `editorWorkspaceNavigation.ts`: two unexecuted downstream statements at line 15.

The event test verifies the public subscription policy; it does not claim a host
vault adapter emitted those events. The workspace fake records navigation and
cannot prove Obsidian's actual pane rendering/history. Catalogue create may leave
created empty folders after host refusal; the guarantee asserted is no partial
note, index entry or success event.

Excluded from this package: payloadless index events, fabricated missing composed
services, missing Work outcome subjects despite validated links, currency-mismatch
errors inside currency-grouped quote totals, invalid Calibration snapshots, and
the unreachable final subject-description fallback. No artificial inputs were
added to drive those counters.

## Resume and verification

Source review and `git diff --check` were performed during preparation. **No tests,
types, lint, build or analyser were run by this owner.** Root should run these five
test files with the scheduled native batch, then the normal shared checks. Check
the actual coverage delta against a fresh combined full-run report; do not sum
the estimate into the reported global percentage. Preserve the original full-run
coverage files when executing any scoped coverage command.
