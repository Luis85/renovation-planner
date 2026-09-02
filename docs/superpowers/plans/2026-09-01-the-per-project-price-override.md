# The Per-Project Price Override — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give a project a way to price a shared catalogue asset in its own currency, so that
the currency refusal slice 20's first half shipped stops being a dead end.

**Architecture:** A new note-backed entity, `AssetPriceOverride`, one per (project, asset), in
the project's own folder. Its unit cost replaces the asset's as an INPUT to the cost pipeline —
resolved by the two commands that already route through `deriveRequirementFigures`, never by the
derivation itself. A project-narrowed cascade invalidates the requirements it moves, and a
section on slice 21's project detail state is where a user sets one.

**Tech Stack:** TypeScript, Zod (frontmatter schemas), decimal.js (money), Vue 3 + Pinia
(presentation), Vitest, Obsidian plugin API.

**Spec:** [`docs/superpowers/specs/2026-09-01-the-per-project-price-override-design.md`](../specs/2026-09-01-the-per-project-price-override-design.md)

The spec is a **delta** against
[`docs/tasks/20-the-currency-the-pipeline-is-told.md`](../../tasks/20-the-currency-the-pipeline-is-told.md),
whose Amendment 1 item 7 enumerates this increment. Read both, and read
[`docs/issues/The cost pipeline is told the currency it must produce.md`](../../issues/The%20cost%20pipeline%20is%20told%20the%20currency%20it%20must%20produce.md)
before Task 5 — it records three withdrawn attempts, and a reader who does not know them will
try the same three in the same order.

## Global Constraints

- **`npm run check` must pass before every commit.** Build (`vue-tsc` over `src/**` AND
  `tests/**`, then Vite, then the stylesheet checks), lint (oxlint then ESLint, both with
  warnings fatal), `test:coverage` against its floors, and `analyze` (fallow).
- **Coverage floors are 99/99/99/98** (statements/functions/lines/branches) and the headroom is
  about **one covered unit** on branches and functions. Read `coverage-final.json` for the files
  you changed, never the summary line: one branch is 0.035pp, below the hundredth the summary
  prints. **Plan each test with the code in the same step.**
- **Layering** (`eslint.config.mjs`, `no-restricted-imports`): `presentation → application →
  domain → core`; `infrastructure → application (ports) → domain → core`; only `src/plugin/`
  composes all of them. `vue`, `pinia`, `konva` and `obsidian` are banned by name in `core/`,
  `domain/` and `application/`.
- **Nothing writes to the vault outside `infrastructure/`** (`WRITE_BOUNDARY` in
  `eslint.config.mjs`).
- **Money is a decimal STRING on every boundary** (ADR-010). A YAML float loses money; the
  schema regex is `/^(0|[1-9]\d*)(\.\d+)?$/` and the currency regex is `/^[A-Z]{3}$/`.
- **No user-facing literal at a notice or i18n door.** `I18N_LITERAL_BAN` and `NOTICE_TEXT_BAN`
  in `eslint.config.mjs`. Copy goes in `en.ts` AND `de.ts`; the German for an Asset is
  **`Objekt`**, never `Material` (`tests/presentation/i18n/strings.test.ts` refuses it).
- **Sentence-case UI text** (marketplace rule, enforced by `eslint-plugin-obsidianmd`). A
  capitalised word mid-sentence fails the build.
- **Every error code is copied from its RAISE SITE**, never guessed from a field name. A
  `FieldErrorMap` keyed on a code nothing raises is invisible to every gate.
- **A REQUIRED member is a compile error at every construction site, and `tests/**` is
  type-checked.** Before writing any task's file list, grep for the constructions the widening
  breaks — `new XCommand(`, `registerX(`, `createXServices(`, and every typed literal of the
  interface — across `src/` AND `tests/`, and list them. **Five separate review rounds on this
  branch each reported one instance of this**, always because a list had been written from
  `src/` alone, where the callers are a small minority: `AssignAssetCommand` (3 sites, one in
  `presentation/`), `AssetCascadeDeps` + `GetRequirementsForZone` (24 in tests),
  `DeleteAssetDeps` (11 in tests), `RenovationProjectQueryServices` (11 factory calls plus six
  files with typed literals) and `RenovationProjectCommandServices` (eight files). The grep
  belongs in the file list beside the names: names go stale, the command does not.
  **A DTO is one of these, which is how the seventh instance arrived AFTER this rule was
  written**: `RequirementInspectorDTO` gains a required `unitCost` in Task 8, and the rule was
  applied to the deps bundles and service literals and not to the DTO, because a DTO reads as
  data rather than as a contract somebody implements. The grep does not care about that
  distinction. **Every exported type a test may annotate a literal with is in scope**, and the
  instrument is the type's own name (`grep -rn "RequirementInspectorDTO" src/ tests/`), not a
  guess at how it is constructed. Read the hits, too: a `as unknown as` cast is immune and a
  spread of an already-widened literal inherits the member, so three hits can be one edit.
  **For a member that TRAVELS — a context fed from the composition root through a deps
  bundle — the type's own name is the wrong instrument, and that is the eighth instance.**
  Greping `PlanEditorContext` finds the interface and the typed literals and misses the three
  hops between them, because those hops name `PlanEditorDeps` instead. Grep an existing
  **sibling member** (`grep -rn "onCatalogueChanged" src/ tests/`) — what travels the chain is a
  member, so a member is what prints the chain. Task 8a's bullet carries the worked list.
  **And "a compile error at every construction site" is this rule's own overclaim, falsified by
  the ninth instance**: a Vue `provide` record spelled `[SOME_KEY as symbol]: { … }` erases the
  `InjectionKey`'s type, so a missing member COMPILES and faults at runtime when the new
  subscription is invoked. `npm run check` catches it only because the test then fails — and
  only in a fixture that actually reaches the code that reads the member, so a list-state
  fixture stays green while a detail-state one dies. Both shapes have to be swept: `grep -rn
  "<TYPE> = {" ` for the build errors and `grep -rn "<INJECTION_KEY> as symbol"` for the silent
  ones. Task 9's bullet carries that worked list, including which fixtures deliberately get
  nothing.
- **A corrected CLAIM is swept in the same edit, and this plan has paid three rounds to learn
  it.** When a design decision changes, the sentence justifying the old one is rarely in one
  place: *"the orphan renders in no row, so it is unreachable, unlistable and undeletable"* lived
  in a task's "why this task exists" paragraph, in the spec's Decision 2b, in a **production
  docblock** destined for `DeleteAsset.ts`, and in a **proposed commit message** — and it was
  fixed one copy per review round, each round reporting the copy the previous fix had missed.
  The instrument is a grep for the CLAIM's distinctive words across BOTH documents (here:
  `grep -n "unreachable\|unlistable\|undeletable\|joins on the catalogue" docs/superpowers/`),
  run in the edit that makes the correction. **Two homes are easy to remember and the other two
  are not**: prose inside a fenced code block reads as code and gets skipped, and a commit
  message is not prose anybody re-reads. Correct in place with the old claim quoted rather than
  deleting it — a justification that changes silently is one the next author re-derives.
- **Commit after every task, with ONE deliberate exception.** Each task below ends green on its
  own — strictly stronger than the spec's four-commit sequencing, which is the coarse grouping
  these tasks fall into. **Tasks 5 and 6 share a commit**, because the spec requires resolution
  and the effective-cost correction to land together and gives the reason: *"the correction is
  only correct once something resolves an override, and the resolution is only safe once the
  predicate stops false-mismatching."* Between them every overridden requirement reads
  permanently `stale`, and `npm run check` is green the whole time — a task boundary the gate
  approves is not the same as a state to stop at, which is why that exception is stated here
  rather than left to whoever runs Task 5.

---

## File Structure

**Created:**

| Path | Responsibility |
| --- | --- |
| `src/domain/asset-price/AssetPriceOverride.ts` | The entity and its smart constructor — a unit cost may not be negative, and **nothing about the project's currency**: that rule is `SetAssetPriceOverride`'s (Decision 2), because this constructor is on the hydration path and a drifted note must stay readable. |
| `src/domain/asset-price/AssetPriceOverrideId.ts` | The branded id and its factory. |
| `src/domain/asset-price/AssetPriceOverride.errors.ts` | `assetPriceError(code, message)`. |
| `src/domain/asset-price/AssetPriceOverride.events.ts` | `AssetPriceOverrideChanged` and its factory. |
| `src/application/ports/AssetPriceOverrideRepository.ts` | The port: five methods. |
| `src/infrastructure/persistence/in-memory/InMemoryAssetPriceOverrideRepository.ts` | The test double, over `VersionedStore`. |
| `src/infrastructure/persistence/dto/assetPriceFrontmatter.ts` | `ASSET_PRICE_TYPE` and `AssetPriceFrontmatterSchemaV1`. |
| `src/infrastructure/persistence/mappers/assetPriceMapper.ts` | Markdown ↔ entity, both directions. |
| `src/infrastructure/obsidian/repositories/ObsidianAssetPriceOverrideRepository.ts` | The note-backed implementation. |
| `src/application/commands/asset-price/SetAssetPriceOverride.ts` | Create or replace one project's price. |
| `src/application/commands/asset-price/ClearAssetPriceOverride.ts` | Remove it, falling back to the catalogue. |
| `src/application/commands/requirement/resolveEffectiveUnitCost.ts` | The one `??`, and its batched sibling. |
| `src/application/event-handlers/requirement/onAssetPriceOverrideChanged.ts` | The project-narrowed cascade. |
| `src/application/queries/ListProjectAssetPrices.ts` | The section's read model. |
| `src/application/events/projectPricesChangeSource.ts` | Tells an open project pane a price moved. |
| `src/application/events/requirementFiguresChangeSource.ts` | Tells an open Inspector a requirement's stored figures were rewritten. |
| `src/presentation/views/AssetPriceList.vue` | The section on the project detail state. |

**Modified:**

| Path | Change |
| --- | --- |
| `src/application/ports/ProjectIndex.ts` | A sixth `ENTITY_TYPES` entry. |
| `src/application/ports/diagnostics.ts` | A seventh `DiagnosticEntityKind`. |
| `src/infrastructure/persistence/migration/migrationSet.ts` | `ASSET_PRICE_MIGRATIONS` (empty). |
| `src/infrastructure/obsidian/repositories/paths.ts` | `ASSET_PRICES_FOLDER` and `assetPricesFolderFor`. |
| `src/application/commands/requirement/AssignAsset.ts` | Resolve the effective unit cost. |
| `src/application/commands/requirement/RecalculateRequirement.ts` | The same resolution. |
| `src/application/commands/requirement/deriveRequirementFigures.ts` | Nothing — see Task 6's note. |
| `src/application/event-handlers/requirement/onAssetUpdated.ts` | The batched effective-cost comparison. |
| `src/application/queries/GetRequirementsForZone.ts` | The memoised resolution, and the DTO's `unitCost` group. |
| `src/presentation/views/ProjectDetail.vue` | Mount the section. |
| `src/presentation/stores/ProjectDetailStore.ts` | Hold the price rows, behind the request ticket. |
| `src/presentation/views/ProjectDetailState.vue` | Two more subscriptions; see Task 9 step 4a. |
| `src/plugin/composition-root.ts`, `src/plugin/guardedServices.ts` | Construct and guard. |
| `src/presentation/i18n/locales/en.ts`, `locales/de.ts` | The section's copy, and the `asset-price.*` error copy — one table, since `toUserMessage` looks a code up as a locale key. |
| `styles/` | The section's rules. |

**A note on where this does NOT belong:** `src/plugin/settings/libraryMigration.ts` carries a
rule that *"whoever adds a library-resident entity type owes this line, in the same edit"*. An
`AssetPriceOverride` is **project-resident**, not library-resident —
[[Work belongs to one project, catalogues belong to the vault]] — so it owes that file
nothing. Do not add it there.

---

### Task 1: the `AssetPriceOverride` entity

**Files:**
- Create: `src/domain/asset-price/AssetPriceOverrideId.ts`
- Create: `src/domain/asset-price/AssetPriceOverride.errors.ts`
- Create: `src/domain/asset-price/AssetPriceOverride.ts`
- Test: `tests/domain/asset-price/assetPriceOverride.test.ts`

**Interfaces:**
- Consumes: `EntityId`/`createEntityId` from `core/identity`, `Money`/`Currency`/`isNegative`
  from `core/money/Money`, `ValidationError` from `core/errors/AppError`.
- Produces: `AssetPriceOverrideId`, `createAssetPriceOverrideId()`,
  `assetPriceError(code, message)`, `class AssetPriceOverride` with
  `static create(props: CreateAssetPriceOverrideProps): Result<AssetPriceOverride, ValidationError>`
  and `withUnitCost(unitCost: Money): Result<AssetPriceOverride, ValidationError>`.

**The currency coherence rule is NOT here.** Spec Decision 2: it belongs to
`SetAssetPriceOverrideCommand` (Task 4), because the project's currency is another entity's fact
and this constructor is on the HYDRATION path too — enforcing it here would refuse a stranded or
hand-edited note at the read, making a file the user can see on disk invisible to the plugin.

- [ ] **Step 1: Write the failing tests**

Create `tests/domain/asset-price/assetPriceOverride.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { AssetPriceOverride } from '../../../src/domain/asset-price/AssetPriceOverride';
import { createAssetPriceOverrideId } from '../../../src/domain/asset-price/AssetPriceOverrideId';
import { createProjectId } from '../../../src/domain/project/ProjectId';
import { createAssetId } from '../../../src/domain/asset/AssetId';
import { of as moneyOf } from '../../../src/core/money/Money';
import { expectOk } from '../../helpers/domain';

function props() {
	return {
		id: createAssetPriceOverrideId(),
		projectId: createProjectId(),
		assetId: createAssetId(),
		unitCost: moneyOf('19.50', 'GBP'),
	};
}

describe('AssetPriceOverride', () => {
	it('is created from a project, an asset and a price', () => {
		const created = expectOk(AssetPriceOverride.create(props()));
		expect(created.unitCost.amount).toBe('19.50');
		expect(created.unitCost.currency).toBe('GBP');
	});

	/**
	 * The entity does NOT police the project's currency — that is the command's (Task 4), and
	 * this case pins the absence so a later author does not "fix" it back onto the constructor
	 * and silently make every stranded note unreadable.
	 */
	it('accepts a unit cost in any currency, because the project is not its fact', () => {
		const created = expectOk(AssetPriceOverride.create({ ...props(), unitCost: moneyOf('19.50', 'EUR') }));
		expect(created.unitCost.currency).toBe('EUR');
	});

	it('refuses a negative unit cost', () => {
		const result = AssetPriceOverride.create({ ...props(), unitCost: moneyOf('-1.00', 'GBP') });
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('unreachable');
		expect(result.error.code).toBe('asset-price.negative-unit-cost');
	});

	/** Zero is a real price — a supplier throwing in offcuts free of charge is not an error. */
	it('accepts a zero unit cost', () => {
		const created = expectOk(AssetPriceOverride.create({ ...props(), unitCost: moneyOf('0.00', 'GBP') }));
		expect(created.unitCost.amount).toBe('0.00');
	});

	/** `withUnitCost` rebuilds through `create`, so every edit re-runs the refusal. */
	it('re-validates on edit and keeps identity', () => {
		const created = expectOk(AssetPriceOverride.create(props()));
		const edited = expectOk(created.withUnitCost(moneyOf('21.00', 'GBP')));
		expect(edited.id).toBe(created.id);
		expect(edited.projectId).toBe(created.projectId);
		expect(edited.assetId).toBe(created.assetId);
		expect(edited.unitCost.amount).toBe('21.00');

		const refused = created.withUnitCost(moneyOf('-1.00', 'GBP'));
		expect(refused.ok).toBe(false);
	});
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `npx vitest run tests/domain/asset-price/assetPriceOverride.test.ts`
Expected: FAIL — cannot resolve `src/domain/asset-price/AssetPriceOverride`.

**`expectOk` comes from `tests/helpers/domain.ts`, and every import of it in this plan says
so.** Five blocks below named `tests/helpers/result.ts`, which does not exist, under a hedge
here telling the implementer to check and use the house spelling if it did not — a sentence
that reads as a survey of the ground and is a guess. `grep -rn "export function expectOk"
tests/` prints exactly one line, `tests/helpers/domain.ts:71`, and 20 test files already import
it from there. The relative depths were right; only the module name was wrong. **A hedge is not
a measurement**, and it survives review precisely because it looks like one.

- [ ] **Step 3: Write the id and the error factory**

`src/domain/asset-price/AssetPriceOverrideId.ts`:

```ts
import { createEntityId } from '../../core/identity/generateId';
import type { EntityId } from '../../core/identity/EntityId';

export type AssetPriceOverrideId = EntityId<'assetprice'>;

export function createAssetPriceOverrideId(): AssetPriceOverrideId {
	return createEntityId('assetprice');
}
```

`src/domain/asset-price/AssetPriceOverride.errors.ts`:

```ts
import type { ValidationError } from '../../core/errors/AppError';

export function assetPriceError(code: string, message: string): ValidationError {
	return { category: 'Validation', code: `asset-price.${code}`, message };
}
```

- [ ] **Step 4: Write the entity**

`src/domain/asset-price/AssetPriceOverride.ts`:

```ts
import type { ValidationError } from '../../core/errors/AppError';
import { isNegative, type Money } from '../../core/money/Money';
import { err, ok, type Result } from '../../core/result/Result';
import type { ProjectId } from '../project/ProjectId';
import type { AssetId } from '../asset/AssetId';
import type { AssetPriceOverrideId } from './AssetPriceOverrideId';
import { assetPriceError } from './AssetPriceOverride.errors';

export interface CreateAssetPriceOverrideProps {
	readonly id: AssetPriceOverrideId;
	readonly projectId: ProjectId;
	readonly assetId: AssetId;
	readonly unitCost: Money;
}

/**
 * One project's own price for one shared catalogue Asset (PRD §89, [[Asset library]]'s open
 * definition-of-done item). It replaces the Asset's `unitCost` as an INPUT to the cost
 * pipeline; it does not replace the Requirement's own `estimatedCost.override`, which
 * replaces the pipeline's OUTPUT. Neither can express the other's question.
 *
 * An ENTITY rather than a map on the Project note, and the reason is this codebase's shape:
 * every persisted thing here is one note with an `id`, a `revision` and a conditional write. A
 * map would give the whole collection one revision, so two concurrent price edits would be one
 * lost update — and `save` taking an `Expected` is checked BY THE TYPE, which a map field would
 * quietly satisfy while meaning something weaker.
 *
 * It carries no name. Like `Requirement`, it is a RELATIONSHIP rather than a thing with a name,
 * which is why its note is named by its own id (see `ObsidianAssetPriceOverrideRepository`).
 *
 * **Uniqueness is on the (projectId, assetId) PAIR and is not enforced here.** Ids are ULIDs,
 * so nothing structurally prevents two notes for one pair; the repository's lookup is by pair
 * and a duplicate is a diagnostic plus last-writer-wins. Deliberately not a refusal — the notes
 * are user-editable markdown, and refusing to read a project's prices because a user duplicated
 * a note is worse than reading one of them and saying so.
 */
export class AssetPriceOverride {
	readonly id: AssetPriceOverrideId;
	readonly projectId: ProjectId;
	readonly assetId: AssetId;
	readonly unitCost: Money;

	private constructor(props: CreateAssetPriceOverrideProps) {
		this.id = props.id;
		this.projectId = props.projectId;
		this.assetId = props.assetId;
		this.unitCost = props.unitCost;
	}

	/**
	 * **The project's currency is deliberately NOT checked here**, and the reason is which
	 * entity owns the fact. `Project.create` can compare its own `budget` against its own
	 * `currency`; this entity would have to be TOLD the project's — and this constructor is on
	 * the hydration path, so enforcing it here refuses a stranded or hand-edited note at the
	 * READ, making a file the user can see on disk invisible to the plugin. The rule lives at
	 * `SetAssetPriceOverrideCommand`, where a user's intent arrives and where a refusal is
	 * something they can act on.
	 *
	 * What survives here is what this entity can own alone.
	 */
	static create(props: CreateAssetPriceOverrideProps): Result<AssetPriceOverride, ValidationError> {
		// Money itself is signed (ADR-010); a unit price is a FIELD that cannot go below zero,
		// so the guard lives here where the field enters — the split `Asset.create` makes too.
		if (isNegative(props.unitCost)) {
			return err(
				assetPriceError(
					'negative-unit-cost',
					`A unit cost cannot be negative; got ${props.unitCost.amount} ${props.unitCost.currency}.`,
				),
			);
		}
		return ok(new AssetPriceOverride(props));
	}

	/** Rebuilds through `create`, so an edit re-runs the refusal. `id` is identity. */
	withUnitCost(unitCost: Money): Result<AssetPriceOverride, ValidationError> {
		return AssetPriceOverride.create({ id: this.id, projectId: this.projectId, assetId: this.assetId, unitCost });
	}
}
```

- [ ] **Step 5: Run the tests and watch them pass**

Run: `npx vitest run tests/domain/asset-price/assetPriceOverride.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 6: Full gate, then commit**

Run: `npm run check`

```bash
git add src/domain/asset-price tests/domain/asset-price
git commit -m "feat(domain): a project's own price for a shared asset

The entity, its id and its error factory. It owns exactly one invariant — a
unit cost may not be negative — and deliberately NOT the project's currency:
that rule is `SetAssetPriceOverrideCommand`'s, because this constructor is
also the hydration path, and enforcing it here would refuse a stranded or
hand-edited note at the READ rather than showing it.

A case pins that acceptance, so a later reader cannot tighten the rule back
onto the entity and make every drifted note unreadable.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01G1z4YErxsacXRBUXoH94T8"
```

---

### Task 2: the port and the in-memory repository

**Files:**
- Create: `src/application/ports/AssetPriceOverrideRepository.ts`
- Create: `src/infrastructure/persistence/in-memory/InMemoryAssetPriceOverrideRepository.ts`
- Test: `tests/contracts/asset-price-override-repository.contract.ts` (shared) — **`tests/contracts/`,
  where the other five live** (`zone-repository.contract.ts`, `requirement-repository.contract.ts`
  and three siblings), each exporting `<x>RepositoryContract(make: () => XFixture)`. An earlier
  draft put it under `tests/infrastructure/persistence/` with a `makeRepo` parameter — a sixth
  convention for something that already has one. The `Fixture` shape is not decoration: it is
  what lets the note-backed side PROVISION a project before the contract asks for one.
- Test: `tests/infrastructure/persistence/inMemoryAssetPriceOverride.test.ts`

**Interfaces:**
- Consumes: Task 1's `AssetPriceOverride`, `AssetPriceOverrideId`; `Expected`, `EntityVersion`,
  `Loaded` from `application/ports/versioning`; `RepositoryError` from `ports/repositoryErrors`.
- Produces: `interface AssetPriceOverrideRepository` with `getForPair`, `listByProject`,
  `listByAsset`, `save`, `delete` — **five**, which is the spec's Decision 3 exactly (the task
  document's four plus `listByAsset`); and `assetPriceOverrideRepositoryContract(make)` with
  `AssetPriceOverrideFixture`, the shared
  contract test Task 3 reuses.

- [ ] **Step 1: Write the port**

`src/application/ports/AssetPriceOverrideRepository.ts`:

```ts
import type { RepositoryError } from './repositoryErrors';
import type { Result } from '../../core/result/Result';
import type { AssetPriceOverride } from '../../domain/asset-price/AssetPriceOverride';
import type { AssetPriceOverrideId } from '../../domain/asset-price/AssetPriceOverrideId';
import type { ProjectId } from '../../domain/project/ProjectId';
import type { AssetId } from '../../domain/asset/AssetId';
import type { Expected, EntityVersion, Loaded } from './versioning';

/**
 * Conditional on the same terms as every other entity port (design slice 3).
 *
 * `getForPair` is the lookup everything else asks through — uniqueness is on the pair and the
 * id is a ULID, so an id-keyed read answers a question no caller has. It returns ONE override
 * for a pair that has two notes, and the implementation logs a diagnostic when it finds a
 * duplicate: last-writer-wins, deliberately not a refusal, because the notes are user-editable.
 *
 * `listByAsset` exists for ONE caller — `onAssetUpdated`'s skip test, which fans out across
 * every project referencing a shared asset and needs the overrides for all of them in one read
 * rather than one read per requirement. It is what makes that correction cost one query.
 *
 * **There is deliberately no `getById`, and every sibling entity port has one.** `AssetRepository`
 * and `ProjectRepository` both declare it because commands there hold an id and want the entity;
 * nothing in this increment does. The clear command and Task 7a's cleanup both delete from
 * entities they already loaded, so the sentence above — an id-keyed read answers a question no
 * caller has — would otherwise sit three lines above a method contradicting it. Uniformity is a
 * reason and it is not the same reason as necessity: the alternative was to keep it and amend
 * the spec's Decision 3 from five methods to six, and the argument for dropping it is that a
 * port method with no caller is a claim nothing rests on, while adding one back is one line the
 * day a caller exists. The note-backed repository still needs a by-id read for its own hydration
 * and keeps one as a PRIVATE method.
 */
export interface AssetPriceOverrideRepository {
	getForPair(
		projectId: ProjectId,
		assetId: AssetId,
	): Promise<Result<Loaded<AssetPriceOverride> | null, RepositoryError>>;
	listByProject(projectId: ProjectId): Promise<Result<Loaded<AssetPriceOverride>[], RepositoryError>>;
	listByAsset(assetId: AssetId): Promise<Result<Loaded<AssetPriceOverride>[], RepositoryError>>;
	save(
		override: AssetPriceOverride,
		expected: Expected,
	): Promise<Result<Loaded<AssetPriceOverride>, RepositoryError>>;
	delete(id: AssetPriceOverrideId, expected: EntityVersion): Promise<Result<void, RepositoryError>>;
}

/**
 * **Which duplicate wins, stated once because three places have to agree.** Both repositories
 * answer `getForPair`, and `ListProjectAssetPrices` folds a list into a map; a rule left to each
 * of them is three rules, and they had already drifted in this plan's first draft — the fake
 * answered the FIRST match (insertion order), the note-backed repository the LAST
 * (`getIdsByType` order), and the query's `Map` the last again. Tests would have resolved and
 * updated a different override than production.
 *
 * The winner is the HIGHEST id, and that is a real rule rather than a coin toss between two
 * enumeration orders. `createEntityId` mints `<prefix>-<ULID>` from a MONOTONIC factory —
 * Crockford-base32, timestamp-prefixed, lexicographically sortable, which its own docblock
 * calls "the property the project index (§47) and vault change detection ordering (§46) build
 * on". So the highest id IS the most recently created note: last-writer-wins meant literally,
 * and identical in both implementations however each happens to enumerate.
 */
export function winningDuplicate(
	matches: readonly Loaded<AssetPriceOverride>[],
): Loaded<AssetPriceOverride> | null {
	return matches.reduce<Loaded<AssetPriceOverride> | null>(
		(best, candidate) => (best === null || candidate.entity.id > best.entity.id ? candidate : best),
		null,
	);
}

/**
 * The same rule applied to a GROUPED list, which is what every caller but `getForPair` actually
 * needs — the cascade keys by project, the price list by asset.
 *
 * It exists because `new Map(list.map(...))` is the shape that keeps arriving: it reads as a
 * grouping and is really "whichever entry came last in enumeration order", which is a third
 * answer to the question `winningDuplicate` states. That spelling had already been written into
 * three call sites of this plan and corrected; the FOURTH — `onAssetUpdated`'s own map — survived
 * that correction and was found a round later. A rule with a function has one place to be wrong.
 */
export function winnersBy<K>(
	overrides: readonly Loaded<AssetPriceOverride>[],
	keyOf: (o: Loaded<AssetPriceOverride>) => K,
	/**
	 * **Called once per key that had more than one note, and it is REQUIRED reading rather
	 * than an option.** `getForPair` logs `asset-price.duplicate-pair` when it resolves one,
	 * and every other resolution goes through this function — so without a door here, a
	 * project whose only surface is the price section (no requirements, so no `getForPair`
	 * on that pair) resolves duplicates silently for the life of the vault, and the design's
	 * promised diagnostic is one no user can ever provoke. Optional-with-a-no-op default is
	 * the shape this repository has already paid for twice (`CascadeDeps.notify`,
	 * `ResolutionOps.notify`): the caller that forgets it compiles, passes and says nothing.
	 */
	onDuplicate: (key: K, notes: readonly Loaded<AssetPriceOverride>[]) => void,
): Map<K, Loaded<AssetPriceOverride>> {
	const grouped = new Map<K, Loaded<AssetPriceOverride>[]>();
	for (const override of overrides) {
		const key = keyOf(override);
		const bucket = grouped.get(key);
		if (bucket) bucket.push(override);
		else grouped.set(key, [override]);
	}
	const winners = new Map<K, Loaded<AssetPriceOverride>>();
	for (const [key, bucket] of grouped) {
		if (bucket.length > 1) onDuplicate(key, bucket);
		const best = winningDuplicate(bucket);
		if (best !== null) winners.set(key, best);
	}
	return winners;
}
```

- [ ] **Step 2: Write the shared contract test**

Read `tests/contracts/` first — the five existing contracts are there and this is their sibling,
not a second convention. Create `tests/contracts/asset-price-override-repository.contract.ts`.

**The import depth is `../../src/`, and it is one level shallower than an earlier draft of this
block had it.** That draft was written when the file was going to live under
`tests/infrastructure/persistence/`; moving it up a directory and leaving `../../../src/`
resolves outside the repository entirely, so the file fails module resolution before a single
case runs. Every sibling in `tests/contracts/` uses `../../src/`, and `tests/helpers/` is
`../helpers/` from here. Copy the depth from the file next to it rather than from this block.

