---
kind:
name: Photo
layer: domain
persistence: note
partOf: "[[Document]]"
sources:
  - PRD §23
  - PRD §27
  - PRD §30
  - PRD §36
type: entity
---

# Photo

A photograph of the site, at a point in time, ideally at a point in space. §23 lists it as a
document category and §36 gives it a folder of its own; §27 is where it becomes more than a
document.

Two capabilities separate it from an ordinary [[Document]]:

- **A spatial reference** (§23). A photo can be pinned to a point on a [[Plan]], as a
  PhotoReference in §34's annotation branch. *This is what the corner looked like* is only
  useful with the corner identified, and a filename cannot do that.
- **A place in time** (§27). Progress photos form a sequence: the same corner in March, May and
  July. §27's evidence timeline and §30's as-built documentation are both built from that
  ordering, and §30's whole framing — existing state → planned change → execution → as-built —
  needs the *existing* photos to have been taken before anyone thought to want them.

That last point is the practical one worth writing down. The most valuable photo in a renovation
is the one taken before the wall went up, and nothing prompts for it later.

## Identity and persistence

A note with a stable `id` (§60), the date, the linked entity and the plan coordinates in
frontmatter, pointing at the image in [[The vault]]. §36 gives `Photos/` its own folder.

## Relationships

- A category of [[Document]].
- Pinned to a [[Plan]] as a PhotoReference [[Spatial object]] (§34).
- Attached to a [[Zone]], [[Work package]], [[Task]] or [[Issue]].
- Carries a §30 object state, which is what makes existing-versus-as-built comparison possible.
- Evidence for [[Work package]] completion (§27).

## Rules

- Date and location are what make it evidence. A photo with neither is a picture.
- Ordered by capture date, not file date. The two diverge as soon as anything is copied.
- The image is never modified. Annotation is a layer over it, not a write to it.

## Business rules that reach this entity

[[Identity is the id, never the filename, title or path]]

## Sources

PRD §23 · PRD §27 · PRD §30 · PRD §36, in
[`docs/prds/obsidian-renovation-planner.md`](../prds/obsidian-renovation-planner.md) and
[`docs/sdds/obsidian-renovation-planner-SDD.md`](../sdds/obsidian-renovation-planner-SDD.md).
