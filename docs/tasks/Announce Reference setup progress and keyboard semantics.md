---
type: Task
parent: "[[Upload an image to be used as background]]"
order: 60
status: New
horizon: "MVP"
release: "[[MVP]]"
dependsOn: "[[Scale calibration]]"
---

# Announce Reference setup progress and keyboard semantics

## Evidence

M06 defines Prepare plan, Set scale and Review as a three-step Reference setup workflow and
requires the current step to be announced and keyboard navigable.

## Why it matters

A visual stepper alone does not tell assistive-technology users where they are, and global key
handling can give Enter or Escape a different meaning from the focused step.

## Approach

Expose the ordered setup steps, completed state and current step semantically. Announce genuine
step transitions, and publish the current step's available keyboard actions and precedence through
the setup instructions and focus model.

## Acceptance criteria

- Prepare plan, Set scale and Review have an ordered semantic representation with exactly one
  current step.
- Entering a new step announces its name, position and concise purpose once.
- Keyboard users can reach completed or permitted steps without bypassing validation.
- Enter, Escape and arrow-key behavior is defined for each step and does not override a focused
  field, menu or dialog.
- Disabled future steps expose why they cannot yet be entered.
- Re-rendering unchanged setup state does not repeat the progress announcement.

## Risks

Competing canvas, dialog and stepper key handlers may each claim the same key, while an over-eager
live region may announce every draft update.

## Outcome

Reference setup communicates progress and the current keyboard contract without requiring users
to infer either from visual layout.
