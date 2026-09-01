---
type: PBI
parent: "[[Planning depth]]"
order: 30
status: New
horizon: "V1"
release: ""
dependsOn:
  - "[[Link evidence to spatial targets]]"
  - "[[Document linking and types]]"
  - "[[Photo documentation]]"
---

# Capture and retrieve evidence from spatial context

## Actor

[[Private renovator]], while recording or finding documents, photos and notes about a selected
room, wall, object or point.

## Preconditions

- A spatial target is selected.
- The target has a stable identity that evidence relationships can reference.
- The vault can resolve ordinary files and Markdown notes through the evidence authority.

## Main flow

1. The renovator opens Documents, Photos or Notes for the selected spatial target.
2. The editor queries the authoritative evidence relationships while preserving the selected
   entity and viewport.
3. The Inspector lists matching evidence with type, phase, date, description and missing-file
   state; spatially pinned items also appear as stable numbered markers.
4. Selecting a marker selects its matching record, and selecting a record focuses its marker or
   broader spatial target.
5. The renovator adds a new link, photo or note with the current spatial target prefilled and an
   optional work relationship.
6. Existing documents and photos remain ordinary vault files; the editor stores relationships and
   metadata, not duplicate bytes.
7. The renovator can open the linked note or file through Obsidian and later retrieve it from the
   same spatial context.

## Extensions

- **2a** — The evidence query fails. The selected spatial context remains visible and the failure
  is shown; an empty evidence list is not substituted.
- **3a** — A file is missing or a thumbnail cannot be read. A labelled file row and relationship
  remain available without a broken-image-only state.
- **3b** — No evidence is linked. The shared shell shows a contextual empty state and the relevant
  add/link action.
- **4a** — Filters hide an item. Marker numbering remains stable within the current filtered
  context and no relationship is deleted.
- **5a** — The renovator cancels capture or linking. No relationship, metadata note or copied file
  is created.
- **5b** — The target disappears before commit. The authoritative command refuses the link and
  leaves the vault file untouched.
- **7a** — Obsidian cannot open the linked target. The relationship remains visible and the
  technical failure is surfaced once.

## Guarantee

Evidence captured from a spatial context remains ordinary vault content linked through one
authoritative relationship, retrievable from both the spatial target and Obsidian without
duplicate evidence bytes.

## Out of scope

- Execution completion evidence, site-log chronology and delivery proof.
- As-built documentation and hidden-services handover workflows.
- A proprietary image or document store.
- A second editor navigation system for Documents, Photos or Notes.
- Persisting filtered marker numbers as evidence identity.

## Acceptance criteria

1. A new evidence relationship inherits the currently selected spatial target.
2. Linking an existing document writes no duplicate of that document's bytes.
3. Adding a photo keeps the photo as an ordinary vault file and stores only authoritative
   metadata/relationships around it.
4. Selecting a visible evidence pin and its list row is bidirectional.
5. Documents, Photos and Notes reuse one contextual shell and preserve entity selection when
   switching type.
6. A missing file degrades to a labelled row that can still identify and repair the relationship.
7. Marker numbers are derived for the current filtered context and are not persisted identifiers.
8. The same evidence can be opened through Obsidian outside the plan editor.

## Assumptions

1. V1 covers basic spatial links, contextual capture and retrieval; execution and as-built
   semantics remain later work.
2. Point-specific pins are optional metadata on the evidence relationship, not a second copy of
   the document or photo.
3. [[Link evidence to spatial targets]] owns the common relationship contract this editor consumes.

## Sources

- [[M14-room-evidence]]
- [Renovation Planner — Editor Component Library](../user-experience/renovation-planner-editor-specs/components/component-library.md)
- [[Renovation Planner — Editor Interaction & Mental Model Specification]]
- [[Renovation Planner — Editor UX Research & Pattern Study]]
- [Renovation Planner — Editor Implementation Plan](../user-experience/renovation-planner-editor-specs/implementation/implementation-plan.md)
- [[Documents, photos and evidence]]
- [[Document linking and types]]
- [[Photo documentation]]
- [[Spatial photo references]]
