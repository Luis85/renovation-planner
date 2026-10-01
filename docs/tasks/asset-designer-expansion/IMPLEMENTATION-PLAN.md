---
title: Renovation Planner — Asset Designer Improvement and Implementation Plan
status: proposed-execution-plan
language: en
date: 2026-09-16
repository: Luis85/renovation-planner
reviewed-ref: d77e7c5eba5e6518b93a5be4606532ceab3a77eb
---

# Asset Designer improvement and implementation plan

## 1. Objective and execution boundary

Evolve the existing asset designer into an approachable, capable top-down 2D object editor integrated with Renovation Planner. Deliver one coherent loop:

**Create → compose → dimension → define placement → save → use in a plan → revise safely.**

Use the two generated boards for visual direction, not as literal specifications. Keep the existing stack and architecture, preserve user data, and improve the designer in incremental, tested slices. This is an implementation plan and delegation package—not a claim that any proposed feature has been implemented or that repository tests have passed in this session.

The reviewed `main` commit is `d77e7c5eba5e6518b93a5be4606532ceab3a77eb`, observed on 16 September 2026. It is newer than the previous concept's `f826956…` baseline. The review here is targeted source inspection; the running plugin, full repository and full test suite were not executed. AD00 must reconcile the actual checkout before coding. [R01]

### Recommended first release

A homeowner can create a measured preset or simple custom object, organize graphic parts, multi-select/group/align them, draw open lines and rounded details, inspect scale/clearance/placement, use the object in a real plan, and reopen it without loss. Existing frozen/issued workflows remain safe or explicitly unavailable where not implemented. The plugin remains Obsidian-native and local-first.

### Outside the first release

Do not introduce a general-purpose CAD application, a new canvas framework, cloud accounts, a second document model, a universal Plan/Asset editor, recursive catalogue assemblies, automated building-code compliance, vertical clash detection, arbitrary SVG import, unconstrained Bézier editing, a full constraint solver, or perpetual parametric regeneration after free editing.

Native editable package portability is the separate AD17 post-beta task. Future ellipse/path support, validated cut/merge operations and persistent parametric templates are discovery candidates, not implicit requirements copied from an icon in a mockup.

## 2. How to use the package

Place the complete folder at a repository location such as `docs/tasks/asset-designer-expansion/`, subject to AD00 confirming local conventions. Do not replace existing requirements, ADRs or source files with this package.

Start the lead coding agent with `prompts/00-ORCHESTRATOR.md`. It first runs AD00, then AD01, then dispatches only dependency-ready tasks. Give each worker one task card plus `prompts/01-WORKER.md`; use separate worktrees for independent writers. The orchestrator owns shared-file integration and acceptance.

The consolidated task cards below make this document usable on its own. The bundle additionally contains the actual board images, contracts, machine-readable dependency manifest, execution state, readiness helper, review prompts, test matrix and handoff templates.

Use the existing Asset Designer epic. Map execution IDs AD00–AD17 to the real feature/use-case notes rather than creating a competing product backlog. Execution status in this package is technical coordination state, not a replacement for the repository's requirements lifecycle.

## 3. Baseline findings and required response

| Finding from inspected source | Implementation consequence |
|---|---|
| The project already uses Vue, Pinia, Konva/vue-konva, TypeScript, Vite and Vitest; package scripts include build, lint, coverage, analysis and audit. [R02] | Reuse the stack and gates. No migration to another editor engine or package upgrades by default. |
| The existing epic extends shared asset definitions with shape, isolated calibration, clearance, anchor/facing and descriptive height. [R03] | Preserve catalogue scope and the definition/instance distinction. Do not turn visual parts into purchases. |
| `editDimensions()` can replace an uncurved, detail-free footprint with a rectangle. [R05] | Split resize from explicit footprint replacement; add an L-shaped regression fixture. |
| `scaleDesign()` scales clearance and keeps circular bulges even under nonuniform scaling; this is documented behavior. [R06] | Record an intentional policy change. Do not silently reinterpret an ellipse-like stretch as exact geometry. |
| Selection is explicitly one part at a time. [R04] | Add one shared multi-selection contract before independent canvas and Parts implementations. |
| Details are closed curved outlines with stable semantic names, order, line style and pending flags. [R07] | Open lines require a domain extension. User labels must not overwrite semantic names. |
| Asset sidecars currently read v1 and v2 and emit v2; the schema explains why version bumps prevent unknown-field erasure. [R08] | Add compatible migration and future-version refusal before exposing new durable fields. |
| Some writes join the serial chain while undo/redo, background and preset/dimension replacement paths bypass it. [R09] | Unify sequencing/barriers before adding more compound operations; preserve conflict checks. |
| The geometry port writes one document; the design DTO has separate note/geometry versions. [R10, R11] | One shape write is not a cross-file transaction. Keep note/sidecar revisions and recovery explicit. |
| Architecture and increment history emphasize framework independence, honest errors and reaching real command doors. [R12, R13] | Test mounted controls and integration paths, not just exported functions or green isolated components. |

Source observations do not prove runtime defects or measure severity. AD00 reproduces relevant behavior and updates the evidence ledger.

## 4. Resolve the generated mockups before implementation

| Concept-board element | Adopt, correct or defer |
|---|---|
| Large central canvas, Add/Parts on the left, contextual properties on the right | Adopt the composition and adapt it to actual Obsidian leaf dimensions. |
| Vanity as an integrated example | Adopt as a test fixture; dimensions are illustrative, not construction recommendations. |
| Product logo, large marketing banner or account-like shell | Remove from the plugin UI. Host chrome already supplies application context. |
| Save/Save asset alongside automatic save feedback | Keep the current persistence model and save indicator; do not invent a second draft/publish workflow. |
| Library drawn beside the designer | Treat as a related surface/navigation example, not a mandatory second permanent sidebar inside every designer leaf. |
| Green “fits well” approval | Remove. A visual preview and a user-authored clearance are not proof of fit or compliance. |
| Fixed numerical clearance values | Replace with user input/source-backed data and clear review state. Never treat sample values as standards. |
| Back-centre anchor and front arrows | Correct geometry/labels so back centre is opposite the declared front; derive from the existing orientation convention. |
| North compass | Remove from the standalone object designer; front direction is not geographic north. |
| White backgrounds and fixed blue styling | Use host theme tokens and actual light/dark validation. |
| Freehand/advanced path icons | Do not expose before their entire authoring/persistence/render/export path exists. |
| Texture-heavy object artwork | Optional decoration, not a new texture subsystem or performance dependency. |

The contract document is authoritative over the images for these points.

## 5. Target screen and interaction coverage

| Screen/state ID | Surface and key behavior | Owning tasks |
|---|---|---|
| S00 | Initial/loading/missing/unreadable/stale asset; recover without presenting an empty design over unreadable data. | AD03, AD06 |
| S01 | Main workspace: asset context, Add/Parts, canvas, contextual inspector, honest save/scale state. | AD06 |
| S02 | Visual preset selection and parameters; preview before committing; warn on replacement. | AD07 |
| S03 | Measurement-first creation; width/depth plus optional height and a minimal name. | AD07 |
| S04 | Reference setup, calibration, lock/opacity, tracing, and unscaled notices. | AD07, AD12 |
| S05 | Single-part transform/points/bend; focused numeric editing and visible snapping. | AD02, AD08 |
| S06 | Multiple parts selected; selected count, group, alignment reference, distribution and repeat. | AD08, AD10 |
| S07 | Parts panel: labels, groups, order, local locks/isolation and keyboard navigation. | AD09 |
| S08 | Open line/polyline and rounded-shape editing with geometry-specific fields. | AD11 |
| S09 | Footprint/clearance/placement view; consistent front direction and explicit review state. | AD12 |
| S10 | Preview/use in plan; shared-definition scope, return context and duplicate-as-new. | AD13, AD14 |
| S11 | Conflict/save failure/recovery and compact leaf variant across the above flows. | AD03, AD06, AD15 |

AD01 specifies complete states, controls, focus and transitions; the contract does not require generating new marketing boards. Use the actual browser harness or Obsidian screen captures for implementation review.

### Core interaction obligations

Selection is the resting tool. Drawing returns to Select unless repeat drawing is intentionally enabled. A gesture is one undoable action. Escape cancels a gesture before clearing selection. Numeric edits preserve raw drafts and canonical precision. Selection, shortcuts and temporary authoring controls are leaf-local.

Group graphic parts, not the footprint/reference/clearance into a generic scene graph. Make alignment references and repetition spacing explicit. Provide Parts/inspector alternatives to small canvas handles and modifier-only actions. Keep measured dimensions separate from unscaled capture data. Respect current mobile gating; narrow desktop responsiveness does not establish phone parity.

