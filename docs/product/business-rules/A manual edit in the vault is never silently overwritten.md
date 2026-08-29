---
rule: BR-DATA-007
kind: constraint
name: A manual edit in the vault is never silently overwritten
area: data
sources:
  - PRD §65
  - PRD §1
type: business-rule
---

# A manual edit in the vault is never silently overwritten

**The rule.** Markdown is canonical, so the plugin is one editor of its data among several. It must
respond to frontmatter edits, note renames, note moves, note deletions and new notes made outside
it — and **manual edits must not be overwritten silently.**

**Why.** §1's premise is that the visualization is not the database. Anything the plugin holds in
memory is a projection that may already be stale: the user has another tab open, a sync client
running, or a text editor. Writing a cached model back over a note that changed underneath it is
the one defect that destroys work the user can see they did.

**Where it holds.** The vault-event adapters in `infrastructure/`, and the write ledger in the
editor: the expectation checked before a write is what *this history* last wrote for the entity, not
what this adapter last wrote — a distinction that only shows up in a move/rename/undo sequence, and
shows up as lost work when it is missing.

**The related trap.** The same rule read from the other direction is [[Plan]]'s: a plan's
calibration must survive ordinary editing **or be invalidated loudly**. Silence is the failure mode
in both directions.

**Checked by.** Not yet. Slice 06 specifies the write ledger and the foreign-write case; slice 11
owns external modification handling.

**Sources.** PRD §65 · PRD §1 · slice 06
([`docs/tasks/06-editor-tool-framework-undo-redo-and-inspector.md`](../../tasks/06-editor-tool-framework-undo-redo-and-inspector.md)).
