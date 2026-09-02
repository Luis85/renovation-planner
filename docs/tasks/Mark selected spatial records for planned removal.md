---
type: Task
parent: "[[Define and compare an intended room state]]"
order: 70
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Mark selected spatial records for planned removal

## Evidence

M09 defines removal as planned state rather than deletion, and M11 requires compatible batch
actions to preview affected records and execute as one reversible command.

## Why it matters

Deleting current records destroys the Existing truth, while independent updates can leave a
multi-selection only partly marked.

## Approach

Offer planned removal for compatible selected spatial records through the generic
multi-selection transaction route. Preview targets, create or update planned state only, and
preserve every Existing record.

## Acceptance criteria

- Every target remains present in Existing state.
- Compatible selected targets receive planned-removal state as one reversible action.
- Incompatible targets disable the action with an explanation.
- The impact preview names every affected stable identity before confirmation.
- Failure writes nothing or leaves the established explicit recovery state.

## Risks

Removal may be implemented as geometry deletion or as separate commands without atomicity.

## Outcome

The renovator can plan removal across a compatible selection without erasing what exists now.
