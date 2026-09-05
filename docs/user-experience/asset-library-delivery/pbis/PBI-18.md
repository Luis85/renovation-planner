---
id: PBI-18
type: PBI
status: designed
epic: Asset library
feature: F03
priority: P1
estimate: null
assignee: null
depends_on: [EN-01, PBI-11]
screens: [AL07]
---
# PBI-18 — Access asset information through native Obsidian notes and Bases

## Context and value

**Epic:** Asset library · **Feature:** F03 — Explore usage and source information

As a private renovator, I want to complete this activity independently and understand its outcome, so that my reusable asset definitions and their project relationships remain reliable.

**Outcome:** Access asset information through native Obsidian notes and Bases.

**References:** [AL07](../specification/screens/AL07-shape-and-note.md). The [interaction rules](interaction-rules.md) and [shared delivery rules](delivery-rules.md) also apply.

## Preconditions and trigger

Required predecessors: [EN-01](EN-01.md), [PBI-11](PBI-11.md). Necessary application collaborators have been checked against the target commit; fixtures include the normal and failure conditions described here. The trigger is the user action in the main flow.

## Main flow

1. Follow the documented native access route
2. Open the asset note or an appropriate Bases view
3. Read catalogue-compatible metadata.

## Alternative and error flows

The custom UI is not the only access route. Only existing production frontmatter fields are promised as Bases columns. Geometry and cross-project joins are not advertised as native Bases capabilities.

## Postconditions

On success, the observable outcome above is achieved. Read-only and navigation actions do not change asset data. Writes are considered saved only after a confirmed command result; failed read-back is reported separately. Rejection preserves existing data and the affected user input.

## Acceptance criteria

```gherkin
Feature: PBI-18 — Access asset information through native Obsidian notes and Bases
  Scenario: Concrete acceptance example
    Given a real asset note contains frontmatter fields confirmed by the data contract
    When the user follows the supplied Bases recipe
    Then the supported metadata can be read outside the dedicated library view
```

Every rule under Alternative and error flows is also an individually binding acceptance criterion. Automation must use controlled fixtures for each distinct condition; a screenshot does not establish data consistency.

## Implementation tasks

- [ ] PBI-18-T01: Check the existing Bases strategy from EN-01.
- [ ] PBI-18-T02: Prefer extending an existing recipe or provide a documented recipe.
- [ ] PBI-18-T03: Reconcile note and field names with persistence.
- [ ] PBI-18-T04: Verify the route with a real asset note.
- [ ] PBI-18-T05: Update the affected screen specification and actual state capture; record remaining deviations.

## Scope boundary

No automatic .base file creation without a decided strategy and no new Bases engine.

## Definition of Ready and outstanding refinement

- [ ] Classify existing implementation as fulfilled / needs adaptation / missing; size only the actual delta.
- [ ] Record required EN-01/EN-02 decisions and affected error codes.
- [ ] Agree concrete fixtures, expected values, and test responsibility.
- [ ] Estimate effort and task boundaries together; this PBI is not yet ready.

## Acceptance and evidence

The Product Owner or RE/UX reviews the visible flow; engineering supplies the relevant integration/domain evidence. Use screenshots where layout or state matters. An existing test may be reused if it actually proves the agreed behavior. A new PBI file does not justify implementing existing functionality again.
