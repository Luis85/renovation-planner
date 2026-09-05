# Asset Library — Implementation backlog

Version 1.1 · 2026-09-05 · English project documentation · 18 PBIs, 2 technical enablers · Status: implementation in review

**Adopted 2026-09-05.** After pull request #70 implemented this package, its eighteen PBIs became register notes under `docs/requirements/`; the table below links there. The package ids survive in each note's Sources footer. EN-01 and EN-02 stay here as enablers the delivery record discharged.

The implementation has been reconciled against `origin/main` at `d00e9993`. The [delivery record](delivery-record.md) maps all PBIs to production code, tests and decisions. Existing functionality was retained; final real-vault acceptance remains open.

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
| [PBI-01](../../requirements/Open%20and%20resume%20the%20shared%20asset%20library.md) | Open and resume the shared asset library | F01 | EN-01 |
| [PBI-02](../../requirements/Compare%20and%20select%20assets%20within%20category%20groups.md) | Compare and select assets within category groups | F01 | PBI-01 |
| [PBI-03](../../requirements/Find%20an%20asset%20by%20name,%20supplier,%20or%20SKU.md) | Find an asset by name, supplier, or SKU | F01 | PBI-02 |
| [PBI-04](../../requirements/Inspect%20the%20complete%20definition%20of%20a%20selected%20asset.md) | Inspect the complete definition of a selected asset | F02 | PBI-02 |
| [PBI-05](../../requirements/Explicitly%20save%20or%20discard%20asset%20metadata%20changes.md) | Explicitly save or discard asset metadata changes | F02 | PBI-04, EN-02 |
| [PBI-06](../../requirements/Switch%20assets%20without%20accidentally%20losing%20input.md) | Switch assets without accidentally losing input | F02 | PBI-05 |
| [PBI-07](../../requirements/Change%20the%20library%20price%20while%20preserving%20project-specific%20prices.md) | Change the library price while preserving project-specific prices | F02 | PBI-05, PBI-10 |
| [PBI-08](../../requirements/Change%20an%20asset's%20unit%20and%20waste%20allowance%20correctly.md) | Change an asset’s unit and waste allowance correctly | F02 | PBI-05 |
| [PBI-09](../../requirements/Create%20a%20new%20asset%20without%20an%20existing%20project.md) | Create a new asset without an existing project | F02 | PBI-01, PBI-06 |
| [PBI-10](../../requirements/Understand%20project%20usage%20and%20each%20project's%20price%20source.md) | Understand project usage and each project’s price source | F03 | PBI-04 |
| [PBI-11](../../requirements/Navigate%20from%20an%20asset%20to%20its%20note%20or%20a%20project%20using%20it.md) | Navigate from an asset to its note or a project using it | F03 | PBI-06, PBI-10 |
| [PBI-12](../../requirements/Inspect%20the%20actual%20asset%20outline%20and%20open%20it%20in%20the%20designer.md) | Inspect the actual asset outline and open it in the designer | F03 | PBI-06 |
| [PBI-13](../../requirements/Keep%20valid%20content%20after%20loading%20failures%20and%20retry%20the%20affected%20read.md) | Keep valid content after loading failures and retry the affected read | F04 | PBI-04 |
| [PBI-14](../../requirements/Continue%20safely%20after%20save%20failures%20or%20external%20changes.md) | Continue safely after save failures or external changes | F04 | PBI-05, PBI-13 |
| [PBI-15](../../requirements/Use%20the%20library%20in%20narrow%20panels%20and%20host%20themes.md) | Use the library in narrow panels and host themes | F05 | PBI-03, PBI-06 |
| [PBI-16](../../requirements/Complete%20library%20actions%20using%20only%20the%20keyboard.md) | Complete library actions using only the keyboard | F05 | PBI-09, PBI-15 |
| [PBI-17](../../requirements/Delete%20an%20unused%20asset%20without%20damaging%20its%20references.md) | Delete an unused asset without damaging its references | F04 | PBI-10, PBI-14 |
| [PBI-18](../../requirements/Access%20asset%20information%20through%20native%20Obsidian%20notes%20and%20Bases.md) | Access asset information through native Obsidian notes and Bases | F03 | EN-01, PBI-11 |

## Technical prerequisites

- [EN-01 — Existing versus required behavior](enablers/EN-01.md)
- [EN-02 — Saving and conflicts](enablers/EN-02.md)

## Related documents

- [Implementation plan](implementation-plan.md)
- [Delivery rules and readiness/completion criteria](delivery-rules.md)
- [Screen and interaction specifications with images](specification/README.md)

All files are repository-ready Markdown. This package creates no external issues and makes no repository changes.

Implementation: [delivery record and contract matrix](delivery-record.md), [native access](native-access.md), and [state captures](captures/manifest.json).

## User journeys

The [standalone user journey catalogue](../user-journeys/README.md) extracts the asset library flows with frontmatter, source references, and explicit concept status.
