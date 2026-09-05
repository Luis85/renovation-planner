---
id: AL06
status: proposed
version: 1.1
surface: asset-library
language: en
---
# AL06 — Understand usage and price impact

## Purpose and use case

Recognize which projects use the shared price.

**Actor:** a private renovator; no prior CAD or data-model knowledge is assumed.

## Entry and preconditions

Read Used in, particularly before changing a price.

## Visual reference

![Understand usage and price impact — reference](../images/prototype-desktop.jpg)

**Image status:** Usage section is visible; data and project links are simulated in the prototype. This retained image uses German-localized UI labels; the English prose defines the behavior and is not an assertion that an English screen has been captured.

## Structure and components

Project name and requirement count; price source Library price or Project-specific price; explicit notice when the read is incomplete.

Uses the shared `AssetLibraryShell`, `AssetShelves`, `AssetRow`, `AssetInspector`, and state-dependent fields, dialogs, or feedback from the [component library](../component-library.md). Domain commands do not belong inside presentation components.

## Interactions and transitions

A project row opens the existing project-detail view. Edit project-specific prices only there. Library changes do not change override definitions or historical actual costs.

The [central interaction rules](../interaction-rules.md) additionally apply, particularly focus management, local-draft protection, and explicit write outcomes.

## Exceptions and boundaries

Do not claim all costs are already updated: persisted requirements, cascades, and price sources must be reconciled with the current cost model. Failed refresh remains visible.

## Acceptance criteria

Saving the library definition does not replace a project-specific price. Currency differences are not converted. Usage is shown as empty only after a successful read.

Every essential action must be available without a mouse. Errors and status include readable text; color alone is insufficient. Layout changes alter neither domain data nor the current draft.

## Verification

Test the happy path from the stated entry to the specified outcome. Then reproduce the stated exception using a controlled fixture or deliberately induced rejection. Record the screenshot and observed state separately; this specification is not evidence of a passed test.
