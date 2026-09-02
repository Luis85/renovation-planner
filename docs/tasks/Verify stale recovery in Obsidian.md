---
type: Task
parent: "[[Recover safely from failed writes and stale reads]]"
order: 40
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Verify stale recovery in Obsidian

## Evidence

Host notices, source-note opening, and cache timing cannot be established by jsdom alone.

## Why it matters

The safe recovery path must work where the stale read can occur: a live vault.

## Approach

Use a controlled live-vault fault to produce M15. Inspect retained content, disabled commands,
accessible warning, source-note action, failed retry, and successful read-only retry.

## Acceptance criteria

- The successful write occurs exactly once.
- Valid content remains visible through repeated failed retries.
- Unsafe menu, command, keyboard, and pointer paths remain disabled.
- The run records host, fault setup, steps, and result.

## Risks

An uncontrolled filesystem fault may make the result irreproducible; document the injection.

## Outcome

Manual evidence confirms the complete stale-recovery journey in Obsidian.
