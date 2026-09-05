---
title: User journey source coverage
type: user-journey-coverage
status: documented
version: 1
language: en
updated: 2026-09-05
---

# User journey source coverage

This audit maps described user flows to the [38-journey catalogue](README.md). It covers the explicit journey lists and scenarios in the concept sources below, plus the P00–P07, M00–M17, and AL00–AL11 screen families. It verifies documentation coverage, not implementation or user-test success.

## Method and findings

Read explicit journeys, flows, prototype tasks, entry/interaction/exception sections, and the surrounding contracts. Resolve repeated UXD text to one journey; retain differing historical behavior as an archived concept. A journey is a user goal with an entry, meaningful actions, and an outcome. A button, theme variant, schema field, or unvalidated research job is not by itself another journey.

The follow-up completeness check found gaps in the initial screen-led extraction: existing-room inspection/editing, floor/layer comparison, single-entity deletion, precision-on-demand estimation, problem investigation, decision lifecycle, and the historical wizard/golden path. These are now UJ-E14–E16 and UJ-W07–W10. Door/window insertion is UJ-E13; free-shape room creation is an explicit UJ-E02 alternative. The catalogue now has 38 journeys rather than the initial 30.

## Projects

Source: [interaction concept](../renovation-planner-project-specs/interaction-concept.md), [shared states](../renovation-planner-project-specs/states-and-navigation.md), and the [project screen index](../renovation-planner-project-specs/README.md).

| Source flow | Journey files | Treatment |
| --- | --- | --- |
| §4A: new project without a plan | [UJ-P01](start-project-without-plan.md) | Dedicated journey; note-first entry. |
| §4B: deliberately open an existing project | [UJ-P02](find-and-open-project.md) | Dedicated journey, including search and return. |
| §4C: Resume and missing/read-failed destinations | [UJ-P03](resume-and-recover-context.md) | Dedicated journey; project-only and no-remaining-plan alternatives. |
| §9 / P04: set, edit, cancel, remove project price | [UJ-P04](maintain-project-prices.md) | One price-management goal with explicit alternatives. |
| P05–P07: dark and narrow states | [UJ-P01](start-project-without-plan.md), [UJ-P02](find-and-open-project.md), [UJ-P03](resume-and-recover-context.md), [UJ-P04](maintain-project-prices.md) | Variants of the same goals; shared constraints in the index. |

## Editor screens

Source: [M00–M17 screen index](../renovation-planner-editor-specs/README.md).

| Source flow | Journey files | Treatment |
| --- | --- | --- |
| M00: selected-room overview and direct manipulation | [UJ-E14](inspect-and-edit-room.md), [UJ-E04](capture-existing-room.md), [UJ-E05](define-planned-change.md), [UJ-E06](plan-room-work.md), [UJ-E07](plan-materials-and-shopping.md), [UJ-E08](estimate-and-review-costs.md), [UJ-E09](attach-and-find-evidence.md) | Inspect/edit journey plus contextual detail destinations. |
| M01: orient, select, fit, layers and reference lock | [UJ-E15](navigate-and-compare-plan.md), [UJ-E14](inspect-and-edit-room.md) | Navigation/inspection goals, not only a creation prerequisite. |
| M02: Add menu | [UJ-E02](create-and-restore-room.md), [UJ-E03](draw-and-adjust-walls.md), [UJ-E13](insert-wall-opening.md) | Creation entry; unelaborated catalogue nouns do not supply a full flow. |
| M03: add room; exact entry; cancel; keep adding | [UJ-E02](create-and-restore-room.md) | Alternatives within room creation. |
| M04: wall chain, closed-room detection, undo point | [UJ-E03](draw-and-adjust-walls.md) | Dedicated wall-layout journey. |
| M05–M06: start paths and reference prepare/scale/review | [UJ-E01](prepare-first-plan.md) | One acquisition goal with no-plan and reference branches. |
| M07: wall inspection, adjustment, change, deletion | [UJ-E03](draw-and-adjust-walls.md), [UJ-E05](define-planned-change.md), [UJ-E16](delete-spatial-entity.md) | Inspection/editing, renovation intent, and impact-aware deletion. |
| M08: capture Existing details and evidence | [UJ-E04](capture-existing-room.md), [UJ-E09](attach-and-find-evidence.md) | Incremental survey and contextual evidence. |
| M09: Planned details, decisions, required work | [UJ-E05](define-planned-change.md), [UJ-W09](evaluate-and-record-decision.md), [UJ-E06](plan-room-work.md) | Planned workflow; historical decision lifecycle remains labelled. |
| M10: work, dependencies, responsibility, schedule entry | [UJ-E06](plan-room-work.md), [UJ-W03](schedule-renovation-work.md) | Room work and broader scheduling. |
| M11: multi-selection and shared/destructive action | [UJ-E12](apply-shared-spatial-change.md) | Dedicated batch journey. |
| M12: material needs, waste, purchased quantity, shopping | [UJ-E07](plan-materials-and-shopping.md) | One procurement-preparation goal with calculation provenance. |
| M13: cost stages, breakdown, evidence, quote comparison entry | [UJ-E08](estimate-and-review-costs.md), [UJ-E09](attach-and-find-evidence.md) | No invented downstream quote-comparison interface. |
| M14: Documents, Photos, Notes and pin/list navigation | [UJ-E09](attach-and-find-evidence.md) | Evidence types are branches of one contextual goal. |
| M15: confirmed write and failed refresh | [UJ-E11](recover-saved-stale-plan.md) | Dedicated recovery journey. |
| M16: narrow desktop panels and focus leaf | [UJ-E15](navigate-and-compare-plan.md) | Responsive branch, distinct from mobile writing. |
| M17: readiness, issue correction, review note, return | [UJ-E10](review-renovation-readiness.md) | Dedicated readiness-review journey. |

