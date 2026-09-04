---
type: Task
parent: "[[Selection]]"
order: 40
status: Active
horizon: "MVP"
release: "[[MVP]]"
---

# Compose predictive and contextual Select surfaces

## Evidence

M01 requires hover to preview the target and cursor before selection. The component contract keeps
resting Select/Add primary and limits a selected entity's direct popover to one or two common
actions with Inspector and keyboard equivalents.

## Why it matters

Without predictive feedback, overlapping selection is guesswork; exposing every action beside the
shape turns the canvas into a toolbar and excludes keyboard users.

## Approach

Project deterministic hit-test priority into a non-persistent hover outline and target-appropriate
cursor. Keep Select and Add as the resting surface, then compose a small contextual convenience
surface for the selected type from the same action descriptors used by Inspector and keyboard
routes.

## Acceptance criteria

- Hover outlines the exact stable identity the next selection intent would choose.
- The cursor communicates the available selection or manipulation intent and returns to resting
  Select when no target applies.
- Hover changes neither selection nor persistent data.
- With no selection, Select and Add remain the primary visible actions.
- A selection exposes no more than the approved high-frequency direct conveniences.
- Every direct convenience has an equivalent labelled Inspector route and keyboard-operable route
  dispatching the same intent.
- Unsupported actions are absent or explained rather than rendered as controls that do nothing.

## Risks

Canvas and Inspector action catalogues may drift, or hover may accidentally become a second
selection state.

## Outcome

Select predicts what will happen and offers restrained contextual shortcuts without making the
canvas the only action surface.

## Amendments

**2026-09-03** — the HOVER and CURSOR half landed, which is the scope spec §1 gave it. Criterion 1
is `tests/presentation/editor/tools/selectTool.test.ts`'s 'a hover with no gesture predicts the
same target a click there would take' — one `resolveSelectionTarget` answers both, so prediction
and selection cannot disagree — with `tests/presentation/editor/interactionLayer.test.ts` drawing
the outline for exactly that id and never for the selected one. Criterion 2 is
`tests/presentation/editor/canvasNavigation.test.ts`'s 'promises what a Select click would take,
and a running pan still outranks it', and its resting arm 'says nothing at rest'. Criterion 3 is
`selectTool.test.ts`'s 'starting a gesture clears the predicted hover' plus the hover path never
calling `selection.select`. Criterion 4 is
`tests/presentation/editor/shell/floatingPrimaryActions.test.ts`.

The CONTEXTUAL half is not built. This increment renders no direct convenience on a selection at
all, so criterion 7 is satisfied vacuously — there is no control that does nothing — while
criteria 5 and 6 have no subject to be measured against.

**2026-09-04** — criterion 2's evidence gains the case that makes the cursor say what spec §6.2
asks: `tests/presentation/editor/canvasNavigation.test.ts`'s 'says grab over a vertex handle of
the selected room and pointer over its body', which walks a handle, a body and empty canvas in
one gesture and expects `rp-plan-canvas-grab`, `rp-plan-canvas-target` and no class in turn. The
sentence recording that ONE class answered for both is deleted rather than qualified: the hover
now carries the resolver's KIND beside its id (`RenderState.hoveredTargetKind`, ruling R8), so
the erasure it described no longer happens. Closes [[A handle hover renders the body-selection
cursor]] and, with the retirement watcher clearing a hovered id the hydrated map no longer holds,
[[A deleted hover target keeps the target cursor active]].

**2026-09-04** — criterion 1's citation, `selectTool.test.ts`'s 'a hover with no gesture predicts
the same target a click there would take', now proves the claim end to end rather than only
predicting a hover in isolation: it hovers two overlapping candidates, captures the prediction,
then drives a real `pointerDown`/`pointerUp` at the same point and asserts the selection matches
it — the case it replaces invoked only `pointerMove`, twice, and never compared a predicted hover
against a click's own outcome. Closes [[The hover-click agreement test never clicks]].
