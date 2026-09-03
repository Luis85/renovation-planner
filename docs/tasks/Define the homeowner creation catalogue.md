---
type: Task
parent: "[[Start one creation task from Add]]"
order: 10
status: Done
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

## Closing evidence

**2026-09-03**, the plan editor foundation's first increment.
`src/presentation/editor/add/creationCatalogue.ts` and
`tests/presentation/editor/add/creationCatalogue.test.ts`: criterion 1 is 'contains no internal
vocabulary in either locale', which asks the question of BOTH locale tables rather than of the
English one; criteria 2 and 4 are 'offers exactly one available entry, Room, and it activates the
draw tool' beside 'every unsupported entry carries a reason and throws if activated' — an
unsupported `activate` fails LOUDLY in a test rather than doing nothing in a vault, and Room's
recommendation is a hint on the entry rather than a coupling between the menu and the tool;
criterion 3 is 'search matches a synonym' and 'search matches a label with no query at all'.
'groups appear in the locked order: structure, property, planning' holds the ordering the menu
renders.

Criterion 2's 'temporarily blocked' arm has no producer today: all nine unsupported entries carry
the same not-yet reason, and no condition blocks an available one.
