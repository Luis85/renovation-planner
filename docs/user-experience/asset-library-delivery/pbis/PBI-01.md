---
id: PBI-01
type: PBI
status: designed
epic: Asset library
feature: F01
priority: P0
estimate: null
assignee: null
depends_on: [EN-01]
screens: [AL00, AL08]
---
# PBI-01 — Open and resume the shared asset library

## Context and value

**Epic:** Asset library · **Feature:** F01 — Find and browse the catalogue

As a private renovator, I want to complete this activity independently and understand its outcome, so that my reusable asset definitions and their project relationships remain reliable.

**Outcome:** Open and resume the shared asset library.

**References:** [AL00](AL00-browse.md), [AL08](../specification/screens/AL08-empty-library.md). The [interaction rules](interaction-rules.md) and [shared delivery rules](delivery-rules.md) also apply.

## Preconditions and trigger

Required predecessors: [EN-01](EN-01.md). Necessary application collaborators have been checked against the target commit; fixtures include the normal and failure conditions described here. The trigger is the user action in the main flow.

## Main flow

1. Activate the command or existing entry point
2. Reuse the existing library leaf
3. Load the catalogue
4. Restore the leaf’s valid selection and expanded groups.

## Alternative and error flows

The entry point remains available in a vault without projects. A saved selection that is no longer valid produces an understandable neutral state, not the details of another asset.

## Postconditions

On success, the observable outcome above is achieved. Read-only and navigation actions do not change asset data. Writes are considered saved only after a confirmed command result; failed read-back is reported separately. Rejection preserves existing data and the affected user input.

## Acceptance criteria

```gherkin
Feature: PBI-01 — Open and resume the shared asset library
  Scenario: Concrete acceptance example
    Given a vault contains no projects and two asset notes
    When the user activates the open-library command twice
    Then exactly one library leaf exists and both assets are accessible
```

Every rule under Alternative and error flows is also an individually binding acceptance criterion. Automation must use controlled fixtures for each distinct condition; a screenshot does not establish data consistency.

## Implementation tasks

- [ ] PBI-01-T01: Check the existing reveal/singleton path and both entry points.
- [ ] PBI-01-T02: Bind view-state restoration to valid asset IDs.
- [ ] PBI-01-T03: Distinguish initial loading from a genuinely empty library.
- [ ] PBI-01-T04: Add an integration check for an empty vault and repeated opening.
- [ ] PBI-01-T05: Update the affected screen specification and actual state capture; record remaining deviations.

## Scope boundary

No new global navigation or second ribbon icon.

## Definition of Ready and outstanding refinement

- [ ] Classify existing implementation as fulfilled / needs adaptation / missing; size only the actual delta.
- [ ] Record required EN-01/EN-02 decisions and affected error codes.
- [ ] Agree concrete fixtures, expected values, and test responsibility.
- [ ] Estimate effort and task boundaries together; this PBI is not yet ready.

## Acceptance and evidence

The Product Owner or RE/UX reviews the visible flow; engineering supplies the relevant integration/domain evidence. Use screenshots where layout or state matters. An existing test may be reused if it actually proves the agreed behavior. A new PBI file does not justify implementing existing functionality again.
