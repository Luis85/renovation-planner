---
id: PBI-16
type: PBI
status: designed
epic: Asset library
feature: F05
priority: P1
estimate: null
assignee: null
depends_on: [PBI-09, PBI-15]
screens: [AL00, AL03, AL04, AL05, AL10]
---
# PBI-16 — Complete library actions using only the keyboard

## Context and value

**Epic:** Asset library · **Feature:** F05 — Use an adaptive and accessible interface

As a private renovator, I want to complete this activity independently and understand its outcome, so that my reusable asset definitions and their project relationships remain reliable.

**Outcome:** Complete library actions using only the keyboard.

**References:** [AL00](../specification/screens/AL00-browse.md), [AL03](../specification/screens/AL03-create-object.md), [AL04](../specification/screens/AL04-edit-definition.md), [AL05](../specification/screens/AL05-unsaved-changes.md), [AL10](../specification/screens/AL10-narrow-and-theme.md). The [interaction rules](../specification/interaction-rules.md) and [shared delivery rules](../delivery-rules.md) also apply.

## Preconditions and trigger

Required predecessors: [PBI-09](PBI-09.md), [PBI-15](PBI-15.md). Necessary application collaborators have been checked against the target commit; fixtures include the normal and failure conditions described here. The trigger is the user action in the main flow.

## Main flow

1. Use search, groups, selection, forms, and dialogs with the keyboard
2. Understand outcomes and status through labels
3. Recover focus after returning.

## Alternative and error flows

Collapsed rows cannot receive focus. A dialog contains focus and restores it meaningfully. Text-field arrow keys are not captured by the catalogue. Host shortcuts remain intact.

## Postconditions

On success, the observable outcome above is achieved. Read-only and navigation actions do not change asset data. Writes are considered saved only after a confirmed command result; failed read-back is reported separately. Rejection preserves existing data and the affected user input.

## Acceptance criteria

```gherkin
Feature: PBI-16 — Complete library actions using only the keyboard
  Scenario: Concrete acceptance example
    Given a user has opened the draft-protection dialog entirely with the keyboard
    When the user presses Esc
    Then the draft is preserved and focus returns meaningfully to the triggering element
```

Every rule under Alternative and error flows is also an individually binding acceptance criterion. Automation must use controlled fixtures for each distinct condition; a screenshot does not establish data consistency.

## Implementation tasks

- [ ] PBI-16-T01: Consolidate existing local keyboard handlers.
- [ ] PBI-16-T02: Check button/current/expanded semantics.
- [ ] PBI-16-T03: Apply dialog focus and restrained aria-live announcements.
- [ ] PBI-16-T04: Run a keyboard walkthrough and screen-reader spot check.
- [ ] PBI-16-T05: Check German and English including long strings.
- [ ] PBI-16-T06: Update the affected screen specification and actual state capture; record remaining deviations.

## Scope boundary

This does not replace baseline accessibility in other PBIs; it verifies the end-to-end flow.

## Definition of Ready and outstanding refinement

- [ ] Classify existing implementation as fulfilled / needs adaptation / missing; size only the actual delta.
- [ ] Record required EN-01/EN-02 decisions and affected error codes.
- [ ] Agree concrete fixtures, expected values, and test responsibility.
- [ ] Estimate effort and task boundaries together; this PBI is not yet ready.

## Acceptance and evidence

The Product Owner or RE/UX reviews the visible flow; engineering supplies the relevant integration/domain evidence. Use screenshots where layout or state matters. An existing test may be reused if it actually proves the agreed behavior. A new PBI file does not justify implementing existing functionality again.
