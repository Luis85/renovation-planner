# Renovation projects: Repository reconciliation and backlog

Date: 2026-09-05. Baseline: main at commit `7b6bb2b27b9ae2aaccba7e90009098a39ad43207` (08:20:04 UTC).

English revision of the reconciliation supplement to renovation-planner-project-specs, especially WP-00. Selected direction: optional guided project details asking “What would you like to do next?”. This is a source-grounded backlog proposal, not implementation or evidence of passed runtime tests. No issues, commits, or pull requests were created.

## Outcome

Most of the direction can use existing queries, commands, and host views. This scope proposes no new Project frontmatter version. It requires clearer UI states/navigation and targeted read-model/adapter changes. The largest risks are Resume, explicit saving, and asynchronous price refresh.

Target contracts below are implementation proposals, not silent replacements of existing decisions. In particular, changing blur commit to explicit Apply must be recorded as an interaction decision before implementation. Documentation is English; UI has English and German localization.

## 1. Verified implementation and design consequences

| Area | Present in source | Design consequence |
| --- | --- | --- |
| Device scope | PRODUCT: desktop-first, mobile read-only [S1] | Narrow desktop can edit; mobile gets no implicit writing scope |
| Project persistence | Name, status, description, start, target completion, currency; schema 1 with revision [S2] | No new schema for launcher/guidance. Budget, contingency, location description are not persisted by this mapper |
| Project display | Summary: ID, name, status, currency, library overlap, plan count, lastWorked [S3] | Reuse facts; description/dates need projection. No construction percentage derived from status |
| Plan list | PlanSummary: ID and name [S3] | No invented per-plan dates, areas, previews |
| Overview | Filter, active/completed groups, roving focus, Resume, asset creation, library access [S4] | Preserve functional foundation; images must not remove library/keyboard paths |
| Navigation | Only projectId in view state; project changes remount Vue/Pinia [S5] | Filter/focus/scroll do not automatically survive; retain UI state outside remounted tree |
| Resume | One global projectId/planId pair, local versioned storage, no history [S6] | No last-plan-per-project promise or timestamp derived from it |
| Resume resolution | Query error and absent plan both become gone; entry disappears [S7] | Distinguish failure, missing target, and incomplete indexing |
| Open project | Writes planId:null before navigation [S7] | Do not inadvertently discard a plan reference needed by the design |
| Open plan | Details remember plan before openPlan; adapter returns Promise<void> [S8] | This proves intent, not successful opening; success semantics need an explicit outcome |
| Create project | Command returns saved project/ID; form emits input values; root reloads list [S9] | Pass the returned ID to direct entry; never find it by name |
| Price data | Readable catalogue assets plus overrides for orphan/unreadable assets; ID/version on overrides [S10] | Project prices are not filtered to installed materials. Retain exception rows |
| Price row | Existing draft/canonical values, expected version, queue, errors; blur and Enter commit [S11] | Apply is a behavior change, not restyling; do not globally change shared hook consumers |
| Money format | createMoney accepts canonical decimal strings with a dot [S12] | German decimal comma requires UI parsing, not storage-format change |
| Price refresh | Separate error state and request tickets; commit then reloads [S13] | Distinguish write failure from failed refresh after successful write |

### Data and state authority

| Information | Authority | Avoid |
| --- | --- | --- |
| Project identity/domain fields | Repository/frontmatter | Second authoritative UI copy |
| Displayed list facts | Query/read model | Importing missing facts from mockups |
| Project price | Persisted, versioned override | Presenting draft as used price |
| Price source | Derivation under existing domain rules | Silent currency conversion |
| Current project/subsection | Obsidian view state | Independent router/history stack |
| Search/groups/focus/scroll | Leaf-local UI snapshot | Project frontmatter or one global value for all leaves |
| Last target | Existing local ContinueContext | Inferring edit time or per-project history |

## 2. Clarifications to the design package

