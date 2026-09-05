---
id: PBI-13
type: PBI
status: in-review
epic: Asset library
feature: F04
priority: P0
estimate: null
assignee: null
depends_on: [PBI-04]
screens: [AL09]
---
# PBI-13 — Keep valid content after loading failures and retry the affected read

Implementation and test evidence: [delivery record](../delivery-record.md). Engineering implementation is in review; the acceptance checklist remains for reviewer and real-vault confirmation.

## Context and value

**Epic:** Asset library · **Feature:** F04 — Handle errors and manage assets safely

As a private renovator, I want to complete this activity independently and understand its outcome, so that my reusable asset definitions and their project relationships remain reliable.

**Outcome:** Keep valid content after loading failures and retry the affected read.

**References:** [AL09](../specification/screens/AL09-loading-and-errors.md). The [interaction rules](../specification/interaction-rules.md) and [shared delivery rules](../delivery-rules.md) also apply.

## Preconditions and trigger

Required predecessors: [PBI-04](PBI-04.md). Necessary application collaborators have been checked against the target commit; fixtures include the normal and failure conditions described here. The trigger is the user action in the main flow.

## Main flow

1. Load the library or a section
2. Read a specific explanation when loading fails
3. Keep valid previous content where available
4. Retry the failed read.

## Alternative and error flows

An initial failure does not show false emptiness. A library containing only unreadable files is not treated as empty. A newer schema version asks for a plugin update rather than inappropriate field repair.

## Postconditions

On success, the observable outcome above is achieved. Read-only and navigation actions do not change asset data. Writes are considered saved only after a confirmed command result; failed read-back is reported separately. Rejection preserves existing data and the affected user input.

## Acceptance criteria

```gherkin
Feature: PBI-13 — Keep valid content after loading failures and retry the affected read
  Scenario: Concrete acceptance example
    Given the library shows a valid catalogue and a subsequent refresh fails
    When the user inspects the state and activates Refresh
    Then the catalogue remains visible with a notice and only the read is repeated
```

Every rule under Alternative and error flows is also an individually binding acceptance criterion. Automation must use controlled fixtures for each distinct condition; a screenshot does not establish data consistency.

## Implementation tasks

- [ ] PBI-13-T01: Model initial loading, stale data, and section failures separately.
- [ ] PBI-13-T02: Map known refusals to useful actions.
- [ ] PBI-13-T03: Mark previous data as requiring refresh.
- [ ] PBI-13-T04: Test retry granularity and selection races.
- [ ] PBI-13-T05: Update the affected screen specification and actual state capture; record remaining deviations.

## Scope boundary

No blanket leaf reset or repeated write during a read retry.

## Definition of Ready and outstanding refinement

- [ ] Classify existing implementation as fulfilled / needs adaptation / missing; size only the actual delta.
- [ ] Record required EN-01/EN-02 decisions and affected error codes.
- [ ] Agree concrete fixtures, expected values, and test responsibility.
- [ ] Estimate effort and task boundaries together; this PBI is not yet ready.

## Acceptance and evidence

The Product Owner or RE/UX reviews the visible flow; engineering supplies the relevant integration/domain evidence. Use screenshots where layout or state matters. An existing test may be reused if it actually proves the agreed behavior. A new PBI file does not justify implementing existing functionality again.
