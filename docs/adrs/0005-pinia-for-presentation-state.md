# ADR-005: Pinia for Presentation State

## Status

Accepted

## Context

The editor needs UI-facing and application state — the active project's working set, editor tool/viewport state, selection, and inspector state — that is distinct from the persisted Vault data. This state must be clearly separated from the persistent source of truth so that losing or resetting it never loses project data.

## Decision

Pinia manages UI and application-facing state via dedicated stores (`ProjectStore`, `EditorStore`, `SelectionStore`, `InspectorStore`, `WorkspaceStore`). Pinia is an application cache and working-state layer, not the persistent source of truth.

## Consequences

- Persistent data (project, plan, zone, asset, construction section, work package, cost data, geometry) lives in the Vault; Pinia only holds derived/working copies plus purely ephemeral UI state (hover, context menu, drag state, temporary polygon, selection marquee, active tool).
- Store contents must always be rebuildable from the Vault — no canonical business data may exist only in Pinia.
- Selection state is expressed as domain IDs, not references to Konva instances, so it stays meaningful independent of the rendering layer.
- Pinia is confined to the Presentation layer and must not be depended on by Domain or Core code (see ADR-006).
