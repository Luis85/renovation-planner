---
id: PBI-05
type: PBI
status: designed
epic: Asset library
feature: F02
priority: P0
estimate: null
assignee: null
depends_on: [PBI-04, EN-02]
screens: [AL04]
---
# PBI-05 — Explicitly save or discard asset metadata changes

## Context and value

**Epic:** Asset library · **Feature:** F02 — Create and maintain definitions

As a private renovator, I want to complete this activity independently and understand its outcome, so that my reusable asset definitions and their project relationships remain reliable.

**Outcome:** Explicitly save or discard asset metadata changes.

**References:** [AL04](AL04-edit-definition.md). The [interaction rules](interaction-rules.md) and [shared delivery rules](delivery-rules.md) also apply.

## Preconditions and trigger

Required predecessors: [PBI-04](PBI-04.md), [EN-02](EN-02.md). Necessary application collaborators have been checked against the target commit; fixtures include the normal and failure conditions described here. The trigger is the user action in the main flow.

## Main flow

1. Change the name, supplier, or SKU
2. Recognize the local draft
3. Activate Save
4. Read the confirmed values in the row and note, or choose Discard instead.

## Alternative and error flows

Blur does not trigger a write. Rejected validation preserves input and shows an error at the field. Double-clicking Save does not execute the commit twice.

## Postconditions

On success, the observable outcome above is achieved. Read-only and navigation actions do not change asset data. Writes are considered saved only after a confirmed command result; failed read-back is reported separately. Rejection preserves existing data and the affected user input.

## Acceptance criteria

```gherkin
Feature: PBI-05 — Explicitly save or discard asset metadata changes
  Scenario: Concrete acceptance example
    Given the stored supplier is Timber supplier and the asset has additional metadata not visible in the form
    When the user changes the supplier to Northern timber supplier and activates Save
    Then the re-read asset note contains Northern timber supplier and unchanged unrelated metadata
```

Every rule under Alternative and error flows is also an individually binding acceptance criterion. Automation must use controlled fixtures for each distinct condition; a screenshot does not establish data consistency.

## Implementation tasks

- [ ] PBI-05-T01: Introduce a draft bound to asset ID and baseline version.
- [ ] PBI-05-T02: Integrate the coordinated write path from EN-02.
- [ ] PBI-05-T03: Map errors to fields.
- [ ] PBI-05-T04: Preserve unedited data.
- [ ] PBI-05-T05: Read back confirmed data.
- [ ] PBI-05-T06: Add production persistence and rejection checks.
- [ ] PBI-05-T07: Update the affected screen specification and actual state capture; record remaining deviations.

## Scope boundary

Price and unit changes additionally require PBI-07/PBI-08; do not copy array-snapshot undo from the prototype.

## Definition of Ready and outstanding refinement

- [ ] Classify existing implementation as fulfilled / needs adaptation / missing; size only the actual delta.
- [ ] Record required EN-01/EN-02 decisions and affected error codes.
- [ ] Agree concrete fixtures, expected values, and test responsibility.
- [ ] Estimate effort and task boundaries together; this PBI is not yet ready.

## Acceptance and evidence

The Product Owner or RE/UX reviews the visible flow; engineering supplies the relevant integration/domain evidence. Use screenshots where layout or state matters. An existing test may be reused if it actually proves the agreed behavior. A new PBI file does not justify implementing existing functionality again.
