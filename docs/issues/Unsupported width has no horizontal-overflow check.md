---
type: Issue
parent: "[[Open a floor plan in the Obsidian editor shell]]"
order: 70
status: Done
started: 2026-09-04
finished: 2026-09-04
horizon: Now
start: ""
due: ""
risk: ""
priority: medium
assignee: ""
iteration: ""
strategic-alignment: ""
customer-value: ""
business-impact: ""
reach: ""
risk-reduction: ""
compliance: ""
time-criticality: ""
enablement: ""
confidence: ""
effort: S
complexity: ""
business-value: ""
business-value-model: ""
---

# Unsupported width has no horizontal-overflow check

## The question

What verifies that the unsupported-width shell creates no horizontal scrollbar below 400px?

## What is true today

M16 requires the below-supported layout to replace editing without horizontal scroll
(`docs/user-experience/renovation-planner-editor-specs/screens/M16-constrained-workspace.md:20-27`),
and the owning task repeats that acceptance criterion
(`docs/tasks/Keep the editor truthful across failure and narrow layouts.md:24-30`).

The responsive test does resize the shell to 320px, but it asserts only the layout mode,
replacement content, interpolation, focus action, and later canvas restoration
(`tests/presentation/editor/shell/responsiveShell.test.ts:145-167`). jsdom performs no layout.
The only fixed Plan Editor narrow capture is 460px
(`scripts/harness-shot.mjs:200-219`), which is `constrained`, not `unsupported`.

Measured with `rg -n "scrollWidth|clientWidth|horizontal|overflow"
tests/presentation/editor scripts/harness-shot.mjs`: no 320px layout measurement exists. This
known gap is already recorded in the task and parent amendments
(`docs/tasks/Keep the editor truthful across failure and narrow layouts.md:49-56`,
`docs/requirements/Open a floor plan in the Obsidian editor shell.md:130-138`).

## Why it matters

Unsupported mode exists specifically to refuse a width at which editing would break. A
sideways scrollbar means the refusal itself does not fit, and neither DOM assertions nor the
460px capture can reveal it.

## What closes it

Measure the real rendered unsupported shell at 320px. The smallest close is a browser-harness
check that opens the Plan Editor at that width and compares the relevant shell's `scrollWidth`
with `clientWidth`; a fixed 320px capture may accompany it for visual review but is not the
measurement.

The discriminating browser test must fail after adding a child wider than the unsupported
container and pass when `scrollWidth <= clientWidth`. Keep the existing 460px capture because it
answers a different constrained-layout question.

## What closed it

**2026-09-04 (R13).** A new fixed shot, `plan-editor-unsupported` — `?view=plan-editor&theme=light`
at 320px, waiting on `.rp-editor-shell[data-layout="unsupported"] .rp-unsupported-width` — carries
a `measure: '.rp-editor-shell'` field. `scripts/harness-shot.mjs`'s `captureOne` reads
`shellMetrics` (`scripts/captureMeasures.mjs`) through `page.evaluate` after the screenshot and
judges it with `overflowFinding`, a pure Node function so the rule itself is unit-testable with
no browser; a finding joins the same errors list every other page or console failure does, so
`npm run harness-shot` exits 1 on a sideways scroll exactly as it does on a page error. The
discriminating check was run in a real browser rather than only asserted: a temporary
`<div style="width: 900px">` inside `UnsupportedWidthNotice.vue`'s root produced
`[plan-editor-unsupported] .rp-editor-shell scrolls horizontally: scrollWidth 610 > clientWidth
320` and exit 1; reverting it returned the run to exit 0. The existing 460px `plan-editor-narrow`
capture is untouched. Holding tests: `tests/build/captureMeasures.test.ts` › `overflowFinding`
(all three cases) and `tests/build/harness-shot.test.ts` › 'the headless harness capture script'
› 'measures the unsupported shell for horizontal overflow at 320 px, through the importable
overflowFinding'. Commit "test(harness-shot): wait for the state each plan-editor shot names,
derive the inventory from SHOTS, and measure the 320 px shell for horizontal overflow".

## References

- [[Open a floor plan in the Obsidian editor shell]]
- [[Keep the editor truthful across failure and narrow layouts]]
- `docs/user-experience/renovation-planner-editor-specs/screens/M16-constrained-workspace.md:20-27`
- `docs/tasks/Keep the editor truthful across failure and narrow layouts.md:24-30`
- `docs/tasks/Keep the editor truthful across failure and narrow layouts.md:49-56`
- `tests/presentation/editor/shell/responsiveShell.test.ts:145-167`
- `scripts/harness-shot.mjs:200-219`
- `docs/requirements/Open a floor plan in the Obsidian editor shell.md:130-138`
- Reviewed at commit 16757d6d
- PASS 4
