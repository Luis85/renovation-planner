---
title: "Plan editor — first beta improvement and execution plan"
date: 2026-09-16
status: proposed
repository: "Luis85/renovation-planner"
review_baseline: "f82695645601b98a7febd95dbc8171c19237a245"
handoff_baseline: "d77e7c5eba5e6518b93a5be4606532ceab3a77eb"
primary_surface: "Plan editor"
language: en
---

# Plan editor — first beta improvement and execution plan

## 1. Purpose and intended outcome

Prepare the existing Renovation Planner Obsidian plugin for its first beta by improving the plan editor's safety, interaction completeness, discoverability, and evidence of readiness. This is an implementation handoff, not a proposal to rebuild the editor or expand the product into CAD.

**Beta outcome:** a first-time user can create or import a plan, set its scale, draw and correct rooms and objects, connect the existing renovation information, undo mistakes, close and reopen the plan, and understand when their data needs attention.

**Delivery rule:** finish the existing user journeys before adding more capabilities. Freeze unrelated feature expansion for the beta candidate. Do not remove already working features merely to make the checklist smaller.

This document specifies proposed work, not completed work. No application changes, local test runs, native Obsidian checks, or release actions were performed while preparing it.

### 1.1 How to use the handoff

Place this folder under `docs/releases/first-beta-readiness/`, or use the repository's equivalent release folder after discovery. Read this plan first; use `02-next-session-prompt.md` to start the implementation session. Maintain `03-execution-tracker.md` as the current handoff record. Use `04-beta-acceptance-matrix.md` as a release-level index into existing cases, not a replacement test catalogue.

The BP identifiers below are planning identifiers. Map them to existing requirements, PBIs, test cases, and pull requests before creating new backlog notes. Follow the repository's actual frontmatter and lifecycle conventions; do not introduce a competing backlog system.

### 1.2 Baseline and evidence limits

The original review inspected `main` at `f826956`, dated 15 September 2026. During preparation of this handoff, `main` had advanced to `d77e7c5`, dated 16 September 2026, after merge #223. The recovery store, the regression test that captures its remount gap, the editor user guide, the package scripts, and the native acceptance preparation were re-read at the newer revision. [S01–S06]

Other findings below are carried forward from the earlier source review and are labelled accordingly. The next session must inspect the current branch and reconcile the delta. Do not assume a historical failure is still present, a previously passing feature still passes, or an old acceptance record covers a new bundle.

**Evidence classifications**

| Classification | Meaning | Required response |
|---|---|---|
| Confirmed source defect | Current code/test documents an undesirable behaviour. | Reproduce behaviour with a failing desired-outcome test, then fix it. |
| Documented interaction gap | Current guidance explicitly excludes an important interaction. | Reconcile the interaction contract and implement the smallest complete path. |
| Verification gap | Implementation exists but current-release evidence is incomplete. | Test first; change production code only for demonstrated failures. |
| Documentation drift | Source and prose disagree. | Establish current behaviour and correct the authoritative documents. |
| Proposed improvement | A product recommendation, not an observed failure. | Validate need, keep scope bounded, and do not label it a bug. |

### 1.3 Findings that drive the plan

| Finding | Baseline evidence | Work |
|---|---|---|
| An incomplete-write warning is lost on settings rebind because the editor receives a fresh Pinia store. A test explicitly expects this known gap. | Reverified at handoff baseline. [S02, S03] | BP-01, BP-02 |
| Existing arbitrary Room/Area corners have no approved keyboard or non-drag correction path in the current user guide. | Reverified at handoff baseline. [S04] | BP-04 |
| The inspected native acceptance document is preparation, not acceptance of the current candidate. | Reverified at handoff baseline. [S06] | BP-00, BP-13 |
| The general recovery guide acknowledges no general durable crash journal and the remount warning limitation. | Earlier review; recheck current source. [S07] | BP-02, BP-11 |
| Manual cases already exist; do not recreate the catalogue. | Earlier review. [S08] | BP-00, BP-13 |
| Desktop editing and mobile read-only are the existing product boundary; real-device evidence was outstanding in the inspected mobile case. The tree does not yet honour mobile read-only for the Asset Library (`03-execution-tracker.md` L-43). | Earlier review; recheck before support claims. [S09, S10] | BP-09 |
| The sample-project command is review scaffolding, not yet a complete user onboarding experience. | Earlier review. [S11] | BP-10 |
| Room-heavy zoom performance has already been improved; old slow measurements must not be treated as an unfixed defect. | Earlier performance ledger. [S12] | BP-08 |
| Release, product, and recovery documents contain historical statements that do not consistently describe the implemented editor. | Earlier review. [S07, S09, S13] | BP-11 |
| A clean shareable plan image would complete a useful homeowner task. Its absence was not conclusively established across the whole repository. | Proposed addition; discover first. | BP-15, optional |

## 2. Scope, priorities, and non-negotiable constraints

### 2.1 Priority definitions

**P0 — beta safety gate.** Must be resolved before any unsupervised beta distribution. Acknowledging the risk or requiring a backup is not a substitute for correcting a known silent-loss or false-recovery defect.

**P1 — first-beta quality gate.** Complete for a broad beta. A limited closed beta may carry a precisely documented, non-safety limitation with an explicit owner decision and a usable alternative. Such a limitation cannot be represented as accessibility conformance or as a passed test.

**P2 — optional improvement.** Does not block the default beta. Implement only after the mandatory path is stable or when explicitly promoted into the release scope.

Priority describes release impact, not the order in which all tasks must be coded. Reclassify a newly reproduced data-loss issue as P0 regardless of which package discovered it.

### 2.2 Constraints to preserve

- Keep Obsidian, TypeScript, Vue, Pinia, Konva, the existing command/history model, and the repository's layered architecture. All vault writes remain behind the established infrastructure boundary. Follow local instructions and architecture decisions before this proposal.
- Keep project documentation and implementation in English. Maintain existing English/German UI translation coverage; use Obsidian's theme variables and native conventions. Do not add an account, logo, independent application shell, or language selector.
- Preserve entity identities, saved precision, explicit version checks, hosted-opening relationships, and the independence of existing versus intended geometry. Do not round persisted values to displayed values without explicit user input.
- Preserve Plan as geometry editing, Renovate as renovation context, and Review as read-only viewing. A view/perspective change is not itself a saved geometry mutation. [S04]
- Do not silently turn independent Room outlines into wall-derived geometry. Explicit enclosure/grouping is not continuous automatic wall reconstruction. Confirm the current contracts before editing shared geometry.
- Reuse existing forms, dialogs, selection rules, error handling, fixtures, and case notes. Never bypass a command or repository guard from a component to make a feature work.
- Do not weaken lint rules, coverage thresholds, architecture checks, or test assertions to achieve a green build. Replace assertions of known bad behaviour with desired-behaviour regressions only when implementing the corresponding fix.
- Work in isolated synthetic vaults. Do not run fault injection, migrations, forced failures, or destructive recovery experiments against personal renovation data.

