---
id: UJ-P03
title: "Resume work and recover a missing destination"
type: user-journey
status: documented
source_maturity: specified
version: 1
language: en
updated: 2026-09-05
area: projects
actor: private-renovator
sources:
  - path: "../renovation-planner-project-specs/interaction-concept.md"
    section: "§4C and §8: Resume"
  - path: "../renovation-planner-project-specs/states-and-navigation.md"
    section: "Resume validation and navigation state"
  - path: "../renovation-planner-project-specs/screens/P03-resume-recovery.md"
    section: "P03: missing last plan"
  - path: "../archive/renovation-project-workspace-UXD.md"
    section: "§21: historical continuity journey"
related_journeys:
  - UJ-P02
  - UJ-E11
---

# Resume work and recover a missing destination

## Goal

Continue meaningful work after a break without reconstructing the project context.

## Actor and entry

A private renovator working in Obsidian; no CAD or data-model expertise is assumed. The overview offers Resume for previously saved project/plan context.

## Main flow

1. Read the named Resume destination before activation.
2. Activate Resume and validate its target against successfully read data.
3. If the plan is valid, open that exact plan in the editor.
4. If the project exists but the last plan is confirmed missing, show an explanation in project details.
5. Choose another readable plan, open the project note, or deliberately create a plan from the retained project context.

## Alternatives and recovery

- Read failure is an error with a permitted next action, not evidence that a plan or project was deleted.
- If only a project was saved and it still exists, open its details. A project with no remaining plans still offers the note and deliberate plan creation.
- If the project is reliably gone, explain that state and keep All projects accessible. Never silently open another renovation.
- An attempted or failed open is not successful resumption; follow the shared navigation contract.
- Older object → space → floor fallback concepts do not establish additional currently available destinations.

## Outcome

The last valid destination opens, or the user receives an explained fallback with a deliberate next action.

## Scope and evidence

This journey extracts the source design intent. It is not a claim of shipped functionality or passed usability testing. See the [catalogue conventions](README.md#conventions-and-precedence) for precedence and shared interaction constraints.

- [§4C and §8: Resume](<../renovation-planner-project-specs/interaction-concept.md>)
- [Resume validation and navigation state](<../renovation-planner-project-specs/states-and-navigation.md>)
- [P03: missing last plan](<../renovation-planner-project-specs/screens/P03-resume-recovery.md>)
- [§21: historical continuity journey](<../archive/renovation-project-workspace-UXD.md>)

## Related journeys

- [UJ-P02 — Find and deliberately open a project](find-and-open-project.md)
- [UJ-E11 — Recover a saved plan after refresh failure](recover-saved-stale-plan.md)
