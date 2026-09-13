---
adr: 29
title: A plan carries a kind label and a sibling order
status: Accepted
date: 2026-09-12
area: domain
---

# ADR-0029: A plan carries a kind label and a sibling order

## Context

ADR-0028 gave a plan a parent zone, so a project can be a site, a house on it and floors in the
house. The Property tree that draws that chain showed only the open plan's siblings, every plan
with one icon, in name order. A renovator building a whole site and one building a single floor
both need the tree to say what each plan IS and to hold the order they gave it.

## Decision

- `Plan.kind: 'site' | 'building' | 'floor' | 'room'`, default `floor` (ADR-0017's "presents as
  Floor" is now the default rather than the rule), and `Plan.order: number`, a non-negative
  integer ranking a plan among the plans sharing its parent. Both set at creation —
  `CreatePlanCommand` takes a kind and appends the order one past its siblings' highest when
  none is given — and changed afterwards only by `UpdatePlanDetailsCommand`.
- Frontmatter `kind` and `order`, schema v11 (v10 is `main`'s north bearing, shipped while this
  was open), both optional and written only when not the default, so an untouched note is
  byte-identical after its next save. A value outside the vocabulary refuses the note; nothing
  is guessed at. The schema types the two keys loosely and `Plan.create` is the one place that
  refuses, so there is one vocabulary rather than two.
- `readPlanHierarchy` answers the whole project as a tree, siblings by `order` then name; a plan
  whose parent is missing draws at the root.
- A reorder renumbers the moved plan's siblings 0…n-1 and writes every sibling whose STORED
  order differs from its new index — compared against the stored value, not the previous
  position, because every vault older than this build holds `order: 0` on every plan, so a
  first reorder may write the whole sibling list. One `UpdatePlanDetails` per changed sibling,
  in sequence, stopping at the first refusal; not a transaction. The tree then re-reads from the
  vault either way, so a half-applied move shows as what was saved.
- The kind is chosen in the New plan form — a detail plan from a zone defaults one step below
  its parent (site → building → floor → room, and a room's child is a room) — and changed from
  the Property tree row menu's "Mark as …" entries or the Floor inspector's Kind select. The
  context bar's ancestor crumbs draw the kind icon.
- No `Site`, `Building`, `Floor` or `Room` entity. The kind is a LABEL: it drives an icon and a
  level label, and nothing constrains what a plan of a kind may contain.

## Alternatives

- **Derive the kind from depth.** A single-floor project's root is a floor, not a site.
- **Order by name only.** The user's mental order (ground, first, attic) is not alphabetical.
- **A `Site`/`Building` entity.** A second identity and a migration for a label.

## Consequences

- ADR-0017's Floor identity is deferred once more; the label covers what the tree needs.
- A vault opened in an older build refuses a note carrying `kind` or `order`; a note carrying
  neither still reads there, since both are written only when not the default.
- A half-applied reorder is a visible order the user can redo, never data loss.
- The row menu (right-click, Shift+F10 or the context-menu key) is the only reorder path on a
  touch device, which has no HTML5 drag. With no `UpdatePlanDetails` command or in review
  perspective there is no menu, no drag and no Alt+↑/↓; while writes are paused the menu opens
  with every entry disabled. Drag state is per tree instance, so a drop onto another plan
  editor leaf's tree does nothing.

## Revisit when

A kind must constrain contents (a room may not hold a building), order must be shared across
parents, or a reorder must be atomic.
