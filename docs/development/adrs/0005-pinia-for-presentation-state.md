---
adr: 5
title: Pinia for Presentation State
status: Accepted
date: 2026-08-22
area: presentation
---

# ADR-005: Pinia for Presentation State

## Context

The editor needs UI-facing and application state — the active project's working set, editor tool/viewport state, selection, and inspector state — that is distinct from the persisted Vault data. This state must be clearly separated from the persistent source of truth so that losing or resetting it never loses project data.

## Decision

Pinia manages UI and application-facing state via dedicated stores (`ProjectStore`, `EditorStore`, `SelectionStore`, `InspectorStore`, `WorkspaceStore`). Pinia is an application cache and working-state layer, not the persistent source of truth.

## Consequences

- Persistent data (project, plan, zone, asset, construction section, work package, cost data, geometry) lives in the Vault; Pinia only holds derived/working copies plus purely ephemeral UI state (hover, context menu, drag state, temporary polygon, selection marquee, active tool).
- Store contents must always be rebuildable from the Vault — no canonical business data may exist only in Pinia.
- Selection state is expressed as domain IDs, not references to Konva instances, so it stays meaningful independent of the rendering layer.
- Pinia is confined to the Presentation layer and must not be depended on by Domain or Core code (see ADR-006).

## Alternatives

- Vue's built-in reactivity (`ref`/`reactive`) without a dedicated store library — rejected: loses Pinia's devtools support, testability, and clear store boundaries as the number of views and stores grows.
- Vuex — rejected: superseded by Pinia for Vue 3, with a heavier API for the same guarantees.

## Revisit when

The number or complexity of stores outgrows what Pinia's flat store model handles cleanly — for example, needing cross-store transactions Pinia does not itself model.
