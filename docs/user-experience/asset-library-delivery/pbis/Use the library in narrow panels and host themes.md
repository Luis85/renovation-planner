---
id: PBI-15
type: PBI
status: in-review
epic: Asset library
feature: F05
priority: P0
estimate: null
assignee: null
depends_on: [PBI-03, PBI-06]
screens: [AL10]
---
# PBI-15 — Use the library in narrow panels and host themes

Implementation and test evidence: [delivery record](../delivery-record.md). Engineering implementation is in review; the acceptance checklist remains for reviewer and real-vault confirmation.

## Context and value

**Epic:** Asset library · **Feature:** F05 — Use an adaptive and accessible interface

As a private renovator, I want to complete this activity independently and understand its outcome, so that my reusable asset definitions and their project relationships remain reliable.

**Outcome:** Use the library in narrow panels and host themes.

**References:** [AL10](../specification/screens/AL10-narrow-and-theme.md). The [interaction rules](../specification/interaction-rules.md) and [shared delivery rules](../delivery-rules.md) also apply.

## Preconditions and trigger

Required predecessors: [PBI-03](PBI-03.md), [PBI-06](PBI-06.md). Necessary application collaborators have been checked against the target commit; fixtures include the normal and failure conditions described here. The trigger is the user action in the main flow.

## Main flow

1. Reduce leaf width
2. Use the list or detail view with Back
3. Change width and theme
4. Preserve selection, search, and draft.

## Alternative and error flows

At 460px there is no horizontal page scrolling. Hidden columns also lose their headings. A short viewport allows scrolling while status remains visible. Custom theme controls appear only in the demo.

## Postconditions

On success, the observable outcome above is achieved. Read-only and navigation actions do not change asset data. Writes are considered saved only after a confirmed command result; failed read-back is reported separately. Rejection preserves existing data and the affected user input.

## Acceptance criteria

```gherkin
Feature: PBI-15 — Use the library in narrow panels and host themes
  Scenario: Concrete acceptance example
    Given an asset with a changed draft is selected in a wide leaf
    When the user narrows the leaf to 460px and then widens it again
    Then the asset ID and draft are preserved and no horizontal page scrolling occurs
```

Every rule under Alternative and error flows is also an individually binding acceptance criterion. Automation must use controlled fixtures for each distinct condition; a screenshot does not establish data consistency.

## Implementation tasks

- [ ] PBI-15-T01: Use container queries and meaningful minimum widths.
- [ ] PBI-15-T02: Reuse inspector content.
- [ ] PBI-15-T03: Integrate local panel mode and focus restoration.
- [ ] PBI-15-T04: Apply Obsidian tokens.
- [ ] PBI-15-T05: Check 1440/720/560/460px, short height, and three themes.
- [ ] PBI-15-T06: Update the affected screen specification and actual state capture; record remaining deviations.

## Scope boundary

No separate mobile product; 460px tests a leaf, not mobile platform certification.

## Definition of Ready and outstanding refinement

- [ ] Classify existing implementation as fulfilled / needs adaptation / missing; size only the actual delta.
- [ ] Record required EN-01/EN-02 decisions and affected error codes.
- [ ] Agree concrete fixtures, expected values, and test responsibility.
- [ ] Estimate effort and task boundaries together; this PBI is not yet ready.

## Acceptance and evidence

The Product Owner or RE/UX reviews the visible flow; engineering supplies the relevant integration/domain evidence. Use screenshots where layout or state matters. An existing test may be reused if it actually proves the agreed behavior. A new PBI file does not justify implementing existing functionality again.
