---
type: PBI
parent: "[[Release hardening]]"
order: 30
status: New
horizon: "MVP"
release: "[[MVP]]"
dependsOn:
  - "[[Recover safely from failed writes and stale reads]]"
  - "[[Accessibility]]"
---

# Use the editor in Obsidian themes and constrained layouts

## Actor

The Obsidian user who changes theme, accent, or leaf arrangement while planning.

## Main flow

1. The first room slice is opened in default light, default dark, and a representative custom
   theme and accent.
2. The editor consumes Obsidian semantic variables for DOM and canvas roles.
3. The leaf is resized from full to constrained and back.
4. Panels move into accessible rails or drawers without forking their content.
5. Selection, viewport, and valid domain state remain unchanged.
6. The same checks extend to each applicable M00–M17 state before release.

## Extensions

- **3a** — The leaf is below the supported editing width. The editor offers `Focus this tab` and
  a non-canvas summary instead of broken controls or horizontal scrolling.
- **4a** — A control moves out of the full layout. An equivalent labelled location remains.
- **6a** — A state is not implemented in the release. It is recorded as not applicable, never
  counted as passing evidence.

## Guarantee

Theme and layout changes alter presentation only. They do not reset selection, viewport, drafts
that are safe to retain, or persisted renovation data, and no meaning depends on a fixed color.

## Acceptance criteria

1. The first room slice passes light, dark, custom-theme/accent, full, and constrained checks.
2. Components use Obsidian semantic variables only; no product palette is required.
3. Selection, focus context, and viewport survive supported layout and theme transitions.
4. No horizontal scrollbar appears at supported constrained widths.
5. Unsupported widths retain a non-canvas route and a clear focus action.
6. Every applicable M00–M17 state has explicit theme/layout evidence or a recorded defect.

## Assumptions

- VS-11 is proved first against VS-01–VS-10, then becomes the matrix applied to later screens.
- Constrained means a desktop Obsidian leaf, not a mobile editor promise.
- Visual acceptance requires a real rendering engine and representative community themes.

## Sources

[M16 — Constrained Workspace](../user-experience/renovation-planner-editor-specs/screens/M16-constrained-workspace.md);
VS-11 and Scenario E in the
[editor vertical-slice plan](../user-experience/renovation-planner-editor-specs/Renovation%20Planner%20—%20First%20Vertical%20Slice%20Plan%20and%20Data-Model%20Specification.md);
the theme contract in the
[specification set](../user-experience/renovation-planner-editor-specs/README.md) and
[component library](../user-experience/renovation-planner-editor-specs/components/component-library.md).
