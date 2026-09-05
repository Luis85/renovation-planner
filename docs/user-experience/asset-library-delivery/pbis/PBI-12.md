---
id: PBI-12
type: PBI
status: designed
epic: Asset library
feature: F03
priority: P0
estimate: null
assignee: null
depends_on: [PBI-06]
screens: [AL07]
---
# PBI-12 — Inspect the actual asset outline and open it in the designer

## Context and value

**Epic:** Asset library · **Feature:** F03 — Explore usage and source information

As a private renovator, I want to complete this activity independently and understand its outcome, so that my reusable asset definitions and their project relationships remain reliable.

**Outcome:** Inspect the actual asset outline and open it in the designer.

**References:** [AL07](../specification/screens/AL07-shape-and-note.md). The [interaction rules](../specification/interaction-rules.md) and [shared delivery rules](../delivery-rules.md) also apply.

## Preconditions and trigger

Required predecessors: [PBI-06](PBI-06.md). Necessary application collaborators have been checked against the target commit; fixtures include the normal and failure conditions described here. The trigger is the user action in the main flow.

## Main flow

1. Select an asset
2. Inspect the real outline and dimensions or its explicit state
3. Activate Edit shape
4. Open the existing designer on the same asset ID.

## Alternative and error flows

Not read, no shape, unscaled, measured, and damaged are different states. A damaged shape does not expose a known non-functional designer repair route. Values must be finite and include measurement units.

## Postconditions

On success, the observable outcome above is achieved. Read-only and navigation actions do not change asset data. Writes are considered saved only after a confirmed command result; failed read-back is reported separately. Rejection preserves existing data and the affected user input.

## Acceptance criteria

```gherkin
Feature: PBI-12 — Inspect the actual asset outline and open it in the designer
  Scenario: Concrete acceptance example
    Given the geometry read reports a damaged sidecar and the designer cannot repair that failure
    When the user opens the shape section
    Then a read error appears instead of No outline yet and no non-functional designer repair route is offered
```

Every rule under Alternative and error flows is also an individually binding acceptance criterion. Automation must use controlled fixtures for each distinct condition; a screenshot does not establish data consistency.

## Implementation tasks

- [ ] PBI-12-T01: Use AssetMark and AssetInspectorShape with existing geometry read models.
- [ ] PBI-12-T02: Render typed states and text alternatives.
- [ ] PBI-12-T03: Reuse designer reveal.
- [ ] PBI-12-T04: Test damaged sidecars, missing shapes, and selection tickets.
- [ ] PBI-12-T05: Update the affected screen specification and actual state capture; record remaining deviations.

## Scope boundary

No new designer or sidecar repair capability; that remains separate scope.

## Definition of Ready and outstanding refinement

- [ ] Classify existing implementation as fulfilled / needs adaptation / missing; size only the actual delta.
- [ ] Record required EN-01/EN-02 decisions and affected error codes.
- [ ] Agree concrete fixtures, expected values, and test responsibility.
- [ ] Estimate effort and task boundaries together; this PBI is not yet ready.

## Acceptance and evidence

The Product Owner or RE/UX reviews the visible flow; engineering supplies the relevant integration/domain evidence. Use screenshots where layout or state matters. An existing test may be reused if it actually proves the agreed behavior. A new PBI file does not justify implementing existing functionality again.
