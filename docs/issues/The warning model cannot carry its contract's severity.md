---
type: Issue
parent: "[[Open a floor plan in the Obsidian editor shell]]"
order: 40
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

## What closed it

**2026-09-04.** Ruled on as R5 (see the sibling note's `## Decision`, dated the same day): the
smallest closed model that carries the task's REAL states, not every state the task names. R5
scopes this to severity alone — `EditorWarning` gains `readonly severity: 'warning' | 'error'`
(exported as `WarningSeverity`), and every `push` in `editorWarnings` sets it: `stale` and
`background-missing` are `warning` (what is on screen may be incomplete or out of date),
`unreadable-zones` and `background-unreadable` are `error` (a read refused, so something the user
owns is not on screen). `PersistentWarningStrip.vue` renders it per item as a mark AND a word —
`data-rp-severity="w.severity"` plus a translated `.rp-warning-strip__severity` label, resolved
through a closed `SEVERITY_LABEL: Record<WarningSeverity, StringKey>` map, never a template
string — with `.rp-warning-strip__item--warning`/`--error` giving each item its own coloured
border beside the word (`docs/components/Toast.md`'s "both, always, never one"; SDD §85).

Accessible heading, busy state and actions are explicitly NOT built: no warning has an action yet,
so there is nothing to be busy over and nothing for a keyboard user to reach, and a field with no
producer is a self-declared shape rather than a closed model. That gap is recorded in
`docs/tasks/Render independent simultaneous persistent warnings.md`'s 2026-09-04 amendment and in
`docs/requirements/Open a floor plan in the Obsidian editor shell.md`'s Remains list, narrowed from
"severity, heading, busy state and actions" to "heading, busy state and actions".

Holding tests: `tests/presentation/editor/shell/warnings.test.ts` › 'carries a severity on every
warning: out-of-date content is a warning, a refused read is an error' (the per-warning severity
values) and 'refuses a warning with no severity at compile time' — a `@ts-expect-error` case that
`npm run build`'s `vue-tsc` pass enforces, since vitest itself transpiles without checking; a
fixture of only `{ id, messageKey }` no longer type-checks, watched by removing `severity` from a
`push` and reading the resulting `vue-tsc` error
(`Property 'severity' is missing in type '{ id: "stale"; messageKey: "editor.refresh-failed"; }'
but required in type 'EditorWarning'.`). `tests/presentation/editor/shell.test.ts`'s 'keeps each
warning's own severity mark and word when the other one clears' is the two-simultaneous-warnings
component case the original `## What closes it` asked for, proving each warning's own mark and
word survive a sibling clearing. Commit "feat(warnings): every persistent warning carries a
severity as a mark and a word; the live region stays the container".

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
