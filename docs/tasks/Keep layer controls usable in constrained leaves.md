---
type: Task
parent: "[[Layers]]"
order: 30
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Keep layer controls usable in constrained leaves

## Evidence

[M16](../user-experience/renovation-planner-editor-specs/screens/M16-constrained-workspace.md) moves Property/Layers into one rail-triggered overlay while preserving values and viewport.

## Why it matters

Renovators routinely keep a source note beside the plan; hiding layer controls at that width breaks the core workflow.

## Approach

Reuse the same LayerList content in persistent and overlay containers, with keyboard focus management, text labels and state preserved across threshold changes.

## Acceptance criteria

- Full and constrained modes expose the same available layer actions.
- Only one temporary panel opens at a time.
- Opening and closing restores focus predictably.
- Resizing preserves layer values, selection and viewport.
- No essential control relies on an unlabeled icon.

## Risks

Forking constrained markup can drift from the persistent panel.

## Outcome

Layer control remains complete and accessible while the editor shares the workspace.
