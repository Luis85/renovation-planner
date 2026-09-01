---
type: Task
parent: "[[Open a floor plan in the Obsidian editor shell]]"
order: 60
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Enforce shared editor component and state boundaries

## Evidence

The component library assigns layout to the responsive shell, selection to the shared selection
store, temporary gestures to the tool runtime, persisted data to queries and commands, panel
visibility to UI state, drafts to forms, and save/stale state to an orthogonal channel.

## Why it matters

If shared components query repositories, persist directly or own duplicate selection and
viewport state, responsive composition can reset context and canvas/list routes can disagree.

## Approach

Define and check the inputs and emitted intents for the shell, context bar, Property/Layers
panel, canvas, Inspector and status bar. Compose data and commands at the editor boundary, keep
shape components render-only, and add architecture/component tests at the forbidden dependency
and write seams.

## Acceptance criteria

- The shell owns layout only and receives hydrated state from its composition boundary.
- Canvas shapes consume render models and emit interaction intents without repository access or
  persistence.
- Inspector edits dispatch commands; no shared component writes vault data directly.
- Selection, tool, viewport, panel, draft and save/stale state have the component-library owners
  and no competing owner in a responsive variant.
- Full and constrained presentations reuse content components rather than forking behavior.
- Architecture checks fail for a repository import or vault write introduced in shared
  presentation components.

## Risks

Prop drilling can encourage a global escape hatch; an architecture list can also miss a new
component unless checks target forbidden boundaries.

## Outcome

The editor shell can evolve responsively without blurring presentation, interaction, application
and persistence ownership.