### 2.3 Explicitly deferred

New structural object families, expanded asset-authoring tools, automatic CAD/BIM interoperability, 3D, multiplayer/cloud work, full mobile drawing, a general geometry-engine rewrite, a generic workflow framework, and a full automatic process-crash rollback/replay journal are outside this plan.

The optional snapshot is not a professional plan sheet or a construction-approved export. New project-management domains are also outside scope; existing Work/Materials/Costs/Evidence paths must continue to function.

## 3. Ordered delivery roadmap

| Milestone | Packages | Exit condition |
|---|---|---|
| M0 — establish the actual baseline | BP-00 | Current source, existing coverage, ownership, findings, and release scope reconciled. |
| M1 — remove false recovery and lifecycle hazards | BP-01, BP-02, BP-03 | Known recovery incidents survive remount/restart; unsafe mutation is gated; lifecycle tests pass. |
| M2 — complete precise and understandable editing | BP-04, BP-05, BP-06, BP-07 | Core creation/correction/cancel paths work with pointer and keyboard; no mode/reflow traps. |
| M3 — establish supported use and first-use guidance | BP-08, BP-09, BP-10, BP-11 | Representative performance, support boundary, onboarding, compatibility, and documentation evidenced. |
| M4 — verify the actual candidate | BP-12, BP-13 | Frozen production bundle has a passing release ledger and no unresolved blockers. |
| M5 — approve and package beta distribution | BP-14 | Owner records go/no-go and, separately, authorizes publication. |
| Optional — share a clean snapshot | BP-15 | Only include if explicitly selected; then include it in candidate tests. |

**Practical order for one implementation stream:** BP-00 → BP-01 → BP-02 → BP-03 → BP-04 → BP-05 → BP-06 → BP-07 → BP-08 → BP-09 → BP-10 → BP-11 → BP-12 → BP-13 → BP-14.

Set up native/device test appointments and evidence slots during BP-00, rather than discovering missing hardware at M4. Documentation reconciliation and fixture inventory can run alongside coding. Final release acceptance cannot.

**Parallelism rule:** one owner at a time for shared editor runtime, plugin lifecycle, selection, or persistence files. Independent fixture, documentation, and device-test work can proceed in parallel. Integrate before recording combined acceptance. Keep one accountable integrator; do not use concurrent merge queues as a substitute for ownership.

No calendar estimate is asserted. Size and sequence work after BP-00 using the actual code delta and available hardware. Package splits below are intended to support multiple focused sessions and reviewable pull requests.

## 4. Actionable work packages

### BP-00 — Reconcile the repository and establish a beta baseline

**Priority:** P0 process prerequisite. **Type:** discovery and evidence reconciliation. **Depends on:** none.

**Outcome:** the next session knows what is actually implemented and which review findings remain actionable.

**Starting points:** local `AGENTS.md` files if present, `CLAUDE.md`, `PRODUCT.md`, `README.md`, `RELEASING.md`, `package.json`, `manifest.json`, the SDD and ADRs, editor specifications, `docs/tests/cases/`, and the current release ledgers. Paths are starting points, not authority over newer repository instructions.

**Actions**

1. Inspect the working tree, branch, worktrees, local instructions, and any uncommitted changes. Fetch only when permitted. Do not reset, clean, stash, or overwrite someone else's work.
2. Record the exact working revision and compare it with this handoff baseline. Inspect recent relevant PRs and existing backlog items. Map each BP to an existing item or justify creating a new one.
3. Re-read the specific recovery and corner-editing paths. Classify each finding as still present, already fixed with evidence, changed, or unverified. Old documentation alone is not a new defect reproduction.
4. Inspect scripts before invoking them. Confirm the installed Node version satisfies current `engines`; install with the lockfile using `npm ci` when an install is needed and authorized. Establish an unmodified baseline for the repository's gates.
5. Create isolated fixtures and a release acceptance ledger using the companion matrix. Record which hardware, Obsidian versions, and screen readers can actually be tested.
6. Record the first-beta scope, platform claims, responsible integrator, deferred items, and work package ownership in the tracker. Keep existing features in scope unless the owner explicitly decides otherwise.

**Acceptance:** every BP has a classification and a next action; existing fixes are not rebuilt; baseline failures are recorded separately from newly introduced failures; the release ledger is explicitly not yet a pass.

**Deliverable:** completed baseline section of the tracker, source/coverage delta, initial support matrix, and a small first implementation slice selected from BP-01.

### BP-01 — Preserve recovery incidents across settings changes and editor remounts

**Priority:** P0. **Type:** confirmed source defect. **Depends on:** BP-00.

**User outcome:** changing a setting or reopening the same plan does not hide a known incomplete-write incident.

**Starting points:** `src/presentation/editor/save-state/save-state-store.ts`, `tests/plugin/rootSwapRebind.test.ts`, `src/presentation/views/PlanEditorView.ts`, `src/plugin/RenovationPlannerPlugin.ts`, editor failure reporting, write tracking, and composition/lifecycle code. [S02, S03]

**Actions**

1. Add a desired-outcome regression around the actual settings-rebind path. First demonstrate that it fails against the current defect. Keep the unrelated existing root-swap tests.
2. Trace where incomplete writes are reported and where `writesBlocked` is derived. Inventory every route that can mutate affected data, including another editor for the same plan and relevant project/library commands.
3. Move incident ownership out of per-mount UI state into the smallest existing suitable lifecycle boundary. Prefer a stable session service keyed by affected identities over a plan-wide Boolean copied between arbitrary components. Document the chosen ownership boundary.
4. Rehydrate the UI from that incident state. Both existing and newly opened views must receive it before enabling affected commands. Opening a second pane cannot bypass protection.
5. Preserve unrelated plans' usability. An incident involving shared library resources needs appropriately wider protection; do not key every incident only by the visibly selected plan.
6. Change the known-gap test to assert the desired behaviour, and add a behaviour-level test that creates an incident through failure reporting rather than only setting a store flag.

**Acceptance:** incidents survive settings rebind and close/reopen within the plugin session; a new pane shows the same incident; unrelated successful writes, ordinary retries, and perspective changes do not clear it; an unaffected plan remains usable.

**Tests:** setting change with an incident, sibling pane, new pane, repeated rebind, unrelated successful command, successful read, and late completion from a retired editor.

