---
rule: BR-DATA-001
kind: integrity
name: Identity is the id, never the filename, title or path
area: data
sources:
  - PRD §60
  - PRD §36
  - PRD §65
type: business-rule
---

# Identity is the id, never the filename, title or path

**The rule.** Every persistent domain entity carries a stable `id` in its frontmatter, and that
`id` is what every reference resolves against. Identity is independent of the filename, the note
title and the folder path — all three of which the user may change at any moment, from inside
Obsidian, without the plugin being asked.

**Why.** The vault belongs to its owner. Renaming a note is an ordinary Obsidian gesture, and it
must not orphan that zone's geometry, its costs or its photos. Any model that keyed references to
the path would make the plugin's data quietly hostile to normal use of the editor it lives in.

**Where it holds.** Every repository in `infrastructure/` resolves by `id`; a rename is a
[[A manual edit in the vault is never silently overwritten|vault event]] to be absorbed, not a
delete followed by a create. [[Zone]] states the same rule from its own side, and [[Project]]
adds the scoping half: every other entity resolves to exactly one project, and there is no
cross-project reference.

**Checked by.** Not yet. Slice 04 owns persistence and the rename path.

**Sources.** PRD §60 · PRD §36 · PRD §65.
