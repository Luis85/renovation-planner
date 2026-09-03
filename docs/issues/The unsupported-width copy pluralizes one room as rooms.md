---
type: Issue
parent: "[[Open a floor plan in the Obsidian editor shell]]"
order: 90
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
effort: S
complexity: ""
business-value: ""
business-value-model: ""
---

# The unsupported-width copy pluralizes one room as rooms

## The question

How should the unsupported-width summary inflect its room count when the floor contains exactly
one room?

## What is true today

The English string is `"{floor} has {rooms} rooms..."` for every count
(`src/presentation/i18n/locales/en/editor.ts:193-197`), and
the German string likewise uses `"{rooms} Räume"` for every count
(`src/presentation/i18n/locales/de/editor.ts:134-137`).
`UnsupportedWidthNotice` always supplies the numeric count to that one key
(`src/presentation/editor/shell/UnsupportedWidthNotice.vue:37-43`).

The responsive fixture contains one room, but its test only checks that the rendered text
contains `"1"` and has no interpolation braces
(`tests/presentation/editor/shell/responsiveShell.test.ts:145-161`). It therefore passes on
the visible sentence “Ground floor has 1 rooms.”

Measured with `rg -n "unsupported-width.body|has 1 rooms" src tests docs`: there is one English
plural template, no plural-selection path, and the defect is already recorded in the task and
parent amendments
(`docs/tasks/Keep the editor truthful across failure and narrow layouts.md:49-56`,
`docs/requirements/Open a floor plan in the Obsidian editor shell.md:130-132`).

## Why it matters

This is the only non-canvas summary shown when the pane is too narrow to edit. Its count is
orientation content, and incorrect grammar makes the refusal look unfinished precisely when it
must communicate clearly. M16 requires a clear non-canvas summary
(`docs/user-experience/renovation-planner-editor-specs/screens/M16-constrained-workspace.md:20-27`).

## What closes it

Add singular and plural locale keys and choose between them from the room count at the caller.
That is smaller than introducing general pluralization support into `tr` for the first count
that needs it, while preserving correct German copy in the same change.

Replace the current substring assertion with exact user-visible body assertions for one and two
rooms in both locales. The two-count contrast discriminates a real plural branch from simply
changing `"rooms"` to `"room"`.

## References

- [[Open a floor plan in the Obsidian editor shell]]
- [[Keep the editor truthful across failure and narrow layouts]]
- `src/presentation/i18n/locales/en/editor.ts:193-197`
- `src/presentation/i18n/locales/de/editor.ts:134-137`
- `src/presentation/editor/shell/UnsupportedWidthNotice.vue:37-43`
- `tests/presentation/editor/shell/responsiveShell.test.ts:145-161`
- `docs/tasks/Keep the editor truthful across failure and narrow layouts.md:49-56`
- `docs/requirements/Open a floor plan in the Obsidian editor shell.md:130-132`
- `docs/user-experience/renovation-planner-editor-specs/screens/M16-constrained-workspace.md:20-27`
- Reviewed at commit 16757d6d
- PASS 4
