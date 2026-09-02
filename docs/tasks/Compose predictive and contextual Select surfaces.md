---
type: Task
parent: "[[Selection]]"
order: 40
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Compose predictive and contextual Select surfaces

## Evidence

M01 requires hover to preview the target and cursor before selection. The component contract keeps
resting Select/Add primary and limits a selected entity's direct popover to one or two common
actions with Inspector and keyboard equivalents.

## Why it matters

Without predictive feedback, overlapping selection is guesswork; exposing every action beside the
shape turns the canvas into a toolbar and excludes keyboard users.

## Approach

Project deterministic hit-test priority into a non-persistent hover outline and target-appropriate
cursor. Keep Select and Add as the resting surface, then compose a small contextual convenience
surface for the selected type from the same action descriptors used by Inspector and keyboard
routes.

## Acceptance criteria

- Hover outlines the exact stable identity the next selection intent would choose.
- The cursor communicates the available selection or manipulation intent and returns to resting
  Select when no target applies.
- Hover changes neither selection nor persistent data.
- With no selection, Select and Add remain the primary visible actions.
- A selection exposes no more than the approved high-frequency direct conveniences.
- Every direct convenience has an equivalent labelled Inspector route and keyboard-operable route
  dispatching the same intent.
- Unsupported actions are absent or explained rather than rendered as controls that do nothing.

## Risks

Canvas and Inspector action catalogues may drift, or hover may accidentally become a second
selection state.

## Outcome

Select predicts what will happen and offers restrained contextual shortcuts without making the
canvas the only action surface.
