---
id: PBI-11
type: PBI
status: designed
epic: Asset library
feature: F03
priority: P0
estimate: null
assignee: null
depends_on: [PBI-06, PBI-10]
screens: [AL06, AL07]
---
# PBI-11 — Navigate from an asset to its note or a project using it

## Context and value

**Epic:** Asset library · **Feature:** F03 — Explore usage and source information

As a private renovator, I want to complete this activity independently and understand its outcome, so that my reusable asset definitions and their project relationships remain reliable.

**Outcome:** Navigate from an asset to its note or a project using it.

**References:** [AL06](../specification/screens/AL06-usage-and-price.md), [AL07](../specification/screens/AL07-shape-and-note.md). The [interaction rules](interaction-rules.md) and [shared delivery rules](delivery-rules.md) also apply.

## Preconditions and trigger

Required predecessors: [PBI-06](PBI-06.md), [PBI-10](PBI-10.md). Necessary application collaborators have been checked against the target commit; fixtures include the normal and failure conditions described here. The trigger is the user action in the main flow.

## Main flow

1. Activate Open note or a project row
2. Protect the draft if necessary
3. Open the resolved target through host navigation
4. Recover the library context on return.

## Alternative and error flows

A moved or missing file is not opened using an invented path. A project at the vault root is valid. Cancelling the protection dialog does not open a destination.

## Postconditions

On success, the observable outcome above is achieved. Read-only and navigation actions do not change asset data. Writes are considered saved only after a confirmed command result; failed read-back is reported separately. Rejection preserves existing data and the affected user input.

## Acceptance criteria

```gherkin
Feature: PBI-11 — Navigate from an asset to its note or a project using it
  Scenario: Concrete acceptance example
    Given the note belonging to an asset has moved within the vault
    When the user activates Open note
    Then the currently resolved path opens and no copy is created at the old path
```

Every rule under Alternative and error flows is also an individually binding acceptance criterion. Automation must use controlled fixtures for each distinct condition; a screenshot does not establish data consistency.

## Implementation tasks

- [ ] PBI-11-T01: Use existing note/project lookups and reveal actions.
- [ ] PBI-11-T02: Connect actual destinations instead of demo dialogs.
- [ ] PBI-11-T03: Run draft protection before navigating.
- [ ] PBI-11-T04: Explain missing targets and offer refresh.
- [ ] PBI-11-T05: Test vault-root paths, moves, and return navigation.
- [ ] PBI-11-T06: Update the affected screen specification and actual state capture; record remaining deviations.

## Scope boundary

No new project-detail page or embedded copy of the note in the library.

## Definition of Ready and outstanding refinement

- [ ] Classify existing implementation as fulfilled / needs adaptation / missing; size only the actual delta.
- [ ] Record required EN-01/EN-02 decisions and affected error codes.
- [ ] Agree concrete fixtures, expected values, and test responsibility.
- [ ] Estimate effort and task boundaries together; this PBI is not yet ready.

## Acceptance and evidence

The Product Owner or RE/UX reviews the visible flow; engineering supplies the relevant integration/domain evidence. Use screenshots where layout or state matters. An existing test may be reused if it actually proves the agreed behavior. A new PBI file does not justify implementing existing functionality again.
