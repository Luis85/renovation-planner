---
type: Issue
parent: "[[Open a floor plan in the Obsidian editor shell]]"
order: 60
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

## Decision

**2026-09-04.** **R6** Ruling: the Asset Designer's three borrowed strings become `designer.toolbar.pan`, `designer.toolbar.undo`, `designer.toolbar.redo`; `editor.toolbar.*` is deleted from both locales; spec §5.2/§8/§10 are narrowed to the Plan Editor toolbar keys the increment actually retired; a test refuses the literal `editor.toolbar.` anywhere under `src/` — because ownership of a key namespace must be expressible by a test, and three German words are cheaper than an ambiguous owner — cost if wrong: two identical "Undo" translations in the locale tables.

## What closed it

**2026-09-04.** The DECISION above (R6) is the substance; Task 0 supplied the spec narrowing
(§5.2/§8/§10 now name the Plan Editor toolbar keys the increment actually retired rather than
every `editor.toolbar.*` key in the plugin), and this task supplied the rename plus the test
half the note asks for. `DesignerToolbar.vue` now builds its camera-mode, Undo and Redo buttons
from `designer.toolbar.pan`/`.undo`/`.redo`; both locales gained those three keys beside their
existing `designer.toolbar.*` block (`en.ts`, `de.ts` — `'Pan'`/`'Undo'`/`'Redo'`,
`'Verschieben'`/`'Rückgängig'`/`'Wiederholen'`) and lost the three `editor.toolbar.*` entries
from `en/editor.ts` and `de/editor.ts`. The three designer test files
(`designerToolbar.test.ts`, `assetDesignerRoot.test.ts`, `designerTools.test.ts`) were updated
to the new keys in the same edit, so renaming the copy could not silently disconnect the
controls the interaction tests already drive.

Holding tests: `tests/presentation/i18n/strings.test.ts` › 'the Plan Editor toolbar is retired
(spec §5.2, R6)' › 'declares no editor.toolbar.* key in either locale' (both locale tables) and
› 'names editor.toolbar. nowhere under src/, and the designer uses its own keys' — a category
claim ("no surface names a retired key") checked at the forbidden thing, a `src/`-wide text scan
for the literal, rather than by listing files, plus a `.toBeDefined()` check that both locales
declare the three designer-owned keys. Watched red first: with the old keys still in place, the
first case reported the three surviving `editor.toolbar.*` entries and the second reported four
`src/` files still naming the literal (`DesignerToolbar.vue`, both `editor.ts` locale files and
`en.ts`'s two comments describing the borrowing).

Commit "refactor(i18n): the asset designer owns designer.toolbar.pan/undo/redo; no
editor.toolbar.* key survives".

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
