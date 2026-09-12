# Plan editor side panels — resizable, collapsible, redesigned

Date: 2026-09-12 · Branch `claude/plan-editor-improvements-80c30e`.

## Why this exists

The Plan editor's two side panels — Property and layers on the left, the Inspector on the right —
have fixed widths, cannot be put away, and have drifted from M00, the editor package's locked
reference screen (`docs/user-experience/renovation-planner-editor-specs/screens/M00-kitchen-selected-overview.md`).
Captures at 1280px show the drift: section headers are small muted labels with oversized CSS
chevrons, "Reference options" uses a native triangle, the room actions are a wrapping jumble of
bordered buttons ("90° right" breaks onto two lines), the lock sits alone, Assign asset is an
unlabelled empty select, seven "Not available yet" rows fill half the panel, and neither panel has
a header. Much of it is cascade: panel rules are declared in `editor.css`, overridden in
`editor-visual-shell.css`, and overridden again in `editor-shell-fidelity.css`.

This builds on `2026-09-10-plan-editor-sidebar-polish-design.md` and contradicts none of it: the
four sidebar sections, their order and defaults, the flat layer list and the property tree stay.

Decisions taken with the user, in order:

1. Scope is the panel chrome AND the content inside both panels.
2. Widths and collapsed state are remembered PER DEVICE, shared by every Plan editor, through
   `App.loadLocalStorage`/`saveLocalStorage` — the surface `ContinueContextStore` already uses.
3. A collapsed panel is a slim icon strip, not hidden outright.
4. The Inspector's seven unavailable rows become one "Coming later" line.

Approaches weighed: extending `ResponsiveEditorShell` (taken); moving the panels into Obsidian's own
sidebars (refused — each editor leaf's panels would become separate workspace views competing for
one sidebar, and M16's constrained layout breaks); CSS `resize` plus `<details>` (refused — a
corner-only grip with no keyboard route fails WCAG 2.2 AA, cannot sit on the left panel's inner
edge, and cannot be remembered).

## 1. Resize and collapse mechanics

**Applies in the `full` layout only.** `constrained` (M16's rail, overlay and drawer) and
`unsupported` keep their behaviour; the rail only takes the new visual styling (section 2).

**Frame.** `OverlayPanel.vue` and `InspectorDrawer.vue` are the same component twice; they merge
into one `EditorSidePanel.vue` with a `side: 'layers' | 'inspector'` prop. In `full` it draws a
header, the panel content, and a resize handle on the inner edge — or, collapsed, the strip. In
`constrained` it keeps today's floating/persistent behaviour, close button and focus handling
unchanged. `data-rp-shell-region`, the Escape handling and `ResponsiveEditorShell`'s focus
restoration keep their current selectors.

**Resize handle** (`PanelResizer.vue`) — the WAI-ARIA window splitter pattern:

- `role="separator"`, `aria-orientation="vertical"`, `aria-controls` naming the panel,
  `aria-valuenow`/`aria-valuemin`/`aria-valuemax` in px, an accessible name per side, `tabindex="0"`.
- Pointer: press captures the pointer; moves update the width live; release commits.
- Keys: ArrowLeft/ArrowRight ±16px (direction mirrored for the right panel so the arrow moves the
  edge the way it points), Shift+Arrow ±64px, Home/End to min/max, Enter toggles collapse.
- Double-click resets to the default width.
- Hit area 6px wide straddling the border.

| Panel | Min | Default | Max |
|---|---|---|---|
| Property and layers | 200px | 256px | 400px |
| Inspector | 280px | 352px | 520px |

**Canvas floor.** The canvas keeps at least 320px. The shell already measures its width; a pure
function turns (shell width, stored layout) into the EFFECTIVE widths, shrinking the panels
proportionally when the two stored widths plus the floor do not fit. The stored preference is never
rewritten by a narrow leaf — widen the leaf and the remembered widths return. Below 900px the
`constrained` layout takes over, as today. Effective widths reach CSS as `--rp-layers-width` and
`--rp-inspector-width` on `.rp-editor-body`, bound the way `TemporaryToolBanner` binds
`--rp-taskbar-clearance`.

**Collapse.** The header's collapse button is a `<button>` with `aria-expanded` and
`aria-controls`. Collapsed, the panel is a 40px strip:

- top: an expand button (`chevron-right` on the left strip, `chevron-left` on the right);
- left strip: one button per section — Property `house`, Layers `layers`, Rooms and areas
  `grid-2x2`, Walls and openings `brick-wall` — each expanding the panel, opening that
  `<details>` and scrolling it into view;
- right strip: one Details button (`panels-top-left`);
- every strip button carries an accessible name and a tooltip.

Collapsing while focus is inside the panel moves focus to the strip's expand button; expanding
from the strip moves focus to the panel's collapse button (or the opened section's summary).

**State and persistence.**

- `WorkspaceStore` gains `panelLayout: { layers: { width, collapsed }, inspector: { width, collapsed } }`
  beside `layoutMode`/`overlay`, so a settings-save remount of one leaf keeps it. `reset()` restores
  defaults.