```ts
import { describe, expect, it } from 'vitest';
import type { AssetPriceOverrideRepository } from '../../src/application/ports/AssetPriceOverrideRepository';
import { AssetPriceOverride } from '../../src/domain/asset-price/AssetPriceOverride';
import {
	createAssetPriceOverrideId,
	type AssetPriceOverrideId,
} from '../../src/domain/asset-price/AssetPriceOverrideId';
import { of as moneyOf } from '../../src/core/money/Money';
import { expectOk } from '../helpers/domain';
import type { ProjectId } from '../../src/domain/project/ProjectId';
import type { AssetId } from '../../src/domain/asset/AssetId';

export function makeOverride(projectId: ProjectId, assetId: AssetId, amount = '19.50'): AssetPriceOverride {
	return expectOk(
		AssetPriceOverride.create({
			id: createAssetPriceOverrideId(),
			projectId,
			assetId,
			unitCost: moneyOf(amount, 'GBP'),
		}),
	);
}

/**
 * One contract, both implementations. The in-memory double and the note-backed repository
 * must answer identically or the suite is testing a fake that production does not match —
 * the "a fake must not be kinder than the real thing" rule, expressed as a shared spec.
 */
export interface AssetPriceOverrideFixture {
	readonly repository: AssetPriceOverrideRepository;
	/** Change the note under the repository's feet, for the `observed` arm of a stale save. */
	touch(id: AssetPriceOverrideId): void;
	/**
	 * A project this fixture has PROVISIONED, not a bare `createProjectId()`. The note-backed
	 * repository resolves an insert's folder through `projectFolderOf(index, projectId)` and
	 * refuses an unknown project outright, so a contract minting its own ids fails at the very
	 * first save. `RequirementFixture.otherProject()` is the same member for the same reason.
	 *
	 * **SYNCHRONOUS, deliberately, which is a constraint on the FIXTURE rather than a
	 * convenience here.** Its sibling provisions by PLANTING a note (`plantNote` plus
	 * `projectToPersistence`) rather than by calling the repository, precisely because a
	 * `save` is a promise and this signature has nowhere to await one. An earlier draft of
	 * this plan told the Obsidian fixture to "create a real project note through the project
	 * repository and rebuild the index", which cannot be done here: the contract calls
	 * `overrides.save` on the very next line. Making the member async instead would mean
	 * awaiting it at every call site in all ten cases, and it is the shape the five existing
	 * contracts do not have.
	 */
	newProject(): ProjectId;
	newAsset(): AssetId;
}

export function assetPriceOverrideRepositoryContract(make: () => AssetPriceOverrideFixture): void {
	describe('AssetPriceOverrideRepository contract', () => {
		it('answers null for a pair with no override', async () => {
			const f = make();
			const found = expectOk(await f.repository.getForPair(f.newProject(), f.newAsset()));
			expect(found).toBeNull();
		});

		it('round-trips an override and finds it by its pair', async () => {
			const f = make();
			const projectId = f.newProject();
			const assetId = f.newAsset();
			const saved = expectOk(await f.repository.save(makeOverride(projectId, assetId), 'absent'));
			expect(saved.version.revision).toBe(1);

			const found = expectOk(await f.repository.getForPair(projectId, assetId));
			expect(found).not.toBeNull();
			expect(found?.entity.unitCost.amount).toBe('19.50');
			expect(found?.entity.unitCost.currency).toBe('GBP');
		});

		/** Three decimals, because `594.005` is not representable in binary floating point
		 *  while `99.99` survives a coercion — the shared rule for catching a YAML float. */
		it('preserves a three-decimal amount exactly', async () => {
			const f = make();
			const projectId = f.newProject();
			const assetId = f.newAsset();
			expectOk(await f.repository.save(makeOverride(projectId, assetId, '594.005'), 'absent'));
			const found = expectOk(await f.repository.getForPair(projectId, assetId));
			expect(found?.entity.unitCost.amount).toBe('594.005');
		});

		it('refuses an insert for an id that is already taken', async () => {
			const f = make();
			const override = makeOverride(f.newProject(), f.newAsset());
			expectOk(await f.repository.save(override, 'absent'));
			const again = await f.repository.save(override, 'absent');
			expect(again.ok).toBe(false);
		});

		it('refuses a save whose expected revision is stale', async () => {
			const f = make();
			const override = makeOverride(f.newProject(), f.newAsset());
			const saved = expectOk(await f.repository.save(override, 'absent'));
			const edited = expectOk(saved.entity.withUnitCost(moneyOf('21.00', 'GBP')));
			expectOk(await f.repository.save(edited, saved.version));
			const stale = await f.repository.save(edited, saved.version);
			expect(stale.ok).toBe(false);
		});

		it('lists by project and by asset, and each excludes the other axis', async () => {
			const f = make();
			const projectA = f.newProject();
			const projectB = f.newProject();
			const assetX = f.newAsset();
			const assetY = f.newAsset();
			expectOk(await f.repository.save(makeOverride(projectA, assetX), 'absent'));
			expectOk(await f.repository.save(makeOverride(projectA, assetY), 'absent'));
			expectOk(await f.repository.save(makeOverride(projectB, assetX), 'absent'));

			const byProject = expectOk(await f.repository.listByProject(projectA));
            expect(byProject).toHaveLength(2);
			expect(byProject.every((o) => o.entity.projectId === projectA)).toBe(true);

			const byAsset = expectOk(await f.repository.listByAsset(assetX));
			expect(byAsset).toHaveLength(2);
			expect(byAsset.every((o) => o.entity.assetId === assetX)).toBe(true);
		});

		/**
		 * The duplicate-pair rule, in the SHARED contract because it is the one place both
		 * implementations can be held to the same answer. Two notes, deterministic winner: the
		 * higher id, which `createEntityId`'s monotonic ULID makes the more recently created.
		 * Without this case the two repositories drifted — the fake answering the oldest match
		 * and the note-backed one the newest — and every duplicate test would have been evidence
		 * about a different program than the one that ships.
		 */
		/**
		 * BOTH save orders, in two fixtures, and an earlier draft of this case drove ONE while
		 * its comment claimed two. `makeOverride` mints monotonic ULIDs, so the second entity
		 * created always has the higher id — and that draft saved it FIRST, which means a
		 * repository answering the OLDEST INSERTED match returns the same entity the rule
		 * demands and passes. The case named the fake-versus-production drift it exists to
		 * catch and could not have caught it in that direction.
		 */
		it.each([
			['newest saved last', false],
			['newest saved first', true],
		])('answers the highest-id override when two notes name one pair (%s)', async (_name, newestFirst) => {
			const f = make();
			const projectId = f.newProject();
			const assetId = f.newAsset();
			const older = makeOverride(projectId, assetId, '19.50');
			const newer = makeOverride(projectId, assetId, '21.00');
			// `newer.id > older.id` by construction; the ORDER of these two saves is the axis.
			const order = newestFirst ? [newer, older] : [older, newer];
			for (const override of order) expectOk(await f.repository.save(override, 'absent'));

			const found = expectOk(await f.repository.getForPair(projectId, assetId));
			expect(found?.entity.id).toBe(newer.id);
		});

		it('deletes an override, after which its pair answers null again', async () => {
			const f = make();
			const projectId = f.newProject();
			const assetId = f.newAsset();
			const saved = expectOk(await f.repository.save(makeOverride(projectId, assetId), 'absent'));
			expectOk(await f.repository.delete(saved.entity.id, saved.version));
			expect(expectOk(await f.repository.getForPair(projectId, assetId))).toBeNull();
		});

		/**
		 * The OTHER arm of a stale expectation, and the reason the fixture has `touch` and the
		 * in-memory double has `poke`: a note edited outside the plugin keeps its revision, so
		 * only `observed` can tell. Without this case `poke` has no caller at all, which is the
		 * `unused-class-members` finding this repository has already paid for once.
		 */
		it('refuses a save whose expected token is stale even at the same revision', async () => {
			const f = make();
			const override = makeOverride(f.newProject(), f.newAsset());
			const saved = expectOk(await f.repository.save(override, 'absent'));
			f.touch(override.id);
			const stale = await f.repository.save(override, saved.version);
			expect(stale.ok).toBe(false);
		});

		it('refuses a delete whose expected revision is stale', async () => {
			const f = make();
			const projectId = f.newProject();
			const assetId = f.newAsset();
			const saved = expectOk(await f.repository.save(makeOverride(projectId, assetId), 'absent'));
			const edited = expectOk(saved.entity.withUnitCost(moneyOf('21.00', 'GBP')));
			const second = expectOk(await f.repository.save(edited, saved.version));
			const stale = await f.repository.delete(saved.entity.id, saved.version);
			expect(stale.ok).toBe(false);
			// Read it back through the PAIR rather than by id: the port has no `getById`, and
			// this is the same claim — the note the second save left is still the pair's note.
			const survivor = expectOk(await f.repository.getForPair(projectId, assetId));
			expect(survivor?.entity.id).toBe(second.entity.id);
		});
	});
}
```

- [ ] **Step 3: Run the contract against nothing and watch it fail**

Create `tests/infrastructure/persistence/inMemoryAssetPriceOverride.test.ts`:

```ts
import { createAssetId } from '../../../src/domain/asset/AssetId';
import { createProjectId } from '../../../src/domain/project/ProjectId';
import { InMemoryAssetPriceOverrideRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryAssetPriceOverrideRepository';
import { assetPriceOverrideRepositoryContract } from '../../contracts/asset-price-override-repository.contract';

// The in-memory side provisions nothing, so its fixture mints ids directly — which is exactly
// the shape that does NOT work for the note-backed one, and the reason the contract asks the
// fixture rather than minting them itself.
assetPriceOverrideRepositoryContract(() => {
	const repository = new InMemoryAssetPriceOverrideRepository();
	return {
		repository,
		touch: (id) => repository.poke(id),
		newProject: () => createProjectId(),
		newAsset: () => createAssetId(),
	};
});
```

Run: `npx vitest run tests/infrastructure/persistence/inMemoryAssetPriceOverride.test.ts`
Expected: FAIL — cannot resolve `InMemoryAssetPriceOverrideRepository`.

- [ ] **Step 4: Write the in-memory repository**

`src/infrastructure/persistence/in-memory/InMemoryAssetPriceOverrideRepository.ts`:

```ts
import { ok, type Result } from '../../../core/result/Result';
import type { PersistenceError, ValidationError } from '../../../core/errors/AppError';
import type { AssetPriceOverride } from '../../../domain/asset-price/AssetPriceOverride';
import type { AssetPriceOverrideId } from '../../../domain/asset-price/AssetPriceOverrideId';
import type { ProjectId } from '../../../domain/project/ProjectId';
import type { AssetId } from '../../../domain/asset/AssetId';
import {
	winningDuplicate,
	type AssetPriceOverrideRepository,
} from '../../../application/ports/AssetPriceOverrideRepository';
import type { EntityVersion, Expected, Loaded } from '../../../application/ports/versioning';
import { VersionedStore } from './VersionedStore';

/**
 * See InMemoryProjectRepository for the contract this implements and why `poke` exists.
 *
 * `getForPair` answers the FIRST match, which is the same last-writer-wins the note-backed
 * repository lands on for a duplicated pair — the fake must not be kinder than the real thing.
 * It raises no diagnostic, because it has no logger and cannot acquire one without every test
 * that constructs it growing an argument; the duplicate DIAGNOSTIC is asserted against the
 * Obsidian repository, where the duplicate can actually exist as two notes.
 */
export class InMemoryAssetPriceOverrideRepository implements AssetPriceOverrideRepository {
	private readonly store = new VersionedStore<AssetPriceOverride>();

	poke(id: AssetPriceOverrideId): void {
		this.store.poke(id);
	}

	getForPair(
		projectId: ProjectId,
		assetId: AssetId,
	): Promise<Result<Loaded<AssetPriceOverride> | null, PersistenceError>> {
		// `winningDuplicate`, never `.find(...)`: `VersionedStore.values()` preserves insertion
		// order, so `find` answers the OLDEST match where the note-backed repository answers the
		// newest. A fake that resolves a different override than production is a fake that makes
		// every test about duplicates evidence for the wrong program.
		const matches = this.store
			.values()
			.filter((o) => o.entity.projectId === projectId && o.entity.assetId === assetId);
		return Promise.resolve(ok(winningDuplicate(matches)));
	}

	listByProject(projectId: ProjectId): Promise<Result<Loaded<AssetPriceOverride>[], PersistenceError>> {
		return Promise.resolve(ok(this.store.values().filter((o) => o.entity.projectId === projectId)));
	}

	listByAsset(assetId: AssetId): Promise<Result<Loaded<AssetPriceOverride>[], PersistenceError>> {
		return Promise.resolve(ok(this.store.values().filter((o) => o.entity.assetId === assetId)));
	}

	save(
		override: AssetPriceOverride,
		expected: Expected,
	): Promise<Result<Loaded<AssetPriceOverride>, PersistenceError | ValidationError>> {
		return Promise.resolve(this.store.save(override.id, override, expected, 'asset-price'));
	}

	delete(
		id: AssetPriceOverrideId,
		expected: EntityVersion,
	): Promise<Result<void, PersistenceError | ValidationError>> {
		return Promise.resolve(this.store.remove(id, expected, 'asset-price'));
	}
}
```

- [ ] **Step 5: Run and watch it pass**

Run: `npx vitest run tests/infrastructure/persistence/inMemoryAssetPriceOverride.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 6: Full gate, then commit**

Run: `npm run check`

```bash
git add src/application/ports/AssetPriceOverrideRepository.ts \
        src/infrastructure/persistence/in-memory/InMemoryAssetPriceOverrideRepository.ts \
        tests/contracts/asset-price-override-repository.contract.ts \
        tests/infrastructure/persistence/inMemoryAssetPriceOverride.test.ts
git commit -m "feat(ports): the price override port, and one contract for both implementations

Five methods rather than the four the task document's contract block
declares: `listByAsset` is what lets the cascade's skip test read every
project's overrides for a shared asset in one query instead of one per
requirement.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01G1z4YErxsacXRBUXoH94T8"
```

---

### Task 3: the note, and the sixth entity type

**Files:**
- Create: `src/infrastructure/persistence/dto/assetPriceFrontmatter.ts`
- Create: `src/infrastructure/persistence/mappers/assetPriceMapper.ts`
- Create: `src/infrastructure/obsidian/repositories/ObsidianAssetPriceOverrideRepository.ts`
- Modify: `src/application/ports/ProjectIndex.ts` (the `ENTITY_TYPES` array)
- **Modify: `src/infrastructure/obsidian/repositories/noteEntityWrite.ts`** — `NoteWriteSpec.indexType`
  is declared `'renovation-asset' | 'renovation-requirement'`, a hand-written union, so the
  repository below does not compile at this task's boundary and its promised green commit does
  not happen. Type it **`EntityType`** rather than adding a third literal: `ENTITY_TYPES`'s own
  docblock records that this vocabulary had "three spellings … with nothing to notice them
  drifting" and that the array is the declaration everything else derives from — this field is a
  fourth spelling, and the same argument applies to it. `infrastructure/` may import
  `application/ports/ProjectIndex`, and `spec.indexType` is already passed straight to
  `index.upsert`, whose own field is `EntityType`, so the narrowing was never buying anything the
  call site did not already require.
- Modify: `src/application/ports/diagnostics.ts` (`DiagnosticEntityKind`)
- Modify: `src/infrastructure/persistence/migration/migrationSet.ts`
- Modify: `src/infrastructure/obsidian/repositories/paths.ts`
- Test: `tests/infrastructure/persistence/assetPriceMapper.test.ts`
- Test: `tests/infrastructure/obsidian/obsidianAssetPriceOverride.test.ts`
- **Test (extend): `tests/infrastructure/obsidian/repositories/errorPaths.test.ts`** — its
  `NOTE_BACKED_CASES` table is compared against `Object.keys(MIGRATION_SET)` minus
  `plan-geometry`, so adding the kind turns that case red until `asset-price` has a refusal
  case of its own.
- **Test (extend): `tests/infrastructure/obsidian/repositories/preservation.test.ts`** — the
  same derivation for `PRESERVATION_CASES`, and the same red. Its comment says so in as many
  words: *"A seventh note-backed kind added to `MIGRATION_SET` turns this red until it has a
  preservation case."*
- **Test (extend): `tests/plugin/persistence-wiring.test.ts`** — it asserts
  `snapshot?.schemaVersions` with `toEqual` against an exact six-key object, so the seventh
  key fails it. Add `'asset-price': 1`.

**Interfaces:**
- Consumes: Tasks 1–2; `NoteVaultDeps`, `KeyedQueues`, `projectFolderOf`,
  `readNoteBackedEntity`/`saveNoteBackedEntity`/`trashNoteBackedEntity` and `NoteWriteSpec`
  from `infrastructure/obsidian/repositories/`.
- Produces: `ASSET_PRICE_TYPE = 'renovation-asset-price'`, `AssetPriceFrontmatterSchemaV1`,
  `assetPriceToPersistence`/`assetPriceFromPersistence`, `assetPricesFolderFor(projectFolder)`,
  `class ObsidianAssetPriceOverrideRepository`.

**Why the compiler is your checklist here.** `DiagnosticEntityKind` is a closed union and
`MIGRATION_SET` is `Record<DiagnosticEntityKind, readonly Migration[]>`, so adding a kind
without its (empty) migration table is a build error rather than a silent gap. `ENTITY_TYPES`
is a runtime `includes` test, so adding to it breaks nothing and is checked by the index test
instead.

**And it was not the whole checklist, which is the lesson rather than the fix.** That paragraph
enumerated the two closed unions its author had thought of; `NoteWriteSpec.indexType` is a third,
in `infrastructure/`, and nothing pointed at it. `grep -rn "renovation-requirement" src/` before
writing the repository is what finds every place this vocabulary is spelled out by hand — the
same instrument `libraryMigration.ts` already recommends for a new entity type, in a comment
about notes being "silently left behind by every library move".

**The compiler is also not the only thing that goes red, and three SUITES do.** Two derive their
case tables from `Object.keys(MIGRATION_SET)` and one asserts the schema-version object with
`toEqual`, so this task cannot reach `npm run check` green without extending all three — they are
in the file list above. That is the mechanism working exactly as written rather than a surprise:
each of those checks exists to make a new kind impossible to add silently, and their own comments
predict this task by name. `grep -rn "MIGRATION_SET" tests/` is the instrument, and it is a
different one from the `src/` grep above — a `src/`-only sweep finds none of them.

Run that grep and it reports **six** files, not five — this paragraph said five, in the same
breath as calling a stale count *"this repository's most-repeated stale claim"*, which is as
neat an illustration as the rule will ever get. The three beyond the ones above were each
checked:

- `tests/helpers/repositoryStack.ts` passes the table to `createMigrationRunner` and enumerates
  nothing. Nothing to do.
- `tests/infrastructure/persistence/migration/legacyFixture.test.ts:15` names it only in a
  comment — *"The production `MIGRATION_SET` is empty for all six kinds"* — which becomes wrong
  at seven while failing nothing.
- **`tests/vault/legacy-schema/README.md:7`** says the same thing in different words —
  *"`MIGRATION_SET` is empty, so `latest` derives to 1 for all six kinds"* — and is the file the
  five-count missed. It is markdown inside a FIXTURE VAULT, so no gate compiles it, no gate
  lints it, and `tests/vault` is not in this task's `git add` line; correcting the number
  without adding that path is a correction that never lands.

Fix both numbers in this commit and stage `tests/vault` with them.

**A third file mentions six and must NOT be touched**, which is the reason to read the hits
rather than sed them: `tests/infrastructure/persistence/index/index.test.ts:61` says *"it listed
four of the six kinds that existed"* about a case that USED to enumerate them, and the sentence
is the history of a defect rather than a claim about today — it ends *"driven through a fixture
table so a seventh kind needs no edit to this file"*. A blanket six-to-seven sweep would falsify
a true sentence about the past.

- [ ] **Step 1: Write the failing mapper tests**

Create `tests/infrastructure/persistence/assetPriceMapper.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
	assetPriceFromPersistence,
	assetPriceToPersistence,
} from '../../../src/infrastructure/persistence/mappers/assetPriceMapper';
import { AssetPriceOverride } from '../../../src/domain/asset-price/AssetPriceOverride';
import { createAssetPriceOverrideId } from '../../../src/domain/asset-price/AssetPriceOverrideId';
import { createProjectId } from '../../../src/domain/project/ProjectId';
import { createAssetId } from '../../../src/domain/asset/AssetId';
import { of as moneyOf } from '../../../src/core/money/Money';
import { expectOk } from '../../helpers/domain';

function override(amount = '19.50') {
	return expectOk(
		AssetPriceOverride.create({
			id: createAssetPriceOverrideId(),
			projectId: createProjectId(),
			assetId: createAssetId(),
			unitCost: moneyOf(amount, 'GBP'),
		}),
	);
}

