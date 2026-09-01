---
type: Task
parent: "[[Start room creation from Add]]"
order: 30
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Verify cancellable room-start UX

## Evidence

VS-03 and M02 require Escape to close Add or cancel the temporary state with no data change,
including keyboard-only use.

## Why it matters

A creation state that is hard to leave makes Select cease to be the editor's safe home.

## Approach

Add component, runtime and harness tests for menu cancellation, tool cancellation, start refusal,
focus restoration, theme rendering and constrained leaves. Assert repositories and history remain
untouched. Include an Obsidian manual case for host shortcut interaction.

## Acceptance criteria

- Escape at each transient depth returns toward Select.
- Cancel and failed start produce no repository call or history entry.
- Keyboard and constrained-layout journeys remain usable.

## Risks

DOM tests cannot prove Obsidian keymap behavior; retain a live-vault check.

## Outcome

Starting Room is discoverable, cancellable and demonstrably non-destructive.