1. P06/P07 mean narrow layouts, not mobile writing. Remove mobile price editing from prior acceptance; test narrow desktop editing and mobile reading separately.
2. P00 retains Asset library as well as New asset. No new N/slash shortcuts based solely on images.
3. After successful creation, P01 opens the new project's details. Do not automatically create a plan or substitute opening the note.
4. P02 is useful without a plan. Plan creation, note, and prices are independent paths, not a setup checklist or progress calculation.
5. P03 offers retry for a temporary read problem. Missing plan permits Open project; missing project permits return to overview. No automatic substitute plan.
6. P04 uses explicit per-row Apply/Cancel. Blur may validate but does not write. Cancel cannot undo a dispatched operation.
7. Offer Remove project price only for a persisted override. Cancel discards a first draft. Orphan/unreadable rows remain identifiable, with existing override removal available.
8. Do not invent units: the row DTO lacks a unit field. Omit initially or add a projection from a verified asset source separately.
9. A catalogue price in another currency is not automatically usable in the project. Verify source/display against the existing price resolver; no FX feature.
10. Hidden guidance persists only within the current leaf session in this slice. A durable project preference is a separate decision, not an incidental domain property.

## 3. Epic and delivery order

Epic: **Start and continue renovation projects**.

| Feature | PBI | Prerequisite | Priority |
| --- | --- | --- | --- |
| Overview | PBI-01 Find a project and return with my search context | UI-state contract | 1 |
| Project details | PBI-02 Start a newly created project immediately | PBI-01 | 1 |
| Project details | PBI-03 Freely choose my next action | PBI-02 | 1 |
| Resume | PBI-04 Resume my last plan work deliberately | openPlan outcome contract | 1 |
| Resume | PBI-05 Continue when my last target is unavailable | PBI-04 | 1 |
| Project prices | PBI-06 Understand my project's price sources | PBI-03 | 2 |
| Project prices | PBI-07 Deliberately apply or discard my own price | PBI-06, commit decision | 2 |
| Project prices | PBI-08 Remove a saved project price | PBI-07 | 2 |
| Resilience | PBI-09 Continue safely after price errors or parallel changes | PBI-07/08 | 2 |
| Device scope | PBI-10 Read projects in narrow views and on mobile | Respective domain PBIs | Cross-cutting |

IDs are local proposals, not GitHub issue numbers. Lifecycle status: **scoped**; technical refinement and estimation remain outstanding. This replaces the earlier generic “Refinement” label with the project's lifecycle vocabulary. Proposed contracts and technical entry points are concrete; estimates, team acceptance, and specified spikes are pending. Quality criteria apply from the first slice.

Lifecycle: new → designed → scoped → tech refined → estimated → ready → in progress → implemented → tested → done → shipped; sunset/deferred as applicable.

## 4. PBIs, acceptance, and tasks

### PBI-01 — Find a project and return with my search context
**Feature:** Overview. **Status:** scoped. **Screens:** P00/P06.

**Use case:** A renovator searches for a project, opens details, and returns to the previous search context. Prerequisite: loaded project list or an explicit error state.

**Flow:** Enter search → Open project → Use details → Return. Open project remains distinct from Resume and Open note.

**Acceptance criteria:**
- Same-leaf return preserves search, completed-group expansion, and scroll; focus returns to the selected project ID.
- If that row disappeared or no longer matches, focus moves to the filter, not an unrelated project.
- Leaves do not share search state. No matches is distinct from an empty vault.
- Existing roving focus, filtering, library, and asset-creation paths remain accessible; no new global shortcuts.

**Tasks:** Define leaf-local snapshot; emit ProjectList changes; restore by ID after loading; extend view-state/remount tests; reconcile P00/P06.

**Code:** ProjectList.vue, RenovationProjectView.ts, ViewRoot.vue [S4/S5/S7]. No schema change. Restart persistence is outside this PBI.

### PBI-02 — Start a newly created project immediately
**Feature:** Project details. **Status:** scoped. **Screen:** P01.

**Use case:** A renovator creates a project and enters its details immediately after confirmed saving.

**Acceptance criteria:**
- Success navigates exactly once to the command's returned ID, even with duplicate project names.
- Cancel creates nothing and does not navigate. Validation/write errors retain the form/input; double submission creates no duplicate.
- Success requires or creates no floor plan.
- If the file disappears before the first detail read, show the regular missing state rather than creating again.

**Tasks:** Pass saved ID from dispatch to root; extend dialog result locally where possible; retain busy/error handling; test success/cancel/failure/double submission.

**Code:** CreateProject.ts, NewProjectForm.vue, ViewRoot.vue [S9]. Test entry: viewRootCreateProject.test.ts. No name-based lookup or new required fields.