describe('assetPriceMapper', () => {
	it('writes the owned keys and reads them back unchanged', () => {
		const entity = override();
		const dto = assetPriceToPersistence(entity, 3);
		expect(dto).toMatchObject({
			type: 'renovation-asset-price',
			'schema-version': 1,
			id: entity.id,
			revision: 3,
			project: entity.projectId,
			asset: entity.assetId,
			'unit-cost': '19.50',
			currency: 'GBP',
		});

		const read = expectOk(assetPriceFromPersistence(dto));
		expect(read.id).toBe(entity.id);
		expect(read.projectId).toBe(entity.projectId);
		expect(read.assetId).toBe(entity.assetId);
		expect(read.unitCost.amount).toBe('19.50');
	});

	/** A YAML float is exactly what ADR-010 refuses; three decimals is what catches one. */
	it('preserves a three-decimal amount through both directions', () => {
		const dto = assetPriceToPersistence(override('594.005'), 1);
		expect(dto['unit-cost']).toBe('594.005');
		expect(expectOk(assetPriceFromPersistence(dto)).unitCost.amount).toBe('594.005');
	});

	it('refuses a note whose amount is a YAML float rather than a string', () => {
		const dto = { ...assetPriceToPersistence(override(), 1), 'unit-cost': 19.5 };
		expect(assetPriceFromPersistence(dto).ok).toBe(false);
	});

	it('refuses a note whose currency is not ISO-4217 shaped', () => {
		const dto = { ...assetPriceToPersistence(override(), 1), currency: 'pounds' };
		expect(assetPriceFromPersistence(dto).ok).toBe(false);
	});

	/**
	 * Spec Decision 2, pinned as behaviour: a note that disagrees with its project's currency
	 * is READ, not refused. A build that starts refusing it here makes a file the user can see
	 * on disk invisible to the plugin — unlistable, unclearable, and with nothing saying why —
	 * so this case is what stops that being "tightened" back in.
	 */
	it('reads a note whose currency is not the project currency, so it can be shown', () => {
		const dto = { ...assetPriceToPersistence(override(), 1), 'unit-cost': '24.00', currency: 'EUR' };
		const read = expectOk(assetPriceFromPersistence(dto));
		expect(read.unitCost.currency).toBe('EUR');
	});
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `npx vitest run tests/infrastructure/persistence/assetPriceMapper.test.ts`
Expected: FAIL — cannot resolve the mapper.

- [ ] **Step 3: Write the schema**

`src/infrastructure/persistence/dto/assetPriceFrontmatter.ts`:

```ts
import { z } from 'zod';

export const ASSET_PRICE_TYPE = 'renovation-asset-price';

/**
 * Schema version 1. `ASSET_PRICE_MIGRATIONS` is empty and the version is DERIVED from the
 * registered steps, so this is version 1 for as long as no key moves, splits or changes
 * meaning. A key merely ARRIVING is a redefinition rather than a migration here, the same
 * call slice 19's Asset schema and the currency increment's Project schema both took — and
 * the cost of that habit is named in CLAUDE.md: the migration runner stays unproven on a real
 * chain, and the first change that CANNOT be a redefinition should be scheduled with that
 * proof in mind rather than discovered.
 *
 * `project` and `asset` are the pair. They are plain strings on disk and branded ids in the
 * domain; `assetPriceFromPersistence` asserts them, exactly as every other mapper here does.
 */
export const AssetPriceFrontmatterSchemaV1 = z.object({
	type: z.literal(ASSET_PRICE_TYPE),
	'schema-version': z.literal(1),
	id: z.string().min(1),
	revision: z.number().int().nonnegative().catch(0),
	project: z.string().min(1),
	asset: z.string().min(1),
	/** A decimal STRING (ADR-010) — a YAML float would reintroduce exactly what ADR-010 refuses. */
	'unit-cost': z.string().regex(/^(0|[1-9]\d*)(\.\d+)?$/),
	currency: z.string().regex(/^[A-Z]{3}$/),
});
```

- [ ] **Step 4: Write the mapper**

`src/infrastructure/persistence/mappers/assetPriceMapper.ts`:

```ts
import type { ValidationError } from '../../../core/errors/AppError';
import { AssetPriceOverride } from '../../../domain/asset-price/AssetPriceOverride';
import type { AssetPriceOverrideId } from '../../../domain/asset-price/AssetPriceOverrideId';
import type { ProjectId } from '../../../domain/project/ProjectId';
import type { AssetId } from '../../../domain/asset/AssetId';
import { createMoney } from '../../../core/money/Money';
import { ok, type Result } from '../../../core/result/Result';
import { parsePersisted } from './parse';
import { ASSET_PRICE_TYPE, AssetPriceFrontmatterSchemaV1 } from '../dto/assetPriceFrontmatter';

export function assetPriceToPersistence(
	override: AssetPriceOverride,
	revision: number,
): Record<string, unknown> {
	return {
		type: ASSET_PRICE_TYPE,
		'schema-version': 1,
		id: override.id,
		revision,
		project: override.projectId,
		asset: override.assetId,
		'unit-cost': override.unitCost.amount,
		currency: override.unitCost.currency,
	};
}

/**
 * **No project currency, and that is spec Decision 2.** A note that has drifted from its
 * project's currency is READ and SHOWN, not refused: refusing it here would make a file the
 * user can see on disk invisible to the plugin, which is the same trade the duplicate-pair rule
 * already refuses. The pipeline is what stops a wrong-currency figure being computed.
 *
 * **What the section does NOT do is say why**, and an earlier draft of this comment claimed it
 * did — "the section's marker is what tells the user why their price is not being used". No
 * such marker is scheduled: `AssetPriceRowDto` carries no mismatch field, and Tasks 8 and 9 add
 * no copy, no rendering and no case for one. The spec's second and third residuals are where
 * that stands, and they DEFER it while naming the remedy (a mark derived per read from the two
 * currencies, never stored). So the shipped section shows the mismatched price with nothing
 * beside it, and the user learns why at the next assign, from `cost.currency-mismatch`.
 *
 * The sentence is corrected rather than the marker scheduled, because the spec is the authority
 * on what this increment ships and it decided this deliberately — and a comment promising a
 * user-facing explanation nobody built is worse than the gap it papers over: the next reader
 * takes it as covered and never opens the residual.
 */
export function assetPriceFromPersistence(
	rawFrontmatter: unknown,
): Result<AssetPriceOverride, ValidationError> {
	const frontmatter = parsePersisted(
		AssetPriceFrontmatterSchemaV1,
		rawFrontmatter,
		'asset-price.frontmatter-invalid',
		'Asset price note',
	);
	if (!frontmatter.ok) return frontmatter;
	const dto = frontmatter.value;

	const unitCost = createMoney(dto['unit-cost'], dto.currency);
	if (!unitCost.ok) return unitCost;

	const created = AssetPriceOverride.create({
		id: dto.id as AssetPriceOverrideId,
		projectId: dto.project as ProjectId,
		assetId: dto.asset as AssetId,
		unitCost: unitCost.value,
	});
	if (!created.ok) return created;
	return ok(created.value);
}
```

- [ ] **Step 5: Register the type, the kind and the empty migration table**

In `src/application/ports/ProjectIndex.ts`, add the sixth entry:

```ts
export const ENTITY_TYPES = [
	'renovation-project',
	'renovation-plan',
	'renovation-zone',
	'renovation-asset',
	'renovation-requirement',
	'renovation-asset-price',
] as const;
```

In `src/application/ports/diagnostics.ts`, extend the union — and update the docblock above it
so it does not go stale:

```ts
export type DiagnosticEntityKind =
	| 'project'
	| 'plan'
	| 'zone'
	| 'asset'
	| 'requirement'
	| 'asset-price'
	| 'plan-geometry';
```

In `src/infrastructure/persistence/migration/migrationSet.ts`, add the table. Follow the file's
existing spelling for where the per-entity arrays are declared; the entry is:

```ts
	'asset-price': ASSET_PRICE_MIGRATIONS,
```

with `export const ASSET_PRICE_MIGRATIONS: readonly Migration[] = [];` beside its five
siblings. **This is where the compiler tells you if you missed one** — `MIGRATION_SET` is
keyed by `DiagnosticEntityKind`, so it will not build until the entry exists.

In `src/infrastructure/obsidian/repositories/paths.ts`, beside the other folder constants:

```ts
const ASSET_PRICES_FOLDER = 'Asset Prices';
```

and beside the other folder functions:

```ts
/**
 * The PROJECT's folder, not the library's. An Asset is the vault's; the price this project
 * pays for it is this project's — [[Work belongs to one project, catalogues belong to the vault]]
 * applied to the consequence of using a shared definition.
 */
export function assetPricesFolderFor(projectFolder: string): string {
	return joinFolder(projectFolder, ASSET_PRICES_FOLDER);
}
```

- [ ] **Step 6: Run the mapper tests and watch them pass**

Run: `npx vitest run tests/infrastructure/persistence/assetPriceMapper.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 7: Write the Obsidian repository**

`src/infrastructure/obsidian/repositories/ObsidianAssetPriceOverrideRepository.ts`. Mirror
`ObsidianRequirementRepository` exactly — it is the sibling that shares the nameless-entity
property:

```ts
import type { RepositoryError } from '../../../application/ports/repositoryErrors';
import { isErr, ok, type Result } from '../../../core/result/Result';
import type { AssetPriceOverride } from '../../../domain/asset-price/AssetPriceOverride';
import type { AssetPriceOverrideId } from '../../../domain/asset-price/AssetPriceOverrideId';
import type { ProjectId } from '../../../domain/project/ProjectId';
import type { AssetId } from '../../../domain/asset/AssetId';
import {
	winningDuplicate,
	type AssetPriceOverrideRepository,
} from '../../../application/ports/AssetPriceOverrideRepository';
import type { EntityVersion, Expected, Loaded } from '../../../application/ports/versioning';
import type { Logger } from '../../../application/ports/Logger';
import { projectFolderOf, assetPricesFolderFor } from './paths';
import { KeyedQueues } from './KeyedQueues';
import type { NoteVaultDeps } from './NoteVaultDeps';
import {
	assetPriceFromPersistence,
	assetPriceToPersistence,
} from '../../persistence/mappers/assetPriceMapper';
import {
	readNoteBackedEntity,
	saveNoteBackedEntity,
	trashNoteBackedEntity,
	type NoteWriteSpec,
} from './noteEntityWrite';

/**
 * Filename is never identity (§83); the id alone keeps these notes findable and unambiguous —
 * the same rule and the same reason as `ObsidianRequirementRepository`'s. An override has no
 * name of its own: it is a relationship, not a thing with one, and `NoteWriteSpec.entryName`
 * is a pure function of the entity, so a friendlier name would need an `assetName` copied onto
 * the entity — drift, refused everywhere else here.
 */
function assetPriceFileName(override: AssetPriceOverride): string {
	return `${override.id}`;
}

/**
 * The note-backed half of the conditional-write contract, without a sidecar. It is
 * `ObsidianRequirementRepository` with a different mapper, and deliberately nothing more.
 *
 * **It holds no `ProjectRepository`**, because spec Decision 2 moved the currency rule to the
 * command: hydration constructs unconditionally, so the read needs nothing but the note.
 *
 * **A duplicated pair is a DIAGNOSTIC and last-writer-wins, never a refusal.** Ids are ULIDs,
 * so two notes for one (project, asset) is a state nothing structurally prevents, and these
 * are user-editable markdown files. Refusing to read a project's prices because a user
 * duplicated a note is worse than reading one of them and saying so — the same shape
 * `warnOnDuplicate` already uses for duplicate ids in the index.
 */
export class ObsidianAssetPriceOverrideRepository implements AssetPriceOverrideRepository {
	private readonly queues = new KeyedQueues();

	constructor(
		private readonly deps: NoteVaultDeps,
		private readonly logger: Logger,
	) {}

	/**
	 * PRIVATE, and not on the port: `hydrate` walks the index by id and this is how it
	 * reads one. No caller above `infrastructure/` asks a price override for its id — see the
	 * port's own header for why that is a decision rather than an omission.
	 */
	private readById(id: AssetPriceOverrideId): Promise<Result<Loaded<AssetPriceOverride> | null, RepositoryError>> {
		return readNoteBackedEntity(
			this.deps,
			'asset-price',
			id,
			assetPriceFromPersistence,
			'asset-price.entity-invalid',
		);
	}

	async getForPair(
		projectId: ProjectId,
		assetId: AssetId,
	): Promise<Result<Loaded<AssetPriceOverride> | null, RepositoryError>> {
		const listed = await this.listByProject(projectId);
		if (isErr(listed)) return listed;
		const matches = listed.value.filter((o) => o.entity.assetId === assetId);
		if (matches.length > 1) {
			// Last-writer-wins, and SAY SO. Not a refusal: see the class header.
			this.logger.warn('asset-price.duplicate-pair', {
				projectId,
				assetId,
				count: matches.length,
			});
		}
		// The shared rule, not `matches[matches.length - 1]`: that would be `getIdsByType`
		// order, which is a fact about the index rather than about which note is newest.
		return ok(winningDuplicate(matches));
	}

	listByProject(projectId: ProjectId): Promise<Result<Loaded<AssetPriceOverride>[], RepositoryError>> {
		return this.loadedInProject(projectId, (o) => o.projectId === projectId);
	}

	listByAsset(assetId: AssetId): Promise<Result<Loaded<AssetPriceOverride>[], RepositoryError>> {
		return this.loadedEverywhere((o) => o.assetId === assetId);
	}

	save(
		override: AssetPriceOverride,
		expected: Expected,
	): Promise<Result<Loaded<AssetPriceOverride>, RepositoryError>> {
		return this.queues.run(`asset-price:${override.id}`, () => this.saveQueued(override, expected));
	}

	private saveQueued(
		override: AssetPriceOverride,
		expected: Expected,
	): Promise<Result<Loaded<AssetPriceOverride>, RepositoryError>> {
		// Resolved per save (ADR-0013) and consumed only on the INSERT path — an UPDATE writes
		// where the note already sits and needs no folder at all.
		const folder = projectFolderOf(this.deps.index, override.projectId);
		const spec: NoteWriteSpec<AssetPriceOverride> = {
			kind: 'asset-price',
			indexType: 'renovation-asset-price',
			notesFolder: folder === undefined ? undefined : assetPricesFolderFor(folder),
			projectId: (entity) => entity.projectId,
			entryName: assetPriceFileName,
			toPersistence: assetPriceToPersistence,
			preWriteValid: (dto) => assetPriceFromPersistence({ ...dto }).ok,
			validationCode: 'asset-price.pre-write-invalid',
			writeFailedCode: 'asset-price.write-failed',
		};
		return saveNoteBackedEntity(this.deps, spec, override, expected);
	}

	delete(id: AssetPriceOverrideId, expected: EntityVersion): Promise<Result<void, RepositoryError>> {
		return this.queues.run(`asset-price:${id}`, () =>
			trashNoteBackedEntity(this.deps, 'asset-price', id, 'asset-price.delete-failed', expected),
		);
	}

	/**
	 * **Narrow by the INDEX before hydrating, because a read error is contagious.** Every
	 * caller here refuses on the first unreadable note, so hydrating the whole vault's price
	 * notes to answer a question about one project means a single malformed note — in a
	 * project the caller has never heard of — fails `getForPair` for every pair, and with it
	 * every assign and every recalculation. These notes are USER-EDITABLE by design; one of
	 * them being broken must not disable pricing everywhere.
	 *
	 * `ProjectIndex` already answers both halves without reading a note:
	 * `getIdsByType('renovation-asset-price')` and `getIdsByProject(projectId)`, intersected.
	 * No new port method.
	 *
	 * **Skipping an unreadable note in scope is REFUSED**, and the asymmetry is the point: a
	 * skipped override prices its requirement at the catalogue default and says nothing, which
	 * is a wrong figure presented as a right one — the failure this whole increment exists to
	 * end. Out of scope it cannot affect the answer, so it is not read; in scope it might BE
	 * the answer, so the refusal stands.
	 *
	 * **`listByAsset` cannot be narrowed** — the index has no asset axis — so it still hydrates
	 * every price note and still refuses on the first bad one. Its two callers (the cascade's
	 * skip test and the delete cleanup) both REPORT a failed list rather than proceeding, so
	 * the coupling is loud there rather than silent. Written down instead of hidden, because a
	 * per-asset index axis is a change to `ProjectIndexEntry` that every consumer inherits.
	 */
	private async loadedInProject(
		projectId: ProjectId,
		predicate: (o: AssetPriceOverride) => boolean,
	): Promise<Result<Loaded<AssetPriceOverride>[], RepositoryError>> {
		const byType = new Set(this.deps.index.getIdsByType('renovation-asset-price'));
		const ids = this.deps.index
			.getIdsByProject(projectId)
			.filter((id) => byType.has(id)) as AssetPriceOverrideId[];
		return this.hydrate(ids, predicate);
	}

	/** The unnarrowable one; see `loadedInProject` for why it is separate rather than a flag. */
	private async loadedEverywhere(
		predicate: (o: AssetPriceOverride) => boolean,
	): Promise<Result<Loaded<AssetPriceOverride>[], RepositoryError>> {
		return this.hydrate(this.deps.index.getIdsByType('renovation-asset-price') as AssetPriceOverrideId[], predicate);
	}

	private async hydrate(
		ids: readonly AssetPriceOverrideId[],
		predicate: (o: AssetPriceOverride) => boolean,
	): Promise<Result<Loaded<AssetPriceOverride>[], RepositoryError>> {
		const loaded: Loaded<AssetPriceOverride>[] = [];
		for (const id of ids) {
			const found = await this.readById(id);
			if (isErr(found)) return found;
			if (found.value !== null && predicate(found.value.entity)) loaded.push(found.value);
		}
		return ok(loaded);
	}
}
```

`getForPair` and `listByProject` call `loadedInProject`; `listByAsset` calls `loadedEverywhere`.
Two named methods rather than one with a nullable `projectId`, because the difference is not a
parameter — it is which of them is vault-coupled, and a caller reading the name is told.

**If `readNoteBackedEntity`'s signature does not accept a closure for the mapper**, read it and
adapt — the shape above assumes `(raw: unknown) => Result<TEntity, ValidationError>`, which is
how `requirementFromPersistence` is passed. Do not change the shared helper to suit this
repository without saying why in its docblock.

- [ ] **Step 8: Run the contract against the real repository**

Create `tests/infrastructure/obsidian/obsidianAssetPriceOverride.test.ts`. Build it on the
existing fixture-vault or fake-vault stack (`tests/helpers/repositoryStack.ts` — read it and
follow how the other Obsidian repository tests get theirs), running the SAME contract:

```ts
import { describe, expect, it } from 'vitest';
import { assetPriceOverrideRepositoryContract, makeOverride } from '../../contracts/asset-price-override-repository.contract';
// … plus the stack helpers this repository's siblings use.

assetPriceOverrideRepositoryContract(() => {
	// Construct the stack ONCE per fixture, then:
	//   newProject() — PLANT the note, do not save it. `contract.test.ts`'s own
	//     `registerOtherProject` is the shape and the reason: `plantNote(stack, path,
	//     'renovation-project', projectToPersistence(project, 1))` writes the note and its
	//     index entry SYNCHRONOUSLY, where `ObsidianProjectRepository.save` is a promise this
	//     member's signature has nowhere to await. Give the entity a GBP currency, since the
	//     read resolves it. A bare `createProjectId()` fails every save with
	//     `asset-price.project-folder-unresolved`, which is why this member exists at all.
	//   newAsset() — a catalogue asset id; the price note references it and no folder derives
	//     from it, so this one may be minted.
	//   touch() — edit the note's bytes without moving `revision`, the way the sibling
	//     Obsidian fixtures do for their own external-modification cases.
});

describe('ObsidianAssetPriceOverrideRepository', () => {
	/**
	 * The duplicate-pair rule, which only the note-backed repository can exercise: two notes,
	 * one pair. Asserting the warning ALONE would pass against a build that then refuses, so
	 * this asserts BOTH — a price still comes back.
	 */
	/**
	 * The vault-wide coupling, closed. Plant a MALFORMED price note in project A, then ask
	 * `getForPair` about project B — it must answer, because A's note is never read. Watch it
	 * fail against a build that hydrates every `renovation-asset-price` id: one broken note
	 * anywhere refuses every pair everywhere, and with it every assign and recalculation.
	 *
	 * And the other half, so the narrowing is not mistaken for tolerance: a malformed note in
	 * project B's OWN scope still refuses, because it might be the note being asked about, and
	 * skipping it would price the requirement at the catalogue default while saying nothing.
	 */
	it('answers for one project while another project holds an unreadable price note', async () => { … });
	it('refuses when the unreadable note is in the project being asked about', async () => { … });

	it('warns and returns one price when two notes name the same pair', async () => {
		// Save two overrides for the same (project, asset) pair, then getForPair.
		// expect(logger.warn).toHaveBeenCalledWith('asset-price.duplicate-pair', expect.anything());
		// expect(found).not.toBeNull();
	});
});
```

Fill both bodies from the sibling test's stack helpers — do not invent a second way to build a
vault. The contract's eight cases plus this one are what this step delivers.

- [ ] **Step 9: Full gate, then commit**

Run: `npm run check`

Watch for `analyze` reporting the new schema or mapper as an unused export — every one of them
has a caller by the end of this task. If it reports the folder constant as unused, you have
forgotten to use `assetPricesFolderFor` in the write spec.

```bash
# `tests/plugin` is here for the schema-version snapshot, which is the third suite the
# new MIGRATION_SET kind reddens — the other two are under tests/infrastructure.
git add src/infrastructure src/application/ports/ProjectIndex.ts \
        src/application/ports/diagnostics.ts tests/infrastructure tests/plugin \
        tests/vault/legacy-schema/README.md
git commit -m "feat(persistence): an override is a note in the project's own folder

A sixth entity type, a seventh diagnostic kind and an empty migration
table — the last of which the compiler demands, because MIGRATION_SET is
keyed by DiagnosticEntityKind.

The note is named by its own id, like every other nameless entity here:
NoteWriteSpec.entryName is a pure function of the entity, so the friendlier
name the task document's example implies would need an assetName copied
onto the entity. A duplicated pair warns and last-writer-wins rather than
refusing — these are user-editable markdown files.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01G1z4YErxsacXRBUXoH94T8"
```

---

### Task 4: the two commands

**Files:**
- Create: `src/application/commands/asset-price/priceRowExpectation.ts`
- Create: `src/application/commands/asset-price/SetAssetPriceOverride.ts`
- Create: `src/application/commands/asset-price/ClearAssetPriceOverride.ts`
- **Move** `checkExpectedVersion` from `src/infrastructure/obsidian/repositories/versionCheck.ts`
  into `src/application/ports/versioning.ts`, beside the error factories it returns, and update
  its importers. Six in `src/` — `noteEntityWrite.ts`, `ObsidianProjectRepository.ts`,
  `ObsidianPlanRepository.ts`, `ObsidianZoneRepository.ts`, `PlanGeometryStore.ts`,
  `persistence/in-memory/checkExpected.ts` — **and one in `tests/`**:
  `tests/infrastructure/obsidian/repositories/completion.test.ts`, which calls it directly at
  its lines 301–302. That import is a JOINT one — `{ versionOfFrontmatter, checkExpectedVersion }`
  from `versionCheck` — so it has to be SPLIT rather than repointed: `versionOfFrontmatter`
  stays behind because it reads frontmatter. `tsconfig.json`'s `include` is `src/**` plus
  `tests/**`, so a `tests/` importer left pointing at the old home fails `npm run build`
  exactly as a `src/` one would, and this task's promised green commit does not happen.
  Measure the list rather than copying this one: `grep -rn "checkExpectedVersion" src/ tests/`
  before the move, and again after, is what says it is complete.
  A pure move: no behaviour changes, and every existing conditional-write case is the check
  on that.
- Test: `tests/application/commands/asset-price/setAssetPriceOverride.test.ts`
- Test: `tests/application/commands/asset-price/clearAssetPriceOverride.test.ts`

**Interfaces:**
- Consumes: Tasks 1–3; `ProjectRepository`, `AssetRepository`, `EventBus`, `Command`.
- Produces:
  - `class SetAssetPriceOverrideCommand implements Command<SetAssetPriceOverrideInput, Result<SetAssetPriceOverrideResult, SetAssetPriceOverrideErrors>>`
    with `SetAssetPriceOverrideInput = { projectId: ProjectId; assetId: AssetId; unitCost: Money; expected: PriceRowExpectation }`
    — **`expected` was missing from this summary while the interface below carries it**, which is
    two copies of one type disagreeing, the defect class this plan keeps producing. Found while
    verifying round 46 rather than reported.
    and `SetAssetPriceOverrideResult = { override: AssetPriceOverride; created: boolean; version: EntityVersion }`.
  - `class ClearAssetPriceOverrideCommand` with
    `ClearAssetPriceOverrideInput = { projectId: ProjectId; assetId: AssetId; expected: PriceRowExpectation }`
    — the same expectation, for the same reason: clearing a pair that has moved discards a price
    the user never saw.
    and a `{ cleared: boolean }` result.
  - `AssetPriceOverrideChanged` is published by BOTH — see Task 7, which subscribes to it.

- [ ] **Step 0: The expectation type and its check**

Its own module — `src/application/commands/asset-price/priceRowExpectation.ts` — because BOTH
commands use it, so putting it in either would make the other import a sibling command.

It must live in **Task 4**, not Task 5: the commands here call it, so a definition deferred to a
later task leaves this task's commit red. (It was in Task 5's `resolveEffectiveUnitCost.ts` for
one commit, which is a task-ordering error of exactly the kind this plan's green-on-its-own claim
exists to prevent.)

```ts
import type { ValidationError } from '../../../core/errors/AppError';
import type { EntityVersion, Loaded } from '../../ports/versioning';
import { checkExpectedVersion, revisionConflict } from '../../ports/versioning';
import type { AssetPriceOverride } from '../../../domain/asset-price/AssetPriceOverride';
import type { AssetPriceOverrideId } from '../../../domain/asset-price/AssetPriceOverrideId';

/**
 * What a rendered row believed about its pair: nothing, or one specific note at one version.
 * ONE field rather than two, so the id and the version cannot disagree.
 */
export type PriceRowExpectation = 'absent' | { readonly id: AssetPriceOverrideId; readonly version: EntityVersion };

/**
 * **Did the pair move under the caller since their row rendered?**
 *
 * This is `checkExpectedVersion` — the function `versionCheck.ts` already calls *"the ONE
 * comparison behind every conditional write"* — with an identity check in front of it. An
 * earlier draft of this plan hand-rolled a `revision`-only comparison here, which was wrong
 * three ways and is worth recording rather than quietly replacing:
 *
 * - it dropped `EntityVersion.observed`, whose whole job is to detect *"a change no plugin
 *   made (a hand edit, a sync)"* — the exact case this increment's own residuals say to
 *   expect, since these notes are user-editable;
 * - it collapsed two distinct outcomes into one code, where the vocabulary deliberately
 *   separates `revisionConflict` (another plugin writer) from `externalModification` (a hand
 *   edit) *"because the recoveries differ"*;
 * - and it recreated a duplication this repository had **already deleted once**:
 *   `checkExpected.ts` records that the in-memory store held its own copy of
 *   revision-then-token, "identical to `checkExpectedVersion` line for line".
 *
 * `checkExpectedVersion` therefore MOVES to `application/ports/versioning.ts`, beside the two
 * error factories it already returns. It is pure — its only imports are that vocabulary — and
 * it sits in `infrastructure/obsidian/` today by accident of who first needed it, which
 * `application/` may not import from. `versionOfFrontmatter` stays behind, because it reads
 * frontmatter. The move updates the importers named in Task 4's file list; it changes no
 * behaviour, and the existing suites are the check on that.
 *
 * The IDENTITY half is what `checkExpectedVersion` cannot answer, and it matters only because
 * duplicates are tolerated here: the row rendered one specific note, and a different note for
 * the same pair can carry the same revision. So the expectation is `{ id, version }` rather
 * than a bare version — one field the row fills from `overrideId`/`overrideVersion` together,
 * so the two cannot disagree.
 */
export function expectationMismatch(
	expected: PriceRowExpectation,
	found: Loaded<AssetPriceOverride> | null,
): ValidationError | null {
	if (expected === 'absent') {
		return found === null ? null : revisionConflict('asset-price', 'absent');
	}
	// A DIFFERENT note now wins the pair. Same revision is no comfort: ids are ULIDs and a
	// duplicate's winner can change without any revision moving.
	if (found !== null && found.entity.id !== expected.id) {
		return revisionConflict('asset-price', String(found.entity.id));
	}
	return checkExpectedVersion('asset-price', String(expected.id), found?.version, expected.version);
}

```

- [ ] **Step 1: Add the event**

`src/domain/asset-price/AssetPriceOverride.events.ts`:

```ts
import type { DomainEvent } from '../../core/events/EventBus';
import type { ProjectId } from '../project/ProjectId';
import type { AssetId } from '../asset/AssetId';

/**
 * BOTH ids, and the pair is the point. `AssetUpdated` carries the asset alone because a
 * shared default moved for every project; a price override moved for exactly ONE, and the
 * cascade this drives is narrowed by that project. A payload carrying only the asset would
 * make the narrowing unexpressible and the cascade would touch every project on the asset.
 *
 * ONE event for set, replace and clear alike: every subscriber's question is "this project's
 * price for this asset may have moved", and three events would be three subscriptions
 * answering it identically.
 */
export interface AssetPriceOverrideEventPayload {
	readonly projectId: ProjectId;
	readonly assetId: AssetId;
}

export interface AssetPriceOverrideChanged extends DomainEvent<'AssetPriceOverrideChanged'> {
	readonly payload: AssetPriceOverrideEventPayload;
}

export function assetPriceOverrideChanged(
	payload: AssetPriceOverrideEventPayload,
): AssetPriceOverrideChanged {
	return { type: 'AssetPriceOverrideChanged', payload };
}
```

- [ ] **Step 2: Write the failing command tests**

Create `tests/application/commands/asset-price/setAssetPriceOverride.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { SetAssetPriceOverrideCommand } from '../../../../src/application/commands/asset-price/SetAssetPriceOverride';
import { of as moneyOf } from '../../../../src/core/money/Money';
import { expectOk } from '../../../helpers/domain';
// Build deps from the in-memory repositories and a recording bus, following the
// sibling command tests under tests/application/commands/requirement/.

describe('SetAssetPriceOverrideCommand', () => {
	it('creates an override for a pair that has none, and reports created', async () => {
		// seed: a GBP project, an EUR-priced asset
		const result = expectOk(await command.execute({ projectId, assetId, unitCost: moneyOf('19.50', 'GBP'), expected: 'absent' }));
		expect(result.created).toBe(true);
		expect(result.override.unitCost.amount).toBe('19.50');
	});

	it('replaces the existing override for a pair that has one, and reports created false', async () => {
		const first = expectOk(await command.execute({ projectId, assetId, unitCost: moneyOf('19.50', 'GBP'), expected: 'absent' }));
		const second = expectOk(await command.execute({
			projectId,
			assetId,
			unitCost: moneyOf('21.00', 'GBP'),
			expected: { id: first.override.id, version: first.version },
		}));
		expect(second.created).toBe(false);
		expect(second.override.unitCost.amount).toBe('21.00');
		const listed = expectOk(await overrides.listByProject(projectId));
		expect(listed).toHaveLength(1);
	});

	/**
	 * The coherence rule, which is this command's rather than the entity's (spec Decision 2).
	 * Watch it fail with the check deleted: the entity accepts any currency by design, so
	 * nothing else in the suite refuses this.
	 */
	it('refuses a price that is not in the project currency', async () => {
		const result = await command.execute({ projectId, assetId, unitCost: moneyOf('19.50', 'EUR'), expected: 'absent' });
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('unreachable');
		expect(result.error.code).toBe('asset-price.currency-mismatch');
	});

	it('refuses when the project is not there', async () => {
		const result = await command.execute({
			projectId: createProjectId(),
			assetId,
			unitCost: moneyOf('1.00', 'GBP'),
			expected: 'absent',
		});
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('unreachable');
		expect(result.error.code).toBe('asset-price.project-not-found');
	});

	it('refuses when the asset is not there', async () => {
		const result = await command.execute({
			projectId,
			assetId: createAssetId(),
			unitCost: moneyOf('1.00', 'GBP'),
			expected: 'absent',
		});
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('unreachable');
		expect(result.error.code).toBe('asset-price.asset-not-found');
	});

	/**
	 * The no-op set, and the rule the clear command already keeps: nothing to change, so nothing
	 * is written and nothing is announced. Assert ALL THREE — no publish, no revision bump, and
	 * `created: false` — because "the price is 19.50 afterwards" is equally true of the build
	 * that saves and cascades for nothing, which is what makes this case worth writing.
	 */
	it('writes nothing and announces nothing when the submitted price already holds', async () => {
		const first = expectOk(await command.execute({ projectId, assetId, unitCost: moneyOf('19.50', 'GBP'), expected: 'absent' }));
		bus.published.length = 0;
		const again = expectOk(await command.execute({
			projectId,
			assetId,
			unitCost: moneyOf('19.50', 'GBP'),
			expected: { id: first.override.id, version: first.version },
		}));
		expect(again.created).toBe(false);
		expect(again.version.revision).toBe(first.version.revision);
		expect(bus.published).toHaveLength(0);
	});

	/**
	 * The same rule against a DIFFERENT SPELLING of the same price. `createMoney` normalizes
	 * nothing, so `19.5` and `19.50` are two strings for one value — and a string comparison
	 * calls this a change, writes, publishes, and recalculates every requirement for the asset
	 * in the project. Watch it fail with the amount compared as a string.
	 */
	it('writes nothing when the submitted price differs only in spelling', async () => {
		const first = expectOk(await command.execute({ projectId, assetId, unitCost: moneyOf('19.50', 'GBP'), expected: 'absent' }));
		bus.published.length = 0;
		const again = expectOk(await command.execute({
			projectId,
			assetId,
			unitCost: moneyOf('19.5', 'GBP'),
			expected: { id: first.override.id, version: first.version },
		}));
		expect(again.version.revision).toBe(first.version.revision);
		expect(bus.published).toHaveLength(0);
	});

	/**
	 * And the ORDER, which one assertion on the case above cannot show: the expectation is
	 * checked BEFORE the no-op test, so a stale row is refused even when its value happens to
	 * match. Watch it fail with the two swapped — this passes, and the conditional write has
	 * quietly become conditional on the data.
	 */
	it('refuses a stale row even when the submitted price equals the stored one', async () => {
		const first = expectOk(await command.execute({ projectId, assetId, unitCost: moneyOf('19.50', 'GBP'), expected: 'absent' }));
		const result = await command.execute({ projectId, assetId, unitCost: moneyOf('19.50', 'GBP'), expected: 'absent' });
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('unreachable');
		expect(result.error.code).toBe('asset-price.revision-conflict');
		expect(first.version.revision).toBe(1);
	});

	it('publishes AssetPriceOverrideChanged carrying BOTH ids', async () => {
		expectOk(await command.execute({ projectId, assetId, unitCost: moneyOf('19.50', 'GBP'), expected: 'absent' }));
		expect(bus.published).toContainEqual(
			expect.objectContaining({
				type: 'AssetPriceOverrideChanged',
				payload: { projectId, assetId },
			}),
		);
	});

	/**
	 * The stale row. The pair lock cannot see this one: it protects the command's own
	 * read-to-write window, and the window that matters opened when the section rendered.
	 * Watch it fail with the `expectationMismatch` call removed — without it the save conditions
	 * on the NEWEST revision and succeeds, erasing a price the user never saw.
	 */
	it('refuses a submission whose row was rendered before someone else moved the price', async () => {
		const first = expectOk(await command.execute({ projectId, assetId, unitCost: moneyOf('19.50', 'GBP'), expected: 'absent' }));
		// Another leaf moves it while the user's row still shows 19.50.
		expectOk(await command.execute({
			projectId,
			assetId,
			unitCost: moneyOf('30.00', 'GBP'),
			expected: { id: first.override.id, version: first.version },
		}));

		const stale = await command.execute({
			projectId,
			assetId,
			unitCost: moneyOf('21.00', 'GBP'),
			expected: { id: first.override.id, version: first.version },
		});
		expect(stale.ok).toBe(false);
		if (stale.ok) throw new Error('unreachable');
		expect(stale.error.code).toBe('asset-price.revision-conflict');

		// And the intervening price is untouched, which is the half that matters.
		const found = expectOk(await overrides.getForPair(projectId, assetId));
		expect(found?.entity.unitCost.amount).toBe('30.00');
	});

	/**
	 * The arm a revision-only check misses, and the reason `observed` is compared: a hand edit
	 * or a sync changes the note without moving `revision`. `externalModification`, not
	 * `revisionConflict` — two codes because the recoveries differ.
	 */
	it('refuses when the note was edited outside the plugin without a revision bump', async () => {
		const first = expectOk(await command.execute({ projectId, assetId, unitCost: moneyOf('19.50', 'GBP'), expected: 'absent' }));
		await editNoteOutsideThePlugin(first.override.id); // same revision, new observed token
		const stale = await command.execute({
			projectId, assetId, unitCost: moneyOf('21.00', 'GBP'),
			expected: { id: first.override.id, version: first.version },
		});
		expect(stale.ok).toBe(false);
		if (stale.ok) throw new Error('unreachable');
		expect(stale.error.code).toBe('asset-price.external-modification');
	});

	/**
	 * The arm the IDENTITY check exists for, reachable only because duplicates are tolerated:
	 * a different note wins the pair, at the same revision.
	 */
	it('refuses when a different note now wins the pair at the same revision', async () => { … });

	/** The other arm: a row that showed NO price, when someone else has since set one. */
	it('refuses an absent-expectation submission when a price now exists', async () => {
		expectOk(await command.execute({ projectId, assetId, unitCost: moneyOf('30.00', 'GBP'), expected: 'absent' }));
		const stale = await command.execute({ projectId, assetId, unitCost: moneyOf('21.00', 'GBP'), expected: 'absent' });
		expect(stale.ok).toBe(false);
	});

	/**
	 * The pair lock, driven as a real race: two executions started before either awaits. Both
	 * read `getForPair === null` without it, mint different ULIDs, and both inserts succeed
	 * under `'absent'` — the duplicate-pair state this design tolerates in a hand-edited vault
	 * and must never manufacture. Watch it fail with the `locks.acquire` removed.
	 */
	it('lets one racing create win and refuses the other, leaving one override', async () => {
		const [a, b] = await Promise.all([
			command.execute({ projectId, assetId, unitCost: moneyOf('19.50', 'GBP'), expected: 'absent' }),
			command.execute({ projectId, assetId, unitCost: moneyOf('21.00', 'GBP'), expected: 'absent' }),
		]);

		// **One ok, one conflict — not two oks.** An earlier draft asserted both succeeded,
		// which was written before the expectation check existed and contradicts it: the
		// second caller's row also said `'absent'`, and by the time the lock lets it through
		// a price exists, so its view is stale and it must be refused. Asserting two oks would
		// have invited weakening the very protection the round before added.
		const results = [a, b];
		expect(results.filter((r) => r.ok)).toHaveLength(1);
		const refused = results.find((r) => !r.ok);
		expect(refused && !refused.ok && refused.error.code).toBe('asset-price.revision-conflict');
		expect(expectOk(await overrides.listByAsset(assetId))).toHaveLength(1);
	});

	/**
	 * The LOCK is still what this pair proves, and it is worth saying which mutation reddens
	 * which: without the lock both callers read `null`, both satisfy `'absent'`, and both
	 * create — two oks and two notes. Without the expectation check the second overwrites
	 * rather than refusing — two oks and one note. The assertions above discriminate all three
	 * outcomes, which one `toHaveLength(1)` alone would not.
	 */

	/**
	 * A failed WRITE must not announce. Otherwise the cascade recalculates against a price
	 * that was never persisted, and every requirement it touches is derived from a figure no
	 * note holds.
	 */
	it('publishes nothing when the save fails', async () => {
		vi.spyOn(overrides, 'save').mockResolvedValue(err(persistenceError('asset-price.write-failed', 'no')));
		const result = await command.execute({ projectId, assetId, unitCost: moneyOf('19.50', 'GBP'), expected: 'absent' });
		expect(result.ok).toBe(false);
		expect(bus.published).toHaveLength(0);
	});
});
```

Write the sibling `clearAssetPriceOverride.test.ts` with: clears an existing override and
reports `cleared: true`; reports `cleared: false` and publishes NOTHING for a pair that has
none (there is nothing to invalidate, so a cascade would be pure cost); publishes
`AssetPriceOverrideChanged` when it did clear one; and propagates a failed delete without
publishing.

`expected` is REQUIRED on this command too, so every one of those carries what its row
believed: `'absent'` for the pair that has none, and `{ id: seeded.entity.id, version:
seeded.version }` — built from what `overrides.save` handed back — for the ones that clear.
Reaching for a bare `seeded.version` does not compile, which is the field being one thing
rather than two.

Plus the one that only a hand-edited vault can reach, and which a `getForPair`-based clear
fails:

```ts
	/**
	 * Two notes for one pair — the state the READ deliberately tolerates. A clear that deletes
	 * only the one `getForPair` returned reports success, runs the cascade, and leaves the
	 * project still holding a price. Seed the duplicate through the repository directly; the
	 * command cannot produce it, which is the point of the lock case above.
	 */
	it('clears every note for the pair, not just the one the read returns', async () => {
		expectOk(await overrides.save(makeOverride(projectId, assetId, '19.50'), 'absent'));
		// The WINNER, and it is the second deliberately: ids are monotonic ULIDs, so the later
		// save mints the higher one and `winningDuplicate` returns it. That is the note the
		// row rendered, so it is the note the expectation names.
		const winner = expectOk(await overrides.save(makeOverride(projectId, assetId, '21.00'), 'absent'));
		const expected = { id: winner.entity.id, version: winner.version };
		expect(expectOk(await command.execute({ projectId, assetId, expected })).cleared).toBe(true);
		expect(expectOk(await overrides.listByAsset(assetId))).toHaveLength(0);
	});
```

And the one that only a partial failure reaches. `seedPair` is a local helper in this file:
it saves two notes for the pair through the repository and hands back `{ id, version }` for the
winner, which is what every clear in the file needs and what the command itself cannot produce.

**It is `async`, and both call sites `await` it** — the saves go through a Promise-returning
port, so there is no synchronous version of it to write. An earlier draft called it unawaited
and passed the `Promise` as `expected`, which does not type-check; that is the opposite of the
contract fixture two tasks earlier, where the fixture member is synchronous BECAUSE it plants
rather than saves. Same helper name, two different constraints, and which one applies is
decided by whether the seeding goes through the repository.

```ts
	/**
	 * A partial clear HAS written. The survivor is now the effective price, so a cascade that
	 * never hears about it leaves every requirement derived from the note that is gone. Asserting
	 * only the refusal passes against a build that stays silent.
	 */
	it('announces what it deleted even when a later delete fails', async () => {
		// Seed two notes for the pair, then fail the SECOND delete — which, with the winner
		// deleted first, is a losing duplicate, so the effective price really has moved.
		const winner = await seedPair(projectId, assetId);
		const result = await command.execute({ projectId, assetId, expected: winner });
		expect(result.ok).toBe(false);
		expect(bus.published).toContainEqual(
			expect.objectContaining({ type: 'AssetPriceOverrideChanged', payload: { projectId, assetId } }),
		);
	});

	/** And the other side, so the rule is not "always announce": a FIRST delete that fails
	 *  has written nothing, so there is nothing to announce. */
	/**
	 * The first delete is the WINNER's, so its failure means the effective price never moved —
	 * which is why this case and the one above disagree about announcing. Watch it fail against
	 * a loop that deletes in `listByAsset` order: a losing duplicate goes first, succeeds, and
	 * the command announces a change nobody made.
	 */
	it('announces nothing when the first delete fails', async () => {
		const winner = await seedPair(projectId, assetId);
		const result = await command.execute({ projectId, assetId, expected: winner });
		expect(result.ok).toBe(false);
		expect(bus.published).toHaveLength(0);
	});
```

- [ ] **Step 3: Run and watch them fail**

Run: `npx vitest run tests/application/commands/asset-price/`
Expected: FAIL — cannot resolve either command.

- [ ] **Step 4: Write `SetAssetPriceOverride`**

```ts
import { err, isErr, ok, type Result } from '../../../core/result/Result';
import type { ReferenceError, ValidationError } from '../../../core/errors/AppError';
import type { RepositoryError } from '../../ports/repositoryErrors';
import type { EventBus } from '../../../core/events/EventBus';
import type { Money } from '../../../core/money/Money';
import type { ProjectId } from '../../../domain/project/ProjectId';
import type { AssetId } from '../../../domain/asset/AssetId';
import { AssetPriceOverride } from '../../../domain/asset-price/AssetPriceOverride';
import { createAssetPriceOverrideId } from '../../../domain/asset-price/AssetPriceOverrideId';
import { assetPriceError } from '../../../domain/asset-price/AssetPriceOverride.errors';
import { assetPriceOverrideChanged } from '../../../domain/asset-price/AssetPriceOverride.events';
import type { AssetPriceOverrideRepository } from '../../ports/AssetPriceOverrideRepository';
import type { ProjectRepository } from '../../ports/ProjectRepository';
import type { AssetRepository } from '../../ports/AssetRepository';
import type { ReferenceLocks } from '../../reference/ReferenceLocks';
import { referenceError } from '../../errors';
import type { Command } from '../Command';
import type { EntityVersion } from '../../ports/versioning';
// The module this task creates one step earlier. Both symbols are used below — the type in
// `SetAssetPriceOverrideInput.expected`, the function in `upsert` — and an earlier draft of
// this block declared neither, which is a build failure at the very task that writes them.
import { expectationMismatch, type PriceRowExpectation } from './priceRowExpectation';
import { compare as compareMoney } from '../../../core/money/Money';
import { isOk } from '../../../core/result/Result';

/**
 * **Same price, whatever it is spelled like.** Currency first, then VALUE — `Money.compare`
 * refuses a currency mismatch, so it is safe only behind that test, and it is the only thing
 * that answers the question: `createMoney` stores the amount string verbatim, so `19.5` and
 * `19.50` are two spellings of one price.
 *
 * A named function rather than an expression at the call site, because an earlier draft of
 * this block wrote it inline as `sameCurrency && compareMoney(...)` and did not type-check at
 * all: that is `false | Result<…>`, which `isOk` does not accept. The guard has to narrow
 * before the `Result` is examined, and a function is where a guard narrows cleanly.
 */
function samePrice(a: Money, b: Money): boolean {
	if (a.currency !== b.currency) return false;
	const ordering = compareMoney(a, b);
	return isOk(ordering) && ordering.value === 0;
}
```

**This function moves to `core/money/Money.ts` as `sameMoney` in Task 6, and the two tasks must
not both define it.** Task 6 needs the identical question for `assetMatchesCalculatedFrom`, whose
string comparison reads `19.5` and `19.50` as different money — see that task for the defect and
why `Money.compare` alone is not the answer. Write it here as `samePrice` local to this file if
Task 4 lands first, and MOVE it in Task 6 rather than leaving a second copy; a question worth
asking at two doors is a function, which is this plan's own rule and the reason the shared
predicate had a comparison bug for a round.

```ts

export interface SetAssetPriceOverrideInput {
	readonly projectId: ProjectId;
	readonly assetId: AssetId;
	readonly unitCost: Money;
	/**
	 * **What the caller's row said about this pair when it rendered** — `'absent'` for a row
	 * showing no price, or the override's version for one showing a price. REQUIRED, like every
	 * other member here, because an optional expectation is one a caller can silently omit and
	 * get a blind overwrite.
	 *
	 * Without it this command is a lost update. The pair lock protects the command's own
	 * read-to-write window and nothing longer: the section hydrates at 19.50, another leaf (or
	 * sync, or a hand edit) moves it to 30.00, the user edits the row they can still see and
	 * submits 21.00 — and `getForPair` returns the 30.00 entity, so the save conditions on THAT
	 * revision and succeeds, erasing a price the user never saw.
	 *
	 * `PriceRowExpectation` is `'absent' | { id, version }` — the id because duplicates are
	 * tolerated here, so a different note can win the pair at the same revision; the two travel
	 * as ONE field so they cannot disagree.
	 */
	readonly expected: PriceRowExpectation;
}

export interface SetAssetPriceOverrideResult {
	readonly override: AssetPriceOverride;
	readonly created: boolean;
	readonly version: EntityVersion;
}

export type SetAssetPriceOverrideErrors = ValidationError | ReferenceError | RepositoryError;

export interface SetAssetPriceOverrideDeps {
	readonly overrides: AssetPriceOverrideRepository;
	readonly projects: ProjectRepository;
	readonly assets: AssetRepository;
	readonly events: EventBus;
	/** Serializes the check-then-act on the pair; see the header. */
	readonly locks: ReferenceLocks;
}

/**
 * A project records its own price for a shared catalogue Asset — the affordance that turns
 * `cost.currency-mismatch` from a dead end into something a user can act on.
 *
 * Upsert on the PAIR, not on an id: the id is a ULID the caller does not hold, and "set the
 * price for this asset in this project" is one intent whether or not a note already exists.
 * `created` is reported rather than inferred, the same way `AssignAssetCommand` reports its
 * own.
 *
 * Both endpoints are checked because both can be gone: the project supplies the currency the
 * entity validates against, and an override for an asset that does not exist is a dangling
 * reference nothing would ever read.
 *
 * **The announcement is after the save and only after a successful one.** A cascade driven by
 * an announcement whose write failed would recalculate every requirement in the project
 * against a price no note holds.
 *
 * **Both ids are locked for the whole upsert, as ONE sorted batch.** `getForPair` then `save`
 * is check-then-act, and `'absent'` is keyed by the entity's own id — so two concurrent
 * executions would each read `null`, mint DIFFERENT ULIDs, and both inserts would succeed,
 * manufacturing the duplicate-pair state this design tolerates in hand-edited vaults but must
 * never create itself. The repository's `KeyedQueues` cannot help: it is keyed by id, and the
 * two ids differ. This is `AssignAssetCommand`'s own mechanism (`AssignAsset.ts:101`) and its
 * own reason — *"two tabs assigning concurrently serialize here, the second taking the
 * idempotent path"* — applied to the same shape of race.
 */
export class SetAssetPriceOverrideCommand
	implements Command<SetAssetPriceOverrideInput, Result<SetAssetPriceOverrideResult, SetAssetPriceOverrideErrors>>
{
	constructor(private readonly deps: SetAssetPriceOverrideDeps) {}

	async execute(
		input: SetAssetPriceOverrideInput,
	): Promise<Result<SetAssetPriceOverrideResult, SetAssetPriceOverrideErrors>> {
		const release = await this.deps.locks.acquire([input.projectId, input.assetId], []);
		try {
			return await this.upsert(input);
		} finally {
			release();
		}
	}

	private async upsert(
		input: SetAssetPriceOverrideInput,
	): Promise<Result<SetAssetPriceOverrideResult, SetAssetPriceOverrideErrors>> {
		const project = await this.deps.projects.getById(input.projectId);
		if (isErr(project)) return project;
		if (project.value === null) {
			return err(
				referenceError('asset-price.project-not-found', `Project ${input.projectId} is not there.`),
			);
		}
		const asset = await this.deps.assets.getById(input.assetId);
		if (isErr(asset)) return asset;
		if (asset.value === null) {
			return err(referenceError('asset-price.asset-not-found', `Asset ${input.assetId} is not there.`));
		}

		const existing = await this.deps.overrides.getForPair(input.projectId, input.assetId);
		if (isErr(existing)) return existing;
		const stale = expectationMismatch(input.expected, existing.value);
		if (stale) return err(stale);

		// **The coherence rule lives HERE** (spec Decision 2), not on the entity: the project's
		// currency is another entity's fact, and the entity's constructor is on the hydration
		// path, where enforcing it would refuse a stranded note at the read instead of showing
		// it. This is where a user's intent arrives, so it is where a refusal is actionable.
		//
		// It is not the guard Amendment 1 item 4 withdrew. That one duplicated a check on the
		// very path it sat in front of; the pipeline is not invoked at all when a price is set,
		// so without this a GBP price on a EUR project succeeds silently and the user finds out
		// at the next assign — the failure this whole increment exists to end.
		const currency = project.value.entity.currency;
		if (input.unitCost.currency !== currency) {
			return err(
				assetPriceError(
					'currency-mismatch',
					`A price override must be in the project's currency (${currency}); `
						+ `got ${input.unitCost.amount} ${input.unitCost.currency}.`,
				),
			);
		}

		// **It does NOT double as a repair for an out-of-band edit**, which Task 7's residual
		// used to claim it did: after a sync moves the note, the section shows the new value, so
		// retyping what is on screen lands here and the requirements stay derived from the old
		// figure. That recovery is CLEAR then SET, and the residual says so now. A command
		// cannot tell the two submissions apart — both equal what is stored — so this rule
		// keeps the case it can decide and the residual names the gesture that works.
		//
		// **A set that changes nothing writes nothing and announces nothing**, which is the same
		// rule the clear command already keeps one file over: it reports `cleared: false` and
		// publishes NOTHING for a pair that has no override, "there is nothing to invalidate, so
		// a cascade would be pure cost". Setting a price to the value it already holds is that
		// case from the other side — a user who edits the field and puts the original value back
		// — and without this it saves a revision and publishes, and Task 7's subscriber performs
		// no skip test by design, so every requirement for that asset in that project is
		// recalculated because nothing moved.
		//
		// AFTER the expectation check, deliberately. A submission that happens to match the
		// stored value is not evidence that the caller saw it: expected `'absent'` against an
		// existing note is a stale row whatever it holds, and letting a value coincidence
		// through would make the conditional write conditional on the DATA rather than on what
		// the caller knew — and would quietly turn the concurrent-create case below into a pass
		// whenever both callers happen to submit the same price.
		//
		// **CURRENCY by field, AMOUNT by value**, and an earlier draft compared both as strings.
		// `createMoney` stores the amount VERBATIM — it validates the spelling and normalizes
		// nothing — so `19.5` and `19.50` are two strings for one price, and a user retyping
		// their own price without the trailing zero would have bumped the revision, published,
		// and recalculated every requirement for that asset in the project. The no-op rule this
		// sits under exists to stop exactly that.
		//
		// `Money.compare` is the value comparison, and it is safe HERE only because the
		// currency test runs first: it returns a `Result` and REFUSES a mismatch, which is the
		// state this whole increment is about. That ordering is the rule — an earlier note in
		// this file said "never `Money.compare`" without it, which is true of an unguarded call
		// and wrong as a blanket ban. The coherence rule above has already refused a foreign
		// currency, so the field test is belt-and-braces; it is kept, because this predicate
		// must stay correct if that rule ever moves.
		const unchanged = existing.value !== null && samePrice(existing.value.entity.unitCost, input.unitCost);
		if (unchanged) {
			return ok({
				override: existing.value.entity,
				created: false,
				// The CURRENT version, so a caller's row snapshot adopts the truth rather than
				// holding whatever it believed before this call.
				version: existing.value.version,
			});
		}

		const next = existing.value === null
			? AssetPriceOverride.create({
				id: createAssetPriceOverrideId(),
				projectId: input.projectId,
				assetId: input.assetId,
				unitCost: input.unitCost,
			})
			: existing.value.entity.withUnitCost(input.unitCost);
		if (isErr(next)) return next;

		const saved = await this.deps.overrides.save(
			next.value,
			existing.value === null ? 'absent' : existing.value.version,
		);
		if (isErr(saved)) return saved;

		await this.deps.events.publish(
			assetPriceOverrideChanged({ projectId: input.projectId, assetId: input.assetId }),
		);
		return ok({
			override: saved.value.entity,
			created: existing.value === null,
			version: saved.value.version,
		});
	}
}
```

- [ ] **Step 5: Write `ClearAssetPriceOverride`**

Same shape, and the one decision worth its own comment:

```ts
/**
 * Removing a project's own price, so the shared catalogue default applies again.
 *
 * **A pair with no override reports `cleared: false` and announces NOTHING.** Nothing moved,
 * so the cascade it would drive is pure cost — and an announcement for a no-op is exactly how
 * a subscriber comes to recalculate a project's whole requirement set because a user clicked
 * a control twice.
 *
 * **It clears the PAIR, not one note**, and that is the difference between this command and
 * `getForPair`. The read tolerates a duplicated pair and answers one of them, deliberately,
 * because these are user-editable markdown files. Clearing has to be stricter: deleting only
 * the note the read happened to return leaves the other one standing, so the next read still
 * finds an override — the user pressed "use the library price", was told it worked, saw the
 * cascade run, and still has their own price. `cleared: true` must mean the project has no
 * price for this asset.
 *
 * Locked on the pair for the same reason `SetAssetPriceOverrideCommand` is: list-then-delete
 * is check-then-act.
 */
export class ClearAssetPriceOverrideCommand … {
	async execute(input: ClearAssetPriceOverrideInput): Promise<Result<{ cleared: boolean }, …>> {
		const release = await this.deps.locks.acquire([input.projectId, input.assetId], []);
		try {
			// **Filtered rather than `getForPair`, because every note for the pair has to go —
			// and `listByProject`, NOT `listByAsset`, because this command has the project.**
			//
			// An earlier draft read `listByAsset` and filtered by project, arguing list length:
			// "a shared asset is priced by few projects, where a project may hold many assets."
			// That is true and it is the wrong axis to optimise. `listByAsset` calls
			// `loadedEverywhere` — the index has no asset axis, so it cannot be narrowed and
			// hydrates every asset-price note in the VAULT. One malformed note in one unrelated
			// project therefore refuses the hydration, and "Use the library price" stops working
			// for every healthy pair everywhere. `listByProject` calls `loadedInProject`, so the
			// blast radius of a malformed note is the project that contains it.
			//
			// It still finds every DUPLICATE for the pair, which is what `getForPair` cannot do:
			// duplicates are two notes with the same (project, asset), both inside the project's
			// folder, so both are in this list.
			//
			// The same narrowing was applied to `getForPair` and `listByProject` in an earlier
			// round, for this same hazard, and this call site was left on the vault-wide method —
			// the fix applied to the sites in the report and not to the class.
			const listed = await this.deps.overrides.listByProject(input.projectId);
			if (isErr(listed)) return listed;
			const forPair = listed.value.filter((o) => o.entity.assetId === input.assetId);

			// The same question the set command asks, against the WINNER — the note the row was
			// rendered from. Clearing a pair that has moved is as much a lost update as
			// overwriting one: the user discards a price they never saw.
			const stale = expectationMismatch(input.expected, winningDuplicate(forPair));
			if (stale) return err(stale);

			if (forPair.length === 0) return ok({ cleared: false });

			// **The WINNER is deleted first, and the order is what makes the rule below true.**
			// `forPair` arrives in index order, so an earlier draft could delete a losing
			// duplicate, fail on the winner, and announce — a project-wide recalculation for an
			// effective price that had not moved at all, under a comment asserting the opposite.
			// Winner first makes `removed` mean what the next paragraph says it means.
			const winner = winningDuplicate(forPair);
			const ordered = winner === null
				? forPair
				: [winner, ...forPair.filter((o) => o.entity.id !== winner.entity.id)];

			// **Any write that landed is announced, even when a later one fails.** The rule this
			// file states elsewhere — a failed write must not announce — is about a command that
			// wrote NOTHING. A partial clear has written: the winner is gone, so the effective
			// price has moved to the survivor, and the cascade and every open pane are looking at
			// a figure derived from a note that no longer exists. Returning the failure without
			// the event leaves them there indefinitely, which is worse than the refusal itself.
			let removed = false;
			for (const override of ordered) {
				const deleted = await this.deps.overrides.delete(override.entity.id, override.version);
				if (isErr(deleted)) {
					if (removed) await this.announce(input);
					// Reported rather than swallowed: a partial clear leaves a price in force,
					// and saying `cleared: true` over it is the lie this method exists to avoid.
					return deleted;
				}
				removed = true;
			}

			await this.announce(input);
			return ok({ cleared: true });
		} finally {
			release();
		}
	}
}
```

- [ ] **Step 6: Run and watch them pass**

Run: `npx vitest run tests/application/commands/asset-price/`
Expected: PASS.

- [ ] **Step 7: Full gate, then commit**

Run: `npm run check`

```bash
# `src/application/ports` and `src/infrastructure` are the checkExpectedVersion MOVE: the
# function and its SEVEN importers, one of which is a test file — `tests` is already staged
# below, and it has to be, because `tests/**` is type-checked. Staging only the commands
# leaves the tree not building.
git add src/domain/asset-price/AssetPriceOverride.events.ts \
        src/application/commands/asset-price src/application/ports/versioning.ts \
        src/infrastructure tests
git commit -m "feat(commands): set and clear a project's own price

Upsert on the PAIR rather than on an id, because that is the user's intent
and the id is a ULID they do not hold. One event for set, replace and clear
alike, carrying BOTH ids — the asset alone would make the cascade's project
narrowing unexpressible. Clearing a pair that has no override announces
nothing: an announcement for a no-op is how a whole project's requirements
get recalculated because a control was clicked twice.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01G1z4YErxsacXRBUXoH94T8"
```

---

### Task 5: the resolution, and the witness

**Files:**
- Create: `src/application/commands/requirement/resolveEffectiveUnitCost.ts`
- Modify: `src/application/commands/requirement/AssignAsset.ts`
- Modify: `src/application/commands/requirement/RecalculateRequirement.ts`
- Modify: `src/plugin/composition-root.ts` — construct `ObsidianAssetPriceOverrideRepository`
  (Task 3) and pass it to `RecalculateRequirementCommand` (`:383`).
- Modify: `src/plugin/slice10Composition.ts` — `AssignAssetCommand` (`:150`).
- Modify: `src/presentation/editor/planEditorCommands.ts` — `AssignAssetCommand` (`:224`).
- Test: `tests/application/commands/requirement/effectiveUnitCost.test.ts`
- Test: `tests/application/commands/requirement/overrideSatisfiesRefusal.test.ts` (**the witness**)

**The wiring is in THIS task, not Task 8, and that is what makes the commit green.** A required
`overrides` member is a build error at every construction site the moment it exists, and there
are **three** — measured with
`grep -rn "new AssignAssetCommand\|new RecalculateRequirementCommand" src/`, not remembered.
Deferring the repository's construction to Task 8 would leave this task's `npm run check` red,
which contradicts the plan's own "each task ends green on its own".

**Interfaces:**
- Consumes: Task 2's port, Task 4's commands.
- Produces:
  - `resolveEffectiveUnitCost(overrides, projectId, asset): Promise<Result<Money, RepositoryError>>`
  - `effectiveUnitCostFrom(overridesByProject: ReadonlyMap<ProjectId, Money>, projectId, asset): Money`
    — the pure, batched sibling Task 6 uses.
- `AssignAssetDeps` and `RecalculateRequirementDeps` each gain
  `readonly overrides: AssetPriceOverrideRepository`.

**Read [`docs/issues/The cost pipeline is told the currency it must produce.md`](../../issues/The%20cost%20pipeline%20is%20told%20the%20currency%20it%20must%20produce.md)
before this task.** Its *Revisit when* is the witness below, and its "What was tried, and why
each was withdrawn" section is what stops you re-deriving three dead ends.

- [ ] **Step 1: Write the failing witness**

This is the increment's close condition and it comes first. Create
`tests/application/commands/requirement/overrideSatisfiesRefusal.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { of as moneyOf } from '../../../../src/core/money/Money';
import { expectOk } from '../../../helpers/domain';

/**
 * The Issue's own close condition, asserted end to end rather than argued:
 *
 *   "an assign that refuses on a currency mismatch, then a price override in the project's
 *    currency, then the SAME assign succeeding — satisfaction demonstrated rather than
 *    asserted."
 *
 * It is APPLICATION-level and mounts nothing, which is what lets it land here rather than
 * waiting for the surface. What it does NOT prove is that a user can reach it; that is Task 9,
 * and it is a different claim.
 */
describe('a price override satisfies the pipeline refusal', () => {
	it('turns a refused assign into a successful one, denominated in the project currency', async () => {
		// A GBP project, a zone in it, and an EUR-priced asset from the shared library.
		const first = await assignAsset.execute({ zoneId, assetId });
		expect(first.ok).toBe(false);
		if (first.ok) throw new Error('unreachable');
		expect(first.error.code).toBe('cost.currency-mismatch');

		// Nothing was created — the refusal is BEFORE any arithmetic and before any save.
		expect(expectOk(await requirements.listByZone(zoneId))).toHaveLength(0);

		expectOk(await setOverride.execute({ projectId, assetId, unitCost: moneyOf('19.50', 'GBP'), expected: 'absent' }));

		const second = expectOk(await assignAsset.execute({ zoneId, assetId }));
		expect(second.created).toBe(true);
		expect(second.requirement.estimatedCost.calculated.currency).toBe('GBP');
		// Derived from the OVERRIDE, not the catalogue default.
		expect(second.requirement.calculatedFrom.unitCost.amount).toBe('19.50');
		expect(second.requirement.calculatedFrom.unitCost.currency).toBe('GBP');
	});

	/**
	 * The other direction, so the witness is not green merely because the pipeline now accepts
	 * everything: an override in the WRONG currency cannot be created at all, so it can never
	 * become a way around the refusal.
	 */
	it('cannot be satisfied by an override in the asset currency', async () => {
		const refused = await setOverride.execute({
			projectId,
			assetId,
			unitCost: moneyOf('24.00', 'EUR'),
			expected: 'absent',
		});
		expect(refused.ok).toBe(false);
		const still = await assignAsset.execute({ zoneId, assetId });
		expect(still.ok).toBe(false);
	});
});
```

- [ ] **Step 2: Run it and watch it fail at the assertion**

Run: `npx vitest run tests/application/commands/requirement/overrideSatisfiesRefusal.test.ts`
Expected: FAIL — the second assign still refuses, because nothing resolves the override yet.

**Watch WHERE it fails.** A failure at "cannot resolve `SetAssetPriceOverrideCommand`" proves
nothing; the test must reach `expect(second.created)` and fail there. A red that proves nothing
reads exactly like a red that does.

- [ ] **Step 3: Write the resolution**

`src/application/commands/requirement/resolveEffectiveUnitCost.ts`:

```ts
import { isErr, ok, type Result } from '../../../core/result/Result';
import type { Money } from '../../../core/money/Money';
import type { RepositoryError } from '../../ports/repositoryErrors';
import type { ProjectId } from '../../../domain/project/ProjectId';
import type { AssetPriceOverrideRepository } from '../../ports/AssetPriceOverrideRepository';

/**
 * The `??` of the precedence, in ONE place:
 *
 *     effectiveUnitCost = priceOverride(project, asset)?.unitCost ?? asset.unitCost   ← an INPUT
 *     effectiveCost     = requirement.estimatedCost.override
 *                         ?? f(quantity, effectiveUnitCost)                           ← the OUTPUT
 *
 * The price override replaces an INPUT, so it changes what `estimatedCost.calculated` MEANS.
 * The requirement override replaces the OUTPUT, so it wins over whatever the derivation
 * produced. They cannot conflict, because neither can express the other's question.
 *
 * **A function rather than two call sites spelling the same lookup.** `AssignAsset` and
 * `RecalculateRequirement` are the two callers slice 10 deliberately routed through one
 * derivation; giving them two copies of the resolution would undo that one level up. *"Two
 * expressions of one question, three lines apart, drift immediately"* — and this repository
 * has paid for it four times, most recently in the increment this one continues, where the
 * read and the write resolved a project currency from two different fields.
 *
 * `deriveRequirementFigures` is deliberately NOT given the repository: it stays a pure
 * function of the figures it is handed. A derivation that reached for a repository would be a
 * second answer to "what does this requirement cost".
 */
export async function resolveEffectiveUnitCost(
	overrides: AssetPriceOverrideRepository,
	projectId: ProjectId,
	asset: { readonly id: import('../../../domain/asset/AssetId').AssetId; readonly unitCost: Money },
): Promise<Result<Money, RepositoryError>> {
	const found = await overrides.getForPair(projectId, asset.id);
	if (isErr(found)) return found;
	return ok(found.value?.entity.unitCost ?? asset.unitCost);
}

/**
 * The same rule against an already-fetched batch, for callers that resolve MANY pairs at once
 * and must not pay a read per row. `onAssetUpdated` builds its map from one `listByAsset`;
 * `GetRequirementsForZone` builds its from memoised `getForPair` calls. Pure, so it is the
 * half a test can drive without a repository.
 */
export function effectiveUnitCostFrom(
	overridesByProject: ReadonlyMap<ProjectId, Money>,
	projectId: ProjectId,
	asset: { readonly unitCost: Money },
): Money {
	return overridesByProject.get(projectId) ?? asset.unitCost;
}
```

- [ ] **Step 4: Wire it into `AssignAsset`**

In `src/application/commands/requirement/AssignAsset.ts`:

Add to `AssignAssetDeps`:

```ts
	/** The precedence's input half: a project may price a shared asset in its own currency. */
	readonly overrides: AssetPriceOverrideRepository;
```

In `createAndSave`, immediately after the project is loaded and before `deriveRequirementFigures`:

```ts
		const unitCost = await resolveEffectiveUnitCost(this.deps.overrides, zone.projectId, asset);
		if (isErr(unitCost)) return unitCost;
		const figures = deriveRequirementFigures({
			zoneAreaMm2: area.value,
			assetUnit: asset.unit,
			unitCost: unitCost.value,
			wasteFactor: asset.wasteFactorDefault,
			expectedCurrency: project.value.entity.currency,
		});
```

`AssignAssetErrors` already admits `RepositoryError`, so the union does not change.

- [ ] **Step 5: Wire it into `RecalculateRequirement` the same way**

Read `RecalculateRequirement.ts` and make the identical change: add `overrides` to its deps,
resolve before it derives, and pass the resolved cost. It reads the project from
`requirement.projectId` — resolve the override from **that same field**, never from the zone's.
One fact, one derivation: the currency increment shipped a defect precisely by letting the read
and the write take a project from two different places.

- [ ] **Step 6: Write the resolution's own unit tests**

`tests/application/commands/requirement/effectiveUnitCost.test.ts`:

```ts
describe('resolveEffectiveUnitCost', () => {
	it('answers the asset default when the project has no override', async () => { … });
	it('answers the project override when there is one', async () => { … });
	it('propagates a failed override read rather than falling back to the default', async () => {
		// A read that FAILED is not the same as a pair with no override. Falling back would
		// price the requirement at the catalogue default on a vault I/O fault, silently.
	});
});

describe('effectiveUnitCostFrom', () => {
	it('answers the map entry for the project, and the asset default for a project not in it', () => { … });
});
```

The third case is the one that matters: a failed read and an absent referent collapsing into one
answer is a defect this repository has recorded four times.

- [ ] **Step 7: Run the witness and watch it pass**

Run: `npx vitest run tests/application/commands/requirement/`
Expected: PASS, including both witness cases.

Every existing test that constructs `AssignAssetDeps` or `RecalculateRequirementDeps` now fails
to compile until it supplies `overrides`. That is the required-field property working: add
`new InMemoryAssetPriceOverrideRepository()` at each, and do not make the field optional to
avoid the edits — an optional collaborator is one a composition can silently forget.

- [ ] **Step 8: Full gate, then go straight to Task 6 — do NOT commit here**

Run: `npm run check`. It passes, and passing is not the same as being finished, which is why
this is the one task in the plan that does not end at a commit.

**Tasks 5 and 6 are ONE commit, because the spec says so and because the gate cannot see the
reason.** *"`resolveEffectiveUnitCost` in both commands, and the `assetMatchesCalculatedFrom`
correction — together, because the correction is only correct once something resolves an
override, and the resolution is only safe once the predicate stops false-mismatching."* Splitting
them into two tasks was this plan's own departure from that, and the cost is exactly what the
spec predicts: after Task 5 the write path derives figures from an override while
`assetMatchesCalculatedFrom` still compares them against the CATALOGUE price, so every overridden
requirement reports itself permanently `stale` and `onAssetUpdated` recalculates it on every
catalogue-price change that cannot possibly have moved it.

**`npm run check` is green throughout that**, which is the part worth carrying: no existing case
has an override, and Task 5's own cases assert the assign rather than the read model, so nothing
in the suite is in a position to notice. A task boundary that the gate approves is not the same
as a state anyone should stop at.

The tasks stay two — they are two pieces of work with two sets of tests — and the COMMIT is one.
Task 6's staging line covers both, which is why it stages `src/application` rather than
`src/application/commands`.

---

### Task 6: the effective-cost correction

**Files:**
- Modify: `src/application/event-handlers/requirement/onAssetUpdated.ts`
- Modify: `src/application/queries/GetRequirementsForZone.ts`
- Modify: `src/plugin/slice10Composition.ts` — **both** production construction sites break the
  moment these deps are required: `registerOnAssetUpdated(events, {…})` at `:127` gains
  `overrides`, and `new GetRequirementsForZone(requirements, zones, assets, projects)` at `:155`
  takes a fifth argument. The repository itself already exists, constructed in Task 5.
- **Modify: every TEST caller of the same two, because `tests/**` is type-checked and there are
  far more of them than production sites.** Measured rather than remembered —
  `grep -rn "registerOnAssetUpdated\|new GetRequirementsForZone(" src/ tests/`:
  - `registerOnAssetUpdated` — **nine** calls across three files:
    `tests/helpers/planEditorRig.ts`, `tests/application/event-handlers/cascade.test.ts` (three)
    and `tests/application/slice10Branches.test.ts` (four). Each passes a deps OBJECT LITERAL, so
    a required `overrides` is a type error at every one.
  - `new GetRequirementsForZone(` — **fifteen** four-argument constructions in `tests/`:
    `queryRefusals.test.ts` (seven), `domainValidation.test.ts` and
    `requirementStaleness.test.ts` (two each), and one each in `assetCommands.test.ts`,
    `guardAgainstThrowing.test.ts`, `cascade.test.ts` and `planEditorRig.ts`.

  Give `planEditorRig.ts` a real `InMemoryAssetPriceOverrideRepository` rather than a stub — it
  is the e2e rig, and a fake thinner than the thing it stands for is what this repository
  records paying for repeatedly. The rest may take an empty in-memory repository; only the cases
  this task WRITES need an override in one.
- Test: `tests/application/events/assetCascadeWithOverrides.test.ts`
- Test: extend `tests/application/queries/…` (the existing `GetRequirementsForZone` suite)

**Interfaces:**
- Consumes: Task 5's `effectiveUnitCostFrom`, Task 2's `listByAsset`/`getForPair`.
- Produces: no new exports. `AssetCascadeDeps` gains `readonly overrides: AssetPriceOverrideRepository`;
  `GetRequirementsForZone`'s constructor gains the same.

**This is Amendment 1 item 7's last clause and this increment's Definition-of-Done item.**

`assetMatchesCalculatedFrom` compares `asset.unitCost` against `calculatedFrom.unitCost`. Under
an override, `calculatedFrom.unitCost` records the EFFECTIVE cost — so every overridden
requirement mismatches permanently: the cascade never skips it and the read model reports it
`"stale"` forever.

**The cheap fix is wrong. Do not take it.** *"An `AssetUpdated` cannot move a figure derived
from the project's own price, so skip overridden requirements entirely"* reads cheaper and
truer, and it is false: `assetMatchesCalculatedFrom` compares the **unit symbol** as well as the
amount and the currency (`deriveRequirementFigures.ts:108-117`), under its own comment that *"an
`m2 → ft2` change is exactly as capable of invalidating them as an `m2 → m` one."* An overridden
requirement whose asset's unit changed is invalidated exactly as much as any other. The override
replaces one of the three compared fields, not the question.

**Its two callers stay two questions**, which Amendment 1 item 6 split deliberately, and the
correction for the override is to the predicate's INPUT rather than to its logic. An earlier
draft of this paragraph said flatly *"`assetMatchesCalculatedFrom` itself does not change"* —
true of the override correction, and read as a blanket instruction to leave the function alone,
which is how the next defect stayed in it for a round.

**One line of it DOES change, and it is a comparison bug this increment makes more reachable.**
`deriveRequirementFigures.ts:113` is `asset.unitCost.amount === calculatedFrom.unitCost.amount` —
a STRING comparison, and `19.5` and `19.50` are different strings for the same money. The schema
regex `/^(0|[1-9]\d*)(\.\d+)?$/` accepts both spellings, `createMoney` stores the amount
VERBATIM, and a `Money` is compared here by its rendering rather than by its value. The
consequence is a false mismatch in both directions the predicate serves: the read model reports
`stale` for a requirement whose inputs did not move, and `onAssetUpdated` recalculates it —
churn and a wrong status badge over an unchanged figure.

**PRE-EXISTING, and this increment raises the odds rather than creating it.** The comparison has
been a string one since slice 10. What is new is a SECOND writer for `calculatedFrom.unitCost` —
an override, minted on a different command path from the catalogue price, from a value the user
typed — plus the duplicate-winner path, where the winning note and the one the figures came from
are different notes that may spell the same amount differently. Two writers of one compared field
is when a by-rendering comparison stops being theoretical.

**The fix is the helper this plan already mints, promoted rather than copied.** Task 4 defines
`samePrice(a, b)` for the set command's no-op test — currency by field, amount by VALUE through
`compareMoney` — for exactly this reason, and its docblock already explains why the naive
spelling does not type-check. Two functions asking one question is what this plan's own rule
refuses, so it moves to `core/money/Money.ts` as **`sameMoney(a, b)`** (a pure money question,
importable by `core`'s every dependent) and both sites call it: Task 4's command and this
predicate's amount/currency pair.

`Money.compare` is deliberately NOT the answer on its own — it returns a `Result` and REFUSES a
currency mismatch, which is exactly the state this increment exists around, so the currency test
has to come first and by field. That is what `sameMoney` wraps.

**Both callers get a case**, because the predicate has two and they fail differently: the read
model reports a wrong STATUS, `onAssetUpdated` performs a wrong WRITE. Drive `19.5` against
`19.50` through each — the read model must answer `current`, and the cascade must not
recalculate. Watch both fail against the string comparison.

- [ ] **Step 1: Write the failing cascade test**

`tests/application/events/assetCascadeWithOverrides.test.ts`:

```ts
describe('onAssetUpdated with price overrides', () => {
	/** The false-mismatch regression: without the correction this recalculates forever. */
	it('skips an overridden requirement when only the catalogue price moved', async () => {
		// Project A overrides the asset at GBP 19.50; a requirement is derived from it.
		// The asset's own EUR price then changes.
		await publishAssetUpdated(assetId);
		expect(recalculate).not.toHaveBeenCalled();
		expect(expectOk(await requirements.getById(requirementId))?.entity.recalculationStatus)
			.toBe('current');
	});

	/**
	 * The arm that stops the WRONG cheap fix being reintroduced. An `AssetUpdated` carries a
	 * unit change too, and an override says nothing about the unit.
	 */
	it('does NOT skip an overridden requirement when the asset unit changed', async () => {
		await updateAsset(assetId, { unit: 'ft2' });
		expect(recalculate).toHaveBeenCalledTimes(1);
	});

	it('still recalculates a non-overridden requirement when the catalogue price moved', async () => {
		// Project B has no override on the same shared asset.
		await publishAssetUpdated(assetId);
		expect(recalculate).toHaveBeenCalledWith(expect.objectContaining({ requirementId: projectBRequirementId }));
	});

	/**
	 * The duplicate-winner rule reaches this map too. With `new Map(list.map(...))` the skip
	 * test compares against whichever note came last in `listByAsset` order while recalculation
	 * resolves the highest id, so an overridden requirement false-invalidates on enumeration
	 * order alone. Seed two notes for one pair, lower id last.
	 */
	it('skips using the same override recalculation would resolve, when the pair is duplicated', async () => {
		await publishAssetUpdated(assetId);
		expect(recalculate).not.toHaveBeenCalled();
	});

	/** One read for the whole fan-out, not one per requirement. */
	it('reads the overrides once however many requirements the asset has', async () => {
		const spy = vi.spyOn(overrides, 'listByAsset');
		await publishAssetUpdated(assetId); // 3 requirements across 2 projects
		expect(spy).toHaveBeenCalledTimes(1);
	});
});
```

- [ ] **Step 2: Run and watch them fail**

Run: `npx vitest run tests/application/events/assetCascadeWithOverrides.test.ts`
Expected: FAIL on the first and fourth cases.

- [ ] **Step 3: Correct `onAssetUpdated`**

Add `overrides` to `AssetCascadeDeps`, then between loading the asset and filtering:

```ts
		// ONE read for the whole fan-out. `listByAsset` exists for this: a shared asset can be
		// referenced from every project in the vault, and resolving each requirement's override
		// separately would be a read per requirement — the cost Amendment 1 refused when it
		// declined to put a project read on this path.
		const overrides = await deps.overrides.listByAsset(assetId);
		if (isErr(overrides)) {
			deps.logger.error('requirement.cascade-overrides-unreadable', { assetId, cause: overrides.error });
			// Same recovery as an unreadable asset: treat every link as changed. Recalculation
			// refuses against an endpoint it cannot establish and leaves each requirement
			// visibly stale, which is the honest outcome for a read we could not perform.
			await runRecalculationCascade(deps, listed.value);
			return;
		}
		// `winnersBy`, NOT `new Map(list.map(...))`. That spelling keeps whichever note came last
		// in `listByAsset` order, while `getForPair` and the price list both answer the highest
		// id — so this skip test would compare against a different price than recalculation
		// resolves, and every overridden requirement in a duplicated-pair vault would
		// false-invalidate on enumeration order alone.
		const winners = winnersBy(overrides.value, (o) => o.entity.projectId, (projectId, notes) => {
			deps.logger.warn('asset-price.duplicate-pair', { projectId, assetId, count: notes.length });
		});
		const byProject = new Map(
			[...winners].map(([projectId, override]) => [projectId, override.entity.unitCost]),
		);

		const changed = listed.value.filter(
			(r) =>
				!assetMatchesCalculatedFrom(r.entity.calculatedFrom, {
					// The EFFECTIVE cost this requirement's figures were derived from — the
					// catalogue default only when its project has no price of its own.
					unitCost: effectiveUnitCostFrom(byProject, r.entity.projectId, current),
					unit: current.unit,
				}),
		);
