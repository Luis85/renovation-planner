---
kind:
name: Document
layer: domain
persistence: note
partOf: "[[Project]]"
sources:
  - PRD §23
  - PRD §42
  - PRD §59
  - SDD §54
  - SDD §55
type: entity
---

# Document

Any file that is evidence: a quote, an invoice, a delivery note, a product data sheet, an
installation manual, a permit, a warranty, a contract, a photo, a sketch, or other. §23's
category list, verbatim.

§23's goal is the useful sentence — *connect all project documents to spatial and domain
objects*. A folder of PDFs is what a renovator already has and cannot use; the value this adds
is the link, so the warranty is reachable from the boiler, the permit from the extension, and
the data sheet from the [[Asset]] it describes.

**Document versus [[Photo]]:** a photo is a document by category, and gets its own note because
§23 and §27 give it two capabilities no other category has — a spatial reference to a point on a
[[Plan]], and a place in a time-ordered progress record. Everything else in §23's list is a file
with a link and a date.

PDF handling is real work rather than storage: §42 admits PDF as a plan import source and SDD
§54 covers importing it, so the same PDF can be both evidence and the background of a [[Plan]].

## Identity and persistence

A note with a stable `id` (§60), the category, the date and the linked entity in frontmatter,
pointing at a file in [[The vault]]'s attachments. The note is the metadata and the link; the
attachment is the bytes.

## Relationships

- Belongs to exactly one [[Project]] (§59).
- Links to any domain entity — [[Zone]], [[Asset]], [[Work package]], [[Supplier]],
  [[Invoice]], [[Quote]].
- May be the background of a [[Plan]] (§42).
- [[Photo]] is a document category with extra capability.

## Rules

- Categorised from §23's list, extensible per §84 — *other* is in the shipped list precisely
  because the list will be incomplete.
- The link is by stable `id` (SDD §83). A document reachable only by folder placement is a
  document that a rename disconnects.
- The plugin does not move or rename the user's attachments. Where files live is [[The vault]]'s
  business and its owner's.

## Sources

PRD §23 · PRD §42 · PRD §59 · SDD §54 · SDD §55, in
[`docs/prds/obsidian-renovation-planner.md`](../prds/obsidian-renovation-planner.md) and
[`docs/sdds/obsidian-renovation-planner-SDD.md`](../sdds/obsidian-renovation-planner-SDD.md).
