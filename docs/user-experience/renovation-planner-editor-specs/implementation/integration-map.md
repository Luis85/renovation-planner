# Editor finalization integration map

Status: active contribution on `codex/editor-plan-finalization`, isolated in `.worktrees/editor-plan-finalization`. Main remains on the integration branch. No PR has been merged by this task.

## Pushed predecessor ancestry

The refreshed #88 head below contains every listed predecessor tip. Initial baseline `3006915e8019dec66b24c945710495df48336582` did not contain all of those corrections. The pending local predecessor merge was retired, own changes were safely stashed, and the branch fast-forwarded to the newer #88 head before reapplying those changes. The stash is retained until the contribution is committed.

| PR | Branch | Incorporated tip |
|---|---|---|
| #74 | codex/editor-implementation | 2f1fce9b32b91f2fc8e79975e9c72fd101073f2c |
| #75 | codex/editor-area-creation | 4046d6aa4937b48cf262868f522264cfa515e79a |
| #76 | codex/editor-area-numeric | 341ad97371d8e42f8d730b38b4ee85d5409e3a53 |
| #82 | codex/editor-room-dimensions | 38ec673bd5659f036ef01b9c3744806214616425 |
| #83 | codex/editor-room-naming | 5326e14a071129a5113231d85b72ce3637375ef8 |
| #85 | codex/reference-plan-workflow | f58f1f143ebb6f6e47a8e183ed7c365535b34f0c |
| #86 | codex/connected-walls | be55cba76d21205ae6e18949c7d1d068755d73f8 |
| #87 | codex/renovation-workflow | 7877e47325c277792f462cc365cf37f2a260ee69 |
| #88 | codex/materials-costs-evidence | 3c1c737a5bfaf0a9e4782f1cbfe2ec4e0aca7f6a |

Corrections retained include first-corner Area completion, Room heading after peer rename, Zone geometry digest participation, reference baseline handling without calibration, metadata/geometry conditional-write handling, linked-evidence event filtering, stale material measurement and suppression of Review all-clear while planning is unavailable. Equivalent earlier #88 corrections are retained through ancestry rather than duplicated with cherry-picks.

## Parallel checkpoints

