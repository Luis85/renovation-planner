---
type: Task
parent: "[[Start room creation from Add]]"
order: 30
status: Done
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

## Closing evidence

**2026-09-04**, the Add Room increment.

Criterion 1 — **Escape at each transient depth returns toward Select** — is
`tests/presentation/editor/roomCreation.e2e.test.ts`'s 'Escape clears a drafted rectangle and
stays; a second Escape returns to Select', driven through the real mounted editor: the first
press clears the rectangle and leaves the banner and the form standing, the second ends the task.
`routeEscape` was not changed to do it — `DrawRoomTool.hasDraft()` is a new answerer of a
question the routine already asked, which is why the case asserts the two depths in one body.

Criterion 2 — **cancel and failed start produce no repository call or history entry** — is that
same case plus 'Cancel leaves the task in one gesture and writes nothing', each asserting the
zone count unchanged rather than only the UI state.

Criterion 3 — **keyboard and constrained-layout journeys remain usable** — is
`tests/harness/accessibility.test.ts`'s four new axe scans (the form with a valid draft, the form
with a refused width, the banner with its Finish, and the constrained Inspector DRAWER holding
the form), each with a presence assertion above `axe.run` so a scan of nothing cannot pass
vacuously; and `npm run harness-shot`'s `plan-editor-add-room-narrow`, which is what actually
found the constrained layout's one defect — a task banner capped at half the pane by `left: 50%`
plus a transform, wrapping to eleven lines of one and two words at 460 px. No gate here could
see it: jsdom lays nothing out.

The live-vault check this task's own Approach asks for is [[Add a room]], steps 9 and 10 — the
click-versus-drag epsilon under a real hand, and the drawer at an actual sidebar's width. It has
NOT been run in a vault.
