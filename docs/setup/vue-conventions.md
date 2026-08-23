# Vue conventions — codified ahead of arrival

Vue is deliberately absent from this repository (see CLAUDE.md, "Deliberately absent"):
it arrives with the first real component. This file is the contract for that day, written
now so the first `.vue` file is reviewed against rules that were chosen calmly rather
than improvised under it.

**Honesty first: nothing in this file is checked today.** There is no `.vue` file, no
`eslint-plugin-vue`, no `vue-tsc`. Every rule below therefore names the check that will
enforce it, and the arrival checklist is the step that turns those names into gates —
in the SAME pull request as the first component, never later. A convention whose check
is deferred is a paragraph, and this project does not trust paragraphs.

Rule names and config levels below were verified against the official Vue documentation
and eslint.vuejs.org in August 2026; re-verify against the installed version on arrival.

---

## 1. Arrival checklist

**This checklist is not the authoritative one, and it names two configs where this repository
has three.** It was written against a project with two Vite surfaces; here the standalone
`vitest.config.ts` is a third thing that transforms source, and its `coverage.include` is a
fourth item this list does not have. The superset — scoped to the four gates this repository
actually runs — is design slice 1's **Vue arrival checklist**
([`docs/tasks/01-plugin-bootstrap-and-composition-root.md`](../tasks/01-plugin-bootstrap-and-composition-root.md)),
which names this file's item 2 as the thing it corrects. Read that one on the day; read the
rules below for *why* each item is there, which is what this file is good for.

The first `.vue` file's pull request contains ALL of the following, because each one is
the check under a rule in this file:

1. **Dependencies** — `vue`, `@vitejs/plugin-vue`, `vue-tsc`, `eslint-plugin-vue`,
   `@vue/test-utils`. `pinia` arrives with the first store, `konva`/`vue-konva` with the
   first canvas — same policy, later trigger. (`fallow` fails on an installed dependency
   nothing uses, so nothing arrives early.)
2. **Both Vite configs** — `@vitejs/plugin-vue` in `vite.config.ts` AND
   `vite.harness.config.ts`. The harness renders the real view; a plugin only the build
   knows about splits them. (**In this repository that is three, not two** — the standalone
   `vitest.config.ts` needs it too, or importing an SFC fails at parse before any test runs.
   Slice 1's checklist is the corrected version.)
3. **Type-checking** — `tsc -noEmit` becomes `vue-tsc -noEmit` in the `build` script,
   and `tsconfig.json`'s `include` gains `"src/**/*.vue"`. Vite transpiles without
   type-checking, so `vue-tsc` in the build is the only command-line type gate SFCs get.
   (`strict` and `isolatedModules` are already set, which is what Vue's TS guide asks for.)
   **Also `vitest.config.ts`'s `coverage.include`** → `src/**/*.{ts,vue}`: the floors are
   ratcheted and are one of the four gates, so an SFC outside the include is uncovered code
   the ratchet cannot see.
4. **ESLint** — spread `pluginVue.configs['flat/recommended']` (the Vue 3 flat configs)
   into `eslint.config.mjs`, with `parserOptions.parser: '@typescript-eslint/parser'` on
   the `**/*.vue` block so `<script setup lang="ts">` parses. Add the named rules from
   §6 in the same edit.
5. **Widen the architecture gates to `.vue`** — this is the one item nothing upstream
   will remind you of. Every `forbidden()` block in `eslint.config.mjs` matches
   `**/src/<layer>/**/*.ts`, and the `WRITE_BOUNDARY` / `SVG_CLASS_TOKENS` block matches
   `**/src/**/*.ts`. A `<script setup>` block in a `.vue` file is a script ESLint lints —
   and it sits outside every one of those globs, so a vault write or a `konva` import
   from a component would pass `npm run lint` today. Widen the globs to
   `**/*.{ts,vue}` in the same edit that adds the first component, and remember the
   flat-config gotcha CLAUDE.md records: two blocks matching one file OVERRIDE
   `no-restricted-syntax` rather than merging it, so any new `.vue` block must repeat
   the shared selectors.
6. **The mock boundary holds** — the shared `obsidian` mock is for `tests/` and the
   harness. A component that needs it has reached the host from `presentation/`, which
   the widened layer rules refuse; see §5.

## 2. Components

- **`<script setup lang="ts">` and the Composition API, only.** One API style, chosen
  before the first component exists so there is never a migration. Check:
  `vue/component-api-style` (`['script-setup']`) and `vue/block-lang`
  (`script: { lang: 'ts' }`).
- **Multi-word PascalCase names, PascalCase filenames, one component per file.** The
  multi-word rule is Vue's own Priority A (a single word can collide with an HTML
  element); PascalCase in templates is what distinguishes a component from an element at
  a glance. Checks: `vue/multi-word-component-names`,
  `vue/component-name-in-template-casing` (`'PascalCase'`); filename casing is review
  until a `.vue` file exists to prove the rule spelling against.
- **A tightly-coupled child carries its parent's name as prefix** (`ZoneInspector` →
  `ZoneInspectorRow`), and names run general → specific. Review, per Vue Priority B.
