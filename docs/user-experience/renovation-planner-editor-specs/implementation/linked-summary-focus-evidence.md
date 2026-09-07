# Overview-link focus continuity

Date: 2026-09-07. Follow-up on `codex/native-recovery-boundaries`, based on `fe76028e`.

## Production correction

Opening Materials or Notes from the Room overview removed the focused linked-content button.
Focus fell to the document body. At 460 pixels, the next Escape therefore missed the Inspector
and left it covering the canvas; the German recovery journey's actual Material-pan assertion
then timed out. This was separate from the earlier browser resize synchronization error.

`RenovationLinkedSummary.vue` now transfers focus after rendering to the connected Room
navigation button, with the Inspector itself as fallback. It does so only after the old opener
has disappeared, while the Inspector remains connected and focus is still on the document
body. A refused navigation keeps its connected opener; another control or dialog's focus and
a retired leaf are left alone. Room/target selection and persistence behavior are unchanged.

## Native evidence

The unchanged production tree failed all four positive cases: Materials and Notes at both
1280 and 460 pixels. Every failure was the same observed `activeElement === document.body`;
the preceding Room/Wall-context checks passed. The two guard cases already passed.

After the correction, all 28 tests passed across five files in 21.63 seconds. The six new cases
cover those four routes, Escape returning to the collapsed Details rail at 460 pixels, a real
pending toolbar Undo that refuses navigation without stealing the opener's focus, and host
disposal during navigation preserving another leaf's focus. No fixture or assertion correction
was needed. Existing renovation routes, summary loading and the four prior native recovery
boundary cases passed in the same run.

`vue-tsc --noEmit`, whole-tree Oxlint, scoped ESLint for the component and its new test file,
and diff checks passed. Reports are preserved at `%TEMP%/rp-e-linked-focus-red.json` and
`rp-e-linked-focus-green.json`. The integrated full gate remains the integration task's check.

## German browser verification

The actual German recovery journey passed once with headless Edge 152.0.4191.62 on Windows,
Node 24.20.0. The probe filters the existing matrix to the German scenario and separates
artifact directories; its journey, native keyboard actions, assertions and timeouts are
unchanged. It includes the earlier verified wait for full layout after resizing. No extra
Escape, forced focus, rail activation or camera shortcut was added to get past Material pan.

The complete report is retained as
[`linked-summary-focus-browser.json`](evidence/linked-summary-focus-browser.json). Original
artifacts remain in this worktree at `harness-shots/e-linked-focus-after`, its adjacent `.log`,
and the temporary probe under `harness-shots/e-resize-probe/linked-focus-after.mjs`.
Production at capture was base `fe76028e` plus this component correction. SHA-256 of the
captured component was `40e64047e327877210d2b3423d62b4c8a59d24d69faf5b1d51e160eb4d8294d2`;
the recovery driver was `fc2ab27c74a38357c204782ca5b23ba10d0da79d727d8c6bf8f751bd30cef0da`.

Observed recovery: one material write, two failed read-only retries, zero replayed writes;
100 unrelated events and a linked-image event caused zero planning reads, while 100 relevant
events coalesced into one read. Retained drafts/focus and 200% CSS layout zoom passed, with
dialog `clientWidth` and `scrollWidth` both 426 pixels. Page errors were empty. Three axe
checks had zero violations; incomplete-check counts were 1 for the warning, 0 for the draft
and 1 for the final state. Manual screen-reader and native host zoom acceptance are separate.

The 460-pixel fixture contained 80 Rooms, 240 material records, 24 catalogue entries and 40
synthetic 1600 × 1200 photos. Raw timings, including browser-driver round trips:

| Measurement | Observed | Plan target |
| --- | ---: | ---: |
| Warm editor usable | 506.9 ms | 1500 ms |
| Keyboard selection | 65.4 ms | 100 ms |
| Photo Inspector | 75.4 ms | 200 ms |
| Ordinary pan RAF median / p95, 59 samples | 16.6 / 17.1 ms | target 60 FPS, minimum 30 FPS |
| Material pan RAF median / p95, 59 samples | 16.7 / 16.8 ms | target 60 FPS, minimum 30 FPS |

The three latency measurements are below their targets for this one probe. RAF cadence is
consistent with approximately 60 FPS, but these samples do not establish a worst-frame
minimum. The driver asserts actual camera pan/zoom changes and preserves all three Material
markers; it records latency targets without asserting them, so the values require this separate
review. Three close/reopen cycles each reported zero tracked listeners, Konva stages, DOM
images and object URLs. This is bounded instrumentation, not a heap/GPU or all-listener audit.

The saved-overview and large-photo screenshots were visually inspected: the German warning,
Retry and source-note actions remain visible, and photo controls retain a visible focus ring
without horizontal clipping. These diagnostic results do not replace the shared final theme
matrix, integrated recovery/performance report or live Obsidian acceptance.
