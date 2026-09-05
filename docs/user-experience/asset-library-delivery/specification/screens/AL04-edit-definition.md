---
id: AL04
status: proposed
version: 1.1
surface: asset-library
language: en
---
# AL04 — Edit the definition

## Purpose and use case

Deliberately correct metadata and the library price.

**Actor:** a private renovator; no prior CAD or data-model knowledge is assumed.

## Entry and preconditions

Select a readable asset and change a field.

## Visual reference

![Edit the definition — reference](../images/prototype-desktop.jpg)

**Image status:** Shows fields in the clean state; saving and error states are not shown. This retained image uses German-localized UI labels; the English prose defines the behavior and is not an assertion that an English screen has been captured.

## Structure and components

Fields as in the selected design; Unsaved changes status; contextual Save and Discard actions; field-level errors.

Uses the shared `AssetLibraryShell`, `AssetShelves`, `AssetRow`, `AssetInspector`, and state-dependent fields, dialogs, or feedback from the [component library](../component-library.md). Domain commands do not belong inside presentation components.

## Interactions and transitions

Input creates a local draft. Blur does not save. Save validates all changed fields, executes the agreed command path, and reads back the result. Discard restores the last confirmed baseline.

The [central interaction rules](../interaction-rules.md) additionally apply, particularly focus management, local-draft protection, and explicit write outcomes.

## Exceptions and boundaries

Do not convert currency implicitly. A unit change across dimension kinds may be rejected for referenced assets. Partial saving must not appear as complete success.

## Acceptance criteria

Reject negative or non-finite prices. Show errors at the field and preserve input. Until confirmed persistence, the list displays the last saved value.

Every essential action must be available without a mouse. Errors and status include readable text; color alone is insufficient. Layout changes alter neither domain data nor the current draft.

## Verification

Test the happy path from the stated entry to the specified outcome. Then reproduce the stated exception using a controlled fixture or deliberately induced rejection. Record the screenshot and observed state separately; this specification is not evidence of a passed test.
