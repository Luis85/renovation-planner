---
id: PBI-08
type: PBI
status: designed
epic: Asset library
feature: F02
priority: P0
estimate: null
assignee: null
depends_on: [PBI-05]
screens: [AL04]
---
# PBI-08 — Change an asset’s unit and waste allowance correctly

## Context and value

**Epic:** Asset library · **Feature:** F02 — Create and maintain definitions

As a private renovator, I want to complete this activity independently and understand its outcome, so that my reusable asset definitions and their project relationships remain reliable.

**Outcome:** Change an asset’s unit and waste allowance correctly.

**References:** [AL04](AL04-edit-definition.md). The [interaction rules](interaction-rules.md) and [shared delivery rules](delivery-rules.md) also apply.

## Preconditions and trigger

Required predecessors: [PBI-05](PBI-05.md). Necessary application collaborators have been checked against the target commit; fixtures include the normal and failure conditions described here. The trigger is the user action in the main flow.

## Main flow

1. Change the unit or waste allowance
2. Validate input
3. Save an allowed change
4. Read the updated unit or percentage.

## Alternative and error flows

A dimension-kind change on an asset with existing requirements is rejected according to the domain rule and explained at the unit field. Percentage display and the internal factor are not confused; non-finite values are invalid.

## Postconditions

On success, the observable outcome above is achieved. Read-only and navigation actions do not change asset data. Writes are considered saved only after a confirmed command result; failed read-back is reported separately. Rejection preserves existing data and the affected user input.

## Acceptance criteria

```gherkin
Feature: PBI-08 — Change an asset’s unit and waste allowance correctly
  Scenario: Concrete acceptance example
    Given an asset with an area unit is referenced by an area-based requirement
    When the user attempts to save an incompatible length unit
    Then the stored area unit remains unchanged and the unit field explains the rejection
```

Every rule under Alternative and error flows is also an individually binding acceptance criterion. Automation must use controlled fixtures for each distinct condition; a screenshot does not establish data consistency.

## Implementation tasks

- [ ] PBI-08-T01: Apply the unit/dimension matrix and percentage conversion from EN-01.
- [ ] PBI-08-T02: Map existing refusals.
- [ ] PBI-08-T03: Prevent data loss after partial failure.
- [ ] PBI-08-T04: Check accepted and rejected changes and decimal/percentage boundaries.
- [ ] PBI-08-T05: Update the affected screen specification and actual state capture; record remaining deviations.

## Scope boundary

No implicit quantity conversion or recalculation outside the existing domain contract.

## Definition of Ready and outstanding refinement

- [ ] Classify existing implementation as fulfilled / needs adaptation / missing; size only the actual delta.
- [ ] Record required EN-01/EN-02 decisions and affected error codes.
- [ ] Agree concrete fixtures, expected values, and test responsibility.
- [ ] Estimate effort and task boundaries together; this PBI is not yet ready.

## Acceptance and evidence

The Product Owner or RE/UX reviews the visible flow; engineering supplies the relevant integration/domain evidence. Use screenshots where layout or state matters. An existing test may be reused if it actually proves the agreed behavior. A new PBI file does not justify implementing existing functionality again.
