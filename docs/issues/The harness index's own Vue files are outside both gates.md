---
type: Issue
parent: "[[Prototype a screen in the harness before it is built]]"
order: 20
status: Done
started: 2026-08-26
finished: 2026-08-26
horizon: Now
start: ""
due: ""
risk: ""
priority: ""
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
effort: ""
complexity: ""
business-value: ""
business-value-model: ""
---

# The harness index's own Vue files are outside both gates

A gap in coverage of the build's own gates, found by reading the configuration rather than by
anything going wrong.

## The question

`tests/harness/IndexPage.vue` is the largest single Vue file in the repository and the one
every prototype is viewed through. It is reached by **neither** type checking nor the Vue lint
rules:

- `tsconfig.json`'s `include` is `src/**/*.ts`, `src/**/*.vue`, and the one named
  `type-safety.test-d.ts` — so `vue-tsc --noEmit` never opens it.
- `eslint.config.mjs`'s `VUE_FILES` is `['**/src/**/*.vue']`, so `eslint-plugin-vue`'s whole
  recommended set — including the rules that would have caught the condensed-whitespace defect
  class — stops at the `src/` boundary.

`tests/harness/SharedWorldPrototype.vue` is in the same position. What *does* cover them is the
suite: `indexPage.test.ts` and `indexRealEntries.test.ts` mount them for real, and Vite
transpiles the SFC without checking it. So a type error in that file surfaces as a runtime
failure in a test, or not at all.

## What is true today

- `src/prototypes/*.vue` **are** covered by both — they match `src/**/*.vue` on either side.
  The gap is exactly the harness's own machinery under `tests/`.
- `CLAUDE.md` already states that nothing type-checks `tests/**` except one named file. This
  note is not contradicting that; it is pointing out that the exception list is now one file
  short of what the tree needs, because `tests/` gained a 700-line component.

## What closed it

`tsconfig.json`'s `include` gained `tests/harness/**/*.vue` and `VUE_FILES` gained
`**/tests/harness/**/*.vue`. The debt was measured first and came to six things:

- **A real defect, and the argument for the whole change.** `HARNESS_PLAN` in
  `tests/harness/planEditor.ts` was annotated `PlanDto` and was missing the required
  `calibration` field — the annotation had been asserting a shape nothing checked. It is
  `null` now, with the reason written beside it: the harness plan has no background to have
  been calibrated against, so a `Calibration` there would claim a measurement nobody took.
- **`import.meta.glob` had no type.** Declared in `tests/harness/entries.ts` as a global
  interface merge rather than by adding `vite/client` to `types`, which is program-wide and
  would also make `*.css` importable from `src/` — typechecking cleanly while bypassing the
  assembler that enforces SDD §84. The two `as` casts it existed without are gone.
- **Three `no-console` errors**, which is the rule being backwards here: `console.error` is the
  channel `harness-shot` records and exits non-zero on, and the index's `.ts` siblings have
  always been free to call it. One carve-out block, one rule, parity restored rather than
  permission granted.
- **Thirteen formatting warnings**, all auto-fixed.
- **No max-lines failure**: the 400-line budget skips comments, and `IndexPage.vue` is mostly
  comment.
- **A check on the wiring**, because everything above is a claim about two globs. Asking the
  glob's shape is what a review round already got wrong once in this file, so
  `tests/build/lint-scope.test.ts` asks the TOOLS: TypeScript's own config parser resolves the
  include list — with `.vue` declared as an extra extension, without which it answers "no
  files" and the check passes vacuously — and ESLint's `calculateConfigForFile` answers for
  both directions, the Vue rules on under `tests/harness/` and `no-console` still an error
  under `src/`. Each of the four assertions was watched failing against a reverted config.

## Why it matters

- The index is the surface a designer works in. A defect there is invisible in exactly the
  place where looking is the point.
- The whitespace defect that survived forty-four review rounds lives in this file's family.
  `vue/no-multiple-template-root` and its siblings are not the rule that catches it, but a
  ruleset that never runs cannot catch anything.
