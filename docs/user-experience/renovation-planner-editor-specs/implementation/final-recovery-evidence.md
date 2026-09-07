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
