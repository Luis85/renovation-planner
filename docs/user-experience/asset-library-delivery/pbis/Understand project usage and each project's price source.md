---
id: PBI-10
type: PBI
status: in-review
epic: Asset library
feature: F03
priority: P0
estimate: null
assignee: null
depends_on: [PBI-04]
screens: [AL06]
---
# PBI-10 — Understand project usage and each project’s price source

Implementation and test evidence: [delivery record](../delivery-record.md). Engineering implementation is in review; the acceptance checklist remains for reviewer and real-vault confirmation.

## Context and value

**Epic:** Asset library · **Feature:** F03 — Explore usage and source information

As a private renovator, I want to complete this activity independently and understand its outcome, so that my reusable asset definitions and their project relationships remain reliable.

**Outcome:** Understand project usage and each project’s price source.

**References:** [AL06](../specification/screens/AL06-usage-and-price.md). The [interaction rules](../specification/interaction-rules.md) and [shared delivery rules](../delivery-rules.md) also apply.

## Preconditions and trigger

Required predecessors: [PBI-04](PBI-04.md). Necessary application collaborators have been checked against the target commit; fixtures include the normal and failure conditions described here. The trigger is the user action in the main flow.

## Main flow

1. Select an asset
2. Read projects with requirement counts and library or project-specific prices
3. Recognize the status of the usage check.

## Alternative and error flows

A failed read is not equivalent to no usage. An override is explicitly marked. Reselection or refresh uses current data; a late response does not show another asset.

## Postconditions

On success, the observable outcome above is achieved. Read-only and navigation actions do not change asset data. Writes are considered saved only after a confirmed command result; failed read-back is reported separately. Rejection preserves existing data and the affected user input.

## Acceptance criteria

```gherkin
Feature: PBI-10 — Understand project usage and each project’s price source
  Scenario: Concrete acceptance example
    Given project A uses the library price and project B has its own price for the same asset
    When the user opens the asset’s usage section
    Then A is labelled Library price and B is labelled Project-specific price
```

Every rule under Alternative and error flows is also an individually binding acceptance criterion. Automation must use controlled fixtures for each distinct condition; a screenshot does not establish data consistency.

## Implementation tasks

- [ ] PBI-10-T01: Connect AssetInspectorUsedIn to existing reference and override queries.
- [ ] PBI-10-T02: Maintain an independent read status.
- [ ] PBI-10-T03: Clearly label reference counts.
- [ ] PBI-10-T04: Check actual event coverage without implying unsupported freshness.
- [ ] PBI-10-T05: Test empty, failed, and override fixtures.
- [ ] PBI-10-T06: Update the affected screen specification and actual state capture; record remaining deviations.

## Scope boundary

No inventory quantities or cross-project totals. Project navigation is covered by PBI-11.

## Definition of Ready and outstanding refinement

- [ ] Classify existing implementation as fulfilled / needs adaptation / missing; size only the actual delta.
- [ ] Record required EN-01/EN-02 decisions and affected error codes.
- [ ] Agree concrete fixtures, expected values, and test responsibility.
- [ ] Estimate effort and task boundaries together; this PBI is not yet ready.

## Acceptance and evidence

The Product Owner or RE/UX reviews the visible flow; engineering supplies the relevant integration/domain evidence. Use screenshots where layout or state matters. An existing test may be reused if it actually proves the agreed behavior. A new PBI file does not justify implementing existing functionality again.
