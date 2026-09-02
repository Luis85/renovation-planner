---
type: Task
parent: "[[Plans and background import]]"
order: 30
status: New
horizon: "MVP"
release: "[[MVP]]"
dependsOn: "[[Scale calibration]]"
---

# Recover missing, replace and remove Reference sources

## Evidence

M06 and the canvas concept require an unreadable import to leave project geometry intact and allow
retry, another file or continuation without a plan.

## Why it matters

Vault files can move or fail to decode; reference failure must not become Floor failure.

## Approach

Model missing/unreadable source status independently from plan hydration. Implement replace/remove
as reversible commands that retain the prior reference until successful completion. Test cancel,
write failures, stale read-back, reload and source-note/file opening outside the canvas.

## Acceptance criteria

- Missing source leaves Rooms/Walls usable and reports a persistent reference warning.
- Cancelled/failed replace preserves the old committed reference.
- Remove and undo restore configuration deterministically.
- Retry repeats only the failed read.

## Risks

Object URLs and raster resources can leak across retries; verify cleanup on replace, cancel and unmount.

## Outcome

Reference-source problems are recoverable without risking the Floor's editable data.