### PBI-03 — Freely choose my next action
**Feature:** Project details. **Status:** scoped. **Screens:** P02/P05/P07.

**Use case:** A renovator opens a project and freely chooses plan work, project note, or prices.

**Acceptance criteria:**
- Without plans, note and prices remain useful; with plans, specific names and direct opening remain visible.
- Guidance can be hidden and restored in the same leaf session; core actions do not disappear.
- Open project, Open project note, and Open plan remain distinct.
- Unreadable plans are not concealed as “No plans yet”. Late previous-project responses cannot overwrite current state.

**Tasks:** Compose ProjectDetail; bind existing NewPlanForm/note/plan seams; add session guidance visibility; test empty/active/unreadable variants; maintain English/German copy.

**Code:** ProjectDetailState.vue, ProjectDetailStore.ts, PlanDto.ts [S3/S8/S13]. No artificial progress or persistent onboarding checklist.

### PBI-04 — Resume my last plan work deliberately
**Feature:** Resume. **Status:** scoped. **Screens:** P00/P02.

**Use case:** A renovator uses Resume to open the last confirmed target.

**Proposed contract:** One global target is sufficient. Opening the same project's details preserves its plan reference. Opening another project makes it the project-only target. No hidden map of every project's history.

**Acceptance criteria:**
- Open project opens details; Resume with valid planId opens the explicitly named plan.
- Confirmed plan opening updates the target; failed opening does not overwrite a previous valid target.
- Switching projects never inherits the previous project's planId.
- No editing timestamp is shown from ContinueContext.

**Tasks:** Inspect and explicitly define openPlan/revealPlanEditor outcome; define intent versus success; consolidate write sites; test same/cross-project and failure paths.

**Code:** ContinueContext/Store, ViewRoot, ProjectDetailState, OpenSeams [S6–S8].
**Ready blocker:** Spike must define whether success means “leaf opened” or “plan loaded successfully”. Leaf-only success must not claim successfully loaded/resumed work.

### PBI-05 — Continue when my last target is unavailable
**Feature:** Resume. **Status:** scoped. **Screen:** P03.

**Use case:** A renovator activates Resume while plan/project availability is uncertain.

**Acceptance criteria:**
- Incomplete indexing never produces a final deletion claim.
- Missing plan with existing project offers an explained project path, not an automatic substitute plan.
- Missing project offers overview. Read/access failure retains target and permits retry when error policy allows.
- A new click revalidates; failure between validation and opening uses the opening outcome contract.
- Old requests cannot mark a newer target missing.

**Tasks:** Replace gone sentinel with explicit resolver states; model index/query/missing conditions; add retry/fallback/focus; test races/deletion.

**Code:** ViewRoot.vue and ContinueContextStore [S6/S7]. Test entry: viewRootContinue.test.ts. No automatic target deletion on transient errors.

### PBI-06 — Understand my project's price sources
**Feature:** Project prices. **Status:** scoped. **Screen:** P04.

**Use case:** A renovator opens a dedicated price section and understands catalogue price, saved project price, and the source usable under domain rules.

**Acceptance criteria:**
- Section identifies current project; Back to project retains overview context.
- Catalogue assets not used in plans are not called installed materials.
- Missing price is not zero; a zero override is a real price.
- Orphan/unreadable assets and currency mismatches are explicit. No invented unit or conversion.
- Price loading errors do not block every project action.

**Tasks:** Add subsection to existing host state, retaining compatibility with projectId-only states; add regional loading/error/empty; verify source projection against domain resolver; add DTO/display tests.

**Code:** ListProjectAssetPrices, ProjectDetailStore, RenovationProjectView [S5/S10/S13].
**Ready blocker:** Confirm usable price rules, including foreign currency, against the existing resolver. Do not invent a second Vue price engine.

### PBI-07 — Deliberately apply or discard my own price
**Feature:** Project prices. **Status:** scoped. **Screen:** P04.

**Use case:** A renovator edits a known asset's price and explicitly decides whether to save.

**Acceptance criteria:**
- Typing and blur produce no write. Apply or Enter dispatches a valid draft once.
- Cancel/Escape before dispatch discards without writing. During write, Cancel is not undo; the affected row is clearly locked.
- Saved/used price stays unchanged until confirmed success.
- German input `12,50` normalizes to `12.50` at the UI boundary; canonical dot input remains accepted. Reject grouping, mixed separators, and negatives; zero remains valid.
- An initial empty draft has no action to remove a nonexistent override.