## 6. Architecture and implementation sequence

Retain the direction `presentation → application → domain → core`, with infrastructure implementing inner-layer ports. [R12]

A new operation follows:

**Input/preview → explicit intent → pure validated edit → reversible command → conditional persistence → refresh/outcome → synchronized views.**

The renderer must not become a second source of truth. Official Konva guidance similarly recommends persisting application state for complex applications, not the complete stage. Its Transformer changes scale properties and Vue requires explicit node attachment, so a demo of multi-node transformation is not a replacement for application history and persistence. [W01–W03]

### Contract-first extensions

AD01 freezes behavior. AD02 and AD03 make existing operations safe. AD04 extends current geometry and storage. AD04 must remain independently compilable: use additive compatibility projections or a coordinated mechanical consumer adaptation in the same change. Do not mark AD04 verified with a broken build while waiting for AD05. AD05 then completes functional rendering/export coverage for the expanded model. New authoring tools arrive only after this support exists. UI shell/entry work can proceed in parallel against existing operations and accepted interfaces.

The model change must preserve existing semantic names and use a separate user label where needed; keep a closed/open graphic discriminant; retain a single canonical draw order; add only shallow group membership; keep temporary visibility/locks outside exported content. The exact names/types belong to the live code's accepted contract, not to independent agent inventions.

### Critical dependency path

AD00 → AD01 → AD02/AD03 → AD04 → AD08 → AD09 → AD10 → AD11 → AD15 → AD16.

The rendering/integration branch AD04 → AD05 → AD13 → AD14 must also complete before AD15. AD06/AD07 provide the UI entry path and AD12 closes reference/placement behavior. AD17 is excluded from the default beta run.

## 7. Recommended execution waves

These are scheduling suggestions, not time estimates. The dependency manifest remains authoritative; shared-file leases can reduce actual parallelism.

| Wave | Tasks | Parallelism and exit condition |
|---|---|---|
| 0 | AD00 | Read-only audit; baseline/evidence and current consumers resolved. |
| 1 | AD01 | One accepted behavior/data contract and ownership map. |
| 2 | AD02, AD03, AD06 | Up to three writers: domain correctness, session reliability, shell. |
| 3 | AD04, AD07 | Schema/model work alongside creation UI using existing builders. |
| 4 | AD05, AD08 | Renderer/consumer support alongside input/selection work. |
| 5 | AD09, AD12 | Parts and reference/placement UI in disjoint files; shared wiring integrated serially. |
| 6 | AD10, AD13 | Pure composition work alongside library/plan integration. |
| 7 | AD11, AD14 | New drawing tools alongside historical/export safeguards. |
| 8 | AD15 | End-to-end verification on the integrated SHA; fix defects through original owners. |
| 9 | AD16 | Hardening, usability, upgrade/recovery and release decision. |
| Later | AD17 | Native portability only when separately activated. |

A task cannot be marked done because its worker says “implemented.” It needs its required evidence and integration acceptance. A dependency is satisfied only by an accepted, verified predecessor on the integration history.

## 8. Subagent roles and ownership

Use one orchestrator/integrator, up to three implementing workers, and a reviewer that does not silently rewrite worker code. A role is a specialization, not a requirement to keep a long-lived agent alive across the whole project.

| Role | Responsibility | Must not independently change |
|---|---|---|
| ARCH | Baseline, traceability, contracts, UX states and ADR consolidation | Production architecture beyond the accepted decision scope |
| DOMAIN | Geometry correctness and pure composition operations | UI save model or storage schema without a change request |
| SESSION | Sequencing, history, conflict/error and lifecycle behavior | Catalogue/revision semantics |
| MODEL | Accepted domain/DTO/mapper/storage migration slice | Renderer-specific authoritative geometry |
| RENDER | All geometry consumers, previews, hit-testing and current exports | Domain semantics to accommodate a renderer shortcut |
| UX | Shell, entry forms, Parts and placement/reference controls | Ad hoc commands, duplicate state or unapproved fields |
| CANVAS | Selection, pointer tools, preview and keyboard behavior | Bypassing domain validation/history for direct Konva writes |
| INTEGRATION | Library/plan navigation, duplication, historical consumers | Silent global shared-definition or approval changes |
| QA | Adversarial tests, real workflow, accessibility, performance and release evidence | Self-certifying an unrun environment or weakening gates |

### Shared-file rule

The integrator is the default owner of `AssetDesignerRoot.vue`, shared runtime/context wiring, shared inspectors/stores where tasks overlap, tool registration, locale dictionaries, composition-root wiring, schema-version constants, package/lockfiles, CI configuration, SDD and ADR indexes.

A worker can receive a temporary exclusive lease on a shared file. Otherwise it supplies the needed integration change in its handoff, not an unannounced edit. The integrator applies/wires it, tests the mounted behavior and only then accepts the task. This is not permission to leave unmounted feature components counted as done.

No two writers edit the same file concurrently, even in separate worktrees. Isolation reduces filesystem interference; it does not prevent semantic merge conflicts. Git worktrees support separate checked-out branches sharing one repository. [W04]

## 9. Quality and acceptance strategy

Use the full matrix in `ACCEPTANCE-AND-QA.md`. The minimum layers are pure geometry/model tests, command/history tests, real persistence/migration tests, mounted component interaction tests, cross-surface rendering/export tests, browser end-to-end tests and an explicitly separate real Obsidian smoke test.

Preserve the existing commands verified in package.json: `npm run check:fast`, `npm run check`, and `npm run audit`. The full check includes build, lint, coverage and static analysis. Read the live scripts again before execution; no `test:e2e` command is assumed. Harness/browser prerequisites must be resolved rather than inferred from `playwright-core`. [R02]

Never weaken lint, architecture, reachability, coverage or file-size limits as the fix for a failing task. Baseline failures are recorded; introduced failures block merge. Final-release evidence cannot hide unresolved baseline problems behind a label—each needs an explicit disposition.

### Proposed quantitative targets

These are acceptance targets to validate, not measured claims: no data loss in all supported migration fixtures; zero wrong-unit/false-save/frozen-state defects; no material geometry drift beyond the declared model tolerance; novice completion of preset creation and placement in a moderated session without instruction; smooth interaction on measured fixture sizes. Performance budgets and their exact hardware/test conditions are in the QA document and must be approved or revised with evidence at AD00/AD16.

## 10. Risks and controls

| Risk | Prevention/detection |
|---|---|
| Model extensions erase legacy or future fields | Version bump, semantic migration fixtures, strict future-version refusal and backup-based recovery test. |
| Multi-agent drift creates competing selection/shape models | Frozen contracts, one ownership ledger and change requests before interface edits. |
| Parallel UI work ships invisible controls | Root wiring gate and mounted behavior tests, not an import-only check. |
| Queue changes deadlock or duplicate commands | Explicit queued/unqueued boundary, write/read-back fault injection and undo barriers. |
| Shared asset edits mutate approved output | AD14 completeness test or explicit unavailable-capability gate. |
| Curved stretching misrepresents dimensions | Recorded scale policy, visible constraints and curve/measurement regression fixtures. |
| Clearance numbers look like certification | Clear planning labels, durable review state, no automatic fit-success message. |
| Looks correct but measurements/export differ | Canonical-state and cross-consumer assertions alongside visual review. |
| Worktree tests touch a real vault | Per-worker disposable fixtures and no implicit test-build deployment. |
| Scope expands into CAD/mobile/cloud | Named deferred backlog and default stop at AD16. |

## 11. Definition of ready, done and blocked

**Ready:** predecessor tasks accepted on the integration branch; matching baseline and contract revision; explicit file scope/leases; test fixtures and negative cases; no unresolved schema or geometry policy for this task.

**Done:** intended use case works through real UI wiring; code respects boundaries; migration/render consumers pass where affected; failures and undo are tested; documentation/localization updated; reviewer accepts; evidence names the exact integrated commit. Scope-specific verification does not imply the whole product has passed release gates.

**Blocked:** required interface/consumer is absent, shared-file ownership conflicts, a schema decision is unresolved, a test cannot be executed or a prerequisite fails. Record the reason and smallest unblocking action. Do not invent success, weaken a guard or ask every agent to improvise an incompatible workaround.

## 12. Work-package index

