---
adr: 16
title: A Room-Classified Zone Presents as Room
status: Accepted
date: 2026-09-02
area: presentation
---

# ADR-0016: A Room-Classified Zone Presents as Room

## Context

The locked editor screens (M00–M17) speak of Rooms, Areas and Floors. The implemented and
persisted model speaks of `Zone` (seven `ZoneType`s, `Room` among them) and `Plan`. Every
zone note in every vault carries `zone-type: room` (or another type) and a stable `id`, and
its geometry sits under that same id in the plan's `.rpgeo` sidecar. The first editor
increment needs to say "Room" to the user without rewriting that data or splitting its
identity.

## Decision

**Room is a presentation-layer projection of a `Zone` whose `zoneType` is `Room`. Every
other `ZoneType` projects as an Area.** The projection is `toSpatialRecordDto` in
`src/presentation/read-models/spatialRecords.ts`; it carries the `ZoneId` unchanged as the
record's `id`, derives area from geometry, and adds a `kind` of `'room' | 'area'`.

Nothing below `presentation/` changes: no entity rename, no frontmatter key, no schema
version, no persistence discriminator. The application layer keeps its Zone-speaking
commands and queries. A homeowner label is never written to a note.

## Alternatives

- **Rename `Zone` to `Room` throughout.** Touches every layer, every test and every vault
  note for a change in vocabulary, and it is wrong for Gardens and Terraces, which are zones
  and not rooms.
- **A separate `Room` entity linked to zone geometry.** Two identities for one spatial
  thing, a join nothing needs yet, and a migration for a vault that gains no field.
- **`kind` persisted on the note.** A homeowner label as a storage discriminator, derivable
  from `zone-type` already — a second source of truth for one fact.

## Consequences

- Canvas, list and Inspector share the `ZoneId`; the user reads "Room" or "Area".
- Rooms and Areas are listed separately in the floor summary; both are zones on the canvas.
- Type labels are locale keys (`editor.zone-type.<type>`), so the seven types read as
  Room, Garden, Terrace, Driveway, Roof, Construction area, Other.
- `Zone.domainNoteLink` is on the entity and absent from the v1 DTO and mapper; this ADR
  does not decide it, the consolidation report classifies it.

## Revisit when

A Room needs a field or an invariant a Zone cannot carry without harming Areas (a ceiling
height, a wall list, an Existing/Planned state that Areas do not have). That is the trigger
for a `Room` entity, and it arrives with Feature B's wall model or Feature C's semantics,
not before.

## References

- `docs/user-experience/renovation-planner-editor-specs/Renovation Planner — First Vertical Slice Plan and Data-Model Specification.md` §4.5, §5.3
- `docs/superpowers/specs/2026-09-02-plan-editor-foundation-read-path-design.md` §2.1, §3
- ADR-0001 (Markdown metadata), ADR-0002 and ADR-0011 (geometry sidecar)