```

- [ ] **Step 4: Correct `inputsStillMatch`'s caller in `GetRequirementsForZone`**

The query already memoises the project currency per `execute`. Add a second memo, keyed by
project, for the override — and resolve it the same way, with `null` a CACHED answer:

```ts
	private async projectOverride(
		projectId: ProjectId,
		assetId: AssetId,
		memo: Map<string, Money | null>,
	): Promise<Result<Money | null, RepositoryError>> {
		// Keyed on the PAIR, unlike the currency memo: one zone's rows share a project but not
		// an asset, so a project-keyed memo would answer the first row's asset for every row.
		const key = `${projectId}:${assetId}`;
		const cached = memo.get(key);
		if (cached !== undefined) return ok(cached);
		const found = await this.overrides.getForPair(projectId, assetId);
		if (isErr(found)) return err(found.error);
		const unitCost = found.value?.entity.unitCost ?? null;
		memo.set(key, unitCost);
		return ok(unitCost);
	}
```

Then `buildRow` passes the effective cost into `isStaleReading`, in place of the asset's own:

```ts
		const stale = isStaleReading(
			r,
			zone.value?.entity ?? null,
			assetEntity === null ? null : { unit: assetEntity.unit, unitCost: effective },
			projectCurrency,
		);
```

where `effective` is `override ?? assetEntity.unitCost`. **`isStaleReading` and
`inputsStillMatch` themselves do not change** — they receive a different `asset.unitCost`, which
is the whole correction.

- [ ] **Step 5: Extend the query's own suite**

Add to the existing `GetRequirementsForZone` tests:

```ts
	/** The false-mismatch regression, read-model side. */
	it('reports current for a requirement derived from its project price override', async () => { … });

	it('reports stale for an overridden requirement whose override has since moved', async () => { … });

	/** The memo's hit arm is invisible to every other case — a row renders identically
	 *  whether it works or not — so it is pinned on the CALL COUNT. */
	it('reads each (project, asset) pair once for a zone with repeated assets', async () => { … });

	/**
	 * **The precedence, with BOTH overrides live.** The spec's Testing section asks for it and
	 * this plan's own self-review said it "belongs in Task 6's suite" without ever adding it —
	 * so an implementer could tick every task, never prove the interaction, and then apply the
	 * completion amendments over the gap.
	 *
	 * The two overrides sit on opposite sides of the derivation: the price override replaces an
	 * INPUT, the requirement override replaces the OUTPUT. So moving the price must move
	 * `cost.calculated` and must NOT move `cost.effective`.
	 *
	 * A case with only one override live passes against either precedence, which is why this
	 * one carries both.
	 */
	it('moves calculated but not effective when the price changes under a requirement override', async () => {
		// A requirement with estimatedCost.override = 500.00 GBP, derived from a 24.00 catalogue.
		const before = rowFor(requirementId);
		expect(before.cost.effective.amount).toBe('500.00');

		expectOk(await setOverride.execute({
			projectId,
			assetId,
			unitCost: moneyOf('19.50', 'GBP'),
			expected: 'absent',
		}));
		expectOk(await recalculate.execute({ requirementId }));

		const after = rowFor(requirementId);
		expect(after.cost.calculated.amount).not.toBe(before.cost.calculated.amount);
		expect(after.cost.effective.amount).toBe('500.00');

		// **Read the input through `calculatedFrom`, NOT through `unitCost`.** That DTO group is
		// Task 8's and does not exist at this task boundary, so asserting it here would leave
		// Task 6's suite failing to type-check — green-on-its-own is a claim this plan makes
		// about every task, and a test reaching forward breaks it. The persisted provenance is
		// the honest source anyway: it records what the figures were actually derived from.
		const persisted = expectOk(await requirements.getById(requirementId));
		expect(persisted?.entity.calculatedFrom.unitCost.amount).toBe('19.50');
	});