- A pure `src/presentation/editor/shell/panelLayout.ts` owns the defaults, the bounds, `parsePanelLayout(unknown)`
  (anything malformed or out of range falls back per field to the default — `loadLocalStorage` reads
  a value the user can edit, so it is a trust boundary), and the effective-width function.
- `src/infrastructure/obsidian/plugin-data/` gains a small per-device JSON store over
  `loadLocalStorage`/`saveLocalStorage` that answers `unknown` and swallows-and-warns on a fault,
  the same shape as `ContinueContextStore`; parsing stays in presentation, so infrastructure never
  imports a presentation type. Key: `${manifest.id}:panel-layout`.
- The plugin wires `read`/`write` through `PlanEditorContext`. Each leaf reads on mount; a write
  happens on pointer release, on a key press, on collapse/expand — never per pointer move.
- Two open editors do not live-sync; the next one to mount reads the latest write.

**Skipped:** palette commands to toggle either panel. Add when someone wants a hotkey.

## 2. Panel chrome and visual language

M00 is the reference. Obsidian variables only (SDD §84's build check refuses anything else).

**Frame**

- Panel header: sticky, 40px, title in `--font-ui-small` semibold `--text-normal`, 28px icon-only
  collapse button. Titles: "Property and layers" (`editor.property-panel`) and "Details"
  (`editor.rail.details`).
- Surface: `--background-primary`, as M00 draws it; a 1px `--background-modifier-border` against
  the canvas. The collapsed strip and the `constrained` rail use the same surface, icons and button
  shape, so they are one component visually.
- Resize handle: invisible at rest beyond the border; hover, focus and drag draw a 2px
  `--interactive-accent` line with a `col-resize` cursor.

**Shared patterns**

- *Section header* — the `<details>` summary: 32px, sentence case, `--font-ui-small` semibold,
  `--text-normal`, a 16px `chevron-down` `HostIcon` rotating on open. Replaces the CSS-border
  chevron and the native triangle.
- *List row* — min 32px: 16px icon, label, muted tabular figure, trailing action. Hover
  `--background-modifier-hover`; selected `--background-modifier-active-hover` plus a 2px leading
  accent rule, with `aria-pressed`/`aria-current` kept, so selection is never colour alone.
- *Card* — 1px border, `--radius-m`, no fill, for grouped facts.
- *Action row* — icon, label, chevron at 32px, stacked (M00's "What's here" rows).

**Spacing and type.** 12px horizontal panel padding, 8px between sections, Obsidian's
`--size-4-*` and `--font-ui-*` tokens rather than `editor-visual-shell.css`'s hard pixels, tabular
figures for numbers.

**States.** The existing 2px `--interactive-accent` focus ring (its contrast is recorded in
`editor-shell.css`). Chevron rotation 120ms, none under `prefers-reduced-motion`. Width changes are
not animated, so the Konva stage resizes once rather than per frame.

**CSS housekeeping.** New `styles/editor-side-panel.css` (frame, header, handle, strip, rail,
section header, row, card, action row); a second partial if it would pass the 400-line cap. The
panel rules it supersedes are DELETED from `editor.css`, `editor-layout.css`,
`editor-visual-shell.css`, `editor-shell-fidelity.css` and `editor-inspector.css`, not overridden a
fourth time. Every button rule keeps the two-class `(0,2,0)` compound `buttonSpecificity.test.ts`
checks, and its explicit `:focus-visible` ring `buttonFocusRing.test.ts` checks.

## 3. Panel content

Invariant across this section: `data-rp-action` hooks (focus restoration reads them), `aria-disabled`
and `aria-describedby` paused attributes, heading levels (frame `h2`, entity `h3`, sub-sections
`h4`), element ids and every command path are unchanged. This is markup and CSS, not behaviour.

### Property and layers

- The four `<details class="rp-sidebar-section">` render through one `PanelSection.vue`, keeping the
  class names, order and open defaults `sidebarSections.test.ts` pins, and exposing an id the strip
  targets.
- Property tree: list rows, indent guide, the current plan with the accent rule and
  `aria-current="page"`.
- Layers: eye / eye-off icon, label, trailing opacity; the native checkbox stays the control. The
  no-reference row puts its reason on one muted line under the label with Set scale as a small
  inline text action. Reference options is a nested `PanelSection` one step quieter. The change
  legend is a card.
- Rooms and areas: list rows; the lock icon always shows when locked, and when unlocked only on row
  hover or `:focus-within`. The multi-selection checkbox and hint become a compact footer inside the
  section.
- Walls and openings: list rows with the indent guide.

### Inspector — one skeleton for every selection state

1. **Identity** — name as `h3`; a muted subline such as "Room · 12.6 m² · ● Planned" (status as dot
   plus word).
2. **Facts card** — the existing `dl`, labels left, values right.
3. **Actions** — a toolbar row: ↺ and ↻ icon-only (their `aria-label`s exist; the quarter-turn
   labels move to tooltips), Rotate by…, then the lock toggle; below it stacked action rows (Rename
   room, Change room size, Edit outline coordinates, curve and renovation entries).
4. **Feature sections** as `PanelSection`s. Requirements' Assign asset: label above, full-width
   select with a "Choose an asset" placeholder option, Assign beside it; with no asset options the
   select and button are `aria-disabled` with a muted reason.
5. **Coming later** — one muted line built from `overview.unavailableSections`, labels joined with
   `Intl.ListFormat` in Obsidian's language: "Coming later: what's here, costs, documents, photos,
   notes". It replaces `HomeownerQuestionNav` and `LinkedContentList`'s unavailable rows; a section
   that becomes available still renders as a real row.
6. **Delete** — at the foot, above a border: a row with a `trash` icon in `--text-error`, a
   `--text-normal` label and the error-tint hover the stylesheet already argues for.

| State | Skeleton |
|---|---|
| Room | all six |
| Wall / opening | identity, facts, Edit and Move rows; "More" becomes a `PanelSection` (rotation, curve, renovation entry); Delete at the foot |
| Element | identity with the stair, length or area as its subline; actions; Delete at the foot |
| Floor (nothing selected) | identity; Upload a floor plan as the one accent-outline action; stats card; planning summary card; room and area lists as list rows |
| Multiple selection | "N selected" identity with Clear beside it; facts card; muted hints; batch actions as rows; members as list rows |

**Inherits the patterns without restructuring:** the task forms (`NewRoomInspector`, structure,
element, curve and asset-placement forms), `RenovationInspector` (Renovate and Review) and
`RequirementRow`'s internals. Restructuring them is a separate follow-up.

**New components:** `EditorSidePanel`, `PanelResizer`, `PanelCollapsedStrip`, `PanelSection`.
Everything else is classes on existing markup.

**New strings (en and de, sentence case):** collapse and expand labels per panel, resize handle
names per panel, strip button names, "Choose an asset", "No assets in the library yet",
"Coming later: {sections}".

## 4. Testing

**Node (pure)**

- `panelLayout.ts`: defaults; `parsePanelLayout` on `null`, wrong types, NaN, out-of-range and
  partial objects, per field; clamping at both bounds; effective widths at a wide shell (stored
  widths kept), at the floor boundary, and below it (proportional shrink, canvas exactly 320px,
  stored layout untouched).
- The infrastructure store over a fake adapter, as `continueContextStore.test.ts` does: round trip,
  a throwing `loadLocalStorage` answers `null` and warns, a throwing save warns and does not throw.

**jsdom (real mounted editor, `mountPlanEditor`)**

- Collapse: header button flips `aria-expanded`, the panel content leaves the tab order, the strip
  appears; focus inside moves to the expand button; expand restores focus.
- Strip: a section button expands the panel and opens exactly that `<details>`.
- Resizer: arrows, Shift+arrows, Home/End and Enter on each side, with `aria-valuenow` following;
  pointer press, moves and release write the store ONCE, on release; double-click resets.
- Persistence: a second mounted editor reads the first one's write; a malformed stored value mounts
  at defaults.
- `constrained` untouched: the existing `responsiveShell`, `persistentRegions` and
  `repeatedRailActivation` suites pass unchanged, plus one case that a collapsed full-mode panel
  still opens as an overlay from the rail after shrinking.
- Content: `roomInspector`, `floorInspector`, `multiSelectionInspector`, structure and element
  suites updated for the skeleton; the Coming later line in en and de; the assign placeholder and
  the no-assets disabled state; `sidebarSections` and `shellFidelity` pass unchanged.

**Build and accessibility**

- `buttonSpecificity` and `buttonFocusRing` reach every new button rule.
- axe: the plan editor scanned with both panels collapsed and with a resize handle focused, in a
  new `tests/harness/accessibilitySidePanels.test.ts` sharing `./axeOptions`.
- Harness: a `?panels=collapsed` knob (both collapsed) and `?panels=left`/`?panels=right`. New
  `harness-shot` entries — both collapsed in light and dark, a selected room in dark at 1280, the
  full layout at 900 (the canvas-floor edge), and the German constrained rail at 460 — added to the
  table `harness-shot.test.ts` pins in both directions. Every capture is read before and after.
- Manual: `docs/tests/cases/Resize and collapse side panels.md` — drag in a real vault, restart and
  see the layout return, two split editor leaves. Its Runs table starts empty; an unrun case is not
  a finding.

**Gates.** `npm run check:fast` between edits; `npm run check` once, before the commit.

## Records

- Component library §8: `EditorSidePanel` replaces the overlay and drawer entries;
  `HomeownerQuestionNav`/`LinkedContentList` gain a dated amendment for the Coming later line.
- M16: a dated note that the rail shares the collapsed strip's styling and that full-mode panels
  resize and collapse.
- Increment-history entry for this pass.
- CLAUDE.md is not edited: no view type, command, setting or gate changes.
