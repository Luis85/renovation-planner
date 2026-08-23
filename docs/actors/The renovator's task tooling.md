---
kind: actor
name: The renovator's task tooling
layer: system
standing: user-chosen
sources: ["PRD §3.6", "PRD §20", "PRD §65"]
---

# The renovator's task tooling

Whatever the user already uses to see their tasks — a community task plugin, a query, or plain
checkboxes in a daily note. Deliberately unnamed: neither the PRD nor the SDD names a specific
task plugin, and the requirement note [[Obsidian task integration]] says *whichever task plugin
they chose*, which is the honest scope.

§20 asks for task integration explicitly, and that requirement note reads it as a statement
about what the plugin refuses to be. A private task format would make the renovation the one
part of the user's vault their own tooling cannot see, and §3.6 makes being Obsidian-native a
principle rather than a nicety.

## What it does to the plugin

- **Owns the checkbox.** A [[Task]] ticked by hand in the note is the normal case, not an edge
  case (§65), and it counts. The plugin reads that state; it does not arbitrate it.
- **Defines the syntax.** Due dates, recurrence and priority markers are that tooling's
  conventions, and a [[Task]] note has to be writable in a form it already understands.
- **Aggregates across the whole vault**, so a renovation task appears next to everything else
  the user has to do. That is the point of integrating rather than reimplementing.

## What the plugin owes it

- Tasks as ordinary Markdown checkboxes in ordinary notes.
- Reading completion rather than owning it, so [[Work package]] progress is derived from what
  the user already ticked.
- No private state that has to agree with the checkbox. Two sources of truth for *is it done*
  is one too many.

## Sources

PRD §3.6 · PRD §20 · PRD §65, in
[`docs/prds/obsidian-renovation-planner.md`](../prds/obsidian-renovation-planner.md) and
[`docs/sdds/obsidian-renovation-planner-SDD.md`](../sdds/obsidian-renovation-planner-SDD.md).
