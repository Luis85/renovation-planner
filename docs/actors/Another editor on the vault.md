---
kind: system
name: Another editor on the vault
standing: adversarial
sources:
  - PRD §60
  - PRD §63
  - PRD §65
  - PRD §66
  - PRD §69
  - PRD §91
  - PRD §92
  - SDD §42
  - SDD §46
  - SDD §87
type: actor
---

# Another editor on the vault

Anything that writes to the vault while this plugin is not looking: Obsidian's own editor in
another tab, a sync client, git, a second device, a text editor outside Obsidian, a script.
Usually it is the [[Private renovator]] themselves, which is why it must never be treated as
misuse.

It gets its own note because it is the actor the persistence design is *defensive* against,
and the defences are otherwise scattered across a dozen sections. §65 lists what it does —
frontmatter edits, renames, moves, deletions, new notes — and ends with the rule the whole
plugin is measured against: **manual edits must not be overwritten silently.**

## What it does to the plugin

- **Renames or moves a note**, breaking any assumption that a path identifies anything. §60
  and SDD §83 answer that: identity is a stable `id`, never the filename.
- **Edits frontmatter by hand**, possibly to something this version's vocabulary does not
  contain — a §84 custom type, or a value that is simply wrong.
- **Deletes a note other notes reference**, producing exactly the dangling IDs §63 requires be
  detected and §91's vault health check has to surface.
- **Changes a file mid-write.** The plugin's own save and an external write can interleave;
  §66 and SDD §42 are where that is handled.
- **Writes a schema version from the future**, which §61 requires be recognised rather than
  parsed hopefully.

## What the plugin owes it

- Reconciling rather than reasserting. The pipeline in SDD §46 re-resolves and re-validates;
  it does not rewrite the file back to what it remembered.
- Reporting broken references (§63) instead of repairing them silently.
- Losing a race safely. SDD §87's data safety and §69's backup exist because *the plugin ate
  my edit* is unrecoverable in a way a wrong number is not.
- Making conflict visible: an edit it cannot reconcile becomes a diagnostic (§92), not a guess.

## Sources

PRD §60 · PRD §63 · PRD §65 · PRD §66 · PRD §69 · PRD §91 · PRD §92 · SDD §42 · SDD §46 · SDD §87, in
[`docs/prds/obsidian-renovation-planner.md`](../prds/obsidian-renovation-planner.md) and
[`docs/sdds/obsidian-renovation-planner-SDD.md`](../sdds/obsidian-renovation-planner-SDD.md).
