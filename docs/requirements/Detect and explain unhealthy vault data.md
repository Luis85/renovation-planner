---
type: PBI
parent: "[[Release hardening]]"
order: 40
status: New
horizon: "MVP"
release: "[[MVP]]"
dependsOn:
  - "[[Error handling and diagnostics]]"
  - "[[Validation and vault health]]"
---

# Detect and explain unhealthy vault data

## Quality outcome

Before release, maintainers and renovators can detect malformed, unreadable, duplicated, missing,
future-version, or broken-reference editor data and understand the safe next action.

## Main flow

1. A vault-health check reads the canonical validation findings.
2. Findings identify the affected kind and stable identity without silently rewriting it.
3. The user-facing surface groups actionable problems and points to the source note where safe.
4. A diagnostics report records only technical codes, entity kinds, validated IDs, versions, and
   migration state needed for support.
5. The renovator can copy the report or inspect the source while all data remains local.

## Extensions

- **1a** — Part of the vault cannot be read. The check reports that limitation rather than
  declaring the unread region healthy.
- **2a** — A note comes from a newer schema. It is refused without overwrite and named as an
  unsupported-version finding.
- **4a** — A project name, room name, note body, path, free text, or other project content is
  offered to diagnostics. It is excluded.

## Guarantee

The health result never turns unreadable data into healthy data, silently repairs user files, or
places project content in diagnostics.

## Acceptance criteria

1. Canonical vault-health cases are detected and linked to safe user actions.
2. Partial scans state what could not be checked.
3. Future-version and unreadable notes remain untouched.
4. Diagnostics contain no project content, including names, paths, note bodies, and free text.
5. Findings use the canonical error and vault-health vocabularies rather than duplicate release
   classifications.

## Assumptions

- IDs are included only after validation and are not treated as display labels.
- Repair is separate work requiring its own guarantees; this item detects and explains.
- The released report remains on-device unless the renovator deliberately copies it.

## Sources

PRD §44, §90–§92; [[Error handling and diagnostics]]; [[Validation and vault health]];
Phase 12 in the
[editor implementation plan](../user-experience/renovation-planner-editor-specs/implementation/implementation-plan.md).
