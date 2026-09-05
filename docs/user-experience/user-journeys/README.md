---
title: User journey catalogue
type: user-journey-index
status: documented
version: 1
language: en
updated: 2026-09-05
---

# User journey catalogue

These 38 standalone journeys extract the user goals and flows embedded in the concepts under docs/user-experience. They describe intended experiences, not verified implementation. Each journey records entry conditions, steps, recovery paths, outcome, source sections, and related journeys in English.

The [source coverage audit](source-coverage.md) maps the explicit journey lists, prototype scenarios, and screen families to these files, including historical flows and deliberate consolidations.

## Projects

| ID | Journey | Source maturity |
| --- | --- | --- |
| UJ-P01 | [Start a project without a floor plan](start-project-without-plan.md) | specified |
| UJ-P02 | [Find and deliberately open a project](find-and-open-project.md) | specified |
| UJ-P03 | [Resume work and recover a missing destination](resume-and-recover-context.md) | specified |
| UJ-P04 | [Maintain project-specific prices](maintain-project-prices.md) | specified |

## Editor and renovation context

| ID | Journey | Source maturity |
| --- | --- | --- |
| UJ-E01 | [Start a plan and prepare a reference](prepare-first-plan.md) | specified |
| UJ-E02 | [Create, undo, and restore a room](create-and-restore-room.md) | specified |
| UJ-E03 | [Draw and adjust a wall-based layout](draw-and-adjust-walls.md) | specified |
| UJ-E04 | [Capture what exists in a room](capture-existing-room.md) | specified |
| UJ-E05 | [Define the intended room changes](define-planned-change.md) | specified |
| UJ-E06 | [Turn renovation intent into room work](plan-room-work.md) | specified |
| UJ-E07 | [Calculate material needs and prepare shopping](plan-materials-and-shopping.md) | specified |
| UJ-E08 | [Estimate and review renovation costs](estimate-and-review-costs.md) | specified |
| UJ-E09 | [Attach and find evidence in context](attach-and-find-evidence.md) | specified |
| UJ-E10 | [Review renovation readiness and address issues](review-renovation-readiness.md) | specified |
| UJ-E11 | [Recover a saved plan after refresh failure](recover-saved-stale-plan.md) | specified |
| UJ-E12 | [Apply a shared change to multiple entities](apply-shared-spatial-change.md) | specified |
| UJ-E13 | [Insert and position a door or window](insert-wall-opening.md) | specified |
| UJ-E14 | [Find, inspect, and adjust an existing room](inspect-and-edit-room.md) | specified |
| UJ-E15 | [Navigate the floor and compare renovation views](navigate-and-compare-plan.md) | specified |
| UJ-E16 | [Delete a spatial entity with understood consequences](delete-spatial-entity.md) | specified |

## Asset library

| ID | Journey | Source maturity |
| --- | --- | --- |
| UJ-A01 | [Find and inspect a reusable asset](find-and-inspect-asset.md) | proposed |
| UJ-A02 | [Create a reusable asset definition](create-reusable-asset.md) | proposed |
| UJ-A03 | [Edit a shared asset definition](edit-asset-definition.md) | proposed |
| UJ-A04 | [Inspect asset usage and choose the right price scope](inspect-asset-usage-and-prices.md) | proposed |
| UJ-A05 | [Open an asset shape or source note and return](open-asset-shape-or-note.md) | proposed |
| UJ-A06 | [Leave or retain an unsaved asset draft](leave-unsaved-asset-draft.md) | proposed |
| UJ-A07 | [Recover from asset loading or saving errors](recover-asset-data-errors.md) | proposed |
| UJ-A08 | [Delete an asset without damaging references](delete-unused-asset.md) | proposed |

## Long-term workspace concepts

| ID | Journey | Source maturity |
| --- | --- | --- |
| UJ-W01 | [Navigate the renovation lifecycle](renovation-lifecycle.md) | archived-concept |
| UJ-W02 | [Organize and work within property spaces](organize-property-spaces.md) | archived-concept |
| UJ-W03 | [Schedule renovation work progressively](schedule-renovation-work.md) | archived-concept |
| UJ-W04 | [Execute work and track the renovation](execute-and-track-renovation.md) | archived-concept |
| UJ-W05 | [Review completion and archive a project](complete-and-archive-project.md) | archived-concept |
| UJ-W06 | [Capture a renovation problem and decision](capture-problem-and-decision.md) | archived-concept |
| UJ-W07 | [Refine a rough estimate with measurements](refine-estimate-with-measurements.md) | archived-concept |
| UJ-W08 | [Investigate a problem and turn it into work](investigate-renovation-problem.md) | archived-concept |
| UJ-W09 | [Compare alternatives and preserve a decision](evaluate-and-record-decision.md) | archived-concept |
| UJ-W10 | [Set up and resume the historical workspace prototype](historical-guided-setup-and-resume.md) | archived-concept |

## Conventions and precedence

