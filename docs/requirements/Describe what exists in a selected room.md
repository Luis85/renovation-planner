---
type: PBI
parent: "[[Renovation semantics]]"
order: 10
status: New
horizon: "MVP"
release: "[[MVP]]"
dependsOn: "[[Describe existing and planned spatial state]]"
---

# Describe what exists in a selected room

## Actor

[[Private renovator]], while surveying or preparing to renovate a room.

## Main flow

1. The renovator selects a room on the canvas or through its equivalent list.
2. They choose **What's here**.
3. The editor shows existing surfaces, fixtures, condition and linked evidence for that same
   spatial identity.
4. The renovator adds or edits one detail without completing a full survey.
5. Derived measurements remain labelled as calculated and the saved detail remains reachable
   from both the room and its non-canvas route.
6. The renovator may start a planned change from an existing detail, preserving the source link.

## Extensions

- **1a** — No room is selected. The action is unavailable and explains that a room must be
  selected; it does not create an unscoped detail.
- **3a** — The existing-state capability is not installed yet. The section is shown as
  unavailable, not empty and not failed.
- **3b** — Some details or evidence cannot be read. Readable information remains visible and
  the refusal is reported without claiming the room has no details.
- **4a** — The renovator cancels. No detail or relationship is written.
- **4b** — Validation or persistence refuses the edit. The last valid room projection remains
  visible and the draft is retained where correction is possible.
- **6a** — Planned-state creation is unavailable. The source detail remains usable and the
  change action states why it cannot start.

## Guarantee

Every existing detail shown or changed belongs to the selected spatial identity; no workflow
copies room geometry or overwrites planned state, and unavailable data is never presented as an
empty or failed survey.

## Out of scope

- Defining the state vocabulary, owned by [[Object states]] and
  [[Describe existing and planned spatial state]].
- Planned-state comparison, owned by [[Define and compare an intended room state]].
- Evidence storage and lifecycle beyond linking an authority-owned evidence record.
- Geometry creation or correction.

## Acceptance criteria

1. Selecting a room from canvas or list opens the same existing-state result for the same stable
   ID.
2. A renovator can save one floor, wall, heating, opening or fixture detail without filling the
   other categories.
3. Calculated area or length is visibly derived and cannot be edited as stored survey text.
4. A linked evidence record remains an ordinary canonical vault record rather than a duplicate.
5. Starting a change carries the source existing-detail identity into the planned flow.
6. Keyboard and list routes can complete the workflow without selecting a canvas marker.
7. Unsupported, empty and unreadable states render as three distinct outcomes.

## Assumptions

1. A selected user-facing Room may initially be backed by the existing Zone identity; this PBI
   requires identity preservation, not a persistence rename.
2. Existing information is incremental and may be incomplete without making the room invalid.
3. Surface markers are projections over existing details and never their owner.

## Sources

M08 Existing Room Details; M09 Planned Room Details; the mental-model specification §§2, 6–8,
33–38, 55, 70–72 and 81; UX research §§5, 13, 15–18 and 23; the component library §§5, 8–9 and
12; implementation-plan Phases 7 and 12; first vertical-slice plan §§3.3, 5 and 15.