## Editor flows and prototype scenarios

Sources: [interaction and mental model](<../renovation-planner-editor-specs/Renovation Planner — Editor Interaction & Mental Model Specification.md>), [research and pattern study](<../renovation-planner-editor-specs/Renovation Planner — Editor UX Research & Pattern Study.md>), and [first vertical slice](<../renovation-planner-editor-specs/Renovation Planner — First Vertical Slice Plan and Data-Model Specification.md>).

| Source flow | Journey files | Treatment |
| --- | --- | --- |
| Mental model §17: rectangular and free-shape room flows | [UJ-E02](create-and-restore-room.md) | Free shape is a documented alternative beyond the first slice. |
| Mental model §24: insert door/window and reposition along wall | [UJ-E13](insert-wall-opening.md) | Dedicated journey. |
| Mental model §26–27: reference setup and controls | [UJ-E01](prepare-first-plan.md), [UJ-E15](navigate-and-compare-plan.md) | Setup and ongoing view/lock control. |
| Mental model §49–51: reversible edits and consequence-based deletion | [UJ-E14](inspect-and-edit-room.md), [UJ-E16](delete-spatial-entity.md), [UJ-E12](apply-shared-spatial-change.md) | Single-edit and multi-entity paths. |
| Mental model §58: change floors | [UJ-E15](navigate-and-compare-plan.md) | Preserve useful viewport; clear invalid cross-floor selection. |
| Mental model §84 scenario 1: create 4 × 5 m Kitchen and correct a dimension | [UJ-E02](create-and-restore-room.md), [UJ-E14](inspect-and-edit-room.md) | Creation followed by exact adjustment. |
| Mental model §84 scenario 2: known 4 m reference and room tracing | [UJ-E01](prepare-first-plan.md), [UJ-E02](create-and-restore-room.md) | Reference preparation followed by tracing/verification. |
| Mental model §84 scenario 3: find Kitchen, inspect size, rename | [UJ-E14](inspect-and-edit-room.md) | Dedicated existing-room journey. |
| Mental model §84 scenario 4: remove existing wall and add replacement | [UJ-E05](define-planned-change.md), [UJ-E03](draw-and-adjust-walls.md) | Renovation state plus wall creation. |
| Mental model §84 scenario 5: add remove old tiles | [UJ-E06](plan-room-work.md) | Concrete task fixture within room work. |
| Mental model §84 scenario 6: attach wall-damage photo | [UJ-E09](attach-and-find-evidence.md) | Concrete task fixture within evidence. |
| Research §28 flow 1: floor, starting method, rooms, dimensions, names | [UJ-E01](prepare-first-plan.md), [UJ-E02](create-and-restore-room.md), [UJ-E14](inspect-and-edit-room.md) | Connected creation and verification journeys. |
| Research §28 flow 2: upload, crop, scale, trace, verify | [UJ-E01](prepare-first-plan.md), [UJ-E02](create-and-restore-room.md) | Reference branch and room geometry. |
| Research §28 flow 3: Existing details, photos, notes | [UJ-E04](capture-existing-room.md), [UJ-E09](attach-and-find-evidence.md) | Survey and evidence. |
| Research §28 flow 4: describe intended changes | [UJ-E05](define-planned-change.md) | Planned state. |
| Research §28 flow 5: work, trade, material, estimate | [UJ-E06](plan-room-work.md), [UJ-E07](plan-materials-and-shopping.md), [UJ-E08](estimate-and-review-costs.md) | Related journeys retain the sequence. |
| Research §28 flow 6: demolition/planned layers and room work/cost | [UJ-E15](navigate-and-compare-plan.md), [UJ-E06](plan-room-work.md), [UJ-E08](estimate-and-review-costs.md) | Spatial comparison differs from readiness Review. |
| First vertical slice §2.2: ten-step create/inspect/undo/redo/reload journey | [UJ-E02](create-and-restore-room.md) | Preserved as one end-to-end persistence journey. |

