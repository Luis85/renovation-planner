---
type: Issue
parent: "[[Open a floor plan in the Obsidian editor shell]]"
order: 40
status: New
started: ""
finished: ""
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
effort: M
complexity: ""
business-value: ""
business-value-model: ""
---

# The warning model cannot carry its contract's severity

## The question

How can each persistent warning retain the severity, heading, busy state, and actions its active
task requires when the warning model has fields for none of them?

## What is true today

`EditorWarning` contains only `id`, `messageKey`, and optional `params`
(`src/presentation/editor/shell/warnings.ts:13-19`). `PersistentWarningStrip` consequently
renders a plain paragraph for each item and has no typed route for severity, an accessible
heading, busy state, or actions
(`src/presentation/editor/shell/PersistentWarningStrip.vue:27-40`).

The design contract specifies `{ id, severity, messageKey, params? }[]`
(`docs/superpowers/specs/2026-09-02-plan-editor-foundation-read-path-design.md:174-193`), while
the active task requires every warning to retain severity, accessible heading, body, busy state,
and actions (`docs/tasks/Render independent simultaneous persistent warnings.md:29-40`). This
gap is already recorded in the parent amendment
(`docs/requirements/Open a floor plan in the Obsidian editor shell.md:121-129`).

Measured with `rg -n "interface EditorWarning|severity|busy|action"
src/presentation/editor/shell`: only the interface declaration and prose references are found;
no warning value can supply those fields. Existing warning tests assert ids, order, params, and
container live-region placement only
(`tests/presentation/editor/shell/warnings.test.ts:9-39`,
`tests/presentation/editor/shell.test.ts:278-317`).

## Why it matters

Severity is part of the warning contract, not decoration. Without it the renderer cannot choose
the correct semantic treatment, and SDD §85's requirement that status not be encoded only by
colour cannot be satisfied coherently. Missing heading, busy, and action fields also make the
active task's keyboard and recovery criteria structurally impossible.

## What closes it

Define the smallest closed warning presentation model that carries the task's real states:
stable id, severity, accessible heading and body keys, busy state, and typed actions. Derive
those values at the existing warning-policy boundary and render them without merging sibling
warning state.

Add a component test with two simultaneous warnings of different severities and actions. Assert
each warning keeps its own heading, semantic severity marker, busy/disabled state, and callable
action when the other updates. A fixture containing only ids and messages must no longer
type-check, which discriminates a real model change from CSS inferred by warning id.

## References

- [[Open a floor plan in the Obsidian editor shell]]
- [[Render independent simultaneous persistent warnings]]
- `src/presentation/editor/shell/warnings.ts:13-19`
- `src/presentation/editor/shell/PersistentWarningStrip.vue:27-40`
- `docs/superpowers/specs/2026-09-02-plan-editor-foundation-read-path-design.md:174-193`
- `docs/tasks/Render independent simultaneous persistent warnings.md:29-40`
- `docs/requirements/Open a floor plan in the Obsidian editor shell.md:121-129`
- SDD §85, Accessibility
- Reviewed at commit 16757d6d
- PASS 2
