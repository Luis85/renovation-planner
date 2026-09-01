---
type: PBI
parent: "[[Release hardening]]"
order: 50
status: New
horizon: "MVP"
release: "[[MVP]]"
dependsOn:
  - "[[Accessibility]]"
  - "[[Draw and name a rectangular room]]"
  - "[[Use the editor in Obsidian themes and constrained layouts]]"
---

# Operate the released editor without a pointer

## Actor

A renovator who uses a keyboard, switch input, or screen reader instead of relying on the canvas
pointer model.

## Main flow

1. The renovator enters the editor and reaches its context, panels, canvas alternative,
   Inspector, dialogs, and status without a pointer.
2. They select a room from a list, inspect it, and edit supported values through forms.
3. They invoke Add and complete room or wall creation through a list/form path.
4. They undo, redo, cancel, delete, and recover from errors with visible and announced focus.
5. They return to the host workspace without a keyboard trap or lost context.

## Extensions

- **3a** — A direct-manipulation operation has no meaningful keyboard gesture. An equivalent
  list/form flow accepts the same intent and reaches the same command.
- **4a** — An action is unavailable. Its reason is programmatically exposed and not encoded only
  by dimming or color.
- **5a** — A modal, drawer, or overlay closes. Focus returns to the control or context that
  opened it.

## Guarantee

Every canvas operation in the released editor has an equivalent list/form path to the same
application action; pointer shortcuts never become the sole way to create, select, edit, or
inspect renovation data.

## Acceptance criteria

1. Selection, Add, room/wall creation, Inspector editing, dialogs, undo/redo, and failure
   recovery complete without a pointer.
2. Every canvas-only affordance is traced to a list/form equivalent using the same command path.
3. Focus is visible, ordered, restored after transient UI, and never trapped unintentionally.
4. Status and change semantics use text, icon, shape, or pattern in addition to color.
5. Automated accessibility checks and a manual keyboard/screen-reader audit both pass.

## Assumptions

- This release gate verifies [[Accessibility]]; it does not redefine WCAG policy.
- Alternative creation may use numeric geometry forms rather than imitating pointer movement.
- Real assistive technology and host keymaps require live-vault evidence.

## Sources

PRD §44; [[Accessibility]]; Phase 12 in the
[editor implementation plan](../user-experience/renovation-planner-editor-specs/implementation/implementation-plan.md);
keyboard and list-route rules in the
[component library](../user-experience/renovation-planner-editor-specs/components/component-library.md).
