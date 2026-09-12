---
adr: 30
title: A renovation record may have no room
status: Accepted
date: 2026-09-12
area: domain
---

# ADR-0030: A renovation record may have no room

## Context

ADR-0021 gave every record "one Room context". A wall on a property border, a garden wall or a
free-standing partition bounds no room, so nothing could be recorded about it, and Areas got no
renovation details at all.

## Decision

- The PRIMARY `roomId` of subjects, Work, decisions, costs, evidence and procurement is optional.
  A record's context is `contextOf(item) = item.roomId ?? item.targetId`, and every "same room?"
  comparison asks "same context?". `spatialContexts` reports the primary link with that context.
- A record with a room names a present zone of any type. A record with none targets a wall,
  opening or element — never a zone. `''` is refused.
- Secondary shared links (ADR-0021 "Editor completion") still name a present zone.
- Evidence with no room has no pin: a pin is a fraction of a room's bounding box.
- A plan note holding such a record is written at schema 11 (pure 10 → 11 migration), so an older
  build refuses the note as newer instead of refusing its records as corrupt.
- A room-less wall that later encloses a room keeps its records room-less.

## Alternatives

- **A placeholder "floor" key.** A fabricated key every zone lookup silently misses.
- **Require an Area.** Needs an "outside" area drawn around the property first.
- **Store the target id in `roomId`.** A field named for rooms holding wall ids.
