# Asset Library — Component contracts

Status: proposed composition; reuse existing Vue components. Proposed wrapper names remain conceptual until reconciled with code.

| Component | Responsibility | Inputs / outputs | States |
| --- | --- | --- | --- |
| AssetLibraryShell | Arrange toolbar, content, inspector, and status for leaf width | width, selection, requestBack | wide, compact, single pane |
| AssetLibraryToolbar | Search and creation entry | query, searchChanged, createRequested | ready, searching |
| AssetShelves / AssetShelf | Render existing categories and grouped assets | categories, entries, expanded, toggle | empty, open, closed, filtered |
| AssetRow | Identity and comparison values | assetSummary, current, select | normal, focused, current |
| AssetMark | Display actual geometry state | outlineReadModel, state | not read, no shape, unscaled, measured, error |
| AssetInspector | Combine one selected asset and section states | assetId, sections, navigation intents | neutral, ready, missing, unreadable |
| AssetDefinitionForm | Hold an ID-bound draft and field errors | baseline, draftChanged, saveRequested, discard | clean, dirty, validating, saving, error |
| AssetUsageList | Project usage with price sources | usageRows, status, openProject | loading, empty, ready, error |
| AssetShapeSummary | Read-only dimensions and designer entry | geometryReadModel, openDesigner | as AssetMark |
| NewAssetDialog | Capture a minimal new definition | defaults, createRequested, cancel | draft, saving, error |
| UnsavedChangesDialog | Protect pending navigation | assetName, continueEditing, discardAndContinue | open |
| AssetDeleteFlow | Present the existing safe deletion path | selectedId, usageStatus, delete intent | checking, blocked, confirmable, error |
| PersistentWarning / SaveState | Report persistent problems and accurate save status | operation state, retry | saved, dirty, saving, failed, refresh needed |

## Reuse

The inspected codebase contains `AssetLibraryRoot.vue`, `AssetLibraryBody.vue`, `AssetShelf.vue`, `AssetShelves.vue`, `AssetRow.vue`, `AssetMark.vue`, `AssetInspector.vue`, `AssetInspectorFields.vue`, `AssetInspectorShape.vue`, and `AssetInspectorUsedIn.vue`, plus `AssetLibraryStore`, `AssetSelectionStore`, `NewAssetForm.vue`, and `deleteAssetFlow.ts`.

Consolidate these first. Do not copy React demo code into a second production library. A unified form may compose existing field components, but must not accidentally trigger their commands in addition to its own commit.

## Shared contracts

- One asset ID is the selection source for row, inspector, and writes.
- Presentation components know no concrete repository implementations.
- Inputs are read-only; outputs express user intent. Application use cases coordinate writes and navigation.
- Dialogs use existing DialogHost, focus management, and translation catalogues.
- A category icon in AssetMark is never proof of geometry.
- Derived values are identifiable and lead to their actual source when editing is requested.
- List and error states render with identical inputs under light, dark, and custom themes.

## Theme roles

Use `--background-primary`, `--background-secondary`, `--background-modifier-border`, `--background-modifier-hover`, `--text-normal`, `--text-muted`, `--interactive-accent`, and existing error/focus roles. Never assume a particular accent color. Status words and the selection rule accompany color coding.

## Component verification

Target concurrent selection reads; switching forms during a write; hidden rows in tab order; dialog focus after cancellation; long German labels at 460px; and prices in different currencies. Avoid purely structural tests that duplicate component markup.
