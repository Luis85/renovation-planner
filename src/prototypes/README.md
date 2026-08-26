# src/prototypes — mocks and prototypes, never shipped

Template-only `.vue` files: a `<template>` block and nothing else — no `<script>`, no `<style>`,
both refused by lint. It is already a real Vue component the harness mounts like any other, so
**promotion adds a `<script setup>` and moves the file — the markup is never redrawn.** That is
the whole point, and `tests/build/prototype-promotion.test.ts` holds it.

**Which markup, exactly.** It is HTML plus Vue's template syntax, written to the same Vue lint
rules as the rest of `src/` — tab indentation, and a content-bearing element with attributes on
its own lines. Those rules are not relaxed here BECAUSE of promotion: a template that breaks them
would be illegal the moment it moved into `src/presentation/`, and repairing it there is the
redraw this tree exists to avoid. Both are auto-fixable, so `npx eslint --fix src/prototypes/X.vue`
settles them without reading a rule. One rule IS relaxed — `vue/multi-word-component-names`, so a
mock may be called `Kitchen.vue` after the screen it draws; it is about the file name rather than
the markup, and a promoted mock is simply renamed. `eslint.config.mjs` carries the reasoning and
`tests/build/vue-rules.test.ts` drives all three spellings in both trees.

**Composition happens through the app registry, not through imports.** A template-only file has
no script block, so it can import nothing at all — `<StatusBar />` and `<ZoneSummary />` resolve
because `tests/harness/page.ts` registers every discovered component AND every discovered mock on
the index app (`registrableComponents` in `tests/harness/entries.ts`). A mock sharing a label with
a real component deliberately TAKES that tag, which is what writing a mock is for.
`src/prototypes/ZonePanel.vue` is the worked example and
`tests/harness/indexRealEntries.test.ts` is what holds it.

**This tree is a one-way door.** Nothing in `src/` may import from it. The reverse direction is
open at the layer level — no `no-restricted-imports` rule stands in the way of a prototype naming
a real component — but nothing in this tree can exercise that today, because the template-only
rule leaves no place for an import statement to live. Two checks guard the closed direction,
because neither is sufficient alone:

- `eslint.config.mjs` bans the import from every other layer — checked at the forbidden thing,
  so it holds for code nobody has written yet. `tests/build/prototypes-one-way-door.test.ts`.
- `tests/build/prototypes-not-bundled.test.ts` runs a real `vite build` in memory (`write:
  false`, so nothing is ever written to `dist/`) and inspects which modules composed each
  chunk — catching the dynamic route lint cannot see. It derives what to look for from THIS
  TREE: no file here has to remember a marker, because a marker only ever proves the marker
  is absent.

It is excluded from coverage (`vitest.config.ts`) because nothing ships it, and declared to
fallow (`.fallowrc.json`) because `import.meta.glob` is a Vite feature its static graph cannot
follow.

Reachable at `npm run harness`, on the index page — opt-in at `?index` (or any `?entry=`), not
at the bare URL, which keeps `npm run harness-shot`'s three fixed shots of the project surface
addressable with no `view` parameter at all.
