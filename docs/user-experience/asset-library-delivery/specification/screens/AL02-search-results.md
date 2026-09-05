---
id: AL02
status: proposed
version: 1.1
surface: asset-library
language: en
---
# AL02 — Search and evaluate results

## Purpose and use case

Find an asset by name, supplier, or SKU.

**Actor:** a private renovator; no prior CAD or data-model knowledge is assumed.

## Entry and preconditions

Focus the search field and enter a term.

## Visual reference

![Search and evaluate results — reference](prototype-desktop.jpg)

**Image status:** Composition reference only; not a capture of a filtered list. This retained image uses German-localized UI labels; the English prose defines the behavior and is not an assertion that an English screen has been captured.

## Structure and components

Search field with an accessible clear action; results in their existing groups; result count; No matching assets where applicable.

Uses the shared `AssetLibraryShell`, `AssetShelves`, `AssetRow`, `AssetInspector`, and state-dependent fields, dialogs, or feedback from the [component library](docs/user-experience/asset-library-delivery/specification/component-library.md). Domain commands do not belong inside presentation components.

## Interactions and transitions

Search ignores case and surrounding whitespace. Search name, supplier, SKU, and category. Matching groups are open during search. Clearing search restores the prior group state.

The [central interaction rules](interaction-rules.md) additionally apply, particularly focus management, local-draft protection, and explicit write outcomes.

## Exceptions and boundaries

A filtered-out selection remains selected internally; the wide inspector shows “Selected asset is outside the results.” In a narrow panel, searching displays the list without deleting a draft.

## Acceptance criteria

An unsuccessful search does not remove an existing asset or create one. The result count counts assets, not categories. Search terms are not persisted as domain changes.

Every essential action must be available without a mouse. Errors and status include readable text; color alone is insufficient. Layout changes alter neither domain data nor the current draft.

## Verification

Test the happy path from the stated entry to the specified outcome. Then reproduce the stated exception using a controlled fixture or deliberately induced rejection. Record the screenshot and observed state separately; this specification is not evidence of a passed test.
