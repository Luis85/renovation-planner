# Design Slice 1: Plugin Bootstrap & Composition Root

## Purpose

This slice builds the seam between Obsidian and the plugin's own layered architecture: the
entry point, the single place dependencies are wired together, one workspace view that
opens and closes reliably, settings persistence, and the build/lint/test scaffolding every
later slice is checked against.

It is the only slice with no domain content. Its entire job is to make the dependency rule
(SDD §8) a fact the toolchain enforces — before slice 2 writes the first line of code that
could violate it. Getting the lint rules and the composition seam right here means every
later slice adds to an already-guarded structure instead of retrofitting one.

Maps to SDD Increment 1 — Plugin Foundation (§91). Its stated success criterion:

> Empty Renovation Planner view opens reliably inside Obsidian.

## Scope

### In scope

- The plugin entry point: `src/main.ts` (bundle entry, re-exports the default) and
  `RenovationPlannerPlugin` (`onload`/`onunload`) — SDD §9.
- The composition root: `src/plugin/composition-root.ts` — the one place dependencies are
  composed (SDD §10), even though at this slice it composes only settings. Its shape
  reserves the extension points (`repositories`, `services`, `eventBus`, `queries`) that
  slices 2, 4, and 9 fill in without moving the seam.
- Registering the empty **Renovation Project** workspace view (SDD §11) and the one
  `revealView` activation path shared by every entry point (ribbon icon, command).
