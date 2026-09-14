# Astra independent wall faces delivery

Date: 2026-09-14. Scope: the explicitly requested second wall PR, stacked directly above the completed symmetric foundation.

## Identity

- Worktree: `D:/Projects/renovation-planner/.worktrees/wall-side-thickness`.
- Branch: `codex/usability-astra-wall-side-thickness`.
- Base: [PR #212](https://github.com/Luis85/renovation-planner/pull/212), `codex/usability-astra-wall-tool-polish`, `aeb75f6067cd771cd97facc9eda1f1fc2ab7a599`.
- The foundation PR and main checkout remain unchanged. Neither wall PR is to be merged by this task. This concern does not implement the separately queued opening resize/swing controls or close I18.

## Behavior

Each wall stores independent A/B face depths from its fixed directed start→end reference, with total thickness A+B. Changing a face leaves the opposite face and reference fixed. Zero depth is supported; the total retains the existing 1–1,000,000 mm bounds. Decimal input and 10 mm steps preserve fractional values. Total-width bulk edits preserve the depth difference and refuse a negative resulting face.

Actual asymmetric connected bodies use offset polygons, exterior join wedges and straight T-host clipping. Opening cuts/frames and hit regions follow the real faces; offsets, widths, swing, room links, captions, selection and camera are preserved. Geometry equality notices same-total face changes. Scaling, rotation baseline checks, room-face queries, asset snapping and opening host/move reach account for both depths.

Schema 13 backfills actual and intended legacy walls to equal extents without file writes or geometric movement on read. Unequal extents require schema 13, which older readers refuse. All writers normalize legacy-shaped inputs and reject inconsistent totals. The full design decision is [ADR-0032](../../../../development/adrs/0032-independent-wall-face-depths.md).

Plan provides compact exact entry, separate face-positioned 10 mm controls, hover/focus highlighting and a fixed-reference direction cue. Tethers preserve association when controls are clamped; small panes retain compact scrolling. The full Details form exposes both extents and the total. Apply is one reversible transaction; cancellation, perspective/selection/tool changes, disposal and retained callbacks cannot publish a retired edit. Initial command admission is checked around its asynchronous version read. Generic Add detail remains removed.

## Evidence and verification

- [Research and decision](../evidence/astra-wall-sides/research.md), [design contract](../evidence/astra-wall-sides/design.md), [bilingual help](../../wall-thickness-help.md).
- [Two-round visual review](../evidence/astra-wall-sides/visual-review.md): English/light and German/dark, wide and 400/460 px panes, reverse direction, compact entry, Details and errors. Final controls ≥44 px; narrow footer/taskbar gap 16 px; no horizontal overflow. Error contrast 5.22:1 light and 5.38:1 dark.
- [Exact browser measurements](../evidence/astra-wall-sides/browser-metrics.json) and screenshot hashes accompany the captures. Final captures are 06–10.
- One final Impeccable detector over changed presentation/style targets returned [an empty findings array](../evidence/astra-wall-sides/impeccable.json), exit 0. No second detector run.
- Preliminary coverage diagnostics: 25 files / 225 tests passed. The subset intentionally failed unchanged global coverage floors; it is not the full gate. Its isolated coverage report was used to inspect new geometry paths and complexity, without replacing the configured final report.
- Final focused preflight: type-check exit 0 and 8 files / 70 tests passed. Covers independent edits, history and callback retirement, drawing/menu/Details routes, precise input, bounds, reversed geometry, curved refusals, fill winding, asset snapping and opening movement.
- Static analysis diagnostics: 0 dead-code issues, 0 cyclomatic/cognitive breaches, and the same 3 inherited capture-script clone groups. Definitive coverage-weighted health belongs to the full gate.
- First full gate at `b01d431b84d3e5555bb94c3e3c2fcfb0e17d8f10`: production build passed; lint stopped on two callback wrappers in the extracted wall validator and one missing test mock type. Corrected those annotations without changing behavior; no coverage run from that attempt is claimed.
- Full one-worker `npm run check`, publication identity and CI: **pending**. This receipt does not yet claim publication readiness.

## Limits

Curved T junctions requiring clipping, including tangential joins, and inner faces reaching a curve centre are explicitly refused for independent networks. Native Obsidian/Windows smoke testing was unavailable through the enabled native computer APIs; browser evidence and fresh repository-stack reload tests are recorded separately. No dependency or lockfile change was made.
