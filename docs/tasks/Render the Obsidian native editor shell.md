---
type: Task
parent: "[[Open a floor plan in the Obsidian editor shell]]"
order: 20
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Render the Obsidian native editor shell

## Evidence

[M01](../user-experience/renovation-planner-editor-specs/screens/M01-standard-plan-view.md) and the [component library](../user-experience/renovation-planner-editor-specs/components/component-library.md) lock the context bar, panel, canvas, Inspector and status hierarchy inside the host frame.

## Why it matters

A standalone-app frame duplicates Obsidian navigation, identity and theming instead of fitting the user's workspace.

## Approach

Compose existing editor regions into the locked shell, inherit semantic host variables, remove product account/logo assumptions and preserve leaf-scoped stores and disposal.

## Acceptance criteria

- All locked shell regions render with real editor state.
- Default light and dark themes remain legible without a plugin theme switch.
- Closing the leaf releases canvas, listeners and scoped stores.
- The shell contains no account, avatar or standalone navigation.

## Risks

Visual conformance can hide lifecycle leaks; verify both rendered states and teardown.

## Outcome

The editor looks and behaves like an Obsidian workspace surface.
