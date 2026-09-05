---
id: AL08
status: proposed
version: 1.1
surface: asset-library
language: en
---
# AL08 — Start with an empty library

## Purpose and use case

Create the first asset even before a project exists.

**Actor:** a private renovator; no prior CAD or data-model knowledge is assumed.

## Entry and preconditions

A successful catalogue read returns zero readable assets and zero known unreadable asset files.

## Visual reference

![Start with an empty library — reference](../images/selected-direction.png)

**Image status:** Style reference only; the empty state is not shown. This retained image uses German-localized UI labels; the English prose defines the behavior and is not an assertion that an English screen has been captured.

## Structure and components

Title; short explanation of the shared catalogue; Create first asset; no empty inspector form or invented examples.

Uses the shared `AssetLibraryShell`, `AssetShelves`, `AssetRow`, `AssetInspector`, and state-dependent fields, dialogs, or feedback from the [component library](../component-library.md). Domain commands do not belong inside presentation components.

## Interactions and transitions

Creation opens AL03. On success replace the empty state with the list and select the asset.

The [central interaction rules](../interaction-rules.md) additionally apply, particularly focus management, local-draft protection, and explicit write outcomes.

## Exceptions and boundaries

Unreadable files mean the library is not genuinely empty. Loading failure must not imply zero stock or ask the user to redefine existing assets.

## Acceptance criteria

A vault without projects can create and find assets. Do not copy prices or shape values from a demo asset.

Every essential action must be available without a mouse. Errors and status include readable text; color alone is insufficient. Layout changes alter neither domain data nor the current draft.

## Verification

Test the happy path from the stated entry to the specified outcome. Then reproduce the stated exception using a controlled fixture or deliberately induced rejection. Record the screenshot and observed state separately; this specification is not evidence of a passed test.
