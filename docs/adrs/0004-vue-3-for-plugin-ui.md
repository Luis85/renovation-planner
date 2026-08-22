# ADR-004: Vue 3 for Plugin UI

## Status

Accepted

## Context

The plugin needs a component framework for its workspace views (Renovation Project, Plan Editor, and future Budget/Schedule/Procurement/Dashboard views), custom Bases views, and editor chrome (toolbar, layers panel, inspector). It needs to integrate cleanly with Obsidian's `ItemView` lifecycle and with the chosen canvas renderer (see ADR-003).

## Decision

Vue 3 is used for view composition across the plugin's UI. Each Obsidian `ItemView` mounts its own isolated Vue application (`createApp()` with its own Pinia instance and root component), which is unmounted when the Obsidian view closes.

## Consequences

- `vue-konva` gives the Plan Editor a Vue-native way to drive Konva.
- Every workspace view needs explicit mount/unmount handling tied to the Obsidian view lifecycle, rather than one long-lived app instance.
- Vue components belong to the Presentation layer only; Vue itself must not be depended on by Domain or Core code (see ADR-006).
- Component-level behavior (inspector, toolbar, selection, dialogs, validation messages) is tested with Vitest and `@vue/test-utils`, separately from Domain/Application unit tests.
