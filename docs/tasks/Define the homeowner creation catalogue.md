---
type: Task
parent: "[[Start one creation task from Add]]"
order: 10
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Define the homeowner creation catalogue

## Evidence

[M02](../user-experience/renovation-planner-editor-specs/screens/M02-add-menu.md) locks grouped homeowner labels, availability predicates and one scalable Add entry point.

## Why it matters

Hard-coded tool buttons expose internal geometry language and become unmanageable as creation grows.

## Approach

Define declarative localized entries with stable IDs, group, label, description, synonyms, availability and one canonical activation callback.

## Acceptance criteria

- Entries contain no Zone, Polygon, Vertex, Scene or Calibrate-tool labels.
- Availability distinguishes unsupported from temporarily blocked.
- Search data is localized and includes approved synonyms.
- Room can become the recommended entry without coupling the menu to its implementation.

## Risks

A generic catalogue can become speculative configuration; include only approved locked choices and capabilities.

## Outcome

Add has one truthful, extensible vocabulary for creation choices.
