---
type: Task
parent: "[[Start one creation task from Add]]"
order: 20
status: New
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
