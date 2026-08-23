---
kind: entity
name: Quote
layer: domain
persistence: note
sources: ["PRD §22", "PRD §11", "PRD §33", "PRD §23"]
---

# Quote

A priced offer from a [[Supplier]], with quote items, a status and a validity date. §22 asks for
quote records, quote items, links from those items to [[Asset]]s and [[Work package]]s,
comparison between quotes, and status and validity.

**Validity is the property that makes it an entity rather than a price field.** A quote is true
on a date and stops being true later, and a renovation runs long enough that this matters
constantly. A price copied onto an asset loses the date it was true, the conditions attached to
it, and who said it.

Comparison is the other half. §22 asks for it explicitly, and it is harder than it sounds:
quotes for the same work arrive scoped differently, with different inclusions, in different
units. That is exactly why quote items link to [[Asset]]s and [[Work package]]s — the link is
what makes two quotes comparable line by line rather than only as two totals.

In §11's cost types it produces the *Quoted* value, and in §33's lifecycle it sits between
estimate and commitment.

## Identity and persistence

A Markdown note (§36's `Quotes/`) with a stable `id` (§60), the supplier id, the date, the
validity date and the status in frontmatter. Quote items are lines within it, not separate
notes — they have no lifecycle of their own.

## Relationships

- Given by exactly one [[Supplier]].
- Its items reference 0..n [[Asset]] and 0..n [[Work package]] (§22).
- Produces the Quoted [[Cost item]]s (§11).
- Accepting one leads to an [[Order]].
- Usually evidenced by a [[Document]] — the PDF that arrived (§23 lists *quote* as a document
  category).

## Rules

- **Immutable once received.** A revised price is a new quote, not an edit. Otherwise the
  comparison that justified a decision cannot be reconstructed.
- Expired is a derived state, from the validity date, not a status someone has to remember to
  set.
- A quote item without a link to an [[Asset]] or [[Work package]] is still valid — that is the
  common case on arrival, and linking it is the work of comparing.

## Sources

PRD §22 · PRD §11 · PRD §33 · PRD §23, in
[`docs/prds/obsidian-renovation-planner.md`](../prds/obsidian-renovation-planner.md) and
[`docs/sdds/obsidian-renovation-planner-SDD.md`](../sdds/obsidian-renovation-planner-SDD.md).