| ID | Work package | Owner | Prerequisites | Scope | Relative size |
|---|---|---|---|---|---|
| AD00 | Reconcile the live repository and establish the baseline | ARCH | — | beta | S |
| AD01 | Freeze behavior, data contracts and the screen-state specification | ARCH | AD00 | beta | M |
| AD02 | Make resizing and geometry operations predictable | DOMAIN | AD01 | beta | L |
| AD03 | Unify command sequencing, undo and recovery behavior | SESSION | AD01 | beta | L |
| AD04 | Evolve the asset schema and migrations without data loss | MODEL | AD02, AD03 | beta | L |
| AD05 | Support every graphic kind across rendering and export | RENDER | AD04 | beta | L |
| AD06 | Align the designer shell with Obsidian and the Plan Editor | UX | AD01 | beta | M |
| AD07 | Make presets, measurements and reference setup first-class entry paths | UX | AD02, AD03, AD06 | beta | M |
| AD08 | Extend selection and pointer gestures to multiple parts | CANVAS | AD03, AD04, AD06 | beta | L |
| AD09 | Add a Parts panel for finding and organizing the object | UX | AD08 | beta | M |
| AD10 | Implement grouping, alignment, distribution and repeat | DOMAIN | AD02, AD04, AD08, AD09 | beta | L |
| AD11 | Expose open lines and rounded-shape authoring | CANVAS | AD02, AD04, AD05, AD08, AD10 | beta | M |
| AD12 | Clarify reference calibration, clearance and placement | UX | AD02, AD03, AD07, AD08 | beta | M |
| AD13 | Complete the library–designer–plan workflow | INTEGRATION | AD05, AD07, AD12 | beta | L |
| AD14 | Protect historical plans and honest export behavior | INTEGRATION | AD05, AD13 | beta | L |
| AD15 | Validate the complete custom-object workflow | QA | AD09, AD10, AD11, AD12, AD13, AD14 | beta | M |
| AD16 | Harden, document and release the asset-designer beta | QA | AD15 | beta | M |
| AD17 | Add explicit native asset portability after beta | INTEGRATION | AD04, AD05, AD13, AD14, AD16 | post-beta | L |

Sizes express relative implementation/review complexity, not time or effort commitments. Split an L task into subordinate changes only after preserving its acceptance boundary and file ownership.

## 13. Detailed task cards

### AD00 — Reconcile the live repository and establish the baseline

**Owner:** ARCH · **Scope:** beta · **Relative size:** S

**Prerequisites:** None; audit is the entry point.  
**Exclusive lock groups:** baseline. Exact file leases are still required.

#### User or delivery outcome

Produce an evidence-backed delta between this plan and the checkout before any production changes.

#### Entry points to inspect

- `CLAUDE.md`
- `docs/development/sdds/obsidian-renovation-planner-SDD.md`
- `docs/development/agent-guide-increment-history.md`
- `docs/requirements/Asset designer.md`
- `package.json`
- `src/presentation/designer/`
- `src/infrastructure/persistence/dto/assetGeometry.ts`

These are investigation/ownership entry points, not blanket edit permission. Resolve actual files and leases in AD00/dispatch; proposed files are not claimed to exist.

#### Implementation work

1. Record branch, HEAD, dirty state, supported Node version, dependency lockfile, baseline build/test/lint/analyzer results, and access to a disposable Obsidian vault.
2. Trace each existing capability from visible control to tool, command, validator, storage adapter, renderer and tests. Classify it as retain, improve, missing, obsolete or unverified. Resolve actual infrastructure paths by imports; do not infer them from shortened docblocks.
3. Inventory every AssetDetail/AssetShape consumer, including library thumbnails, placed instances, hit-testing, snapping, exports and any revision snapshots. Find the symbols spec and record existing decisions about arc stretching and presets.
4. Capture the running designer and neighboring Plan Editor in light/dark themes when runnable. Record screenshot/test limitations rather than fabricate a visual audit.
5. Map these execution IDs to the existing Asset Designer epic and its use cases. Record overlap with ongoing branches and designate a single integration branch.

#### Acceptance criteria

- [ ] The selected baseline is an exact commit; the dated review SHA is not used to reset or overwrite newer work.
- [ ] Every existing feature has a disposition and evidence; already completed work is not reimplemented.
- [ ] All current rendering/export consumers and supported persistence versions are listed.
- [ ] The baseline report distinguishes passed, failed and not run; no claim of a clean build is inferred from documentation.
- [ ] The current approval/revision behavior and any mobile entry gate are resolved before scope is finalized.

#### Required verification

- Run the existing package gates on the selected baseline; preserve exact commands and exit codes.
- Inspect one legacy sidecar and one current fixture without editing a real vault.
- Check current view registration/reachability tests and harness invocation.

#### Handoff and integration gate

Use [TASK-REPORT.md](./templates/TASK-REPORT.md). Record exact base/candidate/integrated commits, contract revision, files changed, tests and exit codes, acceptance coverage, screenshots where relevant, and all verification not performed. Apply [DECISIONS.md](./contracts/DECISIONS.md) and the task-specific requirements above.

No task is verified until its actual integration wiring and relevant consumers pass the required checks. The worker cannot waive missing dependencies, future-schema refusal, negative cases or a real-host test by declaring completion.

---

### AD01 — Freeze behavior, data contracts and the screen-state specification

**Owner:** ARCH · **Scope:** beta · **Relative size:** M

**Prerequisites:** AD00  
**Exclusive lock groups:** contracts. Exact file leases are still required.

#### User or delivery outcome

Give all implementation agents one shared contract and remove ambiguities in the generated boards.

#### Entry points to inspect

- `docs/user-experience/renovation-planner-editor-specs/`
- `docs/user-experience/asset-library-delivery/`
- `docs/development/adrs/`
- `src/domain/asset/AssetShape.ts`
- `src/domain/asset/AssetDetail.ts`
- `src/presentation/designer/selection/designerSelection.ts`

These are investigation/ownership entry points, not blanket edit permission. Resolve actual files and leases in AD00/dispatch; proposed files are not claimed to exist.

#### Implementation work

1. Adopt or amend contracts/DECISIONS.md. Record decisions in repository ADR/spec conventions, without renumbering existing SDD sections.
2. Freeze selection, grouping, element geometry, authoring metadata, reference space, command completion, clearance review, navigation and rendering contracts. Define exact affected file ownership.
3. Specify screens S00–S11 from the master plan, including empty/loading/error/stale/conflict states, focus movement, primary actions, compact behavior and theme tokens.
4. Correct the mockups: no product logo/account chrome, no second manual save workflow, no north compass, no automatic “fits well” approval, and coherent back-centre/front direction.
5. Record one canonical contract revision and concrete implementation types/paths. Resolve whether any existing issued-plan workflow forces historical preservation work earlier.

#### Acceptance criteria

- [ ] No implementation agent must invent a schema, selection model or command outcome independently.
- [ ] Dimensions are derived; physical size, graphics, reference space and display units remain distinct.
- [ ] All concept-board controls are classified as implement now, existing/reuse, correct, or defer.
- [ ] Group layering behavior, duplicate-ID behavior, mixed-scale behavior, and clearance-on-resize behavior are explicit.
- [ ] All accepted defaults have a reason; departures from accepted repository behavior are recorded, not silently treated as bug fixes.

#### Required verification

- Review contracts against actual consumers and hostile fixtures discovered in AD00.
- Check all screen states against the current lifecycle and error-routing policy.

#### Handoff and integration gate

Use [TASK-REPORT.md](./templates/TASK-REPORT.md). Record exact base/candidate/integrated commits, contract revision, files changed, tests and exit codes, acceptance coverage, screenshots where relevant, and all verification not performed. Apply [DECISIONS.md](./contracts/DECISIONS.md) and the task-specific requirements above.

No task is verified until its actual integration wiring and relevant consumers pass the required checks. The worker cannot waive missing dependencies, future-schema refusal, negative cases or a real-host test by declaring completion.

---

### AD02 — Make resizing and geometry operations predictable

**Owner:** DOMAIN · **Scope:** beta · **Relative size:** L

**Prerequisites:** AD01  
**Exclusive lock groups:** domain, geometry. Exact file leases are still required.

#### User or delivery outcome

Resizing an existing object preserves its identity and intended geometry instead of unexpectedly replacing it.

#### Entry points to inspect

- `src/domain/asset/shapeEdits.ts`
- `src/domain/asset/AssetShape.ts`
- `src/core/geometry/CurvedPolygon.ts`
- `src/presentation/designer/AssetDesignerRoot.vue (integration lease only)`

These are investigation/ownership entry points, not blanket edit permission. Resolve actual files and leases in AD00/dispatch; proposed files are not claimed to exist.

#### Implementation work

