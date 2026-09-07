# Persistent shell regions — 2026-09-07

Intermediate shell checkpoint based on the pushed generic-element foundation `a0e91241`.
Each Layers/Inspector slot now has one mounted outlet. Full columns use `display: contents`
wrappers; constrained regions use the same wrappers as modeless overlays. Closed regions
use `display: none`, so their controls leave display and keyboard traversal while retaining
component and native DOM state. The canvas still unmounts below 400 CSS pixels.

When shrinking below 900 CSS pixels, the region holding focus opens before visibility changes.
The same native input, unfinished value and caret selection survive shrink/growth; resize does
not generate a blur that commits the edit. A normal resize does not take focus from the canvas.
Rail and Close/Escape retain one-overlay behavior and synchronous focus return. Only disappearing
chrome needs a fallback: its corresponding region on growth, or the unsupported-width action
when the canvas becomes unavailable. Queued handoffs cannot override newer focus or run after disposal.

This checkpoint is deliberately scoped to targeted verification per the integration task's instruction; the
combined `npm run check`, unchanged coverage floors and live-host acceptance remain integration
requirements. This document does not claim complete M00–M17 acceptance.

## Observed verification

- `npm ci --no-audit --no-fund`: passed in the isolated worktree.
- The 12 new regression cases against the original three shell components: 7 failed, 5 passed,
  plus one queued-resize disposal exception. After the fix, all 12 passed (final run 43.47 s).
- The seven-file focused run passed 125/126 tests; the remaining test attempted to focus a
  disabled Layers checkbox. Its selector now chooses an enabled control, and the complete
  12-case regression file passed again. The other six files passed all 114 tests:
  `responsiveShell`, `newRoomInspector`, `multiSelectionInspector`, `harnessSurfaces`,
  `accessibility`, and `accessibilityTrustPath`.
- `npm run build` (including `vue-tsc -noEmit`) and `npm run lint`: passed. A conditional
  assertion in the new test was rejected by oxlint, replaced with an unconditional assertion,
  and lint passed on rerun.
- `node scripts/editor-shell-check.mjs`: four scenarios passed using explicitly selected
  Edge **152.0.4191.62**, not Playwright's pinned Chromium: light, dark, custom accent, German.
  Each changes width through 460 → 1440 → 720 → 1000 → 460 CSS pixels. Native input identity,
  pending `-`, selection `[0,1]`, focus, region opening, rail return and canvas focus all passed;
  no page errors. The full canvas remained 835.2 px wide at a 1440 px viewport.
- Follow-up layout measurements found both drawer and inner Inspector at `clientWidth =
  scrollWidth = 367`, `scrollLeft = 0` in all four scenarios. The first German screenshot
  suggested transient clipping; the measured, settled capture shows complete headings and
  controls. Four final representative captures were visually inspected and are committed
  with the [machine-readable report](evidence/persistent-shell/report.json).
- `npm run analyze` could not run because this fresh worktree has no
  `coverage/coverage-final.json`. No coverage file was fabricated or copied from a different
  revision; combined coverage and Fallow are explicitly still required.

Browser evidence uses the existing production editor harness and ephemeral repositories.
It covers CSS viewport reflow, not live Obsidian panes, physical devices, native browser zoom
or screen-reader acceptance. The harness theme badge remains in the screenshots.
