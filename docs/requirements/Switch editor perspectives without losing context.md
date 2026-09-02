---
type: PBI
parent: "[[Renovation semantics]]"
order: 50
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Switch editor perspectives without losing context

## Actor

[[Private renovator]], moving between physical planning, renovation detail and readiness review
for one floor.

## Main flow

1. The renovator opens the perspective switch for the current floor.
2. The switch offers Plan, Renovate and Review only when each perspective's required capability
   is available, and identifies the active perspective accessibly.
3. The renovator chooses another available perspective.
4. The editor returns to Select before showing the destination perspective.
5. The destination restores the compatible floor, room selection and viewport context.
6. Review exposes read-only findings and navigation while Plan and Renovate expose only the
   actions their perspectives own.

## Extensions

- **2a** — A perspective's capability is unavailable. Its state is explained and it cannot be
  activated; it is not shown as an empty or failed perspective.
- **3a** — The renovator chooses the active perspective. Nothing is reset or remounted.
- **5a** — A selected record is incompatible with the destination or no longer exists. The floor
  and compatible viewport are preserved while selection falls back to the nearest safe context.
- **5b** — The destination cannot use the prior viewport. It frames the preserved floor rather
  than applying an invalid transform.
- **6a** — Review links to a source needing correction. The editor switches to Renovate with the
  compatible target selected; Review itself remains read-only.

## Guarantee

Changing perspective never carries an active creation or editing tool across the boundary and
never invents context the destination cannot represent. Compatible floor, room and viewport
state survives, and Review cannot mutate canonical renovation data.

## Out of scope

- Defining Plan, Renovate or Review content, owned by their workflow PBIs.
- Persisting the active perspective or selection across Obsidian sessions.
- Adding a history stack independent of Obsidian's view state.
- Making unavailable capabilities appear as partial perspectives.

## Acceptance criteria

1. Plan, Renovate and Review have distinct capability-aware availability states.
2. The switch exposes its active state and all available choices to keyboard and assistive
   technology users.
3. Every accepted perspective change activates Select before destination controls are usable.
4. Compatible floor, room selection and viewport are restored in the destination.
5. Incompatible selection falls back safely without losing the current floor.
6. Review offers navigation and explicit read-only exports but no geometry editing or canonical
   renovation-record creation.
7. Choosing the already active perspective changes neither tool nor spatial context.

## Assumptions

1. Perspective and editor tool are separate state.
2. Availability comes from composed capabilities, not from whether a query happened to return
   records.
3. Viewport restoration is conditional on the destination representing the same floor.

## Sources

M08 Existing Room Details; M09 Planned Room Details; M10 Room Work; M11 Multi-Selection; M17
Review Perspective; the mental-model specification §§28–32, 55 and 81; UX research §§20 and 23;
the component library §3; implementation-plan Phases 1, 7 and 8.
