---
adr: 4
title: Vue 3 for Plugin UI
status: Accepted
date: 2026-08-22
area: presentation
---

# ADR-004: Vue 3 for Plugin UI

## Context

The plugin needs a component framework for its workspace views (Renovation Project, Plan Editor, and future Budget/Schedule/Procurement/Dashboard views), custom Bases views, and editor chrome (toolbar, layers panel, inspector). It needs to integrate cleanly with Obsidian's `ItemView` lifecycle and with the chosen canvas renderer (see ADR-003).

## Decision

Vue 3 is used for view composition across the plugin's UI. Each Obsidian `ItemView` mounts its own isolated Vue application (`createApp()` with its own Pinia instance and root component), which is unmounted when the Obsidian view closes.

## Consequences

- `vue-konva` gives the Plan Editor a Vue-native way to drive Konva.
- Every workspace view needs explicit mount/unmount handling tied to the Obsidian view lifecycle, rather than one long-lived app instance.
- Vue components belong to the Presentation layer only; Vue itself must not be depended on by Domain or Core code (see ADR-006).
- Component-level behavior (inspector, toolbar, selection, dialogs, validation messages) is tested with Vitest and `@vue/test-utils`, separately from Domain/Application unit tests.

## Alternatives

- React — rejected: no first-party Konva binding as mature as `vue-konva`, and would require bridging Obsidian's plugin lifecycle to a framework it was not built around either way, without that binding's payoff.
- Framework-free DOM/vanilla TypeScript views — rejected: would mean hand-building reactivity, component composition, and state binding this early, defeating the purpose of having a presentation layer at all.

## Revisit when

`vue-konva` or Vue 3 itself becomes unmaintained, or Obsidian's own plugin ecosystem standardizes on a different UI framework contract that this plugin would need to interoperate with.
