---
type: Task
parent: "[[Upload an image to be used as background]]"
order: 30
status: New
horizon: "MVP"
release: "[[MVP]]"
dependsOn: "[[Scale calibration]]"
---

# Replace or cancel Reference setup safely

## Evidence

M06 requires cancel to restore prior committed state, while Feature B requires reversible completed
changes and safe failure behavior.

## Why it matters

Replacing a working reference must not destroy it before the new source has decoded, calibrated and saved.

## Approach

Treat setup as a draft over an optional previous configuration. Commit replacement through a
compensated reversible command only after review; preserve the old source through every earlier
step. Test decode, calibration, write and read-back failures, undo/redo, reload and cleanup.

## Acceptance criteria

- Cancel at any setup step restores the previous reference.
- Failed replacement leaves the previous committed source usable.
- Successful replacement survives reload and undoes/redoes once.
- Post-write read failure retries hydration without reimporting.

## Risks

File-link replacement and configuration writes may fail separately; detonate both orderings.

## Outcome

Reference setup can be abandoned or replaced without losing a known-good source.
