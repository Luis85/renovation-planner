---
name: Tool button
medium: dom
region: chrome
slice:
  - "[[05-canvas-rendering-and-editor-shell]]"
  - "[[06-editor-tool-framework-undo-redo-and-inspector]]"
partOf: "[[Design System]]"
sources:
  - PRD §39
  - SDD §56
  - SDD §57
  - SDD §85
type: component
---

# Tool button

One control, one tool. The reusable half of the [[Toolbar]] row, and the component with the
most states in the whole inventory — which is why it is its own note rather than a column in
its container's.

## Anatomy

- **An icon**, from Obsidian's own set via `setIcon`. Not a decoration: the icon is the button.
- **An accessible name**, always, because the icon is not one.
- **Optionally, the keyboard hint** for the shortcut PRD §39 asks for.

Two constraints from the mechanism rather than the design. **No inline styles** —
`eslint-plugin-obsidianmd` refuses them, so a state is a class. And **an icon choice cannot be
verified in this repository**: the browser harness deliberately renders no icons, so every one
is an invisible gap in the tool built for looking until the first real `setIcon` call arrives.

## States

Every one of these takes [[Design System]]'s second channel rather than restating it:

| State | Notes specific to this component |
| --- | --- |
| Default | — |
| Hover | — |
| Focus | Reached by arrow key inside the toolbar, not by tab |
| Active / pressed | The pointer-down moment, distinct from *selected* below |
| **Selected** | The active tool. This is **status**, so it may not be colour alone |
| Disabled | A tool unavailable in the current mode — `aria-disabled`, not removal |

*Active* and *selected* being two things is the distinction this table exists for: a button is
pressed for 100 ms and selected until the user picks another tool.

## Contract

**Given** a tool id, an icon name, a label, and whether it is the active tool. **Emits** an
activation request for its id.

It knows nothing about the tool it activates — not SDD §56's interface, not SDD §58's context.
A button that reached into the editor context would make the toolbar's ordering decision into
a coupling.

## Where it appears

[[Toolbar]] today. Any future rail header or context bar takes the same component rather than
drawing a second kind of icon button.

## Accessibility

**SDD §85's "adequate hit targets" is this component's most concrete obligation, and nothing
in this repository can measure it.** jsdom answers zero for every box, so axe's `target-size`
rule reports a false pass — worse than silence, because it reads as a check. `npm run
test-build` in a live vault is the only place the size of a tool button is actually verified.

The rest is ordinary and does have checks: the icon needs a name (axe sees this), the selected
tool needs `aria-pressed`, and focus needs a ring with its own thickness.

## Open

1. **Whether the keyboard shortcut is shown on the button or only in the command palette.**
   Showing it costs width the [[Toolbar]] may not have; hiding it makes PRD §39's shortcut list
   undiscoverable.
2. **Which Obsidian icon each of the six tools takes.** Unanswerable here, per the anatomy note
   above — this is the first component whose design needs the icon renderer that does not exist.

## Sources

PRD §39 · SDD §56 · SDD §57 · SDD §85, in
[`docs/prds/obsidian-renovation-planner.md`](../prds/obsidian-renovation-planner.md) and
[`docs/sdds/obsidian-renovation-planner-SDD.md`](../sdds/obsidian-renovation-planner-SDD.md).
