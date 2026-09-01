---
type: Task
parent: "[[Present complete homeowner language in English and German]]"
order: 10
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Inventory released English and German strings

## Evidence

Phase 12 requires complete English and German across normal, failure, busy, and recovery states.

## Why it matters

Happy-path locale completeness can leave the most consequential states untranslated.

## Approach

Enumerate visible and accessible strings from each applicable M00–M17 state and map them to the
canonical locale keys, including notices, dialogs, disabled reasons, empty states, and M15.

## Acceptance criteria

- Every released state has an English and German entry.
- Accessible names and announcements are included.
- Unimplemented states are marked not applicable rather than complete.

## Risks

Static key scans can miss strings composed one hop before rendering.

## Outcome

The release has a screen-by-screen language inventory.
