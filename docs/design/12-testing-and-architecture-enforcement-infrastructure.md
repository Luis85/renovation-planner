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

This maps onto the `tests/` tree from SDD §77:

```text
tests/
├── unit/          # Geometry, Money, Quantity, Domain — pure, no I/O, no DOM
├── contracts/      # shared *RepositoryContract(makeRepository) suites
├── integration/     # command-handler tests, contract suites run against
│                     # both InMemory and Obsidian repositories, vault-change
│                     # detection, migrations — all against the fixture vault
├── fixtures/        # small in-memory fixtures shared across unit/integration
├── vault/           # the Integration Test Vault (valid-project/, ...)
└── architecture/     # meta-tests: prove the lint/contract rules actually fire
```

**Every test lives under `tests/`, mirroring `src/`** — Vue Component and Canvas
Adapter tests included, at `tests/presentation/**`. This repository's convention is
`tests/` mirrors `src/` (CLAUDE.md, and the `tests/plugin/`, `tests/presentation/views/`
layout slice 1 already ships); colocating presentation specs under `src/` would be a
second answer to "where does a test go", and would put `.spec.ts` files inside the tree
the build and the layer-boundary lint globs are scoped to.

`vitest.config.ts` defines (at minimum) two run profiles, not one, and this is a
deliberate design choice, not an implementation detail:

```text
node profile:   tests/unit/**, tests/contracts/**, tests/integration/**
                environment: 'node' — no DOM, no jsdom globals available

jsdom profile:  tests/presentation/**, tests/plugin/**
                environment: 'jsdom'
```

Running domain/application/contract tests in a bare `node` environment — not
`jsdom` — is itself an architecture check: if `domain/` or `application/` code
accidentally reaches for `window`, `document`, or any DOM global, the node-profile
suite fails immediately, independent of the ESLint rule in §5 below. This is a second,
independent enforcement of ADR-006's boundary, not a duplicate of it.

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
command introduced by slices 3, 7, 8, 9, 10) live under `tests/integration/application/`.

### 4. Repository Contract Test pattern (§72)

One shared suite per repository *interface*, written once, run against every
implementation of that interface:

```text
zoneRepositoryContract(makeRepository)
      ├── run against InMemoryZoneRepository   → tests/integration/in-memory/
      └── run against ObsidianZoneRepository   → tests/integration/obsidian/
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
  (DOM globals, in domain/core — enforced by the node test profile, see §1)
```

Three mechanisms, all already wired into `npm run check` so a violation fails the build
rather than waiting for review:

- **ESLint `no-restricted-imports`**, as one block per layer directory, banning both the
  sibling layers above it and the forbidden packages (plus their subpaths). This is
  slice 1's rule set, committed before any file existed to violate it. Per-directory
  blocks matter: two flat-config blocks matching one file **override** rather than merge,
  so a single combined glob would silently drop the per-layer sibling bans.
- **The `node` test profile** (§1 above), which fails on a DOM global reached through
  *any* depth of import — the indirect case a per-file lint rule cannot see.
- **`fallow`** (`npm run analyze`), which reports dependency hygiene across the graph.

**`dependency-cruiser` is deliberately not adopted**, and this slice does not re-open
that decision — slice 1 made it, with its reasoning, and this is the same conclusion:
ESLint already runs on every commit, integrates with the existing flat config, and
needs no second tool or second CI step. The gap a graph-level checker would close is
narrower than it looks once the node profile and `fallow` are counted. If a real
indirect violation ever survives all three, that is the trigger to add one — a fourth
tool bought against a demonstrated hole rather than an imagined one.

All three run in CI on every push/PR as part of one `npm run check`, not as an opt-in
local script — a rule that only fails a build when someone remembers to run it locally
is not enforcement.

### 9. The Architecture Completion Criteria as the phase gate (§92)

The SDD's §92 is the exit gate for the whole architecture phase, not for this slice
alone. It is reproduced in full under **Definition of Done** below, with
each criterion mapped to how it becomes verifiable rather than aspirational:

| # | Criterion | Verified by |
| --- | --- | --- |
| 1–3 | Domain runs without Obsidian/Vue/Konva | Architecture Test Rules (§8) + node-profile unit tests (§1) |
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
// tests/integration/in-memory/zone-repository.spec.ts
zoneRepositoryContract(() => new InMemoryZoneRepository());

// tests/integration/obsidian/zone-repository.spec.ts
zoneRepositoryContract(() =>
  new ObsidianZoneRepository(openFixtureVault('valid-project'))
);
```

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
enforcement mechanism, living under `tests/architecture/`:

- **Lint rule fires on a real violation.** A fixture file containing a deliberate
  `import { Notice } from 'obsidian'` inside a stand-in `domain/` module is linted as
  part of a dedicated architecture-test run; the test asserts ESLint reports an
  error, not merely that the rule exists in `eslint.config.mjs`. A config entry that
  is never actually evaluated against a violating file is indistinguishable from no
  rule at all.
- **The node profile fires on an indirect violation.** A fixture module where
  `domain/` reaches a DOM global through a helper (no direct `obsidian` or `window`
  import in the domain file itself) is imported inside a `node`-profile test; the test
  asserts the import fails, proving the profile catches what the per-file ESLint rule
  cannot see. This is the check that stands in for a graph-level tool, so it is the one
  that must be shown to actually fire.
- **A contract suite fails on a broken fake.** A deliberately broken repository fake
  (e.g. one whose `save()` silently drops the zone's `name`) is run through
  `zoneRepositoryContract`; the test asserts the suite fails. This proves the
  contract suite is discriminating — it would actually catch a real regression in
  `ObsidianZoneRepository`, not just pass trivially against any object with the right
  method names.
- **`broken-references/` actually degrades gracefully.** Loading the
  `broken-references/` fixture through the real (non-fixture) plugin bootstrap path
  is asserted to leave the rest of the plugin usable — directly exercising
  Architecture Completion Criterion 13, and simultaneously proving the fixture
  itself exercises the failure mode it claims to, rather than accidentally being a
  valid project file.
- **CI actually invokes the checks.** A test (or a documented manual check at release
  time) confirms the CI workflow definition runs `npm run check` — the one command that
  carries build, lint, coverage-gated tests and `fallow` — on every PR, on both Ubuntu
  and Windows. This catches the failure mode where the scripts exist and pass locally
  but were never wired into CI, and the related one where the two platforms drift
  because they invoke different commands.

These meta-tests run in CI alongside everything else. Their purpose is narrow: stop
"the rule exists in a config file nobody runs" and "the contract suite exists but is
vacuous" from passing unnoticed.

## Definition of Done

Infrastructure-specific:

- [ ] `tests/{unit,contracts,integration,fixtures,vault,architecture}` exist, and
      `vitest.config.ts` runs the `node` and `jsdom` profiles described in §1.
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
- [ ] The Architecture Test Rules (per-layer ESLint blocks, the `node` test profile,
      and `fallow`) all run inside the single `npm run check` CI invokes on Ubuntu and
      Windows, and the first two each have a passing planted-violation meta-test proving
      they fire. No `dependency-cruiser` config exists — see §8.

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
