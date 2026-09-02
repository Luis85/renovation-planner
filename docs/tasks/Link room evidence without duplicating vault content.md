---
type: Task
parent: "[[Describe what exists in a selected room]]"
order: 30
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Link room evidence without duplicating vault content

## Evidence

M08 includes photos, documents and notes as evidence; the mental model says documents are linked,
not duplicated, and the implementation plan keeps evidence as ordinary vault content.

## Why it matters

Copying evidence into an editor-private store would split one document into two truths and make it
invisible to normal Obsidian workflows.

## Approach

Deliver one existing-detail-to-evidence link using the canonical evidence capability. Show the
link and count in the room detail, and route activation to the ordinary vault record. If evidence
support is absent, show the action as unavailable.

## Acceptance criteria

- Linking evidence creates a relationship, not a copied file or note.
- The relationship retains both the existing-detail and spatial-target IDs.
- Missing and unreadable evidence are distinguishable from no evidence.
- The linked record opens through its canonical Obsidian route.

## Risks

Path-based identity could break after a user renames or moves a vault record.

## Outcome

Evidence remains ordinary vault content while being reachable from the exact room detail it
supports.
