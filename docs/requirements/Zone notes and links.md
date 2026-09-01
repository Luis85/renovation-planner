---
type: PBI
parent: "[[Zones and spatial objects]]"
order: 30
status: New
started: ""
finished: ""
horizon: "MVP"
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
strategic-alignment: ""
customer-value: ""
business-impact: ""
reach: ""
risk-reduction: ""
compliance: ""
time-criticality: ""
enablement: ""
confidence: ""
effort: ""
complexity: ""
business-value: ""
business-value-model: ""
release: "[[MVP]]"
---

# Zone notes and links

§15's zone metadata and Markdown links, which is where this product stops being a canvas plugin.
A zone is a note (§37) with a stable ID (§60), so it can be linked to, tagged, backlinked, put in
a Bases table (§41) and written about in prose — the things an Obsidian user already knows how to
do, applied to a room.

This is also what §44's portability requirement cashes out to: uninstall the plugin and the zones
are still there as readable notes.

## Actor

[[Private renovator]], using a zone through ordinary Obsidian.

## Preconditions

- A zone exists as a Markdown note (§37).

## Main flow

1. The renovator opens the zone note.
2. The renovator writes about the zone in ordinary Markdown and adds links or tags as needed.
3. Obsidian exposes the note through links, backlinks, search and Bases (§41).
4. The zone remains connected to its domain identity through a stable ID independent of its
   filename, title and folder (§60).
5. The renovator can return to and query the zone without opening the canvas.

## Extensions

- **2a** — The renovator renames or moves the note. Its stable ID remains the zone's identity
  (§60).
- **3a** — The renovator follows a link or backlink, or opens the zone from a Bases row. The same
  zone note is reached.
- **5a** — The plugin is disabled or uninstalled. The zone remains readable as Markdown (§44).

## Guarantee

Every zone remains an ordinary, portable Obsidian note whose links and prose are usable without
the canvas and whose identity does not depend on its path or title.

## Out of scope

- Drawing zone geometry.
- Defining zone types or evaluating spatial relationships.
- Specifying custom Bases views beyond using the same Vault data (§41).

## Acceptance criteria

1. Every zone is persisted as a readable Markdown note (§37).
2. A renovator can write prose, links and tags in the zone note.
3. The zone can participate in links, backlinks, search and Bases without opening the canvas.
4. Renaming or moving the note does not change the zone's stable ID (§60).
5. Disabling or uninstalling the plugin leaves the zone note readable (§44).

## Assumptions

1. Obsidian supplies Markdown editing, links, backlinks, tags, search and Bases; this PBI makes a
   zone usable through them rather than redefining those capabilities.
2. This PBI requires a stable ID and readable note, but does not choose their implementation.

## Sources

PRD §15 (zone metadata and Markdown links), PRD §37 (Note-Based Entities), PRD §41 (Bases
Integration), PRD §44 (portability) and PRD §60 (Identity Model).
