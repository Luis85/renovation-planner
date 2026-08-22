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

## Dependencies

- No earlier slice — this is the foundation the other eleven build on.
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
 ├── load settings                    (loadData → settingsFrom)
 ├── initialize composition root      (createCompositionRoot(settings))
 ├── register workspace views         (registerView)
 ├── register commands                (addCommand, addRibbonIcon)
 └── register vault listeners         (deferred — nothing reads the Vault yet)

onunload()
 ├── flush pending writes             (deferred — nothing writes yet)
 ├── stop listeners                   (deferred)
 └── dispose services                 (deferred)
```

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
services, the event bus, query services, and settings. At this slice, only settings exist —
so the root is a thin, explicitly-typed object rather than a container pre-loaded with
placeholders for services that would otherwise have to be faked:

```typescript
// src/plugin/composition-root.ts
export interface CompositionRoot {
  readonly settings: RenovationPlannerSettings;
  // readonly eventBus: EventBus;                — arrives with slice 2 (Core Primitives)
  // readonly repositories: RepositoryRegistry;  — arrives with slice 4 (Persistence Layer)
  // readonly services: ApplicationServices;     — arrives with slice 4 / slice 9
  // readonly queries: QueryServices;            — arrives with slice 4
}

export function createCompositionRoot(settings: RenovationPlannerSettings): CompositionRoot {
  return { settings };
}
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

Vue, Pinia, and `@vueuse/core` are added as dependencies in this slice (SDD §5 UI stack);
`vue-konva` and Konva are not — those arrive with the canvas (slice 5, ADR-003). Adding Vue
means Vite needs `@vitejs/plugin-vue` in `vite.config.ts`'s `plugins` array; nothing else
about the build config changes.

Vue components belong to `presentation/` only. Domain and Core must never depend on `vue` or
`pinia` — enforced by the same lint rules described below, not by convention (ADR-004,
ADR-006).

### Settings persistence

Settings are the one piece of persisted state this slice touches. The plugin shell is the
only layer allowed to call `loadData`/`saveData` — everything else reads
`plugin.root.settings` or writes through `saveSettings()`.

```text
onload():  this.root = createCompositionRoot(settingsFrom(await this.loadData()))
saveSettings(): this.saveData(this.root.settings)
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

This rule set is committed and passing in Increment 1, with zero files under `core/`,
`domain/`, or `application/` yet to exercise it — the rule exists for the first file slice 2
adds, not for any file that exists today. `dependency-cruiser` is not adopted: ESLint
already runs on every commit via `npm run lint`, integrates with the existing flat config,
and needs no second tool or second CI step to produce the same guarantee.

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
}
export function createCompositionRoot(settings: RenovationPlannerSettings): CompositionRoot;

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

## Persistence Impact

- **Reads/writes:** plugin `data.json` only, via Obsidian's `loadData`/`saveData` — the
  settings object (`{ units: 'metric' | 'imperial' }`). No Vault files, no sidecars, no
  frontmatter.
- **No Vault access of any kind** in this slice: no repositories exist, and the write-safety
  lint rules (`no-restricted-syntax` on `vault.*`/`adapter.*` write methods and
  `processFrontMatter`) apply from this slice onward even though nothing yet calls them —
  the same "enforce before it can be broken" reasoning as the layer rule.
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
- [ ] The Renovation Project view opens from both the ribbon icon and the command palette,
      reuses one leaf between them, and its type/display name/icon are all set.
- [ ] `RenovationProjectView.onOpen()` mounts an isolated Vue app (its own `createApp()` +
      `Pinia` instance) into `contentEl`; `onClose()` unmounts it and empties `contentEl`.
      `vue`, `pinia`, and `@vueuse/core` are added as dependencies; `@vitejs/plugin-vue` is
      wired into `vite.config.ts`.
- [ ] Settings round-trip through `loadData`/`settingsFrom`/`saveData`; the settings tab
      renders from `getSettingDefinitions()` and both reads and writes go through
      `settingsFrom`.
- [ ] `eslint.config.mjs` bans, per directory, every sibling layer above it in the
      dependency order and the packages `vue`/`pinia`/`konva`/`vue-konva`/`obsidian` for
      `core/`, `domain/`, and `application/` (and the first three of those five for
      `infrastructure/`); a DOM-globals ban applies to `core/` and `domain/`.
      `npm run lint` passes with zero warnings (`--max-warnings 0`) against an otherwise
      empty `core/`/`domain/`/`application/`.
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
