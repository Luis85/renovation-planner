# src/prototypes — mocks and prototypes, never shipped

The acceptance criteria this tree answers to are
[`docs/requirements/Prototype a screen in the harness before it is built.md`](../../docs/requirements/Prototype%20a%20screen%20in%20the%20harness%20before%20it%20is%20built.md).
Read it before the first mock: two of the questions below — where a mock's CSS goes, and what
"never shipped" does and does not cover — are settled there and nowhere else.

`.vue` files that are already real Vue components the harness mounts like any other, so
**promotion MOVES the file — the markup is never redrawn.** That is the whole point, and
`tests/build/prototype-promotion.test.ts` holds it.

**A `<template>` is the only required block.** A `<script setup>` and a `<style>` are both
allowed here and refused everywhere else in `src/`; `tests/build/vue-rules.test.ts` drives both
trees, because "off here and on there" is a claim a config's own text cannot make good on.

- **Template-only is the simplest shape and stays fully supported.** It composes through the
  index's global registry (below), and promotion adds the `<script setup>`. `ZoneSummary.vue` is
  deliberately kept this way so the route stays driven rather than becoming folklore.
- **A `<script setup>` makes a mock more like the thing it becomes, not less.** Every shipped
  component has one, so a scripted mock promotes with nothing to add. Reach for it as soon as
  the screen needs props, a `v-for` over data, or any state — a filter that cannot be pressed
  and a list whose rows are hand-copied are both worse mocks than the constraint was worth.
  `WorkPackageFilters.vue` is the worked example.
- **A `<style>` block is the one trade that runs the other way**, so decide it deliberately
  rather than by habit. See below.

**Which markup, exactly.** It is HTML plus Vue's template syntax, written to the same Vue lint
rules as the rest of `src/` — tab indentation, and a content-bearing element with attributes on
its own lines. Those rules are not relaxed here BECAUSE of promotion: a template that breaks them
would be illegal the moment it moved into `src/presentation/`, and repairing it there is the
redraw this tree exists to avoid. Both are auto-fixable, so `npx eslint --fix src/prototypes/X.vue`
settles them without reading a rule. One rule IS relaxed — `vue/multi-word-component-names`, so a
mock may be called `Kitchen.vue` after the screen it draws; it is about the file name rather than
the markup, and a promoted mock is simply renamed. `eslint.config.mjs` carries the reasoning and
`tests/build/vue-rules.test.ts` drives all three spellings in both trees.

**Two ways to compose, and which one you get follows from whether the file has a script.** A
template-only file can import nothing at all — it has nowhere to put the statement — so
`<StatusBar />` and `<ZoneSummary />` resolve through the index's GLOBAL REGISTRY:
`tests/harness/page.ts` registers every discovered component AND every discovered mock on the
index app (`registrableComponents` in `tests/harness/entries.ts`). A mock sharing a label with
a real component deliberately TAKES that tag, which is what writing a mock is for.
`src/prototypes/ZonePanel.vue` is the worked example and
`tests/harness/indexRealEntries.test.ts` is what holds it.

A scripted mock may do that too — the registry is an app-level plugin and does not care what a
component's script contains — or it may **import what it composes directly**, which is what a
shipped component does and therefore the promotion-friendly route: a file whose imports are
already the real ones promotes with nothing to rewire. The registry route promotes by ADDING
those imports, since no shipped component resolves a tag globally. Prefer the import once a
mock has a script; keep the registry for the template-only shape, where it is the only option.

**This tree is a one-way door.** Nothing in `src/` may import from it. The reverse direction is
open at the layer level — no `no-restricted-imports` rule stands in the way of a prototype naming
`vue`, a real component, or anything else `src/` may name, which
`tests/build/prototypes-one-way-door.test.ts` drives from the open side as well as the closed
one — and a scripted mock is exactly how that gets exercised: `WorkPackageFilters.vue` imports
`vue` today. This paragraph read
"nothing in this tree can exercise that today, because the template-only rule leaves no place for
an import statement to live", which was true for one increment and became false the moment a mock
was allowed a script; it is recorded here rather than quietly deleted, because the direction it
had authors avoiding is the supported one. Two checks guard the CLOSED direction, because neither
is sufficient alone:

- `eslint.config.mjs` bans the import from every other layer — checked at the forbidden thing,
  so it holds for code nobody has written yet. `tests/build/prototypes-one-way-door.test.ts`.
- `tests/build/prototypes-not-bundled.test.ts` runs a real `vite build` in memory (`write:
  false`, so nothing is ever written to `dist/`) and inspects which modules composed each
  chunk — catching the dynamic route lint cannot see. It derives what to look for from THIS
  TREE: no file here has to remember a marker, because a marker only ever proves the marker
  is absent.

