# Reference viewport fixture repair

Base: `38c821fccc4633243deb270bda4a68c2d78638e6`. Concern: test fixture correction only; production behavior is unchanged.

The first combined focused run (session 63879, `VITEST_MAX_WORKERS=1`) finished with **408 passed / 7 failed**, across 37 files (32 passed / 5 failed), with no timeouts. Its reference viewport file had 9 passed / 2 failed out of 11 cases. Original log: `C:/Users/lum/.codex/tmp/editor-focused-combined-tests-20260909.log`.

- The wheel test failed at event construction before the component handler: Vue Test Utils tried to assign inherited readonly `MouseEvent.clientX` to a WheelEvent. Dispatch a native WheelEvent and await Vue's next tick. Preserve all source-pixel anchoring, delta clamp, held-gesture and collapsed-view assertions.
- The theme pixel test attempted to read outside the helper's 1×1 backing canvas. Vue initializes width/height as attributes, and production correctly skips assigning already-matching dimensions. Synchronize the real backing canvas to the element's dimensions in this pixel-specific test before invoking the theme redraw. Preserve actual RGB pixel inspection, visible B-label assertion, offscreen label absence and no emitted calibration point.

Repair status: **unverified**. Source review and `git diff --check` only; no new lint, type, test, browser or coverage run. Root will include this file with the curve repairs in the combined focused rerun. No assertions, timeouts, coverage thresholds or production code were relaxed.
