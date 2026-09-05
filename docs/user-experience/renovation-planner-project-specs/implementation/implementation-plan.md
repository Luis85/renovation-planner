# Implementation plan — Projects

## Goal and boundaries
Deliver a coherent increment: Find → Open project → Optional guidance → Plan or note → Predictable return. Existing commands and persistence remain the foundation. Rooms, work packages, budget aggregation, schedules, document aggregates, and portfolio features are outside this slice unless separately validated.

Do not derive binding estimates or story points from mockups. Slice and estimate after code/data reconciliation. An image alone never makes a task ready.

## WP-00 — Consolidate current models and implemented contracts
Mandatory prerequisite for subsequent work. The [repository reconciliation and backlog](repository-reconciliation-and-backlog.md) records the inspected commit, findings, and remaining spikes. Recheck changes since that commit before implementation.

Tasks:
1. Read repository working rules, PRODUCT/PRD/SDD, and recent decisions; reconcile the Home launcher contract with the selected direction.
2. Inventory Project/Plan/AssetPrice entities, schemas, mappers, queries, and commands.
3. Map every visible fact through domain → persistence → query → UI. A domain field alone is not proof of persistence.
4. Verify ProjectSummaryDto/PlanSummaryDto; no per-plan date without a projection change.
5. Inspect Resume: intent or confirmed opening? Distinguish missing, unreadable, and not-yet-indexed.
6. Inspect navigation, remounts, and host history; no second stack.
7. Reconcile existing price blur commit with explicit Apply/Cancel before changing interaction.
8. Verify currency, Clear rules, optimistic concurrency, regional loading, and save-versus-refresh semantics.
9. Coordinate shared price field names/rows with Asset Library design without assuming unconfirmed decisions.
10. Decide each gap explicitly: omit display, extend read model, or separate domain increment. Migrate only when persisted change is necessary.

Deliver: actual/target mapping, decision log, data/navigation contracts, updated use-case slices. Exit: no source-less display or competing persistence/navigation authority. Remaining blockers are explicit in PBIs; WP-00 is not marked complete merely because this package exists.

## WP-01 — Project list and unambiguous navigation
Depends on WP-00. Screens P00/P06.
- Preserve launcher filtering, factual rows, Resume, completed group, and Asset library access.
- Distinguish Open and Resume through intents and tests.
- Retain list state on return; restore focus by stable ID.
- Use narrow multiline composition without duplicate behavior.
- Distinguish empty, unreadable, and filtered-empty lists.
Exit: project selection deterministically opens details; search context survives return.

## WP-02 — Project details and optional guidance
Depends on WP-01. Screens P01/P02/P05/P07.
- Compose ProjectHeader and existing PlanList.
- Derive new/active variants from reliable plan availability.
- Bind existing note, plan creation, and editor paths.
- After project creation, navigate using the command's returned ID.
- Show/hide guidance while preserving compact core entry points; session-only preference.
- Do not infer completion from opening sections.
- Preserve regional errors and focus through layout/data changes.
Exit: projects are useful without plans; active projects provide direct plan selection.

## WP-03 — Robust Resume
Depends on WP-00/WP-01; integrates WP-02. Screen P03.
- Resolve saved context against indexing and read state.
- Define opening intent versus successful result.
- Handle missing plan/project without redirect loops.
- Retain saved context on read failure.
- Ignore stale responses after rapid navigation.
Exit: valid, absent, and unreadable targets produce understandable outcomes.

## WP-04 — Dedicated project price section
Depends on WP-00/WP-02. Screen P04.
- Reorganize existing AssetPriceList and commit/clear paths within the project.
- Separate explicit drafts from saved and usable prices.
- Retain versioned commands; test invalid input, conflict, write failure, and refresh failure.
- Define dirty-navigation protection and actual host leaf-close limitations.
- Implement labelled narrow desktop value pairs and read-only mobile presentation.
- Preserve subscriptions and loader lifecycle; avoid duplicate catalogue reads per event.
Exit: project-specific pricing is conflict-aware with no hidden draft effects.

## WP-05 — Integrated verification and handover
Depends on WP-01–04.
- Run actual repository gates and integrate relevant tests.
- Verify key journeys in the harness and real Obsidian.
- Check default light/dark, custom theme, non-purple accent, English and long German text, zoom, and split leaves.
- Check note/editor return, history, parallel-leaf changes, and file removal.
- Reconcile documentation with delivered behavior and record deviations.
Exit: verification plan executed, risks recorded, no unsupported UI promises.

## Backlog hierarchy
Epic: **Start and continue renovation projects**. Features contain use-case PBIs; tasks sit below PBIs. See the ten detailed PBIs in the [backlog](repository-reconciliation-and-backlog.md).

| Feature | Example use case | Work packages |
| --- | --- | --- |
| Project overview | Find a project and retain search context | WP-00/01 |
| Project overview | Resume my last work | WP-03 |
| Project details | Start without a floor plan | WP-02 |
| Project details | Open a specific existing plan | WP-02 |
| Project details | Hide and restore guidance | WP-02 |
| Project prices | Apply my own unit price | WP-04 |
| Project prices | Remove a saved project price | WP-04 |
| Recovery | Continue after the last plan disappears | WP-03 |

Tasks under each PBI cover domain reconciliation, UI, query/command integration, tests, and documentation. Dark/narrow quality is cross-cutting acceptance, not an optional later phase.

## Definition of Ready
- Actor, trigger, outcome, and alternatives are explicit.
- Screens and states are linked.
- Data source and command paths are verified in current code.
- Navigation, error categories, and draft/persistence boundaries are decided.
- Acceptance is testable automatically or with a documented live-vault scenario.
- Schema/migration need is explicit.
- The implementation team has reviewed effort, dependencies, and risks.

Use the project lifecycle; this backlog is scoped and awaiting technical refinement/estimation, not ready. Recommended first slice: PBI-01 → PBI-02 → PBI-03.

