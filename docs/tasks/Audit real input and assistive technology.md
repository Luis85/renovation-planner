---
type: Task
parent: "[[Operate the released editor without a pointer]]"
order: 30
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Audit real input and assistive technology

## Evidence

Automation cannot verify a screen reader, real keyboard, switch input, pointer chords, touch,
focus ring appearance, or Obsidian host announcements.

## Why it matters

The release guarantee covers actual operation, not DOM attributes alone.

## Approach

Run the core room and recovery journeys in Obsidian with keyboard-only and a named screen
reader; sample real mouse, trackpad, touch/pen where supported; record conflicts and comprehension.

## Acceptance criteria

- The keyboard/screen-reader room journey and stale recovery complete.
- Focus and announcements are perceivable and non-repetitive.
- Real-device input does not block the non-pointer alternatives.
- Host, assistive technology, device, build, steps, and result are recorded.

## Risks

One platform does not represent every assistive-technology combination; state the tested matrix.

## Outcome

Manual evidence covers the input and perception claims the suite cannot.
