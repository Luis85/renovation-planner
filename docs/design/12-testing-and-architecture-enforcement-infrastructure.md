# Design Slice 12: Testing & Architecture Enforcement Infrastructure

## Purpose

Every other slice in the map carries its own "Testing Strategy" section describing what
to test. None of those sections specify how a test gets run, what shared harness it
plugs into, or what stops a layering violation from ever reaching code review. That
shared machinery is this slice.

This slice delivers:

- the test pyramid's shape and directory layout, shared by every other slice's tests;
- the Application Test and Repository Contract Test *patterns* — reusable structures,
  not test cases — that slices 3, 4, 9, and 10 fill in;
- the Vue Component and Canvas Adapter test harnesses that slices 5 and 6 fill in;
- the Integration Test Vault fixture, so slice 4's persistence/migration/vault-change
  logic is developed against disposable fixture data, never a production Vault;
- the automated, CI-enforced architecture-boundary checks that make ADR-006's
  "Domain must never depend on Infrastructure" rule fail a build instead of a review;
- the SDD's own Architecture Completion Criteria (§92), reproduced here as the single
  exit gate for the whole architecture phase every slice in the map belongs to.

Without this slice, every other slice's testing strategy is unenforceable prose — each
would have to invent its own harness, its own fixture conventions, and its own notion of
"done," and nothing would stop `domain/` from quietly importing `obsidian` until a human
noticed.

## Scope

### In scope

- Test pyramid structure (§69) and the `tests/` directory layout it implies (§77).
- Unit test category taxonomy — Geometry, Money, Quantity, Domain (§70) — and which
  slice owns each category's actual test cases.
- The Application Test pattern: command handlers exercised against in-memory
  repositories, independent of Obsidian (§71).
- The Repository Contract Test pattern: one shared suite per repository interface, run
  against both the `InMemory*` and `Obsidian*` implementations from slice 4 (§72).
- The Vue Component Test harness: Vitest + `@vue/test-utils`, scoped to presentation
  behavior, not geometry correctness (§73).
- The Canvas Adapter Test harness: Konva-adapter behavior only, leaving geometry math
  to slice 2's unit tests (§74).
- The Integration Test Vault: a checked-in fixture vault with `valid-project/`,
  `broken-references/`, `legacy-schema/`, and `large-project/` cases (§75), and how it
  satisfies Data Safety Rule 1, "never develop against production Vaults" (§87).
- Architecture Test Rules: the automated layer-boundary checks and their CI wiring
  (§76), and the planted-violation meta-tests proving each one actually fires.
- The Architecture Completion Criteria (§92) reproduced as the phase-level exit gate.

### Out of scope (covered by other slices)

- Specific geometry/transform/calibration unit test cases — slice 2.
- Specific Project/Plan/Zone entity and status-transition test cases — slice 3.
- Specific persistence, schema-validation, migration, and vault-change-detection test
  cases run against the fixture vault this slice defines — slice 4.
- Specific canvas-scene and editor-shell test cases — slice 5.
- Specific editor-tool, undo/redo, and inspector test cases — slice 6.
- Specific calibration test cases — slice 7.
- Specific zone-editing test cases — slice 8.
- Specific Money/Quantity engine test cases — slice 9.
- Specific end-to-end wiring test cases (`Zone Geometry → Area → Requirement → Cost`) —
  slice 10.
- Specific error-model, diagnostics, and data-safety test cases — slice 11.
- Specific notification, save-state, empty-state, dialog, form-validation, and
  error-surfacing test cases — slices 13–17. Their component tests run in the `jsdom`
  profile and their pure selectors/policies (`selectPlanEditorEmptyState`, `routeError`,
  `surfaceFor`) run in the `node` profile, using this slice's harnesses unchanged;
  none of them needs a new one.

## Dependencies

Per the slice map (`docs/design/README.md`), this slice's *completion* depends on every
other slice — the Architecture Completion Criteria (§92) cannot be verified true until
they all exist. But its *infrastructure* (directory layout, vitest config, lint rules)
has no such ordering constraint and should be stood up as early as slice 1, so every
later slice has somewhere to put its tests from day one rather than retrofitting a
harness later.

