---
type: Epic
order: 60
status: ""
started: ""
finished: ""
horizon: Now
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

# Zones and spatial objects

[[Plan editor]] can draw a polygon. This epic is what makes one of them *the bathroom*: a named
thing with a type, metadata, links and a place in the vault that the rest of the domain can
attach costs, work and photos to. §15 is the epic, §7 and §34 are the model it has to match,
and §36 is where the notes live.

The reason it is separate from the editor is the reason the whole product is arranged the way it
is. A zone is a domain object that happens to have geometry, not a drawing that happens to have
a name. It has to stay usable from ordinary Obsidian — a wikilink, a Bases table (§41), a search
— by a user who never opens the canvas.

Zone types are the first place §84's configurability bites. The list in §15 ends in Custom, and
a type this plugin does not ship must survive being read and written back unchanged.

Derived from PRD §15 (Epic 4), with the spatial model from §7 and §34, identity from §60,
deletion from §64 and derived data from §88.

## Definition of done

An item beneath this epic is done when:

- A Zone is a Markdown note with a stable ID independent of its filename, title and folder
  (§60), so renaming it in Obsidian cannot orphan its geometry, its costs or its photos.
- Zone types are configurable (§84), and an unrecognised type is kept exactly as written rather
  than rewritten to something known.
- Area and perimeter are derived on every read (§88), never stored in frontmatter where they can
  drift away from the geometry that produced them.
- Deleting a zone reports what references it and offers §64's choices. A silent cascading delete
  is refused, and so is a delete that leaves dangling IDs behind (§63).
- A zone is reachable and useful through links and Bases (§41) without opening this plugin's own
  views.
