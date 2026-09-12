---
adr: 29
title: A label position is sidecar geometry, stored as an offset
status: Accepted
date: 2026-09-12
area: application
---

# ADR-0029: A label position is sidecar geometry, stored as an offset

## Context

Every caption on the Plan Editor canvas — a room's name and area, an element's name tag, an asset's
name tag — was placed automatically and could not be moved, so captions overlapped furniture, pins
and each other with no remedy.

## Decision

- **Scope:** rooms and areas, elements, and asset placements.
- **Meaning:** an optional `labelOffset: { dx, dy }`, world millimetres from the caption's automatic
  position. Absent means automatic. A dragged room caption is no longer displaced around pins and
  dimension labels: a placement the renovator chose wins.
- **Authority:** the plan geometry sidecar (ADR-0002), on the zone's `objects` entry and on the
  element. Schema 10, written only while some caption in the document is moved; the 9 → 10 migration
  advances the discriminator only. An older build refuses such a sidecar rather than dropping offsets
  on its next save.
- **Interaction:** only a SELECTED item's caption is grabbable, in the `plan` perspective with the
  Select tool, never in the select-multiple mode or with Shift or Alt held. No snapping. A vertex
  handle or a multi-selection badge under the pointer wins over a caption.
- **History:** a drop is one write through the item's existing guarded path — `MoveSpatialObjectCommand`
  for a zone, the two-document renovation command for an element — so it is one undo step with the
  same stale and conflict refusals as a move or a turn.
- **Carried by every rewrite of the geometry:** zone moves, nudges and turns keep the offset; a
  calibration rescales it; a group move's projection and its zone versions carry it; the zone version
  digest observes it.

## Alternatives

- **An absolute position.** Left behind by every move, nudge and turn, so each of those commands
  would have to move it as well.
- **Session-only state.** Lost on reload.
- **Frontmatter on the zone note.** Elements have no note, and a caption position is geometry.

## Consequences

- A vault with a moved caption opened in an older build refuses that plan's sidecar until the build
  is updated.
- A caption cannot be moved by keyboard, and there is no action returning it to its automatic place;
  undo is the way back from an accidental drag.

## Revisit when

A renovator asks for a reset action, a keyboard move, or to move a room's name and area separately.
