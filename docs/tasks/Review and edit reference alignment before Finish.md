---
type: Task
parent: "[[Upload an image to be used as background]]"
order: 50
status: New
horizon: "MVP"
release: "[[MVP]]"
dependsOn: "[[Scale calibration]]"
---

# Review and edit reference alignment before Finish

## Evidence

M06 makes Review a distinct step for scale, opacity, alignment and lock before final persistence.

## Why it matters

A correctly scaled source can still be offset or oriented incorrectly for tracing.

## Approach

Present the prepared reference over Floor context with reviewable scale, alignment, opacity and lock. Allow supported
alignment correction as draft state, provide a route back to preparation or distance selection, and persist only on Finish.

## Acceptance criteria

- Review shows the effective scale and alignment before Finish.
- Supported alignment adjustments preview immediately and remain uncommitted.
- The renovator can revisit preparation or calibration without losing unrelated draft choices.
- Finish persists the reviewed configuration once; cancel restores the previous reference.

## Risks

Applying alignment eagerly can move a known-good reference before the replacement is accepted.

## Outcome

Reference setup ends with an explicit, editable alignment review rather than an unseen final transform.
