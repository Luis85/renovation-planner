---
title: Renovation Planner — Projects and project details
version: 0.2
date: 2026-09-05
status: designed
language: en
scope: Product design concept and interaction states
---

# Projects and project details — Guided entry

## 1. Decision and scope
The user selected the third displayed concept: a lean project list and a detail page asking **“What would you like to do next?”**. The visual direction is selected; detailed rules are proposals for validation, not claims of implemented behavior.

The two side-by-side views in the concept image are a comparison. Normally, a project row opens details in the current Obsidian leaf. Another leaf is optional; a permanent two-column master-detail layout is not required.

The audience is private renovators working on a home, apartment, or garden over months. Starting without a floor plan and resuming after a long break are equally important cases.

This document specifies navigation, content, states, components, and validation. It replaces neither editor specifications nor reconciliation against current implementation.

## 2. Sources and precedence
The initial concept used the repository review in this conversation on 2026-09-05:
- [Editor specifications](https://github.com/Luis85/renovation-planner/tree/main/docs/user-experience/renovation-planner-editor-specs): Obsidian as design system, progressive disclosure, consistent entities, access without canvas.
- [Home design specification](https://github.com/Luis85/renovation-planner/blob/main/docs/user-experience/renovation-planner-home-DESIGN-SPEC.md): launcher, search, Resume, not a portfolio; includes 2026-09-04 changes.
- [Workspace UXD](https://github.com/Luis85/renovation-planner/blob/main/docs/user-experience/renovation-project-workspace-UXD.md): long-term journey, start without plans, contextual navigation. Older portfolio wording/metrics are not current approval.
- [ProjectDetail.vue](https://github.com/Luis85/renovation-planner/blob/main/src/presentation/views/ProjectDetail.vue): header, plans, project asset prices, additive read warnings.
- [ProjectDetailState.vue](https://github.com/Luis85/renovation-planner/blob/main/src/presentation/views/ProjectDetailState.vue): loading, missing project, navigation, independent prices.
- [PlanDto.ts](https://github.com/Luis85/renovation-planner/blob/main/src/presentation/read-models/PlanDto.ts): actual project and plan projections.

The subsequent [repository reconciliation](implementation/repository-reconciliation-and-backlog.md) pins its evidence to a commit. Explicit user decisions take precedence, followed by newer product decisions, editor contracts, and older concepts. Selected imagery does not approve every generated label. Project documentation is English; UI localization includes English and German.

## 3. Mental model
| Surface | User question | Responsibility |
| --- | --- | --- |
| Projects | Which renovation do I want to open? | Find, distinguish, open, resume, create |
| Project details | What do I want to do in this renovation? | Orientation, entry paths, direct access, context |
| Plan editor | What is here and what should change? | Spatial planning and associated renovation information |
| Project note | What do I want to achieve and record? | Goals, questions, free description in the vault |
| Project prices | Which prices apply here? | Project-specific unit prices, not budget overview |

Project remains the domain entry point. Rooms and plans are not synonyms: conceptually a room may exist without a drawing, and a plan may contain several rooms. Do not later rename a plan list “Rooms” without domain changes.

## 4. Core journeys

### A. New project without a plan
1. New project opens the existing creation form.
2. Name is the central input; required technical values use sensible defaults. No mandatory multi-step wizard.
3. Successful creation opens the new project's details using the returned ID.
4. Primary entry: Describe your renovation → Open project note.
5. Create first plan remains visible with a short explanation. Having no plan is not an error.
6. Returning retains the same project.

Use the ordinary project note in the first increment. A structured goals/rooms wizard is a separate extension.

### B. Deliberately open an existing project
1. Filter the list and activate a project row.
2. Details show name, status, currency, and three understandable entry paths.
3. Existing plans appear directly below, expanded by default.
4. Opening a plan targets its exact project and plan.
5. Returning remains possible through navigation without switching renovations.

### C. Resume work
1. Resume names its target before activation, for example “Home renovation · Ground floor”.
2. Validate against successfully read data.
3. Valid plan: open editor. Existing project with a confirmed missing last plan: explained project fallback.
4. Read failure: show the error and permitted next action, not a deletion claim.
5. Reliably missing project: keep the overview accessible; never silently jump elsewhere.

## 5. P00 — Project overview
**Job:** Find a project or resume work.

Order: title/New project → search and matches → optional Resume → active projects → completed disclosure. Preserve New asset and Asset library access.

Rows show name, domain status, plan count, and currency. An available last-worked date may be absolute. Long names wrap or truncate accessibly. Status remains understandable as text.

- Project rows always open details.
- Resume opens validated last context; adjacent Open project remains distinct.
- Search is immediate. No matches offers deliberate creation with the search text prefilled; only submission creates.
- Search reveals matching completed projects without changing the underlying group preference.
- No autofocus on leaf opening; preserve existing keyboard model and Obsidian history.
- No cross-project budgets, progress percentages, or plan thumbnails.
- A truly empty list has exactly one primary creation action. All-unreadable is not “No projects yet”.

## 6. P01 — New project details
**Job:** Take a useful first step without prior expertise.

Retain header: All projects, name, status, currency, note access.

| Entry | Explanation | Action |
| --- | --- | --- |
| Describe your renovation | Record what should change and which questions remain. | Open project note — primary |
| Start with a plan | Draw a floor plan or use an available reference. | Create first plan — secondary |
| Set project prices | Add your own prices when you know them. | View prices — understated |

Say once: “You can start with a note. A floor plan is optional.”

Use existing plan creation. Import/reference preparation follows editor contracts; do not promise direct project-form import. No duplicate large empty card below the same creation action. A compact empty plan row is sufficient. Prices are not a required setup step.

## 7. P02 — Active project details
**Job:** Continue directly after brief orientation.

Retain P01 header and a stable order:
1. Continue with a plan: name the valid last plan. Otherwise Choose a plan focuses the list, never picks arbitrarily.
2. Describe your renovation: open project note.
3. Set project prices: open price section.

Expanded plans follow. Rows open editor; New plan is secondary at the section heading. The full price list is not permanently below plans. View prices opens a section of this project with **Back to project**. This is a proposed restructuring of an existing capability.

### Hide guidance
Hide getting-started guidance removes explanations only. Header, plans, note, and compact price access remain. Show guidance is discoverable. Visibility is leaf-session UI state, not domain status.

No automatic hiding after an assumed number of sessions. Background updates do not move focus or actions being used. Change a suggested entry on reopening or after a completed deliberate action.

## 8. P03 — Resume and context
Open project and Resume keep the same meaning everywhere.

| Saved context | Reliable result | Behavior |
| --- | --- | --- |
| Project + plan | Both present | Open plan editor |
| Project + plan | Project present, plan absent | Details with missing-last-plan explanation |
| Project only | Present | Details |
| Project | Absent | Overview/unavailable state with explicit return |
| Any | Check failed | Read error; retain context |
| None | No saved value | No Resume entry |

Project/plan identity is sufficient for the first increment. Selection, perspective, and viewport restoration are conditional on reliable editor support.

Saving, attempting to open, and successful resumption are different events. The reconciliation found that current code records opening intent; a successful-opening contract remains an explicit implementation spike. Do not label failed attempts as successful work. No per-project history or timestamp is implied by the current global context.

## 9. P04 — Project prices
**Job:** Maintain project-specific unit prices.

Identify project and currency; explain catalogue versus project price. Retain editing and clearing. A project price never changes the shared catalogue.

No totals without quantities and reliable aggregation, no implicit currency conversion. Input errors and write conflicts retain input and use existing domain error mapping.

Proposed interaction: local Apply/Cancel instead of blur writes. Distinguish draft, saved value, and usable price. A first draft has no Clear action. Keep orphan/unreadable override cleanup. Omit units unless a verified projection supplies them. Check foreign-currency source rules against the existing resolver.

## 10. Complete state matrix
| State | Presentation | Next action |
| --- | --- | --- |
| Project list loading | Calm loading, no false zero | Wait |
| List truly empty | Explanation and one creation action | New project where supported |
| Search no matches | Retain text and reset/create options | Adjust or prefilled creation |
| Partially readable list | Valid projects plus warning | Open readable item/use supported recovery |
| Project loading | Reliable known context and loading | Wait; no duplicate creation |
| Project without plans | P01, not error | Note or first plan |
| Some plans unreadable | Readable plans plus warning | Open readable plan |
| All plans unreadable | Read warning, not empty claim | Supported recovery or deliberate creation |
| Prices unreadable | Price-region error only | Plans remain usable |
| Project reliably gone | Explanation and All projects | Deliberate return, no loop |
| Creation failed | Retained input and specific error | Correct or retry where allowed |
| Last plan missing | P03 explanation | Choose another plan |
| Saved, display stale | Retain trustworthy information and refresh notice | Refresh, not duplicate write |
| Completed project | Status visible, content accessible | Open; status changes use existing path |

Retry requires existing policy support. No decorative retry button for a session failure.

## 11. Obsidian, narrow layouts, and accessibility
- No plugin brand, login, or profile navigation. Use semantic Obsidian colors/typography, including custom themes.
- Leaf width, not just window width, drives layout.
- Stack title, metadata, and actions when narrow; entry paths are vertical. No mandatory horizontal navigation.
- Validate 460 px and approximately 360 px. Editor capabilities follow editor/device contracts.
- Narrow desktop editing and mobile read-only scope are separate.
- Use a coherent content scroll area; a compact sticky header must not crowd short screens.
- Keyboard reachability, visible focus, accessible names, adequate touch targets, and non-color-only status.
- On return, restore search, scroll, and ID-based focus; fall back to the filter if the row disappeared.
- No independent navigation-history stack duplicating Obsidian.

## 12. Components and reuse
| Component | Responsibility | Starting point |
| --- | --- | --- |
| ProjectList / ProjectRow | Selection and readable facts | Existing components |
| ProjectFilter | Search and match status | Existing component |
| ContinueRow | Unambiguous named target | Existing component |
| ProjectHeader | Identity, return, note | Evolve ProjectDetail |
| ProjectEntryGuidance | Three optional entries | New presentation component |
| ProjectEntryAction | Title, benefit, action | Small reusable presentation component |
| PlanList | Direct plan access | Existing component |
| ProjectPricesSection | Prices in context | Reuse AssetPriceList |
| EmptyState / Warning / Failure | Regional feedback | Existing state/error policies |

Presentation receives data and emits intents. Persistence, resolution, and navigation remain in application/view boundaries. New layout is not a reason for another data model.

## 13. Reconcile before implementation
| Information | Reviewed availability | Consequence |
| --- | --- | --- |
| Project name/status/currency/count/last worked | ProjectSummaryDto | Existing query, correct unknown handling |
| Plan name/ID | PlanSummaryDto | Direct plan list |
| Per-plan date | Not in reviewed summary | Omit or deliberately extend query |
| Description/dates/budget | Some domain fields; not proof of UI/persistence | Verify mapper/schema/query separately |
| Prices | Existing list/write paths | Restructure, do not rebuild |
| Last context | Project/plan path in views | Check success signal and fallback |
| Rooms/work/document aggregates | Long-term concepts | Separate future increments |
| Progress/project-budget aggregation | Not supplied by summary | No invented metrics |

Inventory current domain, frontmatter, mappers, queries, commands, navigation, and saved UI context. Map every new display to a read model. For gaps, decide to omit, project, or build a separate domain increment. The linked reconciliation records findings and remaining blockers; it does not claim a completed full-system audit.

## 14. Corrections to the selected image
1. Show currency clearly as EUR; “Project prices” is not a currency.
2. Last worked does not mean last opened.
3. No per-plan modification/open dates without evidence.
4. Avoid duplicate prominent note actions; header stays secondary.
5. Active plans are visible; collapsing is optional.
6. Side-by-side composition is not mandatory navigation.
7. Keep existing library access and obey read-only mobile scope.
8. English documentation governs; original images remain German localization references.

## 15. Acceptance and user evaluation
Proposed validation criteria, not measured results:
- New users reach a meaningful note action without a floor plan and explain that plans are optional.
- Returning users can predict Resume's destination.
- Open project never unexpectedly opens the editor.
- Missing last plan gives an understandable state retaining project access.
- Price failures do not prevent plan opening.
- All supported core actions fit a 460 px leaf without horizontal scroll.
- Check light/dark/custom themes, English, and long German project names.
- Hidden guidance can be restored without lost core access.

Tasks: start a garden project without a plan; resume ground-floor work after two weeks; deliberately open another project; change a price and return; recover from a deleted last plan. Observe first click, detours, Open/Resume confusion, price understanding, and need for explanation. Small formative sessions with about five relevant users offer signals, not statistical validation.

## 16. Design and delivery sequence
1. Individual P00–P04 and dark/narrow mockups: included in this package.
2. Validate list → details → editor and note/price return paths in an interactive prototype: outstanding.
3. Finish data reconciliation before PBIs become ready.
4. Per-screen specifications with images, use cases, interactions, components, and acceptance: included.
5. First slice: header, optional guidance, visible plans, clear navigation using existing capabilities.
6. Next: prices and robust Resume with read-failure/gone variants.
7. Later: rooms, work, budget, and documents under separate domain contracts. Three entries are extensible, not permission for a wall of features.

