---
type: Task
parent: "[[Define and compare an intended room state]]"
order: 30
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Compare existing and intended room details on read

## Evidence

The mental model's change summary derives Existing → Planned differences, and M09 requires the
current structure to remain available for comparison. The plans prohibit a second persisted
truth.

## Why it matters

A stored comparison becomes stale as soon as either side changes and can falsely report that a
room is coherent.

## Approach

Build a selected-room comparison read model from current authority-owned Existing and Planned
records. Report changed attributes and distinguish equal, unspecified, unavailable and unreadable
inputs.

## Acceptance criteria

- Comparison is derived on read and stores no geometry or duplicate state.
- Editing either side changes the next comparison result.
- A missing source is reported as unspecified, not equal.
- An unreadable side does not make the two sides appear equal.

## Risks

Flattening partial reads may turn unknown into no difference.

## Outcome

A renovator gets a current, explainable description of how the intended room differs from the
existing one.
