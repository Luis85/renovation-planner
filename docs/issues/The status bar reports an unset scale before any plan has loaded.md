---
type: Issue
parent: "[[Open a floor plan in the Obsidian editor shell]]"
order: 30
status: Done
started: 2026-09-04
finished: 2026-09-04
horizon: Now
start: ""
due: ""
risk: ""
priority: high
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

# The status bar reports an unset scale before any plan has loaded

## The question

What scale state may the status bar claim while the floor is loading, missing, or failed?

## What is true today

`StatusBar` maps both a loaded uncalibrated plan and `plan === null` to
`editor.status.scale.uncalibrated`
(`src/presentation/editor/shell/StatusBar.vue:45-70`). The shell mounts that status bar
independently of the canvas state (`src/presentation/editor/PlanEditorRoot.vue:279-318`), so the
same “Scale not set” sentence appears while the canvas says loading or shows a missing/failed
state.

Design spec §5.7 says the scale sentence exists so “a plan drawn at the placeholder scale says
so” (`docs/superpowers/specs/2026-09-02-plan-editor-foundation-read-path-design.md:259-263`);
there is no drawn plan in these states. Measured with
`rg -n "scaleText|plan.value?.calibration" src/presentation/editor/shell/StatusBar.vue`: the
model has only calibrated and uncalibrated outcomes. The status-bar tests cover two loaded plan
fixtures and no null-plan state (`tests/presentation/editor/shell/statusBar.test.ts:21-34`).

## Why it matters

“Not set” is a fact about a loaded plan. Before hydration resolves, the system does not know
whether a scale exists; after missing or failed hydration, there is no plan whose scale can be
reported. Presenting absence as a successful negative conflicts with the parent guarantee and
the task criterion that save, stale, and uncalibrated states remain distinct.

## What closes it

Make scale presentation depend on hydration status as well as calibration. Withhold the scale
sentence, or render an explicitly unknown/unavailable state, unless the project store is ready
with a plan. Do not relabel null as uncalibrated.

Add status-bar cases for a never-settling load, `ok(null)`, and a failed read. Each must prove
that the uncalibrated sentence is absent while the existing loaded uncalibrated fixture still
shows it. That contrast discriminates truthful unknown handling from removing the scale state
entirely.

## What closed it

**2026-09-04.** `scaleText` now reads `status` beside `plan.calibration` (R9): the sentence is
withheld unless `ProjectStore.status === 'ready'` with a loaded plan, and `null` is never
relabelled "uncalibrated" — it means the span is not drawn at all
(`src/presentation/editor/shell/StatusBar.vue`). Holding test:
`tests/presentation/editor/shell/statusBar.test.ts` › 'the scale sentence is a fact about a
LOADED plan' › 'is withheld while the read has not settled', 'is withheld for a plan that does
not resolve', and 'is withheld after a failed read' — each proved against the contrast case
'says the scale is not set for an uncalibrated plan', which still shows the sentence for a
loaded, uncalibrated plan. Commit "fix(editor): the status bar withholds the scale until a plan
is loaded, and a missing plan clears the stale flag".

## References

- [[Open a floor plan in the Obsidian editor shell]]
- [[Build full and compact editor status bars]]
- `src/presentation/editor/shell/StatusBar.vue:45-70`
- `src/presentation/editor/PlanEditorRoot.vue:279-318`
- `tests/presentation/editor/shell/statusBar.test.ts:21-34`
- `docs/superpowers/specs/2026-09-02-plan-editor-foundation-read-path-design.md:259-263`
- SDD §35, Query Architecture
- Reviewed at commit 16757d6d
- PASS 2