```

- [ ] **Step 6: Run everything and watch it pass**

Run: `npm run test:coverage`

Then **mutation-check the correction**, because the suite covering the reported path is not
evidence about the one beside it:
1. Revert to `unitCost: current.unitCost` in `onAssetUpdated` → the skip case must go red.
2. Take the WRONG cheap fix (skip every overridden requirement, ignoring the unit) → the unit
   case must go red.
3. Key the query's memo on the project alone → the repeated-asset case must go red.

Restore after each.

- [ ] **Step 7: Full gate, then commit**

```bash
# BOTH tasks: Task 5 deliberately did not commit, for the reason its last step gives.
# `src/core` is here for `sameMoney`, which this task moves out of Task 4's command file into
# `core/money/Money.ts`. Staging the CONSUMERS without the export is a commit that does not
# build — the defect a file list produces when a task moves a symbol rather than adding one.
git add src/core/money/Money.ts src/application src/plugin \
        src/presentation/editor/planEditorCommands.ts tests
git commit -m "feat(cost): a project's own price reaches the pipeline, and the predicate follows it

The witness the Issue asks for: an assign refuses on a currency mismatch, a
price override in the project's currency is set, the same assign succeeds
with the estimate denominated in the project's currency. Application-level,
so it proves the mechanism rather than the affordance. One shared
resolveEffectiveUnitCost rather than the lookup spelled out at each of the
two callers slice 10 routed through one derivation.

The predicate correction rides with it rather than following, because the
two are only correct together. Under a price override calculatedFrom.unitCost
holds the effective cost, so comparing it against the catalogue default
false-mismatches every overridden requirement forever — the cascade never
skips and the read model reads stale.

The correction is to the predicate's INPUT; assetMatchesCalculatedFrom is
untouched and its two callers stay two questions. Batched at both: one
listByAsset for a whole fan-out, a pair-keyed memo in the query.

Not the cheaper 'skip overridden requirements entirely', which reads truer
and is false: the predicate compares the unit symbol too, and an override
says nothing about the unit. That arm has its own case.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01G1z4YErxsacXRBUXoH94T8"
```

---

### Task 7: the project-narrowed cascade

**Files:**
- Create: `src/application/event-handlers/requirement/onAssetPriceOverrideChanged.ts`
- Modify: `src/plugin/slice10Composition.ts` — **register it**, beside `registerOnAssetUpdated`
  at `:127`, on the same `CascadeDeps`. A handler nobody registers is a file the suite exercises
  and production never runs; no task scheduled this site until a sweep looked for it, and no
  gate reports it, because the module has a test caller and therefore is not an unused file.
- Test: `tests/application/events/assetPriceOverrideCascade.test.ts`
- Test: `tests/plugin/assetPriceWiring.test.ts` — the registration itself, watched red with the
  `registerOnAssetPriceOverrideChanged(...)` line deleted. Task 8 already carries a case of this
  shape; this is the one that makes it fail for the right reason.

**Interfaces:**
- Consumes: Task 4's `AssetPriceOverrideChanged`, the existing `CascadeDeps` and
  `runRecalculationCascade` from `event-handlers/requirement/cascade.ts`.
- Produces: `registerOnAssetPriceOverrideChanged(events: EventBus, deps: CascadeDeps): Disposable`.

**This cascade hears THIS PLUGIN'S writes and nothing else, which is a residual rather than an
oversight — and it is PRE-EXISTING, symmetrical, and deliberately not closed here.** A price note
hand-edited in Obsidian, arriving through sync, or deleted from the file explorer reaches
`VaultChangeAdapter`, which upserts the index and publishes `ProjectIndexEntryChanged` and no
domain event at all (`processNote`'s one `publish` call). This handler subscribes to
`AssetPriceOverrideChanged`, which only Task 4's two commands raise. So the section and the
Inspector both re-read — Task 9 step 4a and Task 8a step 3a wire exactly that — while every
requirement derived from the pair keeps its persisted figure.

Three things make this the right call rather than a gap to fill inside this increment:

- **The ASSET side already behaves identically, and it is the bigger case.**
  `registerOnAssetUpdated` subscribes to `AssetUpdated`, a domain event only `UpdateAssetCommand`
  raises; nothing anywhere subscribes a cascade to `ProjectIndexEntryChanged` — measured, the
  only consumers are the view change SOURCES. A library price edited by hand today moves no
  requirement in any project. Building an out-of-band cascade for overrides alone would make the
  two disagree, with the shared catalogue — which serves every project — left as the unfixed
  half.
- **What the user actually sees is a `stale` row, not a wrong number presented as current.**
  Task 6 step 4 feeds the OVERRIDE-aware effective cost into `isStaleReading`, so an out-of-band
  price change makes `inputsStillMatch` fail and the row reports itself stale. The figure is not
  recomputed; the surface does not claim it is. And the recovery is a gesture the user has:
  the recovery is CLEAR then SET, two gestures, both of which publish and cascade.

  **Not "re-set the price", which an earlier draft said and the no-op rule has since made
  false.** After an out-of-band edit the section shows the note's NEW value, so the natural
  repair — retyping what is on screen — is exactly the submission `SetAssetPriceOverrideCommand`
  now recognises as changing nothing: no write, no event, and the requirements stay derived from
  the old figure. Clearing first is what makes the second gesture a real change. Any subsequent
  ordinary price edit also recovers it, for the same reason.

  The two rules are both right and they meet here: the no-op exists so an accidental re-blur
  does not recalculate a whole project, and it deliberately does not double as an out-of-band
  repair — a command cannot tell "the user retyped the same number" from "a sync moved this and
  nothing cascaded", because both arrive as one submission equal to what is stored.
- **The fix belongs to the vault-change pipeline**, which every index consumer inherits — the
  same reason slice 19's folder-move marker was narrowed in the documents rather than fixed in
  the code. It is one change (a domain event, or a cascade subscriber, for out-of-band entity
  changes) serving assets, overrides and whatever comes next, and it is not this increment's to
  design in passing.

- [ ] **Step 1: Write the failing tests**

```ts
describe('onAssetPriceOverrideChanged', () => {
	/**
	 * The narrowing IS the difference from `onAssetUpdated`, and it needs two projects to be
	 * visible at all: a single-project fixture passes against a cascade that ignores the
	 * narrowing entirely.
	 */
	it('recalculates only the requirements in the project whose price moved', async () => {
		// Projects A and B both reference the shared asset.
		await bus.publish(assetPriceOverrideChanged({ projectId: projectA, assetId }));
		expect(recalculated()).toEqual([projectARequirementId]);
	});

	it('does nothing when the project references the asset nowhere', async () => {
		await bus.publish(assetPriceOverrideChanged({ projectId: projectC, assetId }));
		expect(recalculated()).toEqual([]);
	});

	it('reports a failed listing rather than recalculating nothing silently', async () => {
		vi.spyOn(requirements, 'listByAsset').mockResolvedValue(err(persistenceError('x', 'no')));
		await bus.publish(assetPriceOverrideChanged({ projectId: projectA, assetId }));
		expect(logger.error).toHaveBeenCalledWith(
			'requirement.list-by-asset.failed',
			expect.objectContaining({ assetId }),
		);
	});
});
```

- [ ] **Step 2: Run and watch them fail**

Run: `npx vitest run tests/application/events/assetPriceOverrideCascade.test.ts`
Expected: FAIL — cannot resolve the handler.

- [ ] **Step 3: Write the handler**

```ts
import { isErr } from '../../../core/result/Result';
import type { EventBus } from '../../../core/events/EventBus';
import type { Disposable } from '../../../core/events/Disposable';
import type { AssetPriceOverrideChanged } from '../../../domain/asset-price/AssetPriceOverride.events';
import type { CascadeDeps } from './cascade';
import { runRecalculationCascade } from './cascade';

/**
 * A project's own price for a shared Asset moved, so every Requirement IN THAT PROJECT
 * referencing that Asset was derived from a figure that no longer holds.
 *
 * **The narrowing is the whole difference from `onAssetUpdated`**, and it is worth stating:
 * an `AssetUpdated` cascade touches every project, because the shared default changed for all
 * of them. A price override changed touches one. `listByAsset` is still the read — a
 * `listByProjectAndAsset` would be a third list method for a filter one line long — and the
 * project filter is applied here.
 *
 * A subscriber, not a mechanism: it reuses `runRecalculationCascade` unchanged.
 *
 * It performs NO skip test. `onAssetUpdated` has one because a rename or an unrelated field
 * edit fans out over every requirement on the asset and mostly changes nothing; here the event
 * fires only when a price really moved (the commands do not announce a no-op clear), and every
 * requirement it reaches was derived from exactly that number.
 */
export function registerOnAssetPriceOverrideChanged(events: EventBus, deps: CascadeDeps): Disposable {
	return events.subscribe('AssetPriceOverrideChanged', async (event) => {
		const { projectId, assetId } = (event as AssetPriceOverrideChanged).payload;
		const listed = await deps.requirements.listByAsset(assetId);
		if (isErr(listed)) {
			deps.logger.error('requirement.list-by-asset.failed', { assetId, cause: listed.error });
			deps.notify?.cascadeAborted(assetId);
			return;
		}
		const inProject = listed.value.filter((r) => r.entity.projectId === projectId);
		if (inProject.length === 0) return;
		await runRecalculationCascade(deps, inProject);
	});
}
```

- [ ] **Step 4: Run, then mutation-check the narrowing**

Run: `npx vitest run tests/application/events/assetPriceOverrideCascade.test.ts` — PASS.

Then delete the `.filter(...)` line and re-run: the first case must go red. If it stays green,
your fixture has only one project and the case is not testing the narrowing at all.

- [ ] **Step 5: Full gate, then commit**

```bash
git add src/application/event-handlers src/plugin tests
git commit -m "feat(cascade): a price override invalidates one project, not every project

The narrowing is the whole difference from onAssetUpdated, and it takes two
projects in the fixture to be visible: a single-project fixture passes
against a cascade that ignores it entirely.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01G1z4YErxsacXRBUXoH94T8"
```

---

### Task 7a: deleting an asset takes its price overrides with it

**Files:**
- Modify: `src/application/commands/asset/DeleteAsset.ts`
- Modify: `src/plugin/slice10Composition.ts` — **not** `composition-root.ts`. `DeleteAssetCommand`
  is constructed there (`:140`) and `sequenceNotices` is declared there (`:54`); the root only
  imports both. Bind the new `overrides` dep at the construction site, and add
  `priceCleanupFailed` to `sequenceNotices` beside `markerClearFailed`.
- Modify: `src/presentation/i18n/locales/en.ts`, `src/presentation/i18n/locales/de.ts` — the notice string,
  through `tr(...)` exactly as `sequence.marker-clear-failed` is. `NOTICE_TEXT_BAN` refuses a
  literal at `notifyWarning`, so this is a gate rather than a convention.
- **Modify: every TEST construction of `DeleteAssetCommand`, because `tests/**` is type-checked.**
  Measured with `grep -rn "new DeleteAssetCommand(" src/ tests/`: twelve sites, ONE in `src/`
  (the binding above) and **eleven in tests** — `deleteAssetRefusals.test.ts` (eight),
  `assetCommands.test.ts`, `guardAgainstThrowing.test.ts` and `compensationRestore.test.ts` (one
  each). A required `overrides` is a compile error at every one, so without them this task's
  promised green commit does not happen. An empty `InMemoryAssetPriceOverrideRepository`
  satisfies ten of them; only this task's own cases need an override in one.

  This is the THIRD required-dependency widening on this branch whose file list was written
  from `src/` and saw a fraction of the callers — Task 5's `AssignAssetCommand`, Task 6's two,
  and now this. The grep is the instrument, and it belongs in the list beside the names rather
  than in a reviewer's report after the fact.
- Test: `tests/application/commands/asset/deleteAssetWithOverrides.test.ts`
- Test: `tests/plugin/assetPriceNoticeWiring.test.ts`

**Interfaces:**
- Consumes: Task 2's `listByAsset` and `delete`.
- Produces: `DeleteAssetDeps` gains `readonly overrides: AssetPriceOverrideRepository`, and its
  existing optional `notify` gains a second member:

```ts
	readonly notify?: {
		markerClearFailed(entityId: string): void;
		/** A stray price note was left behind; the asset itself is gone. */
		priceCleanupFailed(assetId: string): void;
	};
```

  Optional for the suite's benefit, which is exactly what makes a composition that forgets it
  compile and say nothing — and "optional" is not a detail here: omitting the production binding
  silently reduces the promised user-visible warning back to the log line this task exists to
  stop it being. So the binding gets a wiring case of its own, the shape
  `sequenceNoticeWiring.test.ts` already uses for its sibling, watched red with
  `priceCleanupFailed` deleted from `sequenceNotices`:

```ts
it('tells the user when an asset delete leaves a price note behind', async () => {
	// Compose the real slice-10 wiring, fail the override delete, run the delete, and assert a
	// warning notice was raised — not merely that the logger was called. Asserting the log alone
	// passes against exactly the build this task is fixing.
});
```

  The notice text is a `StringKey` in both locales, never a literal: `NOTICE_TEXT_BAN` watches
  those doors.

**Why this task exists.** `DeleteAssetCommand` gathers its referents from
`requirements.listByAsset` alone (`DeleteAsset.ts:79`) and `resolvedReferents` is typed
`readonly RequirementId[]`. An asset carrying a price override and **no** Requirement therefore
deletes with no referents observed, and the override's `asset` id dangles.

**This paragraph used to end "unreachable, unlistable and undeletable by the user who made it",
and that stopped being true one task along.** It rested on Task 8's join dropping any override
whose asset `listAll` no longer names — which was the first draft's behaviour and is no longer:
`ListProjectAssetPrices` emits an ORPHAN ROW, so the price is listed and clearable. The
correction is recorded rather than the sentence quietly softened, because the argument it made
was load-bearing for this task's existence and a reader who checks it against the query would
find it false.

**Why the task still earns its place, on the true argument.** The orphan row is a BACKSTOP for
the paths no command covers — a hand delete in the file explorer, a sync removal — and a backstop
is not a reason to leave a mess the command path can prevent. An override for an asset this
plugin itself deleted is meaningless data that the user never has to see, let alone repair by
hand; making them clear a row for a decision they already made would be the surface asking them
to finish the plugin's work. So: the command cleans up what it deletes, and the read model
surfaces what nothing cleaned up. The two are complements rather than alternatives, and the
review round that found the missing orphan row is what forced them to be stated as such.

**The overrides go WITH the asset; they are not referents that refuse it.** A referent is work a
user must decide about — the four choices
[[A delete reports what references it and offers four choices]] describes. A price for a deleted
asset names nothing, can derive no Requirement, and offers no other outcome.

**Where it goes, and why NOT inside the compensated sequence.** The obvious home is
`runDeleteResolution`'s own steps, and it is the wrong call for this increment: that sequence's
durable marker is `Requirement`-shaped (`SequenceMarker.affectedBefore: readonly
Loaded<Requirement>[]`), so carrying overrides in it means widening that type and bumping
`SEQUENCE_MARKER_SCHEMA_VERSION` — a versioned change to a **durable recovery record**, which is
precisely the "first schema change that cannot be a redefinition" CLAUDE.md says should be
scheduled deliberately rather than discovered inside another increment.

So the deletion runs **after** the sequence returns ok, and the ORDER is the safety argument:
the asset is gone first, then its overrides. A failure at that point leaves exactly the state
this repository is in today — an orphan override — plus a log line, which is a strictly better
failure than the reverse order's, where a crash between the two would destroy a user's prices
and leave the asset standing.

- [ ] **Step 1: Write the failing tests**

```ts
describe('DeleteAssetCommand and price overrides', () => {
	/**
	 * THE case: an asset with an override and no Requirement. Today this deletes cleanly with
	 * no referents observed, which is why the defect is invisible.
	 */
	it('deletes the price overrides of an asset that has no requirements', async () => {
		expectOk(await setOverride.execute({
			projectId,
			assetId,
			unitCost: moneyOf('19.50', 'GBP'),
			expected: 'absent',
		}));
		expectOk(await deleteAsset.execute({ assetId }));
		// Assert what MOVED, not that the delete succeeded — it succeeds either way.
		expect(expectOk(await overrides.listByAsset(assetId))).toHaveLength(0);
	});

	it('deletes overrides across every project that had one', async () => {
		// Projects A and B both price the shared asset.
		expectOk(await deleteAsset.execute({ assetId, resolution: 'remove-references' }));
		expect(expectOk(await overrides.listByAsset(assetId))).toHaveLength(0);
	});

	it('leaves the overrides of a different asset alone', async () => {
		expectOk(await deleteAsset.execute({ assetId }));
		expect(expectOk(await overrides.listByAsset(otherAssetId))).toHaveLength(1);
	});

	/**
	 * The failure degrades to today's behaviour rather than to data loss, and says so. The
	 * delete still reports ok, because the asset really is gone and reporting otherwise would
	 * make a user retry a deletion that already happened.
	 */
	it('reports the delete as successful, and tells BOTH channels, when an override delete fails', async () => {
		vi.spyOn(overrides, 'delete').mockResolvedValue(err(persistenceError('asset-price.delete-failed', 'no')));
		const result = await deleteAsset.execute({ assetId });
		expect(result.ok).toBe(true);
		expect(logger.error).toHaveBeenCalledWith(
			'asset-price.orphaned-by-asset-delete',
			expect.objectContaining({ assetId }),
		);
		// The user-facing half. Asserting only the log passes against a build where the stray
		// note is a developer's problem and nobody else's.
		expect(notify.priceCleanupFailed).toHaveBeenCalledWith(assetId);
	});

	/** The publication the cleanup must not displace — see Step 3. */
	it('still publishes AssetDeleted after cleaning the overrides up', async () => {
		expectOk(await deleteAsset.execute({ assetId }));
		expect(bus.published.map((e) => e.type)).toContain('AssetDeleted');
	});

	/** Nothing to do, nothing logged — a delete of an unpriced asset stays silent. */
	it('logs nothing when the asset had no overrides', async () => {
		expectOk(await deleteAsset.execute({ assetId }));
		expect(logger.error).not.toHaveBeenCalled();
	});
});
```

- [ ] **Step 2: Run and watch them fail**

Run: `npx vitest run tests/application/commands/asset/deleteAssetWithOverrides.test.ts`
Expected: FAIL on the first three — the overrides survive the delete.

- [ ] **Step 3: Implement**

Add `overrides` to `DeleteAssetDeps` and to the `ops` bundle, then INSERT the cleanup into
`execute`'s existing tail. **Insert, not replace** — the method already ends with
`events.publish(assetDeleted(...))`, and `createAssetCatalogueChangeSource` subscribes to
`AssetDeleted`, so dropping it leaves every mounted catalogue consumer (the assign picker among
them) showing the deleted asset until some unrelated refresh. The existing tail is:

```ts
		if (isErr(resolved)) return resolved;

		await this.ops.events.publish(
			assetDeleted({ assetId: input.assetId }),
		);
		return ok(resolved.value);
```

and it becomes:

```ts
		if (isErr(resolved)) return resolved;

		await this.deleteOverridesOf(input.assetId);
		await this.ops.events.publish(
			assetDeleted({ assetId: input.assetId }),
		);
		return ok(resolved.value);
```

Note `ok(resolved.value)` rather than `resolved`: the two have different types, and returning the
wrapper compiles nowhere.

```ts
	/**
	 * A price override for a deleted Asset names nothing: no Requirement can derive from it, and
	 * there is no second outcome to offer, so it goes WITH the asset rather than refusing its
	 * deletion.
	 *
	 * **This is about avoidable meaningless data, not about reachability.** An earlier draft
	 * argued that `ListProjectAssetPrices` joins on the catalogue so the orphan "renders in no
	 * row — unreachable and undeletable"; that stopped being true when Task 8's query became a
	 * FULL OUTER join and started emitting a clearable orphan row. The row is the backstop for
	 * the paths no command covers — a hand delete in the file explorer, a sync removal, neither
	 * of which dispatches anything — and a backstop is not a reason to leave a mess this command
	 * can prevent. An override for an asset the plugin ITSELF deleted is data the user should
	 * never have to see, let alone repair by hand.
	 *
	 * AFTER the sequence, and the order is the safety argument: a failure here leaves the orphan
	 * this repository already produces today, plus a line saying so. The reverse order would
	 * destroy a user's prices and leave the asset standing if it failed in between.
	 *
	 * It does not fail the delete. The asset IS gone; reporting failure would invite a retry of
	 * a deletion that already happened.
	 *
	 * **A failure is SURFACED, not merely logged**, which is the difference between a residual
	 * and a silent one. `DeleteAssetDeps.notify` already exists for the sequence's own
	 * marker-clear failure; this takes the same channel, so a user whose vault keeps a stray
	 * note is told rather than left to find it.
	 *
	 * **Why this is not in the compensated sequence**, restated where the code is because a
	 * review round proposed moving it twice: that sequence's durable marker is
	 * `Requirement`-shaped, so carrying overrides means versioning a durable recovery record.
	 * And the residual is smaller than it first reads — an orphan override is *meaningless*
	 * data, not lost data: the asset is gone, no Requirement can derive from it, and the user
	 * can delete the note in Obsidian. The alternative ordering trades that for destroying real
	 * prices belonging to an asset that still exists.
	 *
	 * **It takes the asset's own level-1 lock, in its OWN session, and the read is inside it.**
	 * `runDeleteResolution` releases its session before returning, so by the time this runs
	 * nothing holds the asset — and both price commands acquire `[projectId, assetId]` at level
	 * 1, so without this a clear in another leaf can list the same version and race the
	 * conditional delete: one side gets a revision conflict, and if that side is this one, the
	 * user is warned an orphan remains that the clear had in fact removed. A warning about a
	 * note that is gone is worse than the residual this method exists to report honestly.
	 *
	 * The ASSET id alone is enough and the project ids are deliberately not taken: level-1 locks
	 * are per id, and every price command's acquisition includes this asset, so holding it
	 * excludes all of them across every project. Taking the project ids too would mean listing
	 * first to learn them — and `ReferenceLocks` raises on a second acquisition within a level,
	 * so the read could not then be moved inside the lock it needs to be inside.
	 */
	private async deleteOverridesOf(assetId: AssetId): Promise<void> {
		const session = this.ops.locks.beginSession();
		await session.acquire([assetId], []);
		try {
			await this.deleteOverridesLocked(assetId);
		} finally {
			session.release();
		}
	}

	private async deleteOverridesLocked(assetId: AssetId): Promise<void> {
		const listed = await this.ops.overrides.listByAsset(assetId);
		if (isErr(listed)) {
			this.ops.logger.error('asset-price.orphaned-by-asset-delete', { assetId, cause: listed.error });
			this.ops.notify?.priceCleanupFailed(assetId);
			return;
		}
		let orphaned = false;
		for (const override of listed.value) {
			const deleted = await this.ops.overrides.delete(override.entity.id, override.version);
			if (isErr(deleted)) {
				orphaned = true;
				this.ops.logger.error('asset-price.orphaned-by-asset-delete', {
					assetId,
					overrideId: override.entity.id,
					cause: deleted.error,
				});
			}
		}
		if (orphaned) this.ops.notify?.priceCleanupFailed(assetId);
	}
