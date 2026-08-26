---
type: Issue
parent: "[[Prototype a screen in the harness before it is built]]"
order: 20
status: New
started: ""
finished: ""
horizon: "MVP"
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
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

## What closes it

Adding `tests/harness/*.vue` to `tsconfig.json`'s `include` and widening `VUE_FILES` to reach
them. Neither is free: the tsconfig include governs `vue-tsc`, so the file has to be
type-clean against `src/`'s settings, and the Vue ruleset will have opinions about a file
written without it. The size of that debt is unmeasured — measuring it is step one.

## Why it matters

- The index is the surface a designer works in. A defect there is invisible in exactly the
  place where looking is the point.
- The whitespace defect that survived forty-four review rounds lives in this file's family.
  `vue/no-multiple-template-root` and its siblings are not the rule that catches it, but a
  ruleset that never runs cannot catch anything.
