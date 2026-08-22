---
type: Epic
order: 140
status: ""
started: ""
finished: ""
horizon: "V1"
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
---

# Documents, photos and evidence

A renovation generates paper faster than it generates progress: quotes, invoices, delivery notes,
product data sheets, installation manuals, permits, warranties, contracts. §23's insight is that
filing it by date makes it unfindable, because the question is never "what arrived in March". It
is "what was the warranty on the thing in that room", and that is a question about an object in a
plan.

So this epic is about the *link* rather than the storage. Obsidian already stores files and
already has a graph; what is missing is that a warranty knows which radiator it covers and a
photo knows where in the bathroom it was taken (§23's spatial photo reference), which is what
turns a folder of images into an evidence timeline.

It is the storage mechanism the execution epics reuse: [[Progress and site documentation]] adds
dates and completion evidence on top of this, rather than growing a second photo store.

Derived from PRD §23 (Epic 12), with document types from §84, interoperability and portability
from §44 and derived data from §88.

## Definition of done

An item beneath this epic is done when:

- Every document links to the domain object it evidences, and a photo may additionally carry a
  spatial reference (§23).
- Document types are configurable (§84); §23's category list is the starting vocabulary, not a
  closed set, and an unrecognised type is kept as written.
- Files stay in the open formats §44 names and stay in the vault. Nothing depends on a copy this
  plugin holds somewhere else.
- The evidence timeline is derived from the documents' own dates (§88), never a maintained list.
- A document note still says what it is for when read without the plugin (§44 portability).
