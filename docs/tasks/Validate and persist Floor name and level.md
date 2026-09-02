---
type: Task
parent: "[[Choose how to start a floor]]"
order: 40
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Validate and persist Floor name and level

## Evidence

M05 includes editable Floor name and level in the start state and requires validation through the Floor command.

## Why it matters

The start choices are anchored to a Floor whose identity must remain understandable after setup and reload.

## Approach

Expose name and level through labelled fields in the Floor Inspector, route both through one validated Plan/Floor
update boundary, preserve rejected drafts, and verify undo, reload and localized errors.

## Acceptance criteria

- Valid Floor name and level persist through the canonical update command.
- Invalid values remain editable with field-specific feedback and no write.
- Undo/redo and reload preserve both fields coherently.
- Editing metadata does not choose or dismiss a Floor-start path.

## Risks

Treating level as display-only can make ordering disagree after reload.

## Outcome

An empty Floor can be named and positioned accurately before spatial creation begins.
