---
type: Task
parent: "[[Review renovation readiness spatially]]"
order: 60
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Export a linked Markdown readiness review

## Evidence

M17 and implementation-plan Phase 8 require generating and opening a vault-backed review note
with links, while the Review PBI forbids persisted readiness findings and canonical record
creation.

## Why it matters

Without a strict export boundary, a useful Markdown snapshot can become a second Issue system or
stale readiness authority.

## Approach

Generate and open an explicit read-only Markdown export from the current derived result. Include
generation context and links to reviewed authority-owned records; give the note no canonical
renovation, Issue or readiness-finding identity.

## Acceptance criteria

- The action creates and opens one vault-backed Markdown summary.
- The summary links to the reviewed canonical sources.
- It is not indexed or interpreted as an Issue, persisted finding or canonical renovation record.
- Generating it mutates no geometry or source record.
- Regenerating Review does not read the export as an input.
- A failed export leaves the current derived Review result unchanged.

## Risks

Frontmatter or folder placement may accidentally enrol the export as canonical project data.

## Outcome

The renovator can keep a portable linked review snapshot without creating another source of truth.
