# Decisions and reconciliation

## Status

The user confirmed the second displayed visual direction. This does not automatically confirm every technical or domain simplification in the prototype. Refine the following proposals for implementation.

| ID | Topic | Decision / proposal | Required implementation reconciliation | Resolved by |
| --- | --- | --- | --- | --- |
| D01 | Structure | Selected: compact category groups, aligned columns, right inspector | Evolve the existing shelves composition | delivery-record.md "Decisions D01–D14" |
| D02 | Column headings | Selected mock shows one shared header row; earlier specification says none | Record an explicit visual amendment; hide headings with their columns | delivery-record.md "Decisions D01–D14" |
| D03 | Saving | Proposed: unified draft with Save/Discard | Check field-level commands and atomicity; do not claim this already exists | EN-02 |
| D04 | Taxonomy | Four demo categories are only fixtures | Retain production vocabulary; do not coerce unknown values into Custom | Task B4 of this plan |
| D05 | Dimensions and icons | Demo uses type icons and a generated plank | Use actual geometry and error states in production | delivery-record.md "Decisions D01–D14" |
| D06 | Usage | Above price fields, mark project overrides | Verify reads and refresh/cascade contracts | delivery-record.md "Decisions D01–D14" |
| D07 | Height / other fields | Mock does not cover the entire asset | Preserve existing fields and expose them in groups; no implicit deletion | delivery-record.md "Decisions D01–D14" |
| D08 | Price currency | Always explicit with library price | Do not turn EUR fixtures into a global currency | delivery-record.md "Decisions D01–D14" |
| D09 | Zero price | No automatic zero for unknown | Clarify creation defaults and model support | delivery-record.md "Decisions D01–D14" |
| D10 | Deletion | Secondary action with checked reference state | Reuse deletion and compensation contracts | delivery-record.md "Decisions D01–D14" |
| D11 | Undo | Offer only with safe production history | Do not copy array-snapshot undo | delivery-record.md "Decisions D01–D14" |
| D12 | Bases | Native notes stay accessible; library does not replace Bases | Reconcile epic completion with the existing recipe/.base strategy | delivery-record.md "Decisions D01–D14" |
| D13 | Many empty categories | Current small taxonomy shows empty groups | Decide a rule when configurable taxonomies become large; do not invent an arbitrary limit | delivery-record.md "Decisions D01–D14" |
| D14 | Damaged geometry | No designer entry without a working destination | Specify designer recovery separately if absent | "D14 leaves damaged-sidecar repair to a separate dependency" |

## Engineering reconciliation task

Record the target commit. For each visible field document its source, read query, write command, validation, persistence, event, and refusal. Keep Asset, AssetShape, AssetPriceOverride, and Requirement distinct. Check measurement units, currency, and waste conversion against existing tests. Only then mark UI PBIs ready.

The existing extensive asset-library specification contains historical statements such as “No code exists” despite Vue components being present. Treat these as documentation drift, not instructions to rebuild. This package supplements UX; it does not replace detailed failure and persistence contracts wholesale.

## Outstanding visual verification

Captures exist for AL03–AL11 under `../captures/` (see `manifest.json`); real-vault acceptance remains open. Existing screenshots are explicitly identified as baseline or reference images in the screen files, and their German localization is identified.