**Tasks:** Change local row bindings to explicit controls; retain canonical Money model; test parser/validation; retain expected version captured on edit start; integrate dirty navigation.

**Code:** AssetPriceRow.vue, use-field-commit.ts, Money.ts [S11/S12].
**Ready blocker:** Confirm explicit saving as a deliberate deviation from current blur behavior. Do not globally change shared hook semantics.

### PBI-08 — Remove a saved project price
**Feature:** Project prices. **Status:** scoped. **Screen:** P04.

**Use case:** A renovator removes a project-specific override.

**Acceptance criteria:**
- Removal targets the saved override and expected ID/version, not the catalogue asset.
- On success, display the catalogue price only if present and usable; otherwise “No usable price”, never invented zero.
- Orphan/unreadable assets retain Remove while new-price setting is disabled.
- Rejected Clear retains the saved value and explains conflict.

**Tasks:** Reuse Clear command; separate draft cancellation from override removal; test null/zero/orphan/conflict; localize outcome text.

**Code:** AssetPriceRow and commitAssetPrice in ProjectDetailState [S8/S11]. No asset deletion or new persistence.

### PBI-09 — Continue safely after price errors or parallel changes
**Feature:** Resilience. **Status:** scoped.

**Use case:** A renovator saves while sync, another leaf, or an error changes the data state.

**Acceptance criteria:**
- Version conflict triggers no silent retry with a newer version; preserve draft for deliberate reapplication.
- Successful write plus failed refresh reports “Saved; could not refresh the display”, not “Save failed”.
- Retry after refresh failure repeats the read, not the write.
- Internal dirty navigation offers Stay/Discard; pending write does not permit an unnoticed switch.
- Forced host closing is not promised to be interceptable or lossless; inspect and document actual limitations.
- Event bursts/unmount leave no stale responses or extra lasting subscriptions.

**Tasks:** Separate write/refresh UI outcomes; advance snapshot after confirmed write correctly; guard internal routes; spike host closing; test conflict, successful write/failed read, unmount.

**Code:** use-field-commit, ProjectDetailState, ProjectDetailStore [S11/S13].
**Ready blocker:** Define non-interceptable leaf-close behavior without unsupported recovery guarantees.

### PBI-10 — Read projects in narrow views and on mobile
**Feature:** Device scope. **Status:** scoped. **Screens:** P05/P06/P07, narrow P04.

**Use case:** A renovator opens overview, details, and prices in a narrow desktop leaf or mobile device.

**Acceptance criteria:**
- Narrow desktop retains permitted actions without clipping controls.
- Mobile follows documented read-only scope; active price/project creation controls must not suggest unsupported writing. Check actual capabilities before implementation.
- Light/dark/custom themes use host tokens/accent; status is not color-only.
- Per-PBI checks cover long German text, English copy, focus, zoom, screen-reader names, and error association.

**Tasks:** Responsive components, not duplicated behavior; inspect capability entry points; verify theme/zoom/keyboard matrix in host; document image deviations.

**Code:** PRODUCT [S1], existing views. No mobile writing as a side effect of a CSS breakpoint.

## 5. Verification and Ready gate

Existing test files provide entry points; they were not executed here:
- `tests/presentation/views/viewRootContinue.test.ts`
- `tests/presentation/views/viewRootCreateProject.test.ts`
- `tests/presentation/views/renovationProjectView.test.ts`
- `tests/application/queries/listProjectAssetPrices.test.ts`

Each PBI needs relevant automated tests at its seams plus a documented host check. Integration journeys: overview → creation → details → note/plan → return; Resume after deletion/read failure; draft → conflict → deliberate reapplication; successful write → failed refresh.

Ready requires confirmed target contracts, resolved spikes, team-reviewed tasks/dependencies, fixtures, sourced visible facts, and no unsupported saving/recovery promises. Done additionally requires actually passing repository gates, host evidence, and updated specifications.

WP-00 is substantively addressed for the inspected paths, **not fully complete**: price resolver/foreign currency, opening success, host closing, and exact mobile capabilities remain targeted investigations. Historical documentation, the entire editor, and parallel Asset Library design were not fully re-audited.

