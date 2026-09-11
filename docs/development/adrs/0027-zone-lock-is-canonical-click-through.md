---
adr: 27
title: Zone lock is canonical click-through
status: Accepted
date: 2026-09-10
area: application
---

# ADR-0027: Zone lock is canonical click-through

## Context

A renovator drawing a whole property as one plan puts a large site zone under everything else,
and every click, hover, marquee and right-click inside it lands on the site. The PBI
[[Lock completed spatial geometry against accidental editing]] asked for a lock that keeps
geometry selectable and refuses its edits, and was blocked on an ADR naming where lock state
lives. The user asked instead for a lock that the CANVAS ignores while the sidebar still reaches.

## Decision

- **Scope:** zones (Rooms and Areas) only.
- **Meaning:** click-through. A locked zone is not a canvas hit candidate; it stays drawn (at
  half opacity), listed, selectable from the sidebar and editable through Inspector forms. It is
  NOT edit protection.
- **Authority:** canonical, on the zone note. `Zone.locked`; zone frontmatter schema v2 with
  `locked: true`, written only while locked, and v1 with no key otherwise. The 1 → 2 migration
  advances the discriminator in memory only. An older build refuses a locked note rather than
  dropping the lock on its next save.
- **History:** a lock or unlock is one `details` edit through `EditZoneDetailsCommand`
  (`ZoneDetails.locked`), so it is one undo step, conditional on the zone's version, and
  publishes `ZoneDetailsChanged` for peer leaves.
- **Enforcing boundary:** `canvasCandidates`, the single candidate list `SelectTool` (click,
  hover, marquee) and `CanvasContextMenu` read. A selected locked zone draws no vertex handles,
  because none could be hit. A selected locked zone draws no rotation handle on the canvas
  either, and a canvas drag where it would sit starts nothing; the Inspector's own rotate
  controls still rotate it, exactly like every other Inspector edit of a locked zone.

## Alternatives

- **Workspace (Pinia) state.** Forgotten on close; the renovator re-locks the site every session.
- **Obsidian view state.** Survives restart per leaf, but a second leaf of the same plan starts
  unlocked, and the lock is invisible to every other surface.
- **A new `SetZoneLockedCommand`.** A line-for-line copy of `EditZoneDetailsCommand`; the
  optional field is the same transaction without the clone.

## Consequences

- The PBI's edit refusal and its Wall/group scope are withdrawn; see its amendment.
- A vault opened in an older build refuses locked zone notes until they are unlocked.
- Keyboard nudges and Inspector edits still move a locked zone selected from the sidebar.

## Revisit when

A wall, element or group needs to be clicked through, or accidental edits (not accidental
clicks) are reported.
