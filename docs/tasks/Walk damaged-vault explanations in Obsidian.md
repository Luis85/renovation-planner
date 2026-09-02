---
type: Task
parent: "[[Detect and explain unhealthy vault data]]"
order: 30
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Walk damaged-vault explanations in Obsidian

## Evidence

Source-note navigation, Obsidian file behavior, and whether recovery copy is understandable need
a live host and reader.

## Why it matters

Correct detection is not enough if the renovator cannot locate the problem or choose a safe step.

## Approach

Open planted damaged notes in a release vault, run health reporting, follow source actions, copy
diagnostics, and ask a reader to explain what is wrong and what they would do next.

## Acceptance criteria

- Each finding opens or identifies the intended source safely.
- The reader distinguishes unreadable, missing, duplicate, and unsupported-version cases.
- The copied report contains no observed project content.

## Risks

The tester may know internal terminology; use a homeowner-oriented participant where possible.

## Outcome

Live evidence connects canonical findings to understandable safe actions.
