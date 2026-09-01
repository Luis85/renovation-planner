---
type: Task
parent: "[[Choose how to start a floor]]"
order: 30
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Verify empty-floor recovery and accessibility

## Evidence

M05 requires equal keyboard access, canonical failure handling and disappearance while a temporary
task is active.

## Why it matters

An onboarding surface can cover the canvas, trap focus or vanish after a failed start.

## Approach

Exercise each choice under success, cancel and start failure; reload an unchanged empty Floor;
scan the rendered controls; capture light, dark and constrained states. Assert temporary tools
suppress the overlay without destroying it.

## Acceptance criteria

- Cancelled/failed choices return to a usable start state.
- Reload of an unchanged Floor presents the choices again.
- Focus order, names and headings pass accessibility checks.
- The overlay yields while creation is active.

## Risks

Browser screenshots cannot prove screen-reader announcements; retain semantic assertions.

## Outcome

Floor-start guidance remains recoverable and accessible in every supported editor layout.
