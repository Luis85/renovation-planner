---
id: PBI-07
type: PBI
status: in-review
epic: Asset library
feature: F02
priority: P0
estimate: null
assignee: null
depends_on: [PBI-05, PBI-10]
screens: [AL04, AL06]
---
# PBI-07 — Change the library price while preserving project-specific prices

Implementation and test evidence: [delivery record](../delivery-record.md). Engineering implementation is in review; the acceptance checklist remains for reviewer and real-vault confirmation.

## Context and value

**Epic:** Asset library · **Feature:** F02 — Create and maintain definitions

As a private renovator, I want to complete this activity independently and understand its outcome, so that my reusable asset definitions and their project relationships remain reliable.

**Outcome:** Change the library price while preserving project-specific prices.

**References:** [AL04](../specification/screens/AL04-edit-definition.md), [AL06](../specification/screens/AL06-usage-and-price.md). The [interaction rules](../specification/interaction-rules.md) and [shared delivery rules](../delivery-rules.md) also apply.

## Preconditions and trigger

Required predecessors: [PBI-05](PBI-05.md), [PBI-10](PBI-10.md). Necessary application collaborators have been checked against the target commit; fixtures include the normal and failure conditions described here. The trigger is the user action in the main flow.

## Main flow

1. Read usage and price sources
2. Edit the shared price
3. Save
4. See the confirmed library price and unchanged project overrides.

## Alternative and error flows

Invalid or negative input is rejected. Currencies are not converted automatically. The UI does not claim that project costs have been updated solely because the asset write succeeded.

## Postconditions

On success, the observable outcome above is achieved. Read-only and navigation actions do not change asset data. Writes are considered saved only after a confirmed command result; failed read-back is reported separately. Rejection preserves existing data and the affected user input.

## Acceptance criteria

```gherkin
Feature: PBI-07 — Change the library price while preserving project-specific prices
  Scenario: Concrete acceptance example
    Given an asset costs 34.95 EUR per m² and project B has its own price of 31.00 EUR per m²
    When the user successfully changes the library price to 36.90 EUR per m²
    Then the library price is 36.90 EUR per m² and B’s override remains 31.00 EUR per m²
```

Every rule under Alternative and error flows is also an individually binding acceptance criterion. Automation must use controlled fixtures for each distinct condition; a screenshot does not establish data consistency.

## Implementation tasks

- [ ] PBI-07-T01: Use the Money and Currency contracts from EN-01.
- [ ] PBI-07-T02: Format the shared price field with its currency.
- [ ] PBI-07-T03: Connect existing cascade and refusal paths.
- [ ] PBI-07-T04: Test unchanged overrides and confirmed updates.
- [ ] PBI-07-T05: Verify that historical actual costs remain unchanged.
- [ ] PBI-07-T06: Update the affected screen specification and actual state capture; record remaining deviations.

## Scope boundary

No override editing in the library, exchange rates, or catalogue total.

## Definition of Ready and outstanding refinement

- [ ] Classify existing implementation as fulfilled / needs adaptation / missing; size only the actual delta.
- [ ] Record required EN-01/EN-02 decisions and affected error codes.
- [ ] Agree concrete fixtures, expected values, and test responsibility.
- [ ] Estimate effort and task boundaries together; this PBI is not yet ready.

## Acceptance and evidence

The Product Owner or RE/UX reviews the visible flow; engineering supplies the relevant integration/domain evidence. Use screenshots where layout or state matters. An existing test may be reused if it actually proves the agreed behavior. A new PBI file does not justify implementing existing functionality again.
