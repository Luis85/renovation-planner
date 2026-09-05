---
id: PBI-02
type: PBI
status: designed
epic: Asset library
feature: F01
priority: P0
estimate: null
assignee: null
depends_on: [PBI-01]
screens: [AL00, AL01]
---
# PBI-02 — Compare and select assets within category groups

## Context and value

**Epic:** Asset library · **Feature:** F01 — Find and browse the catalogue

As a private renovator, I want to complete this activity independently and understand its outcome, so that my reusable asset definitions and their project relationships remain reliable.

**Outcome:** Compare and select assets within category groups.

**References:** [AL00](AL00-browse.md), [AL01](AL01-selected-object.md). The [interaction rules](interaction-rules.md) and [shared delivery rules](delivery-rules.md) also apply.

## Preconditions and trigger

Required predecessors: [PBI-01](PBI-01.md). Necessary application collaborators have been checked against the target commit; fixtures include the normal and failure conditions described here. The trigger is the user action in the main flow.

## Main flow

1. Expand a category
2. Read the aligned comparison values
3. Select an asset
4. Display its inspector.

## Alternative and error flows

Focus and selection remain distinguishable. A late detail response for asset A must not appear after the user selects B. Empty groups are disabled.

## Postconditions

On success, the observable outcome above is achieved. Read-only and navigation actions do not change asset data. Writes are considered saved only after a confirmed command result; failed read-back is reported separately. Rejection preserves existing data and the affected user input.

## Acceptance criteria

```gherkin
Feature: PBI-02 — Compare and select assets within category groups
  Scenario: Concrete acceptance example
    Given asset A is selected and its detail read is still running
    When the user selects asset B and the response for A subsequently arrives
    Then the row selection marker and inspector show only asset B
```

Every rule under Alternative and error flows is also an individually binding acceptance criterion. Automation must use controlled fixtures for each distinct condition; a screenshot does not establish data consistency.

## Implementation tasks

- [ ] PBI-02-T01: Adapt AssetShelves and AssetRow to the selected design.
- [ ] PBI-02-T02: Add one shared column-header row.
- [ ] PBI-02-T03: Use actual categories and stable IDs.
- [ ] PBI-02-T04: Check store selection and request generations.
- [ ] PBI-02-T05: Test the A-to-B race and category expansion.
- [ ] PBI-02-T06: Update the affected screen specification and actual state capture; record remaining deviations.

## Scope boundary

No sorting menus, multi-selection, or use of production type icons as evidence of geometry.

## Definition of Ready and outstanding refinement

- [ ] Classify existing implementation as fulfilled / needs adaptation / missing; size only the actual delta.
- [ ] Record required EN-01/EN-02 decisions and affected error codes.
- [ ] Agree concrete fixtures, expected values, and test responsibility.
- [ ] Estimate effort and task boundaries together; this PBI is not yet ready.

## Acceptance and evidence

The Product Owner or RE/UX reviews the visible flow; engineering supplies the relevant integration/domain evidence. Use screenshots where layout or state matters. An existing test may be reused if it actually proves the agreed behavior. A new PBI file does not justify implementing existing functionality again.
