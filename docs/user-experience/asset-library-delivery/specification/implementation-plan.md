# Implementation and Verification

## Goal

Integrate the selected design into the existing Obsidian Asset Library with consistent specified interactions. The React prototype is a design reference, not a replacement production system.

## Sequence and dependencies

| Package | Deliverable / use case | Dependencies | Complete when |
| --- | --- | --- | --- |
| WP0 | Reconcile existing data model and UI contracts | None | Target commit, field/command mapping and decisions D01–D14 documented |
| WP1 | Browse and select an asset (AL00–02) | WP0 | Shelves, shared heading row, search and one selection source work |
| WP2 | Explicitly edit the definition (AL04–05) | WP0, WP1 | Commit strategy agreed; drafts, errors and navigation protected |
| WP3 | Create an asset (AL03, AL08) | WP1, WP2 | Empty vault through newly selected asset works end to end |
| WP4 | Open usage and sources (AL06–07) | WP1, WP2 | Real usage/override reads and navigation integrated |
| WP5 | Handle data errors and external changes (AL09) | WP2–4 | Conflicts, write/read-back and partial failures distinguishable |
| WP6 | Narrow panels and themes (AL10) | WP1; continuously WP2–5 | 460px and host themes work without state loss |
| WP7 | Safely remove referenced assets (AL11) | WP0, WP4, WP5 | Safe refusal/resolution paths and focus succession work |
| WP8 | Accept screens and reconcile documentation | WP1–7 | Real state captures and updated specification available |

## First vertical slice

Open an existing library → search for an asset → select it → correct its supplier → explicitly save → read back the confirmed row and note → open the narrow inspector → return to the list. Verify the saving state, a domain refusal and a failed read-back. Geometry creation, import and a complete asset designer are outside this slice.

WP0 is mandatory. If existing commands save individual fields, document a coordinated commit strategy before UI implementation. One shared button must not imply unsupported atomicity.

## Example PBIs as use cases

| Epic | Feature | PBI |
| --- | --- | --- |
| Asset library | Browse catalog | Find an existing asset by SKU |
| Asset library | Maintain definitions | Change the library price and understand project price sources |
| Asset library | Maintain definitions | Continue editing after a rejected save |
| Asset library | Maintain definitions | Switch assets without accidentally losing changes |
| Asset library | Navigation | Open the selected asset’s note |
| Asset library | Safe management | Review an asset with existing usage and delete it when allowed |

Tasks include UI work, use-case reconciliation and targeted verification. Follow the project lifecycle: designed → scoped → tech refined → estimated → ready. This UX draft does not automatically make a PBI ready.

## Acceptance scenarios

```gherkin
Feature: Edit a shared definition
  Scenario: Preserve a project override
    Given an asset has a library price and an override for project B
    When the user successfully changes the library price
    Then the override for project B remains unchanged
    And the usage section identifies its override price basis

  Scenario: Read-back fails after a confirmed write
    Given the write command confirms a valid change
    When the subsequent read fails
    Then the UI shows "Saved · Refresh needed"
    And Refresh does not invoke a second write command

  Scenario: Switch selection with a dirty draft
    Given asset A has an edited draft
    When the user selects asset B
    Then the leave guard opens
    When the user chooses Continue editing
    Then asset A remains selected with its draft

  Scenario: Usage check fails
    Given asset usage could not be read
    When the user views the delete action
    Then deletion cannot be executed
    And its blocking reason is readable
```

## Targeted test matrix

- 1440px, 720px, 560px and 460px leaves, plus limited height: main view, dialog and error field.
- Light, dark and one custom theme: focus, selection and warning text.
- Empty vault, only unreadable assets, no results, long German name, large prices and another currency.
- Selection race A→B, late search result, external note edit, unknown category and newer schema version.
- Double-clicked creation, rejected write, confirmed write/failed read, reference change before delete commit.
- Keyboard through search, row, form, leave guard and Back; actual screen-reader checks for relevant states.

Extend existing Vitest and harness tests for concrete risks. Earlier browser checks cover only the demo happy path and a few errors; they do not replace integration tests.

## Delivery

Place screens and images under `docs/user-experience/renovation-planner-asset-library-specs/`. Amend the older specification with a link and identify exactly which sections are superseded. Component mapping and implementation plans reference the inspected commit. This download does not modify the repository. The detailed delivery baseline is [the package implementation plan](../implementation-plan.md).
