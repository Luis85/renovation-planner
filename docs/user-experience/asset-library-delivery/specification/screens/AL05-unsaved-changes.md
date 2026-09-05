---
id: AL05
status: proposed
version: 1.1
surface: asset-library
language: en
---
# AL05 — Leave an asset with unsaved changes

## Purpose and use case

Prevent accidental loss of user input.

**Actor:** a private renovator; no prior CAD or data-model knowledge is assumed.

## Entry and preconditions

Request another selection, New asset, note/designer/project navigation, or closure while the draft is changed.

## Visual reference

![Leave an asset with unsaved changes — reference](../images/prototype-desktop.jpg)

**Image status:** Context reference only; the protection dialog is not shown. This retained image uses German-localized UI labels; the English prose defines the behavior and is not an assertion that an English screen has been captured.

## Structure and components

Dialog identifying the asset and explaining the situation; Keep editing as the safe return; Discard and continue; no automatic save.

Uses the shared `AssetLibraryShell`, `AssetShelves`, `AssetRow`, `AssetInspector`, and state-dependent fields, dialogs, or feedback from the [component library](../component-library.md). Domain commands do not belong inside presentation components.

## Interactions and transitions

Remember the triggering navigation as a pending action. Keep editing returns to the triggering field. Discard resets the draft and executes the pending action exactly once. Esc means Keep editing.

The [central interaction rules](../interaction-rules.md) additionally apply, particularly focus management, local-draft protection, and explicit write outcomes.

## Exceptions and boundaries

Search, group state, and responsive changes do not discard input and therefore need no protection dialog. Forced termination of Obsidian cannot reliably be intercepted; promise no recovery guarantee.

## Acceptance criteria

Switching from A to B with a dirty A never displays A’s input under B. Closing the protection dialog does not execute navigation.

Every essential action must be available without a mouse. Errors and status include readable text; color alone is insufficient. Layout changes alter neither domain data nor the current draft.

## Verification

Test the happy path from the stated entry to the specified outcome. Then reproduce the stated exception using a controlled fixture or deliberately induced rejection. Record the screenshot and observed state separately; this specification is not evidence of a passed test.
