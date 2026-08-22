# ADR-002: JSON Sidecar for Plan Geometry

## Status

Accepted

## Context

Spatial objects (zones, physical elements, annotations) carry geometry — polygons, points, transforms — that changes frequently during editing and does not map cleanly onto YAML frontmatter (see ADR-001). Storing geometry inline in a note's frontmatter would mean a Vault write on every edit of a potentially large, deeply nested structure, and one file per spatial object would multiply small write operations during normal editing.

## Decision

High-volume plan geometry is stored per plan in a structured JSON sidecar file (for example, `Ground Floor.geometry.json`), separate from the plan's Markdown note, rather than embedding geometry in frontmatter or splitting it into one sidecar per spatial object.

## Decision Drivers

- Store plan geometry per plan rather than one file per spatial object, to reduce the number of small write operations during editing.
- Keep human-readable metadata (name, type, status) in Markdown, and keep geometry in a format optimized for editor access.

## Consequences

- Editing a plan touches one geometry file per plan instead of many small per-object files.
- The Markdown note and its geometry sidecar can drift out of sync; updates affecting both must be treated as one logical transaction, with failure handling that preserves previously valid data.
- The sidecar format needs its own schema version and migration path, independent of (but coordinated with) the Markdown schema version.
- Geometry coordinates in the sidecar are expressed in world units, never canvas pixels (see ADR-009).
