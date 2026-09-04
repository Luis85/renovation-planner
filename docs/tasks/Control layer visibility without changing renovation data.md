---
type: Task
parent: "[[Layers]]"
order: 20
status: Active
horizon: "MVP"
release: "[[MVP]]"
---

# Control layer visibility without changing renovation data

## Evidence

[M01](../user-experience/renovation-planner-editor-specs/screens/M01-standard-plan-view.md) defines layer toggles as projection changes, and the component contract separates presentation layers from semantic Existing/Planned state.

## Why it matters

Hiding information must never be mistaken for deleting or changing the underlying renovation record.

## Approach

Connect available visibility controls to the canonical layer state and ordered canvas projection, preserving selection identity and domain records.

## Acceptance criteria

- Toggling a layer changes rendered visibility only.
- No domain command or vault mutation is dispatched for transient visibility where not persisted.
- Hidden selected records remain coherently represented by list/Inspector behavior.
- Layer ordering stays deterministic.

## Risks

Canvas and list filtering can diverge when a selected layer becomes hidden.

## Outcome

Users can simplify a busy floor without changing its renovation content.

## Amendments

**2026-09-03**, the plan editor foundation's first increment. Criteria 1 and 2 are one case,
`tests/presentation/editor/shell/layerList.test.ts`'s 'renders one checkbox per catalogue entry,
labelled, and toggles the Konva layer it stands for', which asserts the STORE state a toggle
writes: layer visibility is a `WorkspaceStore` field with no command wired behind it, so there is
nothing for a toggle to dispatch and nothing for it to persist. That is the load-bearing reason,
and it is narrower than the layer bans in `eslint.config.mjs` — those stop `presentation/`
importing `infrastructure/`, not a component dispatching through services it was handed, so
citing them here would claim a check that does not cover this. Criterion 4 is
`tests/presentation/editor/layers/layerCatalogue.test.ts`'s order case.

**Criterion 3 is held by NOTHING, which is why this Task is Active rather than Done.** Hiding the
rooms layer leaves the Room Inspector and the room list drawing a selection whose shape is no
longer on the canvas. That may well be the coherent behaviour this criterion asks for; no case
asserts it either way, and no decision is recorded anywhere, so nothing would notice it changing.
