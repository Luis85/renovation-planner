# Asset Library — Implementation backlog

Version 1.1 · 2026-09-05 · English project documentation · 18 PBIs, 2 technical enablers · Status: designed

This plan elaborates the previously created UI/UX specification. The codebase was inspected during the design session, but this backlog was not rechecked against a current commit. EN-01 is therefore the mandatory first step. Existing functionality is recognized as fulfilled rather than rebuilt.

The English edition preserves IDs, dependencies, scope, and acceptance intent. Existing screenshots are retained as **German-localized UI references**; they are not English-screen acceptance evidence. All document prose and executable-example wording is English.

## Feature groups

| ID | Feature |
| --- | --- |
| F01 | Find and browse the catalogue |
| F02 | Create and maintain definitions |
| F03 | Explore usage and source information |
| F04 | Handle errors and manage assets safely |
| F05 | Use an adaptive and accessible interface |

## Backlog

| ID | Use case | Feature | Dependencies |
| --- | --- | --- | --- |
| [PBI-01](PBI-01.md) | Open and resume the shared asset library | F01 | EN-01 |
| [PBI-02](PBI-02.md) | Compare and select assets within category groups | F01 | PBI-01 |
| [PBI-03](PBI-03.md) | Find an asset by name, supplier, or SKU | F01 | PBI-02 |
| [PBI-04](PBI-04.md) | Inspect the complete definition of a selected asset | F02 | PBI-02 |
| [PBI-05](PBI-05.md) | Explicitly save or discard asset metadata changes | F02 | PBI-04, EN-02 |
| [PBI-06](PBI-06.md) | Switch assets without accidentally losing input | F02 | PBI-05 |
| [PBI-07](PBI-07.md) | Change the library price while preserving project-specific prices | F02 | PBI-05, PBI-10 |
| [PBI-08](PBI-08.md) | Change an asset’s unit and waste allowance correctly | F02 | PBI-05 |
| [PBI-09](PBI-09.md) | Create a new asset without an existing project | F02 | PBI-01, PBI-06 |
| [PBI-10](PBI-10.md) | Understand project usage and each project’s price source | F03 | PBI-04 |
| [PBI-11](PBI-11.md) | Navigate from an asset to its note or a project using it | F03 | PBI-06, PBI-10 |
| [PBI-12](pbis/PBI-12.md) | Inspect the actual asset outline and open it in the designer | F03 | PBI-06 |
| [PBI-13](pbis/PBI-13.md) | Keep valid content after loading failures and retry the affected read | F04 | PBI-04 |
| [PBI-14](pbis/PBI-14.md) | Continue safely after save failures or external changes | F04 | PBI-05, PBI-13 |
| [PBI-15](pbis/PBI-15.md) | Use the library in narrow panels and host themes | F05 | PBI-03, PBI-06 |
| [PBI-16](pbis/PBI-16.md) | Complete library actions using only the keyboard | F05 | PBI-09, PBI-15 |
| [PBI-17](PBI-17.md) | Delete an unused asset without damaging its references | F04 | PBI-10, PBI-14 |
| [PBI-18](PBI-18.md) | Access asset information through native Obsidian notes and Bases | F03 | EN-01, PBI-11 |

## Technical prerequisites

- [EN-01 — Existing versus required behavior](EN-01.md)
- [EN-02 — Saving and conflicts](EN-02.md)

## Related documents

- [Implementation plan](docs/user-experience/asset-library-delivery/implementation-plan.md)
- [Delivery rules and readiness/completion criteria](delivery-rules.md)
- [Screen and interaction specifications with images](docs/user-experience/asset-library-delivery/specification/README.md)

All files are repository-ready Markdown. This package creates no external issues and makes no repository changes.

## User journeys

The [standalone user journey catalogue](../user-journeys/README.md) extracts the asset library flows with frontmatter, source references, and explicit concept status.