- **Type-based prop and emit declarations** — `defineProps<{ … }>()` and
  `defineEmits<{ … }>()`, never the runtime-object form; the interface is the
  documentation and `vue-tsc` is the validator. Checks: `vue/define-props-declaration`
  and `vue/define-emits-declaration` (both `'type-based'`).
- **Keyed `v-for`, and never `v-if` beside `v-for`** — both Vue Priority A, both in
  `flat/essential` (contained in `flat/recommended`).
- **Templates hold simple expressions only.** Anything with logic becomes a `computed`
  with a name, and a complex computed splits into simple ones. Review, guided by
  Priority B.

## 3. Styling: no `<style>` blocks

The general Vue guidance is scoped styles per component. **This project overrides it:
`.vue` files carry NO `<style>` block.** All CSS lives in `styles/` partials, because
that pipeline is load-bearing three ways: the build assembles and caps it, the browser
harness renders the real view against exactly that stylesheet, and Obsidian ships one
`styles.css` per plugin. A second CSS channel inside components would drift from all
three, and the marketplace already rejects inline styles. Components use Obsidian's CSS
variables through classes defined in the partials. Check: `vue/no-restricted-block`
(`'style'`), added with the first component.

## 4. Composables

- **`use*` camelCase naming, in `src/presentation/composables/`.** A composable exists
  to bind reactivity or DOM concerns to a component's lifecycle — which is presentation
  work. A rule about a quantity, a cost or a zone belongs in `domain/`, reached through
  `application/`; putting it in a composable buries node-testable logic inside jsdom.
- **Accept `MaybeRefOrGetter`, normalize with `toValue()`** inside the tracking context
  (`watchEffect`/`watch`), so callers may pass a value, a ref or a getter.
- **Return a plain object of refs**, never `reactive(…)` — destructuring a reactive
  return silently drops reactivity; destructuring refs does not.
- **Every side effect registers its own cleanup** (`onScopeDispose`, or
  `onUnmounted` for DOM listeners). The view is opened and closed many times per vault
  session; a composable that leaks once leaks per open.
- **Call composables synchronously in `<script setup>`** (or another composable), never
  conditionally or in callbacks — Vue needs the active instance to bind lifecycle and
  dispose watchers.

## 5. Pinia

- **Presentation state only** (ADR-005). The vault is the persistent source of truth; a
  store holds selection, tool mode, dialog state — things that die with the view. A
  store never writes the vault: mutations go through `application/` commands to a
  repository in `infrastructure/`, and the widened `WRITE_BOUNDARY` rules (§1.5) are
  the check.
- **Setup stores** (`defineStore('zones', () => { … })`) — they compose with the same
  composables and watchers everything else uses, and this plugin has no SSR to
  complicate them. **Return every piece of state**: Pinia only registers what the setup
  function returns, and an unreturned ref breaks devtools and plugins silently.
- **`use<Name>Store` naming**, matching the composable convention.
- **`storeToRefs()` when destructuring state or getters**; actions destructure freely.
  Without it the destructured binding is a dead copy — the bug is invisible until a
  value stops updating.