Specific ties:

- Slice 1 (Composition Root) — the module tree the Architecture Test Rules lint against.
- Slice 2 (Core Primitives) — owns the Geometry unit test category; its `Result`/error
  types are what Application Tests assert against.
- Slice 3 (Domain Foundation) — owns the Domain unit test category.
- Slice 4 (Persistence & Repository Layer) — supplies the `InMemory*`/`Obsidian*`
  repository pairs the Repository Contract Tests run against, and the
  migration/vault-change logic the Integration Test Vault validates.
- Slice 5/6 (Canvas & Editor) — supply the Vue components and the Konva adapter the
  Component and Canvas test harnesses exercise.
- Slice 9 (Quantity & Cost Engine) — owns the Money and Quantity unit test categories.
- ADR-003 (Konva as Canvas Renderer) — the transform-normalization requirement the
  Canvas Adapter Tests must prove.
- ADR-006 (Plain TypeScript Domain) — the exact import restriction the Architecture
  Test Rules mechanize.
- Slice 1 (Composition Root) again, for the tooling decision this slice inherits rather
  than remakes: ESLint `no-restricted-imports`, no `dependency-cruiser`.
- ADR-010 (Decimal Money Arithmetic) — why the Money unit category exists at all.

## Design

### 1. The pyramid and where it lives on disk

SDD §69's pyramid, base to apex:

```text
                    E2E
                     ▲
                Integration
                     ▲
                 Component
                     ▲
                   Unit
```

**Every test lives under `tests/`, mirroring `src/`** — Vue Component and Canvas
Adapter tests included, at `tests/presentation/**`. This repository's convention is
`tests/` mirrors `src/` (CLAUDE.md, and the `tests/plugin/`, `tests/presentation/views/`
layout slice 1 already ships); colocating presentation specs under `src/` would be a
second answer to "where does a test go", and would put `.spec.ts` files inside the tree
the build and the layer-boundary lint globs are scoped to.

**This refines SDD §77's `tests/` tree**, which draws `unit/`, `integration/`,
`contracts/`, `fixtures/` and `vault/` as sibling *categories*. A category tree and a
mirror of `src/` are two answers to "where does the test for this module go", and the
mirror is the one the repository already implements and CLAUDE.md already states, so the
mirror wins and the categories that survive are only the ones that hold something which
is **not** a test of a `src/` module:

```text
tests/
├── core/ domain/ application/            ← one directory per src/ directory:
├── infrastructure/ presentation/ plugin/    the mirror. Every test of a src module
│                                            lives at its module's path.
│
├── contracts/     # MATERIAL, not tests: shared *RepositoryContract(makeRepository)
│                    suites, called from the mirrored files above (§4)
├── fixtures/      # small in-memory fixtures shared across the mirrored suites
├── helpers/       # the obsidian mock, the DOM helpers, the oxlint driver (exists)
├── vault/         # the Integration Test Vault (valid-project/, …) — SDD §75
├── build/         # meta-tests over the gates themselves: lint scope, suppressions,
│                    the stylesheet assembler, engines.node (exists) — and the
│                    planted-violation tests below, which are the same species
├── harness/       # the browser harness's parity and accessibility tests (exists)
└── release/       # manifest, changelog and version-bump tests (exists)
```

The SDD's `unit/` and `integration/` do not appear, and neither does a separate
`architecture/`: a planted-violation test proving a lint rule fires is the same species
as `tests/build/lint-scope.test.ts`, shares its instrument, and a second directory for it
would be a second answer to "where does a gate meta-test go". A unit test of `Money`
belongs at
`tests/core/money/`, and an integration test of `ObsidianZoneRepository` belongs at
`tests/infrastructure/obsidian/`. What distinguishes them is the fixture they take and
the environment they run in, not a directory — and a directory that repeats a fact the
path already carries is the drift this slice's own §2 table exists to prevent.

