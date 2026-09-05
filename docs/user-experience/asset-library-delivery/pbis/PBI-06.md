---
id: PBI-06
type: PBI
status: designed
epic: Asset library
feature: F02
priority: P0
estimate: null
assignee: null
depends_on: [PBI-05]
screens: [AL05]
---
# PBI-06 — Switch assets without accidentally losing input

## Context and value

**Epic:** Asset library · **Feature:** F02 — Create and maintain definitions

As a private renovator, I want to complete this activity independently and understand its outcome, so that my reusable asset definitions and their project relationships remain reliable.

**Outcome:** Switch assets without accidentally losing input.

**References:** [AL05](AL05-unsaved-changes.md). The [interaction rules](interaction-rules.md) and [shared delivery rules](delivery-rules.md) also apply.

## Preconditions and trigger

Required predecessors: [PBI-05](PBI-05.md). Necessary application collaborators have been checked against the target commit; fixtures include the normal and failure conditions described here. The trigger is the user action in the main flow.

## Main flow

1. Change a draft
2. Request another selection or navigation
3. Read the protection dialog
4. Choose Keep editing or Discard and continue.

## Alternative and error flows

Esc means Keep editing. Discard executes the stored pending action exactly once. Search, group expansion, and width changes preserve the draft without showing the protection dialog.

## Postconditions

On success, the observable outcome above is achieved. Read-only and navigation actions do not change asset data. Writes are considered saved only after a confirmed command result; failed read-back is reported separately. Rejection preserves existing data and the affected user input.

## Acceptance criteria

```gherkin
Feature: PBI-06 — Switch assets without accidentally losing input
  Scenario: Concrete acceptance example
    Given asset A has an unsaved draft and asset B is visible in the list
    When the user selects B and chooses Keep editing in the protection dialog
    Then A and its unchanged draft remain active and B is not opened
```

Every rule under Alternative and error flows is also an individually binding acceptance criterion. Automation must use controlled fixtures for each distinct condition; a screenshot does not establish data consistency.

## Implementation tasks

- [ ] PBI-06-T01: Coordinate navigation intent in the root.
- [ ] PBI-06-T02: Use DialogHost and focus restoration.
- [ ] PBI-06-T03: Connect selection, New asset, and source navigation.
- [ ] PBI-06-T04: Handle normal closure according to the host contract.
- [ ] PBI-06-T05: Do not claim protection against forced termination.
- [ ] PBI-06-T06: Test the dialog and asset-ID isolation.
- [ ] PBI-06-T07: Update the affected screen specification and actual state capture; record remaining deviations.

## Scope boundary

No silent autosave or guaranteed crash recovery.

## Definition of Ready and outstanding refinement

- [ ] Classify existing implementation as fulfilled / needs adaptation / missing; size only the actual delta.
- [ ] Record required EN-01/EN-02 decisions and affected error codes.
- [ ] Agree concrete fixtures, expected values, and test responsibility.
- [ ] Estimate effort and task boundaries together; this PBI is not yet ready.

## Acceptance and evidence

The Product Owner or RE/UX reviews the visible flow; engineering supplies the relevant integration/domain evidence. Use screenshots where layout or state matters. An existing test may be reused if it actually proves the agreed behavior. A new PBI file does not justify implementing existing functionality again.