- The `Logger` port (`application/ports/Logger.ts`, SDD §67's four levels) and its one
  console-backed adapter (`infrastructure/logging/`), composed into the root and called
  by `onload`/`onunload` — because bootstrap is the first code that can fail and today
  has nowhere to say so. The `no-console` ban that makes "everything logs through the
  port" a lint failure rather than a convention comes with it.
- The Vue mounting strategy (SDD §12, ADR-004): an isolated Vue app — `createApp()` with its
  own Pinia instance — created per Obsidian `ItemView` in `onOpen` and unmounted in
  `onClose`. At this slice the mounted root has no real content; it exists to prove the
  lifecycle before slice 5 gives it something to draw.
- Plugin settings persistence: `loadData`/`saveData`, the pure `settingsFrom` merge, and the
  declarative `SettingsTab` (SDD §15: default units, default folders, editor preferences —
  only `units` exists today; a field arrives when a feature reads it).
- The Vite build (`vite.config.ts`), the Vitest suite and coverage ratchet
  (`vitest.config.ts`), and `tsconfig.json` — SDD §5, §77.
- The layer-dependency rule enforced by ESLint `no-restricted-imports`, before any file
  exists in `core/`, `domain/`, or `application/` for it to catch (SDD §8, §76; ADR-006).

### Out of scope (covered by other slices)

- Domain entities, value objects, and business rules (`core/`, `domain/`) — slice 2 (Core
  Primitives), slice 3 (Domain Foundation: Project, Plan, Zone).
- Repositories, the persistence boundary, and sidecar files — slice 4.
- Canvas rendering, Konva scene structure, and real editor chrome — slice 5.
- Editor tools, undo/redo, and the inspector — slice 6.
- The event bus's *implementation* (`core/events/`) and the domain event catalog — slice 2;
  this slice only reserves where the composition root will hold the bus once it exists.
- Bases views (SDD §13) and any workspace view beyond the one named in Increment 1 — later
  increments, explicitly deferred per `docs/design/README.md`.
- Everything about logging *except* the port, the console adapter and this slice's own
  calls — slice 11. What to log at which level across the codebase, the pairing with the
  Error Boundary (every mapped `AppError` logged with its cause), exception mapping,
  `ToUserMessage`, diagnostics, and a file-backed sink are all its. This slice gives the
  plugin somewhere to log; that slice says what the rest of the codebase must log.

## Dependencies

- No earlier slice — this is the foundation every other slice in the map builds on.
- ADR-004 (Vue 3 for Plugin UI) — governs the mounting strategy this slice establishes.
- ADR-006 (Plain TypeScript Domain) — governs the lint rules this slice adds; there is no
  domain code yet for them to guard, but the rule must exist before there is.
- Obsidian API floor: `manifest.json`'s `minAppVersion` (1.13.0), pinned because the
  settings tab relies on the declarative `getSettingDefinitions()` contract 1.13 introduced.

## Design

### Bootstrap order

The entry point stays thin — no domain logic, no scanning at startup. `onload` follows the
SDD's stated order (§9); `onunload` is its reverse, added the day something first needs
disposing rather than pre-emptively:

```text
RenovationPlannerPlugin

onload()
 ├── create logger                    (createConsoleLogger — see below; not a §9 step)
 ├── load settings                    (loadData → settingsFrom)
 ├── initialize composition root      (createCompositionRoot(settings, logger))
 ├── register workspace views         (registerView)
 ├── register commands                (addCommand, addRibbonIcon)
 └── register vault listeners         (deferred — nothing reads the Vault yet)

onunload()
 ├── flush pending writes             (deferred — nothing writes yet)
 ├── stop listeners                   (deferred)
 └── dispose services                 (deferred — a console sink has nothing to close;
                                       a file-backed one, if slice 11 adds it, is what
                                       first puts a real step here)
```

The logger is deliberately **ahead of** §9's first step rather than inside its list: it is
not one of the things bootstrap sets up, it is what the setup steps report through, and a
step that can fail needs it to already exist. `loadData()` is the first such step.

`registerView`, `addRibbonIcon`, and `addCommand` are unregistered by the `Plugin` base
class itself; an `onunload` that only repeats what the base class already does is a place
for a future mistake to hide, so it is added only when a real resource needs releasing
(slice 4's repositories, most likely). Settings load first because every later registration
step may need to read them.

Bases-view registration and project-index initialization (also named in SDD §9's `onload`
list) have nothing to register against yet — no Bases view and no index exist before slices
4 and later — so they are not called out as separate steps here; they join the sequence
when their slice lands.

### Composition root

The SDD names five things a composition root composes (§10): repositories, application
services, the event bus, query services, and settings. At this slice, settings and the
logger exist — so the root is a thin, explicitly-typed object rather than a container
pre-loaded with placeholders for services that would otherwise have to be faked:

```typescript
// src/plugin/composition-root.ts
export interface CompositionRoot {
  // `null` when data.json could not be READ — not when it is absent, which is a fresh
  // install and loads defaults normally. Deliberately not "defaults on failure": once
  // slice 4 puts folder paths in here, a default is a different location, not a milder
  // version of the user's. See "Logging" for the full argument and the rules it implies.
  readonly settings: RenovationPlannerSettings | null;
  // Not one of §10's five, and held here for the reason slice 11 states as a contract:
  // the Logger is injected via the composition root like any other Application port.
  // If the root did not hold it from its first version, the injection point would have
  // to move later — and this seam is extended by a field, never relocated.
  readonly logger: Logger;
  // readonly eventBus: EventBus;                — arrives with slice 2 (Core Primitives)
  // readonly repositories: RepositoryRegistry;  — arrives with slice 4 (Persistence Layer)
  // readonly services: ApplicationServices;     — arrives with slice 4 / slice 9
  // readonly queries: QueryServices;            — arrives with slice 4
}

// The logger is a PARAMETER, not something this function constructs: it has to exist
// before the settings load that may fail, and that happens before this call.
export function createCompositionRoot(
  settings: RenovationPlannerSettings | null,
  logger: Logger,
): CompositionRoot {
  return { settings, logger };
}
// When slice 4 adds repositories, the index and query services, this function composes
// them only when `settings !== null` — a service that reads or writes a configured
// location has no correct behaviour without the configuration that names it.
```

This is the one seam every later slice extends: a new field and a new constructor
parameter, never a second wiring point elsewhere in the plugin. `RenovationPlannerPlugin`
holds one `root: CompositionRoot` field instead of holding `settings` directly, so a view or
the settings tab reaches persisted state through `plugin.root.settings` — one path in, not
two that could drift.

`plugin/` — the composition root included — is the only layer allowed to import from every
other layer (core, domain, application, infrastructure, presentation). That is the entire
reason the inner layers can stay ignorant of Obsidian: something has to know how to build a
`ZoneRepository` from an `App`, and it is this file, not `domain/zone/`.

### Logging, from the first line that can fail

Slice 11 owns logging *policy* and already states the wiring as a contract — "`Logger` is
injected via the composition root (slice 1) like any other Application port". The port
itself therefore cannot arrive in slice 11 without the root having to be re-opened to hold
it, and the root is the one seam this slice promises every later slice extends by a field
rather than moves. The blunter reason is this slice's own: `onload` can fail — `loadData()`
is an I/O call, `registerView` runs before anything has validated the layout — and until
there is a logger, a bootstrap that fails does so with nothing written down anywhere the
plugin controls.

**Where the port lives: `application/ports/`,** beside the repository ports slice 3 adds.
Not `infrastructure/logging/`, which SDD §7.4 names as the home of the *implementation*: a
port living there would force every application-layer caller to import `infrastructure/`,
which is exactly the direction §8 forbids. Not `core/` either, and that placement is worth
refusing explicitly — a port in `core/` is reachable from `domain/`, and domain code in
this codebase does not log. A pure entity returns a `Result` and its caller decides what to
record; the layer ADR-006 keeps free of frameworks should not gain a side-effecting
dependency because it was convenient to reach.

**One implementation, console-backed.** `createConsoleLogger(minLevel)` in
`infrastructure/logging/` is the whole of it. Two properties earn that choice rather than a
file sink: it keeps "no Vault access of any kind in this slice" true (see Persistence
Impact), and its construction cannot fail — which matters precisely because it is
constructed first, and a logger that needed I/O to exist could fail at the one moment a
failure most needs reporting. A file-backed sink, if slice 11 adds one, replaces the
adapter and leaves the port and every call site alone; it is also what would put the first
real step into `onunload`.

**Four levels, because §67 fixes four**, and this slice calls two of them:

| Level | Console method | This slice's use |
| --- | --- | --- |
| `debug` | `console.debug` | one line per bootstrap step, load and unload included — dropped by the default threshold, per slice 11's "off by default" |
| `info` | `console.debug` | no caller here; slice 11's rare notable transitions (a migration ran, the project index was rebuilt) |
| `warn` | `console.warn` | no caller here; slice 11's recovered-from cases (a repaired index entry, a regenerated sidecar) |
| `error` | `console.error` | a bootstrap step that failed — today only the settings load, since it is the only one that does I/O |

**"Plugin loaded" is a `debug` line, not an `info` one**, and that is the publishing
guidance rather than taste: `docs/setup/publishing.md` lists "console noise: logging that is
not an actual error path" among the rejections only review catches, and a plugin that
announces itself on every start is the plainest instance of it. The distinction that
survives is *rarity*, not importance — `info` is for something that happened once and
would be worth having in a support thread; a line that is always there tells a reader
nothing. Together with the threshold below, that leaves a released build printing nothing
at all unless something actually failed.

**`info` does not map to `console.info`, and that is a lint constraint rather than a
preference.** The `eslint-plugin-obsidianmd` ruleset carries its own console rule for the
"avoid unnecessary logging to console" marketplace guideline, and it is narrower than it
sounds: measured against this repository's own config, `console.log` and `console.info`
fail it while `console.debug`, `console.warn` and `console.error` pass. The ban below on
the rest of `src/` is ours and can be carved out; that one is the ruleset's, whose rules
this project cannot disable inline (its own rule forbids that), so an adapter that reached
for `console.info` would fail `npm run lint` no matter what our block said. `info` and
`debug` therefore share a console method, and the level a line was written at is carried in
the line's own prefix rather than by which function printed it — which is what a reader
greps for anyway. `warn` and `error` keep their own methods, so the two levels a developer
filters devtools by stay distinguishable there.

The threshold is an argument to the adapter, not a setting: the composition root passes
`'info'`, so this slice's `debug` calls compile and emit nothing, while the levels slice 11
adds still reach a released build where they are worth having. A user-facing switch to raise it
belongs with slice 11's diagnostics work — "copy diagnostics" and "turn on verbose
logging" are the same conversation — and this slice does not add a settings field no
feature reads yet.

**Having caught the one failure, this slice has to say what follows it — and "carry on
with defaults" is the wrong answer.** It is tempting because it is true *today*: the only
setting is `units`, and a display preference falling back to metric costs nothing. It stops
being true at slice 4, which puts **locations** in settings — the project folder, and per
ADR-0011 the geometry sidecar folder. Defaults are then not a degraded version of the
user's configuration, they are a different place on disk: an index built on them scans
folders the projects are not in, so existing work reads as missing, and anything written
lands in a parallel tree beside it. A setting that names a path is not a preference, and a
fallback that is harmless for a preference is a data-loss path for a location.

So a failed read produces no settings at all, and the type is what says so:

```typescript
readonly settings: RenovationPlannerSettings | null;   // null === could not be read
```

Every consumer then has to face the case. That is the point rather than a cost: code that
wants a default for a display preference writes `?? DEFAULT_SETTINGS` and is visibly
choosing it, while code that needs a folder path cannot be handed a plausible wrong one.

The line at the boundary is sharp and worth stating, because the two look alike from
inside `onload`: `loadData()` **resolving** `null` is a fresh install, not a failure —
`settingsFrom(null)` returns defaults and the plugin is fully configured. Only a
**rejection** is unrecovered.

Three rules follow, each a check rather than an intention:

- **No write for the whole session, not only at bootstrap.** `saveSettings()` refuses while
  `settings === null` — it makes no `saveData` call — so a transient read failure cannot
  stamp defaults over a `data.json` that is sitting there intact. Bootstrap is not the only
  writer, though, and the other one is the trap: the settings tab writes on every control
  change. While unrecovered it therefore offers no controls — `getSettingDefinitions()`
  returns an empty array, which is exactly the case 1.13 falls back to `display()` for, and
  that fallback renders what happened and what to do about it. Two independent guards, and
  the second is what makes the first hold for a control nobody has written yet.
- **Nothing that reads or writes a configured location is composed.** The composition root
  is where those services are wired, so it is where they can be left unwired: while
  settings are unrecovered the root composes no repositories, no project index, and no
  query services. None of them exist yet — they arrive with slice 4 — which is why the
  rule is stated here rather than there, in the same "before it can be broken" spirit as
  the lint rules below. The plugin still loads, the view still opens, and the failure is
  visible in the one place a user would look.
- **Recovery is a reload, not a repair UI.** Fixing or removing `data.json` and toggling
  the plugin re-runs `onload` and the load either succeeds or does not. Nothing in this
  slice attempts a re-read on a timer, and nothing writes a replacement file, because both
  amount to guessing at data the user still has.

This is one call site's decision, not the Error Boundary — mapping exceptions to typed
`AppError`s and routing them to a surface is slice 11's and slice 17's, and they arrive
after this line already exists. What they will add is where the failure shows up beyond
the settings tab; what they cannot add later is the refusal to write.

**One instance, and the check that keeps it one.** `onload` constructs the logger once and
hands it to `createCompositionRoot`; everything else reads `root.logger`. That is the same
"one path in, not two that could drift" rule the root already applies to settings. What
makes it hold for code not yet written is not this paragraph but `no-console`: it is an
error across `src/` with **no** allowances — `console.error` included, since the only
reason to permit that one was that there was nothing else to call — and
`infrastructure/logging/**` is the single carve-out, the directory whose job is the
console. It covers what the config matches: `.ts` today, and `.vue` from the edit that
adds Vue, which is where a stray `console.warn` is most likely to be written and the
reason that edit widens every block rather than this one. A second logger, or a view that
decides to report its own failure to the console, fails
`npm run lint` rather than review. The carve-out is a per-directory block that *overrides*
`no-console` for those files rather than merging with it — the same flat-config behaviour
the `no-restricted-syntax` blocks have to work around, working in our favour here, and the
reason that block sets that one rule and nothing else.

### Workspace view registration

One view this slice: the **Renovation Project** view (SDD §11 lists it first; Budget,
Schedule, Procurement, Dashboard are future work outside this slice and outside the current
increment).

```text
RENOVATION_PROJECT_VIEW = 'renovation-project'   // persisted view-type string

RenovationProjectView extends ItemView
 ├── getViewType()    → RENOVATION_PROJECT_VIEW
 ├── getDisplayText() → translated display name
 ├── getIcon()        → 'hammer'
 ├── onOpen()         → mount point created; isolated Vue app mounted (see below)
 └── onClose()        → Vue app unmounted; mount point emptied
```

The view type is *data*, not text: Obsidian persists it in the workspace layout, so renaming
it orphans every leaf a user already has open — the same reason a command id, once shipped,
does not change either.

Every way of opening the view — ribbon icon, command palette, and any future toolbar entry
— calls one function, `revealView(workspace, type)`, rather than each re-implementing
"find or create a leaf." `revealView` takes the view type as a plain string, never importing
`presentation/`, because `infrastructure/` may not reach up past `application/`
(§8) — the composition root is the one place that knows which view string maps to which
view class, and it is the composition root (via the plugin class) that wires the two
together in `registerView`.

### Vue mounting strategy

Per ADR-004, each Obsidian `ItemView` mounts its own isolated Vue application — not one
long-lived app shared across views:

```text
Obsidian ItemView (onOpen)
      │
      ▼
createApp(ViewRoot)
      │
      ├── new Pinia()  →  app.use(pinia)
      └── ViewRoot.vue (root component)
      │
      ▼
app.mount(contentEl mount point)


Obsidian ItemView (onClose)
      │
      ▼
app.unmount()
```

At this slice, `ViewRoot.vue` has no real content — the increment's success criterion is
literally an *empty* view opening reliably. What this slice proves is the lifecycle: mount
on open, unmount on close, one Pinia instance per view rather than a shared singleton, and
the mount point is `contentEl` (not `containerEl`, which carries Obsidian's own view chrome
— header and tab actions — and would be emptied along with it).

Vue and Pinia are added as dependencies in this slice; `vue-konva` and Konva are not —
those arrive with the canvas (slice 5, ADR-003).

`@vueuse/core` is in the SDD's §5 UI stack and is **not** added here, because nothing in
this slice or any later one imports it yet. CLAUDE.md's rule is unambiguous — installing a
dependency nothing imports fails `npm run analyze`, so each arrives with its first real use
— and an earlier draft of this paragraph listed `@vueuse/core` among the arrivals two lines
above restating that very rule. The SDD names the stack this plugin is heading for; it does
not schedule the install. When a composable reaches for `useEventListener` or
`useResizeObserver`, it arrives in that slice's pull request.

Adding Vue is **not** one line in `vite.config.ts`. An earlier draft of this paragraph said
`@vitejs/plugin-vue` goes into that file's `plugins` array and "nothing else about the build
config changes", which is wrong twice over: `docs/setup/vue-conventions.md` §1 is the
arrival checklist for exactly this moment, and CLAUDE.md states two of its items directly
("`@vitejs/plugin-vue` is one line in **both** Vite configs, and `tsc` becomes `vue-tsc` in
the same edit"). An implementer following the old sentence would ship a `ViewRoot.vue` the
browser harness cannot compile and no type gate ever reads. The full edit, in this slice's
own pull request:

- **`@vitejs/plugin-vue` in all THREE configs that transform source** — `vite.config.ts`,
  `vite.harness.config.ts`, and `vitest.config.ts`. `vue-conventions.md` §1 says "both Vite
  configs" because the project it was written for had two; this repository has a third
  Vite-powered surface, and its own standalone `vitest.config.ts` (`defineConfig` from
  `vitest/config`, no `mergeConfig`) is where every test runs. Without the plugin there,
  importing an SFC fails at parse — before the lifecycle test executes and before coverage
  can measure anything, so the failure is not even a red assertion, it is a file that will
  not load. Each omission is invisible in a different place: the build one at `npm run
  build`, the harness one at `npm run harness`, the Vitest one at `npm test`.
- **`tsc -noEmit` becomes `vue-tsc -noEmit` in `build` AND in `test-build`**, and
  `tsconfig.json`'s `include` gains `src/**/*.vue`. Vite transpiles SFCs without
  type-checking them, so `vue-tsc` is the only command-line type gate a `.vue` file gets —
  omit it and `npm run check` reports success over code nothing type-checked. `test-build`
  needs the same substitution and is easy to miss because it is not in `check`: it opens
  with its own `tsc -noEmit`, so changing only `build` leaves the one command that produces
  a loadable vault build failing on the first SFC — an implementer green on `npm run check`
  and blocked the moment they try to look at their work in Obsidian.
- **`vitest.config.ts`'s `coverage.include` gains `.vue`** — `src/**/*.{ts,vue}`. The
  coverage floors are ratcheted and they are one of the four gates, so an SFC outside the
  include is a file whose untested branches cost nothing: component tests run, the numbers
  do not move, and the gate passes over code it never measured. A gate that silently stops
  covering a whole file type is worse than one that never covered it, because the number
  still looks like an answer.
- **`eslint-plugin-vue`'s flat configs**, with `parserOptions.parser` set to the TypeScript
  parser on the `**/*.vue` block so `<script setup lang="ts">` parses, alongside the glob
  widening described under Lint below. Those are two separate needs met in one edit: the
  Vue ruleset, and this project's own architecture blocks learning to match `.vue`.
- **`@vue/test-utils`**, since the first component arrives with the first component test.

`fallow` fails on an installed dependency nothing imports, so none of these can land ahead
of the file that uses them — which is why they land here, with `ViewRoot.vue`, and not
earlier.

Vue components belong to `presentation/` only. Domain and Core must never depend on `vue` or
`pinia` — enforced by the same lint rules described below, not by convention (ADR-004,
ADR-006).

### Settings persistence

Settings are the one piece of persisted state this slice touches. The plugin shell is the
only layer allowed to call `loadData`/`saveData` — everything else reads
`plugin.root.settings` or writes through `saveSettings()`.

```text
onload():  raw  = await this.loadData()            — rejects → logger.error, settings := null
           this.root = createCompositionRoot(raw === REJECTED ? null : settingsFrom(raw), logger)
saveSettings(): this.root.settings === null → refuse, no saveData call
                otherwise                   → this.saveData(this.root.settings)
```

`settingsFrom` is a pure merge over defaults, not a spread: `data.json` is a file a user can
hand-edit, so it is a trust boundary. Each field is read through its own validator
(`unitsFrom`), an unrecognized value falls back to the default, and a key this version does
not declare is dropped — on the way in and on the way out — rather than carried forward for
the life of the file. Being pure, it is tested with plain node tests, with no Obsidian
runtime involved.

The settings tab (`SettingsTab`) is declarative — `getSettingDefinitions()`,
`getControlValue()`, `setControlValue()` — which is what Obsidian 1.13+ renders from and
indexes for the settings search; `display()` is called only when the definitions array is
empty. It lives under `plugin/settings/`, not `presentation/`, because it needs the plugin
instance directly to read and write settings, and `presentation/` may not import `plugin/`.

### Build, lint, and test wiring

```text
vite.config.ts     — bundles src/main.ts to dist/main.js (CJS, named exports), external:
                      obsidian/electron/CodeMirror + Node builtins Obsidian provides
vitest.config.ts   — aliases 'obsidian' to a small mock; coverage floors ratchet upward,
                      never down, as each increment finishes
tsconfig.json       — strict: true, noImplicitAny, strictNullChecks (SDD §81 TypeScript
                      Rules — the baseline every later slice's code is written against)
```

`npm run check` (`build && lint && test:coverage && analyze`) is the single command CI runs,
verbatim, on both Ubuntu and Windows. This slice is what makes that command meaningful
before there is any domain code for it to check — a build that produces an empty plugin, a
lint pass with zero violations because there is nothing yet to violate, and a test suite
whose only assertions are about bootstrap wiring.

### Layer-dependency rule, enforced before it can be broken

The SDD's dependency rule (§8):

```text
Presentation → Application → Domain → Core        (valid)
Infrastructure → Application (its ports) → Domain  (valid)
Domain → Obsidian                                  (invalid)
Geometry Engine → Konva                            (invalid)
Cost Engine → Pinia                                (invalid)
```

§76 asks for automated restrictions — `domain/** may not import vue, pinia, konva,
obsidian` — and names two candidate tools: ESLint import restrictions, or
`dependency-cruiser`. This slice picks **ESLint `no-restricted-imports`**, per ADR-006's own
text and the pattern already established in this repository's `eslint.config.mjs`: one rule
factory (`forbidden(layer, { groups, packages }, reason)`) generates a per-directory block
for each layer, banning both sibling layers (`group` patterns, including the barrel
spelling once a directory grows an `index.ts`) and named packages (plus their subpaths,
e.g. `vue/dist/*`).

```text
core           may not import: domain, application, infrastructure, presentation, plugin
                              + vue, pinia, konva, vue-konva, obsidian
domain         may not import: application, infrastructure, presentation, plugin
                              + vue, pinia, konva, vue-konva, obsidian
application    may not import: infrastructure, presentation, plugin
                              + vue, pinia, konva, vue-konva, obsidian
infrastructure may not import: presentation, plugin
                              + vue, pinia, konva, vue-konva            (obsidian is its job)
presentation   may not import: infrastructure, plugin
```

A second rule bans DOM globals (`window`, `document`, `fetch`, `HTMLElement`, ...) in
`core/` and `domain/` directly — §3.4 prohibits DOM APIs there too, not only the framework
packages that wrap them.

A third bans `console.*` everywhere under `src/`, with `infrastructure/logging/**` carved
out as the one place a console call is the point rather than a bypass (see "Logging" above).

**Every block above is `.ts`-scoped, and the presentation layer will not be.** That is fine
while `src/` is all TypeScript and stops being fine at this slice's own `ViewRoot.vue`: a
rule set that ends at `.ts` exempts precisely the layer whose imports the dependency rule
constrains most, and a component is the likeliest place for both a direct repository import
and a stray `console.warn`. So the edit that adds `vue` and `@vitejs/plugin-vue` also adds
`vue-eslint-parser` — with the TypeScript parser configured for `<script lang="ts">` blocks
— and widens every `src/` block's `files` to match `**/*.vue` alongside `**/*.ts`: the
layer bans, the write-boundary selectors, the DOM-globals ban, the size budgets and
`no-console`, not a Vue-specific subset of them. One edit, because the gap opens the moment
the first `.vue` file exists rather than at some later point worth scheduling. Until then
`src/**/*.ts` is all of `src/`, and every guarantee below is scoped to what the config
actually matches.

This rule set is committed and passing in Increment 1 with almost nothing yet to exercise
it: `core/` and `domain/` are empty, and `application/` holds one file — `ports/Logger.ts`,
an interface with no imports of its own. The rules exist for the first file slice 2 adds,
not for any file that exists today, and the logging carve-out matches a directory that has
exactly one file in it for the same reason: enforce before it can be broken.

**`dependency-cruiser` is not adopted**, and this is the decision every later slice
inherits rather than re-opens (slice 12 in particular states the same conclusion): ESLint
already runs on every commit via `npm run lint`, integrates with the existing flat config,
and needs no second tool or second CI step. The one guarantee it would add that
`no-restricted-imports` cannot give is the *indirect* case — `domain/` importing an
inner-layer helper that itself imports `obsidian`. Two things already narrow that gap:
`npm run analyze` (fallow) reports dependency hygiene across the graph, and slice 12's
node-profile test suite fails on a DOM global reached through any depth of import. If a
real indirect violation ever survives both, that is the trigger to add a graph-level
check — not a rule written ahead of a demonstrated hole.

## Interfaces & Contracts

```typescript
// src/plugin/RenovationPlannerPlugin.ts
export default class RenovationPlannerPlugin extends Plugin {
  root: CompositionRoot;
  async onload(): Promise<void>;
  saveSettings(): Promise<void>;
  private openProject(): Promise<void>;
}

// src/plugin/composition-root.ts
export interface CompositionRoot {
  readonly settings: RenovationPlannerSettings;
  readonly logger: Logger;
}
export function createCompositionRoot(
  settings: RenovationPlannerSettings,
  logger: Logger,
): CompositionRoot;

// src/application/ports/Logger.ts — SDD §67's four levels, and the whole port. `event` is
// a stable dot-delimited key ('settings.load.failed'), not a sentence: it is what a reader
// greps for and what a test asserts on, while `context` carries the values. Slice 11's
// rules for which level a given event takes, and for logging every mapped AppError with
// its cause, attach to this interface without changing it.
export interface Logger {
  debug(event: string, context?: Record<string, unknown>): void;
  info(event: string, context?: Record<string, unknown>): void;
  warn(event: string, context?: Record<string, unknown>): void;
  error(event: string, context?: Record<string, unknown> & { cause?: unknown }): void;
}
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// src/infrastructure/logging/consoleLogger.ts — the only implementation this slice builds.
// Returns void and never throws: a call site that had to handle a logging failure would
// have two failures to report and no way to report either.
export function createConsoleLogger(minLevel: LogLevel): Logger;

// src/plugin/settings/settings.ts
export const UNITS: readonly ['metric', 'imperial'];
export type Units = (typeof UNITS)[number];
export interface RenovationPlannerSettings { units: Units }
export const DEFAULT_SETTINGS: RenovationPlannerSettings;
export function settingsFrom(raw: unknown): RenovationPlannerSettings;

// src/plugin/settings/SettingsTab.ts
export class SettingsTab extends PluginSettingTab {
  getSettingDefinitions(): SettingDefinitionItem[];
  getControlValue(key: string): unknown;
  setControlValue(key: string, value: unknown): Promise<void>;
}

// src/presentation/views/RenovationProjectView.ts
export const RENOVATION_PROJECT_VIEW: string;
export class RenovationProjectView extends ItemView {
  getViewType(): string;
  getDisplayText(): string;
  getIcon(): string;
  onOpen(): Promise<void>;   // mounts the isolated Vue app
  onClose(): Promise<void>;  // unmounts it
}

// src/infrastructure/obsidian/workspace/revealView.ts
export function revealView(workspace: Workspace, type: string): Promise<void>;
```

Module boundaries this slice fixes for every later one:

- `plugin/` is the only directory allowed to import from every layer. Nothing else may
  import `plugin/`.
- `infrastructure/` takes the view type as a string, never importing `presentation/`
  directly — the composition root is what knows the mapping between a type string and a
  view class.
- A settings tab lives beside the settings it edits (`plugin/settings/`), not in
  `presentation/`, because it needs the plugin instance.
- A port is an `application/ports/` interface and its implementation is an
  `infrastructure/` module — `Logger` is the first pair, and the shape slice 3's
  repositories repeat. The direction that makes it work is `infrastructure/ →
  application/ports`, never the reverse.

## Persistence Impact

- **Reads/writes:** plugin `data.json` only, via Obsidian's `loadData`/`saveData` — the
  settings object (`{ units: 'metric' | 'imperial' }`). No Vault files, no sidecars, no
  frontmatter.
- **No Vault access of any kind** in this slice: no repositories exist, and the write-safety
  lint rules (`no-restricted-syntax` on `vault.*`/`adapter.*` write methods and
  `processFrontMatter`) apply from this slice onward even though nothing yet calls them —
  the same "enforce before it can be broken" reasoning as the layer rule.
- **The logger persists nothing.** Its sink is the developer console, so this slice adds no
  file, no plugin-data key, and nothing to exclude from a project export. A file-backed
  sink is slice 11's call, and the constraint it inherits is already written there: a log
  is plugin-local operational data, never part of the Markdown-native project record.
- Settings persistence is a trust boundary: `settingsFrom` treats `data.json` as
  attacker-adjacent input (a user can hand-edit it, or it can be a stale/downgraded file
  from an older version) and validates every field rather than trusting its shape.

## Testing Strategy

- **Bootstrap wiring** (`tests/plugin/registration.test.ts`, jsdom environment, against the
  `obsidian` module mock): asserts what `onload` registers — one view under its persisted
  type, one ribbon button, one command with an unprefixed id — and that both entry points
  (ribbon, command) open the same single leaf rather than each opening its own tab. This is
  exactly the wiring that breaks silently, so it is driven against a fake `Workspace`
  (`FakeWorkspace`/`FakeLeaf`) rather than trusted by inspection.
- **Logger** (`tests/infrastructure/logging/consoleLogger.test.ts`): against a stubbed
  console — the one suite that touches one at all. A `'info'` logger emits `info`, `warn`
  and `error` and drops `debug`. The level each line was written at appears in the line
  itself, asserted on the emitted text: `info` and `debug` share `console.debug` (see the
  ruleset constraint above), so a test that only checked which console method was called
  could not tell an `info` from a `debug` at all, and level filtering downstream would rest
  on nothing. `warn` and `error` additionally reach their own methods, and `error` passes
  `cause` through untouched rather than stringifying it at the boundary.
- **Bootstrap logging** (in `tests/plugin/registration.test.ts`, driven with a fake
  `Logger` — the assertions are on the port, never on a console, since what the adapter
  does with a call is the suite above's subject): the composition root exposes **the same
  instance** `onload` constructed, asserted by identity, because two different loggers both
  satisfy a shape assertion and "one instance" is the property that matters. And the
  failure path: a `loadData()` that rejects produces exactly one `error` event, the view
  and command still register, and `root.settings` is **`null`** rather than
  `DEFAULT_SETTINGS` — asserted as null specifically, since a test written against
  "defaults are present" passes against the version that hands a wrong folder path to
  slice 4. A companion case asserts the happy path logs nothing above `debug`, which is the
  shape of the console-noise rejection and is invisible to a test that only counts calls.
- **Unrecovered settings** (`tests/plugin/settings/`): with `root.settings === null`,
  `saveSettings()` makes no `saveData` call and `getSettingDefinitions()` returns `[]` —
  the two writers, asserted independently, because either one alone still overwrites the
  file the user still has. The `loadData()`-resolves-`null` case is asserted beside them as
  the opposite outcome: a fresh install loads `DEFAULT_SETTINGS`, saves normally, and
  renders its controls. A single test that only drove "no settings" would treat the two
  identically, which is the confusion the boundary exists to prevent.
- **Settings** (`tests/plugin/settings/settings.test.ts`): plain node tests (no Obsidian
  runtime) driving `settingsFrom` against every shape `loadData` can hand back — `null`
  (fresh install), a stored partial, a value outside the vocabulary, an unknown key, junk
  input (`'not an object'`, `42`) — since `data.json` is user-editable and each of those is
  a shape, not a hypothesis.
- **Settings tab** (`tests/plugin/settings/settingsTab.test.ts`): the declarative contract —
  `getSettingDefinitions()` returns the units dropdown; `getControlValue`/`setControlValue`
  round-trip through `settingsFrom`, so an invalid value written by a future control still
  falls back rather than reaching `data.json`.
- **View activation** (`tests/infrastructure/obsidian/workspace/revealView.test.ts`):
  `revealView` reuses an existing leaf of the given type rather than opening a second one,
  and reveals it either way.
- **View mount lifecycle** (new for this slice, `tests/presentation/views/`): a Vue app is
  created and mounted in `onOpen`, and unmounted in `onClose`, using `@vue/test-utils` per
  ADR-004 — asserted against the mount point rather than against Konva or any real content,
  since there is none yet.
- **Build/config plumbing** (`tests/build/`): the `obsidian` alias literal in
  `vitest.config.ts` and `vite.harness.config.ts` is pinned together
  (`config-alias.test.ts`) so the two cannot silently drift; UTF-8/no-BOM encoding on
  checked-in config and manifest files is asserted directly (`encoding.test.ts`), since a
  BOM'd `manifest.json` breaks `JSON.parse` with an error pointing nowhere near the cause.
- **Architecture rule** — verified by `npm run lint` itself, not a separate suite: the layer
  bans are `no-restricted-imports` entries, which ESLint checks on every run. There is
  nothing under `core/`/`domain/`/`application/` yet for a violation to appear in, so this
  slice's Definition of Done requires the rule to exist and `npm run lint` to pass clean,
  not that it has yet caught anything.
- Coverage floors (`vitest.config.ts`) ratchet up from this slice's own measured figure — a
  covered unit of headroom below 100%, never lowered, only raised as later slices add
  covered code.

## Definition of Done

- [ ] `RenovationPlannerPlugin.onload()` loads settings, builds the composition root,
      registers the Renovation Project view, and wires both the ribbon icon and the command
      to the same `revealView` call — in the order SDD §9 states.
- [ ] `src/plugin/composition-root.ts` exists, exporting `CompositionRoot` and
      `createCompositionRoot`; the plugin holds one `root: CompositionRoot` field rather
      than a bare `settings` field.
- [ ] `onload()` constructs exactly one `Logger` — before every other step, so the first
      step that can fail already has one — and hands it to `createCompositionRoot`;
      `plugin.root.logger` is that same object, asserted by identity. A successful load
      and unload emit nothing above `debug`, so a released build is silent unless
      something failed.
- [ ] `createConsoleLogger('info')` emits `info`/`warn`/`error` and drops `debug`, with
      the level named in the emitted line; `warn`/`error` use `console.warn`/`console.error`
      and neither `console.log` nor `console.info` appears anywhere in `src/`, since the
      `obsidianmd` ruleset fails both and cannot be suppressed inline. `error` forwards its
      `cause` untouched.
- [ ] A `loadData()` that rejects logs one `error` event and leaves `root.settings` as
      `null` — never `DEFAULT_SETTINGS` — with the view and command still registered. For
      as long as it stays null, `saveSettings()` makes no `saveData` call and
      `getSettingDefinitions()` returns `[]` so the tab offers no control that could:
      a failed read never becomes a write, at bootstrap or later in the session. A
      `loadData()` that *resolves* `null` is the fresh-install path and is unaffected.
- [ ] `no-console` is an error across `src/` with **no** allowances, carved out only for
      `infrastructure/logging/**`; `npm run lint` passes, and a `console.error` added
      anywhere else fails it.
- [ ] Every `src/` lint block — the layer bans, the write-boundary selectors, the
      DOM-globals ban, the size budgets and `no-console` — matches `**/*.vue` as well as
      `**/*.ts`, wired with `vue-eslint-parser`, in the same change that adds Vue.
      Verified by a component that imports a repository and one that calls `console.warn`
      each failing `npm run lint`, not by the config reading as though it covers them.
- [ ] The Renovation Project view opens from both the ribbon icon and the command palette,
      reuses one leaf between them, and its type/display name/icon are all set.
- [ ] `RenovationProjectView.onOpen()` mounts an isolated Vue app (its own `createApp()` +
      `Pinia` instance) into `contentEl`; `onClose()` unmounts it and empties `contentEl`.
- [ ] The Vue arrival checklist is complete in this slice's own pull request, because
      every item on it is a gate that silently does nothing until it is wired: `vue`,
      `pinia` and `@vue/test-utils` added (`@vueuse/core` is NOT — see Design; `fallow`
      refuses a dependency with no importer, and this slice has none for it);
      `@vitejs/plugin-vue` in **all three** of
      `vite.config.ts`, `vite.harness.config.ts` and `vitest.config.ts`; `vue-tsc -noEmit` replacing
      `tsc -noEmit` in **both** `build` and `test-build`, with `src/**/*.vue` in
      `tsconfig.json`'s `include`; `vitest.config.ts`'s `coverage.include` widened to
      `src/**/*.{ts,vue}`; `eslint-plugin-vue`'s flat configs added with the TypeScript
      parser on the `**/*.vue` block.

      Each is asserted by its **effect**, never by reading the config, because every one of
      these fails silently: the harness renders `ViewRoot.vue` (proving the second Vite
      config); the `ViewRoot.vue` mount test runs at all (proving the Vitest plugin — an
      SFC import fails at parse without it, so this one is proven by the suite executing
      rather than by an assertion inside it); a deliberate type error in an SFC fails
      `npm run build` **and** `npm run test-build` (proving both substitutions and the
      `include`); an SFC with an untaken branch moves the coverage numbers (proving the
      coverage include — a config assertion would pass while the file was invisible to the
      gate); and the lint checks below cover the rest.

      `docs/setup/vue-conventions.md` §1 is where this list comes from, and it is a
      superset of §1 rather than a copy: §1 was written against a generic project and names
      neither `test-build` nor the coverage include, because neither exists in the shape it
      assumed. An imported checklist is scoped to what its author could see, so it is a
      starting point for this repository's own gates, not an inventory of them.
- [ ] Settings round-trip through `loadData`/`settingsFrom`/`saveData`; the settings tab
      renders from `getSettingDefinitions()` and both reads and writes go through
      `settingsFrom`.
- [ ] `eslint.config.mjs` bans, per directory, every sibling layer above it in the
      dependency order and the packages `vue`/`pinia`/`konva`/`vue-konva`/`obsidian` for
      `core/`, `domain/`, and `application/` (and the first three of those five for
      `infrastructure/`); a DOM-globals ban applies to `core/` and `domain/`.
      `npm run lint` passes with zero warnings (`--max-warnings 0`) against an empty
      `core/`/`domain/` and an `application/` holding only `ports/Logger.ts`.
- [ ] `npm run build` produces a single `dist/main.js` (CJS, named exports) with Obsidian,
      Electron, CodeMirror, and Node builtins external; `npm run test` and
      `npm run test:coverage` pass against the coverage floors recorded for this increment.
- [ ] `npm run check` (build + lint + coverage-thresholded tests + `fallow`) passes on a
      clean checkout, and is the CI gate on both Ubuntu and Windows.
- [ ] Manually verified inside Obsidian (`npm run test-build`, a real vault): the plugin
      loads, the ribbon icon and command both open the empty Renovation Project view, and
      reloading Obsidian does not duplicate leaves or lose the settings value.

## References

- SDD §4 Technical Context — integration surfaces (plugin lifecycle, workspace views,
  commands, Vault API, FileManager, metadata cache, Bases views, settings).
- SDD §5 Technology Stack — Core Runtime, UI, Rendering, Testing sections.
- SDD §6 High-Level Architecture — the layered diagram this slice's lint rules encode.
- SDD §7.1–7.5 Architectural Layers — layer responsibilities and directory shapes.
- SDD §8 Dependency Rule — the valid/invalid import directions enforced in
  `eslint.config.mjs`.
- SDD §9 Plugin Bootstrap — the `onload`/`onunload` step order.
- SDD §10 Dependency Composition — the composition root's five members.
- SDD §11 Workspace Views — primary vs. future surfaces.
- SDD §12 Vue Mounting Strategy — isolated app per `ItemView`, mount/unmount lifecycle.
- SDD §15 Persistent vs Ephemeral State — settings categories (default units, default
  folders, editor preferences).
- SDD §67 Logging — the four levels this slice's port declares, and the "logs never leave
  the device automatically" rule its console-only sink cannot break.
- SDD §76 Architecture Test Rules — the automated restriction this slice implements.
- SDD §77 Proposed Repository Structure — `src/plugin/`, `composition-root.ts`,
  `vite.config.ts`/`vitest.config.ts`/`tsconfig.json` at the repository root.
- SDD §81 TypeScript Rules — `strict: true`, no `any`, baseline for `tsconfig.json`.
- SDD §88 Non-Functional Requirements — Maintainability ("core domain logic remains
  framework independent").
- SDD §91 Increment 1 — Plugin Foundation — this slice's deliverables and success
  criterion, verbatim.
- ADR-004 — Vue 3 for Plugin UI (`docs/adrs/0004-vue-3-for-plugin-ui.md`).
- ADR-006 — Plain TypeScript Domain (`docs/adrs/0006-plain-typescript-domain.md`).
- `docs/design/README.md` — shared conventions (repository structure, the dependency rule)
  applied here, and the slice map this document is slice 1 of.
