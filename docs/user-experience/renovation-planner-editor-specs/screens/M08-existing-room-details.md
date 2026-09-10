# M08 — Existing Room Details

Release fidelity continuation (2026-09-08): Existing rows and canvas markers identify the
saved surface/element kind alongside the description. Floor and Wall details with identical
descriptions remain distinguishable without opening Edit. Labels reuse the existing EN/DE
vocabulary; record identity, condition and storage are unchanged. Current evidence is tracked
in [release screen fidelity](../implementation/release-screen-fidelity.md).

![M08 — Existing Room Details](../images/M08-existing-room-details.png)

## Screen description

The Existing detail state answers **What is here now?** for the selected room. It captures finishes, fixtures, condition, and evidence without forcing a full survey before the room becomes useful.

## Entry conditions

- A Room is selected.
- User chooses `What's here`.

## Primary use cases

1. Record current floor, walls, heating, windows, doors, and fixtures.
2. Record condition in homeowner language.
3. Add photos/documents/notes as evidence of the current state.
4. Mark an existing element for change.

## Interactions

| Trigger | Result |
|---|---|
| Select a surface chip on canvas | Focus corresponding Existing row in Inspector |
| Expand a row | Show editable description, condition, measurements, and evidence links |
| `Add existing detail` | Open contextual type picker pre-linked to room and Existing state |
| Select photo thumbnail | Show photo metadata and related spatial pin |
| `Mark something for change` | Start Planned/Change creation from the selected Existing item |
| Existing/Work/Planned switch | Move between M08, M10, and M09 while retaining room/viewport |

## Used components

- `SemanticStateSwitch`
- `RoomSurfaceMarkers`
- `ExistingRoomInspector`
- `ExistingDetailRow`
- `ConditionSelect`
- `CalculatedValue`
- `EvidenceSummary`
- `PhotoStrip`

## Data and state requirements

- Existing-state items by room and surface/object type
- Condition vocabulary
- Derived area/length values with provenance `Calculated`
- Evidence links and counts
- Relationship from Existing item to proposed change

## Accessibility and themes

- Surface chips have list equivalents in Inspector.
- Condition uses text, not traffic-light color.
- Photo thumbnails include filenames/descriptions and keyboard selection.
- Dark theme uses host surfaces; thumbnails retain visible selected borders.

## Acceptance criteria

- Existing information can be added incrementally.
- Derived values are labeled and not editable as if manually stored.
- Starting a change preserves a link to the source Existing item.
- The user can complete the workflow without interacting with canvas chips.


## Historical Increment C checkpoint — 2026-09-06

The connected implementation uses ADR-0021: independent Existing/Planned facts in the owning
Plan register, project-owned Work/outcome links, minimal Decisions, separate intended
straight-wall/opening geometry and scoped Review. All records have Inspector list routes;
Room selection remains spatial. See [evidence and traceability](../implementation/connected-renovation-evidence.md).
At that checkpoint, Evidence, financial reconciliation, materials purchasing, Trade catalogue
and scheduling were still outstanding. They are implemented in the current integration through
the existing planning repositories and the [downstream Work/Quote routes](../implementation/downstream-planning-evidence.md).
This supersedes the earlier implementation boundary; final integrated gates, visual, live Obsidian
and screen-reader acceptance remain open.
