# Final integrated recovery and performance evidence

## Measurement preparation — 2026-09-07

This intermediate checkpoint prepares the existing recovery browser journey for the combined
editor at `88b9ee3d049ed0060ddb3e84107b27649f18d9b4` plus the forthcoming Object checkpoint.
It records no final capture, performance result or acceptance yet.

The existing 80-Room/240-material/24-Asset/40-photo fixture, 240-calculation regression,
read-only retry/write counts, accessibility scans, 200% CSS reflow and close/reopen resource
checks remain in place. The browser probe additionally reports the actual Konva Zone-layer
camera and the count of material markers. Both ordinary and material-mode pan/zoom samples
must observe a real camera translation and zoom change. The material sample expects the
selected Room's three markers to remain mounted through the interaction.

Preparation verification: `node --check scripts/editor-recovery-check.mjs` and `git diff
--check` passed. Type checking, the combined full gate and browser captures have not run for
this preparation commit; finalization will merge it before the agreed combined gate. No
production code, schema, coverage floor or exclusion changes in this checkpoint.

Final results must name the exact integrated source revision and distinguish headless browser
measurements from live Obsidian, physical devices and assistive-technology acceptance.

## Compact Materials harness preparation — 2026-09-07

On parent `24ee3177fa3d088cd52b05430ae33a972428494d`, the recovery journey is adapted to
the UI task's pending M12 compact table/navigation contract. This preparation is **not yet
executed against M12** and records no new acceptance or timing result.

Material retention counts use stable `.rp-material-row` records. The existing native
`data-rp-material-details` disclosure exposes the packaged-value comparison, and the source
change must produce a visible stale status. The large-floor journey uses the overview's
Materials link and opens compact room navigation before timing the Photos activation.
The UI task owns corresponding changes to the shared keyboard helper and normal planning
journey; both preparations must be integrated with the verified UI source before execution.

Per the integration task's intermediate-checkpoint instruction, only `node --check
scripts/editor-recovery-check.mjs` and `git diff --check` were run for this preparation; both
passed. No dependency install, test, browser capture or performance measurement ran here.

## M15 overview capture preparation

The recovery driver additionally navigates from the real saved-but-stale Materials state to
Room overview, keeps the warning and saved-refresh-needed label visible, and records
`<scenario>-saved-overview.png`. It returns through the existing Materials linked count before
the unchanged retry assertions. Both navigation steps must leave Plan and material write
counts unchanged. This supplies the M15 comparison's requested Room-overview context using
the same real fault-injected workflow. Syntax and diff checks passed; this added capture has
not yet run and records no browser acceptance.
