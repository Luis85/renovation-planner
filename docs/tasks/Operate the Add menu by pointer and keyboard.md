---
type: Task
parent: "[[Start one creation task from Add]]"
order: 20
status: Done
horizon: "MVP"
release: "[[MVP]]"
---

# Operate the Add menu by pointer and keyboard

## Evidence

[M02](../user-experience/renovation-planner-editor-specs/screens/M02-add-menu.md) requires anchored menu semantics, roving focus, search and Escape/click-outside cancellation.

## Why it matters

Add is the only creation entry point, so an inaccessible menu makes every later creation workflow inaccessible.

## Approach

Render and focus the catalogue as an Obsidian-themed menu; support arrow navigation, localized search, activation, dismissal and focus restoration.

## Acceptance criteria

- Add opens the menu and focuses the recommended available item.
- Arrow keys and search reach every enabled entry.
- Escape and click outside close it without dispatch or write.
- Disabled items expose their reason.
- Focus returns to Add after dismissal.

## Risks

Canvas key handlers can swallow menu keyboard events.

## Outcome

The complete Add choice is usable without a pointer and changes nothing until an item is chosen.

## Closing evidence

**2026-09-03**, the plan editor foundation's first increment.
`tests/presentation/editor/add/addMenu.test.ts` carries every criterion across seventeen cases:
criterion 1 is 'opens from Add, focuses Room, and closes on Escape with focus back on Add and
nothing dispatched', which is also criteria 3 and 5; criterion 2 is the traversal set —
'ArrowDown moves focus through enabled and disabled items alike', 'End jumps to the last item in
the flat, filtered list', the wrap case, 'typing filters by localized label and synonym', and
'narrowing the filter past the focused item moves the roving focus to the first remaining one';
criterion 3's other half is 'click outside closes without dispatch'; criterion 4 is 'an
unsupported item is aria-disabled with its reason and Enter on it changes nothing', with 'Space on
an unsupported item changes nothing' beside it.

What no test here reaches is whether Obsidian's OWN keymap fires behind the open menu: jsdom
models no host `Scope` stack, so `@keydown.stop` proves only that the canvas never sees the key.
Step 6 of [[Open a floor and select a room]] is the instrument.
