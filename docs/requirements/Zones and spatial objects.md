---
type: Feature
parent: "[[Plan editor]]"
order: 60
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

# Zones and spatial objects

[[Plan editor]] can draw a polygon. This feature is what makes one of them *the bathroom*: a named
thing with a type, metadata, links and a place in the vault that the rest of the domain can
attach costs, work and photos to. PRD §15 is the source epic, §7 and §34 are the model it has to
match, and §36 is where the notes live.

Although grouped under [[Plan editor]], this feature remains the domain authority for zones and
spatial objects. A zone is a domain object that happens to have geometry, not a drawing that
happens to have a name. It has to stay usable from ordinary Obsidian — a wikilink, a Bases table
(§41), a search — by a user who never opens the canvas.

Zone types are the first place §84's configurability bites. The list in §15 ends in Custom, and
a type this plugin does not ship must survive being read and written back unchanged.

Its stable note identity, configurable type, geometry-derived measurements and reference-safe
deletion remain domain rules rather than canvas behaviours. A Zone is a Markdown note whose
stable ID is independent of filename, title and folder (§60), and an unrecognised type survives
read and write exactly as written (§84). Area and perimeter are derived on every read rather than
stored where they can drift from their geometry (§88). Deletion reports references and offers
§64's choices; it neither cascades silently nor leaves dangling IDs (§63). Links and Bases keep
the Zone reachable without this plugin's views (§41).

Derived from PRD §15 (Epic 4), with the spatial model from §7 and §34, identity from §60,
deletion from §64 and derived data from §88.

## Outcome

A renovator can treat each drawn area as a durable, meaningful place that remains useful through
ordinary Obsidian notes, links, search and Bases without opening the canvas.
