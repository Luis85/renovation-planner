# Wall rotation and Opening Move coverage follow-up

Base: `b10c3b24d51735fdf53b3acd5fbc095024c987ad`. The frozen full check passed **730 files / 8624 tests**; coverage alone failed. The matching aggregate is `C:/Users/lum/.codex/tmp/editor-coverage-b10c3b24.json`. Source-owned gaps were 8 branches in WallRotationForm, 7 branches plus 2 functions in wallRotationActions, and 7 branches in openingMove.

This test-only follow-up adds 14 cases:

- Seven form cases cover an invalid initial geometric proposal, unreadable Room identity fallback, an editable unexpected dispatch failure with renewed review, distinct superseded/recoverable refusals, resolved/rejected dispatch after unmount, and read-only recovery/focus/retirement. Real form controls and dispatched promises are used; RGB or other unrelated evidence assertions are untouched.
- Six runtime cases cover refused/thrown baseline reads with retry, a host removed in a newer repository snapshot, selection retirement after preview with a captured late dispatch callback, source-note and readback recovery without write replay, and a late baseline exception after disposal. Existing real repositories, command/history paths and native form integration remain in use.
- One Opening Move case changes selection synchronously when a preview is published, verifying that the following commit admission refuses the stale target without writes/history or stranded task state.

The remaining Opening Move defensive checks around absent services/baselines/invalid hosts, offset failure and failed tool admission were not forced through fabricated repository snapshots or impossible state mutations. A fresh coverage result should determine which guarded paths still need meaningful independent scenarios.

Status: **source-ready, unverified**. Only source/fixture review and `git diff --check` ran. No test, lint, types, coverage or browser process was started. No production files, thresholds, suppressions, assertions or timeouts changed. Root owns the combined focused rerun. The paused clean quality reconstruction remains untouched at its documented Inspector conflicts.
