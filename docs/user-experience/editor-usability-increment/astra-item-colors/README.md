# Item colors — implementation receipt

Status: verification in progress. Branch: `codex/usability-astra-item-colors`.
Initial base: `836399775e91ccf05e44959b6bea9960605defbb` (#209).
Stack base: `20f2b699a6db52ffd2ef1309ce5116f551a3ad75`, wall-face PR #213.
The wall branch was merged normally in `e396eeb72`; current main `9ef607030` was merged
in `bf8d301e8`. Neither lower branch was rewritten. Schema 13 remains the wall-face format;
colors now require schema 14 so a wall-capable older build refuses colored content.

## User direction for resumed work

The user likes task-specific button overlays on selected items together with a compact
overlay/right-click menu. Keep the compact contextual color palette and complete Inspector
parity. Generic **Add detail** remains removed. A selected-item palette overlay is optional
and should be considered only as a direct, accessibly named color control that stays
uncluttered, never as a generic disclosure. This decision records a preference; it does not
authorize restarting verification while the wall task holds the memory lease.
The coordinator released the exclusive verification lease on 2026-09-15. A third, always-visible
selected-item overlay is not added: the compact contextual palette supplies the direct action
while the Inspector provides persistent discoverability without crowding selection handles.

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
selection outlines and handles remain separate. Schema 14 stores overrides; absent color
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
5. **Final EN/light Item:** [Default](final-01-en-light-default.png),
   [Blue in Details](final-02-en-light-blue-inspector.png),
   [menu keyboard focus](final-03-en-light-blue-menu-focus.png). Healthy: fill, name,
   pressed/checked state and focus ring agree; the registered check icon renders correctly.
6. **Final EN/dark asset:** [Default](final-04-en-dark-asset-default.png),
   [Violet](final-05-en-dark-asset-violet.png). Healthy: outline, label, facing mark and
   geometry stay intact while the placement fill changes.
7. **Final DE/dark, 460 px:** [default canvas](final-06-de-dark-460-default.png),
   [Green in Details](final-07-de-dark-460-green-inspector.png),
   [compact menu](final-08-de-dark-460-green-menu.png). Healthy: every color target is
   44×44 px, German names fit, and the palette wraps inside the menu without horizontal overflow.
8. **Final DE/light, 400 px:** [Default](final-09-de-light-400-default.png),
   [Amber in Details](final-10-de-light-400-amber-inspector.png),
   [actual pointer right-click](final-11-de-light-400-amber-rightclick.png). Healthy:
   44×44 px controls wrap in Details and the menu; no horizontal overflow. Default then
   restored the original fill, Undo restored Amber, and both non-Plan modes hid the palette.

This completes two bounded visual rounds. [Browser measurements](browser-metrics.json)
record sizes, checked state and mode/reset/undo smoke results; console errors were empty.
The browser's synthetic fixture reload resets its in-memory vault, so persistence across
fresh reads is tested through the repository stack rather than claimed from a browser reload.
One empty browser document recovered on reload; an early narrow drawer capture became a
canvas capture during asynchronous fixture settling and is labelled as such above.

## Checks

- `git diff --check`: passed during source review.
- The first `npx vue-tsc --noEmit` was stopped during shared-machine paging; the resumed
  type-check completed with exit 0.
- `npx vitest run tests/presentation/editor/itemColors.test.ts --maxWorkers=1`: failed to
  start the forks worker (`Timeout waiting for worker to respond`); **no tests ran**.
- The subsequent one-worker threads retry was stopped at the coordinator's request before
  a result; neither stopped attempt is counted as passing verification.
- Resumed focused suite: **5 files / 58 tests passed**, including domain/DTO, command/history,
  reset/no-op, stale/refused/busy, retained callbacks, group-member editing, keyboard/axe roles,
  asset placement, promotion, clipboard and the schema-14 color + schema-13 asymmetric-wall seam.
- Final focused coverage after the swatch extraction: **2 files / 21 tests passed**, with
  **100% statements (54/54), branches (55/55), functions (16/16), lines (35/35)** across the
  four new color modules. This is explicitly a focused denominator, not full-project coverage.
  The first diagnostic had 58 passing tests but missed the global floors on its restricted
  denominator (98.18% statements, 96.49% branches); its keyboard assertion and unreachable
  mounted-element fallback were addressed without lowering a threshold.
- Targeted ESLint and oxlint: exit 0. Static structural complexity: zero findings after
  extracting the swatch component; coverage-weighted whole-project health belongs to the full gate.
- Impeccable context ran once. The one final [detector run](impeccable.json) returned `[]`, exit 0.
- First full one-worker `npm run check`, on clean commit `26348d9d33714640310a3cfc5ba15348f0f20c40`:
  build/lint passed; 986 files passed and 2 failed; **10,798 tests passed, 2 failed, 1 skipped**.
  All global floors passed: statements **99.24% (27818/28029)**, branches **98.07% (20484/20885)**,
  functions **99.28% (8090/8148)**, lines **99.68% (20418/20483)**. This was a failed gate.
  The wall compatibility fixture defined a schema-12 reader by dropping the last migration,
  which now produced a schema-13 reader. It is pinned to `toVersion <= 12`, retaining the
  exact old-reader refusal assertion. The stylesheet check caught undeclared `--opacity-50`;
  disabled swatches now read the palette's declared `--rp-item-color-disabled-opacity`
  token (default `0.5`), following the existing component-owned token pattern.
  These are compatibility-fixture and disabled-state corrections, with no third visual
  polish round or second detector run. Enabled-state captures remain representative.
- Correction preflight on the final declared-token form: **4 files / 94 tests passed**
  (wall persistence, stylesheet variables, color domain/DTO and editor integration).
  Fallow on the complete first-run coverage report returned **0 issues, 0 above threshold**,
  7516 analyzed units and maintainability index 86.7.
- Definitive one-worker `npm run check`: pending on the corrected clean committed tree.

## Integration seams

- `CanvasContextMenu.vue`: inject the root palette via the new `appearance` slot.
- `CanvasMenuList.vue`: slot plus keyboard traversal for `menuitemradio` swatches.
- `ElementInspector.vue`: shared palette after the existing summary.
- `elementActions.ts`: `setColor` reuses guarded rewrite/history and selection epoch.
- `sameGeometryDocument.ts`: include color in current/intended content equality so history
  cannot overwrite a peer's sidecar-only color change.
- `ElementShapes.vue`, `assetShapeConfig.ts`: content fill only.
- `itemPromotion.ts`: carry placement color through promotion and protect against concurrent change.
- `SpatialElement.ts`, sidecar DTO/migrations and `PlanGeometryStore.ts`: schema 14.
- `styles/index.css`, EN/DE feature dictionaries/root imports, `themeTokens.ts` documentation.

`useCanvasMenuActions.ts` and wall-specific actions are untouched. The wall task should
remain the base of the color PR. Both wall-side fields and controls are preserved through the
normal merge. The combined full gate and all PR CI are required before handoff. Main and all
lower branches remain untouched.

## Remaining limits

Custom host colors that Konva cannot parse keep their native canvas fill; the stored name
remains inspectable. Current appearance does not rewrite independently proposed intended
geometry. Native Obsidian acceptance is not claimed; browser and repository-stack evidence
are recorded separately. The inherited Konva seven-layer warning remains unchanged.
The existing multi-document conditional-compensation limits remain those of RenovationCommand;
this feature adds no crash-recovery promise.
