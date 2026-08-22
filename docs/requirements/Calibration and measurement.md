---
type: Epic
order: 50
status: ""
started: ""
finished: ""
horizon: "MVP"
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
---

# Calibration and measurement

A background image is pixels until somebody says how long one thing in it is. §82 sets the
minimum honestly — two points and a known distance — and that single act is what turns every
later number in the product from a guess into arithmetic. Areas, perimeters, tile counts, paint
quantities and the budget that follows from them all inherit whatever accuracy is established
here, which is why this is its own epic rather than a feature of the editor.

It is also where the product earns the right to show a number at all. §71 separates internal
precision from display precision for a reason: `42718432 mm²` and `42.72 m²` are the same fact,
and code that reads the second one back has silently thrown the first away.

Derived from PRD §14 (Epic 3) and §82, with the unit system from §70 and precision from §71.

## Definition of done

An item beneath this epic is done when:

- Length normalizes to mm, area to mm², volume to mm³ (§70), and every conversion is a function
  in `domain/` asked by a node test rather than by a screen (§44 testability).
- Internal precision and display precision stay separate (§71). No calculation ever reads a
  rounded, displayed figure.
- Calibration belongs to the plan and survives ordinary editing, or it is invalidated loudly.
  Silently reusing a scale after its background image was replaced produces a plausible, wrong
  budget, which is the worst available outcome.
- A plan that has not been calibrated says so wherever a measurement would otherwise appear. A
  number with no scale behind it is worse than no number.
- A measurement carries its own units, so a plan read as plain Markdown or exported to CSV
  (§43) still means what it meant on screen.