```

Plus the interleaving the lock exists for:

```ts
	/**
	 * A clear landing between the sequence's release and this cleanup. Without the lock both
	 * paths list the same version and race their conditional deletes: one refuses, and when
	 * that one is the cleanup the user is warned about an orphan the clear had already removed.
	 * Assert BOTH halves — the note is gone AND `notify.priceCleanupFailed` was never called —
	 * because "the note is gone" is equally true of the racing build.
	 *
	 * **WHERE the pause goes is the whole case, and the first draft put it somewhere that
	 * cannot reach the race.** It said "hold the clear's own acquisition open until the delete
	 * is dispatched" — but `runDeleteResolution` acquires the SAME asset's level-1 lock in its
	 * own prepare step (`deleteResolution.ts:260`, `session.acquire([ops.entityId], [])`), so a
	 * clear already holding `[projectId, assetId]` BLOCKS the delete outright. The delete waits,
	 * the clear finishes, the cleanup then lists nothing and there is no interleaving at all —
	 * green, and green with the cleanup's own acquisition deleted, which is the mutation this
	 * case exists to fail.
	 *
	 * **The SECOND draft moved the pause to the right window and still could not reach the
	 * race, because it kept the two operations sequential.** It said "dispatch the clear, let
	 * it SETTLE, then release the delete" — so the clear's own conditional delete has already
	 * landed before the cleanup lists, the cleanup lists nothing, and it warns about nothing
	 * with or without its lock. Waiting for one operation to finish is exactly what a race
	 * test must not do, and this instruction did it twice under two different pauses.
	 *
	 * **The THIRD draft DEADLOCKED against the correct implementation, which is the worst of
	 * the three.** It said "pause the CLEANUP between its list and its first delete, then run
	 * the clear to completion" — and `deleteOverridesOf` acquires `[assetId]` at level 1
	 * BEFORE it lists, so at that pause the cleanup HOLDS the lock the clear needs. The clear
	 * blocks; the script waits for the clear before releasing the cleanup; nothing moves. It
	 * hangs on the good build and passes on the mutation — the test inverted.
	 *
	 * **All three failures share one cause: reasoning about WHERE to pause without tracing WHO
	 * HOLDS WHICH LOCK there.** So the ordering below is written as a lock ledger, and each step
	 * says what is held. Both operations must have LISTED before either DELETES, because that is
	 * what a conditional delete races on, and neither may be holding the other's lock while the
	 * script waits on it.
	 *
	 * 1. Let the delete run `runDeleteResolution` and RELEASE its session. Held: nothing.
	 * 2. Pause the delete BEFORE `deleteOverridesOf` acquires. Held: nothing — this is the whole
	 *    reason the pause moves above the acquisition rather than below the list.
	 * 3. Start the clear (do NOT await it) and pause it after its `listByProject`, before its
	 *    first `delete`. Held: the clear has `[projectId, assetId]`, and it has read v1.
	 * 4. Release the cleanup, still without awaiting. WITH the lock it blocks at
	 *    `session.acquire([assetId], [])`; WITHOUT it, it proceeds and lists v1 too.
	 * 5. Release the clear. Its conditional delete at v1 succeeds, the note is gone, and it
	 *    releases the lock.
	 * 6. Await both.
	 *    - **With the lock**: the cleanup only now acquires, lists, finds NOTHING, and warns
	 *      about nothing.
	 *    - **Without it**: the cleanup already holds a v1 listing, deletes at v1, refuses on a
	 *      note that is gone, sets `orphaned` and fires `notify.priceCleanupFailed` — the wrong
	 *      warning, about an orphan that is not one.
	 *
	 * Deterministic in both worlds and blocked in neither: one script, and the outcome decided
	 * solely by the line under test.
	 */
	it('does not warn about an orphan a concurrent clear already removed', async () => {
		// Pause the delete BEFORE deleteOverridesOf acquires. Start the clear without awaiting
		// and pause it after its list. Release the cleanup without awaiting. Release the clear.
		// Await both. Assert the note is gone AND notify was never called.
	});
```

- [ ] **Step 4: Run, then mutation-check**

Run the file — PASS. Then delete the `await this.deleteOverridesOf(...)` call: the first three
cases must redden. If only one does, your fixtures share a project or an asset and the other two
are not testing what their names say. Then delete the `session.acquire([assetId], [])`: the
interleaving case must redden, and it is the only one that can — the others are sequential.

**If it does NOT redden, the two operations are SEQUENTIAL somewhere**, and this case has
already failed to reach its race twice, in two different ways:

1. **The pause before the delete is dispatched** — `runDeleteResolution`'s own level-1
   acquisition on the asset serialises the two, so there is no window left to race in.
2. **The pause in the right window, with the clear AWAITED to completion** — the cleanup then
   lists after the note is already gone, finds nothing, and warns about nothing whether or not
   its lock exists.
3. **The pause BELOW the cleanup's own acquisition** — it then holds `[assetId]` while the
   script waits for a clear that needs the same lock, so the case does not go green, it HANGS,
   and only on the correct build. A timeout rather than a failure, on the build that is right.

None of these is a hypothetical; all three were instructed here, one per review round, each
written while fixing the one before it. **The common cause is reasoning about where to pause
without tracing who holds which lock there** — which is why the case's docblock is now a lock
ledger rather than a sentence. A case that cannot reach its race is green in every build,
including the broken one it was written to catch; a case that deadlocks is worse, because it is
red on the only build that deserves green.

- [ ] **Step 5: Full gate, then commit**

Run: `npm run check`

```bash
git add src/application/commands/asset src/plugin src/presentation/i18n tests
git commit -m "fix(delete): an asset's price overrides go with the asset

DeleteAssetCommand gathered referents from requirements alone, so an asset
with an override and no requirement deleted with none observed, leaving a
price note naming an asset that no longer exists.

They go with the asset rather than refusing its deletion: a price for a
deleted asset names nothing and there is no second outcome to offer. The
price list's own orphan row is the backstop for the paths no command covers
— a hand delete, a sync removal — and a backstop is not a reason to leave a
mess the command path can prevent.

After the sequence rather than inside it, deliberately: that sequence's
durable marker is Requirement-shaped, and carrying overrides in it means
versioning a recovery record — a schema change to schedule rather than to
slip into this increment. The order is the safety argument: a failure here
leaves the orphan we produce today, where the reverse order would destroy a
user's prices and leave the asset standing.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01G1z4YErxsacXRBUXoH94T8"
```

---

### Task 8: the read model, and the composition root

**Files:**
- Create: `src/application/queries/ListProjectAssetPrices.ts`
- Modify: `src/application/queries/GetRequirementsForZone.ts` (the DTO's `unitCost` group)
- Modify: `src/presentation/read-models/renovationProjectQueries.ts` — the read boundary the
  section hydrates through, plus its unavailable fallback (step 3b).
- Modify: `src/plugin/composition-root.ts`, `src/plugin/guardedServices.ts`
- Test: `tests/application/queries/listProjectAssetPrices.test.ts`
- Test: `tests/plugin/assetPriceWiring.test.ts`
- **Modify: `tests/presentation/editor/requirementRowFieldErrors.test.ts`** — the one hand-built
  `RequirementInspectorDTO` literal in the suite, a compile error the moment `unitCost` becomes
  required. Step 3a below carries the measurement and says why it belongs to this task rather
  than to Task 8a.

**Interfaces:**
- Produces:
  - `interface AssetPriceRowDto { assetId: string; assetName: string | null; catalogue: Money | null; override: Money | null; overrideId: AssetPriceOverrideId | null; overrideVersion: EntityVersion | null; }`
    — `assetName` and `catalogue` are nullable for the ORPHAN row (an override whose asset was
    deleted out of band), on `RequirementInspectorDTO.assetName`'s precedent. `assetName === null`
    is the whole discriminator; step 2 carries the reasoning and the alternative that was refused.

    **`overrideId` is BRANDED, and typing it `string | null` was a contradiction rather than a
    looseness.** The component builds `AssetPriceEdit.expected`, which is a
    `PriceRowExpectation` — `'absent' | { id: AssetPriceOverrideId; version: EntityVersion }` —
    so a `string` id forces a cast at the one seam this plan spends a whole step making
    type-safe. The claim beside `AssetPriceEdit` that "branding happens where the state mints the
    command input" is true of `assetId` and was false of this field: the state never sees the
    expectation unbranded, because the component has already built it.

    **Moving the expectation to the state was the alternative and it unravels Step 3.** The
    expectation is SNAPSHOT state, frozen for exactly as long as the row's field is dirty — that
    is per-row draft state the component owns, and a state-side construction would read the
    refreshed props instead, which is the lost update the snapshot exists to prevent.

    **The precedent is exact, and it is a rule rather than a preference:** `RequirementInspectorDTO`
    carries `requirementId: RequirementId` branded and `assetId: string` plain
    (`GetRequirementsForZone.ts:31-32`). The id the row ACTS ON is branded; the ids it merely
    displays or passes through stay strings. This row acts on the override, so `overrideId` is
    branded and `assetId` is not.

    The query already PRODUCED branded values — both assignments are `override.entity.id` — so
    only the declared type was wrong, which is the quiet kind: the annotation was narrower than
    the code and nothing in the plan could disagree with it until a consumer needed the brand.
  - `class ListProjectAssetPrices` with `execute(projectId): Promise<Result<AssetPriceRowDto[], RepositoryError>>`,
    constructed with `(assets, overrides, logger)` — the logger for the duplicate diagnostic,
    which this query is the only surface for on a project that has no requirements
  - `RequirementInspectorDTO.unitCost: { catalogue: Money; projectOverride: Money | null; effective: Money } | null`
    — `effective` is the PERSISTED provenance, not the current resolution; see the block below.

- [ ] **Step 1: Write the failing query tests**

```ts
describe('ListProjectAssetPrices', () => {
	it('returns one row per catalogue asset, with a null override where the project has none', async () => { … });

	/**
	 * The duplicate a user can meet with NO requirements anywhere — the section is then the only
	 * surface that resolves the pair, and `getForPair`'s own diagnostic never runs. Assert BOTH
	 * halves: one row comes back carrying the winner AND the warning was logged, because "one
	 * row" is equally true of a build that resolves silently.
	 */
	it('warns once and returns the winner when a project has two notes for one asset', async () => {
		// Seed two overrides for the same pair through the repository, then execute.
		expect(logger.warn).toHaveBeenCalledWith('asset-price.duplicate-pair', expect.anything());
	});

	it('carries the override id and revision so a row can be cleared without a second read', async () => {
		// Clearing is a CONDITIONAL write. A row that cannot supply an Expected forces the view
		// to re-read before every save, which is check-then-act with extra steps.
		const row = rows.find((r) => r.assetId === assetId);
		expect(row?.overrideId).not.toBeNull();
		expect(row?.overrideVersion).not.toBeNull();
	});

	it('is sorted by asset name, so the list does not reshuffle between reads', async () => { … });

	it('returns an empty list for a vault whose library is empty', async () => { … });

	/**
	 * The ORPHAN, and the case a catalogue-only join cannot pass: an override whose asset was
	 * deleted OUT OF BAND — by hand in the file explorer, or by sync — so Task 7a's cleanup
	 * never ran. `VaultChangeAdapter.onDelete` drops the index entry and publishes
	 * `ProjectIndexEntryChanged`; it dispatches no command.
	 *
	 * Assert the row is PRESENT and CLEARABLE, not merely present: `overrideId` and
	 * `overrideVersion` are what let the clear button build a conditional write, and a row
	 * carrying neither is a row the user can look at and not act on.
	 *
	 * Watch it fail against `rows = assets.value.map(...)` alone, which is what shipped in the
	 * first draft: the row is simply absent and the price is unreachable through every door
	 * the plugin offers.
	 */
	it('lists an override whose asset was deleted out of band, with no name and no library price', async () => {
		// Seed an asset, override it, then remove the asset from the index WITHOUT the command.
		const orphan = rows.find((r) => r.assetId === deletedAssetId);
		expect(orphan?.assetName).toBeNull();
		expect(orphan?.catalogue).toBeNull();
		expect(orphan?.overrideId).not.toBeNull();
		expect(orphan?.overrideVersion).not.toBeNull();
	});

	/**
	 * Orphans sort LAST and among themselves by id — they are a repair queue rather than part
	 * of the catalogue the section compares against, and they have no name to sort by. Also the
	 * regression for the comparator itself: `localeCompare` on a null throws, so a sort written
	 * without the null test takes the whole query down rather than misordering it.
	 */
	it('puts orphans after every named row, ordered by asset id', async () => { … });

	it('propagates a failed catalogue read', async () => { … });
	it('propagates a failed override read', async () => { … });
});
```

- [ ] **Step 2: Run, watch fail, write the query**

```ts
/**
 * The project's price list: the whole shared catalogue, with this project's own price beside
 * each default. ONE query joining `listAll` and `listByProject` rather than a view calling two
 * and joining them in Pinia — a join in a store is a read model nothing can test without
 * mounting something.
 *
 * The whole catalogue rather than only the overrides, because the section's question is "what
 * does this project pay", and a sparse list hides the comparison against the shared default
 * that §89 asks for. The trigger for the other shape is written in the spec: a library that
 * outgrows one readable list.
 */
export class ListProjectAssetPrices implements Query<ProjectId, Result<AssetPriceRowDto[], RepositoryError>> {
	constructor(
		private readonly assets: AssetRepository,
		private readonly overrides: AssetPriceOverrideRepository,
		/** For the duplicate diagnostic below — this query is the only surface some duplicates
		 *  are ever resolved on. */
		private readonly logger: Logger,
	) {}

	async execute(projectId: ProjectId): Promise<Result<AssetPriceRowDto[], RepositoryError>> {
		const assets = await this.assets.listAll();
		if (isErr(assets)) return assets;
		const overrides = await this.overrides.listByProject(projectId);
		if (isErr(overrides)) return overrides;

		// `winnersBy`, never `new Map(list.map(...))`: that keeps whichever entry came last in
		// `listByProject` order, which is a different answer from the one `getForPair` gives.
		//
		// The reporter is what makes the duplicate visible on THIS path. `getForPair` logs its
		// own, but a project with no requirements never reaches `getForPair` for that pair, so
		// opening the section was the one way to meet a duplicate and hear nothing.
		const byAsset = winnersBy(overrides.value, (o) => o.entity.assetId, (assetId, notes) => {
			this.logger.warn('asset-price.duplicate-pair', {
				projectId,
				assetId,
				count: notes.length,
			});
		});
		const rows: AssetPriceRowDto[] = assets.value.map((loaded) => {
			const override = byAsset.get(loaded.entity.id) ?? null;
			return {
				assetId: loaded.entity.id,
				assetName: loaded.entity.name,
				catalogue: loaded.entity.unitCost,
				override: override?.entity.unitCost ?? null,
				overrideId: override?.entity.id ?? null,
				overrideVersion: override?.version ?? null,
			};
		});

		// **The ORPHANS, and without them this list is a trap.** Task 7a cleans overrides up
		// when `DeleteAssetCommand` runs — and an asset note deleted by hand in the file
		// explorer, or removed by sync, runs no command at all: `VaultChangeAdapter.onDelete`
		// drops the index entry and publishes `ProjectIndexEntryChanged`, and dispatches
		// nothing. So the override survives, `listAll` no longer names its asset, and a
		// catalogue-only join drops it from the one surface that can clear it. Unreachable, and
		// undeletable through any door the plugin offers.
		const seen = new Set(assets.value.map((loaded) => loaded.entity.id));
		for (const [assetId, override] of byAsset) {
			if (seen.has(assetId)) continue;
			rows.push({
				assetId,
				assetName: null,
				catalogue: null,
				override: override.entity.unitCost,
				overrideId: override.entity.id,
				overrideVersion: override.version,
			});
		}

		// Sorted so the list does not reshuffle between reads — `listAll` is index order, which
		// is a fact about the vault's write history rather than anything a reader expects.
		// Orphans last, together, and by id among themselves: they are a repair queue rather
		// than part of the catalogue the section exists to compare against, and they have no
		// name to sort by. `localeCompare` on a null would throw, so the null test is not a
		// nicety.
		rows.sort((a, b) => {
			if (a.assetName === null || b.assetName === null) {
				if (a.assetName !== null) return -1;
				if (b.assetName !== null) return 1;
				return a.assetId.localeCompare(b.assetId);
			}
			return a.assetName.localeCompare(b.assetName);
		});
		return ok(rows);
	}
}
```

**`assetName` and `catalogue` are NULLABLE, and that is this repository's own precedent rather
than a new idea.** `RequirementInspectorDTO.assetName` is nullable for exactly this reason, and
CLAUDE.md states why: *"A Requirement whose Asset was deleted renders from its id plus the
reason; typed `string`, the query would have had to fail or drop the row, and the stale warning
would be unreachable for exactly the rows that need it."* The first draft of this query made the
opposite choice one entity along — a catalogue-only join, dropping the row — without noticing
that the question had already been asked and answered here.

`catalogue` is null on an orphan because there is no library price: the asset is gone. Inventing
a zero would render a comparison against a number that does not exist, which is the same defect
as dropping the row wearing better clothes.

**The remedy is a READ, deliberately, and not the other one the report offered.** "Handle
out-of-band asset removal" would mean the vault-change pipeline dispatching `DeleteAssetCommand`
— a mechanism nothing here has: `VaultChangeAdapter` is the index's writer and publishes one
payload-carrying event; giving it a command bus makes every hand edit a domain transaction, with
its locks, its cascade and its recovery marker, for a case a read can answer. Rendering the
orphan needs no new seam: the query already reads `listByProject`, and `AssetPriceEdit` already
carries `assetId` and `expected`, so the existing clear button clears it unchanged.

- [ ] **Step 3: Add the Inspector's third figure**

In `GetRequirementsForZone`, extend `RequirementInspectorDTO` beside `quantity` and `cost`:

```ts
	/**
	 * §89's "beside what it replaced", at the INPUT level — the level `cost` below records the
	 * OUTPUT of. `catalogue` is the shared library's price, `projectOverride` this project's
	 * own or `null`, `effective` the one the figures were actually derived from. Three numbers
	 * in the worst case, which the task document names as a design requirement rather than
	 * something to discover while building the panel.
	 */
	unitCost: {
		/** The library's price NOW. */
		catalogue: Money;
		/** This project's own price NOW, or `null`. */
		projectOverride: Money | null;
		/**
		 * **The unit cost these figures were actually DERIVED FROM** — `r.calculatedFrom.unitCost`,
		 * NOT the current resolution.
		 *
		 * The two differ exactly when the row is stale: an override moved out of band, or a
		 * recalculation failed. Taking Task 6's freshly-resolved value here would label a price
		 * that was never used as the one in force, on a row simultaneously marked `stale` — the
		 * surface contradicting its own status field.
		 *
		 * It also keeps this group consistent with the one beside it: `cost.calculated` is
		 * historical, so the unit cost it was computed from must be too. `catalogue` and
		 * `projectOverride` are CURRENT, and the gap between them and this figure is precisely
		 * what a stale row exists to show.
		 */
		effective: Money;
	};
