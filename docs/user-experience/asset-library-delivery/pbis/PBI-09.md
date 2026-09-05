---
id: PBI-09
type: PBI
status: designed
epic: Asset library
feature: F02
priority: P0
estimate: null
assignee: null
depends_on: [PBI-01, PBI-06]
screens: [AL03, AL08]
---
# PBI-09 — Create a new asset without an existing project

## Context and value

**Epic:** Asset library · **Feature:** F02 — Create and maintain definitions

As a private renovator, I want to complete this activity independently and understand its outcome, so that my reusable asset definitions and their project relationships remain reliable.

**Outcome:** Create a new asset without an existing project.

**References:** [AL03](AL03-create-object.md), [AL08](../specification/screens/AL08-empty-library.md). The [interaction rules](interaction-rules.md) and [shared delivery rules](delivery-rules.md) also apply.

## Preconditions and trigger

Required predecessors: [PBI-01](PBI-01.md), [PBI-06](PBI-06.md). Necessary application collaborators have been checked against the target commit; fixtures include the normal and failure conditions described here. The trigger is the user action in the main flow.

## Main flow

1. Choose New asset from an empty or populated library
2. Enter required data deliberately
3. Create the asset
4. See it selected in the appropriate category.

## Alternative and error flows

Cancel creates no file. An unknown price is not replaced with zero. Missing geometry does not prevent creation. Similar names may produce a hint but are never merged automatically.

## Postconditions

On success, the observable outcome above is achieved. Read-only and navigation actions do not change asset data. Writes are considered saved only after a confirmed command result; failed read-back is reported separately. Rejection preserves existing data and the affected user input.

## Acceptance criteria

```gherkin
Feature: PBI-09 — Create a new asset without an existing project
  Scenario: Concrete acceptance example
    Given a vault contains neither projects nor assets
    When the user creates an asset with a valid name, category, unit, and deliberate price but no outline
    Then exactly one new asset note exists and the asset is selected in its category
```

Every rule under Alternative and error flows is also an individually binding acceptance criterion. Automation must use controlled fixtures for each distinct condition; a screenshot does not establish data consistency.

## Implementation tasks

- [ ] PBI-09-T01: Use the existing NewAssetForm and CreateAsset.
- [ ] PBI-09-T02: Make defaults and currency explicit.
- [ ] PBI-09-T03: Connect protection for open drafts.
- [ ] PBI-09-T04: Preserve form errors and input.
- [ ] PBI-09-T05: Prevent duplicate creation.
- [ ] PBI-09-T06: Verify read-back and selection after creation.
- [ ] PBI-09-T07: Update the affected screen specification and actual state capture; record remaining deviations.

## Scope boundary

No geometry prerequisite, import, or automatic example data.

## Definition of Ready and outstanding refinement

- [ ] Classify existing implementation as fulfilled / needs adaptation / missing; size only the actual delta.
- [ ] Record required EN-01/EN-02 decisions and affected error codes.
- [ ] Agree concrete fixtures, expected values, and test responsibility.
- [ ] Estimate effort and task boundaries together; this PBI is not yet ready.

## Acceptance and evidence

The Product Owner or RE/UX reviews the visible flow; engineering supplies the relevant integration/domain evidence. Use screenshots where layout or state matters. An existing test may be reused if it actually proves the agreed behavior. A new PBI file does not justify implementing existing functionality again.
