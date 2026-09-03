---
type: Issue
parent: "[[Open a floor plan in the Obsidian editor shell]]"
order: 60
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

# The toolbar-key retirement contract conflicts with the Asset Designer

## The question

Did the Plan Editor retire its own toolbar vocabulary, or did the design contract retire every
`editor.toolbar.*` key in the plugin?

## What is true today

Design spec §5.2 says the toolbar is retired and names deleted toolbar strings; §8 says keys
retired with the toolbar are deleted; §10 says the build proves `editor.toolbar.*` keys are gone
(`docs/superpowers/specs/2026-09-02-plan-editor-foundation-read-path-design.md:198-204`,
`docs/superpowers/specs/2026-09-02-plan-editor-foundation-read-path-design.md:377-381`,
`docs/superpowers/specs/2026-09-02-plan-editor-foundation-read-path-design.md:405-416`).

The merged Asset Designer still uses `editor.toolbar.pan`, `editor.toolbar.undo`, and
`editor.toolbar.redo` in its production toolbar
(`src/presentation/designer/DesignerToolbar.vue:49-51`,
`src/presentation/designer/DesignerToolbar.vue:74-90`). Those keys remain in both locale tables
(`src/presentation/i18n/locales/en/editor.ts:26-32`,
`src/presentation/i18n/locales/de/editor.ts:13-19`).

Measured with `rg -n "editor\.toolbar\." src`: production matches remain in
`DesignerToolbar.vue` and the locale tables. The design's claimed build check therefore either
does not exist or cannot mean the wildcard statement it makes.

## Why it matters

The Asset Designer has a real toolbar; the Plan Editor deliberately does not. Sharing a
Plan-Editor-owned key namespace makes a valid designer control look like a regression against
the editor-shell contract and prevents a test from expressing which surface owns the copy.

## What closes it

Rename the three borrowed strings to designer-owned keys and narrow the design contract to the
Plan Editor toolbar keys it actually retires. Keep the displayed words shared only if the i18n
model has an explicitly neutral key; do not retain ownership ambiguity to avoid three
translations.

Add a source/build test that rejects `editor.toolbar.*` references outside historical prose and
asserts `DesignerToolbar` uses designer-owned pan, undo, and redo keys. Pair it with the existing
toolbar interaction test so renaming copy cannot disconnect the controls.

## References

- [[Open a floor plan in the Obsidian editor shell]]
- [[Render the Obsidian native editor shell]]
- `docs/superpowers/specs/2026-09-02-plan-editor-foundation-read-path-design.md:198-204`
- `docs/superpowers/specs/2026-09-02-plan-editor-foundation-read-path-design.md:377-381`
- `docs/superpowers/specs/2026-09-02-plan-editor-foundation-read-path-design.md:405-416`
- `src/presentation/designer/DesignerToolbar.vue:49-90`
- `src/presentation/i18n/locales/en/editor.ts:26-32`
- Reviewed at commit 16757d6d
- PASS 2
