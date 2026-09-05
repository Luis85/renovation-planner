# Renovation Planner — Asset Library UI/UX Specification

Version 1.1 · 2026-09-05 · English project documentation · Design direction selected; interaction contracts proposed for refinement.

## Scope and authority

This package continues the **second displayed concept**, selected by the user: compact category shelves with aligned columns and a narrower right inspector. It specifies the vault-wide asset library inside an Obsidian workspace leaf. Production remains Vue 3, TypeScript and Pinia. The React prototype demonstrates interactions; it is not production architecture or a replacement domain model.

![Selected design direction — German-localized UI reference](images/selected-direction.png)

The visual direction is selected. New behavior defined here is a proposed implementation contract, not evidence of user validation or current implementation. Existing domain safety rules remain authoritative. Consolidate conflicts explicitly before implementation; see the [decision register](decision-register.md).

## Language policy

English is the project language for documentation, PBI titles, tasks, acceptance criteria, and technical descriptions. English action names in this package express the canonical UX meaning and must resolve through the existing localization catalogue. German remains a supported UI locale. Existing concept images and browser captures are retained as German-localized references; their pixels have not been translated and do not prove English UI acceptance.

## Read in this order

1. [Interaction rules](interaction-rules.md)
2. Individual screen specifications below
3. [Component contracts](component-library.md)
4. [Decision and reconciliation register](decision-register.md)
5. [Implementation and verification plan](implementation-plan.md)

## Mental model

An asset is a reusable definition of a thing or service. A requirement is the amount needed by a project. Procurement and incurred costs are separate. The library owns no project and shows no aggregate financial value. Used in provides context without moving ownership into a project.

## Evidence boundaries

The package includes the selected concept and two browser captures of the prototype. Screens for errors, deletion, and empty states are specified in text but do not yet have dedicated screenshots. Each screen identifies whether its image shows that state or only the shared composition. Images are not acceptance evidence for unshown states. Prototype screenshots were captured at 1363 × 936; narrow mode uses a 460px container. Exact same-viewport visual matching against the 1487 × 1058 concept was not established.

## Obsidian integration

No account, plugin logo, or standalone application navigation. Use the host’s typography, workspace behavior, semantic CSS variables, and accent. Test light, dark, and a custom theme. The demo toolbar and theme buttons belong only to the prototype.

## Source basis

Repository files were inspected earlier in this design session on main; no immutable commit was recorded. Reconcile against the target commit before delivery.

- [Existing library specification](https://github.com/Luis85/renovation-planner/blob/main/docs/user-experience/asset-library-overview-DESIGN-SPEC.md)
- [Editor design set](https://github.com/Luis85/renovation-planner/tree/main/docs/user-experience/renovation-planner-editor-specs)
- [Asset entity](https://github.com/Luis85/renovation-planner/blob/main/docs/entities/Asset.md)
- [Asset library epic](https://github.com/Luis85/renovation-planner/blob/main/docs/requirements/Asset%20library.md)
- [Library presentation components](https://github.com/Luis85/renovation-planner/tree/main/src/presentation/library)

## Screen index

| ID | Screen | User goal |
| --- | --- | --- |
| AL00 | [Browse the library](screens/AL00-browse.md) | Recognize an existing asset before defining it again. |
| AL01 | [Inspect an asset definition](screens/AL01-selected-object.md) | Understand an asset’s definition, shape, and usage together. |
| AL02 | [Search and evaluate results](screens/AL02-search-results.md) | Find an asset by name, supplier, or SKU. |
| AL03 | [Create a new asset](screens/AL03-create-object.md) | Capture a reusable definition with a small number of inputs. |
| AL04 | [Edit the definition](screens/AL04-edit-definition.md) | Deliberately correct metadata and the library price. |
| AL05 | [Leave an asset with unsaved changes](screens/AL05-unsaved-changes.md) | Prevent accidental loss of user input. |
| AL06 | [Understand usage and price impact](screens/AL06-usage-and-price.md) | Recognize which projects use the shared price. |
| AL07 | [Open the shape and note](screens/AL07-shape-and-note.md) | Navigate from the catalogue to geometry or documentation. |
| AL08 | [Start with an empty library](screens/AL08-empty-library.md) | Create the first asset even before a project exists. |
| AL09 | [Handle loading, saving, and data errors](screens/AL09-loading-and-errors.md) | Work with incomplete data without false confidence. |
| AL10 | [Work in a narrow panel](screens/AL10-narrow-and-theme.md) | Use the library and details safely with limited space. |
| AL11 | [Delete an asset safely](screens/AL11-delete-object.md) | Remove a definition without damaging its usage references. |
