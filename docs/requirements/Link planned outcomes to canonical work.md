---
type: PBI
parent: "[[Create a task from context]]"
order: 10
status: New
horizon: "MVP"
release: "[[MVP]]"
dependsOn: "[[Describe existing and planned spatial state]]"
---

# Link planned outcomes to canonical work

## Actor

[[Private renovator]], after defining an intended outcome that requires something to be done.

## Main flow

1. The renovator chooses a Planned outcome in its spatial context.
2. They create a canonical task or link an existing one through the task authority.
3. The work record keeps stable references to the Planned outcome and its spatial target.
4. The Planned outcome exposes the work that produces it.
5. Opening either side follows the relationship to the canonical record rather than a copied
   editor row.

## Extensions

- **2a** — The selected task already links to that outcome. The operation is a no-op.
- **2b** — The task belongs to an incompatible project. Linking is refused without changing
  either record.
- **3a** — One target cannot be read or no longer exists. The relationship is unresolved and
  reported; it is not silently dropped.
- **4a** — No work is linked yet. The authoritative result is empty and remains distinct from a
  failed work query.

## Guarantee

The work shown for a Planned outcome is canonical task data. The plan, state record and editor
store never copy task status, dates, responsibility or dependencies as a second authority.

## Out of scope

- Trade assignment, work-package award, scheduling and dependency planning.
- Execution progress, completion evidence and as-built state.
- A new editor-only Work entity.

## Acceptance criteria

1. Creating work from a Planned outcome produces one canonical task with stable outcome and
   spatial-target references.
2. Following the link in either direction resolves the same task identity.
3. Repeating the same link creates no duplicate relationship or task.
4. Editing canonical task data is reflected on the next read without rewriting the Planned
   outcome.
5. Empty, unresolved, unreadable and successfully linked results are distinct.
6. Deleting either endpoint follows the reference-integrity policy rather than leaving a silent
   dangling ID.

## Assumptions

1. A Task is the minimum canonical work record for MVP. Work Packages, Construction Sections and
   richer execution records may become additional canonical targets later.
2. Ordering and dependency semantics remain owned by their later Features.

## Sources

M10 Room Work; the editor implementation plan Phase 8 read narrowly to the Existing → Planned →
Work handoff; the first vertical slice plan §15; PRD §20, §60, §63–64 and §77–78.