Recommended first implementation slice: PBI-01 → PBI-02 → PBI-03. Before blocked PBIs, resolve their result/storage contracts rather than adding unrelated product features.

## Sources at the inspected commit

All links below are pinned to the same commit, not moving main.

- S1: [PRODUCT.md](https://github.com/Luis85/renovation-planner/blob/7b6bb2b27b9ae2aaccba7e90009098a39ad43207/PRODUCT.md)
- S2: [src/infrastructure/persistence/mappers/projectMapper.ts](https://github.com/Luis85/renovation-planner/blob/7b6bb2b27b9ae2aaccba7e90009098a39ad43207/src/infrastructure/persistence/mappers/projectMapper.ts)
- S3: [src/presentation/read-models/PlanDto.ts](https://github.com/Luis85/renovation-planner/blob/7b6bb2b27b9ae2aaccba7e90009098a39ad43207/src/presentation/read-models/PlanDto.ts)
- S4: [src/presentation/views/ProjectList.vue](https://github.com/Luis85/renovation-planner/blob/7b6bb2b27b9ae2aaccba7e90009098a39ad43207/src/presentation/views/ProjectList.vue)
- S5: [src/presentation/views/RenovationProjectView.ts](https://github.com/Luis85/renovation-planner/blob/7b6bb2b27b9ae2aaccba7e90009098a39ad43207/src/presentation/views/RenovationProjectView.ts)
- S6: [src/infrastructure/obsidian/plugin-data/continueContextStore.ts](https://github.com/Luis85/renovation-planner/blob/7b6bb2b27b9ae2aaccba7e90009098a39ad43207/src/infrastructure/obsidian/plugin-data/continueContextStore.ts)
- S7: [src/presentation/views/ViewRoot.vue](https://github.com/Luis85/renovation-planner/blob/7b6bb2b27b9ae2aaccba7e90009098a39ad43207/src/presentation/views/ViewRoot.vue)
- S8: [src/presentation/views/ProjectDetailState.vue](https://github.com/Luis85/renovation-planner/blob/7b6bb2b27b9ae2aaccba7e90009098a39ad43207/src/presentation/views/ProjectDetailState.vue)
- S9: [src/presentation/views/NewProjectForm.vue](https://github.com/Luis85/renovation-planner/blob/7b6bb2b27b9ae2aaccba7e90009098a39ad43207/src/presentation/views/NewProjectForm.vue)
- S10: [src/application/queries/ListProjectAssetPrices.ts](https://github.com/Luis85/renovation-planner/blob/7b6bb2b27b9ae2aaccba7e90009098a39ad43207/src/application/queries/ListProjectAssetPrices.ts)
- S11: [src/presentation/views/AssetPriceRow.vue](https://github.com/Luis85/renovation-planner/blob/7b6bb2b27b9ae2aaccba7e90009098a39ad43207/src/presentation/views/AssetPriceRow.vue)
- S12: [src/core/money/Money.ts](https://github.com/Luis85/renovation-planner/blob/7b6bb2b27b9ae2aaccba7e90009098a39ad43207/src/core/money/Money.ts)
- S13: [src/presentation/stores/ProjectDetailStore.ts](https://github.com/Luis85/renovation-planner/blob/7b6bb2b27b9ae2aaccba7e90009098a39ad43207/src/presentation/stores/ProjectDetailStore.ts)
- Supplement: [src/application/commands/project/CreateProject.ts](https://github.com/Luis85/renovation-planner/blob/7b6bb2b27b9ae2aaccba7e90009098a39ad43207/src/application/commands/project/CreateProject.ts)
- Supplement: [src/plugin/renovationProjectOpenSeams.ts](https://github.com/Luis85/renovation-planner/blob/7b6bb2b27b9ae2aaccba7e90009098a39ad43207/src/plugin/renovationProjectOpenSeams.ts)
- Supplement: [src/presentation/composables/use-field-commit.ts](https://github.com/Luis85/renovation-planner/blob/7b6bb2b27b9ae2aaccba7e90009098a39ad43207/src/presentation/composables/use-field-commit.ts)
- Supplement: [src/infrastructure/persistence/dto/projectFrontmatter.ts](https://github.com/Luis85/renovation-planner/blob/7b6bb2b27b9ae2aaccba7e90009098a39ad43207/src/infrastructure/persistence/dto/projectFrontmatter.ts)

