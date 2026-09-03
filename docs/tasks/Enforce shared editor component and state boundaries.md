---
type: Task
parent: "[[Open a floor plan in the Obsidian editor shell]]"
order: 60
status: Done
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

## Closing evidence

**2026-09-03**, the plan editor foundation's first increment. Criterion 6 is the per-directory
layer bans in `eslint.config.mjs` plus `WRITE_BOUNDARY`, driven through real fixture paths by
`tests/build/vue-rules.test.ts` — a repository import or a vault write in a shared presentation
component fails `npm run lint`, not review. Criterion 5 is
`tests/presentation/editor/shell/responsiveShell.test.ts`'s element-identity assertion: full and
constrained are ONE `<slot name="canvas">` reordered by CSS, so they cannot fork behaviour even
in principle. Criterion 4 is `tests/presentation/stores/stores.test.ts` and
`tests/presentation/editor/shell/layoutMode.test.ts` — `layoutMode` and `overlay` have exactly one
owner, `WorkspaceStore`, and the responsive variants read it rather than keeping their own.
Criteria 2 and 3 are the pre-existing §59 Edit-to-Command choke point
(`tests/presentation/editor/inspector/`).

Criterion 1 ('the shell owns layout only') is a REVIEW obligation and is written down as one:
`ResponsiveEditorShell` owns its `ResizeObserver` and writes `layoutMode`, and nothing in any
gate would notice it growing a second responsibility.