- One file represents a user goal and its meaningful alternatives. Screens, responsive variants, individual controls, and backlog items are not automatically separate journeys. The lifecycle journey provides the broader context.
- IDs are stable within an area: UJ-P for projects, UJ-E for editor, UJ-A for asset library, and UJ-W for long-term workspace concepts. Filenames use descriptive lowercase kebab-case.
- YAML frontmatter uses id, title, type, status, source_maturity, version, language, updated, area, actor, sources, and related_journeys. The index uses only document metadata.
- status: documented means the journey has been extracted. source_maturity distinguishes specified (current specification set), proposed (explicit proposal), and archived-concept (historical or long-term concept). None means implemented, approved for delivery, or user-validated.
- sources is a list of relative path and human-readable section pairs. The same sources are clickable in the body. related_journeys contains stable IDs, resolved by this index and body links. Dates use YYYY-MM-DD; version is an integer document revision.
- Explicit user decisions and newer product decisions take precedence. Current project and editor contracts refine older workspace concepts. Where the sources leave behavior open, the journey records that limit rather than supplying a new requirement.
- Original specifications retain authority for detailed interactions, domain constraints, and delivery status. Update affected journeys and source references together when those decisions change.

## Shared interaction constraints

Keyboard access, readable status text, host theming, and preserved context apply across the relevant journeys. Responsive versions belong to their parent journey: project P05–P07, editor M16, and asset library AL10 do not create new user goals. A constrained desktop leaf does not authorize mobile editing; the current project specification states mobile read-only scope.

The editor keeps selection and viewport when resizing and exposes non-canvas access or Focus this tab below its supported width. The asset library preserves drafts when search or layout changes and restores focus on returning to the list. Project return navigation restores search, scroll, and ID-based focus where possible. These are source-specific constraints, not a new shared persistence contract.

## Source coverage

| Concept family | Extracted journeys and treatment |
| --- | --- |
| [Project interaction concept](../renovation-planner-project-specs/interaction-concept.md) and P00–P07 | UJ-P01–P04 cover the three explicit core journeys, note-first entry, price editing, and recovery. Theme/width states remain variants. |
| [Editor specification set](../renovation-planner-editor-specs/README.md), M00–M17, mental model, research flows, and first vertical slice | UJ-E01–E16 cover first start/reference setup, room persistence and adjustment, walls/openings, Existing/Planned/Work, materials, costs, evidence, review, navigation/layers, deletion, refresh recovery, and batch changes. Menu entries without a described flow (such as Path or Fence) do not justify inventing a journey. |
| [Asset library specification](../asset-library-delivery/specification/README.md), AL00–AL11 and interaction rules | UJ-A01–A08 combine browsing/search/inspection and creation/empty states while keeping editing, usage, external navigation, draft protection, errors, and deletion explicit. |
| [Workspace UXD](../archive/renovation-project-workspace-UXD.md), including §29 validation flows | UJ-W01–W05 retain lifecycle, spaces, schedule, execution, and completion/archive. Entry/resume flows use UJ-P01–P03; import/first room use UJ-E01–E02; first work/estimate and budget return use UJ-E06/E08; documentation uses UJ-E09. |
| [Workspace wireframes](../archive/renovation-project-workspace-wireframes.md) and [prototype design specification](../archive/renovation-project-workspace-PROTOTYPE-DESIGN-SPEC.md) | Repeated UXD journeys are consolidated under the same IDs. UJ-W10 preserves the historical wizard and full golden path; UJ-W07 preserves optional estimate refinement. The earlier wizard and portfolio metrics are not current entry requirements. |
| [Home design specification](../archive/renovation-planner-home-DESIGN-SPEC.md) | Launcher, filtering, explicit Open, and Resume are consolidated through the newer project interaction concept. |
| [Canvas interaction concept](../archive/renovation-canvas-concept-interaction-design.md) | UJ-W06 preserves the Kitchen/problem/decision prototype scenario; UJ-W07–W09 extract progressive precision, problem investigation, and decision lifecycles. Overlapping spatial, work, cost, and evidence goals use the newer editor journeys. |
| [Archived asset library overview](../archive/asset-library-overview-DESIGN-SPEC.md) | The newer asset-library delivery specification supplies the extracted journeys and its explicit-save proposal. |
| [JTBD research backlog](../archive/renovation-planner-JTBD-research-backlog.md) | Candidate jobs remain research hypotheses. They are not converted into invented interaction sequences; this catalogue extracts journeys already described in the concepts. |

## Source links for layout variants

- [Project shared states and navigation](../renovation-planner-project-specs/states-and-navigation.md)
- [M16 constrained workspace](../renovation-planner-editor-specs/screens/M16-constrained-workspace.md)
- [AL10 narrow panel](../asset-library-delivery/specification/screens/AL10-narrow-and-theme.md)
- [Asset library shared interaction rules](../asset-library-delivery/specification/interaction-rules.md)
