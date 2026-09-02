---
type: Task
parent: "[[Produce auditable release evidence]]"
order: 30
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Execute the manual release evidence matrix

## Evidence

Obsidian behavior, community themes, real input, screen readers, visual layout, and comprehension
cannot be fully verified by repository automation.

## Why it matters

Those checks are release evidence, not optional polish, and must not be folded into an automated
pass.

## Approach

Run the linked live-vault cases against the fixed candidate. Record host/platform, theme/layout,
locale, assistive technology or device, steps, observer, date, raw result, and defects separately.

## Acceptance criteria

- Every manual-only criterion has a pass, failure, skip, or not-applicable record.
- Screenshots are not used as proof of keyboard, screen-reader, or comprehension claims.
- Critical failures block sign-off.

## Risks

Manual results can become stale after a build change; bind them to the artifact hash.

## Outcome

Manual evidence remains explicit, reviewable, and separate from automation.
