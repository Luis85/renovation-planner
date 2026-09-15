# Item colors — implementation receipt

Status: implementation and source review complete; verification lease paused for the parallel
wall task. This is not a completed acceptance claim. Branch: `codex/usability-astra-item-colors`.
Base: `836399775e91ccf05e44959b6bea9960605defbb` (#209). No PR is opened by this task.

## User direction for resumed work

The user likes task-specific button overlays on selected items together with a compact
overlay/right-click menu. Keep the compact contextual color palette and complete Inspector
parity. Generic **Add detail** remains removed. A selected-item palette overlay is optional
and should be considered only as a direct, accessibly named color control that stays
uncluttered, never as a generic disclosure. This decision records a preference; it does not
authorize restarting verification while the wall task holds the memory lease.

## Scope and semantics

Only plain Items (`object`) and placed assets (`asset`) are eligible. All structural/drafting
kinds, Rooms/Areas, Walls/Openings and reference plans are excluded. One selected element
at a time; groups/multiple selections must use the existing Details member focus and
**Select focused item** route. No partial group writes or mixed-value claim.

See [the domain/DTO contract](../../../development/item-colors.md) and
[English/German help](../../../using-item-colors.md) for durable ids, eligibility, rendering,
backward compatibility and keyboard behavior. The source inventory found no existing
placement color field. Asset designer solid/dashed details and `PlanPattern` wall-material
hatches are distinct semantics, preserved. Colors are placement content, not plugin chrome.

| Id | English | German | Content RGB |
| --- | --- | --- | --- |
| absent | Default | Standard | host canvas background |
| slate | Slate | Schiefergrau | `#778899` |
| rose | Rose | Rosé | `#ce6682` |
| amber | Amber | Bernstein | `#d69b32` |
| green | Green | Grün | `#54976d` |
| blue | Blue | Blau | `#518cce` |
| violet | Violet | Violett | `#956bc4` |

Canvas fill uses 28% content RGB and 72% resolved host background. Host-token ink, labels,
selection outlines and handles remain separate. Schema 13 stores overrides; absent color
migrates without inventing one. Reset removes the field. Clipboard and promotion preserve it.
Both UI doors call `elementActions.setColor` and the existing reversible conditional command.
No selected-item Add detail popup was added or used.

## Current-run evidence

The user-supplied reference was inspected before design work. The inherited Obsidian-native
direction (1+3) was preserved. The browser used the real harness with synthetic Cabinet and
Garden shed fixtures; these are not real project data.

1. **Before, dark Inspector:** [capture](before-dark-inspector.png). Item name, dimensions,
   geometry controls and Delete were reachable; there was no appearance action.
2. **Before, dark menu:** [capture](before-dark-menu.png). Existing native-styled menu and
   target guidance established the visual/interaction baseline.
3. **First pass, Blue via Inspector:** [capture](after-dark-blue-inspector.png). The saved
   tint, textual color name and pressed swatch agreed. This interim capture exposed a
   harness fallback for `check`; it was changed to the already-supported `circle-check` icon.
4. **First pass, menu parity:** [capture](after-dark-blue-menu.png). Menu checked state matched
   the Inspector. Home → Right → Enter applied Slate and closed the menu, restoring focus.
5. **Final batch:** pending lease release. German, light, narrow and final-icon captures
   remain required. No more than one additional visual polish/verification round remains.

## Checks

- `git diff --check`: passed during source review.
- `npx vue-tsc --noEmit`: stopped during severe shared-machine paging; no result claimed.
- `npx vitest run tests/presentation/editor/itemColors.test.ts --maxWorkers=1`: failed to
  start the forks worker (`Timeout waiting for worker to respond`); **no tests ran**.
- The subsequent one-worker threads retry was stopped at the coordinator's request before
  a result. No broad test coverage or `npm run check` was started.
- Focused tests authored for domain/DTO, command/history, reset/no-op, stale/refused/busy,
  retained callbacks, groups, Inspector/menu keyboard/axe roles, asset placement and clipboard.
- Impeccable context ran once. The required final detector run remains pending.

## Integration seams

- `CanvasContextMenu.vue`: inject the root palette via the new `appearance` slot.
- `CanvasMenuList.vue`: slot plus keyboard traversal for `menuitemradio` swatches.
- `ElementInspector.vue`: shared palette after the existing summary.
- `elementActions.ts`: `setColor` reuses guarded rewrite/history and selection epoch.
- `sameGeometryDocument.ts`: include color in current/intended content equality so history
  cannot overwrite a peer's sidecar-only color change.
- `ElementShapes.vue`, `assetShapeConfig.ts`: content fill only.
- `itemPromotion.ts`: carry placement color through promotion and protect against concurrent change.
- `SpatialElement.ts`, sidecar DTO/migrations and `PlanGeometryStore.ts`: schema 13.
- `styles/index.css`, EN/DE root locale tables, `themeTokens.ts` documentation.

`useCanvasMenuActions.ts` and wall-specific actions are untouched. The wall task should
merge into this branch after its green/pushed handoff. Resolve shared menu/style/localization
seams by preserving both features, then run the combined full gate before opening the next
strict stacked PR. Main and all lower branches remain untouched.

## Remaining limits

Custom host colors that Konva cannot parse keep their native canvas fill; the stored name
remains inspectable. Current appearance does not rewrite independently proposed intended
geometry. Native Obsidian acceptance and final responsive screenshots are not yet claimed.
The existing multi-document conditional-compensation limits remain those of RenovationCommand;
this feature adds no crash-recovery promise.
