---
id: PBI-14
type: PBI
status: in-review
epic: Asset library
feature: F04
priority: P0
estimate: null
assignee: null
depends_on: [PBI-05, PBI-13]
screens: [AL04, AL09]
---
# PBI-14 — Continue safely after save failures or external changes

Implementation and test evidence: [delivery record](../delivery-record.md). Engineering implementation is in review; the acceptance checklist remains for reviewer and real-vault confirmation.

## Context and value

**Epic:** Asset library · **Feature:** F04 — Handle errors and manage assets safely

As a private renovator, I want to complete this activity independently and understand its outcome, so that my reusable asset definitions and their project relationships remain reliable.

**Outcome:** Continue safely after save failures or external changes.

**References:** [AL04](../specification/screens/AL04-edit-definition.md), [AL09](../specification/screens/AL09-loading-and-errors.md). The [interaction rules](../specification/interaction-rules.md) and [shared delivery rules](../delivery-rules.md) also apply.

## Preconditions and trigger

Required predecessors: [PBI-05](PBI-05.md), [PBI-13](PBI-13.md). Necessary application collaborators have been checked against the target commit; fixtures include the normal and failure conditions described here. The trigger is the user action in the main flow.

## Main flow

1. Save a changed draft
2. Distinguish the outcome
3. Correct rejected input, refresh after a confirmed write with failed read-back, or review differences after a conflict.

## Alternative and error flows

External changes since the draft started are not silently overwritten. An unknown write outcome is resolved before retrying a non-idempotent write. Partial persistence is never presented as complete success.

## Postconditions

On success, the observable outcome above is achieved. Read-only and navigation actions do not change asset data. Writes are considered saved only after a confirmed command result; failed read-back is reported separately. Rejection preserves existing data and the affected user input.

## Acceptance criteria

```gherkin
Feature: PBI-14 — Continue safely after save failures or external changes
  Scenario: Concrete acceptance example
    Given a metadata write is confirmed and its subsequent read-back fails
    When the user activates the offered refresh
    Then no additional write is executed and the refresh notice disappears after a successful read
```

Every rule under Alternative and error flows is also an individually binding acceptance criterion. Automation must use controlled fixtures for each distinct condition; a screenshot does not establish data consistency.

## Implementation tasks

- [ ] PBI-14-T01: Integrate EN-02 outcomes in the form and status bar.
- [ ] PBI-14-T02: Define version checking and conflict resolution.
- [ ] PBI-14-T03: Distinguish read-back failure from write failure.
- [ ] PBI-14-T04: Test controlled faults between write and read.
- [ ] PBI-14-T05: Check draft preservation and retry counts.
- [ ] PBI-14-T06: Update the affected screen specification and actual state capture; record remaining deviations.

## Scope boundary

No invented rollback. Unsupported recovery is explained as a limitation.

## Definition of Ready and outstanding refinement

- [ ] Classify existing implementation as fulfilled / needs adaptation / missing; size only the actual delta.
- [ ] Record required EN-01/EN-02 decisions and affected error codes.
- [ ] Agree concrete fixtures, expected values, and test responsibility.
- [ ] Estimate effort and task boundaries together; this PBI is not yet ready.

## Acceptance and evidence

The Product Owner or RE/UX reviews the visible flow; engineering supplies the relevant integration/domain evidence. Use screenshots where layout or state matters. An existing test may be reused if it actually proves the agreed behavior. A new PBI file does not justify implementing existing functionality again.
