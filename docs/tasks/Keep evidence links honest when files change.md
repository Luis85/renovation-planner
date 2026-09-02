---
type: Task
parent: "[[Link evidence to spatial targets]]"
order: 30
status: New
horizon: "V1"
release: ""
dependsOn: "[[Retrieve evidence from spatial context]]"
---

# Keep evidence links honest when files change

## Evidence

M14 requires missing-file fallback, and ordinary Obsidian users rename, move or delete vault
content independently from the plugin.

## Why it matters

Dropping a broken link makes evidence look absent; retaining it as valid sends the renovator to
the wrong or nonexistent file.

## Approach

Integrate the relationship with the canonical vault-change and reference-integrity paths, preserve
renames where the link policy can resolve them, and expose missing/unreadable links as unresolved.

## Acceptance criteria

- Supported rename/move operations preserve the evidence-target relationship.
- A missing file leaves a visible unresolved relationship.
- Deletion follows explicit reference policy rather than silently dropping the link.
- Reload and incremental vault changes produce the same query result.

## Risks

Filesystem paths are not stable domain IDs; the chosen policy must not promise rename behavior
the host cannot deliver.

## Outcome

Not started.
