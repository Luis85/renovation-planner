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

## Current integration after compact detail layouts

Full `24ee3177` verification failed only the unchanged statement, branch and function coverage floors after build/full lint and all 580 test files passed; complete Fallow diagnostics also identified three complexity findings. Exact results and followups are recorded in [joined editor verification](joined-editor-verification.md). These failures supersede earlier pending-gate descriptions.

UI `c080b0a956470cb862ad29f73f8bfd8ba46c7f64` is integrated through `ed7617110c59f95db4b95658812eee0c81c05343`. It adds compact M12 material rows, M13 Work groups, M14 photo gallery and phase controls, compact persistent navigation, bounded Room Inspector extraction and the browser-discovered Plan-to-Renovate target correction. The owner reports build/types/scoped ESLint/whole oxlint, 95 focused tests, 57 navigation regressions, and four connected browser scenarios with 12 zero-violation axe scans. Raw incomplete checks and five screenshots are in [the detail-layout ledger](editor-detail-layout.md). This is owner evidence; the new combined tree is not yet verified.

Recovery probe preparation `650adabeb5b567949419c4308dffd1a7a2066f9a` follows through `7b76277b2031165ff1710847e4c32d7dd5d7d538`, adapting the existing probe to compact material rows and contextual disclosures. It is source preparation, not a new performance/cleanup result. Both merges are conflict-free; semantic review preserves asynchronous record reveal, native cost-group opening, selected-photo metadata and the canonical selected spatial context.

Three new #90 review findings remain assigned to the original recovery branch. Its modal native-control followup is isolated in a separate worktree. No replacement task, merge, release or worktree deletion has been performed.

UI final-runner preparation `ba9bccd1609d602a8368350b9b6e94775da84077` is integrated through `7d3fe5054c2d81bb1a16d8994ebe968017b31b46`. It schedules the existing recovery/performance probe sequentially within the all-screen runner, requires freshly generated reports and uses the actual saved-refresh-needed state for M15 comparison. UI and recovery explicitly agreed shared interpretation to avoid duplicate captures. Syntax checks are owner evidence only; no final runner execution has occurred.

Projection/recovery `f252606b5e8d07fab9e4c943c0984b2446056484` is incorporated through `b19f73c4d234a8635020aa391d9ad4a37e5de42c`; production merges are automatic and the release-note conflict keeps both focus and projection fixes. The owner reports 80 passing targeted tests, but CI then found an Oxlint loop-condition error in its final edit. That failure is confirmed by root’s joined Oxlint and requires the owner’s followup before a complete gate.

Saved Room overview recovery capture preparation `a4e902de0e805f657e65332df05b5e93afee5604` is incorporated through `a3c31190f6730028e0965577af5e72bffd72bbca`. The existing recovery probe now navigates Materials → Room overview → Materials while read-back remains stale, checking retained warnings and unchanged write counts. It remains unexecuted preparation.

Recovery loop correction `00adf08254bf9f6cde1618697f19b8bb4a94d0bb` is incorporated through `531132b958ff4cc9fae9773f8533d9fdd4d327a0`. The owner reran whole Oxlint, types, scoped ESLint, Fallow and 14 focused regressions after the final edit; the coalescer has 100% scoped coverage. Fresh CI and the final combined gate remain pending. Semantic review confirms immediate retirement of both store tickets, disposal guarding, and continuation after superseded read rejection.

M13 UI followup `adaeb7821c407674828807a8bb5be834b9936829` is integrated through `54717024f7f6814764763e5a5cf4dd0e621baf2d`. Explicit native group opening selects its Work context and highlights current spatial targets, with intended-only fallback and no invented geometry. Owner verification: 27 tests, two components at 100% scoped coverage, build/types/scoped ESLint/whole Oxlint, and four browser journeys with 12 zero-violation axe scans. The report explicitly notes an inset focus-ring CSS rule added after browser/build verification; final combined capture must include it. First/programmatic opening and unassigned groups retain focus; exact cost/material reveal remains intact.

### Modal controls and shared Work outline integration

- Cherry-picked agreed E checkpoint `75084550d5d577943278af44ea99686ddec064e2` as `253924fa`: native pending-save focus/refusal, removed unused nested-draft forwarding, modal browser driver and owner evidence.
- Merged agreed UI `faeba386833a98963577ddb01957a3287b3e70b0` as `9b2c32bbd5d985cc179f5e30b9241d7122dba1f3`: one highlight per physical target, preserved distinct Room relationships, and modal final-driver hookup. No source conflicts.
- Root spatial/regression work was backed up as stash `0be7dacea5b3cfa1d171b25928a712eb7873238e` and restored cleanly. This is a local integration checkpoint; the combined full gate remains pending.

- Cherry-picked E review checkpoint `37da445f94d9aa43897c3b013bfa237541dcd1ea` as `0fff8855`: planning/renovation draft retry failures are reported once and late reports are suppressed. Conflict resolution preserves the joined shared `dispatch` helper, batch action and both changelog entries, while substituting the safe retry callback. Root additionally owns the same concrete failure in existing-element and creation-draft retries.

### Reviewed wall controls and preliminary journey evidence

Root `a630bf76` restores reviewed wall endpoint proposals in Renovate and extracts the shared draft retry callback. Forty-one focused cases, full npm run lint and vue-tsc pass; full coverage remains pending. Agreed UI checkpoint `408b443ff24c1b914b810ab3b9e773668db8d6ea` is merged after it, adding the native Close-panel driver correction and four-scenario overview plus four-scenario resilience evidence from `4dbc96dd` plus that driver change. Its reports retain the initial constrained-focus failure and explicitly exclude final M00/M07/all-18 acceptance.
