---
type: Feature
parent: "[[Cross-cutting concerns]]"
order: 60
status: ""
started: ""
finished: ""
horizon: "MVP"
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
---

# External modification handling

§65: because Markdown is canonical, the plugin has to respond to frontmatter edits, renames, moves,
deletions and new notes made outside it — and must never silently overwrite a manual edit. It is
cross-cutting because every entity in every epic is a note somebody can open in the editor next to this
one.

§60's stable IDs are what make it survivable: a rename is only harmless because nothing addresses an
entity by its filename.

## Outcome

A renovator can edit, rename or move any renovation note by hand and the plugin keeps up instead of
undoing them.