`vitest.config.ts` also needs `@vitejs/plugin-vue` registered, which slice 1 installs as
part of its Vue arrival checklist and which is named here because this is the section an
implementer reads when building the file. `vitest.config.ts` is standalone — `defineConfig`
from `vitest/config`, no `mergeConfig` with the build config — so the plugin being in
`vite.config.ts` does nothing for it, and without it a component test fails at parse rather
than at an assertion. The environments below are what this slice owns; the plugin is
slice 1's, recorded here so the two halves of one file are not each other's blind spot.

`vitest.config.ts` defines two run environments, not one, and the split is stated as
**a default plus a named exception** rather than as two glob lists:

```text
node    — the DEFAULT. Everything under tests/ that the jsdom list does not name.
          environment: 'node' — no DOM, no jsdom globals available.

jsdom   — the OPT-IN, and the complete list of it:
          tests/presentation/**, tests/plugin/**, tests/harness/**,
          plus any single mirrored file whose subject is DOM code, opted in with
          a per-file `@vitest-environment jsdom` docblock (today's mechanism).
```

Two glob lists would be the defect: a directory named in neither runs in neither, and a
suite that silently stops running is indistinguishable from a suite that passes. Stated
as default-plus-exception, a new directory joins the node profile by existing. **This is
a claim about the configuration, so it gets a check**, in the shape
`tests/build/lint-scope.test.ts` already uses for oxlint: ask vitest itself which files
each project collects and assert the union equals every `tests/**/*.test.ts` on disk.

Running domain/application/contract tests in a bare `node` environment — not
`jsdom` — is itself an architecture check: if `domain/` or `application/` code
accidentally reaches for `window`, `document`, or any DOM global, the node suite
fails immediately, independent of the ESLint rule in §8 below. This is a second,
independent enforcement of ADR-006's boundary, not a duplicate of it — and node being
the default rather than one of two lists is what makes it hold for a domain test nobody
has written yet.

### 2. Unit test category ownership (§70)

The SDD names four categories without assigning them to slices; this table is that
assignment:

| Category | Owning slice(s) | What it tests |
| --- | --- | --- |
| Geometry | Slice 2 (Core Primitives) | distance, area, perimeter, centroid, transform, point-in-polygon, segment intersection, and `createPolygon`'s §26 validation — pure `core/geometry/` functions. §70 also files calibration and snapping under this heading, but both are tested against the services that own them: `deriveCalibration` in slice 7, `SnapService` in slice 6. Neither has a `core/geometry/` function to test, so filing their tests here would mean testing code that lives in another layer. |
| Money | Slice 9 (Cost Engine) | addition, tax, discounts, rounding, currency safety — `decimal.js`-backed, per ADR-010. `Money` is slice 9's, not slice 2's: slice 2 explicitly excludes `core/money/` from its own scope. |
| Quantity | Slice 9 (Quantity Engine) | length/area requirement derivation, waste, packaging, manual override precedence (`override ?? calculated`). |
| Domain | Slice 3 (Project/Plan/Zone), extended by 7/8/10 as new entities land | status transitions, relationship rules (e.g. a Zone must belong to an existing Plan), validation, dependency rules. |

All four categories run in the `node` profile, with no repository, no Vue, no Konva —
entities and pure functions only.

### 3. Application Test pattern (§71)

One reusable shape, applied per command:

```text
Command (e.g. CreateZoneCommand)
      ↓
InMemoryZoneRepository  (slice 4)
      ↓
Assertions on repository state + returned Result
```

Application tests prove the *use case* — validation, repository calls, event
emission — without touching Obsidian, Vue, or Konva. They are the first place a
command handler is exercised end-to-end; slice-level Application tests (one per
command introduced by slices 3, 7, 8, 9, 10) live at the handler's mirrored path under
`tests/application/`.

### 4. Repository Contract Test pattern (§72)

One shared suite per repository *interface*, written once, run against every
implementation of that interface:

```text
zoneRepositoryContract(makeRepository)
      ├── run against InMemoryZoneRepository   → tests/infrastructure/in-memory/
      └── run against ObsidianZoneRepository   → tests/infrastructure/obsidian/
                                                   (backed by the Integration
                                                    Test Vault's valid-project/ case)
```

