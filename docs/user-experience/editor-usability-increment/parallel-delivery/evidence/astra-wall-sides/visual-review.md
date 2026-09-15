# Visual review — independent wall faces

Two batched rounds, 2026-09-14. Production Vue components, production assembled styles and the bundled Obsidian stylesheet were exercised through visible browser controls with synthetic data. No hidden application-state API was used to create or edit the examples.

## First round

Desktop English/light: create a connected horizontal/downward corner, preview different A/B depths, apply, open compact context entry and the full Details form. Narrow English/light: horizontal wall in a 400×800 editor pane. Narrow German/dark: upward-directed wall in a 460×800 pane. Exercise independent numeric entry, a selected-face button step and invalid input.

Findings addressed together:

1. Compact entry put its title below the fields. Move the title and reference-direction explanation before the inputs.
2. The existing full Details dialog used 30 px native controls. Give this wall form 44 px controls and explicit visible keyboard focus.
3. Native light-theme error text measured 4.20:1. Mix the semantic error and normal-text tokens to retain error color while improving contrast in both themes.

## Final confirmation

The harness's plain stylesheet link did not hot-reload the assembled CSS, although the Vue template had updated. Reloaded the pages, confirmed the new CSS rules in the CSSOM, and recreated the synthetic walls through the visible creation forms. This was stale-preview recovery within the final confirmation, not another styling round.

- Full Details inputs, preview button and Cancel: **44 px high**.
- Narrow canvas widths: **320 px** inside the English pane and **380 px** inside the German pane. All side inputs and action buttons: **44 px high**; all side step buttons: **44×44 px**.
- Both valid narrow layouts retain **16 px** between the summary panel and primary taskbar. No horizontal document overflow.
- A/B groups remain separate, with tethers when clamped. The upward-directed German wall correctly puts A on screen-left; the downward-directed desktop wall puts A on screen-right.
- Invalid input disables Apply and both side steppers, shows localized recovery copy and retains reachable Cancel. Measured error contrast: **5.22:1 light**, **5.38:1 dark**.
- Compact entry places its heading and direction text first. Full Details shows A, B and their total. Applying the preview updates the Inspector's saved values.

Exact DOM measurements are in [browser-metrics.json](browser-metrics.json); first-round measurements are retained separately. Captures 06–10 are final. Browser screenshot export with `fullPage` scaled the content into a padded image on this host, so the durable narrow captures use the regular viewport screenshot method; the iframe pane dimensions are verified by DOM measurements. The wrapper scroll position crops some outer header content without cropping the wall controls or taskbar.

The temporary browser tabs and preview server were closed before coverage work. Native Obsidian/Windows interaction was not available through the enabled native computer APIs; these captures establish browser-harness behavior, not a native-vault smoke test.

Subsequent verification cleanup moved conditional bindings into computed values, grouped identical heading conditions, extracted the existing face-cue nodes into a component, and separated the same card-spacing arithmetic into a helper. It changed no displayed text, style values, node order, control dimensions or layout rules. Geometry/layout and lifecycle tests cover those extractions; no third visual-polish round was performed.

Later integration regressions corrected opening masks and frame strokes on a symmetric T-stem within an asymmetric network, and total resizing when restoring a planned wall. Those corner cases are covered by automated geometry/runtime tests; the screenshots do not claim a separate visual confirmation of them. The single detector result predates those functional corrections and was not rerun.