## Where a mock's CSS goes

**Two homes, and they differ in one thing: whether the rules ship.**

**Its own `<style scoped>` block — prefer this while the screen is provisional.** Nothing
imports this tree, so the block never reaches `dist/`: a screen that does not exist yet costs
every vault nothing. `WorkPackageFilters.vue` is the worked example. What it costs is that the
block does not TRAVEL: a shipped component is styled from the assembled sheet, because SDD §84's
colour check runs over that sheet with lightningcss and never sees inside an SFC — so promotion
lifts the block into a partial. `tests/build/prototype-promotion.test.ts` pins that a promoted
component carries no `<style>`.

**`scoped` is required, and it is not a preference.** Vite injects a component's CSS when its
module loads and never removes it, so an unscoped block goes on styling the index after the
designer has navigated away — and any later entry sharing a selector, a real component included,
inherits provisional rules, making what it looks like depend on the order entries were opened.
That is criterion 5's guarantee broken by the mechanism meant to be free.
`tests/build/prototype-styles.test.ts` refuses an unscoped block.

**And `scoped` alone is not enough, which is the part worth reading twice.** Vue applies the
parent's scope attribute to a child component's ROOT element, by design — so a mock's rule can
still reach a real component it composes, without crossing any navigation. Two rules close that,
both checked:

- **Every selector's subject carries a class.** `.rp-panel footer { … }` around a composed
  `<StatusBar />`, whose root is a `<footer>`, restyles it; `.rp-panel .rp-panel__footer` cannot.
- **No class a mock declares is one a real component uses.** That is the likelier spelling,
  because a designer wanting to nudge a composed component reaches for that component's class.
  Naming it in MARKUP stays legal — laying a composed component out is legitimate; putting a
  rule on it is what criterion 5 refuses.
- **No escape from the scope.** `:global(…)` is emitted with no scope attribute, so a rule
  inside a scoped block can still be global; `:deep(…)` (and `::v-deep`, `>>>`, `/deep/`) reaches
  into a composed component's markup, which is a one-word opt-out from both rules above. Both are
  refused by name. `:slotted(…)` is allowed: it is bounded to content the mock was handed.
- **No local rule for a class you hand to a component.** `<StatusBar class="mock-status" />` is
  ordinary Vue and stays legal — fallthrough merges that class onto the child's root, which is
  how a mock lays a composed component out using the SHIPPED sheet. Declaring `.mock-status` in
  the mock's own block is what reaches inside it, so the refusal is of the PAIR rather than
  either half.

**A `styles/` partial plus an `@import` in `styles/index.css`** — the assembler fails the build
on a partial nothing imports, which is what stops that edit being half-done.
`styles/work-packages.css` and `styles/zone-panel.css` are the worked examples. Reach for this
when the SFC has outgrown its budget (measured, not taste: `WorkPackages.vue` is 306 code lines
against 200 of CSS, and 506 is past the 400 this repository allows one component), or when the
screen is being built for real and the rules should travel.

**What "never shipped" in the heading above does and does not cover.** It is true of MODULES —
the one-way door and the bundle scan below hold it. A `styles/` partial is the exception, and
the exception is the whole reason the `<style>` block is now allowed: the first mock written
here put 296 lines of CSS into the shipped sheet for a screen nobody can open. Deleting such a
mock means deleting its partial and its `@import` too; deleting a mock that styles itself means
deleting one file.

`tests/build/prototype-styles.test.ts` refuses a class a mock names that the assembled sheet
leaves undeclared, so a mock cannot arrive unstyled by accident — which is how the first one
here rendered `Kitchen12.60 m²` through forty-four review rounds. It says nothing about whether
the styling is any GOOD: jsdom lays nothing out, so spacing, wrapping and overflow are visible
only in a capture read by eye.

## What a TEMPLATE-ONLY file decides for you

Three constraints, none of them bugs — and all three lift the moment the file gains a
`<script setup>`, which is why the list is here rather than in the section above. Knowing them
is how you decide which shape a mock wants BEFORE writing three hundred lines of it:

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
  A template-only mock answers what a screen LOOKS like at rest.

The first author to write a mock here hit all three, worked around each, and said so — the pips
in `WorkPackages.vue` exist because a proportion could not be drawn, and its filter bar was five
copied blocks with the first one drawn as selected so the state appeared in a screenshot at all.
Those are the constraints a script block removes; `WorkPackageFilters.vue` is what it looks like
afterwards.

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
