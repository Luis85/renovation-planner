---
id: PBI-04
type: PBI
status: designed
epic: Asset library
feature: F02
priority: P0
estimate: null
assignee: null
depends_on: [PBI-02]
screens: [AL01, AL07]
---
# PBI-04 — Inspect the complete definition of a selected asset

## Context and value

**Epic:** Asset library · **Feature:** F02 — Create and maintain definitions

As a private renovator, I want to complete this activity independently and understand its outcome, so that my reusable asset definitions and their project relationships remain reliable.

**Outcome:** Inspect the complete definition of a selected asset.

**References:** [AL01](AL01-selected-object.md), [AL07](../specification/screens/AL07-shape-and-note.md). The [interaction rules](interaction-rules.md) and [shared delivery rules](delivery-rules.md) also apply.

## Preconditions and trigger

Required predecessors: [PBI-02](PBI-02.md). Necessary application collaborators have been checked against the target commit; fixtures include the normal and failure conditions described here. The trigger is the user action in the main flow.

## Main flow

1. Select an asset
2. Inspect its identity, existing metadata, price with currency and unit, and independently loaded geometry and usage.

## Alternative and error flows

A section that has not loaded does not display zero values. Fields omitted from the mockup, such as height, remain part of the production contract.

## Postconditions

On success, the observable outcome above is achieved. Read-only and navigation actions do not change asset data. Writes are considered saved only after a confirmed command result; failed read-back is reported separately. Rejection preserves existing data and the affected user input.

## Acceptance criteria

```gherkin
Feature: PBI-04 — Inspect the complete definition of a selected asset
  Scenario: Concrete acceptance example
    Given an asset has a library price in USD and a separately stored height
    When the user opens its definition
    Then USD and the actual height with its unit are displayed instead of EUR or an invented default
```

Every rule under Alternative and error flows is also an individually binding acceptance criterion. Automation must use controlled fixtures for each distinct condition; a screenshot does not establish data consistency.

## Implementation tasks

- [ ] PBI-04-T01: Apply the field matrix from EN-01.
- [ ] PBI-04-T02: Reuse AssetInspector and its section components.
- [ ] PBI-04-T03: Group additional existing properties meaningfully.
- [ ] PBI-04-T04: Display currency, unit, and section status.
- [ ] PBI-04-T05: Check large values and long labels.
- [ ] PBI-04-T06: Update the affected screen specification and actual state capture; record remaining deviations.

## Scope boundary

No new procurement, quantity, or project fields on the asset definition.

## Definition of Ready and outstanding refinement

- [ ] Classify existing implementation as fulfilled / needs adaptation / missing; size only the actual delta.
- [ ] Record required EN-01/EN-02 decisions and affected error codes.
- [ ] Agree concrete fixtures, expected values, and test responsibility.
- [ ] Estimate effort and task boundaries together; this PBI is not yet ready.

## Acceptance and evidence

The Product Owner or RE/UX reviews the visible flow; engineering supplies the relevant integration/domain evidence. Use screenshots where layout or state matters. An existing test may be reused if it actually proves the agreed behavior. A new PBI file does not justify implementing existing functionality again.
