---
type: Task
parent: "[[View rooms in the Standard Plan View]]"
order: 50
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Frame selected Rooms and show contextual dimensions

## Evidence

M01 requires a Room chosen from the summary list to keep its identity while being selected and
centred, and the interaction specification limits dimensions to drawing, selection and editing.

## Why it matters

List selection that substitutes a viewport target can break canvas/Inspector identity, while
resting dimensions make the floor harder to scan.

## Approach

Route Room-summary activation through shared stable-ID selection, then fit or centre that Room
without changing the selected record. Derive dimension visibility from selection, edit and active
tool context rather than from geometry presence alone.

## Acceptance criteria

- Choosing a Room in the summary list selects the same stable ID on canvas and in the Inspector.
- The viewport frames or centres the selected Room without changing its identity.
- An unavailable or degenerate Room extent leaves selection truthful and uses a safe viewport
  fallback.
- Relevant dimensions appear while drawing, while their spatial object is selected, or while an
  applicable edit tool is active.
- Dimensions unrelated to the current selection, edit or tool are absent at rest.
- The equivalent list and keyboard route does not require pointer hover.

## Risks

Viewport framing may be implemented as a second selection route, or dimension visibility may
become tied to hover and flicker during ordinary navigation.

## Outcome

Room-list navigation preserves one identity and provides useful measurements only in the contexts
that need them.