```

`effective` comes from `r.calculatedFrom.unitCost` — the persisted provenance — while `catalogue`
is `assetEntity.unitCost` and `projectOverride` is the value Task 6 resolved. When the asset is
gone the whole group is unavailable, so make it `unitCost: … | null` and set `null` for a row
whose `missingTarget` is `'asset'` — do not invent a zero.

**The rendering rule that follows, stated here because it is a property of the group rather than
of the component:** `catalogue` always draws; `projectOverride` draws when it is not null; and
`effective` draws as its OWN row whenever it differs from the current resolution
(`projectOverride ?? catalogue`) — which is the whole point of it being provenance rather than a
resolution.

**The mark is decided by PRECEDENCE, not by equality**, and an earlier draft had it the other way
round: "the mark lands on whichever drawn figure equals `effective`". A project may perfectly
well set its own price to the same number the library charges, and then both drawn figures equal
`effective` and both were marked — the surface saying two different rows are the one in force. So
the mark goes on the source of the current resolution: the project row whenever an override
exists, the catalogue row otherwise. The provenance row, when it draws, carries its own label
("these figures were calculated from") rather than the in-force mark, which is the truer sentence
anyway: on a stale row the figure in force and the figure the numbers came from are different
things, and labelling each as what it is beats marking one of them twice.

A mark exists to DISAMBIGUATE, so it is drawn only when more than one figure is. One figure —
the fresh, unoverridden case — needs none.

**Compare with `sameMoney`, and NOT with `Money.compare`.** `Money.compare` returns a `Result`
and REFUSES a currency mismatch — exactly the state this increment exists around, a GBP override
against an EUR catalogue — so a row would raise a calculation error while deciding what to draw.
`sameMoney` (Task 6, in `core/money/Money.ts`) is that guard: currency by field first, amount by
VALUE after.

**An earlier draft said "`amount` and `currency` as plain strings is the comparison, and it is
the same one `assetMatchesCalculatedFrom` already makes."** Both halves went wrong at once. The
string comparison renders `19.50` and `19.5` as different money, so this row would draw a
"calculated from" line — announcing that the figures came from a price other than the one in
force — for a requirement Task 6 simultaneously reports `current`, which is the surface
contradicting its own status field. And the sibling claim stopped being true the moment Task 6
fixed that predicate: the sentence pointed at the very function whose comparison bug it was
copying.

**Third caller, one question.** `sameMoney` now has three: the set command's no-op test,
`assetMatchesCalculatedFrom`, and this row's draw decision. That is the rule this plan keeps
paying for — a question worth asking at one door is a function — and it is worth noting that
minting the helper one round earlier did not by itself find this caller. A new shared predicate
is a reason to grep for everyone asking the same question by hand, in the edit that mints it.

**Step 3a: the ONE hand-built DTO fixture this widening breaks, fixed in THIS task.**

`unitCost` is a REQUIRED member, so every explicitly typed `RequirementInspectorDTO` literal in
`tests/` is a compile error the moment step 3 lands — and `npm run build` type-checks `tests/**`,
so leaving it to Task 8a leaves the tree red across a task boundary. Task 8a's own step 2 already
says "add the field to the fixture FIRST, or the red proves only that the test data is stale";
that instruction is right and was in the wrong task.

Measured with `grep -rn "RequirementInspectorDTO" src/ tests/`, which finds three test files and
exactly one that must change:

- `tests/presentation/editor/requirementRowFieldErrors.test.ts` — **`const ROW:
  RequirementInspectorDTO`**, the one literal to widen. `OVERRIDDEN_ROW` spreads `ROW` and
  inherits the new member; the `row: RequirementInspectorDTO = ROW` parameter defaults to it.
  One edit, not three.
- `tests/presentation/editor/inspector/inspectorStore.test.ts` — immune: its rows go through
  `as unknown as readonly RequirementInspectorDTO[]`, which is a cast rather than a check.
- `tests/presentation/editor/shell/requirementsPanel.test.ts` — immune: it names the type only
  in prose and builds its rows through the real query.

Give `ROW` a `unitCost` whose three figures agree (`catalogue`, `effective` both
`moneyOf('100.00', 'EUR')`, `projectOverride: null`) so that every existing case in that file
goes on describing the unoverridden, fresh row it was written for — a fixture that quietly
acquires an override changes what twelve unrelated assertions are about.

**This is the seventh required-member widening on this branch and the first to arrive after the
standing rule at the top of this plan was written.** The rule was applied to the interfaces with
obvious constructors — deps bundles, service literals — and not to a DTO, because a DTO reads as
data rather than as a contract somebody implements. It is the same grep either way. The fixture's
own docblock records this exact shape happening twice before it, for `calculated` and for
`recalculationStatus`: *"A fixture thinner than the real thing, invisible for exactly as long as
nothing drove the arm that needs it."* Three instances in one file is a property of the file, not
a coincidence.

- [ ] **Step 3b: Widen the project surface's READ boundary**

The exact sibling of Task 9's step 3a, and it was missed in the round that added that one —
fixing the write half and not the read half is this plan's own recurring failure, so it is
called out rather than quietly patched.

`ProjectDetailStore` reads only through `RenovationProjectQueryServices`, which declares
`listProjects`, `getProject` and `listPlansByProject` and nothing else. Constructing
`ListProjectAssetPrices` at the root does not make it reachable through `context.queries`, so
without this the section has no read operation to call and hydrates nothing.

1. `src/presentation/read-models/renovationProjectQueries.ts` — add
   `listAssetPrices(projectId: string): Promise<Result<AssetPriceRowDto[], RepositoryError>>` to
   the interface and to `createRenovationProjectQueries(...)`.
2. Its **unavailable fallback** — the refusal an unrecovered composition serves, through the
   same shared failure the existing entries use. As with the write boundary, this is the entry
   no compiler forces, so it gets its own assertion.
3. `renovationProjectDeps(...)` in `composition-root.ts` — bind the guarded query.
4. **Every OTHER construction, in `tests/`, which is type-checked.** Measured with
   `grep -rn "createRenovationProjectQueries(" src/ tests/` and
   `grep -rln "RenovationProjectQueryServices" src/ tests/`: thirteen factory calls, **eleven of
   them in tests** — ten in `tests/presentation/read-models/readModels.test.ts` and one in
   `tests/helpers/makeRenovationProjectView.ts` — plus typed service literals in six more files
   (`projectDetailStore.test.ts`, `renovationProjectStore.test.ts`, `viewRootProjectDetail.test.ts`,
   `viewRootFailure.test.ts`, `renovationProjectEmptyState.test.ts`, `harness/accessibility.test.ts`).
   Every one needs the new member: an ANSWERING query where the fixture has repositories to
   answer from — `makeRenovationProjectView.ts` above all, since the browser harness reads
   through it and a refusing double would make the new section unshowable there — and a
   deliberate refusal elsewhere.

- [ ] **Step 4: Compose and guard**

In `src/plugin/composition-root.ts`, construct the two COMMANDS and the query beside their
siblings. The repository itself was already constructed in Task 5 — it had to be, because a
required dep is a build error at three call sites — so this step adds only what Task 4 and this
task created. In `src/plugin/guardedServices.ts`, wrap both commands and
the query, exactly as their neighbours are.

**`tests/plugin/guardCategory.test.ts` will tell you if you missed a door** — it composes a real
root, detonates the named collaborators and drives a hostile input through every door it finds,
requiring the mapped `vault.unexpected-failure` back. A raw command rejects.

Add the new repository to that file's detonation list, which is a hand-written list of seven
names and is the one list in it that nothing pins.

- [ ] **Step 5: Write the wiring test**

`tests/plugin/assetPriceWiring.test.ts`. **Assert ABOVE the layer that erases the field** —
slice 19 shipped a wiring defect precisely because its only case read through a mapper that
dropped the field, leaving 1594 tests green:

```ts
it('drives the price-override cascade through the composed root', async () => {
	// Compose a real root; projects A and B both hold a requirement on the shared asset.
	expectOk(await root.setAssetPriceOverride.execute({
		projectId: projectA,
		assetId,
		unitCost: moneyOf('19.50', 'GBP'),
		expected: 'absent',
	}));

	// **Assert the RECALCULATED FIGURE, not a stale marker.** `EventBus.publish` awaits its
	// subscribers and `recalculateOne` is markStale-THEN-recalculate, so by the time `execute`
	// resolves the requirement has been rewritten and persists as `current` — which is what
	// `slice10CascadeWiring.test.ts` already asserts after its own equivalent cascades. A test
	// expecting `stale` here fails against the correct implementation, and the danger is not
	// that it fails: it is that somebody weakens the cascade to make it pass.
	const a = expectOk(await requirements.getById(projectARequirementId));
	expect(a?.entity.recalculationStatus).toBe('current');
	expect(a?.entity.calculatedFrom.unitCost.amount).toBe('19.50');

	// Project B never referenced this project's price, so nothing about it moved — same
	// revision, same figure. This is the narrowing, asserted at the composed root.
	const b = expectOk(await requirements.getById(projectBRequirementId));
	expect(b?.version.revision).toBe(revisionBefore);
	expect(b?.entity.calculatedFrom.unitCost.amount).toBe(catalogueAmount);
});

it('registers the cascade subscriber, not merely the commands', async () => {
	// Watched red with `registerOnAssetPriceOverrideChanged(...)` deleted from the root:
	// the commands still work and nothing else notices.
});
```

- [ ] **Step 6: Full gate, then commit**

Run: `npm run check`

```bash
git add src/application/queries src/presentation/read-models src/plugin tests
git commit -m "feat(query): what this project pays, and the Inspector's third figure

One query joining the catalogue with the project's overrides, carrying each
override's id and revision because clearing one is a conditional write. The
requirement DTO gains a unitCost group beside quantity and cost — the INPUT
level beside the OUTPUT level, which is §89 at both.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01G1z4YErxsacXRBUXoH94T8"
```

---

### Task 8a: the Inspector actually shows the three figures

**Files:**
- Modify: `src/presentation/editor/shell/RequirementRow.vue`
- **Create: `src/application/events/requirementFiguresChangeSource.ts`** (step 3a) — the third
  source. Nothing under `src/application/events/` subscribes to any recalculation event today:
  `planChangeSource` carries five plan events, `assetCatalogueChangeSource` four catalogue ones
  plus a filtered index event, and Task 9's `projectPricesChangeSource` two price ones. Without
  this module every scheduled wiring edit can be completed and `PlanEditorContext` still has no
  door to hear `RequirementRecalculated` or `RequirementInvalidated` through, which leaves the
  block showing a new price
  beside old persisted provenance — the exact defect step 3a's third source exists to close.
- Modify: **`src/presentation/editor/PlanEditorContext.ts`** — where the context is declared,
  measured rather than guessed. An earlier draft said *"`src/presentation/editor/tools/
  editor-context.ts` (or wherever `PlanEditorContext` is declared)"*, which is a hedge AND the
  wrong file: `tools/editor-context.ts` is the TOOL facade's `EditorContext`, the other half of
  the pair slice 8 renamed precisely because two types shared one name. A parenthetical "or
  wherever" reads as a measurement and is a guess — the same defect as the `helpers/result`
  import path, one task along.
- Modify: **`src/presentation/views/PlanEditorView.ts`** — BOTH the `PlanEditorDeps` interface
  and the context literal `mount()` builds from it. This is hops 2 and 3 of the chain the bullet
  below tabulates, and it was missing from this list entirely: without it the root has nothing
  to bind through and the view has nothing to forward.
- Modify: `src/plugin/composition-root.ts` — bind the sources in `planEditorDeps`. **Three**
  subscriptions in total, step 3a: the price one, the existing `onCatalogueChanged`, and this
  new one.
- **Modify: `src/presentation/editor/runtime.ts` — the CONSUMER, and without it the other two
  edits produce callback sources nobody subscribes to.** This is where a context member becomes
  a live subscription (`onBeforeUnmount(context.onCatalogueChanged(reloadAssetOptions))`) and
  where the Inspector is re-read (`hydrateInspector: (ids) => inspector.hydrateFrom(ids)`), so
  declaring `onProjectPricesChanged` and `onRequirementFiguresChanged` on the context and binding
  them at the root leaves a mounted Inspector rendering exactly the rows it mounted with. All
  three sources subscribe HERE, through the one single-flight loader step 3a describes, each
  disposed on unmount the way the catalogue one already is — and the recalculation source's
  callback filters on whether the delivered `requirementId` is among the rows the Inspector
  currently holds before it asks the loader for anything.

  **That filter FAILS OPEN on an empty snapshot, and without that it converts a transient
  failure into a permanent one.** `InspectorStore.refresh` ends with
  `requirements.value = isErr(rows) ? [] : rows.value` — so one transient requirements-query
  error blanks the rows. An id-membership filter over an empty set then admits NOTHING, no
  trailing read is ever scheduled, and the panel stays empty until the user changes selection.
  The pre-existing defect self-heals on the next post-command refresh; the filter is what makes
  it stick, which is this increment turning a recoverable fault into an unrecoverable one.

  Two changes, both small, and neither adds state:

  1. **Keep the previous rows when the rows query fails**, exactly as the same method already
     keeps the previous `dto` when `queryZone` fails. That method's own docblock argues the rule
     at length — *"a refresh that cannot confirm a change is not evidence the entity is gone"* —
     and the line below it blanks the sibling field for the same class of failure. One rule, two
     fields; the asymmetry is PRE-EXISTING and is fixed here because this filter is what makes it
     bite.
  2. **Admit the event when the snapshot is empty.** Preserving rows does not cover a FIRST
     hydrate whose rows query failed: there is nothing to preserve, so `[]` is legitimately
     incomplete rather than legitimately empty, and no flag distinguishes them. A filter exists
     to skip work, so the safe direction under uncertainty is to do the work: empty → re-read.

  **The cost is named rather than waved past**: a selected zone that genuinely has no
  requirements now re-reads once per recalculation event anywhere in the vault. That is one
  query against a zone with no rows, and it is the price of not tracking completeness in a
  second flag — which this plan's own rule prefers, since a flag is a thing that can go stale
  and an empty list cannot.

  Both halves need a case. Preserving rows alone passes a test that only drives a *later* failed
  refresh; failing open alone passes one that only drives a first hydrate. Drive both: a settled
  panel whose refresh query then fails must still admit its own requirement's event, and a panel
  whose FIRST rows read failed must admit one too.

  Its absence was invisible to every gate, which is the shape rather than the fact: nothing
  fails when a callback source has no subscriber. The three-part edit — declare, bind,
  SUBSCRIBE — is the same one slice 16 records for `ProjectIndexEntryChanged`, and the third
  part is the one a file list forgets.
- Modify: `src/presentation/i18n/locales/en.ts`, `src/presentation/i18n/locales/de.ts`
- Modify: `styles/` (the row's own partial)
- Test: `tests/presentation/editor/requirementRowFieldErrors.test.ts` (extend)
- Test: `tests/presentation/editor/inspectorPriceRefresh.test.ts`
- Test: `tests/application/events/requirementFiguresChangeSource.test.ts`
- **Modify: the whole `PlanEditorContext` CHAIN, which is five hops and not two.**

  A context member sourced from the composition root does not travel from the interface to the
  literals: it travels **interface → `PlanEditorDeps` → `PlanEditorView.mount` → the root's
  `planEditorDeps` → every typed construction of EITHER type**. An earlier draft of this bullet
  greped `": PlanEditorContext"`, found the two test literals and the interface, and scheduled
  those alone — so the production view would have had nothing to forward and `PlanEditorDeps`
  nothing to carry, which is a build failure at `PlanEditorView.ts` in the middle of the chain
  rather than a missed fixture at the end of it.

  **The instrument is an existing SIBLING member, not the type's name**, because what travels
  the chain is a member. `grep -rn "onCatalogueChanged" src/ tests/` — the most recently added
  member of exactly this shape — prints the complete list, and every one of these needs both
  new sources:

  | Hop | Site | What it does |
  | --- | --- | --- |
  | 1 | `src/presentation/editor/PlanEditorContext.ts:65` | declares the member on the context |
  | 2 | `src/presentation/views/PlanEditorView.ts:58` | declares it on `PlanEditorDeps` |
  | 3 | `src/presentation/views/PlanEditorView.ts:206` | forwards deps → context inside `mount` |
  | 4 | `src/plugin/composition-root.ts:507` | binds the real source in `planEditorDeps` |
  | 5 | `src/presentation/editor/runtime.ts:589` | SUBSCRIBES — the bullet above owns this one |
  | — | `tests/harness/planEditor.ts:209` | `harnessDeps(): PlanEditorDeps` |
  | — | `tests/harness/fixture.ts:214` | `harnessEditorContext()`, forwarding from `harnessDeps()` |
  | — | `tests/helpers/editor.ts:207` | the jsdom context literal |
  | — | `tests/presentation/views/planEditorView.test.ts:63` | `deps(): PlanEditorDeps` |

  `src/plugin/RenovationPlannerPlugin.ts:545` needs NOTHING — `planEditorViewDeps()` delegates
  to `planEditorDeps(...)`, which is why the precedent grep does not print it. And
  `tests/harness/entries.test.ts:230` is immune: it TAKES a `PlanEditorContext` as a parameter
  rather than building one.

  **`closeLeaf` is the counter-example, and it is why the short list looked complete.** It is a
  `PlanEditorContext` member with no `PlanEditorDeps` entry at all, and `PlanEditorView.ts:207`
  says why in a comment: *"the composition root composes services and knows nothing about which
  leaf this is."* So "a context member needs a deps member" is not a rule about the type — it is
  a rule about **where the value comes from**. Both of this task's new sources are event-bus
  change sources built at the root, so both take the full chain; a member the LEAF can produce
  takes hops 1 and 3 only.

  A no-op unsubscribe satisfies `tests/helpers/editor.ts` and `planEditorView.test.ts`; the two
  HARNESS entries should wire the real sources, because a context whose refresh callbacks do
  nothing is a harness that cannot show the behaviour this task exists to add.

  This is the **eighth** required-member widening in this increment. It was found before a
  review round in one sense — the bullet existed — and reported by one anyway, which is the
  distinction worth keeping: **a widening can be scheduled and still be measured with the wrong
  instrument**, and a list built from the type's name reads exactly like a list built from a
  member's.

**Interfaces:**
- Consumes: Task 8's `RequirementInspectorDTO.unitCost: { catalogue, projectOverride, effective } | null`.
- Produces: `createRequirementFiguresChangeSource(bus, onChanged)` from
  `src/application/events/requirementFiguresChangeSource.ts`, and a
  `PlanEditorContext.onRequirementFiguresChanged` member bound to it at the composition root.

**Why this is its own task.** Task 8 adds the DTO group and populates it, and **nothing renders
it** — no step in this plan touched `RequirementRow.vue` or `InspectorPanel.vue`, so spec
Decision 6's *"three numbers in the worst case, each labelled with what it is and which of them is
in force"* would have shipped as an unused DTO field. A promise in a document and a field nobody
reads: exactly the gap between promise and check this repository's own rules refuse, and it was
found by review rather than by any gate, because an unread DTO field fails nothing.

- [ ] **Step 1: Write the failing component test**

```ts
describe('RequirementRow unit cost', () => {
	it('shows the library price beside this project price, marking the one in force', () => {
		// unitCost: { catalogue: 24.00 EUR, projectOverride: 19.50 GBP, effective: 19.50 GBP }
		// Both figures present; the override carries the in-force mark.
	});

	it('shows the library price alone when the project has no override AND nothing is stale', () => {
		// projectOverride: null, effective === catalogue → one figure, no comparison, no
		// dangling label. BOTH conditions: the second is what the first draft of this case
		// left out, and the case below is the half it hid.
	});

	/**
	 * The no-override STALE row, which the first draft of the case above mandated rendering
	 * wrongly: `projectOverride` is null, the library price has moved, and the recalculation
	 * that would have caught up failed — so `effective` is still the old
	 * `calculatedFrom.unitCost`. Showing the current library price ALONE hides the price the
	 * displayed calculated cost was actually derived from, on a row simultaneously marked
	 * `stale`, which is the surface contradicting its own status field: precisely what Task 8's
	 * `effective` docblock says this group exists to prevent.
	 */
	it('shows the provenance beside the library price when they differ and there is no override', () => {
		// unitCost: { catalogue: 26.00 EUR, projectOverride: null, effective: 24.00 EUR }
		// Two figures. The in-force mark is on the 26.00 — no override, so the library price
		// is the current resolution — and the 24.00 draws as the provenance row, labelled as
		// what the figures beside it were computed from. Two labels, never one mark twice.
	});

	/** §85: never colour alone. The in-force marker is a word or a glyph plus the colour. */
	it('marks the figure in force with something a screen reader reads', () => { … });

	/**
	 * The case every other one here is blind to, because they all use different numbers: a
	 * project whose own price happens to equal the library's. An equality-based mark marks BOTH
	 * rows and the surface claims two figures are the one in force; precedence marks the project
	 * row and only that one.
	 */
	it('marks the project row alone when the override equals the library price', () => {
		// unitCost: { catalogue: 24.00 GBP, projectOverride: 24.00 GBP, effective: 24.00 GBP }
		// Exactly one in-force mark, on the project row.
	});

	/** Decision 6's "three numbers in the worst case", and the only shape that needs all three:
	 *  a project price that moved out of band under a failed recalculation. */
	it('shows all three when the override moved and the recalculation did not catch up', () => {
		// unitCost: { catalogue: 26.00 EUR, projectOverride: 21.00 GBP, effective: 19.50 GBP }
	});

	/** The asset is gone, so there is no catalogue price to compare against — Task 8 sets the
	 *  whole group to null rather than inventing a zero, and the row must not render an empty
	 *  comparison for it. */
	it('renders no unit-cost block when the asset is missing', () => { … });
});
```

- [ ] **Step 2: Run and watch it fail at the assertion**

Run: `npx vitest run tests/presentation/editor/requirementRowFieldErrors.test.ts`
Expected: FAIL because nothing renders the figures — not because the fixture lacks the field.
Task 8's step 3a already gave `ROW` its `unitCost`, so this red is about the RENDERING and
nothing else. If it fails at the fixture instead, step 3a was skipped and the red proves only
that the test data is stale.

- [ ] **Step 3: Add the copy to both locales**

`view.inspector.price-library`, `view.inspector.price-project`, `view.inspector.price-in-force`
and **`view.inspector.price-derived-from`** — the provenance row's label, which the row draws
whenever `effective` differs from `projectOverride ?? catalogue`. That fourth key was missing
until review caught it: the provenance row arrived with the precedence rule two rounds after
this list was written, and a row that exists with no key of its own leaves an implementer two
bad choices — reuse `price-in-force`, which says the opposite of what that row means, or write
a literal, which the step below forbids. Its own component case asserts the label, so the key
cannot quietly go unused either.

Sentence case; German for an Asset is `Objekt`. No literal reaches the template —
`I18N_LITERAL_BAN` does not watch a Vue interpolation, so this one rests on review.

- [ ] **Step 3a: Make a mounted Inspector hear the change, or it shows the old figures**

Measured: `PLAN_CHANGE_EVENTS` is `PlanBackgroundChanged`, `PlanCalibrated`, `ZoneCreated`,
`ZoneGeometryChanged`, `ZoneDeleted` (`planChangeSource.ts:25-30`). It carries neither
`AssetPriceOverrideChanged` nor any requirement recalculation event, and `onCatalogueChanged`
only reloads the assign picker's options. So a price set in the project pane runs the cascade,
rewrites the requirement, and an already-open Plan Editor keeps rendering the figures it read at
mount — including the very `unitCost` block this task adds, which would show a project price the
project no longer has.

**Two sources, because the block renders two things.** `unitCost` shows the catalogue price
beside the project's, so it goes stale from either side:

- `createProjectPricesChangeSource` (Task 9 step 4a — write it in whichever task runs first and
  consume it in the other), for this project's own price;
- **the existing `onCatalogueChanged`**, which the editor runtime already holds and which today
  reloads only the assign picker's options. An asset repriced, renamed or unit-edited in another
  leaf runs the asset cascade and rewrites the requirement, while a mounted Inspector keeps the
  catalogue figure it read at mount. Rehydrating the rows on that callback as well is the other
  half — and wiring only the price half would leave the block showing a stale *library* price
  next to a fresh project one, which is a worse picture than two stale numbers.

**A third source, because the block has three inputs and two of these events fire BEFORE the
figure they move.** `catalogue` comes from the asset, `projectOverride` from the override, and
`effective` from `requirement.calculatedFrom` — which neither of the two events above rewrites.
The cascade does, and it is a *sibling subscriber* of this refresh: `EventBus.publish` delivers to
every handler for an event without ordering them, so rehydrating on `AssetPriceOverrideChanged`
or `AssetUpdated` races the recalculation rather than following it. The Inspector would show the
new price beside the OLD provenance, and nothing would correct it, because the editor subscribes
to no recalculation event at all.

So the refresh also listens to **`RequirementRecalculated`**, which the cascade publishes after
each requirement is rewritten — the event that actually means "this requirement's stored figures
moved".

**That door has to be BUILT, and the first draft of this step named the event and scheduled no
module.** `src/application/events/` holds three sources and none of them carries a recalculation
event, so an implementer could finish every wiring edit in this plan with the Inspector still
unable to hear one. `createRequirementFiguresChangeSource` is the fourth, in the same directory
and for the same reason the other three live there: `application/` is the layer allowed to know
both the `EventBus` port and the event names, so `presentation/` takes a callback and learns
neither.

**It subscribes to TWO events, and a `RequirementRecalculated`-only source is silent on exactly
the path that needs it most.** Measured in `cascade.ts`: `recalculateOne` persists the stale
marker, publishes `requirementInvalidated(requirementId)`, then recalculates — and on a
recalculation FAILURE it publishes nothing at all, deliberately, under a comment saying
`RequirementRecalculated` "would misrepresent what happened". So the durable status is now
`stale` and the only event after that write was the invalidation. A source hearing recalculations
alone leaves a mounted Inspector rendering the row as `current` indefinitely — and the price and
catalogue subscriptions cannot cover it either, because they are concurrent SIBLINGS of the
cascade and can finish before `markStale` lands. `RequirementInvalidated`'s own docblock calls it
transient and "not persisted", which is true of the EVENT and not of the moment it is published:
the cascade publishes it after the marker is written, so a listener reading then reads the marker.

A successful recalculation therefore delivers two events, invalidated then recalculated. That is
the single-flight loader's job below, not a reason to pick one — and picking the recalculation
alone is what this finding is.

**The callback carries the `requirementId`, and the caller filters on the rows it is rendering.**
This replaces the projectId-delivery an earlier draft of this step described, and the new event is
what forced it rather than a change of mind: `RequirementInvalidated`'s payload is
`{ requirementId }` with no project in it, so a projectId filter cannot see the failure path at
all. The requirement id is also the NARROWER filter — the Inspector renders the requirements of
one selected zone, so a recalculation of a requirement outside that set moves nothing it draws —
and it needs neither the plan's `projectId` nor the resolution timing that made delivering one
awkward.

**The filter applies only to rows the Inspector has SETTLED, and an earlier draft would have
dropped events during hydration.** `inspector.requirements` is empty while the first read for a
selection is in flight — and that read has already fetched an old requirement by the time the
asset and project reads finish, so a recalculation landing in that window names a requirement the
rows do not yet contain, is filtered out, and the hydration then settles with the old provenance
and nothing scheduled to correct it. A stale row for the life of the selection, from a race whose
window is exactly the read that renders it.

So: filter when a hydrate has settled, admit everything while one is in flight. The cost of
admitting is bounded at ONE extra trailing read, because the single-flight loader collapses the
window's events into one — which is what makes "when in doubt, refresh" affordable here rather
than the usual bad answer. With NOTHING selected there are no rows and no read in flight, so the
refresh is still correctly a no-op.

**A project-wide cascade fires one of those per requirement, and the request ticket does NOT
collapse that burst** — an earlier draft of this plan said it did, and reading
`inspector-store.ts` says otherwise: `queryZone` and `requirementsQuery.execute` both run to
completion BEFORE `if (request !== latestRequest) return`, so the ticket discards a superseded
result and never a superseded READ. Ten recalculations would buy ten pairs of vault reads and
nine discarded answers. The ticket's job is ordering — it stops the slower earlier read winning
— and it was never a rate limit.

What collapses a burst is a **single-flight loader with a trailing request**, and this repository
already has one to copy: `createAssetOptionsLoader` in `src/presentation/editor/runtime.ts`,
which the editor runtime already uses for the assign picker's own catalogue reload. A call
while a read is running sets `requestedAgain`
rather than starting a second read, and the running read loops once more when it finishes — so
*"ten events during one scan buy one more scan, not ten"*, and the trailing read is a REQUEST
rather than a queue. What that gives up is knowing which event the final read answers, which is
exactly as harmless here as it is there: the rows are a full snapshot of the block either way.

So the three sources call ONE entry point, which single-flights the read; the request
ticket stays underneath it, because a hydrate can still be raced by a caller the loader does not
own (a fresh mount, a navigation) and because dropping it would reintroduce the race it was added
for. Two mechanisms, two jobs — and the reason they are not one is that neither does the other's:
the ticket cannot stop a read starting, and the loader cannot order reads it did not issue.

```ts
it('shows the recalculated provenance, not the new price beside the old one', async () => {
	// Delay the cascade's recalculation deliberately, publish AssetPriceOverrideChanged, and
	// assert the row settles on the RECALCULATED unitCost.effective rather than on the value it
	// held when the price event was delivered. Watch it fail with only the two price/catalogue
	// subscriptions wired: the row shows the new projectOverride against the old effective, and
	// stays there.
});
```

**The general shape, third time in three rounds:** a value's refresh needs one subscription per
INPUT, and "the event that caused the change" is not always "the event after which the value is
correct".

**Not by widening `PLAN_CHANGE_EVENTS`.** That list is keyed by plan id
(`planIdOf(event) === planId`) and a price override carries no plan, so an entry there would
either never match or would have to bypass the filter the list exists for. A second source is
the shape this codebase already uses for a second question.

```ts
it('rehydrates the inspector rows when a project price changes in another leaf', async () => {
	// Mount the editor with a zone selected, publish AssetPriceOverrideChanged for that
	// project and asset, and assert the row's unitCost moved. Watch it fail with the
	// subscription removed — with it removed the row keeps the price it mounted with.
});

it('rehydrates the inspector rows when the catalogue price changes', async () => {
	// The other source. Watch it fail with only the price subscription wired: the row keeps
	// the catalogue figure it mounted with, beside a project price that did move.
});

/**
 * The hydration window. Select a zone, and while its first read is still in flight publish
 * `RequirementRecalculated` for a requirement that read will return. The row must settle on the
 * RECALCULATED provenance. Watch it fail against a filter that tests the committed rows
 * unconditionally: `inspector.requirements` is empty at that moment, the event is dropped, and
 * the stale row stands for the life of the selection.
 */
it('does not drop a figure event that arrives during the first hydration', async () => { … });

it('answers a burst of recalculations with one trailing read, not one read each', async () => {
	// Count the query calls. Publish RequirementInvalidated/RequirementRecalculated ten times
	// inside one in-flight read, and assert the loader issued TWO — the one already running
	// and one trailing.
	// Watch it fail with the loader replaced by a bare call per event: ten reads, and every
	// one of them a pair of vault round trips the ticket would have discarded nine of.
});
```

- [ ] **Step 4: Render it, then look at it**

Follow the row's existing quantity/cost blocks — this is the same §89 "beside what it replaced"
shape one level up, so it should read as their sibling rather than as a third idea.

Run: `npm run harness-shot` and read the picture. A third figure in a row that already carries
two is exactly where spacing and wrapping break, and no gate here measures either.

- [ ] **Step 5: Full gate, then commit**

```bash
git add src/presentation src/application/events src/plugin styles tests
git commit -m "feat(inspector): the price beside the price it replaced