1. Separate creation from dimensions, whole-object resize, selected-part resize and explicit footprint replacement. Move policy out of the root into tested domain/application operations.
2. Preserve straight-sided nonrectangular topology on resize. Choose the fixed anchor deliberately. Keep height independent and retain fractional precision.
3. Apply the accepted circular-arc policy across numeric and handle transforms. The default is proportional scaling for curved geometry; supersede the existing circular-reinterpretation behavior explicitly.
4. Keep measured and pending coordinate spaces separate. Prevent whole-object operations from silently combining incompatible spaces.
5. Implement the agreed clearance-on-resize refusal or review path; do not silently scale a planning clearance into a smaller one.

#### Acceptance criteria

- [ ] An L-shaped footprint remains L-shaped after a width edit; only explicit Replace footprint produces a rectangle.
- [ ] Cancel and unchanged values write nothing and add no undo entry.
- [ ] A curved object does not silently undergo an inexact affine stretch advertised as an exact one.
- [ ] Repeated unit switches and edits retain canonical values within the declared numeric tolerance.
- [ ] Footprint-derived dimensions ignore decorative parts; height and plan calibration do not change.
- [ ] Existing assets with clearance are protected even before persistent review metadata lands in AD04.

#### Required verification

- Regression fixtures: L-shape, rectangle, circular arc, off-centre anchor, sub-millimetre values and mixed pending flags.
- Reject NaN, infinity, zero/negative factors, overflow and degenerate geometry.
- Test transform then inverse within documented tolerances; mirror twice preserves orientation and curve semantics.

#### Handoff and integration gate

Use [TASK-REPORT.md](./templates/TASK-REPORT.md). Record exact base/candidate/integrated commits, contract revision, files changed, tests and exit codes, acceptance coverage, screenshots where relevant, and all verification not performed. Apply [DECISIONS.md](./contracts/DECISIONS.md) and the task-specific requirements above.

No task is verified until its actual integration wiring and relevant consumers pass the required checks. The worker cannot waive missing dependencies, future-schema refusal, negative cases or a real-host test by declaring completion.

---

### AD03 — Unify command sequencing, undo and recovery behavior

**Owner:** SESSION · **Scope:** beta · **Relative size:** L

**Prerequisites:** AD01  
**Exclusive lock groups:** session, history. Exact file leases are still required.

#### User or delivery outcome

Fast user actions and two open leaves cannot cause silent overwrites, misleading Saved states or inconsistent undo.

#### Entry points to inspect

- `src/presentation/designer/selection/editShape.ts`
- `src/presentation/designer/runtime.ts`
- `src/presentation/designer/designerCommands.ts`
- `src/application/editor/asset/`
- `src/application/queries/GetAssetDesign.ts`

These are investigation/ownership entry points, not blanket edit permission. Resolve actual files and leases in AD00/dispatch; proposed files are not claimed to exist.

#### Implementation work

1. Trace all write doors. Put shape edits, preset replacement, dimension replacement, background changes, height edits and history barriers under one coherent per-leaf sequencing policy.
2. Preserve distinct noteVersion and geometryVersion checks. Capture subject and intent before queuing; read the relevant canonical state at the correct execution boundary.
3. Keep pointer previews ephemeral; commit one whole validated result per completed gesture. Ensure no-op outcomes do not enter history.
4. Prevent queue reentrancy/deadlocks: code already inside the chain must call unqueued primitives. Fence undo/redo against writes and refreshes rather than wrapping the queue around itself.
5. Route thrown faults and coded refusals through existing error/logging policy. Handle failed read-back, external changes, deletion, view teardown and retries without pretending success.

#### Acceptance criteria

- [ ] A queued move followed by resize composes correctly; undo cannot overtake an unsettled write.
- [ ] Every new composite action is all-or-nothing at the shape-document boundary.
- [ ] Two leaves editing one asset use expected versions and surface a conflict instead of last-writer-wins.
- [ ] A successful write with failed refresh displays stale content honestly; retries do not duplicate a mutation.
- [ ] Closing/rebinding a view does not leak listeners or write a queued action into a different asset.
- [ ] Multi-resource operations are not advertised as atomic unless a real recovery protocol supports them.

#### Required verification

- Fault-injection tests before write, after write/before refresh, on refresh, on inverse write and during close.
- Burst sequence: draw → nudge → replace preset → undo → redo; assert order and history count.
- Test expected-version mismatch separately for note and sidecar.

#### Handoff and integration gate

Use [TASK-REPORT.md](./templates/TASK-REPORT.md). Record exact base/candidate/integrated commits, contract revision, files changed, tests and exit codes, acceptance coverage, screenshots where relevant, and all verification not performed. Apply [DECISIONS.md](./contracts/DECISIONS.md) and the task-specific requirements above.

No task is verified until its actual integration wiring and relevant consumers pass the required checks. The worker cannot waive missing dependencies, future-schema refusal, negative cases or a real-host test by declaring completion.

---

### AD04 — Evolve the asset schema and migrations without data loss

**Owner:** MODEL · **Scope:** beta · **Relative size:** L

**Prerequisites:** AD02, AD03  
**Exclusive lock groups:** domain, schema, persistence. Exact file leases are still required.

#### User or delivery outcome

Old assets and newly composed objects share one validated, versioned model.

#### Entry points to inspect

- `src/domain/asset/AssetDetail.ts`
- `src/domain/asset/AssetShape.ts`
- `src/infrastructure/persistence/dto/assetGeometry.ts`
- `src/application/ports/AssetGeometrySidecar.ts`
- `Actual asset geometry mapper/store/adapter paths resolved in AD00`

These are investigation/ownership entry points, not blanket edit permission. Resolve actual files and leases in AD00/dispatch; proposed files are not claimed to exist.

#### Implementation work

1. Implement the accepted minimal extension: closed geometry and open polyline geometry, stable element identity, optional user labels, shallow graphic groups, and only the authoring metadata needed by accepted behavior.
2. Keep the current stable semantic name separate from a user-editable label; preserve existing solid/dashed and pending semantics.
3. Implement open-geometry validators and pure model constructors now; AD11 adds authoring tools, not a second schema.
4. Allocate the next schema version available at implementation time (reviewed baseline is v2, with v1 read support). Migrate v1/v2 losslessly; reject unsupported future versions.
5. Implement DTO/domain mapping, expected-version preservation, storage failure behavior and fixture round-trips. Avoid destructive bulk rewrites on mere reads.
6. Keep AD04 independently compilable: add compatibility projections or include the necessary mechanical closed-kind consumer adaptations under integration leases. AD05 is functional cross-surface completion, not a future repair for a broken build.
7. Coordinate expanded consumers through AD05 before any new geometry-writing UI is exposed.

#### Acceptance criteria

- [ ] Legacy IDs, order, semantic names, bulges, scale flags, calibration, anchor and facing survive migration.
- [ ] Missing optional legacy data is distinguished from present malformed data; corruption is not coerced into valid empty content.
- [ ] Groups contain only graphic element IDs, no cycles/nesting, no dangling or duplicate membership.
- [ ] Open paths have finite valid points and are never faked as zero-area polygons.
- [ ] An older supported binary refuses a newer schema rather than silently stripping group/geometry fields on write.
- [ ] Failed migration or persistence leaves original content recoverable; rollback instructions do not assume old binaries can read new files.
- [ ] Existing source consumers compile and old-geometry behavior remains functional before AD05; new unsupported kinds fail explicitly rather than silently disappearing.

#### Required verification

- Golden fixtures: v1 plain, v2 detailed/curved, unscaled/mixed flags, null shape, malformed current, unknown future.
- Migrate → save → reopen → compare semantic equality; corrupt IDs/membership/units must fail.
- Exercise mapper/store/application seams, not just Zod unit tests.

#### Handoff and integration gate

Use [TASK-REPORT.md](./templates/TASK-REPORT.md). Record exact base/candidate/integrated commits, contract revision, files changed, tests and exit codes, acceptance coverage, screenshots where relevant, and all verification not performed. Apply [DECISIONS.md](./contracts/DECISIONS.md) and the task-specific requirements above.

No task is verified until its actual integration wiring and relevant consumers pass the required checks. The worker cannot waive missing dependencies, future-schema refusal, negative cases or a real-host test by declaring completion.

---

### AD05 — Support every graphic kind across rendering and export

**Owner:** RENDER · **Scope:** beta · **Relative size:** L

**Prerequisites:** AD04  
**Exclusive lock groups:** render, exports. Exact file leases are still required.

#### User or delivery outcome

The same asset has the same geometry in designer, library, plan and existing export consumers.

#### Entry points to inspect

- `src/presentation/designer/DesignerCanvas.vue`
- `Designer layer/render-model modules found in AD00`
- `Library thumbnail, plan asset renderer and export modules found in AD00`
- `src/presentation/designer/presets/presetPreview.ts`

