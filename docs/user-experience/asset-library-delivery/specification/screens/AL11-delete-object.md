---
id: AL11
status: proposed
version: 1.1
surface: asset-library
language: en
---
# AL11 — Delete an asset safely

## Purpose and use case

Remove a definition without damaging its usage references.

**Actor:** a private renovator; no prior CAD or data-model knowledge is assumed.

## Entry and preconditions

Secondary Delete asset action in the detail menu; not the primary action on a catalogue row.

## Visual reference

![Delete an asset safely — reference](prototype-desktop.jpg)

**Image status:** Detail context only; the delete action is not implemented in the prototype. This retained image uses German-localized UI labels; the English prose defines the behavior and is not an assertion that an English screen has been captured.

## Structure and components

Current asset name, checked usage, explicit effects; Cancel and a clearly labelled final delete action only when allowed.

Uses the shared `AssetLibraryShell`, `AssetShelves`, `AssetRow`, `AssetInspector`, and state-dependent fields, dialogs, or feedback from the [component library](docs/user-experience/asset-library-delivery/specification/component-library.md). Domain commands do not belong inside presentation components.

## Interactions and transitions

Recheck references before confirmation. Delete an unreferenced asset through the existing DeleteAsset path. For references, use only existing supported resolution; otherwise show usage and block deletion.

The [central interaction rules](interaction-rules.md) additionally apply, particularly focus management, local-draft protection, and explicit write outcomes.

## Exceptions and boundaries

While usage checking runs or has failed, deletion is unavailable and its reason is explained. Never automatically delete requirements or project data. Handle geometry and price references through existing transaction/compensation contracts.

## Acceptance criteria

The command catches references created between checking and commit. After success continue selection meaningfully; do not optimistically remove the asset after failure. No blanket undo promise without real restoration.

Every essential action must be available without a mouse. Errors and status include readable text; color alone is insufficient. Layout changes alter neither domain data nor the current draft.

## Verification

Test the happy path from the stated entry to the specified outcome. Then reproduce the stated exception using a controlled fixture or deliberately induced rejection. Record the screenshot and observed state separately; this specification is not evidence of a passed test.
