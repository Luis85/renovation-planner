# Production editor design QA

Source truth: `docs/user-experience/renovation-planner-editor-specs/images/M00…M17`, the adjacent screen specifications, component library, and accepted ADR amendments. [Screen-by-screen implementation matrix](docs/user-experience/renovation-planner-editor-specs/implementation/editor-visual-fidelity.md).

Implementation evidence: `docs/user-experience/renovation-planner-editor-specs/implementation/evidence/editor-visual-fidelity/`. This is the actual production editor component tree, not a replacement prototype. Baseline was captured at `273f3617a4822e51d835a24ac50e6dbd68de2a09` before production edits.

## Comparison method

The reference PNGs are 1487 × 1058 raster pixels. Their original CSS viewport/DPR is unspecified. Full comparisons remove host chrome with a recorded crop and preserve aspect ratio in equal 720 × 500 cells. M16 additionally removes the adjacent host note pane. Focused inspector comparisons normalize both regions to 360 pixels wide without stretching. `comparisons/manifest.json` records every native size and crop rectangle.

Production captures use device scale factor 1: shell states at 1440 × 1000 CSS pixels; connected journeys at 1440 × 900 light/dark, 1000 × 900 custom accent, and 460 × 900 German dark. Long-label reflow uses 720 × 450 CSS pixels, the layout space of a 1440 × 900 leaf at 200%. This verifies reflow, not the browser's zoom implementation.

Each `comparisons/Mxx-full.png` places reference, baseline and implementation in one image. Each `comparisons/Mxx-detail.png` pairs the corresponding focused region (whole task view for modal/banner/empty/constrained states). The original screenshots remain available without cropping.

## Iteration history

1. Baseline: inspected all 18 source PNGs and the production shell, renovation, planning and reference matrices. Found narrow panels, low navigation hierarchy, unaligned values, oversized prose, strong zone fills and cramped task controls. The initial shell and record pass addresses these shared causes.
2. First comparison: [`iteration-1`](docs/user-experience/renovation-planner-editor-specs/implementation/evidence/editor-visual-fidelity/iteration-1/) preserves representative earlier comparisons. M05 exposed the generic overlay's inherited bottom/right insets stretching the starting card nearly to the canvas bottom (P1). Clear those insets. M01 lacked its real floor heading (P2); render the existing summary name. M13 totals displaced too much detail (P2); use three columns/two rows while retaining all five amounts. M02 unavailable reasons were too faint (P2); use host muted text. Scope flattened button classes and their focus rules after the category check rejected the first CSS cascade.
3. Expanded scope: implemented the real transformation/continuation overview, floor change/cost summaries, wall target context, and atomic shared Work/Evidence and planned-change actions. Shared links retain one identity and have concrete unlink/delete impacts. The functional suites exercise persistence, conditional undo, draft reflow, refusal and late completion. M00/M01/M07/M11 final captures use these new connected states; their original baseline captures predate those capabilities, so fixture and mode differences are recorded rather than normalized away.
4. Final recapture and universal regression gate pending. The `comparisons/` directory still contains preliminary material and will be regenerated from completed final journey runs before acceptance.

## Visual checks

- Typography: host UI fonts and sizes; explicit identity/title/metadata hierarchy. No new font or icon library. Existing text-labelled controls are retained under the accepted project convention.
- Layout: adaptive panel widths, input spacing, aligned tabular quantities, compact costs, task/dialog grouping, selected inset with no border-width layout jump.
- Theme: semantic Obsidian tokens, including custom background/accent; zone fills use the existing resolved theme bridge. No literal production CSS colors.
- Content/assets: real floor and record identities, existing quantities/amounts/statuses, authentic reference scan and evidence fallback. No decorative replacement floor, fake thumbnails or mock totals. The fixture geometry intentionally differs from the illustration.
- States: native controls, existing unavailable reasons, provenance and calculation disclosures, selection and source relationships remain visible and labelled. Modal/drawer hosts and the canvas instance are unchanged.
- Accessibility/responsiveness: new flat controls retain explicit focus indicators. Root modal/drawer hosts remain stable; shared-context unlink restores Inspector focus after its row disappears. Final keyboard/reflow and overflow checks are pending. Live Obsidian, community-theme coverage and actual browser zoom remain acceptance limits.

## Remaining acceptance work

Complete the final browser matrices, inspect all regenerated full/detail comparisons, integrate the agreed recovery/navigation checkpoints, and pass the unchanged repository gate. The implementation is rebased on reviewed #88 checkpoint `3c1c737a`. In-progress captures must not be treated as final acceptance.

The 2026-09-07 full gate passed build, lint and all 7,280 tests (544 files; 70 skipped), but branch coverage was 97.83% against the unchanged 98% requirement. The following M00 focus correction retains one navigation instance and returns focus to Details after the Overview trigger disappears; its targeted regression is attributed separately. This checkpoint may be integrated to unblock the common element foundation, but final coverage and visual acceptance remain open.

Final result: blocked
