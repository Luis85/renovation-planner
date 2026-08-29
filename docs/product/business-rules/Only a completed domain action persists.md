---
rule: BR-DATA-009
kind: constraint
name: Only a completed domain action persists
area: data
sources:
  - PRD §66
  - PRD §67
  - PRD §68
type: business-rule
---

# Only a completed domain action persists

**The rule.** §66: pointer movement is transient. Persistence occurs only after a completed
domain-level action.

```text
pointer down → drag → pointer up → MoveObjectCommand → domain update → persist
```

Every intermediate position exists only in presentation state. Autosave (§67) fires on completed
commands and on debounced property edits — never on a frame.

**Why.** A drag is hundreds of positions and one decision. Persisting the positions writes hundreds
of versions of a note nobody asked for, makes undo meaningless (which of them is the previous
state?), and turns a smooth gesture into vault I/O. Naming the *command* as the unit of persistence
is what makes undo/redo (§68) a history of intentions rather than of frames.

**Where it holds.** The command layer is the only thing that persists; presentation state holds the
in-flight gesture and hands over once. §67's four visible states — Saved, Saving, Unsaved Changes,
Save Error — are what the user sees of this rule.

**Checked by.** Not yet. Slice 06 owns the editor tool framework and the command history.

**Sources.** PRD §66 · PRD §67 · PRD §68.