**Deliverable:** a focused lifecycle fix, regression evidence, and a documented incident ownership contract. This package alone does not establish restart durability; BP-02 is required.

### BP-02 — Add durable incident detection and an explicit recovery procedure

**Priority:** P0. **Type:** safety hardening of the confirmed lifetime gap. **Depends on:** BP-01.

**User outcome:** restarting the plugin does not manufacture an all-clear after an unresolved multi-file operation.

**Design boundary:** durable detection is not automatic repair. A marker that survived restart does not prove which writes completed. Do not invent rollback, replay, or exactly-once guarantees.

**Actions**

1. Inventory current durable recovery mechanisms and reuse compatible ones. Record an ADR or concise design amendment for incident identity, ownership, storage, lifecycle, and affected command families.
2. Persist the minimum useful facts through infrastructure: operation/incident ID, affected entity IDs and safe resource references, operation kind, schema version, detection state, and relevant revision information. Avoid duplicating full plan content or personal file contents in diagnostics.
3. For destructive/multi-file command families covered by this safeguard, persist a narrow pending-operation indicator before the first mutation. If that indicator cannot be persisted, refuse the operation. This closes the obvious gap where a failed data write also prevents saving a later incident record. It is a conservative detection marker, not a general replay journal.
4. Retire the indicator only after the covered operation is conclusively complete. After a restart, an unresolved indicator means integrity is unverified; an explicitly failed compensation means an incomplete-write incident. Do not label every pending marker as proven corruption.
5. On startup, classify unreadable or future-version recovery metadata as an unknown recovery state, not an empty healthy state. Block the affected scope conservatively and explain why. Account for same-plan panes, moved files, restored backups, and stale markers without silently deleting evidence.
6. Provide source inspection and recovery guidance. The supported minimum recovery is a coherent backup restore followed by verification of affected resources and deliberate incident resolution. Define what the check can establish and when manual review is still required. Dismissing a warning is not repair.

**Acceptance:** a real persisted marker survives full service reconstruction; failure to write the initial marker prevents destructive writes; a restart never automatically replays the command; affected mutations stay blocked until resolution; a fresh read or an unrelated save cannot resolve the incident.

**Tests:** interruption at each covered persistence boundary, final-marker cleanup failure, corrupt marker, unsupported marker schema, backup restoration, deleted/moved affected records, and startup with a marker but no current editor. Retain existing specialized recovery tests.

**Deliverable:** narrow durable recovery safeguard, explicitly stated coverage limits, actionable recovery UI/copy, and restart tests. A full automatic crash rollback journal remains deferred.

### BP-03 — Protect pending edits and commands at lifecycle boundaries

**Priority:** P0 for demonstrated data loss; otherwise P1 verification. **Type:** test first. **Depends on:** BP-01; final acceptance after BP-02.

**User outcome:** settings, layout changes, view switches, and closing a tab do not cause hidden writes or silently discard a recoverable draft.

**Starting points:** `PlanEditorRoot.vue`, `PlanEditorView.ts`, `runtime.ts`, `editorFormActions.ts`, `roomEditLifecycle.ts`, dialogs, `ResponsiveEditorShell.vue`, and existing late-read/disposal tests.

**Actions**

1. Create a lifecycle table covering clean idle, unsaved form, pointer preview, command pending, stale read-back, and unresolved incident. For each, define behaviour on settings change, perspective switch, width change, close/reopen, and plugin unload.
2. Drive existing tests first. For disruptive settings rebinding, preserve a valid draft or prevent the disruptive action with an explicit explanation; do not silently remount away typed text. Use the smallest existing mechanism rather than introducing global draft autosave.
3. Make cancellation semantics precise: a preview can be cancelled before dispatch; an already dispatched command is not cancelled merely because its component disappears. Complete or safely recover that command at the correct lifetime boundary.
4. Ensure delayed reads cannot open obsolete dialogs or apply commands after their initiating context is retired. An outcome belonging to a completed command must still be accounted for even if its view has closed.
5. Keep history and selection rules explicit. An ordinary new editor need not inherit the previous editor's undo stack; do not accidentally promise persistent undo history.

**Acceptance:** no hidden write on cancel or reflow; no stale callback mutates a new context; pending work cannot be reported as saved early; retained text is not moved to another entity; uncertain outcomes enter recovery rather than showing success.

**Tests:** each lifecycle state crossed with relevant disruptive actions, including a draft open while the editor crosses its supported-width boundary and a successful write whose read-back fails after the view closes.

**Deliverable:** updated lifecycle contract, targeted regressions, and only the code changes those tests demonstrate are needed. Recovery of never-submitted drafts after a process crash is not promised.

### BP-04 — Provide precise non-drag editing of existing Room and Area corners

**Priority:** P1; required to close the documented interaction gap before broad beta. **Type:** interaction addition. **Depends on:** BP-00 and the established guarded-edit lifecycle; integrate after BP-03.

**User outcome:** correct one measured corner without redrawing the room or relying on precise dragging.

**Starting points:** the current guide's limitation, existing point-drag commands, `roomEditAction.ts`, `roomEditLifecycle.ts`, `editorFormActions.ts`, room/area forms, selection, and `core/geometry`. Do not infer that an existing creation form already edits saved corners. [S04]

**Interaction contract to implement:** select one Room/Area → choose **Edit corners** → choose a numbered corner → enter its position → preview → Apply or Cancel. The corner list, fields, and buttons must work with both keyboard and simple pointer clicks. Corner numbers are transient UI identifiers; do not introduce a persisted corner-ID schema unless the current model demonstrably needs one.

**Actions**

1. Write a short interaction specification that reconciles the existing design decisions. Use the existing dialog/form pattern, not a redesigned Inspector.
2. Define the coordinate system explicitly: plan coordinates, positive axes, origin, units, and internal precision. Absolute X/Y is the minimum path; a relative movement mode is optional. Never display values without their coordinate meaning.
3. Highlight only the chosen corner and adjacent preview geometry. Opening the form or changing the chosen corner does not save anything.
4. Keep untouched coordinates exactly as loaded. An explicitly retyped number is a new value; an untouched rounded display is not. Validate finite input and the supported geometry constraints through canonical validators.
5. Preserve current semantics for curved edges. Audit what existing corner dragging does to adjacent curves and reuse that policy. Never flatten curves, change winding, reshape independent walls, or modify intended geometry as a hidden consequence of numeric entry. An unsupported case needs a specific explanation and a tracked alternative, not silent conversion.
6. Apply one guarded command against the captured baseline. Cancel and no-op submission create no history. Preserve naming, references, group membership, and ordering.

