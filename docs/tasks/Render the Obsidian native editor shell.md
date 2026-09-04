---
type: Task
parent: "[[Open a floor plan in the Obsidian editor shell]]"
order: 20
status: Done
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

## Closing evidence

**2026-09-03**, the plan editor foundation's first increment. `ResponsiveEditorShell.vue`
arranges the context bar, the panel, one `PlanCanvas` instance, the Inspector, the warning strip
and the status bar. Criterion 1 is `tests/presentation/editor/shell.test.ts` (every region present
and reachable) plus the per-region cases that assert each draws real state —
`tests/presentation/editor/shell/editorContextBar.test.ts`, `floatingPrimaryActions.test.ts`,
`layerList.test.ts`, `floorInspector.test.ts`, `statusBar.test.ts` — and
`tests/presentation/editor/shell/responsiveShell.test.ts` for the regions moving by layout mode.
Criterion 3 is `responsiveShell.test.ts`'s 'disconnects its observer on unmount' beside
`tests/presentation/views/planEditorView.test.ts`.

Two criteria are held by weaker instruments and the sentence says which. LEGIBILITY in both
themes (criterion 2) is the `plan-editor-dark` and `plan-editor-light` captures read by eye; the
only GATE under it is the build's SDD §84 colour check, which refuses a literal colour in a
partial and so guarantees the palette is the theme's, not that anything is readable. Criterion 4
(no account, avatar or standalone navigation) is true by construction — nothing here ever drew
one — and is asserted by nothing.
