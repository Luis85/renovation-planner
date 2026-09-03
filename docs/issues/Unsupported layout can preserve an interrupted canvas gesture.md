---
type: Issue
parent: "[[Open a floor plan in the Obsidian editor shell]]"
order: 10
status: New
started: ""
finished: ""
horizon: Now
start: ""
due: ""
risk: ""
priority: high
assignee: ""
iteration: ""
strategic-alignment: ""
customer-value: ""
business-impact: ""
reach: ""
risk-reduction: ""
compliance: ""
time-criticality: ""
enablement: ""
confidence: ""
effort: M
complexity: ""
business-value: ""
business-value-model: ""
---

# Unsupported layout can preserve an interrupted canvas gesture

## The question

What retires an in-flight canvas gesture when the responsive shell crosses below 400px and
unmounts the canvas?

## What is true today

`ResponsiveEditorShell.vue` removes the canvas in `unsupported` mode
(`src/presentation/editor/shell/ResponsiveEditorShell.vue:110-131`). The design explicitly
expects that unmount below 400px (`docs/superpowers/specs/2026-09-02-plan-editor-foundation-read-path-design.md:225-239`).

`EditorSurface` keeps the gesture's pointer identity in its component-local
`toolGesturePointer` (`src/presentation/editor/surface/EditorSurface.vue:140-149`), but its
unmount hook only removes the window blur listener and disconnects its observer
(`src/presentation/editor/surface/EditorSurface.vue:1174-1181`). The leaf-scoped
`ToolManager` survives with `gestureInFlight === true`
(`src/presentation/editor/tools/tool-manager.ts:40-48`, `src/presentation/editor/tools/tool-manager.ts:129-151`).
The remounted surface therefore has a live manager gesture and a fresh null pointer owner.

Measured with `rg -n "toolGesturePointer|cancelInterruptedGesture|onBeforeUnmount"
src/presentation/editor/surface/EditorSurface.vue`: the interruption cleanup is called from
pointer cancellation and blur, not from unmount. The responsive suite proves only
full-to-constrained element identity and unsupported canvas replacement
(`tests/presentation/editor/shell/responsiveShell.test.ts:31-49`,
`tests/presentation/editor/shell/responsiveShell.test.ts:145-167`).

## Why it matters

The parent requires constrained layout not to reset an active temporary task, and SDD §15
classifies that task as ephemeral state. A stale in-flight flag can lock camera actions or make
the next pointer stream belong to no owner, while the screen looks freshly mounted.

## What closes it

Before unsupported layout destroys `EditorSurface`, abandon only the interrupted press/release
gesture and clear its camera ownership while preserving any completed multi-click draft. Keep
that lifecycle decision at the surface boundary rather than teaching the shell tool details.

Add a responsive-shell test that starts a real tool gesture, resizes to 320px, returns to a
supported width, and proves both that `gestureInFlight` is false and that the next complete
pointer gesture commits normally. A drawing-tool variant must also prove that vertices completed
before the interrupted press survive, discriminating abandonment from a full cancel.

## References

- [[Open a floor plan in the Obsidian editor shell]]
- [[Keep the editor truthful across failure and narrow layouts]]
- `src/presentation/editor/shell/ResponsiveEditorShell.vue:110-131`
- `src/presentation/editor/surface/EditorSurface.vue:140-149`
- `src/presentation/editor/surface/EditorSurface.vue:1174-1181`
- `src/presentation/editor/tools/tool-manager.ts:129-151`
- `docs/superpowers/specs/2026-09-02-plan-editor-foundation-read-path-design.md:225-239`
- `tests/presentation/editor/shell/responsiveShell.test.ts:145-167`
- Reviewed at commit 16757d6d
- PASS 2
