# I15 browser observations — provisional verification record

This is a fresh, connected-harness observation record, not a completed Product Design audit.
The Codex in-app Browser rendered the states below, but its screenshot API supplied only
ephemeral image bytes to the tool response and offered no writable local path. Therefore no
numbered PNG could be saved and then inspected as required by the Product Design audit workflow.
The screenshots below are numbered observation states, not durable screenshot evidence.

## Fresh observation log

| State | Route / interaction | Viewport, appearance, locale | Result |
| --- | --- | --- | --- |
| B01 | `?view=plan-editor&reference&planning&fidelity&theme=light` | default desktop, light, English | Connected planning route loaded its real empty-floor entry and exposed the named perspective radios. The `select=harness-kitchen` variant did not select a room on this reference/planning fixture, as expected from its empty seed. |
| B02 | Add rooms; Tab/type `4`, Tab/type `3` | default desktop, light, English | The Plan room draft kept typed dimensions and enabled Create room. This tests a non-drag creation route, not an arbitrary-existing-corner edit. |
| B03 | Create the typed room | default desktop, light, English | The committed Room 1 remained selected with its calculated 12 m² details. |
| B04 | Select Renovate | default desktop, light, English | Renovate kept the selected room and exposed Existing, Planned and Work routes; geometry-edit affordances were replaced by an explicit Edit geometry in plan route. |
| B05 | Switch harness appearance to dark | default desktop, dark, English | The same Renovate state remained legible with separate mode label/icon and selected radio state. No contrast ratio was measured. |
| B06 | Resize from 900px to 899px | 899 × 800, dark, English | 899px changed from full side panels to Property/Layers/Details rail controls, with the editor canvas and taskbar still present. |
| B07 | Resize to 400px | 400 × 800, dark, English | The constrained layout remained mounted, but the left edge of Select and the right edge of More actions were visibly cropped in the floating taskbar. See finding F-01. |
| B08 | Resize to 399px | 399 × 800, dark, English | The unsupported-width notice replaced editor interaction and offered Focus this tab; this matches `layoutModeFor`'s 400px floor. |
| B09 | `?view=plan-editor&reference&planning&theme=light&lang=de` | 460 × 800, light, German | German Plan/Renovieren/Prüfen labels and the rail appeared. `Grundstück` wraps tightly in the narrow rail; see observation F-02. |

Keyboard observations used the live in-app Browser, not direct store writes: room dimensions were typed after Tab navigation; Home moved Renovate to Plan and kept focus on Plan; End moved Plan to Review; ArrowLeft returned Review to Renovate with the room still present. This does not establish visible-focus conformance, screen-reader support, or arbitrary-corner keyboard editing.

## Findings for owners

1. **F-01 — 400px supported layout visually crops the floating taskbar.** In B07, only the latter portion of Select and the beginning of More actions are visible. This conflicts with the hybrid-screen narrow expectation that task controls remain reachable and with I15's U7/U8 narrow-consistency outcome. Route to **I08**: `src/presentation/editor/shell/FloatingPrimaryActions.vue` and `styles/editor-task-bar.css`. The AX tree still exposed all four controls, so this report does not claim keyboard inaccessibility; it is a visual/pointer-reachability defect requiring an owner fix and fresh capture.
2. **F-02 — German rail label is hard-wrapped at 460px.** In B09, `Grundstück` breaks across the narrow Property rail. The control stays named in the accessibility tree, but the split word is difficult to scan. Route to **I02**: `src/presentation/editor/shell/PanelRail.vue`, `src/presentation/editor/shell/PanelCollapsedStrip.vue`, or `styles/editor-side-panel.css`. This is a low-severity readability observation, not a clipping/accessibility failure.
3. **I18 limitation remains open.** The verified typed dimensions in B02 are a Room-creation route. They do not permit selecting one existing arbitrary Room/Area vertex and modifying only that vertex without dragging. Per I18's receipt, that task is explicitly deferred; I15 cannot report the non-drag/keyboard corner criterion or an AA pass as satisfied.

## Accessibility evidence boundaries

- `tests/harness/accessibility.test.ts` is a semantic axe/jsdom gate. Its own documented ceiling excludes rendered contrast, visible focus and target-size verification.
- No text contrast ratio, non-text indicator ratio, hit-region measurement, host zoom, custom/community theme, native Obsidian, assistive technology, or user study was performed.
- The live Browser snapshots were visually stable when captured, but their images are not local artifacts; they cannot satisfy the required numbered saved-and-inspected screenshot evidence.
