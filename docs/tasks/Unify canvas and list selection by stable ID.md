---
type: Task
parent: "[[Selection]]"
order: 10
status: Done
horizon: "MVP"
release: "[[MVP]]"
---

# Unify canvas and list selection by stable ID

## Evidence

[M00](../user-experience/renovation-planner-editor-specs/screens/M00-kitchen-selected-overview.md) enters from canvas or non-canvas list, and the vertical plan requires both to resolve the same entity ID.

## Why it matters

Two selection paths with separate state can highlight one room while the Inspector describes another.

## Approach

Route canvas and list intents through one selection action/store keyed by stable ID and supported entity type, then derive overlay and Inspector state from it.

## Acceptance criteria

- Canvas and list selection produce the same stored identity.
- Selecting a second record replaces the first.
- Inspector and overlay consume the shared identity.
- Selection causes no persistence write.

## Risks

Labels or render-array positions may accidentally become substitute identities.

## Outcome

Every single-selection surface agrees on exactly one spatial record.

## Closing evidence

**2026-09-03**, the plan editor foundation's first increment. Criterion 1 is
`tests/presentation/editor/shell/roomInspector.test.ts`'s 'heading, canvas selection and Inspector
share one id; the type and floor are homeowner words' beside
`tests/presentation/editor/shell/roomSummaryList.test.ts`'s 'a row click asks the runtime to select
and frame its own record' — one `SelectionStore` holding stable ids, and `kind` derived from the
record at read time rather than stored a second time. Criterion 2 is that file's 'marks the row
matching the current selection pressed, and no other'. Criterion 3 is the Inspector frame routing
by `selectedIds` (`tests/presentation/editor/shell/floorInspector.test.ts` for the empty arm).
Criterion 4 is `tests/presentation/editor/tools/selectTool.test.ts`'s 'a near-zero pointerUp is a
pure selection — no command, no history entry'.

**2026-09-04** — criterion 1's citation moves to
`tests/presentation/editor/shell/roomInspector.test.ts`'s 'one real click on Kitchen: store, named
outline, pressed list row and Inspector all carry zone-kitchen', for the reason
[[The cross-surface identity test starts after selection]] gives: the case it replaces wrote
`SelectionStore` directly and never crossed the canvas-to-selection boundary the criterion is
about.