**Acceptance:** every supported Room/Area corner can be selected without dragging; the preview matches the final saved coordinates; untouched points and relationships remain unchanged; comma/point input works in the supported locales; a peer edit refuses the stale draft; undo restores the exact prior geometry.

**Tests:** rectangle, irregular outline, rotated room, negative coordinates, curved-adjacent corner, invalid input, no-op, cancellation, stale baseline, fresh repository reload, one history entry, and constrained-layout focus.

**Deliverable:** the smallest complete corner-correction path, updated user guide, behavioural tests, and real screenshots of its key states when a runtime is available. Full WCAG conformance is not established by this feature alone. Keyboard access and a non-drag pointer alternative are separate requirements. [S16]

### BP-05 — Make selection, transformation, cancellation, and history consistent

**Priority:** P1, promoted to P0 for a reproduced wrong-target write. **Type:** verification and targeted polish. **Depends on:** BP-03; coordinate shared changes with BP-04.

**User outcome:** understand what will change before acting and recover from a mistake predictably.

**Starting points:** editor selection, rotation, grouping, clipboard, snapping, `escapeRouting.ts`, `surface/historyShortcut.ts`, `TemporaryToolBanner.vue`, `EditorContextBar.vue`, and existing interaction cases. [S04, S08, S14]

**Actions**

1. Make a capability matrix for each currently exposed geometry type: create, select, move, precise edit, rotate, duplicate/copy, delete, cancel, undo/redo, and supported non-drag route. Mark unsupported combinations with their current explanation rather than pretending every object supports every action.
2. Reverify the accepted overlap priority and modifier behaviour, including groups, hidden members, and locked zones. Use the newest documented contract; do not redesign selection order based on a single frustrating fixture.
3. Check that visible rotation/resize affordances, their hit targets, pivot, preview, and final result agree at different zoom levels. Hover must not secretly change selection. Nearby dimensions and hosted openings must remain operable.
4. Check cancellation while drawing, typing, dragging, previewing, and saving. Preserve the established staged Escape behaviour. Do not add a second cancellation handler with different rules.
5. Verify native field undo/redo versus editor history. Confirm platform-appropriate shortcuts in real supported hosts before changing labels. Add action-specific history labels only if command metadata supports them without a broad refactor.
6. Ensure unsupported actions explain the current reason: read-only perspective, unsupported selection, stale data, pending write, or locked object. Avoid permanent warning clutter. Make snap state and the route to disable it discoverable.

**Acceptance:** the actual mutation target matches the indicated selection; one completed user operation yields the intended history boundary; rejected/no-op operations do not add history; keyboard context menus reach essential actions; Review does not mutate geometry.

**Tests:** dense overlap fixture, group with hidden member, lock/unlock, wall plus hosted openings, copy/paste across plans, click-versus-drag rotation, modifier change mid-gesture, input-focused shortcuts, pending command, and both locales.

**Deliverable:** interaction capability matrix, fixes for demonstrated discrepancies, and updated hints/tooltips only where needed. No replacement shell or new toolbar system.

### BP-06 — Harden the empty-plan and reference preparation journeys

**Priority:** P1; P0 for destructive reference changes. **Type:** existing-flow verification. **Depends on:** BP-03.

**User outcome:** get from an empty plan or existing drawing to correctly scaled, editable geometry without uncertainty.

**Starting points:** `reference/FloorStart.vue`, `reference/referenceAction.ts`, `layers/background/`, reference commands and infrastructure adapters, plus the existing calibration and reference-configuration cases. [S04, S08]

**Actions**

1. Walk all existing starts: room-first, reference-first, and empty canvas. Ensure each reaches a useful next action and that any overlay yields to the active task.
2. Walk image and PDF selection, page changes, crop, rotation, scale setup, preview, locking/opacity, cancellation, save, and reload. Confirm which file selection routes actually exist; do not implement duplicate import routes unnecessarily.
3. Explain scale with a known-distance example and explicit units. Reject invalid or zero-distance calibration. Differentiate missing scale from a real zero measurement.
4. Verify scale/reference replacement when geometry already exists. Preserve the current documented coordinate policy and undo boundary; make consequences explicit. Do not rescale the user's room geometry as an incidental side effect.
5. Exercise missing/renamed files, unreadable documents, invalid pages, large images, and interrupted loading. Keep the last safe view where appropriate and provide a usable cancellation or retry path.
6. Confirm clean reference setup survives reconstruction from persisted notes and sidecars, with no writes on a cancelled preview and no duplicate writes on retry.

**Acceptance:** all three starts are usable; known-length measurements agree with the saved calibration; reference edits preserve unrelated geometry; errors do not masquerade as successful import; a save/reopen reconstructs the intended reference and scale.

**Tests:** at least one synthetic image and one multi-page PDF; missing source; rotated/cropped reference; known distance entered with comma/point; a reference changed after rooms exist; cancel at every preparation stage. Never use private architectural drawings as distributable fixtures.

**Deliverable:** verified start/reference flow, necessary corrections, bounded file/size guidance derived from tested behaviour, and a short user walkthrough.

### BP-07 — Complete responsive, keyboard, and accessibility checks

**Priority:** P1; blocks broad-beta accessibility claims while unresolved. **Type:** verification plus focused repair. **Depends on:** BP-04–BP-06 for final acceptance.

**User outcome:** use the editor in an ordinary Obsidian workspace without hidden controls, lost focus, or drag-only essential actions.

**Starting points:** `ResponsiveEditorShell.vue`, `layoutMode.ts`, `PanelResizer.vue`, `EntityInspector.vue`, warnings, dialogs, error messages, locale tables, themes, and current accessibility tests. The earlier layout baseline uses 400 px and 900 px breakpoints; re-read them before testing. [S15]

**Actions**

1. Test just below/at/above the actual breakpoints, plus representative full and constrained panes. Check both short and long content, English/German, light/dark, and at least one community theme.
2. Reflow while a numeric draft, context menu, error, and selected group are present. A focused surviving field keeps its text and focus; a disappearing control gets a meaningful replacement focus target.
3. Build an interaction inventory for keyboard access and single-pointer alternatives: corner movement, object movement, rotation, reference crop/scale, custom panning, panel resizing, and any reordering. Test the two input requirements separately. Reuse existing alternatives before adding controls. [S16]
4. Check accessible names, selection state, invalid-field descriptions, logical focus order, dialog dismissal/return, read-only explanations, and recovery/saving announcements. Run existing automated checks and record native screen-reader observations separately.
5. Inspect contrast and focus visibility in the actual host. Check target size/spacing using the applicable WCAG requirements and any stronger project targets; do not confuse a 44 px design preference with the WCAG AA minimum. [S18]
6. Include native host zoom, not just browser viewport resizing. Record the tested range and any genuine two-dimensional-canvas exceptions without using them to exempt surrounding forms and controls.