Task 8 added the DTO group and nothing rendered it, so the three figures
existed as a field no component read. §89 at the input level, beside the
output level the row already shows.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01G1z4YErxsacXRBUXoH94T8"
```

---

### Task 9: the section a user reaches

**Files:**
- Create: `src/presentation/views/AssetPriceList.vue`
- **Create: `src/presentation/views/assetPriceEdit.ts`** — the `AssetPriceEdit` union the
  component's `commit` prop takes. Its own module rather than the SFC, because `<script setup>`
  cannot export a binding, and the state on the other side of the seam has to name the type.
- Create: `src/application/events/projectPricesChangeSource.ts` (step 4a)
- Modify: `src/presentation/views/ProjectDetail.vue`, `src/presentation/views/ProjectDetailState.vue`
- Modify: `src/presentation/read-models/PlanDto.ts` — `ProjectSummaryDto.currency`'s docblock,
  which claims the field is display-only with no consumer. It has one now.
- Modify: `src/presentation/views/renovationProjectCommands.ts` — the write boundary this
  section dispatches through, plus its unavailable fallback (step 3a).
- Modify: `src/presentation/stores/ProjectDetailStore.ts`
- Modify: `src/presentation/views/RenovationProjectContext.ts` — the two change sources reach the
  view through its context, the same seam `onPlanChanged` already uses; `presentation/` may not
  reach the event bus itself.
- Modify: `src/plugin/composition-root.ts` — bind both sources in `renovationProjectDeps`
  (`:557`), as it already binds `onCatalogueChanged` for the editor and `onProjectsChanged`
  (`:589`) for this one.
- **Modify: every CONSTRUCTION of `RenovationProjectDeps`, and the failure has TWO shapes.**
  Measured with the sibling-member instrument the standing rule now names — `grep -rn
  "onProjectsChanged" src/ tests/`, the existing change source of exactly this kind — rather
  than with the type's own name. **The chain is shorter than Task 8a's**: there is no separate
  deps type here, because `RENOVATION_PROJECT_CONTEXT` is an `InjectionKey<RenovationProjectDeps>`
  and the bundle IS the context. Interface, root binder, constructions; no forwarding hop.

  **A build error, in exactly one file.** `tests/helpers/makeRenovationProjectView.ts:193` is
  `const defaults: RenovationProjectDeps = {` — the one hand-built typed literal in the suite.
  Every other typed construction SPREADS it (`viewRoot.test.ts:44`,
  `viewRootProjectDetail.test.ts:110`, `viewRootFailure.test.ts:59`,
  `renovationProjectEmptyState.test.ts:90`, `harness/accessibility.test.ts:154` and `:312`,
  `harness/mount.ts:183`) or delegates to `renovationProjectDeps` itself
  (`plugin/renovationProjectWiring.test.ts:76`), so all of them inherit the new members. That is
  the factory's own design and its docblock says so — *"a member `RenovationProjectDeps` grows
  next is decided once there rather than guessed here"*. `src/plugin/RenovationPlannerPlugin.ts:510`
  needs nothing either: `projectViewDeps(leaf)` delegates to `renovationProjectDeps` and supplies
  only the three LEAF-specific members.

  **A RUNTIME fault that compiles cleanly, in exactly one more.** Three test files provide the
  context as `[RENOVATION_PROJECT_CONTEXT as symbol]: { … }`, and the `as symbol` cast erases
  the `InjectionKey`'s type — so an absent member is not a build error, it is an `undefined`
  that faults when the new subscription is invoked. Only ONE of the three reaches it:
  `tests/presentation/views/viewRootOpenProject.test.ts:53` carries `projectId: KITCHEN.id`, so
  it mounts `ProjectDetailState`, which is where the price section and therefore the
  subscriptions live. `viewRootCreateProject.test.ts` and `viewRootIndexRebuild.test.ts` both
  pass `projectId: null` — the LIST state, which never mounts the detail tree. **Add both members
  to `viewRootOpenProject.test.ts` and to neither of the other two**, which is the narrow answer
  rather than the safe-looking wide one: a member spelled into a list-state fixture is a key
  nothing reads, and this file's own convention is that *"every override declared here is
  CONSUMED"*.

  **The repository had already written this class down, twice, and the plan did not apply it.**
  `viewRootOpenProject.test.ts:60` says it where the fixture is: *"a `provide` value is
  `unknown`, so nothing type-checks this literal and an absent key reaches `ViewRoot` as an
  `undefined` no gate would report"* — citing `viewRootIndexRebuild.test.ts`, which gives it at
  length. A rule stated in a docblock is a rule some door is not following, and the docblock is
  where to look first.
- Modify: `src/presentation/i18n/locales/en.ts`, `src/presentation/i18n/locales/de.ts`
- Modify: `src/presentation/i18n/toUserMessage.ts` — **two** rows in `CODE_SUFFIX_KEYS`, for
  `schema-version-malformed` and `project-folder-unresolved`, beside the `-unsupported` one it
  has. See the error-copy table in step 1 for why both are suffixes rather than per-kind
  entries: each is raised from ONE shared site parameterised by kind, so a direct entry answers
  it for one kind and leaves the siblings on the generic sentence.

  **`grep -rno '\${spec\.kind}\.[a-z-]*\|\${kind}\.[a-z-]*' src/infrastructure/` is the
  instrument** that finds this class, and it is written here because two review rounds found one
  member of it each. Run it once rather than meeting the third by report — and it was run:
  **four** shared raise sites exist, `migration-failed`, `schema-version-unsupported`,
  `schema-version-malformed` and `project-folder-unresolved`. The first two already have suffix
  entries; these two rows are the other half. **With them the class is closed**, which is a
  claim the grep can be re-run against rather than a hope.
- Modify: `styles/` (a partial, registered in `styles/index.css`)
- Test: `tests/presentation/views/assetPriceList.test.ts`
- Test: extend `tests/harness/accessibility.test.ts`

**Interfaces:**
- Consumes: Task 8's `AssetPriceRowDto` and `ListProjectAssetPrices`, Task 4's two commands.
- Produces: `src/presentation/views/assetPriceEdit.ts`, then `AssetPriceList.vue` with
  `defineProps<{ rows: readonly AssetPriceRowDto[]; currency: string; commit: (edit: AssetPriceEdit) => Promise<AssetPriceCommitResult>; logger: Logger }>()`,
  and `interface AssetPriceCommitResult { readonly dispatch: DispatchResult; readonly settled: PriceRowExpectation | null }`.

**`AssetPriceEdit` is the component-to-state boundary and has to be WRITTEN, not assumed.** An
earlier draft used it in that `defineProps` and defined it nowhere — its only occurrence in the
plan, and nothing of that name exists in `src/`. It is a discriminated union over the two
commands, in its own module beside the component:

```ts
import type { Money } from '../../core/money/Money';
import type { PriceRowExpectation } from '../../application/commands/asset-price/priceRowExpectation';

/**
 * One row's submitted gesture. A UNION rather than an optional `unitCost`, so "clear" cannot be
 * spelled as a set with the price left off — the two dispatch different commands and a shape
 * that admits both in one branch is a shape the state has to re-derive the intent from.
 *
 * **`expected` travels with the edit**, frozen at the moment the field went dirty (Step 3),
 * because the state builds the command at dispatch time and by then the props may be a
 * different pair at a different version. That is the whole point of the change source in step
 * 4a, and it is why this is not `{ assetId, unitCost }` with the state looking the expectation
 * up.
 *
 * **`projectId` is deliberately ABSENT.** The component has none and must not: it renders the
 * rows of whichever project the detail state is already on, so a project id in the edit would
 * be a second answer to a question `ProjectDetailState` already owns — and the two could
 * disagree across a navigation.
 *
 * **`assetId` is a plain `string` and `expected` carries a BRANDED id, which is not an
 * inconsistency.** `assetId` is passed through, so the state brands it when it mints the command
 * input, the same seam every other id crosses on this surface. `expected` is not passed through:
 * it is a `PriceRowExpectation` the component CONSTRUCTS from its frozen snapshot, so it must be
 * branded here or the type is a lie with a cast in it. `AssetPriceRowDto.overrideId` is therefore
 * `AssetPriceOverrideId | null` — `RequirementInspectorDTO`'s own split, where the id the row acts
 * on is branded and the ids it displays are not. An earlier draft of this docblock said branding
 * happens in the state FULL STOP, which was true of one field and false of the other.
 */
export type AssetPriceEdit =
	| {
			readonly kind: 'set';
			readonly assetId: string;
			readonly expected: PriceRowExpectation;
			readonly unitCost: Money;
	  }
	| {
			readonly kind: 'clear';
			readonly assetId: string;
			readonly expected: PriceRowExpectation;
	  };
```

**`commit` returns more than a `DispatchResult`, and it has to.** `DispatchResult` is
`Result<DispatchOutcome, AppError>` and `DispatchOutcome` is `'wrote' | 'no-write'` — it carries
no entity at all, deliberately, because slice 13 minted it to answer one question. So Step 3's
rule that a successful command replaces the row's frozen expectation with its own result is
unimplementable through that type: the component would have nothing to write. `settled` is what
the command actually established about the pair — `{ id, version }` from
`SetAssetPriceOverrideResult`, `'absent'` after a clear, and `null` when the command refused, so
a refusal leaves the snapshot exactly where it was.

The component still hands `useFieldCommit` a plain `DispatchResult`: its `history` adapter calls
`props.commit(edit)`, writes `settled` into the snapshot when it is not null, and returns
`dispatch`. **`useFieldCommit` is not widened**, which is the point of putting the seam here —
it is a composable eight other fields already use, and the one thing this surface needs that the
others do not is a fact about a pair.

Without it the pending-clear case from Step 2 cannot work at all: the queued clear is built
before the dirty field can adopt refreshed props, so with no channel from the set's own result it
would submit `'absent'` against a pair the set had just created, and the clear would refuse — the
user's cancellation failing for the second time in one gesture. Reported by review against the
first version of the Step 3 rule, which asserted a result the seam could not deliver.

**`currency` is the PROJECT's, and it is load-bearing rather than decoration.** The increment's
central case is a GBP project pricing an EUR catalogue asset with no override yet — and the row's
only available currency there is the catalogue's EUR. Following `RequirementRow`'s pattern of
minting `Money` from the row's own effective currency would submit EUR,
`SetAssetPriceOverrideCommand` would refuse it on the coherence rule, and **the dead end this
increment exists to close would be reachable through the shipped surface**. The typed amount
becomes `createMoney(typed, props.currency)` — the validating door, so a malformed currency
refuses rather than being asserted.

A prop on the LIST rather than a field on every row: one project, one currency, and a per-row
copy is a value that can disagree with itself.

`ProjectDetail` already holds it (`ProjectSummaryDto.currency`, which slice 21 renders in the
header). **That field's docblock calls it "for display only… this surface prints it and compares
nothing, and a brand at a boundary with no consumer is a claim nothing rests on" — and this
increment makes that false.** Update the comment in the same edit. It stays a plain `string`
rather than gaining the brand, because `createMoney` is the validating door and a brand would
move that check earlier without removing it.

**Read `PlanList.vue` and `RequirementRow.vue` first.** This is `PlanList`'s sibling in shape
(a header, then a `<ul>`) and `RequirementRow`'s in commit behaviour (`useFieldCommit`, blur and
enter, a rejected commit KEEPS the typed value).

- [ ] **Step 1: Add the copy to both locales**

In `locales/en.ts`:

```ts
	'view.project.prices-title': 'Asset prices',
	'view.project.price-catalogue': 'Library price',
	'view.project.price-yours': 'This project',
	'view.project.price-set': 'Set a price',
	'view.project.price-clear': 'Use the library price',
	'view.project.no-assets': 'The library has no assets yet',
	'view.project.price-invalid': 'Enter a price like 19.50',
	'view.project.price-scope': 'A price set here applies to every requirement in this project that uses the asset',
	'view.project.price-orphan': 'This asset is no longer in the library',
```

**`view.project.price-scope` is the project-wide warning Step 3 promises, and it had no key.**
That paragraph says the warning "belongs here" and gives the reason the affordance is on this
surface rather than the Inspector's row — an override is per-(project, asset), so one edit moves
every requirement in the project on that asset. Step 3 asserted it and this inventory did not
carry it, so an implementer working from the list would have shipped the control without the
disclosure that is its whole justification for living here. **A warning promised in a design
paragraph and absent from the copy inventory is a warning that does not exist**, and no gate can
see the gap: `I18N_LITERAL_BAN` fires at a literal, never at an absent one.

**`view.project.price-orphan` is the same defect one round earlier, in my own edit.** The orphan
row's rendering rule says the asset id draws "with a translated reason beside it" and no key was
added for that reason either. Both are in the inventory now, and both are asserted in step 2 —
because copy that exists in `en.ts` and is rendered nowhere is the other half of the same class.

**`view.project.price-invalid` is the VALIDATOR's message, and it needed a key of its own.** The
validator returns a resolved string — that is what `useFieldCommit.validate` is — so without one
the only choices are a literal, which the rendering step forbids, or the requirement row's
existing parse key, which tells the user to reset to a calculated figure this control does not
have. `money.invalid-amount` is not the answer either: it has no locale entry, so it falls back
to the generic Validation sentence, which is the defect the error table below exists to close.
The copy SHOWS the shape rather than describing it, because "a valid monetary amount" does not
tell a user that `.5` and `1e3` are the forms being refused.

In `locales/de.ts`, the same keys. **An Asset is `Objekt`, never `Material`** —
`tests/presentation/i18n/strings.test.ts` refuses that value, and slice 14 reintroduced it forty
lines below the comment recording its removal. Keep every interpolation hole that `en.ts` has:
the per-key hole check is what catches a mis-holed translation.

**And the `AppError` copy, which goes in the SAME table and was scheduled nowhere until this
step.** `toUserMessage` asks `hasLocaleKey(error.code)` first, so a code IS a locale key — there
is no second file — and only then falls back to `CODE_SUFFIX_KEYS` and finally to the category
sentence. A code that reaches neither of the first two degrades to that category sentence, which
is the defect slice 11 records: two refusals told a user "That entry no longer exists" about an
entry whose continued existence was the whole reason for the refusal.

**Read the resolver before writing the table, which is what an earlier draft of this step did
not.** `CODE_SUFFIX_KEYS` already answers `revision-conflict`, `external-modification`,
`schema-version-unsupported` and `migration-failed` for ANY prefix, so several `asset-price.*`
codes are already served and listing them as gaps is wrong. What each code needs:

| Code | Entry? | What it must say |
| --- | --- | --- |
| `asset-price.currency-mismatch` | **new** | The price has to be in the project's own currency. |
| `asset-price.revision-conflict` | **new, and it deliberately OVERRIDES the suffix** | The suffix entry says "Reload and try again", which is wrong on this surface: there is nothing to reload, and Step 3's frozen snapshot means the DISCARD is the gesture that unsticks the field. A direct code key beats the suffix because `hasLocaleKey` is asked first — say so where the entry is, or the next reader deletes it as a duplicate of the suffix. |
| `asset-price.external-modification` | **new, overriding the suffix — and an earlier draft of this table said "none"** | The suffix says "edited outside the plugin. Reload and try again." That was written when this row was reasoned about without Step 3's snapshot: there is no reload control on this surface, and a refresh CANNOT help, because the snapshot is frozen for exactly as long as the draft is. Same recovery as the row above — discard the entry, which returns the field to clean and re-arms the snapshot from the refreshed row. A shared suffix is right until a surface's recovery differs from the one it names. |
| `asset-price.project-not-found` / `asset-price.asset-not-found` | **new** | The project, or the asset, is no longer there. |
| `asset-price.write-failed` / `asset-price.delete-failed` | **new** | The price could not be saved, or removed. |
| `asset-price.entity-invalid` / `asset-price.frontmatter-invalid` | **new** | The note could not be read. |
| `asset-price.project-folder-unresolved` | **a new SUFFIX entry, same shape as the row below** | `noteEntityWrite.ts:116` raises `` `${spec.kind}.project-folder-unresolved` `` when an insert cannot resolve the owning project's folder — reachable here when a project note is deleted out of band between this command's project read and its save. No locale entry exists for it under ANY kind (measured), so `zone.` and `plan.` already render the generic Persistence sentence too. One suffix row, three kinds. |
| `asset-price.schema-version-malformed` | **a new SUFFIX entry, not a direct one** | `noteIo.ts` raises `` `${kind}.schema-version-malformed` `` before any mapper runs, so it reaches the section's read and has neither a direct key nor a `CODE_SUFFIX_KEYS` match — the whole price list would fail with the generic Validation sentence rather than saying a price note is unreadable. **Fix it as a suffix**, beside `schema-version-unsupported`: the code is generated from ONE shared raise site for every entity kind, so a per-kind entry would answer that site five more times and leave five kinds disagreeing. Measured: `grep -n "schema-version-malformed" locales/en.ts` finds nothing today, so `plan.` and `zone.` already render the generic sentence — **pre-existing, and this is a one-row fix that closes it for all of them** rather than a widening this increment invented. |
| `asset-price.negative-unit-cost` | **new** | A price cannot be negative. Unreachable while the field validator below holds, and localized anyway — see the note under the table. |

Build the test table from the RAISE SITES rather than from `en.ts`, per `toUserMessage.test.ts`'s
own rule: a table derived from the locale file agrees with a typo. The codes with no user-facing
door — `asset-price.duplicate-pair` (a diagnostic), `asset-price.orphaned-by-asset-delete` (its
own notice) and `asset-price.pre-write-invalid` (no user-facing door) — get NO entry, and that
absence is stated here so it reads as a decision rather than an omission, exactly as
`project.negative-amount` already is in that file's minted table.

**`asset-price.negative-unit-cost` is NOT in that list, and an earlier draft put it there on a
claim nothing implemented.** It said the component "refuses a negative literal before
dispatching" and scheduled no such refusal: `Money` is signed on purpose, `createMoney('-1.00',
'GBP')` succeeds, so `-1` typed into the field reached `AssetPriceOverride.create`, raised that
code, and — with no locale entry — rendered the generic Validation sentence instead of saying a
price cannot be negative. Both halves are scheduled now, and the reason for taking both rather
than either is the kind of unreachability involved:

- **the refusal**, as `useFieldCommit`'s own `validate?: (draft) => string | null` — which exists
  precisely so the guard is not re-remembered at each call site — rejecting a draft that is not a
  monetary literal or is negative, with resolved copy and no dispatch at all. Step 2 gains a case
  for it, watched failing against a component with no validator, where the dispatch happens and
  the command refuses.

  **Validate with `createMoney`, NOT with `moneyOf`, and an earlier draft of this bullet said to
  copy `RequirementRow`'s `canBeMoney`, which would have been wrong here.** That helper wraps
  `moneyOf`, whose `LITERAL_PATTERN` accepts `+1`, `.5` and `1e3`; this component mints with
  `createMoney`, whose `AMOUNT_PATTERN` refuses all three. Two constructors, two answers, and the
  validator would have passed drafts the commit could not build — a `Result` nobody has an arm
  for, at the one door that exists to stop exactly that. `RequirementRow` is consistent for
  ITSELF, because it also dispatches through `moneyOf`; copying half of that pairing is what
  breaks. **Parse once**: the validator holds the `Result` and the commit reuses its value rather
  than parsing a second time, so the two cannot disagree at all rather than merely agreeing
  today.
- **and the copy**, because this code is unreachable only while that guard exists. That is a
  different thing from `project.negative-amount`, which is unreachable because no caller sets the
  field at all — a structural absence no edit can quietly undo. A code held out of reach by a
  guard degrades to the WRONG sentence the day the guard moves, so it gets copy that costs two
  strings and reads correctly either way.

- [ ] **Step 2: Write the failing component test**

```ts
describe('AssetPriceList', () => {
	it('renders one row per asset, with the library price and a dash where there is no override', () => { … });

	it('dispatches a set for a typed price on blur', async () => { … });

	/**
	 * The row supplies the expectation the command needs — `overrideVersion` when it rendered a
	 * price, `'absent'` when it rendered a dash. Task 8's DTO carries those fields for exactly
	 * this; a row that dispatched without them would make the command a blind overwrite.
	 */
	it('passes the row expectation into the command', async () => { … });

	/**
	 * **The expectation is the one this row LAST KNEW, not the one it is rendering.** Reading
	 * it inside `buildCommand` — which runs at dispatch time — defeats the whole guard at
	 * exactly the moment it is needed: `useFieldCommit` deliberately keeps an uncommitted
	 * draft while the canonical value moves underneath it, so a sync or another leaf refreshes
	 * the row to a new `overrideId`/`overrideVersion`, the user's blur then builds `expected`
	 * from the REFRESHED row, and the stale draft saves over the price the user never saw.
	 * That is the lost update the required expectation exists to stop, reintroduced one layer
	 * above the command. See Step 3 for the rule.
	 */
	it('submits the expectation the row had when editing began, not the refreshed one', async () => {
		// Type into a row showing 19.50 at version 1, refresh the section with that pair at
		// version 2 (another leaf's write), blur. `expected` must name version 1, and the
		// command must refuse. Watch it fail against a `buildCommand` that reads the props:
		// the dispatch carries version 2 and succeeds, which is the defect.
	});

	/** Slice 16's rule: a rejected commit KEEPS the user's value and shows the error. */
	it('keeps the typed value and shows an inline error when the command refuses', async () => {
		commit.mockResolvedValue({
			dispatch: err({ category: 'Validation', code: 'asset-price.currency-mismatch', message: '' }),
			settled: null, // a refusal establishes nothing, so the snapshot must not move
		});
		// … expect the input still to hold what was typed, and a .rp-field-error to be present.
	});

	/**
	 * The guard `RequirementRow` had to learn the hard way: pressing clear on a row with no
	 * override must dispatch NOTHING. A command for a no-op is a write, a revision bump and a
	 * cascade standing for a change nobody made.
	 *
	 * BOTH halves of that guard, because this case is only its first: the row must be clean AND
	 * not pending. `RequirementRow.reset` spells it `if (!overridden && !field.pending.value)`
	 * and its docblock says why — "the row's DTO has not refreshed while a commit is in flight,
	 * so `override` still reads `null` for a write that is on its way to persisting one".
	 */
	it('dispatches nothing when clear is pressed on a clean row that has no override', async () => {
		expect(commit).not.toHaveBeenCalled();
	});

	/**
	 * The other half, which an `override === null` test alone certifies WRONG: type a price into
	 * an empty row, **Tab to the clear button** — so the blur really is a separate commit
	 * gesture — and press it before the vault answers. Treating that as a no-op discards the
	 * user's cancellation and lets the set persist: the gesture the user made is the one thing
	 * that does not happen. Routed through `onCommit` instead, it becomes the queued follow-up
	 * the composable's coalescing already knows how to answer.
	 *
	 * **The keyboard is load-bearing in this case's setup and was not, before the pointer case
	 * below existed.** With `@mousedown.prevent` on the button a CLICK no longer blurs, so a
	 * version of this case driven by a click asserts the opposite of its sibling and one of the
	 * two has to be wrong. Tab commits and click does not; that asymmetry is the contract, not
	 * an accident of how the test was written.
	 */
	it('cancels a set that is still in flight when clear is reached by keyboard', async () => {
		// The clear dispatches, and its `expected` names what the SET wrote — see Step 3.
	});

	/**
	 * The POINTER path, and the guard that makes it differ: a browser blurs the input on the
	 * button's `mousedown`, before the `click` that runs the handler, so one gesture on a dirty
	 * field becomes a set THEN a clear — two writes, two events and two project-wide cascades
	 * for one click, with the discarded price left standing if the clear refuses.
	 *
	 * Drive the real sequence (`mousedown`, `blur`, `click`) rather than `click()` alone, which
	 * jsdom does not expand into it: a case that only clicks passes against a button with no
	 * guard at all, which is this repository's own "a test that drives an impossible input is
	 * evidence about a different program". Watch it fail with `@mousedown.prevent` removed —
	 * `commit` is then called twice, and the FIRST call is the set.
	 */
	it('dispatches only the clear when the button is clicked on a dirty field', async () => {
		expect(commit).toHaveBeenCalledTimes(1);
		// … and that one call is the clear, asserted on the command input rather than on a badge.
	});

	/**
	 * The increment's central case, at the surface: a GBP project, an EUR catalogue asset, no
	 * override. The submitted `Money` must be GBP. Watch it fail against a component that mints
	 * from the row's effective currency — the command refuses, and the dead end is back.
	 */
	/**
	/**
	 * The project-wide warning, which is the disclosure that justifies this affordance living on
	 * the project surface rather than on the Inspector's requirement row. Asserted on the
	 * rendered TEXT and asserted ONCE — a per-row repetition would read as a per-row consequence,
	 * which is the opposite of what it says.
	 *
	 * It is a rendering case rather than a locale case on purpose: a key present in `en.ts` and
	 * rendered nowhere passes every i18n gate this repository has, which is exactly how it came
	 * to be missing in the first place.
	 */
	it('discloses that a price here reprices every requirement in the project, once', async () => {
		expect(wrapper.findAll('.rp-asset-price-scope')).toHaveLength(1);
		// … and its text resolves `view.project.price-scope`.
	});

	/**
	 * The ORPHAN row: an override whose asset was deleted out of band, so `assetName` and
	 * `catalogue` are both null. It must be VISIBLE and CLEARABLE and must not accept a new
	 * price — a set on a missing asset mints data nothing can price, and the command reads the
	 * asset and refuses, so a live input here is a control that cannot succeed.
	 *
	 * Assert all three, because each is a different mistake: a component that drops the row
	 * leaves the price unreachable, one that disables the whole row leaves it undeletable, and
	 * one that leaves the input live ships a guaranteed refusal.
	 */
	it('renders an orphaned override with its id, no library price, and only Clear live', async () => {
		// rows: [{ assetId: 'a1', assetName: null, catalogue: null, override: 19.50, … }]
		expect(wrapper.text()).toContain('a1');
		// … and the reason beside it, resolving `view.project.price-orphan` — an id with no
		// sentence is a row the user cannot interpret, which is half of being unreachable.
		expect(wrapper.find('.rp-asset-price-orphan').exists()).toBe(true);
		expect(wrapper.find('input').attributes('disabled')).toBeDefined();
		expect(wrapper.find('.rp-asset-price-clear').attributes('disabled')).toBeUndefined();
	});

	it('submits the typed price in the project currency, not the catalogue currency', async () => {
		// rows: [{ catalogue: 24.00 EUR, override: null, … }], currency: 'GBP'
		expect(commit).toHaveBeenCalledWith(expect.objectContaining({
			unitCost: expect.objectContaining({ amount: '19.50', currency: 'GBP' }),
		}));
	});

	/**
	 * A negative price never reaches the command. `Money` is signed on purpose and
	 * `createMoney('-1.00', 'GBP')` succeeds, so without `useFieldCommit`'s `validate` the
	 * dispatch happens, `AssetPriceOverride.create` refuses with `asset-price.negative-unit-cost`,
	 * and the user is told nothing useful. Watch it fail against a component with no validator:
	 * `commit` is called, which is the assertion below inverted.
	 */
	it('refuses a negative price at the field, dispatching nothing', async () => {
		// type '-1.00', blur
		expect(commit).not.toHaveBeenCalled();
		// … and a .rp-field-error saying a price cannot be negative.
	});

	/**
	 * The forms `moneyOf` accepts and `createMoney` refuses — the reason the validator uses the
	 * constructor that MINTS. Watch it fail against a validator built on `RequirementRow`'s
	 * `canBeMoney`: every one of these passes validation, and the commit then holds a `Result`
	 * it has no arm for.
	 */
	it.each(['abc', '.5', '+1', '1e3'])('refuses %s at the field, dispatching nothing', async (draft) => {
		expect(commit).not.toHaveBeenCalled();
		// … and `view.project.price-invalid` rendered in the row's .rp-field-error.
	});

	it('renders the empty state when the library is empty', () => { … });
});
```

- [ ] **Step 3: Write the component**

Mirror `PlanList.vue`'s structure: an `<h3>` header (the project's name above is the `<h2>`;
heading order is one of the five things the axe case grades), then a `<ul>` of rows. Each row
shows the asset name, the library price, and an input bound through `useFieldCommit` with a
clear button. No literal copy — every string through `tr(...)`.

**`@mousedown.prevent` on the clear button, and it is not a nicety.** A browser blurs the focused
input on the button's `mousedown`, BEFORE the `click` that runs the handler — so without it, one
gesture on a dirty field is TWO commands: a set persisting the price the user is discarding, then
the clear. Two writes, two `AssetPriceOverrideChanged` events and two project-wide cascades for
one click, and if the clear then refuses, the typed price stands over the library price the user
asked for. `RequirementRow.vue:272` carries the identical guard with the identical reasoning,
learned there the hard way (*"one Reset gesture on a dirty field wrote twice … and Undo then
restored that transient value rather than the override that preceded it"*), and
`DialogHost.onMousedown` uses the same mechanism. `preventDefault` on `mousedown` preserves focus
and cancels nothing else, so the click still fires.

**It covers the POINTER path only, which is what makes it compatible with the in-flight case
above rather than a contradiction of it.** Reaching the clear button by Tab still blurs and still
commits, and that is CORRECT — tabbing away is itself the commit gesture `useFieldCommit`'s
contract names, so the set is a real user intent and the clear becomes the queued follow-up the
coalescing already answers. The two cases are one keyboard gesture and one pointer gesture with
different right answers, and the plan says which is which rather than leaving the next reader to
find a file asserting two outcomes for what reads as the same act. That sentence is lifted from
`RequirementRow.vue`'s own docblock, which states the carve-out where the guard is.

**The project-wide warning renders ONCE, with the section, not per row.** It is a fact about
what the control does — every requirement in this project on that asset is repriced — rather
than about any one asset, so a per-row repetition would be the same sentence N times and would
read as a per-row consequence. It sits under the `<h3>`, before the list, so it is read before
the first control rather than discovered after one; `view.project.price-scope` is its key, and
its absence from the copy inventory is what a review round caught.

**An ORPHAN row draws differently, and it is the one row whose only useful control is Clear.**
`assetName === null` is the discriminator (Task 8's DTO), and it means the asset this price names
was deleted out of band — by hand in the file explorer, or by sync — so no command ran to clean
it up. Render the asset ID in place of the name with a translated reason beside it, draw no
library price (`catalogue` is null; there is nothing to compare against), and **disable the
price input while leaving Clear live**: setting a new price on an asset that does not exist mints
data nothing can ever price, and `SetAssetPriceOverrideCommand` reads the asset and would refuse
anyway — a live control that dispatches a guaranteed refusal is the same defect slice 14's
amendment refuses. The row exists so the user can get RID of it.

This is `RequirementRow`'s own shape for the same situation, which is where the pattern comes
from rather than being invented here: a Requirement whose Asset was deleted renders from its id
plus the reason, because the alternative is a row the user cannot see and therefore cannot act
on.

**The project-wide warning belongs here.** A price set on this row moves every requirement in
the project on that asset; the section's own heading and its placement on a project surface are
what make that honest, which is exactly why this is not a control on the Inspector's row.

**The expectation is SNAPSHOT state on the row, not a read of the props.** `buildCommand` runs at
dispatch time, and by then the props may be a different pair at a different version — that is the
whole point of the change source in step 4a. Two writers, one field:

- while the field is CLEAN, the snapshot tracks the row (`overrideId`/`overrideVersion`, or
  `'absent'` for a dash) — a clean field has nothing to protect and must follow the vault;
- a SUCCESSFUL command overwrites it with `AssetPriceCommitResult.settled` — the pair as the
  command actually left it, which is the newest thing this component knows to be true about it,
  and what makes the pending-clear case above correct: the queued clear is built after the set
  settles and expects exactly what the set wrote. It arrives through `commit`'s own return type
  rather than through `DispatchResult`, which carries `'wrote' | 'no-write'` and no entity —
  see this task's Interfaces for why the seam is there and not in `useFieldCommit`.

While the field is dirty the snapshot is frozen, so a refresh underneath an uncommitted draft
cannot move it. A resubmit against a pair that really did move therefore refuses with
`asset-price.revision-conflict`, which is the right answer and needs a recovery the user can
perform: the inline copy for that code must say the price was changed elsewhere and that
discarding the entry shows the current one. `onCancel` — Escape, and the clear button's own
no-op arm — is that discard, and it returns the field to clean, which re-arms the snapshot from
the refreshed row. Keeping the draft through a refusal is slice 16's rule; re-arming on the
deliberate discard is what stops that rule turning into a field that can never be submitted
again.

- [ ] **Step 4: Mount it, and hydrate it**

Add the section to `ProjectDetail.vue` below the plans region, and give `ProjectDetailStore` the
rows plus a request ticket — the store already hydrates from more than one caller, and without a
ticket the slower earlier read wins and a just-set price vanishes with no error.

- [ ] **Step 3a: Widen the project surface's write boundary, or the section is read-only**

`ProjectDetailState` reaches writes ONLY through `RenovationProjectCommandServices`, which today
declares exactly `createProject`, `createPlan` and `logger` — all REQUIRED, under a docblock
saying an optional member "would let a composition forget it and still compile". Constructing the
two price commands in Task 8 does not make them reachable from this component's `commit`
callback; without this step the section renders and dispatches nothing, which is the dead
control slice 14's amendment refuses and would leave the Issue's dead end open after all.

Three edits, and the third is the one a compile error will not catch:

1. `renovationProjectCommands.ts` — add `setAssetPriceOverride` and `clearAssetPriceOverride` to
   the interface, REQUIRED like their siblings and for the stated reason.
2. `unavailableRenovationProjectCommands()` — both refusals, through the SAME
   `persistenceFailure()` the existing pair share, so `settings.unrecovered` cannot drift into
   two spellings of one state.
3. `renovationProjectDeps(...)` in `composition-root.ts` — bind the guarded commands. The
   interface being required makes 1 and 3 build errors; nothing makes 2 one, so it is the entry
   a composition can quietly leave refusing wrongly.
4. **Every typed `RenovationProjectCommandServices` literal in `tests/`**, measured with
   `grep -rln "RenovationProjectCommandServices\|unavailableRenovationProjectCommands" src/ tests/`:
   eight test files — `makeRenovationProjectView.ts`, `viewRoot.test.ts`,
   `viewRootProjectDetail.test.ts`, `viewRootFailure.test.ts`, `viewRootIndexRebuild.test.ts`,
   `viewRootOpenProject.test.ts`, `renovationProjectEmptyState.test.ts` and
   `harness/accessibility.test.ts`. `makeRenovationProjectView.ts` builds its `commands` literal
   from `createProject`, `createPlan` and `logger` alone and is explicitly typed, so it is a
   compile error the moment these two are required — and it must get REAL commands over the same
   repositories its queries use, not refusals: its own docblock records that this fixture
   answering rather than refusing is what makes the harness show a working surface, and the
   section is unusable there otherwise.

```ts
it('refuses a price edit with the unrecovered-settings code when the root could not compose', async () => {
	const result = await unavailableRenovationProjectCommands().setAssetPriceOverride.execute(input);
	expect(isErr(result) && result.error.code).toBe('settings.unrecovered');
});
```

- [ ] **Step 4a: Make it hear about changes, or it draws the vault it read at mount**

Measured, and the reason this is its own step: `createProjectListChangeSource` accepts
`ProjectIndexEntryChanged` only for `renovation-project` and `createProjectPlansChangeSource`
only for `renovation-plan`, so **nothing** currently tells this section that an asset or a price
moved. An open pane would draw the vault as it was at mount — indefinitely — through a price set
in another leaf, an asset renamed or repriced, or either note arriving by sync.

Two subscriptions, not one, and the split is by concern rather than by convenience:

- **`createAssetCatalogueChangeSource`** already exists, already filters
  `ProjectIndexEntryChanged` to `renovation-asset`, and is already the answer to "the catalogue
  moved". Reuse it. Writing a source that duplicated its event list to cover both halves would
  be a second copy of a list that goes stale — the defect its own header describes.
- **`createProjectPricesChangeSource`**, new, in `src/application/events/`: subscribes to
  `AssetPriceOverrideChanged` and to `ProjectIndexEntryChanged` filtered to
  `renovation-asset-price`. The domain event covers this plugin's own writes; the index event
  covers a price note added by hand, copied in, or arriving through sync, for which
  `VaultChangeAdapter` is the sole index writer and publishes no domain event of its own.

Filter both, for the reason `assetCatalogueChangeSource`'s header gives: unfiltered, a burst of
synced zone notes re-reads the whole catalogue once per note.

**This is not the recalculation source.** Task 8a creates
`src/application/events/requirementFiguresChangeSource.ts` for `RequirementRecalculated` and
`RequirementInvalidated`, neither of which these two subscribe to — write it in whichever of the two tasks runs first and
consume it in the other, exactly as this source itself is shared. The project pane does NOT need
it: this section renders the catalogue price and the project's own, both of which the two
subscriptions above cover, and no provenance figure that only a recalculation moves.

Both hand rehydration to ONE trailing single-flight loader — `createAssetOptionsLoader`'s shape,
the same one Task 8a uses for the Inspector, built once here and shared by the two
subscriptions — and that loader hydrates through the SAME request ticket from Step 4 underneath.
Two mechanisms, two jobs, and neither does the other's: the ticket orders reads it did not issue
(a fresh mount, a navigation racing a refresh), and only the loader can stop a read STARTING.

**The loader is not belt and braces here, and an earlier draft of this step left it out on a
measurement of the wrong case.** That draft reasoned about deleting an asset — one override
removed per project, so one event per section — and concluded a burst had no producer. The
producer is a SYNC, or a library move: `ProjectIndexEntryChanged` fires once per note, both of
these sources are subscribed to it, and each callback runs a full `listAll` plus
`listByProject`. A vault syncing a large catalogue would launch one whole price-list scan per
arriving note, all concurrent, every one but the last discarded by the ticket after its reads
had already happened. Measuring the case in front of you and calling the class surveyed is this
plan's most-repeated mistake, and this is the second time it has been made about this exact
mechanism.

Test it as behaviour rather than as wiring:

```ts
	it('rehydrates the price rows when a price note changes out of band', async () => {
		// mount, then publish ProjectIndexEntryChanged for a renovation-asset-price entry
		// and assert the row's override moved. Watch it fail with the subscription removed.
	});

	it('rehydrates when the catalogue changes', async () => { … });

	/**
	 * The burst. Publish twenty `ProjectIndexEntryChanged` for price and asset entries inside one
	 * in-flight read — a sync arriving — and count the query calls: TWO, the one already running
	 * and one trailing. Watch it fail against a build that hands each callback straight to the
	 * ticket: twenty concurrent full scans, nineteen of them discarded after they had read.
	 */
	it('answers a burst of index changes with one trailing read', async () => { … });
```

- [ ] **Step 5: Style it**

A new partial under `styles/`, registered in `styles/index.css`. **No hard-coded colour** — the
build fails on one, checked over lightningcss's parsed tree. Use Obsidian's semantic variables.
Give the asset name `flex-grow: 1` if the row is a `space-between` flex row: slice 19 shipped a
defect where a third item in such a row pushed the other two out of their column.

- [ ] **Step 6: Grade it**

Extend `tests/harness/accessibility.test.ts` to scan the detail state with prices present, and
assert the elements are actually in the scanned DOM — `await flushPromises()` first, or the scan
finds zero elements and passes on an empty subtree, which is indistinguishable from a pass on a
compliant one.

- [ ] **Step 7: Look at it**

Run: `npm run harness-shot project-detail` and `npm run harness-shot project-detail -- --width=460`

Read the pictures. Spacing, wrapping, overflow, hit size and contrast are measured by no gate in
this repository — this is the only instrument that reaches them, and it has caught ten defects
`npm run check` could not.

- [ ] **Step 8: Full gate, then commit**

Run: `npm run check`

```bash
# `src/application` and `src/plugin` are NOT optional here: step 4a creates the change source
# and binds it at the root, and staging only the presentation half commits a context member
# with no binding behind it — a commit that either fails to build or ships the section without
# the subscription that keeps its rows true.
git add src/presentation src/application/events src/plugin styles tests
git commit -m "feat(view): a project can price a shared asset in its own currency

The affordance, on the project detail state rather than the Inspector's
requirement row: an override is project-wide, so a control that edited it
from a row carrying two requirement-scoped overrides would silently reprice
every other requirement in the project.

The whole catalogue with prices optional, so the shared default stays
visible beside this project's — §89's 'beside what it replaced'.

Closes the dead end the currency increment left: the refusal now has a way
to pass it that a user can reach.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01G1z4YErxsacXRBUXoH94T8"
```

---

## After the last task: the documents this increment owes

Not optional, and not a tidy-up — a withdrawal recorded only in a spec is one the next author
re-adds as an oversight.

- [ ] **`docs/tasks/20`** — a dated Amendment 3 carrying the spec's "Amendments owed" list: the
  affordance deferral **withdrawn**, the port's fifth method, the coherence rule and the fact
  that it belongs to `SetAssetPriceOverrideCommand` rather than to `AssetPriceOverride.create`
  (so a later reader does not re-add it to the entity and make every drifted note unreadable),
  the note's id-derived filename (so the illustrative `Asset Prices/Porcelain Terrace Tile.md` is
  **not** what ships), and every Amendment 1 item 7 criterion ticked or amended by name.
- [ ] **`docs/issues/The cost pipeline is told the currency it must produce.md`** — **close it**,
  and only now: its own instruction is *"Until that pair is green, the answer above is a
  decision without an end-to-end witness."* The pair is Task 5's witness; the affordance is
  Task 9's.
- [ ] **`docs/requirements/Asset library.md`** — its open definition-of-done item, *"A project
  can record its own price against a shared definition"*, is met.
- [ ] **`CLAUDE.md`** — the increment's own paragraph, and **all four** residuals the spec
  records: setting a price is not undoable; a project's currency can move under existing
  overrides; a hand-edited note can disagree with it; and an out-of-band price change (a hand
  edit, a sync, a delete in the file explorer) refreshes the views and recalculates nothing —
  the fourth, added late, and the one most worth carrying into that file because it is
  PRE-EXISTING and symmetrical with `onAssetUpdated`, so a reader who meets it later will
  otherwise read it as this increment's defect.

  **Count them from the spec rather than from this line.** It said "the three residuals" for
  several rounds after the fourth was added — a count in prose, which is the stale claim this
  repository records more often than any other, in a checklist whose whole job is to stop a
  known fact being dropped.

- [ ] **Gate, then commit — the TENTH commit, and this section had none.** Four checkboxes sat
  here after Task 9's `git commit` block with no staging command and no commit step, so an agent
  following the plan literally would finish the increment with every one of these edits sitting
  unstaged in the working tree. *"A withdrawal recorded only in a spec is one the next author
  re-adds as an oversight"* is this section's own first sentence; a withdrawal recorded only in
  an uncommitted file is worse, because it is invisible even to the author who wrote it.

  **A tenth commit rather than folding these into Task 9's, which was the other remedy offered
  and is the wrong one here.** Two reasons. These documents are about the WHOLE increment, not
  about the view Task 9 builds, and mixing an increment-wide documentation change into a feature
  commit breaks this plan's one-commit-per-task shape for no gain. And two of the four can only
  be TRUE after Task 9 has landed — the Issue's own instruction is *"Until that pair is green,
  the answer above is a decision without an end-to-end witness"*, and `Asset library.md`'s item
  is met by the affordance existing. Closing them in the commit that creates the thing they
  attest to would be closing them one commit early.

  Run `npm run check` first. **Be honest about what that proves here**: none of these four files
  is compiled, linted or read by any gate — `docs/` is the vault (user land) and `CLAUDE.md` is
  prose — so the gate says nothing about the edits themselves. What it does say is that the tree
  is still green, which catches a Task 9 left half-finished under a section that reads like
  paperwork.

```bash
npm run check

git add docs/tasks docs/issues docs/requirements CLAUDE.md
git commit -m "docs: record what the price-override increment withdrew and left standing

Amendment 3 on task 20: the affordance deferral withdrawn, the port's fifth
method, the coherence rule and why it belongs to the command rather than the
entity, and the note's id-derived filename.

Closes the currency issue now that both halves of its witness exist, ticks
the Asset library definition-of-done item, and carries all four residuals
into CLAUDE.md — including the out-of-band price change, which is
PRE-EXISTING and symmetrical with onAssetUpdated, so a later reader does not
meet it as this increment's defect.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01G1z4YErxsacXRBUXoH94T8"
```

---

## Self-review

Run against the spec, section by section.

**Spec coverage.** Decision 1 → Task 9. Decision 2 → Task 4 (the rule) and Task 1 (its
deliberate absence, pinned). Decision 2a → Task 4. Decision 2b → Task 7a. Decision 3 → Task 2.
Decision 4 → Task 5. Decision 5 → Task 6. Decision 6 → Tasks 8 and 8a (the query and the renderer; the DTO group alone is a field nobody reads). Decision 7 → Task 3. Persistence → Task 3.
Testing → the witness is Task 5 step 1; the precedence, the false-mismatch arms, the unit arm,
the narrowed cascade, the duplicate-pair diagnostic and the create refusal are Tasks 1, 3, 6, 7.
Residuals → the documents section above.

**One gap found and closed while reviewing:** the spec named the commands nowhere — it said
"the affordance" and "the create path" without giving them names — and the witness cannot be
written without them. They are Task 4, and their two design decisions (upsert on the pair; a
no-op clear announces nothing) are stated there rather than left to be invented. A review bot
reported the same gap independently; the spec now carries them as Decision 2a.

**A second gap, and this section had claimed to handle it without doing so.** The spec's
precedence case — *"a Requirement with both overrides live, asserting the requirement override is
in force and that changing the price override moves `calculated` and not the effective figure"* —
was described here as belonging "in Task 6's suite", and Task 6's listed tests did not contain
it. A self-review that names a gap and does not close it reads exactly like one that closed it,
and the completion amendments would then have ticked the criterion over nothing. It is written
out in Task 6, step 5.

**Type consistency.** `resolveEffectiveUnitCost` (async, repository) and `effectiveUnitCostFrom`
(pure, map) are two names for two shapes and are used as such in Tasks 5 and 6.
`AssetPriceOverrideChanged` carries `{ projectId, assetId }` in Tasks 4, 7 and 8.
`getForPair(projectId, assetId)` keeps that argument order everywhere.

**Placeholder scan.** The task bodies that are deliberately partial are Task 3 step 8, Task 8
step 5 and Task 9's tests — each because the fixture stack they need is an existing helper the
implementer must read rather than one this plan should invent a second version of. Each says
which file to read. No step says "add appropriate error handling" or "write tests for the above".
