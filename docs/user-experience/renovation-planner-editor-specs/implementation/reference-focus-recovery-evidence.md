# Reference focus after responsive reflow

Date: 2026-09-07. Bounded correction based on combined editor `9e2b89f8` for PR #91.

## Confirmed failure and correction

The unchanged final Reference browser journey stopped after cancelling a replacement
draft following 1440 → 460 reflow. The modal closed, but focus did not return inside the
editor. The inspected `reference-plan/light-failed.png` shows the closed Layers region
and visible Layers/Details rails. This is a failed acceptance run, not a successful capture.

The persistent shell hides its regions with `v-show`. The Reference action only recovered
focus when its opener had been disconnected, so a connected but hidden opener bypassed
recovery. Chromium ignores the dialog host's attempt to focus that hidden button. Its
fallback selector also allowed a hidden Reference action earlier in DOM order to win over
the visible Layers rail.

Reference now uses the existing dialog action focus helper. The helper captures the
originating Layers or Inspector region before awaiting the dialog. Hidden or removed
openers return to the matching visible rail, the unsupported-width action, or a visible
replacement action/region. Floor-start Reference uses Layers as its fallback region.
A surviving visible opener keeps the normal dialog-host restoration. Disposed editor roots
do not reclaim focus. No browser assertion or timeout was changed.

## Regression evidence

Six new cases open the actual Reference form from both Layers and the floor Inspector,
type a draft, resize, and dispatch native Escape. The initial run passed the two
460 → 1440 cases and failed all four 1440 → 460/300 cases at the focus assertion.
After the production correction, all six pass. They also assert retained field text/focus
during reflow, correct connected focus destination after close, no command dispatch, and
unchanged FakeVault contents. jsdom does not enforce hidden-element focus like Chromium;
these tests assert the required visible destination explicitly.

The shared-helper regressions also remove a Layers opener while its dialog is pending to
prove that the origin was captured before the await, and put a hidden replacement before a
visible one to prove it cannot win by DOM order.

The three-file integration run passed 46 tests in 38.65 seconds, covering the complete
Reference workflow, existing focus-helper cases, and element lifecycle completion.
The expanded helper file passed all nine tests in 20.17 seconds. Type checking,
whole-tree Oxlint and scoped ESLint passed. The subsequent Fallow dead-code/duplication
report found zero clone groups and two private-type leaks: the new internal region alias
appeared in exported signatures. Both signatures now use the equivalent inline union;
this final change is type spelling only and awaits the joined static recheck. No successful
final Fallow gate is claimed here. Machine reports are preserved as
`%TEMP%/rp-e-reference-red.json`, `rp-e-reference-green.json`, `rp-e-reference-helper.json`
and `rp-e-reference-static.json`. `git diff --check` passed.

The final shared browser matrix must rerun the unchanged Reference journey on the joined
checkpoint. This correction does not claim that matrix, full coverage/health, performance,
live Obsidian, or manual screen-reader acceptance passed. Gates and exclusions are unchanged.