This is the mechanism that makes "the repository is swappable" (ADR-006's
consequence, and the whole premise behind Application Tests using an in-memory
fake) an enforced fact rather than an assumption: if `ObsidianZoneRepository` and
`InMemoryZoneRepository` ever diverge in behavior — e.g. one silently drops a field
on save, or returns a different result for a missing ID — the same contract suite
catches it on both sides, without needing a second, hand-written test file per
implementation.

One contract suite exists per repository interface slice 4 introduces (Project, Plan,
Zone at minimum for the MVP slice range); a new repository interface in a later slice
adds one more contract suite, following the same shape.

### 5. Vue Component Test harness (§73)

Vitest + `@vue/test-utils`, `jsdom` profile. Scoped strictly to slice 5/6's
presentation behavior:

- inspector: renders the right fields for the current selection; edits dispatch the
  expected command; validation messages render for the expected invalid input.
- toolbar: active-tool highlighting, tool-switch behavior.
- selection: selecting/deselecting updates visible UI state.
- dialogs: open/close/confirm/cancel behavior, required-field validation messages.

Explicitly **not** a goal: proving geometry is correct through a mounted component.
Component tests stub geometry/quantity/cost results (e.g. a fake inspector DTO with a
pre-computed area) rather than deriving them — geometry correctness is proven exactly
once, in slice 2's unit tests, per §70. A component test that recomputes area to check
an inspector label is testing the wrong layer and duplicates coverage slice 2 already
owns.

### 6. Canvas Adapter Test harness (§74)

Also `jsdom` profile, since Konva can render against a DOM-like environment, but jsdom
has no real `<canvas>` 2D context — the harness must stub/mock the canvas context
Konva expects (e.g. a minimal 2D-context stub good enough for Konva's node graph and
event dispatch, not for pixel output). That stub is shared test infrastructure,
provided once by this slice, not reimplemented per test file.

Three adapter behaviors only, per §74, each independent of geometry math:

1. **Render**: given a domain polygon (fixture `Zone` geometry), the Konva adapter
   produces a shape with the expected `points` array — proves the render-model
   mapping, not the geometry itself.
2. **Transform completion**: driving a fake Konva `Transformer` end event emits the
   correct application `Command` with normalized geometry (never raw
   `scaleX`/`scaleY`) — proves the `Konva Transform → Normalize Transform → Domain
   Geometry → Command` pipeline from §20 and ADR-003 is wired, using a pre-computed
   expected normalization rather than re-deriving the math.
3. **Selection**: clicking/selecting a Konva node emits the underlying domain ID
   (`ZoneId`, `AssetId`, ...), never a Konva node reference or index.