- **One Pinia per view app.** SDD §12 mounts an isolated Vue app per Obsidian view;
  each `createApp` gets its own `createPinia()`. State shared BETWEEN views is not
  Pinia's job — it flows through `application/` and events, or it is truth and lives in
  the vault.

## 6. Mounting and lifecycle

SDD §12, plus what the research adds about not leaking:

- `createApp(ViewRoot)` in the view's `onOpen`, mounted on the div the view already
  draws; `app.unmount()` in `onClose`, unconditionally. Unmount is what runs every
  `onUnmounted`/`onScopeDispose` in the tree — skip it and every composable's cleanup
  is skipped with it.
- **The plugin object holds no reference to a view or a Vue app.** A view outlives its
  DOM but not the plugin; a reference on the plugin pins every closed view in memory.
  Obsidian hands the view to whoever asks the workspace.
- **Nothing outside the view knows it is Vue** (CLAUDE.md), and nothing inside reaches
  for the host: components receive what they need — use-case functions, formatted data,
  callbacks — via props or `provide` from the mount point, which is where the
  composition root's wiring ends. The global `app` is a marketplace rejection AND a
  layering hole; the layer rules widened in §1.5 are the check on the import spellings,
  and review covers the global.

## 7. Testing

- **`@vue/test-utils` on jsdom, per file** — the repo's existing pattern (`tests/`
  mirrors `src/`, jsdom opted into per file). Component tests assert behavior at the
  component's contract: props in, emitted events and rendered text out (SDD §73 —
  inspectors, toolbars, dialogs, validation messages). They never assert another
  component's internals through the parent.
- **Logic tests stay node-side.** The return on §4's placement rule: a rule about money
  or geometry is asked of a function in `domain/`, and the component test only proves
  the wiring shows it.
- **Canvas behavior is adapter tests, not component tests** (SDD §74): a polygon's
  points, a transform's emitted command. Geometry correctness is already a unit test.
- **A component test that needs the `obsidian` mock is a defect signal**, not a setup
  chore: it means presentation reached the host. Fix the component, not the test.

## 8. Rule → check, in one place

| Rule | Check |
| --- | --- |
| `<script setup lang="ts">` only | `vue/component-api-style`, `vue/block-lang` |
| Multi-word PascalCase component names | `vue/multi-word-component-names`, `vue/component-name-in-template-casing` |
| Type-based props/emits | `vue/define-props-declaration`, `vue/define-emits-declaration` |
| Keyed `v-for`, no `v-if` with `v-for` | `flat/recommended` (essential tier) |
| No `<style>` block in SFCs | `vue/no-restricted-block` |
| No `obsidian`/`konva` import, no vault write, from a component | §1.5 glob widening of the existing `forbidden()` / `WRITE_BOUNDARY` blocks |
| SFC scripts type-check | `vue-tsc -noEmit` in `build` |
| Prefixed child names, simple template expressions, `storeToRefs`, cleanup registration | review, guided by this file |

The last row is honest: those four have no mechanical check, and the sentence says so
rather than letting the table imply eight gates where there are seven.

---

## Sources

- [Vue style guide — Priority A (essential)](https://vuejs.org/style-guide/rules-essential.html)
  and [Priority B (strongly recommended)](https://vuejs.org/style-guide/rules-strongly-recommended.html)
- [Composables — official conventions](https://vuejs.org/guide/reusability/composables.html)
- [Using Vue with TypeScript](https://vuejs.org/guide/typescript/overview.html) (vue-tsc, tsconfig)
- [eslint-plugin-vue user guide](https://eslint.vuejs.org/user-guide/) (flat configs, TS parser wiring)
- [Pinia — defining stores](https://pinia.vuejs.org/core-concepts/) (setup stores, storeToRefs, return-all-state)
- [Vue application API — unmount](https://vuejs.org/api/application) and the Vue 2-era but
  still-accurate [avoiding memory leaks cookbook](https://v2.vuejs.org/v2/cookbook/avoiding-memory-leaks.html)
