---
kind:
name: Zone
layer: domain
persistence: note
partOf: "[[Project]]"
sources:
  - PRD §8
  - PRD §15
  - PRD §34
  - PRD §36
  - PRD §60
  - PRD §64
  - PRD §84
  - PRD §88
  - SDD §38
type: entity
---

# Zone

A semantically meaningful area: the kitchen, the bathroom, the terrace, the front garden, the
flower bed, the driveway, the roof. §8's definition is short and the important half is the
second sentence — *a Zone owns geometry and can expose derived length and area.*

The epic note [[Zones and spatial objects]] states the framing this entity depends on: **a
zone is a domain object that happens to have geometry, not a drawing that happens to have a
name.** It has to stay usable from ordinary Obsidian — a wikilink, a [[Bases]] table, a search
— by someone who never opens the canvas. That is why it is a note and its geometry is a
[[Spatial object]], rather than the other way round.

It is also the origin of most quantities. §32 requires a [[Requirement]] to have a source, and
a zone's derived area is the commonest one: 46.2 m² of tile is required *because the bathroom
floor measures that*, and the number moves when the polygon does.

**Zone versus [[Space]]:** a space is a room in the building; a zone is an area planning
attaches to. They coincide often and are not the same object — see [[Space]].

## Identity and persistence

A Markdown note (§36, §37) with frontmatter along SDD §38's lines: `type: renovation-zone`,
`schema-version`, a stable `id`, the [[Project]] and [[Plan]] ids, name, zone type, status.
The body is free-form and belongs to the user.

## Relationships

- Belongs to exactly one [[Project]]; drawn on one [[Plan]] via a [[Spatial object]].
- May correspond to a [[Space]] or an [[Outdoor area]], without being owned by either.
- Spanned by 0..n [[Construction section]] (§59 — a section may span multiple zones).
- Origin of 0..n [[Requirement]].
- Referenced by [[Task]], [[Cost item]], [[Document]] and [[Photo]].

## Rules

- **The `id` is identity** (§60). Renaming the note in Obsidian must not orphan its geometry,
  its costs or its photos.
- **Zone types are configurable** (§84). The shipped list ends in Custom, and a type this
  plugin does not know must survive a read-and-write round trip exactly as written — see
  [[Zone types]].
- **Area and perimeter are derived on every read** (§88), never stored in frontmatter, where
  they would drift from the geometry that produced them.
- **Deleting reports what references it** and offers §64's choices — cancel, remove
  references, reassign, delete anyway. A silent cascade is refused, and so is a delete that
  leaves dangling ids (§63).

## Business rules that reach this entity

[[Identity is the id, never the filename, title or path]] · [[A derived value is recomputed on read, not persisted]] · [[A delete reports what references it and offers four choices]] · [[A type this version does not know survives a round trip verbatim]]

## Sources

PRD §8 · PRD §15 · PRD §34 · PRD §36 · PRD §60 · PRD §64 · PRD §84 · PRD §88 · SDD §38, in
[`docs/prds/obsidian-renovation-planner.md`](../prds/obsidian-renovation-planner.md) and
[`docs/sdds/obsidian-renovation-planner-SDD.md`](../sdds/obsidian-renovation-planner-SDD.md).