Detailed geometry correctness (is the normalized rectangle's width actually right)
stays in slice 2's unit tests; canvas tests only prove the adapter forwards a
pre-computed fixture value faithfully.

### 7. Integration Test Vault (§75)

A checked-in fixture vault, not a real Obsidian vault, used by slice 4's persistence,
migration, and vault-change-detection tests, and by the Obsidian arm of the Repository
Contract Tests:

```text
tests/vault/
├── valid-project/       # canonical baseline: one project, one plan, one zone,
│                          # a valid geometry sidecar — the contract suites' target
├── broken-references/    # a project/zone file referencing an entity ID that does
│                          # not resolve — validates fail-closed behavior (§87 rule 5,
│                          # rule 7) without crashing the whole plugin (§92 item 13)
├── legacy-schema/        # fixtures pinned at an older schema-version — validates
│                          # migrations are deterministic and idempotent (§44–45,
│                          # §87 rule 6)
└── large-project/        # many zones/plans/assets — validates the project index
                           # (§47) rebuilds without a full-vault rescan under load;
                           # a performance fixture, not a correctness fixture
```

This fixture vault is the concrete meaning of Data Safety Rule 1 (§87), "never
develop against production Vaults": slice 4's Obsidian repositories, migrations, and
vault-change adapter are exercised exclusively against this fixture, on disk, in CI —
never against a developer's real vault, and never against synthetic data generated
inline per test (which would let the fixture drift silently from what a real vault
actually contains).

Because Obsidian's `Vault`/`FileManager`/metadata-cache APIs are normally only
available inside a running Obsidian instance, the Obsidian arm of these tests needs a
minimal disk-backed adapter — implementing only the subset of the `Vault`/metadata
API surface slice 4's repositories actually call — that reads/writes the fixture
directory directly, standing in for the real Obsidian host during `vitest` runs. This
adapter is itself shared infrastructure from this slice, since without it the "run the
same contract suite against `Obsidian*`" pattern in §4 above has nothing to run
against outside a real Obsidian window.

### 8. Architecture Test Rules (§76)

The automated, CI-enforced version of ADR-006's boundary:

```text
domain/**  and  core/**  and  application/**  may not import:
  vue
  pinia
  konva
  vue-konva
  obsidian
  (DOM globals, in domain/core — enforced by the node default environment, see §1)
```

Two mechanisms, and **only the first of them is enforcement today** — the second is an
obligation of this slice. Stating which is which is the point of the list; a mechanism
credited before it exists is the same defect as a rule in a config nobody runs:

- **ESLint `no-restricted-imports`** — *runs today*, as one block per layer directory
  (`eslint.config.mjs`), banning both the sibling layers above it and the forbidden
  packages (plus their subpaths). This is slice 1's rule set, committed before any file
  existed to violate it, and it fails `npm run check`. Per-directory blocks matter: two
  flat-config blocks matching one file **override** rather than merge, so a single
  combined glob would silently drop the per-layer sibling bans.
- **The `node` environment as the default** (§1 above), which fails on a DOM global
  reached through *any* depth of import — the indirect case a per-file lint rule cannot
  see. The *default* half of this is real today (`vitest.config.ts` sets
  `environment: 'node'` for the whole suite, with jsdom opted into per file). The
  *profile* half — the two projects and the check that their union covers `tests/**` —
  does not exist yet and is this slice's to build.

**`fallow` is not on this list.** `npm run analyze` reports dead files, dead exports,
duplication, complexity and dependency hygiene; none of those is a layer boundary, and
counting it here would inflate the enforcement story by one whole mechanism.

**`dependency-cruiser` is deliberately not adopted.** Slice 1 made that decision and
states the reasoning, including the indirect-import gap neither mechanism above closes
and the bound the decision actually rests on; this slice does not re-open it and does not
restate it — see slice 1, *Design → Layer-dependency rule, enforced before it can be
broken*. What this slice adds is
only the trigger: the planted-violation tests below are what would surface a real
indirect violation, and one surviving them is what buys a graph-level tool.

Both run in CI on every push/PR as part of one `npm run check`, not as an opt-in
local script — a rule that only fails a build when someone remembers to run it locally
is not enforcement.

### 9. The Architecture Completion Criteria as the phase gate (§92)

The SDD's §92 is the exit gate for the whole architecture phase, not for this slice
alone. It is reproduced in full under **Definition of Done** below, with
each criterion mapped to how it becomes verifiable rather than aspirational:

| # | Criterion | Verified by |
| --- | --- | --- |
| 1–3 | Domain runs without Obsidian/Vue/Konva | Architecture Test Rules (§8) + node-environment unit tests (§1) |
| 4 | UI communicates through commands/queries | Application Test pattern (§3) + slice 5/6 component tests asserting emitted commands, never direct repository calls |
| 5–6 | Konva/Pinia store no canonical data | Canvas Adapter Tests (§6) assert Konva emits IDs/commands, not domain state; slice 5's Definition of Done items 3–5 (Pinia rebuildable from queries, no Konva node read as a geometry source) |
| 7 | Vault files remain understandable without the plugin | slice 4 Definition of Done, exercised against `valid-project/` |
| 8 | All persistence input is runtime validated | slice 4 schema tests, exercised against `broken-references/` and `legacy-schema/` |
| 9 | Schema migrations need no redesign | `legacy-schema/` fixture + slice 4 migration tests |
| 10 | Real-world coordinates | Geometry unit category (§2) + ADR-009 |
| 11 | Undo/redo participation | slice 6 Definition of Done |
| 12 | Deterministic geometry/cost unit tests | Geometry, Money, Quantity unit categories (§2) |
| 13 | A broken project file doesn't block plugin load | `broken-references/` fixture + planted-violation test (Testing Strategy, below) |
| 14 | Project index always rebuildable | `large-project/` fixture + slice 4 tests |
| 15 | New views reuse application/domain layers | Architecture Test Rules (§8) prevent the coupling that would make this false |

## Interfaces & Contracts

Repository contract suite shape (one per repository interface):

```typescript
// tests/contracts/zone-repository.contract.ts
// Named zoneRepositoryContract — lowerCamelCase, like every other function in this
// codebase (§80). Slice 3 authors this file; slices 3 and 4 each add a call site.
export function zoneRepositoryContract(
  makeRepository: () => ZoneRepository
): void {
  describe('ZoneRepository contract', () => {
    let repo: ZoneRepository;
    beforeEach(() => { repo = makeRepository(); });

    it('round-trips a saved zone through getById', async () => { /* ... */ });
    it('returns null for a missing id', async () => { /* ... */ });
    it('lists zones scoped to a single project', async () => { /* ... */ });
    it('removes a zone on delete', async () => { /* ... */ });
  });
}
```

Consumed from both sides:

```typescript
// tests/infrastructure/in-memory/zoneRepository.test.ts
zoneRepositoryContract(() => new InMemoryZoneRepository());

// tests/infrastructure/obsidian/zoneRepository.test.ts
zoneRepositoryContract(() =>
  new ObsidianZoneRepository(openFixtureVault('valid-project'))
);
```

Both call sites sit at the mirrored path of the implementation they exercise (§1), and
both are named `*.test.ts`: `vitest.config.ts` collects `tests/**/*.test.ts` and nothing
else, so a `.spec.ts` file under `tests/` is a suite that never runs.

ESLint layer-boundary rule — slice 1's shape, shown for one layer. Each layer gets its
own block from the shared `forbidden(layer, { groups, packages }, reason)` factory;
`patterns` rather than `paths` is what catches subpath imports like `vue/dist/*`, and
each block repeats the sibling-layer bans because two blocks matching one file override
rather than merge:

```javascript
// eslint.config.mjs — generated per layer, not hand-written per layer
{
  files: ['src/domain/**/*.ts'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        // sibling layers this one may not reach
        'src/application/**', 'src/infrastructure/**',
        'src/presentation/**', 'src/plugin/**',
        // packages, plus their subpaths
        'vue', 'vue/**', 'pinia', 'pinia/**',
        'konva', 'konva/**', 'vue-konva', 'vue-konva/**', 'obsidian',
      ],
    }],
  },
}
```

Canvas adapter test harness:

```typescript
interface CanvasTestHarness {
  renderPolygon(zone: Zone): KonvaPointsFixture;
  completeTransform(nodeId: string, transform: KonvaTransformFixture): Command;
  select(nodeId: string): ZoneId | AssetId | null;
}
```

Integration Test Vault access:

```typescript
function openFixtureVault(
  caseName: 'valid-project' | 'broken-references' | 'legacy-schema' | 'large-project'
): FixtureVaultAdapter;
```

`FixtureVaultAdapter` implements only the slice-4-required subset of Obsidian's
`Vault`/metadata-cache surface, backed by `tests/vault/<caseName>/` on disk.

## Persistence Impact

This slice introduces no production persistence. It defines:

- `tests/vault/**` as static, checked-in fixture content — read (and, for
  vault-change tests, written to disposable copies) only by automated tests, never by
  a running plugin instance.
- The rule that no automated test may open a real Obsidian Vault path; the fixture
  vault is the only Vault-shaped data any test touches, satisfying §87 rule 1 in
  concrete, checkable form rather than as a process reminder.
- No schema or migration format of its own — those are slice 4's; this slice only
  supplies the versioned fixture data (`legacy-schema/`) those migrations run against.

## Testing Strategy

This slice's own subject is testing infrastructure, so its Testing Strategy is about
proving the infrastructure and rules actually work — a planted-violation test for each
enforcement mechanism, living under `tests/build/` beside the gate meta-tests that
already exist there (§1):

- **Lint rule fires on a real violation.** A config entry that is never actually
  evaluated against a violating file is indistinguishable from no rule at all — but
  *where the violating file lives* is the whole problem, and the obvious spec does not
  work. The layer rule is keyed on `src/domain/**/*.ts`, so a fixture has to sit under
  `src/domain/` for it to fire; a fixture that sits there reds the real `eslint .` run,
  and the usual escape — adding it to the flat config's global `ignores` — makes the
  meta-test lint a file ESLint skips, assert zero findings, and pass vacuously. That is
  precisely the failure this test exists to prevent, reproduced inside the test.

  So the fixture is **never a file on disk under `src/`**. Follow the harness this
  repository already has for exactly this shape — `tests/build/lint-*.test.ts` driving
  the real linter through `tests/helpers/oxlint.ts`, which spawns the tool and reads its
  own resolution rather than re-implementing it. The ESLint equivalent is the `ESLint`
  class's `lintText(code, { filePath })`: `filePath` decides which flat-config blocks
  apply, and it does **not** have to exist. Lint a string of
  `import { Notice } from 'obsidian';` as `src/domain/__planted__.ts`, assert the report
  carries a `no-restricted-imports` error, and assert the same string as
  `src/infrastructure/__planted__.ts` carries none — the negative case is what proves
  the rule is keyed on the layer rather than firing everywhere.

  Two properties this shape has that a disk fixture does not: nothing is added to
  `ignores`, so `tests/build/suppressions.test.ts`'s no-suppressions claim stays whole;
  and `lintText` honours `warnIgnored`, so if a future `ignores` edit ever *did* cover
  the synthetic path, the test can be made to fail rather than to pass quietly. A
  helper alongside `tests/helpers/oxlint.ts` owns the `ESLint` instance, for the same
  reason that one exists: a second test needing it must not duplicate the spawn.
- **The node environment fires on an indirect violation.** A fixture module where
  `domain/` reaches a DOM global through a helper (no direct `obsidian` or `window`
  import in the domain file itself) is imported inside a `node`-profile test; the test
  asserts the import fails, proving the node environment catches what the per-file ESLint
  rule cannot see. Note what this does *not* stand in for: it is a DOM global at runtime,
  not an import graph, so the indirect *package* import slice 1 names as the open gap is
  still open after this test passes.
- **A contract suite fails on a broken fake.** A deliberately broken repository fake
  (e.g. one whose `save()` silently drops the zone's `name`) is run through
  `zoneRepositoryContract`; the test asserts the suite fails. This proves the
  contract suite is discriminating — it would actually catch a real regression in
  `ObsidianZoneRepository`, not just pass trivially against any object with the right
  method names.
- **`broken-references/` actually degrades gracefully** (this one is a real test of the
  bootstrap path, not a gate meta-test, so it sits at `tests/plugin/` — its mirrored
  home — rather than under `tests/build/`). Loading the
  `broken-references/` fixture through the real (non-fixture) plugin bootstrap path
  is asserted to leave the rest of the plugin usable — directly exercising
  Architecture Completion Criterion 13, and simultaneously proving the fixture
  itself exercises the failure mode it claims to, rather than accidentally being a
  valid project file.
- **CI actually invokes the checks.** A test — not a documented manual check at release
  time — confirms the CI workflow definition runs `npm run check` on every PR, on both
  Ubuntu and Windows. §8 has just said that a rule which only fails when someone
  remembers to run it is not enforcement, and a release-time manual step is exactly
  that, so the parenthetical alternative is withdrawn rather than offered. This catches
  the failure mode where the scripts exist and pass locally but were never wired into
  CI, and the related one where the two platforms drift because they invoke different
  commands.

These meta-tests run in CI alongside everything else. Their purpose is narrow: stop
"the rule exists in a config file nobody runs" and "the contract suite exists but is
vacuous" from passing unnoticed.

## Definition of Done

Infrastructure-specific:

- [ ] The `tests/` layout in §1 holds: every test of a `src/` module sits at its
      module's mirrored path, `tests/{contracts,fixtures,vault}` exist alongside the
      `helpers/`, `build/`, `harness/` and `release/` directories already on disk, and
      no `unit/`, `integration/` or `architecture/` directory has been reintroduced.
- [ ] `vitest.config.ts` runs the node-default / jsdom-opt-in split described in §1,
      and a check asserts the two projects' collected files union to every
      `tests/**/*.test.ts` on disk — so no existing suite (`build/`, `harness/`,
      `release/`, `helpers/`' consumers) is dropped by the split.
- [ ] Each of Geometry, Money, Quantity, Domain has at least one passing suite,
      owned by the slice named in §2's table.
- [ ] The Application Test pattern is demonstrated for at least one command
      (`CreateZoneCommand`) against `InMemoryZoneRepository`.
- [ ] At least one `*RepositoryContract` suite (`zoneRepositoryContract`) exists and
      passes against both an `InMemory*` and an `Obsidian*` implementation, from one
      file with two call sites — not two files.
- [ ] The Vue Component Test harness is set up under `tests/presentation/`; at least
      one inspector, toolbar, and dialog test passes, none of them asserting geometry
      correctness, and no `.spec.ts` file exists anywhere under `src/`.
- [ ] The Canvas Adapter Test harness is set up; all three named behaviors (render,
      transform completion, selection) are covered.
- [ ] The Integration Test Vault exists with all four cases, and is the only
      Vault-shaped data any automated test touches.
- [ ] The Architecture Test Rules — the per-layer ESLint blocks and the `node` default
      environment, the two mechanisms §8 lists, `fallow` deliberately not among them —
      both run inside the single `npm run check` CI invokes on Ubuntu and Windows, and
      each has a passing planted-violation meta-test under `tests/build/` proving it
      fires. No `dependency-cruiser` config exists — see §8, including the indirect-import
      gap it names rather than claims to close.

Phase-level exit gate — the SDD's Architecture Completion Criteria (§92), reproduced
in full as the condition under which feature development may begin:

1. [ ] Domain logic runs without Obsidian.
2. [ ] Domain logic runs without Vue.
3. [ ] Domain logic runs without Konva.
4. [ ] UI communicates through commands and queries.
5. [ ] Konva stores no canonical business data.
6. [ ] Pinia stores no canonical persistent data.
7. [ ] Vault files remain understandable without the plugin.
8. [ ] All persistence input is runtime validated.
9. [ ] Schema migrations can be introduced without redesign.
10. [ ] Geometry uses real-world coordinates.
11. [ ] Editor actions can participate in undo/redo.
12. [ ] Geometry and cost calculations have deterministic unit tests.
13. [ ] A broken project file does not prevent the entire plugin from loading.
14. [ ] Project indexes can always be rebuilt from the Vault.
15. [ ] New views can reuse the same application/domain layers.

## References

- SDD §69 — Testing Strategy (the pyramid)
- SDD §70 — Unit Tests (Geometry, Money, Quantity, Domain)
- SDD §71 — Application Tests
- SDD §72 — Repository Contract Tests
- SDD §73 — Vue Component Tests
- SDD §74 — Canvas Tests
- SDD §75 — Integration Test Vault
- SDD §76 — Architecture Test Rules
- SDD §77 — Proposed Repository Structure (`tests/` tree)
- SDD §87 — Data Safety (rule 1: never develop against production Vaults)
- SDD §92 — Architecture Completion Criteria
- ADR-003 — Konva as Canvas Renderer (transform normalization; Konva as adapter)
- ADR-006 — Plain TypeScript Domain (the layer-isolation rule this slice mechanizes)
- ADR-010 — Decimal Money Arithmetic (why a Money unit category exists)
- `docs/design/README.md` — slice map and shared conventions
