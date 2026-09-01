---
type: PBI
parent: "[[Renovation semantics]]"
order: 20
status: New
horizon: "MVP"
release: "[[MVP]]"
dependsOn:
  - "[[Describe existing and planned spatial state]]"
  - "[[Object states]]"
  - "[[State visualization]]"
---

# Define and compare an intended room state

## Actor

[[Private renovator]], after understanding a room well enough to describe the outcome they want.

## Main flow

1. The renovator selects a room and chooses **What will change**, or starts from an existing
   detail marked for change.
2. The editor shows existing context without turning it into editable planned data.
3. The renovator adds an intended finish, fixture, opening or spatial change and optionally links
   it to its existing source.
4. The plan and Inspector identify the outcome as unchanged, removed, modified or added using the
   canonical object-state vocabulary and accessible visual language.
5. The renovator compares Existing and Planned for the selected room.
6. The saved outcome becomes available to the canonical-work workflow.

## Extensions

- **1a** — No room is selected. Planned creation is unavailable rather than unscoped.
- **2a** — Existing details are absent. The renovator may still define an added outcome; the
  comparison says the source is unspecified rather than inventing one.
- **3a** — The intended value is incomplete or invalid. The draft stays local and nothing
  overwrites the existing record.
- **4a** — State visualization is unavailable. Planned editing is not offered through an
  ambiguous overlay that cannot communicate its meaning accessibly.
- **5a** — One side cannot be read. The readable side remains visible and comparison is marked
  unavailable, not equal.
- **6a** — Canonical work capability is unavailable. The intended outcome remains valid and the
  work action explains its unavailable prerequisite.

## Guarantee

Existing and Planned remain separate records tied to one spatial identity; comparison never
duplicates geometry, and hiding a planned layer changes only presentation.

## Out of scope

- Defining or persisting canonical object states, owned by [[Object states]].
- Defining the visual state language, owned by [[State visualization]].
- Creating Tasks, Construction Sections or Work Packages, owned by
  [[Turn a planned outcome into actionable work]] and their domain authorities.
- Scenario comparison across alternative project plans.

## Acceptance criteria

1. Saving a planned outcome leaves its existing source unchanged.
2. Added, removed, modified and unchanged outcomes are distinguishable by label or pattern without
   relying on colour.
3. Canvas selection and the equivalent Inspector row resolve the same planned record and spatial
   target.
4. The comparison states the changed attributes and identifies an unspecified source honestly.
5. Turning the Planned layer off neither deletes nor edits any state record.
6. A planned outcome can carry a stable link to its existing source and expose the handoff to
   canonical work.
7. Unsupported, empty, unreadable and equal comparisons are distinct results.

## Assumptions

1. Existing and Planned are semantic state, not visibility layers or the current Zone progress
   status.
2. A planned outcome may exist without an existing source when the outcome adds something new.
3. Comparison is derived from authority-owned records on read and is not persisted as a second
   truth.

## Sources

M08 Existing Room Details; M09 Planned Room Details; the mental-model specification §§1–8,
28–38, 54–55, 70 and 81; UX research §§5, 13–18, 20, 23 and 28; the component library §§4–5,
8–9 and 12; implementation-plan Phase 7 and Increment C; first vertical-slice plan §§4.5, 5,
15 and 16.