**Acceptance:** essential actions have usable input alternatives; focus is not lost during reflow; no critical control is clipped at supported layouts; warnings and validation are understandable with a named screen reader. Automated checks alone cannot establish full conformance.

**Tests:** automated component/axe checks where available; native keyboard walkthrough; pointer-without-drag walkthrough; named screen reader/version; host zoom; light/dark/community theme; locale expansion. Unknown results remain unperformed.

**Deliverable:** completed interaction/accessibility matrix, corrected defects, and accurately bounded accessibility statements. Do not add a second design system.

### BP-08 — Establish representative performance and lifecycle regression budgets

**Priority:** P1 verification; optimize only demonstrated bottlenecks. **Type:** benchmark and focused hardening. **Depends on:** BP-00; final run after integrated changes.

**Starting points:** `docs/tests/cases/Canvas performance.md`, existing harness knobs and scripts, canvas/layer rendering, asset-shape loading, and disposal tests. The prior ledger records an improvement to room-heavy zoom work; that historical issue must not be reopened without a new regression. [S12]

**Actions**

1. Retain the existing room-heavy benchmark for continuity. Add a representative mixed fixture with rooms, straight/curved walls, openings, detailed assets, annotations, evidence markers, and a reference image. Document actual counts and payload sizes.
2. Distinguish three fixtures: small first-use, representative house/property, and an explicit stress case. Do not derive a marketed size limit from a synthetic room-only scene.
3. Record hardware, OS, Obsidian/browser version, production bundle hash, DPR, viewport, fixture identity, and background load. Measure cold open separately from warm interaction.
4. Measure frame timing, interaction latency, plan open, persistence/read-back, and repeated open/close cleanup. Vue flush time is not total frame time and is not FPS.
5. Profile only failed budgets. Preserve the model and existing safeguards; do not introduce workers, spatial indexing, virtualization, or dependency upgrades without evidence that the narrower change is insufficient.
6. Re-run camera and save benchmarks after BP-02 because durable safeguards may change persistence costs. Check multiple panes and DPR 2 as well as DPR 1.

**Initial proposed targets, to record before optimization:** preserve the SDD's existing 60 FPS aspiration / 30 FPS floor in the supported representative scene; use a p95 frame-time objective of at most approximately 33 ms during sustained interaction; aim for visible action feedback within 100 ms and a small/representative local plan opening within 3 seconds. The latter thresholds are planning targets, not measurements or existing product guarantees. Confirm them against the chosen reference machine during BP-00/BP-08. A changed target requires a recorded scope/risk decision, not silent threshold relaxation.

**Acceptance:** the representative supported fixture meets recorded budgets; the stress case is reported honestly; repeated close/open cycles do not accumulate live stages, event subscriptions, or unbounded retained resources; no optimization changes geometry, selection, or persistence semantics.

**Deliverable:** reproducible fixture/script, before/after results when optimized, raw evidence references, and a tested support envelope. Do not claim performance from historical measurements of a different bundle.

### BP-09 — Verify and communicate the desktop/mobile support boundary

**Priority:** P1. **Type:** native verification, not mobile feature expansion. **Depends on:** BP-00; final evidence belongs to BP-13.

**User outcome:** know which parts of the plugin are supported on their device, with no route into an unusable editor.

