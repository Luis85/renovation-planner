---
type: Task
parent: "[[Draw and name a rectangular room]]"
order: 60
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Announce live Room dimensions without repetition and refuse out-of-bounds input

## Evidence

M03 requires live dimensions without excessive announcements and explicit validation for numeric
input that would place the Room outside editable bounds.

## Why it matters

Rapid pointer updates can overwhelm assistive technology, while a plausible numeric value can still
produce spatially invalid geometry.

## Approach

Render live width, depth and area continuously, but announce only meaningful settled changes through a
deduplicated status channel. Validate numeric drafts against complete geometry and Floor bounds before Finish.

## Acceptance criteria

- Visible dimensions remain current throughout drag and numeric editing.
- Assistive announcements are deduplicated and do not repeat on immaterial pointer movement.
- Out-of-bounds numeric input has an explicit field or form error and cannot finish.
- Correcting the value clears the stale error while retaining the draft.

## Risks

Throttling visual updates together with announcements would make the preview lag.

## Outcome

Live Room measurements stay informative without becoming repetitive, and precise invalid input is refused clearly.
