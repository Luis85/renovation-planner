---
id: PBI-03
type: PBI
status: designed
epic: Asset library
feature: F01
priority: P0
estimate: null
assignee: null
depends_on: [PBI-02]
screens: [AL02]
---
# PBI-03 — Find an asset by name, supplier, or SKU

## Context and value

**Epic:** Asset library · **Feature:** F01 — Find and browse the catalogue

As a private renovator, I want to complete this activity independently and understand its outcome, so that my reusable asset definitions and their project relationships remain reliable.

**Outcome:** Find an asset by name, supplier, or SKU.

**References:** [AL02](AL02-search-results.md). The [interaction rules](interaction-rules.md) and [shared delivery rules](delivery-rules.md) also apply.

## Preconditions and trigger

Required predecessors: [PBI-02](PBI-02.md). Necessary application collaborators have been checked against the target commit; fixtures include the normal and failure conditions described here. The trigger is the user action in the main flow.

## Main flow

1. Enter a search term
2. See matching assets in expanded categories
3. Select a result
4. Clear the search and restore the previous groups.

## Alternative and error flows

No matches produces a search-empty state with reset. A selection outside the results remains selected; the wide inspector shows a notice. Searching does not destroy a local draft.

## Postconditions

On success, the observable outcome above is achieved. Read-only and navigation actions do not change asset data. Writes are considered saved only after a confirmed command result; failed read-back is reported separately. Rejection preserves existing data and the affected user input.

## Acceptance criteria

```gherkin
Feature: PBI-03 — Find an asset by name, supplier, or SKU
  Scenario: Concrete acceptance example
    Given the Oak parquet asset has SKU EP-190
    When the user enters " ep-190 " in search
    Then Oak parquet appears in the results
```

Every rule under Alternative and error flows is also an individually binding acceptance criterion. Automation must use controlled fixtures for each distinct condition; a screenshot does not establish data consistency.

## Implementation tasks

- [ ] PBI-03-T01: Consolidate the existing search projection for the agreed fields.
- [ ] PBI-03-T02: Define trimming and case handling.
- [ ] PBI-03-T03: Preserve group expansion before searching.
- [ ] PBI-03-T04: Add empty-result and outside-results feedback.
- [ ] PBI-03-T05: Verify reset, SKU search, and selection preservation.
- [ ] PBI-03-T06: Update the affected screen specification and actual state capture; record remaining deviations.

## Scope boundary

No fuzzy search, external product search, or new persisted asset properties.

## Definition of Ready and outstanding refinement

- [ ] Classify existing implementation as fulfilled / needs adaptation / missing; size only the actual delta.
- [ ] Record required EN-01/EN-02 decisions and affected error codes.
- [ ] Agree concrete fixtures, expected values, and test responsibility.
- [ ] Estimate effort and task boundaries together; this PBI is not yet ready.

## Acceptance and evidence

The Product Owner or RE/UX reviews the visible flow; engineering supplies the relevant integration/domain evidence. Use screenshots where layout or state matters. An existing test may be reused if it actually proves the agreed behavior. A new PBI file does not justify implementing existing functionality again.
