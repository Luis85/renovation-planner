---
kind: system
name: Bases
standing: host feature
sources:
  - PRD §40
  - PRD §41
  - SDD §13
type: actor
---

# Bases

Obsidian's own database-like view over notes with frontmatter. It reads the same files this
plugin writes and renders them as tables the user builds themselves, with no involvement from
this plugin at all.

That is why it is an actor and not a feature. §41 asks for Bases integration, but the half
that matters is passive: **write frontmatter Bases can already query**, and a renovator gets
tables, filters and grouping over their [[Work package]]s and [[Requirement]]s without this
plugin shipping a table view. SDD §13's registered Bases views are the active half, and the
smaller one.

## What it does to the plugin

- **Turns frontmatter into a public interface.** A key renamed to read better in code breaks
  a table the user built, and this plugin cannot see that it did. Frontmatter keys behave
  more like a published API than like field names.
- **Renders entities the plugin has no view for.** [[Supplier]], [[Invoice]], [[Milestone]]
  and [[Risk]] are useful as a Bases table long before any of them earns a canvas surface.
- **Sets the expectation of flat, queryable values.** A nested object in frontmatter is worse
  for Bases than two flat keys, even where it is tidier as a type.

## What the plugin owes it

- Frontmatter worth querying: the [[Zone]] type, the status, the [[Construction section]],
  the dates — flat, consistently named, consistently spelled.
- Not depending on it for anything essential. It renders what is already there; if it is
  absent the data is unharmed.
- The same discipline for its own registered Bases views (SDD §13) as for a workspace view —
  they are presentation, and reach the domain through the application layer.

## Sources

PRD §40 · PRD §41 · SDD §13, in
[`docs/prds/obsidian-renovation-planner.md`](../prds/obsidian-renovation-planner.md) and
[`docs/sdds/obsidian-renovation-planner-SDD.md`](../sdds/obsidian-renovation-planner-SDD.md).