| Task | Branch | Agreed pushed checkpoint incorporated | Shared-file resolution |
|---|---|---|---|
| Implement locked editor UI | codex/editor-visual-fidelity | `0b23eabab0af13df24e932522de1c20c4f143e60` (#89), via `6bbea815`, `f495d57c` and `b569dd22` | Preserve UI composition, shared record identities, overview and target scope; finalization owns planning scope/navigation glue |
| Improve M15 recovery workflow | codex/planning-recovery | `7ba5937d127d596a0705f634638cb13df1940038` (#90), via `aecef294`, `816b7929` and `bf8eb4be` | Preserve retained drafts, coalesced read-back, conflict/history gates and locale parsing; finalization owns contextual draft defaults |

| Improve M15 recovery workflow — shell continuation | codex/persistent-editor-shell | `65118f47c536fb20b43064d5280fbdb4908d93b3`, via `e73862b6` | Stable native DOM outlets, focused overlays and cleanup; no overlap with root record navigation or markers |

## Verification and review state

Finalization targeted checks pass for canonical Project/Library navigation, contextual material/cost/evidence draft inheritance, and mixed Room deletion history. These are not the final combined gate. Combined `vue-tsc -noEmit` passes after the UI/recovery and element foundation integration. Full lint and 101 targeted tests across 17 files pass, including recovery, compensation, peer movement, schema transitions, current/intended edits and contextual inheritance. Full coverage/Fallow and final visual/host journeys remain pending. Recovery standalone full gate passed (541 files/7259 tests; branch 98.04%); UI854 adds 41 passing focused regressions to its prior CI checkpoint. These are independent evidence, not a combined full-gate pass. The [completion matrix](completion-matrix.md) keeps those obligations explicit.

Review #87 discussion r3945187814 is addressed locally by propagating sidecar before/after receipts through deletion and boundary restore. The normal mixed-history regression failed before the change and passes afterward; a real peer write still refuses an older inverse. The fix is pushed at `d9e7afb`; reply `r3945825138` links verification. The predecessor thread remains unresolved because its own branch does not contain the integration correction. Hardening owns #88 evidence rename ordering r3945203165 and thumbnail reset r3945203166; UI owns preservation of unrelated PlanningDepth when removing renovation records.

## Intended merge relationship

The open draft integration [PR #91](https://github.com/Luis85/renovation-planner/pull/91) targets `codex/materials-costs-evidence`. Review and merge predecessor PRs in dependency order #74 → #75 → #76 → #82 → #83 → #85 → #86 → #87 → #88, preserving their fixes and retargeting dependents as needed. Parallel #89 and #90 pushed tips are incorporated here. They are siblings based on #88; their changes must land once through the integration candidate or through both siblings before retargeting the integration PR. The human chooses the final merge strategy after reviewing the combined candidate. Do not independently duplicate their changes onto the integration branch or merge an obsolete sibling tip. The final PR may target main after its base is merged; no merge or release is authorized by this task.


## Latest verification snapshot — 2026-09-07

Remote refs were fetched again; all nine predecessor tips still match the table. PR #88 at `3c1c737a5bfaf0a9e4782f1cbfe2ec4e0aca7f6a` is open and its four Linux/Windows CI verification legs and audit succeeded. These results cover that predecessor only. The agreed UI and recovery checkpoints are incorporated as recorded above. The current element foundation is an intermediate tested handoff for Object integration; it is not the final combined acceptance gate.

The first finalization `npm run check` passed build and lint but did not complete coverage: default-worker contention caused test timeouts and an inventory assertion exposed the new navigation owner. The inventory regression is fixed and passes; no coverage/fallow success is claimed for this run. Subsequent focused checks cover navigation, planning source inheritance, mixed deletion history, review corrections, Area details, numeric outline edits, free-shape Room creation and Add Note. The required final combined gate will use the supported `VITEST_MAX_WORKERS=2` setting without altering coverage thresholds or test timeouts.

Foundation `a0e91241` remote CI completed with all four verify legs failing. The Node 24 leg identified six test files with outdated fixture/capability/schema/scene expectations, formal German address violations, and a missing reversible event-census entry; focused corrections are under verification. Its coverage is 98.16% statements, 96.35% branches, 97.89% functions and 99.00% lines. This failed run is recorded as failed, and no floors were changed. Shell `65118f47` separately passed build/types, full lint, 12 native-focus and 114 related tests plus four Edge 152 browser scenarios; combined source verification remains pending.

Connected follow-up verification: `vue-tsc --noEmit` and changed-file ESLint pass after extracting navigation fallback; 13 files / 117 tests pass in 63.51s with two workers. The batch includes all six previously failing CI files, exact Area metadata events, persistent shell focus, record navigation, material/evidence markers, atomic spatial deletion, planning workflow and batch guards. Full combined coverage/Fallow and Object/visual/host acceptance remain pending.

The `88b9ee3d` Node 24 CI run fixes all six earlier failing files. Its remaining four failures are the naming/resize harness assumptions that reflow removes native openers; the shell owner is retaining identity assertions and verifying visible modal focus return. Coverage remains below floors at 98.34% statements / 96.40% branches / 98.24% functions / 99.20% lines. The final recovery probe preparation `d9a1334e` is incorporated via `1a80dcf9`, before the full gate, without claiming new performance results.

Persistent focus `cad06deb66b7c65c161ba0a9d39908663712d2b3` is integrated via `15aff205e3c62e2d817abaef12bc6907e1437b61`. The pushed remote ref was verified. Root Area paused-select and linked-navigation changes remain pending combined verification; the merge preserves the owner’s native reflow tests and artifacts.

Object `aa9896db2aa75a592797b835fff84549886383e9` is incorporated through `853e76fb3cca7ff27bda02f5d4332c25c00a5e00`. Its pushed remote ref was fetched, and semantic inspection confirms the shared outline retains both the neutral Name label and root input-guard extraction. All eleven Add routes and generic item list now join the shell and connected planning implementation; combined verification remains pending.

Capture-only UI `443d721d992e90d5bc7465d72c8c1a716ef9f7b0` is incorporated, followed by recovery `2c353329c92c4e93b753afbab7649ad7964b37d8` through `149ec0bd`. The latter distinguishes unrecovered writes in the shared draft panel without changing callers. Release-note and guide conflicts retain both tasks’ information. Owner verification: 65 focused tests plus types/oxlint/scoped ESLint; combined verification is in progress.

The joined root followup passes types/scoped ESLint and the focused verification recorded in [joined editor verification](joined-editor-verification.md). Standalone joined-tree Fallow duplication and dead-code diagnostics both report zero findings; the full coverage-weighted gate remains required.
