---
id: AL07
status: proposed
version: 1.1
surface: asset-library
language: en
---
# AL07 — Open the shape and note

## Purpose and use case

Navigate from the catalogue to geometry or documentation.

**Actor:** a private renovator; no prior CAD or data-model knowledge is assumed.

## Entry and preconditions

Activate Edit shape or Open note on the selected asset.

## Visual reference

![Open the shape and note — reference](../images/prototype-desktop.jpg)

**Image status:** Actions are visible; prototype dialogs only explain the intended transitions. This retained image uses German-localized UI labels; the English prose defines the behavior and is not an assertion that an English screen has been captured.

## Structure and components

Measured outline with dimensions or an explicitly named state; two distinct action labels.

Uses the shared `AssetLibraryShell`, `AssetShelves`, `AssetRow`, `AssetInspector`, and state-dependent fields, dialogs, or feedback from the [component library](../component-library.md). Domain commands do not belong inside presentation components.

## Interactions and transitions

Edit shape uses the existing designer-reveal path for the asset ID. Open note uses the actual resolved note path. Apply AL05 first where necessary. Returning preserves selection, search, and groups.

The [central interaction rules](../interaction-rules.md) additionally apply, particularly focus management, local-draft protection, and explicit write outcomes.

## Exceptions and boundaries

Not read, no outline, unscaled, measured, and read failure stay distinct. Offer designer navigation for unreadable geometry only if the destination supports a genuinely functional recovery action.

## Acceptance criteria

Never infer measurements from an icon. A missing note produces a specific state and updates the catalogue. Do not embed a copy of the complete designer inside the library.

Every essential action must be available without a mouse. Errors and status include readable text; color alone is insufficient. Layout changes alter neither domain data nor the current draft.

## Verification

Test the happy path from the stated entry to the specified outcome. Then reproduce the stated exception using a controlled fixture or deliberately induced rejection. Record the screenshot and observed state separately; this specification is not evidence of a passed test.
