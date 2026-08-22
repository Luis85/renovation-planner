---
type: Epic
order: 110
status: ""
started: ""
finished: ""
horizon: "V1"
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
---

# Task management

The bottom rung: the thing somebody actually does on a Saturday. §20's real content is where a
task comes *from* — a zone, an asset, a work package or a construction section — because a task
created in context inherits its context, and one typed into a list has to have it retyped and
kept in step by hand.

The other half is that this plugin is not the first task system in the vault. Obsidian users
already have checkboxes, queries and whatever plugin they picked for them, and §20 asks for
integration rather than replacement. A private format here would make a renovation the one part
of the vault that the user's own tooling cannot see.

Derived from PRD §20 (Epic 9), with dependencies from §77–§78 and external edits from §65.

## Definition of done

An item beneath this epic is done when:

- A task created from a zone, asset, work package or construction section carries the link back,
  so its context is never retyped.
- Its lifecycle is exactly §20's five states.
- Tasks stay legible to the vault's existing task tooling (§20) rather than living in a format
  only this plugin reads.
- Dependencies reuse §77 and §78 instead of a task-local mechanism.
- A task edited by hand in its note is not overwritten (§65). This is the entity a user is
  likeliest to edit in Markdown while the plugin is open.
