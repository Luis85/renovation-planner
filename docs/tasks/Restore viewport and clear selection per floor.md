---
type: Task
parent: "[[Navigate property, building and floor context in the editor]]"
order: 40
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Restore viewport and clear selection per floor

## Evidence

The interaction specification requires useful per-floor viewport preservation and selection
clearing when floors change; the component library keeps viewport and selection outside
responsive layout state.

## Why it matters

Users lose orientation if every return fits from scratch, but carrying a selected entity into a
different floor presents an invalid context as current.

## Approach

Keep an in-session viewport cache keyed by stable Plan ID at the editor runtime boundary. Capture
the departing floor's valid viewport, clear selection before target content is exposed, restore
the target entry when present, and otherwise use canonical fit-floor behavior.

## Acceptance criteria

- Each floor restores only the viewport recorded for its Plan ID.
- First-time and invalid cached states fall back to fit floor.
- Selection is empty before the target floor Inspector renders.
- Responsive reflow does not erase or overwrite a floor's remembered viewport.
- Viewport memory and selection clearing perform no vault write.

## Risks

Keying by labels or sharing one viewport across leaves can restore another floor's or another
leaf's camera state.

## Outcome

Returning to a floor preserves orientation while every floor switch begins with valid selection
context.
