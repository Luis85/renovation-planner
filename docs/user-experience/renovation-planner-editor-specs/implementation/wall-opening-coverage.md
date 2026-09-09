# Wall rotation and Opening Move coverage follow-up

Base: `b10c3b24d51735fdf53b3acd5fbc095024c987ad`. The frozen full check passed **730 files / 8624 tests**; coverage alone failed. The matching aggregate is `C:/Users/lum/.codex/tmp/editor-coverage-b10c3b24.json`. Source-owned gaps were 8 branches in WallRotationForm, 7 branches plus 2 functions in wallRotationActions, and 7 branches in openingMove.

This test-only follow-up adds 14 cases:

- Seven form cases cover an invalid initial geometric proposal, unreadable Room identity fallback, an editable unexpected dispatch failure with renewed review, distinct superseded/recoverable refusals, resolved/rejected dispatch after unmount, and read-only recovery/focus/retirement. Real form controls and dispatched promises are used; RGB or other unrelated evidence assertions are untouched.
- Six runtime cases cover refused/thrown baseline reads with retry, a host removed in a newer repository snapshot, selection retirement after preview with a captured late dispatch callback, source-note and readback recovery without write replay, and a late baseline exception after disposal. Existing real repositories, command/history paths and native form integration remain in use.
- One Opening Move case changes selection synchronously when a preview is published, verifying that the following commit admission refuses the stale target without writes/history or stranded task state.

The remaining Opening Move defensive checks around absent services/baselines/invalid hosts, offset failure and failed tool admission were not forced through fabricated repository snapshots or impossible state mutations. A fresh coverage result should determine which guarded paths still need meaningful independent scenarios.

Status: **source-ready, unverified**. Only source/fixture review and `git diff --check` ran. No test, lint, types, coverage or browser process was started. No production files, thresholds, suppressions, assertions or timeouts changed. Root owns the combined focused rerun. The paused clean quality reconstruction remains untouched at its documented Inspector conflicts.

## Additional native modal/navigation cases

Six further source-ready cases target the matching b10 gaps: border-box-only sizing and absent device ratio/font fallback in ReferencePreview; native zoom-out plus empty-margin/collapsed-pointer refusal; late Reference dispatch exception after disposal; native evidence-type focus transfer; connected-leaf linked-navigation focus ownership; and duplicate native Add admission into one planning dialog. Existing assertions are retained.

No MaterialMarkers case was added by injecting nonfinite geometry, removing a hydrated Plan while rendering its canvas, or manufacturing a structure-record Room kind. The reported null-bounds and room/area normalization guards appear defensive under current validated inputs. Likewise, Reference commit's repeated scale/kind guards and EvidenceFields.create's repeated busy/capability gate are behind prior admission checks. These observations are limits of this bounded test work, not coverage exemptions.

The six additions and prior fourteen cases remain unrun here. No production changes or threshold/timeout changes. Fresh coverage should measure actual gains after the root's combined run.

## First focused result and fixture corrections

The combined additions run at 56a63e32 completed with **155 passed / 13 failed across 19 files**. Eight failures belonged to this follow-up: six wall-form tests used an invalid single-wall Room boundary, one runtime test exposed a non-reactive retirement flag leaving the angle field editable, and one font test assumed JSDOM resolves an empty font to an empty string.

The isolated correction uses all four WALL_LOOP IDs for a valid closed boundary while preserving the absent Room-name lookup; dispatch/recovery assertions can now exercise their intended paths. The retired-review test retains immediate readonly and disabled-Apply assertions, checks the recovery action is unavailable for retired drafts, and verifies both captured dispatch and actual Apply cannot reactivate a preview or write. The font test controls only the computed fontFamily response for the preview canvas, retaining the real draw and real pixel buffer.

The runtime failure is a real UI defect: wall rotation's epoch was a plain variable read inside computed props, so selection-only retirement cleared the preview and blocked imperative dispatch without invalidating the form's controls. Change epoch to a reactive ref and capture its numeric value for the existing lifetime checks. The observed pre-fix readonly=false assertion is the reproduction. This source correction is limited to wall-review retirement; persistence, commands and dispatch admission semantics are unchanged.

Repairs are **unverified** pending the combined retry; only source review and diff whitespace checks ran. Original failure results are preserved in `C:/Users/lum/.codex/tmp/editor-boundary-additions-20260909.log`.

## Diagnostic-union follow-up

The diagnostic union (not a coverage gate input) guided six further source-ready cases: repeated native zoom at both clamps; queued swing controls after busy admission; Room planning over a legacy geometry document without structure; legacy Room-origin material metadata/navigation/highlight; and failed Room-name/Area-details saves completing after their form is unmounted. These cover reachable user/data paths while retaining actual DOM events, valid repositories and focus ownership.

No production change or heavy check was run. The diagnostic union is used only to find locations; only the unchanged final suite/coverage gate can establish completion.
