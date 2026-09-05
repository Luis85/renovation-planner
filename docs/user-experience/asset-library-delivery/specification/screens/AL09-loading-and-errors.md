---
id: AL09
status: proposed
version: 1.1
surface: asset-library
language: en
---
# AL09 — Handle loading, saving, and data errors

## Purpose and use case

Work with incomplete data without false confidence.

**Actor:** a private renovator; no prior CAD or data-model knowledge is assumed.

## Entry and preconditions

Initial loading, a failed read/write, an external edit, or a disappeared selection.

## Visual reference

![Handle loading, saving, and data errors — reference](../images/prototype-desktop.jpg)

**Image status:** Layout reference only; error states still require dedicated visual acceptance. This retained image uses German-localized UI labels; the English prose defines the behavior and is not an assertion that an English screen has been captured.

## Structure and components

Initial loading notice; persistent warning strip when previous data exists; explanation and appropriate action within the affected section.

Uses the shared `AssetLibraryShell`, `AssetShelves`, `AssetRow`, `AssetInspector`, and state-dependent fields, dialogs, or feedback from the [component library](../component-library.md). Domain commands do not belong inside presentation components.

## Interactions and transitions

Retry repeats only the failed operation. Where appropriate, repair an unreadable note through Open note. A newer schema version identifies updating the plugin as the remedy. Write failure preserves the draft.

The [central interaction rules](../interaction-rules.md) additionally apply, particularly focus management, local-draft protection, and explicit write outcomes.

## Exceptions and boundaries

A successful write followed by failed read-back means “Saved · Refresh needed”, not Save failed. Resolve unknown write outcomes before repeating a non-idempotent operation.

## Acceptance criteria

Old search or selection responses cannot replace newer state. Null, missing, unreadable, and not loaded are distinct. A conflict never silently overwrites external changes.

Every essential action must be available without a mouse. Errors and status include readable text; color alone is insufficient. Layout changes alter neither domain data nor the current draft.

## Verification

Test the happy path from the stated entry to the specified outcome. Then reproduce the stated exception using a controlled fixture or deliberately induced rejection. Record the screenshot and observed state separately; this specification is not evidence of a passed test.