These are investigation/ownership entry points, not blanket edit permission. Resolve actual files and leases in AD00/dispatch; proposed files are not claimed to exist.

#### Implementation work

1. Extend a shared renderer-independent projection or existing geometry helpers, rather than adding unrelated drawing implementations per surface.
2. Handle all discriminated geometry kinds exhaustively, including open-stroke bounds, line joins/caps, hit-testing and theme-aware closed-shape occlusion.
3. Keep authoring guides, selection boxes, reference sheets and editing isolation out of normal symbol/export output.
4. Use native object units at plan placement; viewport zoom and thumbnail scaling must never alter persisted geometry.
5. Update all existing export formats that contain assets. Mark nonexistent formats as future work rather than claiming compatibility.
6. Add cross-surface fixtures and cache invalidation keyed by the relevant asset changes. Do not create a Konva layer per part.

#### Acceptance criteria

- [ ] Open lines and grouped parts render in every current asset consumer without disappearing.
- [ ] Light and dark backgrounds preserve intended outlines/occlusion and readable contrast.
- [ ] Visual bounds do not replace the physical footprint for measurements or placement logic.
- [ ] Rotated/mirrored previews and actual placement use consistent anchor/facing transforms.
- [ ] Unknown/corrupt geometry is refused or clearly reported, never silently omitted in an export.
- [ ] No new writing tool is released before its consumers pass this gate.

#### Required verification

- Cross-surface golden render tests plus semantic geometry/bounds assertions.
- Test a thin open path, overlapping solid details, dashed details, off-centre anchor and reflected curved shape.
- Verify export inclusion/exclusion without using screenshots alone as proof of geometry correctness.

#### Handoff and integration gate

Use [TASK-REPORT.md](./templates/TASK-REPORT.md). Record exact base/candidate/integrated commits, contract revision, files changed, tests and exit codes, acceptance coverage, screenshots where relevant, and all verification not performed. Apply [DECISIONS.md](./contracts/DECISIONS.md) and the task-specific requirements above.

No task is verified until its actual integration wiring and relevant consumers pass the required checks. The worker cannot waive missing dependencies, future-schema refusal, negative cases or a real-host test by declaring completion.

---

### AD06 — Align the designer shell with Obsidian and the Plan Editor

**Owner:** UX · **Scope:** beta · **Relative size:** M

**Prerequisites:** AD01  
**Exclusive lock groups:** shell. Exact file leases are still required.

#### User or delivery outcome

A familiar canvas-led workspace presents Add, Parts and contextual properties without overwhelming the user.

#### Entry points to inspect

- `src/presentation/designer/AssetDesignerRoot.vue (integration lease only)`
- `src/presentation/designer/DesignerToolbar.vue`
- `src/presentation/designer/DesignerViewMenu.vue`
- `src/presentation/designer/inspector/DesignerInspector.vue`
- `Actual designer styles and locale files resolved in AD00`

These are investigation/ownership entry points, not blanket edit permission. Resolve actual files and leases in AD00/dispatch; proposed files are not claimed to exist.

#### Implementation work

1. Implement a restrained header with asset name, library return, actual save state, and contextual Use in plan action; no account/logo chrome.
2. Introduce Add/Parts navigation and contextual inspector slots using existing controls and tokens. Keep dormant future features out of the visible toolbar.
3. Use selection as the resting mode, with discoverable Add actions and temporary pan behavior aligned to the current Plan Editor.
4. Collapse panels into drawers according to available leaf width, not browser window width; keep canvas and recovery actions reachable.
5. Preserve loading, missing asset, invalid sidecar, stale read, unscaled and save-failure states through the redesign. Integrate mounted components rather than leaving standalone demos.

#### Acceptance criteria

- [ ] The user can identify the current object, selection, measurement state and save state without opening a menu.
- [ ] Existing tools remain reachable; every enabled control performs a real operation.
- [ ] No duplicated Save/Publish mechanism or green fit-certification state is introduced.
- [ ] Host light/dark themes and neighboring surfaces remain coherent without hardcoded theme assumptions.
- [ ] At compact desktop leaf widths, controls do not overlap the drawing or disappear offscreen.
- [ ] Focus returns predictably after dialogs/drawers; shortcuts do not capture input from notes or fields.

#### Required verification

- Component reachability/mounting tests and keyboard focus tests.
- Visual checks at wide, medium and compact leaf widths in both host themes.
- Regression screenshots for empty, selected, error and stale states.

#### Handoff and integration gate

Use [TASK-REPORT.md](./templates/TASK-REPORT.md). Record exact base/candidate/integrated commits, contract revision, files changed, tests and exit codes, acceptance coverage, screenshots where relevant, and all verification not performed. Apply [DECISIONS.md](./contracts/DECISIONS.md) and the task-specific requirements above.

No task is verified until its actual integration wiring and relevant consumers pass the required checks. The worker cannot waive missing dependencies, future-schema refusal, negative cases or a real-host test by declaring completion.

---

### AD07 — Make presets, measurements and reference setup first-class entry paths

**Owner:** UX · **Scope:** beta · **Relative size:** M

**Prerequisites:** AD02, AD03, AD06  
**Exclusive lock groups:** creation. Exact file leases are still required.

#### User or delivery outcome

A novice can create a usable object without providing a reference drawing or completing catalogue administration.

#### Entry points to inspect

- `src/presentation/designer/presets/AssetPresetForm.vue`
- `src/domain/asset/presets/catalogue.ts (reuse; changes need domain lease)`
- `src/presentation/designer/AssetDesignerRoot.vue (integration lease only)`
- `Existing asset creation/library commands resolved in AD00`

These are investigation/ownership entry points, not blanket edit permission. Resolve actual files and leases in AD00/dispatch; proposed files are not claimed to exist.

#### Implementation work

1. Offer Start from object, Start from measurements and Trace reference at the appropriate empty state. Reuse existing preset builders and parameter validation.
2. Present searchable visual preset choices with live previews and a small set of meaningful fields.
3. Create a named measured rectangle with optional descriptive height; price/category/supplier must not block creation.
4. Explain that initial preset generation yields editable geometry unless persistent parameters are actually implemented. Confirm replacement of an existing manual design.
5. Keep reference import local and optional. Route new asset creation through current catalogue commands, including recoverable failure between note and sidecar creation.

#### Acceptance criteria

- [ ] A measured 1200 × 450 mm asset can be created without a background or calibration dialog.
- [ ] Preset preview matches committed geometry and subsequent library/plan rendering.
- [ ] Cancellation creates no orphan catalogue entry or sidecar.
- [ ] Invalid units/values retain the draft and explain the error; valid values are not rounded destructively.
- [ ] Changing a preset never silently overwrites manual edits.
- [ ] Creation returns a real persisted asset ID and a usable designer/plan transition.

#### Required verification

- Create-from-measurements and preset flow tests, including repeated submit and cancelled forms.
- Fault-inject partial creation and retry; verify no duplicate asset IDs or orphaned usable-looking objects.
- Usability scenario U01 from ACCEPTANCE-AND-QA.md.

#### Handoff and integration gate

Use [TASK-REPORT.md](./templates/TASK-REPORT.md). Record exact base/candidate/integrated commits, contract revision, files changed, tests and exit codes, acceptance coverage, screenshots where relevant, and all verification not performed. Apply [DECISIONS.md](./contracts/DECISIONS.md) and the task-specific requirements above.

No task is verified until its actual integration wiring and relevant consumers pass the required checks. The worker cannot waive missing dependencies, future-schema refusal, negative cases or a real-host test by declaring completion.

---

### AD08 — Extend selection and pointer gestures to multiple parts

**Owner:** CANVAS · **Scope:** beta · **Relative size:** L

**Prerequisites:** AD03, AD04, AD06  
**Exclusive lock groups:** selection, canvas-input. Exact file leases are still required.

#### User or delivery outcome

Users can select and manipulate several graphic parts predictably, including by keyboard-accessible alternatives.

#### Entry points to inspect

- `src/presentation/designer/selection/designerSelection.ts`
- `src/presentation/designer/stores/assetDesignStore.ts`
- `src/presentation/designer/tools/designer-select-tool.ts`
- `src/presentation/designer/designerKeys.ts`
- `src/presentation/designer/DesignerCanvas.vue (integration lease only)`

These are investigation/ownership entry points, not blanket edit permission. Resolve actual files and leases in AD00/dispatch; proposed files are not claimed to exist.

#### Implementation work