**Starting points:** `manifest.json`, platform guards in views/commands, `PRODUCT.md`, and `docs/tests/cases/Read projects on mobile.md`. The inspected scope is desktop editing and mobile read-only (see the tracker's L-43 row); the mobile case explicitly lacked real-device results at the earlier review. [S09, S10]

**Actions**

1. Reconcile current platform guards, the manifest, and the promised read-only surfaces. Keep the existing product boundary; do not add touch drawing or silently change `isDesktopOnly` just to avoid verification.
2. On real mobile hardware, open project/list/price/schedule/quote surfaces that are promised readable. Check all surfaced write controls, including asset-library entry points, not only editor guards.
3. Restore a workspace containing desktop editor/designer tabs. Confirm the fallback is understandable, no unsupported canvas mounts, and closing the restored tabs is safe.
4. Exercise supported mobile navigation, long names, soft keyboard interactions, locale text, and a named mobile screen reader where claimed. Return the same synthetic vault to desktop and confirm editing still works.
5. Record tested versus untested OS/device/Obsidian versions. For a broad mobile claim, test both iOS and Android; otherwise state the narrower evidence and obtain an explicit beta limitation decision. Unknown hardware results are not passes.

**Acceptance:** mobile cannot bypass the intended write boundary through another entry point; promised read-only information is readable; desktop functionality is unchanged after sync; the published support matrix matches observations.

**Deliverable:** actual device outcomes, necessary guard fixes, and public support/limitation wording. Discovery of unsafe mobile mutation becomes P0.

### BP-10 — Make the first useful plan achievable without developer knowledge

**Priority:** P1 guidance and discoverability; sample enrichment is bounded. **Type:** onboarding improvement. **Depends on:** BP-05, BP-06.

**User outcome:** install the beta, find the editor, and complete a useful first task without reading contributor documentation.

**Starting points:** `src/plugin/sampleProject.ts`, `reference/FloorStart.vue`, existing project/plan creation, `README.md`, and `docs/using-plan-editor.md`. The sample scaffold already exists; do not author a second seeding mechanism. [S04, S11, S19]

**Actions**

1. Provide one concise getting-started route: create project → create plan → choose blank/reference start → draw/correct one room → save/reopen. Link it from the obvious existing help surface and README.
2. Promote the sample into an optional, explicitly fictional example where practical. Seed through real commands, use an isolated project identity, preserve user data, and handle repeated creation/failure without overwriting another project.
3. Demonstrate the editor's essential actions: selection, precise correction, one item, undo, and reopening. Add a minimal connected renovation record only when it can reuse stable production commands. Do not turn sample authoring into a broad content project.
4. State where files are saved, when changes persist, how cancellation differs from undo, and how to read a stale/incomplete-write warning. Link to full recovery guidance rather than reproducing it in every screen.
5. Run a formative test with a proposed 3–5 first-time users, or record that this has not been performed. Observe installation, first room, correction, undo, and reopen before offering hints. Treat the sample size as discovery, not statistical proof.

**Acceptance:** the written route works on a clean installed beta without Node/npm; no dead onboarding action; fictional sample content is labelled; first-use observations have concrete fixes or documented follow-up items; help can be reached again after onboarding.

**Deliverable:** short getting-started guide, optional polished sample, discoverable help entry, and a first-use observation log. Do not fabricate users, timings, or success rates.

### BP-11 — Reconcile capability, compatibility, and recovery documentation

**Priority:** P1; inaccurate data-recovery instructions are P0 when harmful. **Type:** documentation correction. **Depends on:** BP-00; finalize after BP-01–BP-10.

**User outcome:** documentation describes the installed beta, not a mix of historical design states.

**Actions**

1. Correct `PRODUCT.md`, `README.md`, `RELEASING.md`, editor guidance, and recovery guidance against production source. Keep historical design/acceptance records historical; add a superseding status/link rather than rewriting old results as current passes.
2. Replace the obsolete absence-of-case-catalogue statement with links to the actual case catalogue and candidate ledger. Separate implemented behaviour, proposed design, supported capability, and verified capability.
3. Derive a compatibility table from current parsers and writers: note/sidecar kinds, supported read versions, feature-triggered write versions, future-version handling, and any migrations. Do not guess a single global schema version or add a schema bump simply because a UI field was added.
4. Verify legacy fixtures are not rewritten just by opening them, unrelated human-written content survives, and unsupported newer data is refused without being downgraded.
5. Document coherent whole-vault/project backup requirements, including geometry sidecars, library dependencies, linked files, and relevant recovery metadata. Explain restoration and its limits. A binary downgrade is not a data rollback.
6. Publish a current known-limitations section covering platforms, unsupported interactions, crash-recovery limits, non-professional planning status, and any explicitly accepted beta gaps.

**Acceptance:** every described action exists; schema statements match tested readers/writers; recovery instructions do not treat reading or remounting as repair; older evidence cannot be mistaken for candidate acceptance.

**Deliverable:** current user/release documentation, compatibility table, legacy-read regression evidence, and one authoritative link to beta readiness. [S07–S10, S13, S19]

### BP-12 — Produce an installable, traceable production candidate

**Priority:** P0 process gate for distribution. **Type:** packaging and supply of testable artifacts. **Depends on:** all chosen production changes; coordinate BP-11.

**User outcome:** install exactly the plugin that was tested, without development tooling.

**Starting points:** current `package.json`, build/test-build scripts, `manifest.json`, `versions.json`, release tests, and the existing release workflow. [S05, S13]

**Actions**

1. Freeze the intended candidate commit and include final version/compatibility metadata before candidate acceptance. Use a topic branch and normal repository review rules. Do not auto-tag while merely planning a version bump.
2. Run the unchanged full project gate and dependency audit. `npm run check` and `npm run audit` are separate scripts at the handoff baseline; do not assume the former includes the latter. [S05]
3. Build production assets using the approved production build path. Record source revision, dependency lock identity, environment, and SHA-256 hashes for every shipped asset.
4. Install those exact production assets into a disposable acceptance vault. `npm run test-build` currently builds in development mode: useful during implementation, but not proof that the production bytes passed native acceptance. Inspect scripts again before use. [S05]
5. Prepare a beta installation/update guide for built assets. Verify a fresh install, disable/re-enable, close/reopen, and update from a representative previous development build using a backed-up synthetic vault.
6. Check release automation can publish the intended tested artifact without substituting a different source or bundle. A fresh rebuild is acceptable only with byte equivalence or appropriately repeated artifact verification; do not infer binary identity from a matching commit alone.

**Acceptance:** clean-vault installation works without npm; installed hashes match the candidate record; no unhandled startup error; release version/tag strategy matches current Obsidian rules; no public release is triggered by this package.

**Versioning note:** the current official submission guide supports `x.y.z` manifest versions and requires the release tag to match. Use the human-readable release title/notes to identify a beta rather than assuming a `-beta.1` manifest suffix is accepted by that distribution path. Verify the chosen channel before publication. [S17]

**Deliverable:** frozen candidate assets, hashes, build/test logs, installation instructions, and a pending native-acceptance record.

### BP-13 — Execute the integrated beta acceptance and close its blockers

**Priority:** P0 release verification. **Type:** evidence collection and defect resolution. **Depends on:** BP-12; all selected features integrated.

**User outcome:** the complete plugin journey works in the actual host, not only as isolated components.

**Actions**

1. Use `04-beta-acceptance-matrix.md` to select and link the existing cases. Execute against the exact BP-12 artifact; record the source/bundle identity before each environment's run.
2. Run the complete first-use → reference/blank plan → edit → renovate/review → undo → save/reopen journey. Cover all currently exposed advanced geometry families with smoke checks even if they are not onboarding priorities.
3. Test supported desktop hosts, minimum/current Obsidian claims, light/dark/theme, English/German, constrained panes, and a named screen reader. Obtain actual-device evidence for claimed device-specific input and mobile support.
4. Use deterministic fault injection for repository failures and write counts. Use native checks for host integration, real input, rendering, and announcements. Do not claim one method proves the other's properties.
5. Triage every failure by user impact. Link the reproducer, responsible package, fix, and retest. For shared runtime/persistence changes, rerun the integrated core journey, not only the originally failing test.
6. After a production-code, stylesheet, dependency, or metadata change, build a new candidate and invalidate affected evidence explicitly. Documentary evidence additions may refer to the unchanged artifact, but never change its stated source identity.

**Acceptance:** no unresolved P0; all in-scope critical journeys pass on the candidate; P1 exceptions have an explicit owner decision and usable workaround; unknown checks remain unknown; the ledger lists every limitation and its effect on distribution scope.

**Deliverable:** a completed candidate acceptance ledger with links to raw evidence, screenshots from the running build, actual device observations, and the resolved defect list. An agent without native tools can complete independent work but cannot mark native criteria passed. [S06, S08]

### BP-14 — Make the go/no-go decision and prepare beta operations

**Priority:** P0 release decision; P1 operational preparation. **Type:** owner decision and release readiness. **Depends on:** BP-13.

**Actions**

1. Review the explicit gates in section 7. Record one decision: not ready; ready for a bounded closed beta; or ready for the declared broader beta scope. The implementation agent provides evidence; the product/release owner authorizes distribution.
2. Publishable notes must describe capabilities, limitations, backup requirements, support scope, data-format compatibility, and recovery procedures. Separate beta limitations from construction/professional suitability claims.
3. Prepare a minimal bug-report template: plugin/Obsidian/OS versions, exact reproduction, expected/actual behaviour, relevant mode/selection, and optional redacted screenshot. Prefer synthetic reproduction files; never ask for a whole personal vault by default.
4. Reuse existing diagnostic facilities where suitable. Any diagnostic export must be user-initiated and reviewed/redacted; do not introduce telemetry or automatic upload as part of beta hardening.
5. Define release-stop conditions: verified data loss, silent corruption, misleading all-clear after incomplete writes, or an incompatible format written without safe refusal by older builds. Decide who triages these and how affected testers receive the corrective notice.
6. Prepare—not automatically execute—the existing release workflow. Confirm version, commit, checks, tested artifacts, release notes, and intended channel. Publish only after explicit permission. Community-directory submission is a separate decision, using then-current official guidance. [S17]

**Acceptance:** an evidence-backed decision exists; installation/support/recovery materials are ready; no publication or destructive action was inferred from task completion; rollback guidance includes coherent data restoration, not merely older binaries.

**Deliverable:** signed-off go/no-go record, release notes draft, support/bug-report entry point, and an explicitly authorized release action only when separately requested.

### BP-15 — Optional: export a clean plan snapshot

**Priority:** P2, not a default beta gate. **Type:** proposed product addition. **Depends on:** source discovery and a stable core; include before BP-12 if selected.

**User outcome:** show the plan to another person without editor chrome.

**Actions**

1. Search for existing image/export functionality and extend it if suitable. Do not equate not finding an Export button in one component with proof that export is absent.
2. Bound the first increment to PNG: whole-plan or current-view extent, optional reference background, visible perspective, and a clean scene without selection handles, drafts, or editing controls. Reuse rendering models; do not build a second geometry interpretation.
3. Account for text/labels and overlays that may be DOM-rendered rather than part of a Konva canvas. A canvas-only image that silently omits meaningful content is not accepted.
4. Define the background/contrast, image dimensions, missing-reference behaviour, and memory limits. Do not advertise print scale or construction accuracy. Never alter the user's viewport or saved geometry merely to export.
5. Test dimensions, visibility, perspective, detailed assets, clipping, fonts, cancellation, and failures. If a faithful output requires a new export architecture, defer it rather than endanger the beta deadline/scope.

**Acceptance:** the image faithfully represents the selected saved view and its declared limitations; no private information is uploaded; failure changes no plan data; current unsaved/stale states are handled explicitly rather than exported as confirmed truth.

**Deliverable:** a clean, tested shareable image path or a documented deferral. PDF sheets, DXF, BIM, and professional drawing packages remain out of scope.

## 5. Implementation method for every package

### Definition of Ready

Before coding, record the user outcome, current source/contract, evidence classification, existing backlog/case mapping, minimal change boundary, relevant failure modes, and acceptance tests. For a behaviour change, document its precise input, coordinate, persistence, cancellation, and undo semantics first. For an alleged defect, obtain a reproducer or state that it remains unverified.

### Working loop

Inspect → reproduce or establish baseline → add desired-outcome test → implement the smallest change → run focused tests → inspect affected UI when available → run required broader gates → update docs and tracker → hand off the next executable step.

Use the existing package scripts. Do not invent commands such as `test:e2e` without first verifying they exist. Prefer the existing test/harness setup over creating a new parallel framework. Targeted test invocation is allowed through the current test runner after locating actual files.

### Definition of Done

A package is complete only when its intended behaviour, tests, scope limitations, and evidence agree. Required production and integration tests pass; applicable UI/native checks are either completed or explicitly outstanding; documentation and translations reflect the result; no private data or generated test vault has accidentally entered the change set; and the tracker identifies the next work.

Implementation complete is not equivalent to native verified, release accepted, or shipped. Use separate fields/links for those distinctions, mapped to the repository's own lifecycle.

### Suggested reviewable change slices

BP-01 can be one focused lifecycle PR. BP-02 should separate the incident contract/storage tests from command integration when useful, but neither half may be called beta-safe alone. BP-04 can separate canonical corner-command tests from UI wiring, with an integrated final review. Documentation and evidence changes should not obscure production diffs. Avoid a single PR containing the whole programme.

Before touching shared runtime or plugin composition, record file ownership. Keep existing parallel branches intact. No forced pushes, blanket resets, automated merges, or removal of unrelated worktrees are implied by this handoff.

## 6. Risk register and change controls

| Risk | Preventive action | Escalation / decision |
|---|---|---|
| Current source advances during execution. | Reconcile at session start and before integration; preserve baseline and candidate identities separately. | Already-fixed items become verified, not reimplemented. |
| Recovery signal is lost on the same storage failure as plan data. | Persist the bounded pending-operation indicator before covered destructive mutation; refuse if it cannot be recorded. | Unknown recovery state is not healthy state. |
| Incident scope is too narrow for shared resources. | Track affected identities/resources, not only the current pane or plan. | Block appropriate dependent mutation; preserve independent plans. |
| A numeric corner edit flattens curves or changes untouched precision. | Reuse canonical geometry policy and compare exact before/after payloads. | Refuse unsupported transformations; no silent conversions. |
| Settings/remount retires a still-running command. | Test command ownership separately from component lifetime. | Unknown/partial outcomes enter recovery. |
| High unit coverage hides host defects. | Pair deterministic tests with exact-bundle native acceptance. | No inference of native pass from CI. |
| Optional work expands into a redesign. | Keep BP-15 opt-in and preserve existing shell/tool semantics. | Defer new architecture or feature families. |
| Native/device access is unavailable. | Establish availability during BP-00 and prepare repeatable manual cases. | Mark checks unperformed; owner decides bounded distribution, never fabricated pass. |
| A late merge invalidates candidate evidence. | Rebuild, compare artifact identity, and rerun affected/integrated cases. | Reopen the gate. |
| Logs/fixtures expose household information. | Use fictional fixtures and redacted, user-initiated diagnostics. | Remove sensitive material before sharing/committing. |
| Binary downgrade cannot read newly written data. | Publish feature-level format compatibility and coherent restore procedure. | Do not recommend binary downgrade alone. |

A new issue only enters the beta scope when it prevents a core journey, compromises data trust, breaks the declared support/accessibility contract, or prevents safe installation/recovery. Other ideas go to the post-beta backlog.

## 7. Explicit beta gates

| Gate | Required evidence | Blocking conditions |
|---|---|---|
| G0 — baseline known | BP-00 delta, source identity, ownership, test inventory. | Unknown branch/data provenance or undocumented existing failures. |
| G1 — data trust | BP-01–BP-03 and fault/restart results. | Lost incident, silent overwrite, hidden partial-write success, unsafe replay, or lifecycle data loss. |
| G2 — core journey complete | BP-04–BP-07 and representative end-to-end cases. | Essential action impossible, wrong-target mutation, inaccessible required path without a usable alternative, or untruthful save/recovery UI. |
| G3 — support and first use evidenced | BP-08–BP-11, device matrix, guide, compatibility table. | Unusable claimed platform, misleading format/recovery instructions, or unresolved severe performance failure within the declared envelope. |
| G4 — actual candidate accepted | BP-12–BP-13, hashes and native acceptance ledger. | Different/unknown installed bundle, failing critical journey, unresolved P0, or required native evidence absent. |
| G5 — distribution authorized | BP-14 owner decision and prepared materials. | Publication not explicitly authorized. |

**Closed beta default:** all P0 gates pass; remaining non-safety P1 limitations have a named owner decision, scope restriction, and workable alternative. Testers use a backed-up/disposable vault and receive limitations before installation.

**Broad beta default:** all mandatory packages and in-scope critical journeys pass on the frozen production candidate; only low-impact, explicitly documented limitations remain. Do not make a full accessibility-conformance claim while required evidence or requirements are outstanding.

**No-go:** known silent data loss/corruption, disappearance of an unresolved incident, automatic unsafe replay, false Saved/repaired status, or an essential workflow that cannot complete safely. A warning in release notes does not close these defects.

## 8. Starting the next session

Begin with BP-00. Its output is a reconciled baseline, not another open-ended audit. Once the actual recovery gap is confirmed, proceed to a failing desired-outcome regression for BP-01 and the smallest lifecycle fix. Do not start with optional export, aesthetic redesign, dependency modernization, or new geometry.

At the end of each session, update the tracker with: exact commit and branch; package/step reached; files changed; commands and outcomes; new limitations; evidence paths; and the single next executable action. Say explicitly when a task is implemented but not natively verified. Use the supplied session prompt rather than relying on prior chat history.

## 9. Source register and verification provenance

The source register follows below. Repository statements are tied to the inspected revision, not assumed to remain current. Proposed actions, thresholds, fixtures, and release gates are recommendations in this plan. External rules were checked on 16 September 2026 and should be checked again at publication.

| ID | Source | Provenance / use |
|---|---|---|
| S01 | [Handoff commit / current main observed on 16 September 2026](https://github.com/Luis85/renovation-planner/commit/d77e7c5eba5e6518b93a5be4606532ceab3a77eb) | Rechecked during this handoff. |
| S02 | [Recovery state ownership and documented rebind loss](https://github.com/Luis85/renovation-planner/blob/d77e7c5eba5e6518b93a5be4606532ceab3a77eb/src/presentation/editor/save-state/save-state-store.ts) | Re-read at handoff baseline. |
| S03 | [Regression test encoding the known rebind gap](https://github.com/Luis85/renovation-planner/blob/d77e7c5eba5e6518b93a5be4606532ceab3a77eb/tests/plugin/rootSwapRebind.test.ts) | Re-read at handoff baseline, particularly the unrecovered-write case. |
| S04 | [Current editor routes and existing-corner limitation](https://github.com/Luis85/renovation-planner/blob/d77e7c5eba5e6518b93a5be4606532ceab3a77eb/docs/using-plan-editor.md) | Re-read at handoff baseline. |
| S05 | [Actual build, test, audit scripts and toolchain declaration](https://github.com/Luis85/renovation-planner/blob/d77e7c5eba5e6518b93a5be4606532ceab3a77eb/package.json) | Re-read at handoff baseline. No scripts executed here. |
| S06 | [Native acceptance preparation, not current release acceptance](https://github.com/Luis85/renovation-planner/blob/d77e7c5eba5e6518b93a5be4606532ceab3a77eb/docs/user-experience/renovation-planner-editor-specs/implementation/release-native-acceptance.md) | Re-read at handoff baseline; records remain historical preparation. |
| S07 | [Recovery guide and durability/compatibility statements](https://github.com/Luis85/renovation-planner/blob/f82695645601b98a7febd95dbc8171c19237a245/docs/using-planning-recovery.md) | Carried from original review; reconcile against working revision. |
| S08 | [Existing manual case catalogue](https://github.com/Luis85/renovation-planner/tree/f82695645601b98a7febd95dbc8171c19237a245/docs/tests/cases) | Carried from original review; reuse and extend, do not duplicate. |
| S09 | [Product scope, desktop/mobile boundary and documentation drift](https://github.com/Luis85/renovation-planner/blob/f82695645601b98a7febd95dbc8171c19237a245/PRODUCT.md) | Carried from original review; some capability statements were stale. |
| S10 | [Mobile read-only case and unperformed device run](https://github.com/Luis85/renovation-planner/blob/f82695645601b98a7febd95dbc8171c19237a245/docs/tests/cases/Read%20projects%20on%20mobile.md) | Carried from original review; verify latest results before treating as open. |
| S11 | [Existing sample-project scaffolding](https://github.com/Luis85/renovation-planner/blob/f82695645601b98a7febd95dbc8171c19237a245/src/plugin/sampleProject.ts) | Carried from original review. |
| S12 | [Canvas performance case and historical measured improvement](https://github.com/Luis85/renovation-planner/blob/f82695645601b98a7febd95dbc8171c19237a245/docs/tests/cases/Canvas%20performance.md) | Carried from original review; not a benchmark of the final beta. |
| S13 | [Existing release workflow contract and outdated catalogue statement](https://github.com/Luis85/renovation-planner/blob/f82695645601b98a7febd95dbc8171c19237a245/RELEASING.md) | Carried from original review; actual workflow must be inspected in BP-00/BP-12. |
| S14 | [Existing perspective and history UI](https://github.com/Luis85/renovation-planner/blob/f82695645601b98a7febd95dbc8171c19237a245/src/presentation/editor/shell/EditorContextBar.vue) | Carried from original review; preserve current contracts. |
| S15 | [Existing responsive breakpoints](https://github.com/Luis85/renovation-planner/blob/f82695645601b98a7febd95dbc8171c19237a245/src/presentation/editor/shell/layoutMode.ts) | Carried from original review. Also inspect ResponsiveEditorShell.vue at working revision. |
| S16 | [W3C: Understanding WCAG 2.2 SC 2.5.7, dragging movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements) | Checked 16 September 2026. Keyboard access and non-drag pointer access are distinct. |
| S17 | [Obsidian: Submit your plugin / release prerequisites](https://docs.obsidian.md/plugins/releasing/submit-plugin) | Checked 16 September 2026. Reverify selected distribution channel at release. |
| S18 | [W3C: WCAG 2.2 normative requirements](https://www.w3.org/TR/WCAG22/) | Checked 16 September 2026; use criterion-specific evidence rather than a blanket conformance assertion. |
| S19 | [Original README and contributor-oriented installation route](https://github.com/Luis85/renovation-planner/blob/f82695645601b98a7febd95dbc8171c19237a245/README.md) | Carried from original review; do not assume releases are still absent. |

**Implementation authority:** applicable repository instructions and newer accepted decisions govern the implementation. A conflict with this proposal must be recorded and resolved, not silently ignored or used to stop unrelated safe work.
