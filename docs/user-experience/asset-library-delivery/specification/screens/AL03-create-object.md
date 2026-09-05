---
id: AL03
status: proposed
version: 1.1
surface: asset-library
language: en
---
# AL03 — Create a new asset

## Purpose and use case

Capture a reusable definition with a small number of inputs.

**Actor:** a private renovator; no prior CAD or data-model knowledge is assumed.

## Entry and preconditions

Activate New asset; handle any pending changes through AL05 first.

## Visual reference

![Create a new asset — reference](selected-direction.png)

**Image status:** The entry point is visible; the creation dialog is specified in text. This retained image uses German-localized UI labels; the English prose defines the behavior and is not an assertion that an English screen has been captured.

## Structure and components

Dialog with name, category, unit, and a clearly labelled price including currency; other existing metadata is secondary; Create and Cancel.

Uses the shared `AssetLibraryShell`, `AssetShelves`, `AssetRow`, `AssetInspector`, and state-dependent fields, dialogs, or feedback from the [component library](docs/user-experience/asset-library-delivery/specification/component-library.md). Domain commands do not belong inside presentation components.

## Interactions and transitions

Focus Name. Explicit creation performs exactly one create operation. Categories and units match the domain catalogue. Zero is a deliberately supplied price, not a substitute for unknown. After success select the new asset and category and reset search deliberately.

The [central interaction rules](interaction-rules.md) additionally apply, particularly focus management, local-draft protection, and explicit write outcomes.

## Exceptions and boundaries

A similar name is a hint linking to existing results, not an automatic merge. Creation requires no outline. Do not show success when the write was rejected.

## Acceptance criteria

Cancel creates no file. Repeated clicks while saving create no duplicate. Failure preserves every input. If price is missing and the model cannot represent unknown, require a value.

Every essential action must be available without a mouse. Errors and status include readable text; color alone is insufficient. Layout changes alter neither domain data nor the current draft.

## Verification

Test the happy path from the stated entry to the specified outcome. Then reproduce the stated exception using a controlled fixture or deliberately induced rejection. Record the screenshot and observed state separately; this specification is not evidence of a passed test.