1. Implement a selected-part set plus a focused/primary part; retain stable IDs across refreshes and prune deleted IDs.
2. Add additive selection, marquee selection, selected count and deterministic overlapping-object selection with an accessible alternative.
3. Keep footprint/clearance/anchor/facing special selections separate from bulk graphic composition. Offer explicit Edit footprint and Select whole object actions.
4. Implement pointer capture, drag thresholds, cancellable preview, out-of-bounds release and keyboard nudging; suppress click-after-drag selection errors.
5. Preserve existing point/bend modes for one eligible closed element. Multi-selection presents group-level actions rather than invalid individual fields.
6. Use shared snapping conventions with screen-space tolerance and visible targets; never auto-snap across incompatible unscaled spaces.

#### Acceptance criteria

- [ ] Canvas and Parts selection observe the same model, not two synchronized copies.
- [ ] No modifier is required for the only available route to multi-select.
- [ ] Clicking inside the current multi-selection preserves it until the user intentionally changes it.
- [ ] A finished drag is one write/history entry; Escape/pointercancel is none.
- [ ] Locked/temporarily hidden parts are handled consistently and can still be found/unlocked in Parts.
- [ ] External edits or deleted selected elements do not cause commands to target a different part.

#### Required verification

- Selection reducer and hit-test tests; rotated geometry, zoom extremes and overlapping parts.
- Pointer sequences including pointercancel, Escape, blur, release outside leaf and stale queued data.
- Keyboard field-vs-canvas focus tests and two-leaf isolation.

#### Handoff and integration gate

Use [TASK-REPORT.md](./templates/TASK-REPORT.md). Record exact base/candidate/integrated commits, contract revision, files changed, tests and exit codes, acceptance coverage, screenshots where relevant, and all verification not performed. Apply [DECISIONS.md](./contracts/DECISIONS.md) and the task-specific requirements above.

No task is verified until its actual integration wiring and relevant consumers pass the required checks. The worker cannot waive missing dependencies, future-schema refusal, negative cases or a real-host test by declaring completion.

---

### AD09 — Add a Parts panel for finding and organizing the object

**Owner:** UX · **Scope:** beta · **Relative size:** M

**Prerequisites:** AD08  
**Exclusive lock groups:** parts. Exact file leases are still required.

#### User or delivery outcome

Users can find, name and isolate small parts without precision clicking.

#### Entry points to inspect

- `src/presentation/designer/ (proposed Parts component files)`
- `src/presentation/designer/inspector/DesignerSelectionInspector.vue`
- `src/presentation/designer/stores/assetDesignStore.ts (integration lease only)`

These are investigation/ownership entry points, not blanket edit permission. Resolve actual files and leases in AD00/dispatch; proposed files are not claimed to exist.

#### Implementation work

1. Build a Parts view over the canonical selection contract: physical footprint, graphic parts/groups, clearance, placement and reference.
2. Allow user labels without changing stable preset semantic names. Reflect canonical visual ordering.
3. Implement transient edit locks and visibility/isolation in leaf-local UI preferences, clearly separate from final symbol content.
4. Provide keyboard navigation, rename, explicit move forward/back actions for parts, and accessible group expansion.
5. Preserve selection/focus after rename, removal, grouping and refresh; show a meaningful empty panel state.

#### Acceptance criteria

- [ ] Selecting a row selects the same part on canvas and vice versa.
- [ ] Rename survives a file round-trip while preset semantic identifiers remain unchanged.
- [ ] Editing isolation does not remove content from placement, quantities or export.
- [ ] User can unlock/find a hidden part without hunting on the canvas.
- [ ] Parts never imply separate procurement units or prices.
- [ ] Group rows do not create a second rendering order or a Konva layer per row.

#### Required verification

- Component keyboard tests, rename round-trip and focus restoration.
- Canvas/Parts integration for hidden, locked and deleted selections.
- Snapshot order checks with interleaved grouped and ungrouped parts.

#### Handoff and integration gate

Use [TASK-REPORT.md](./templates/TASK-REPORT.md). Record exact base/candidate/integrated commits, contract revision, files changed, tests and exit codes, acceptance coverage, screenshots where relevant, and all verification not performed. Apply [DECISIONS.md](./contracts/DECISIONS.md) and the task-specific requirements above.

No task is verified until its actual integration wiring and relevant consumers pass the required checks. The worker cannot waive missing dependencies, future-schema refusal, negative cases or a real-host test by declaring completion.

---

### AD10 — Implement grouping, alignment, distribution and repeat

**Owner:** DOMAIN · **Scope:** beta · **Relative size:** L

**Prerequisites:** AD02, AD04, AD08, AD09  
**Exclusive lock groups:** domain, composition. Exact file leases are still required.

#### User or delivery outcome

A user can build a recognizable multi-part object through a few deliberate operations.

#### Entry points to inspect

- `src/domain/asset/ (pure composition operations)`
- `src/presentation/designer/selection/`
- `src/presentation/designer/inspector/ (proposed multi-selection actions)`
- `Existing reversible shape-write command path`

These are investigation/ownership entry points, not blanket edit permission. Resolve actual files and leases in AD00/dispatch; proposed files are not claimed to exist.

#### Implementation work

1. Add shallow group/ungroup without changing world coordinates, canonical element order or procurement semantics.
2. Implement alignment to selection bounds or an explicitly chosen reference part, with stable tie-breaking and visible reference choice.
3. Implement centre/edge distribution with defined gap behavior; retain endpoints and refuse undefined operations.
4. Add duplicate/repeat with explicit count and spacing, bounded inputs, fresh IDs, remapped groups and deterministic redo.
5. Add group move/rotate/proportional scale and bring-to-front/back while preserving internal order; do not silently reorder on Group itself.
6. Compute the complete operation through pure functions, validate once at the aggregate boundary and dispatch one reversible result.

#### Acceptance criteria

- [ ] Grouping and ungrouping produce no visual jump, geometry change or quantity change.
- [ ] Any invalid participant refuses the whole edit; no half-aligned group is persisted.
- [ ] Undo/redo restores IDs, membership, order and geometry together.
- [ ] A reference part chosen for alignment remains fixed.
- [ ] Repeat distinguishes centre spacing from edge gap and previews the intended result.
- [ ] Curved groups and mixed coordinate-space groups obey the contracts rather than bypassing geometry safety.

#### Required verification

- Table-driven align/distribute tests with equal bounds, rotated parts, zero extents and locked elements.
- Duplicate/repeat undo/redo and fresh-ID tests.
- Group then ungroup invariance; graphical changes leave purchase/quantity inputs unchanged.

#### Handoff and integration gate

Use [TASK-REPORT.md](./templates/TASK-REPORT.md). Record exact base/candidate/integrated commits, contract revision, files changed, tests and exit codes, acceptance coverage, screenshots where relevant, and all verification not performed. Apply [DECISIONS.md](./contracts/DECISIONS.md) and the task-specific requirements above.

No task is verified until its actual integration wiring and relevant consumers pass the required checks. The worker cannot waive missing dependencies, future-schema refusal, negative cases or a real-host test by declaring completion.

---

### AD11 — Expose open lines and rounded-shape authoring

**Owner:** CANVAS · **Scope:** beta · **Relative size:** M

**Prerequisites:** AD02, AD04, AD05, AD08, AD10  
**Exclusive lock groups:** geometry-tools, domain. Exact file leases are still required.

#### User or delivery outcome

Users can draw seams and recognizable rounded details without abusing closed polygons.

#### Entry points to inspect

- `src/presentation/designer/tools/registerDesignerTools.ts`
- `src/presentation/designer/tools/ (proposed line/polyline tools)`
- `src/domain/asset/ (primitive builders)`
- `src/presentation/designer/inspector/ (supported geometry properties)`

These are investigation/ownership entry points, not blanket edit permission. Resolve actual files and leases in AD00/dispatch; proposed files are not claimed to exist.

#### Implementation work

1. Expose line and polyline tools backed by AD04 geometry; define click-to-add, completion, cancel and snapping behavior.
2. Add rounded-rectangle creation with validated radius, reusing circular arc representation where exact. Store parameter intent only if subsequent edits can maintain it honestly.
3. Retain existing rectangle/circle/detail tracing and bending; improve discovery instead of reimplementing them.
4. Keep style controls restrained and preserve solid/dashed meaning. Open paths are strokes without closed-region fills.
5. Use shared tool registration/reachability tests, one-gesture history, and complete renderer/export coverage before showing the controls.
6. Defer arbitrary Bézier editing, freehand smoothing, native ellipses and SVG import to separate approved increments.

#### Acceptance criteria

- [ ] An open polyline remains open after save, reopen, duplication, grouping and export.
- [ ] One line stroke with zero width or height can be valid without applying the closed-area validator.
- [ ] Radius bounds are explicit; changed dimensions cannot produce invalid corner geometry.
- [ ] All new tools are mounted, accessible and cancellable; completion returns to Select unless repeat is explicit.
- [ ] No fake thin polygon or silently flattened unsupported geometry is written.
- [ ] Unsupported property fields are absent or explain their limitation rather than doing nothing.

