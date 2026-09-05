# Renovation Planner — Project screen specifications

Version 1.1 · 2026-09-05 · Documentation language: **English** · Design status: designed; backlog status: scoped, pending technical refinement and estimation.

## Starting point
The selected third design direction combines a lean overview with project details offering optional, understandable entry paths. This package contains eight screen/variant specifications, interaction rules, components, implementation/verification plans, and the repository reconciliation with ten use-case PBIs. It contains no plugin implementation and has not been written to GitHub.

Mockups were generated with ImageGen and inspected during the design work. They are not screenshots of running software. **Original images retain German UI labels as localization examples.** All specification prose, use cases, tasks, acceptance criteria, and implementation documents are English. The [English/German UI copy table](ui-copy.md) defines intended labels.

## Contents
| ID | Screen | Specification |
| --- | --- | --- |
| P00 | Project overview | [P00](screens/P00-project-overview.md) |
| P01 | New project without a plan | [P01](screens/P01-new-project.md) |
| P02 | Active project | [P02](screens/P02-active-project.md) |
| P03 | Missing last plan | [P03](screens/P03-resume-recovery.md) |
| P04 | Edit project prices | [P04](screens/P04-project-prices.md) |
| P05 | Active project, dark theme | [P05](screens/P05-active-project-dark.md) |
| P06 | Project overview, narrow leaf | [P06](screens/P06-project-overview-narrow.md) |
| P07 | Active project, narrow leaf | [P07](screens/P07-active-project-narrow.md) |

- [Interaction concept](interaction-concept.md)
- [Shared states and navigation](states-and-navigation.md)
- [Component library](components/component-library.md)
- [Implementation plan with model consolidation](implementation/implementation-plan.md)
- [Repository reconciliation and ten PBIs](implementation/repository-reconciliation-and-backlog.md)
- [Verification plan and evidence](implementation/verification-plan.md)
- [UI copy and terminology](ui-copy.md)

## Usage
Extract the complete ZIP. Keep screens/ and images/ beside one another so embedded images work in Obsidian and GitHub. Suggested repository destination: docs/user-experience/renovation-planner-project-specs/. Reconcile existing documents/decisions before adoption; do not blindly overwrite repository content.

## Precedence
1. Explicit user decisions take precedence.
2. The repository reconciliation clarifies verified implementation gaps and proposal status; screen/shared rules incorporate its corrections.
3. Specifications govern behavior; images define visual direction, not incidental labels or pixel counts.
4. Domain project status is not calculated completion.
5. Open project leads to details; Resume leads to validated last context.
6. Obsidian is the design system: no fixed plugin palette or separate sign-in.
7. Starting without a plan is valid; ordinary project notes provide the first path.
8. Missing data is not zero. Drafts are not saved prices.
9. Narrow desktop does not imply mobile writing. Current product scope is mobile read-only.

## Scope and verification limits
Not every loading/error state has a separate image; text specifies relevant variants. Dark is illustrated by P02/P05, narrow by P00/P06 and P02/P07. P04 also needs narrow implementation verification. Project/plan creation forms and editor are not redesigned here.

No interactive prototype, runtime test, contrast measurement, or user study was produced in this documentation revision. The code reconciliation is pinned to commit 7b6bb2b27b9ae2aaccba7e90009098a39ad43207; translation does not claim a fresh repository review. Remaining spikes and Ready blockers are preserved.

## Changes in the English revision
- Translated every specification, interaction rule, component contract, work package, verification case, and backlog item.
- Added canonical English/German copy; preserved original German-localized images.
- Integrated documented mobile, library-access, price-unit, draft/clear, and back-label corrections.
- Used scoped for backlog lifecycle status, with technical refinement and estimation outstanding.
- Included the previously separate repository reconciliation in the complete package.

## Context sources
- [Editor specifications](https://github.com/Luis85/renovation-planner/tree/main/docs/user-experience/renovation-planner-editor-specs)
- [Home design specification](https://github.com/Luis85/renovation-planner/blob/main/docs/user-experience/renovation-planner-home-DESIGN-SPEC.md)
- [Workspace UXD](https://github.com/Luis85/renovation-planner/blob/main/docs/user-experience/renovation-project-workspace-UXD.md)

The older Workspace UXD is future context, not approval for portfolio metrics or unimplemented modules. Commit-pinned implementation evidence is in the reconciliation document.

## User journeys

The [standalone user journey catalogue](../user-journeys/README.md) extracts the project flows with frontmatter, source references, and explicit concept status.
