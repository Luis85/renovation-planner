---
id: UJ-P01
title: "Start a project without a floor plan"
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
    section: "§4A and §6: creation and note-first entry"
  - path: "../renovation-planner-project-specs/screens/P01-new-project.md"
    section: "P01: new project details"
  - path: "../archive/renovation-project-workspace-UXD.md"
    section: "§8–9: historical first-launch and new-project journeys"
related_journeys:
  - UJ-P02
  - UJ-E01
---

# Start a project without a floor plan

## Goal

Record renovation intent and take a useful first step with minimal setup.

## Actor and entry

A private renovator working in Obsidian; no CAD or data-model expertise is assumed. The renovator opens Projects for the first time, or chooses New project from an existing list.

## Main flow

1. Read the first-use explanation when a successful read confirms that no projects exist.
2. Choose New project and enter a name in the existing creation form; required technical values use sensible defaults.
3. Submit once. After confirmed creation, open project details using the returned project ID.
4. Choose Describe your renovation → Open project note and record goals, questions, or a free description.
5. Return to the same project. Create first plan and View prices remain optional next steps.

## Alternatives and recovery

- A loading or unreadable project list must not be described as empty.
- A rejected creation retains input and explains the error; opening the form alone creates nothing.
- The older multi-step wizard and structured initial-spaces setup are not requirements of the newer entry concept.
- A garden or outdoor renovation can start with the same note path.

## Outcome

The project exists and its ordinary vault note provides a useful place to begin; a floor plan is not required.

## Scope and evidence

This journey extracts the source design intent. It is not a claim of shipped functionality or passed usability testing. See the [catalogue conventions](README.md#conventions-and-precedence) for precedence and shared interaction constraints.

- [§4A and §6: creation and note-first entry](<../renovation-planner-project-specs/interaction-concept.md>)
- [P01: new project details](<../renovation-planner-project-specs/screens/P01-new-project.md>)
- [§8–9: historical first-launch and new-project journeys](<../archive/renovation-project-workspace-UXD.md>)

## Related journeys

- [UJ-P02 — Find and deliberately open a project](find-and-open-project.md)
- [UJ-E01 — Start a plan and prepare a reference](prepare-first-plan.md)