#### Required verification

- Full author → edit → save → reopen → place/export tests for each new kind.
- Tool reachability and completion/cancel gesture tests.
- Closed geometry regression suite after the new discriminant is introduced.

#### Handoff and integration gate

Use [TASK-REPORT.md](./templates/TASK-REPORT.md). Record exact base/candidate/integrated commits, contract revision, files changed, tests and exit codes, acceptance coverage, screenshots where relevant, and all verification not performed. Apply [DECISIONS.md](./contracts/DECISIONS.md) and the task-specific requirements above.

No task is verified until its actual integration wiring and relevant consumers pass the required checks. The worker cannot waive missing dependencies, future-schema refusal, negative cases or a real-host test by declaring completion.

---

### AD12 — Clarify reference calibration, clearance and placement

**Owner:** UX · **Scope:** beta · **Relative size:** M

**Prerequisites:** AD02, AD03, AD07, AD08  
**Exclusive lock groups:** placement-ui, reference-ui. Exact file leases are still required.

#### User or delivery outcome

Users understand scale, reserved space and orientation without a CAD vocabulary or false fit assurance.

#### Entry points to inspect

- `src/presentation/designer/inspector/DesignerInspector.vue (integration lease only)`
- `src/presentation/designer/tools/set-anchor-tool.ts`
- `src/presentation/designer/tools/set-facing-tool.ts`
- `Existing reference/background and calibration pipeline`

These are investigation/ownership entry points, not blanket edit permission. Resolve actual files and leases in AD00/dispatch; proposed files are not claimed to exist.

#### Implementation work

1. Provide a guided reference sequence: choose local image/supported PDF page, calibrate known length, lock reference, trace, inspect dimensions.
2. Use Placement point and Front direction labels with centre/back-centre/custom choices mapped to the existing coordinate convention.
3. Display footprint, graphics and clearance distinctly. Preserve arbitrary traced clearance polygons; do not pretend every outline is represented by four numeric setbacks.
4. Offer a rectangular-clearance helper only for supported geometry and explicitly author a boundary; defaults are illustrative, not standards.
5. Implement persisted review state where required by AD01 after relevant dimension/orientation changes. Calibrated, manually entered and independently verified remain different claims.
6. Check plan-placement transform behavior and return context with the integration owner.

#### Acceptance criteria

- [ ] Asset calibration does not modify any plan calibration or already measured coordinate group.
- [ ] Back centre is actually opposite the displayed front, including after rotation/mirroring.
- [ ] Replacing/deleting a reference does not silently mark measured geometry unscaled or erase pending warnings.
- [ ] Resize never weakens a clearance silently; a required review survives reopening.
- [ ] No green “fits well” or compliance claim is produced from a visual preview.
- [ ] Height remains descriptive; no vertical clash calculation is introduced.

#### Required verification

- Calibration isolation, mixed pending flags and reference replacement tests.
- Anchor/facing transform fixtures for 0/90/180/270-degree placement and mirror operations.
- Review-state round-trip and missing-reference recovery.

#### Handoff and integration gate

Use [TASK-REPORT.md](./templates/TASK-REPORT.md). Record exact base/candidate/integrated commits, contract revision, files changed, tests and exit codes, acceptance coverage, screenshots where relevant, and all verification not performed. Apply [DECISIONS.md](./contracts/DECISIONS.md) and the task-specific requirements above.

No task is verified until its actual integration wiring and relevant consumers pass the required checks. The worker cannot waive missing dependencies, future-schema refusal, negative cases or a real-host test by declaring completion.

---

### AD13 — Complete the library–designer–plan workflow

**Owner:** INTEGRATION · **Scope:** beta · **Relative size:** L

**Prerequisites:** AD05, AD07, AD12  
**Exclusive lock groups:** library, plan-navigation. Exact file leases are still required.

#### User or delivery outcome

An authored object can be reused, edited or duplicated without losing plan context or creating ambiguous changes.

#### Entry points to inspect

- `src/presentation/library/`
- `src/presentation/designer/AssetDesignerView.ts`
- `src/presentation/designer/AssetDesignerContext.ts`
- `src/plugin/ (existing asset navigation/composition seams)`
- `Existing asset placement and duplication commands`

These are investigation/ownership entry points, not blanket edit permission. Resolve actual files and leases in AD00/dispatch; proposed files are not claimed to exist.

#### Implementation work

1. Implement library → designer → Use in plan and plan → Edit shared asset → return, preserving subject IDs and view context.
2. Use in plan continues into the real placement flow; where no plan is open, offer the existing picker. Cancel creates no placement.
3. Show which editable plans use the definition before impactful changes. Do not introduce an unapproved publish/draft state machine over autosave.
4. Offer Duplicate as new asset, copying valid geometry/metadata with new asset identity and remapped internal identities as required.
5. Keep references correct across renamed/moved library notes and missing assets. Invalidate thumbnails/plan views on relevant asset updates.
6. Coordinate multi-resource duplication failure recovery and historical consumers with AD14.

#### Acceptance criteria

- [ ] A measured preset reaches a real plan at its canonical size and orientation.
- [ ] Returning to the original plan preserves selection/viewport as supported by the host state contract.
- [ ] Editing a shared definition has explicit usage scope; a duplicate does not change the original.
- [ ] No asset ID, reference or quantity link points to an orphan after cancel/failure.
- [ ] Graphic parts never become independent purchasable assets automatically.
- [ ] Unsupported mobile navigation follows the actual platform gate instead of opening a broken designer.

#### Required verification

- End-to-end library/create/design/place/edit/duplicate round-trips.
- Two projects sharing a definition; verify intentional live update and independent duplicate.
- Failure after note creation/before sidecar save; retry and external deletion tests.

#### Handoff and integration gate

Use [TASK-REPORT.md](./templates/TASK-REPORT.md). Record exact base/candidate/integrated commits, contract revision, files changed, tests and exit codes, acceptance coverage, screenshots where relevant, and all verification not performed. Apply [DECISIONS.md](./contracts/DECISIONS.md) and the task-specific requirements above.

No task is verified until its actual integration wiring and relevant consumers pass the required checks. The worker cannot waive missing dependencies, future-schema refusal, negative cases or a real-host test by declaring completion.

---

### AD14 — Protect historical plans and honest export behavior

**Owner:** INTEGRATION · **Scope:** beta · **Relative size:** L

**Prerequisites:** AD05, AD13  
**Exclusive lock groups:** revisions, exports. Exact file leases are still required.

#### User or delivery outcome

Asset edits cannot silently alter a plan that the product claims is frozen or issued.

#### Entry points to inspect

- `docs/requirements/Plan revisions.md (resolve current implementation in AD00)`
- `Current plan approval/revision/export consumers`
- `src/application/queries/GetAssetDesign.ts`
- `Existing asset/revision persistence ports`

These are investigation/ownership entry points, not blanket edit permission. Resolve actual files and leases in AD00/dispatch; proposed files are not claimed to exist.

#### Implementation work

1. Resolve actual shipped revision capability. Extend its snapshot/version-pinning mechanism where it exists; do not invent an independent designer revision database.
2. Capture all render-relevant asset state: footprint, graphic elements, groups where meaningful, clearance, placement point, facing and descriptive height, plus stable source identity.
3. Ensure a frozen consumer does not re-read mutable catalogue geometry or mutable export-affecting metadata on reopen/export.
4. Where freezing is not implemented, explicitly gate any unsupported “approved/frozen” handover claim and document the dependency; a live draft preview must say it is live.
5. Test deletion/renaming of the live definition and older revision data, not just edits to the main polygon.
6. Provide rollback/recovery instructions aligned to current revision and sidecar schemas.

#### Acceptance criteria

- [ ] For every shipped frozen/issued workflow, edit the live asset and prove the historical render/export remains reproducible.
- [ ] Changes to anchor, facing, graphics, clearance or height cannot bypass the preservation rule.
- [ ] Where no frozen workflow exists, no new UI promises one and the explicit capability gate has tests.
- [ ] Draft live-reference behavior remains distinct and continues to work.
- [ ] Existing exports report unsupported geometry/data rather than silently dropping content.
- [ ] Recovery does not rely on a thumbnail as the only surviving object definition.

#### Required verification

- Freeze → edit every asset attribute → reload/export → compare stored geometry and supported deterministic outputs.
- Delete/move current definition and render the frozen state.
- Test capability-gated unimplemented revision paths separately from real frozen-state tests.