The [implementation plan's nine harness journeys](../renovation-planner-editor-specs/implementation/implementation-plan.md) map to UJ-E01/E02, E01, E03, E04/E05/E06, E07/E08, E09, E10, E11, and the shared theme/constrained-layout variants, respectively.

## Asset library

Sources: [AL00–AL11 specification index](../asset-library-delivery/specification/README.md) and [interaction rules](../asset-library-delivery/specification/interaction-rules.md).

| Source flow | Journey files | Treatment |
| --- | --- | --- |
| AL00–AL02: browse, inspect, search | [UJ-A01](find-and-inspect-asset.md) | One find-and-understand goal, retaining all three branches. |
| AL03 and AL08: create asset, including first asset | [UJ-A02](create-reusable-asset.md) | Empty state is a valid entry, not a different creation command. |
| AL04: edit definition and shared price | [UJ-A03](edit-asset-definition.md) | Explicit save proposal retained. |
| AL05: navigate with a draft | [UJ-A06](leave-unsaved-asset-draft.md) | Independent keep/discard decision. |
| AL06: usage and price impact | [UJ-A04](inspect-asset-usage-and-prices.md), [UJ-P04](maintain-project-prices.md) | Library usage leads deliberately to project-specific pricing. |
| AL07: shape or note and return | [UJ-A05](open-asset-shape-or-note.md) | Two explicit destinations with shared draft protection. |
| AL09: loading, saving, data errors | [UJ-A07](recover-asset-data-errors.md) | Includes rejected, confirmed, and unknown write outcomes. |
| AL10: narrow layout and theme | [UJ-A01](find-and-inspect-asset.md), [UJ-A06](leave-unsaved-asset-draft.md) | View variant preserving selection/draft; shared index rules. |
| AL11: delete asset | [UJ-A08](delete-unused-asset.md) | Dedicated reference-aware deletion. |

## Workspace and archived canvas

Sources: [Workspace UXD](../archive/renovation-project-workspace-UXD.md), [wireframes](../archive/renovation-project-workspace-wireframes.md), [prototype design](../archive/renovation-project-workspace-PROTOTYPE-DESIGN-SPEC.md), and [canvas concept](../archive/renovation-canvas-concept-interaction-design.md). Section numbers identify the named source's own sections, not repeated appendix numbering.

| Source flow | Journey files | Treatment |
| --- | --- | --- |
| UXD §4: primary lifecycle | [UJ-W01](renovation-lifecycle.md) | Umbrella context; no mandatory stage order. |
| UXD §8–9: first launch and multi-step new-project wizard | [UJ-W10](historical-guided-setup-and-resume.md), [UJ-P01](start-project-without-plan.md) | Historical wizard preserved; newer note-first entry takes precedence. |
| UXD §10–11: Project Home and optional next actions | [UJ-P02](find-and-open-project.md), [UJ-W01](renovation-lifecycle.md) | Current lean details plus labelled long-term guidance. |
| UXD §12–14: spaces, space detail, contextual creation | [UJ-W02](organize-property-spaces.md) | Full hierarchy remains an archived concept. |
| UXD §15–17: design, work planning, estimation | [UJ-E05](define-planned-change.md), [UJ-E06](plan-room-work.md), [UJ-E08](estimate-and-review-costs.md), [UJ-W07](refine-estimate-with-measurements.md) | Newer detail flows plus historical progressive estimation. |
| UXD §18–20: scheduling, execution, documentation | [UJ-W03](schedule-renovation-work.md), [UJ-W04](execute-and-track-renovation.md), [UJ-E09](attach-and-find-evidence.md) | Dedicated goals; high-level source limits remain explicit. |
| UXD §21: Continue existing project | [UJ-P03](resume-and-recover-context.md), [UJ-W10](historical-guided-setup-and-resume.md) | Current Resume plus historical deeper-context restoration. |
| UXD §25–26: deletion, completion and archive | [UJ-E16](delete-spatial-entity.md), [UJ-W05](complete-and-archive-project.md) | Impact-aware deletion is distinct from non-destructive archive. |
| UXD §29: first launch and create without floor plan | [UJ-P01](start-project-without-plan.md), [UJ-W10](historical-guided-setup-and-resume.md) | Newer path and preserved historical prototype. |
| UXD §29: create with imported plan and add first room | [UJ-P01](start-project-without-plan.md), [UJ-E01](prepare-first-plan.md), [UJ-E02](create-and-restore-room.md) | Project creation precedes the editor import path. |
| UXD §29: first work, first estimate, room → budget → same room | [UJ-E06](plan-room-work.md), [UJ-E08](estimate-and-review-costs.md) | Budget round trip is explicitly broader concept scope. |
| UXD §29: reopen, continue, recover removed context | [UJ-P03](resume-and-recover-context.md) | Explained, validated fallback. |
| UXD §29: complete and archive | [UJ-W05](complete-and-archive-project.md) | Dedicated archived-concept journey. |
| Prototype §2 and §13: full House/Kitchen/Replace Floor golden path | [UJ-W10](historical-guided-setup-and-resume.md) | Preserves the complete original usability scenario. |
| Wireframes A.12–A.15: add space/work and refine estimate | [UJ-W02](organize-property-spaces.md), [UJ-E06](plan-room-work.md), [UJ-W07](refine-estimate-with-measurements.md) | Contextual creation and optional refinement. |
| Canvas §4–6: core loop, conceptual → approximate → measured, precision on demand | [UJ-W01](renovation-lifecycle.md), [UJ-W07](refine-estimate-with-measurements.md) | Explicit refinement journey added. |
| Canvas §10: Observed → Investigating → Decision Needed → Work Created → Resolved | [UJ-W08](investigate-renovation-problem.md) | Dedicated problem lifecycle; no invented transition commands. |
| Canvas §11: Open → Evaluating → Decided → Superseded | [UJ-W09](evaluate-and-record-decision.md) | Dedicated decision lifecycle with alternatives/rationale. |
| Canvas §19–20: refine work and optional measured renovation zones | [UJ-W07](refine-estimate-with-measurements.md) | Measurement and costing remain optional. |
| Canvas §27–28: first ten minutes, first space, then room work | [UJ-W02](organize-property-spaces.md), [UJ-E06](plan-room-work.md), [UJ-W10](historical-guided-setup-and-resume.md) | No-plan conceptual onboarding and linked work. |
| Canvas §34: Kitchen, work, estimate, damp wall, photo, decision, return | [UJ-W06](capture-problem-and-decision.md) | Full composite prototype task, linked to separate lifecycles. |

## Consolidated sources and boundaries

- The [older Home specification](../archive/renovation-planner-home-DESIGN-SPEC.md) contributes launcher/search/Open/Continue behavior, consolidated through the newer project specification in UJ-P01–P03.
- The [older asset-library overview](../archive/asset-library-overview-DESIGN-SPEC.md) is consolidated through the delivery specification; UJ-A03 explicitly identifies whole-form Save as a proposal, not a silently shipped replacement for inline editing.
- The [frozen HTML mock inventory](../archive/concepts/README.md) identifies illustrative working/first-run/trouble/localization states, component specimens, a disclosure ladder, and a settings specimen. Plan/canvas states map to editor journeys and UJ-W06–W09. The disclosure ladder illustrates progressive detail; it does not supply additional end-to-end user flows. The single-setting specimen and component states are not promoted into invented journeys.
- The [JTBD backlog](../archive/renovation-planner-JTBD-research-backlog.md) explicitly contains research hypotheses. All 63 candidate jobs remain research input, not 63 asserted interaction flows. Competitor workflows in the research study are evidence for product recommendations, not additional Renovation Planner journeys.
- Backlogs, PBIs, enablers, reconciliation, component libraries, copy tables, and verification plans refine the same screen/goal contracts; technical delivery steps are not user journeys. Images and styling files illustrate those contracts rather than define new flows from incidental sample labels.
- Future catalogue entries and deferred ideas such as Path/Fence creation, automated plan recognition, LiDAR, 3D, contractor permissions, detailed quote comparison, and full scheduling engines lack complete product interaction contracts here. Mentioned entry points and explicit deferrals remain recorded; no unsupported sequence is filled in.
- The older mobile-capture idea is not carried forward as permission to write on mobile. Current project scope is mobile read-only. Likewise, historical mandatory setup and portfolio metrics stay historical.

## Verification boundary

Every mapped journey is a standalone English Markdown file with YAML frontmatter and source references. The catalogue and this audit make consolidation and historical precedence reviewable. Structured checks validate YAML, unique IDs, mandatory sections, local source paths, Markdown links/anchors, and index/related-journey references. These checks cannot prove semantic completeness on their own; that conclusion is bounded to the source flows explicitly mapped above.
