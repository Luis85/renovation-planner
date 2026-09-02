---
type: Task
parent: "[[Define and compare an intended room state]]"
order: 20
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Render planned changes with the canonical state language

## Evidence

M09 requires added, removed and modified geometry to be readable without opening the Inspector.
[[Object states]] owns the vocabulary and [[State visualization]] requires pattern, weight and
labels rather than colour alone.

## Why it matters

An editor-specific state legend would disagree with the canonical model, while colour-only
overlays exclude users and fail under arbitrary themes.

## Approach

Project canonical state results into the planned canvas layer and equivalent list. Consume the
state-visualization contract rather than defining local colours or statuses, and keep visibility
separate from persistence.

## Acceptance criteria

- Added, removed, modified and unchanged states use the canonical values.
- Every state is distinguishable without colour and has an equivalent text row.
- Hiding the layer changes no domain record.
- Canvas and list selection resolve the same planned identity.

## Risks

Mockup styling may be mistaken for a new state authority or become illegible in a custom theme.

## Outcome

Planned intent is spatially readable through the same semantic language used everywhere else.
