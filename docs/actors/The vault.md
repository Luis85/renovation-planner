---
kind: actor
name: The vault
layer: system
standing: canonical store
sources: ["PRD §3.2", "PRD §36", "PRD §37", "PRD §60", "PRD §64", "PRD §88", "SDD §37", "SDD §43", "SDD §46", "SDD §47"]
---

# The vault

A folder of Markdown files the user owns. It is both where this plugin persists and an actor
in its own right, because it changes underneath the plugin and pushes those changes at it
(SDD §46) rather than waiting to be asked.

Treating it as an actor rather than as a database is the whole of §3.2. A database is private
to the program that owns it; this is not. Every entity marked `persistence: note` in
`entities/` is a file the user can open, read, edit, rename, move, delete, sync or put under
version control, and none of those is a fault condition. §36 goes further and requires the
folder paths themselves be configurable, so even the shape of the store is theirs.

## What it does to the plugin

- **Emits change events** — created, modified, renamed, deleted (SDD §46) — running the
  pipeline through the change adapter, entity resolution, validation, the project index, and
  only then the views.
- **Invalidates the plugin's assumptions.** A note can be renamed or moved between one read
  and the next, which is exactly why §60 puts identity in a stable `id` and SDD §83 says the
  filename is never identity.
- **Holds data this version does not understand** — a newer schema version, a §84 custom
  [[Zone]] type, a frontmatter key someone added by hand.
- **Is not transactional.** A [[Plan]] note and its geometry sidecar are two files and nothing
  guarantees both writes land (SDD §39, §42).

## What the plugin owes it

- Never silently overwriting a manual edit (§65). See [[Another editor on the vault]].
- Treating everything read as untrusted: validate, and fall back rather than crash (SDD §43).
- Preserving what it did not write, so an unknown key survives a round trip.
- Keeping derived values *out* of frontmatter (§88). Area and perimeter are recomputed on
  read, because a stored derivative drifts away from the geometry that produced it.
- Checking references before deleting (§64), and never a silent cascade.

## Sources

PRD §3.2 · PRD §36 · PRD §37 · PRD §60 · PRD §64 · PRD §88 · SDD §37 · SDD §43 · SDD §46 · SDD §47, in
[`docs/prds/obsidian-renovation-planner.md`](../prds/obsidian-renovation-planner.md) and
[`docs/sdds/obsidian-renovation-planner-SDD.md`](../sdds/obsidian-renovation-planner-SDD.md).
