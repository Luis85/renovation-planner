---
adr: 2
title: JSON Sidecar for Plan Geometry
status: Accepted
date: 2026-08-22
area: persistence
---

# ADR-002: JSON Sidecar for Plan Geometry

## Context

Spatial objects (zones, physical elements, annotations) carry geometry — polygons, points, transforms — that changes frequently during editing and does not map cleanly onto YAML frontmatter (see ADR-001). Storing geometry inline in a note's frontmatter would mean a Vault write on every edit of a potentially large, deeply nested structure, and one file per spatial object would multiply small write operations during normal editing.

## Decision

High-volume plan geometry is stored per plan in a structured JSON sidecar file (for example, `Ground Floor.geometry.json`), separate from the plan's Markdown note, rather than embedding geometry in frontmatter or splitting it into one sidecar per spatial object.

> Where exactly that sidecar file lives and what it is named is refined by [ADR-011](0011-configurable-geometry-sidecar-folder-and-file-extension.md): sidecars live in one configurable folder, named by plan ID, not colocated next to the plan note as the example above suggests. The "one sidecar per plan" decision below is unchanged.

## Consequences

- Editing a plan touches one geometry file per plan instead of many small per-object files.
- The Markdown note and its geometry sidecar can drift out of sync; updates affecting both must be treated as one logical transaction, with failure handling that preserves previously valid data.
- The sidecar format needs its own schema version and migration path, independent of (but coordinated with) the Markdown schema version.
- Geometry coordinates in the sidecar are expressed in world units, never canvas pixels (see ADR-009).

## Alternatives

- Embedding geometry directly in the plan note's frontmatter — rejected: frontmatter is not suited to large, frequently changing nested arrays, and every drag or resize would dirty the whole note.
- One JSON sidecar per spatial object — rejected: multiplies small file writes during normal editing and complicates loading a plan's full geometry as a unit.

## Revisit when

A plan's spatial-object count grows large enough that a single per-plan sidecar becomes a write or contention bottleneck, or Obsidian gains an API for partial, non-full-file writes.