#### Handoff and integration gate

Use [TASK-REPORT.md](./templates/TASK-REPORT.md). Record exact base/candidate/integrated commits, contract revision, files changed, tests and exit codes, acceptance coverage, screenshots where relevant, and all verification not performed. Apply [DECISIONS.md](./contracts/DECISIONS.md) and the task-specific requirements above.

No task is verified until its actual integration wiring and relevant consumers pass the required checks. The worker cannot waive missing dependencies, future-schema refusal, negative cases or a real-host test by declaring completion.

---

### AD15 — Validate the complete custom-object workflow

**Owner:** QA · **Scope:** beta · **Relative size:** M

**Prerequisites:** AD09, AD10, AD11, AD12, AD13, AD14  
**Exclusive lock groups:** integrated-e2e. Exact file leases are still required.

#### User or delivery outcome

Demonstrate the promised product journey on the integrated branch rather than isolated components.

#### Entry points to inspect

- `Existing browser harness and Playwright scripts`
- `tests/ paths resolved in AD00`
- `docs/tests/cases/`
- `Disposable test-vault fixture`

These are investigation/ownership entry points, not blanket edit permission. Resolve actual files and leases in AD00/dispatch; proposed files are not claimed to exist.

#### Implementation work

1. Run the vanity, bench, repeated-slats and legacy-asset scenarios in ACCEPTANCE-AND-QA.md against integrated code.
2. Cover all S00–S11 states and both themes; verify keyboard alternatives, compact panes, error recovery and cross-leaf behavior.
3. Compare canonical data before/after each operation, including purchase and plan-calibration invariants.
4. Run a real Obsidian smoke test separately from the browser harness. Capture host navigation, remount/rebind and leaf cleanup behavior.
5. Return defects with reproductions, expected/actual behavior, commit, fixtures and severity; re-run impacted scenarios after fixes.

#### Acceptance criteria

- [ ] Every claimed capability is reached from a real visible control in the running plugin or is explicitly not yet verified.
- [ ] Whole workflow passes on the exact integration SHA, not merely individual task branches.
- [ ] No unresolved data-loss, scale, incorrect-save, frozen-state or unreachable-control defect remains.
- [ ] Test evidence separates browser harness automation, unit tests, visual review and real-vault manual execution.
- [ ] Screenshot approval never substitutes for geometry, persistence or failure-path assertions.

#### Required verification

- Execute the complete acceptance matrix and record pass/fail/not-run.
- Run npm run check and npm run audit under the repository environment.
- Re-test post-merge fixes with a clean disposable vault and existing migrated fixtures.

#### Handoff and integration gate

Use [TASK-REPORT.md](./templates/TASK-REPORT.md). Record exact base/candidate/integrated commits, contract revision, files changed, tests and exit codes, acceptance coverage, screenshots where relevant, and all verification not performed. Apply [DECISIONS.md](./contracts/DECISIONS.md) and the task-specific requirements above.

No task is verified until its actual integration wiring and relevant consumers pass the required checks. The worker cannot waive missing dependencies, future-schema refusal, negative cases or a real-host test by declaring completion.

---

### AD16 — Harden, document and release the asset-designer beta

**Owner:** QA · **Scope:** beta · **Relative size:** M

**Prerequisites:** AD15  
**Exclusive lock groups:** release, quality-config. Exact file leases are still required.

#### User or delivery outcome

Deliver a bounded beta with evidence, recovery guidance and no hidden unfinished controls.

#### Entry points to inspect

- `Existing CI/test/harness configuration (integrator-owned)`
- `RELEASING.md`
- `docs/tests/`
- `docs/requirements/Asset designer.md`
- `Current user-documentation and changelog paths`

These are investigation/ownership entry points, not blanket edit permission. Resolve actual files and leases in AD00/dispatch; proposed files are not claimed to exist.

#### Implementation work

1. Benchmark the defined small/medium/large fixtures, rapid undo chains and repeated leaf open/close. Fix measured bottlenecks rather than adding caches/workers speculatively.
2. Complete accessibility checks: keyboard alternatives, focus visibility/order, accessible names, numeric field errors and reduced-motion behavior where relevant.
3. Run moderated novice tasks against explicit usability targets; record observations and revise confusing interactions.
4. Document creation, composition, precision limits, clearance meaning, live shared edits, revision limitations, supported geometry/export formats and recovery.
5. Prepare changelog, known limitations, migration/backup warning and release checklist. Do not publish, tag or push without the user’s release authorization.
6. Consolidate execution evidence into current repo conventions and mark only proven use cases done.

#### Acceptance criteria

- [ ] All core tasks through AD15 are integrated and verified on the candidate commit.
- [ ] No unresolved critical/high issue remains; lower issues have an explicit disposition.
- [ ] Performance figures name hardware, viewport, fixture size and measurement method.
- [ ] No theme, file-size, test-coverage or static-analysis gate was weakened to pass.
- [ ] Fresh install, legacy upgrade and backup-based recovery are exercised or explicitly block readiness.
- [ ] The release notes accurately describe what is implemented, verified and deferred.

#### Required verification

- Full package gates and security audit; distinguish baseline issues from introduced regressions.
- Performance, leak, keyboard, compact-pane and usability matrix.
- Real-vault upgrade/reopen/recovery tests on disposable data.

#### Handoff and integration gate

Use [TASK-REPORT.md](./templates/TASK-REPORT.md). Record exact base/candidate/integrated commits, contract revision, files changed, tests and exit codes, acceptance coverage, screenshots where relevant, and all verification not performed. Apply [DECISIONS.md](./contracts/DECISIONS.md) and the task-specific requirements above.

No task is verified until its actual integration wiring and relevant consumers pass the required checks. The worker cannot waive missing dependencies, future-schema refusal, negative cases or a real-host test by declaring completion.

---

### AD17 — Add explicit native asset portability after beta

**Owner:** INTEGRATION · **Scope:** post-beta · **Relative size:** L

**Prerequisites:** AD04, AD05, AD13, AD14, AD16  
**Exclusive lock groups:** portability, schema, exports. Exact file leases are still required.

#### User or delivery outcome

Users can transfer an editable asset without confusing a preview image with a native definition.

#### Entry points to inspect

- `Existing import/export services and asset repositories`
- `Current reference-resource handling`
- `Schema and recovery paths from AD04/AD14`

These are investigation/ownership entry points, not blanket edit permission. Resolve actual files and leases in AD00/dispatch; proposed files are not claimed to exist.

#### Implementation work

1. Define a versioned native manifest containing metadata, geometry, identity/remapping policy and optional explicitly selected resources.
2. Export geometry plus allowed resources and a preview; omit unrelated project/private reference content by default.
3. Validate import paths, resource counts/sizes, supported versions, resource types and external references before writing anything.
4. Preview identity collisions and import as a new asset by default; never overwrite an existing definition automatically.
5. Use staged writes with recoverable commit/failure behavior and deterministic ID/reference remapping.
6. Keep SVG/PNG export distinct from editable native packages. Arbitrary SVG import remains a separate security and geometry project.

#### Acceptance criteria

- [ ] Export → import in a fresh test vault preserves editable geometry, placement and intended metadata.
- [ ] No traversal path, unexpected network request or silent overwrite can occur.
- [ ] Cancelled/failed imports leave no apparently valid half-imported asset.
- [ ] Unknown future versions and unsupported resources are reported before mutation.
- [ ] Only intentionally selected reference resources leave the vault.
- [ ] This task is not auto-started by the beta orchestrator.

#### Required verification

- Round-trip fresh-vault tests and collision remapping.
- Hostile archive/path/resource and partial-write failure tests.
- Validate exported file list for accidental reference/project data disclosure.

#### Handoff and integration gate

Use [TASK-REPORT.md](./templates/TASK-REPORT.md). Record exact base/candidate/integrated commits, contract revision, files changed, tests and exit codes, acceptance coverage, screenshots where relevant, and all verification not performed. Apply [DECISIONS.md](./contracts/DECISIONS.md) and the task-specific requirements above.

No task is verified until its actual integration wiring and relevant consumers pass the required checks. The worker cannot waive missing dependencies, future-schema refusal, negative cases or a real-host test by declaring completion.

## 14. Execution documents and next action

Read [ORCHESTRATION-RUNBOOK.md](./ORCHESTRATION-RUNBOOK.md), [DECISIONS.md](./contracts/DECISIONS.md), [ACCEPTANCE-AND-QA.md](./ACCEPTANCE-AND-QA.md), and [SOURCES.md](./references/SOURCES.md). Start with [the orchestrator prompt](./prompts/00-ORCHESTRATOR.md), which dispatches AD00 before changing production code.
