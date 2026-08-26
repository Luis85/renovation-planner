# src/prototypes — mocks and prototypes, never shipped

The acceptance criteria this tree answers to are
[`docs/requirements/Prototype a screen in the harness before it is built.md`](../../docs/requirements/Prototype%20a%20screen%20in%20the%20harness%20before%20it%20is%20built.md).
Read it before the first mock: two of the questions below — where a mock's CSS goes, and what
"never shipped" does and does not cover — are settled there and nowhere else.

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

## Where a mock's CSS goes

**In `styles/`, in the sheet that ships.** A partial of its own plus an `@import` in
`styles/index.css` — the assembler fails the build on a partial nothing imports, which is what
stops that edit being half-done. `styles/zone-panel.css` and `styles/work-packages.css` are the
two worked examples, and each states the trade in its header.

There is nowhere else to put it, by two rules that meet here: `vue/no-restricted-block` refuses
a `<style>` block in every `.vue` file in this repository, and criterion 5 of the requirements
note asks that a mock and a real component on one screen be styled by the SAME assembled
stylesheet — there is no second sheet in the harness page for prototypes to opt into. That is
deliberate: the design a designer approves is drawn by the bytes a vault will run, and
promotion stays a file move rather than a redraw.

**The cost, which the "never shipped" heading above does not cover and must not be read as
covering.** It is true of MODULES — the one-way door and the bundle scan below hold it — and
false of the stylesheet. A mock's rules ship to every vault while the screen they draw does not
exist. Deleting a mock therefore means deleting its partial and its `@import` too.

`tests/build/prototype-styles.test.ts` refuses a class a mock names that the assembled sheet
leaves undeclared, so a mock cannot arrive unstyled by accident — which is how the first one
here rendered `Kitchen12.60 m²` through forty-four review rounds. It says nothing about whether
the styling is any GOOD: jsdom lays nothing out, so spacing, wrapping and overflow are visible
only in a capture read by eye.

## What the shape of a template-only file decides for you

Two constraints that are easy to meet mid-file rather than at the start, and neither is a bug:

- **No bound dimensions.** No script block means no `:style` binding, and an inline
  `style="width: 40%"` is what the marketplace rejects and what promotion would have to
  remove — a redraw. So a progress bar cannot be mocked as a bar. Express the quantity in
  countable elements instead (`WorkPackages.vue` uses one pip per task), which is usually the
  better answer anyway and is certainly the one you can promote.
- **No repetition.** No props means no `v-for` over data, so six rows are six hand-written
  blocks. The composable unit can therefore be a REGION — a filter bar, a summary panel — and
  never the repeated row. Decide your decomposition knowing that, rather than discovering it
  at line 300. `npm run analyze` will report the repeated blocks as clones, which is correct
  and is the price of the constraint.
- **No interaction states.** No script block means no state, so there is no hover, selection,
  focus or empty state to judge — and for a list view those are half of what there is to judge.
  A mock answers what a screen LOOKS like at rest. When the question is what it does, the
  answer is a real component and a slice, not a bigger mock.

## Running one

```
npm run harness                                   # the index, at ?index
npm run harness-shot prototype:ZonePanel          # both schemes, 1280 wide
npm run harness-shot prototype:ZonePanel -- --width=460   # and a narrow pane
```

The argument is the entry's qualified ID — `prototype:ZonePanel`, `component:editor/shell/StatusBar`
— not the basename the index displays, because a mock and the real component it stands in for
share a basename and both stay reachable. `idFor` in `tests/harness/entries.ts` defines the
form. PNGs land in `harness-shots/`, gitignored, named
`entry-<sanitised-id>-<digest>[-w<width>]-<scheme>.png`; the digest is a hash of the real id,
there because sanitising alone would let two different entries collide on one filename.

The `--` before `--width` is not decoration: without it npm claims the flag as its own config
and the script is invoked with the entry alone, capturing at the default width and exiting 0.
The command refuses that rather than quietly obeying the wrong one.

`--width` is worth reaching for on the first look, not the second: an Obsidian sidebar leaf is
routinely under 400px, and the default 1280 hid a layout in which every name ellipsed to a
prefix. A `?entry=` that resolves drops the index's own sidebar, so what you measure is the
screen rather than the harness.

## What the gates say about a mock, and what they do not

`npm run check` is close to silent here by design: coverage excludes this tree, fallow is told
to ignore it, and a collapsed layout is not a thing any of them can see. What DOES cover a mock:
the Vue lint rules (through `npx eslint --fix src/prototypes/X.vue`, and through the edit-loop
hook, which runs ESLint for `.vue` precisely because oxlint has no Vue rules at all), the class
check above, and the accessibility suite — which scans an entry open on the stage, so an
unlabelled control in a mock is a real failure.

That still leaves appearance, and appearance is the point. **Look at the capture.** For a mock,
that is not advice; it is the verification story.

It is excluded from coverage (`vitest.config.ts`) because nothing ships it, and declared to
fallow (`.fallowrc.json`) because `import.meta.glob` is a Vite feature its static graph cannot
follow.

Reachable at `npm run harness`, on the index page — opt-in at `?index` (or any `?entry=`), not
at the bare URL, which keeps `npm run harness-shot`'s three fixed shots of the project surface
addressable with no `view` parameter at all.
