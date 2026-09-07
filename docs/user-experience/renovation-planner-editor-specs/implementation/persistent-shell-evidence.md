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

## Modal focus follow-up

The combined branch at `88b9ee3d` exposed a real gap in the old opener-disconnection guard:
Room naming, dimensions, outline editing and Area details retain their opener on reflow,
but the persistent Inspector can be hidden when a root-owned modal closes. All four actions
now use a shared recovery helper. A visible connected opener keeps normal dialog restoration;
a hidden opener returns to the visible Details rail, or the unsupported-width action below
the supported size. A removed opener uses a replacement action or the current Inspector.
Disposed leaves do not take focus.

A duplicates-only scan still identified the common opener-capture/invocation prefix in two
actions after sharing only focus restoration. All four now call the same complete asynchronous
runner, which captures `event.currentTarget` before awaiting and restores focus after Vue's
visibility patch. A real-click regression verifies that capture and delayed restoration.
After this consolidation, the five focused files passed **21/21 tests** (47.57 s, two workers),
and vue-tsc, whole-project oxlint and ESLint over the six subsequently changed files passed.
The duplicates-only scan no longer reports either action: this parent revision still has six
other clone groups, separately owned by finalization. No suppression was added.

The four integration files reproduced **5 failures and 9 passes** before this fix, including
both cancellation and outline saving. Updated tests require the same native draft/opener,
retained text and field focus through reflow, and the exact visible return destination.
Six focused helper cases additionally cover unsupported width, removed actions and disposal.
After the fix all five focused files passed **20/20 tests** (21.17 s, two workers).
`npx vue-tsc -noEmit`, whole-project oxlint and ESLint over all ten changed source/test
files passed. The three browser scripts passed `node --check`.
The existing Room naming and resizing browser journeys now verify actual visible focus,
and the resizing journey includes outline and Area details dialogs in the same theme matrix.
Both final browser matrices passed **four scenarios each** on Edge **152.0.4191.62**, with
no page errors: light, dark, custom accent and German constrained. The existing journey's
post-Undo/Redo setup now explicitly reselects its Room through Layers instead of assuming
the Floor Inspector is still a Room. All reflow checks retain the same native opener/input,
draft value and field focus, then require exact focus on a visible return control.
The four final focus-return captures and representative German naming dialog were visually
inspected. Reports and selected images are saved under [modal focus evidence](evidence/modal-focus/room-resize-report.json).
The three non-German final captures are narrowed to 460 px with focus on Details; the German
capture has widened to 1280 px with focus on Area details. The harness badge still overlaps
part of the footer. This is CSS viewport/browser evidence, not native zoom or live Obsidian.
Verification for this checkpoint remains targeted by instruction; combined coverage/Fallow
and live-host acceptance remain with finalization.
