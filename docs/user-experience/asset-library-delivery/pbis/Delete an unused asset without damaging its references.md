---
id: PBI-17
type: PBI
status: in-review
epic: Asset library
feature: F04
priority: P0
estimate: null
assignee: null
depends_on: [PBI-10, PBI-14]
screens: [AL11]
---
# PBI-17 — Delete an unused asset without damaging its references

Implementation and test evidence: [delivery record](../delivery-record.md). Engineering implementation is in review; the acceptance checklist remains for reviewer and real-vault confirmation.

## Context and value

**Epic:** Asset library · **Feature:** F04 — Handle errors and manage assets safely

As a private renovator, I want to complete this activity independently and understand its outcome, so that my reusable asset definitions and their project relationships remain reliable.

**Outcome:** Delete an unused asset without damaging its references.

**References:** [AL11](../specification/screens/AL11-delete-object.md). The [interaction rules](../specification/interaction-rules.md) and [shared delivery rules](../delivery-rules.md) also apply.

## Preconditions and trigger

Required predecessors: [PBI-10](PBI-10.md), [PBI-14](PBI-14.md). Necessary application collaborators have been checked against the target commit; fixtures include the normal and failure conditions described here. The trigger is the user action in the main flow.

## Main flow

1. Choose the secondary delete action
2. Check current usage
3. Confirm an allowed deletion
4. See the confirmed catalogue state and meaningful successor focus.

## Alternative and error flows

Unknown usage blocks deletion. A new reference before commit is caught by the command. Referenced assets can be removed only through existing explicit reference resolution; otherwise block deletion and show usage.

## Postconditions

On success, the observable outcome above is achieved. Read-only and navigation actions do not change asset data. Writes are considered saved only after a confirmed command result; failed read-back is reported separately. Rejection preserves existing data and the affected user input.

## Acceptance criteria

```gherkin
Feature: PBI-17 — Delete an unused asset without damaging its references
  Scenario: Concrete acceptance example
    Given an asset had no references when usage was checked
    When a requirement starts referencing it before the final delete commit
    Then the command prevents invalid deletion and the asset remains in the catalogue
```

Every rule under Alternative and error flows is also an individually binding acceptance criterion. Automation must use controlled fixtures for each distinct condition; a screenshot does not establish data consistency.

## Implementation tasks

- [ ] PBI-17-T01: Integrate existing deleteAssetFlow and DeleteAsset.
- [ ] PBI-17-T02: Respect refusal and compensation contracts.
- [ ] PBI-17-T03: Prevent duplicate confirmation.
- [ ] PBI-17-T04: Verify sidecar/override handling.
- [ ] PBI-17-T05: Test the check-to-commit race and failures without optimistic removal.
- [ ] PBI-17-T06: Update the affected screen specification and actual state capture; record remaining deviations.

## Scope boundary

No automatic deletion of project requirements or undo promise without a restoration contract.

## Definition of Ready and outstanding refinement

- [ ] Classify existing implementation as fulfilled / needs adaptation / missing; size only the actual delta.
- [ ] Record required EN-01/EN-02 decisions and affected error codes.
- [ ] Agree concrete fixtures, expected values, and test responsibility.
- [ ] Estimate effort and task boundaries together; this PBI is not yet ready.

## Acceptance and evidence

The Product Owner or RE/UX reviews the visible flow; engineering supplies the relevant integration/domain evidence. Use screenshots where layout or state matters. An existing test may be reused if it actually proves the agreed behavior. A new PBI file does not justify implementing existing functionality again.
