---
type: Issue
parent: "[[Open a floor plan in the Obsidian editor shell]]"
order: 70
status: New
started: ""
finished: ""
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
