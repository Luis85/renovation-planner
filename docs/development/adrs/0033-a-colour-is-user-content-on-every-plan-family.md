---
adr: 33
title: A colour is user content on every plan family
status: Accepted
date: 2026-09-15
area: domain
---

# ADR-0033: A colour is user content on every plan family

## Context

Item colours gave plain items and placed assets six named presets on the plan's geometry sidecar (schema 14).
Renovators asked to colour everything they draw — paths, marks, posts, walls, openings and rooms — in any colour,
several things at once. ADR-0031 had refused custom colours for walls ("theme clashes"), and ADR-0021 gave the
sidecar coordinates only.

## Decision

- A colour is a preset id or a lowercase `#rrggbb`, optional on every element kind, wall, opening and room entry of
  the sidecar; absence is the host's default drawing. Written at schema 16; a plan whose only colours are presets on
  items and placements keeps writing 14.
- It is appearance the user chose — not plugin chrome and not a material. A wall's material stays a theme-drawn
  hatch; the wall's colour is the ground under it. Filled areas take an opaque 28% tint over the host background,
  lines and text the colour at full strength (the accent while selected), and a room a translucent wash (0.18 at
  rest, 0.28 selected) so an imported plan stays readable.
- A room's colour lives on its sidecar entry, not in its note, so recolouring any mix of rooms, walls, openings and
  elements is one conditional sidecar write and one undo step through group operations.
- The proposed (intended) structure is not recoloured by this action.

## Alternatives

- **Room colour in note frontmatter.** Visible to Bases, but a batch recolour becomes one note write per room plus
  a sidecar write, with partial-failure rollback and a second migration.
- **Presets only.** No theme clash, but not what renovators asked for; the presets remain the first choice.
- **Recolouring the material hatch's ink.** Loses the contrast the hatch was drawn for.

## Consequences

- Amends ADR-0031's refused "custom colours" alternative and ADR-0021's "the sidecar owns coordinates only": the
  sidecar also owns user appearance.
- Nothing enforces contrast for a custom colour used as ink; Default resets it.
- A plan holding a custom colour, or a colour on anything but an item or placement, is refused by an older build as
  newer (schema 16).
- A pasted room starts uncoloured: the clipboard copies a room's outline, not its sidecar appearance.

## Revisit when

Renovators need colour on the proposed structure on its own, a colour as a note property, or a contrast guarantee
for custom colours.
