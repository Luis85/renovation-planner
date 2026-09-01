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
- **Commit after every task.** Each task below ends green on its own — strictly stronger than
  the spec's four-commit sequencing, which is the coarse grouping these nine tasks fall into.

---

## File Structure

**Created:**

| Path | Responsibility |
| --- | --- |
| `src/domain/asset-price/AssetPriceOverride.ts` | The entity and its smart constructor, including the currency coherence rule. |
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
| `src/presentation/stores/ProjectDetailStore.ts` | Hold the price rows. |
| `src/plugin/composition-root.ts`, `src/plugin/guardedServices.ts` | Construct and guard. |
| `src/presentation/i18n/en.ts`, `de.ts` | The section's copy. |
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
  `static create(props: CreateAssetPriceOverrideProps, projectCurrency: Currency):
  Result<AssetPriceOverride, ValidationError>` and
  `withUnitCost(unitCost: Money, projectCurrency: Currency): Result<AssetPriceOverride, ValidationError>`.

- [ ] **Step 1: Write the failing tests**

Create `tests/domain/asset-price/assetPriceOverride.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { AssetPriceOverride } from '../../../src/domain/asset-price/AssetPriceOverride';
import { createAssetPriceOverrideId } from '../../../src/domain/asset-price/AssetPriceOverrideId';
import { createProjectId } from '../../../src/domain/project/ProjectId';
import { createAssetId } from '../../../src/domain/asset/AssetId';
import { currencyOf, of as moneyOf } from '../../../src/core/money/Money';
import { expectOk } from '../../helpers/result';

const GBP = currencyOf('GBP');
const EUR = currencyOf('EUR');

function props() {
	return {
		id: createAssetPriceOverrideId(),
		projectId: createProjectId(),
		assetId: createAssetId(),
		unitCost: moneyOf('19.50', 'GBP'),
	};
}

describe('AssetPriceOverride', () => {
	it('is created when its unit cost is in the project currency', () => {
		const created = expectOk(AssetPriceOverride.create(props(), GBP));
		expect(created.unitCost.amount).toBe('19.50');
		expect(created.unitCost.currency).toBe('GBP');
	});

	/**
	 * The coherence rule. An override denominated in anything but the project's currency is a
	 * DEAD entry: the pipeline refuses it, so the only thing it can ever do is make the assign
	 * it was created to rescue refuse again. Rejected at the entity because the constructor is
	 * private, which is the reason `Project.create` gives for its own budget/contingency rule.
	 */
	it('refuses a unit cost that is not in the project currency', () => {
		const result = AssetPriceOverride.create({ ...props(), unitCost: moneyOf('19.50', 'EUR') }, GBP);
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('unreachable');
		expect(result.error.code).toBe('asset-price.currency-mismatch');
		expect(result.error.category).toBe('Validation');
	});

	it('refuses a negative unit cost', () => {
		const result = AssetPriceOverride.create({ ...props(), unitCost: moneyOf('-1.00', 'GBP') }, GBP);
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('unreachable');
		expect(result.error.code).toBe('asset-price.negative-unit-cost');
	});

	/** Zero is a real price — a supplier throwing in offcuts free of charge is not an error. */
	it('accepts a zero unit cost', () => {
		const created = expectOk(AssetPriceOverride.create({ ...props(), unitCost: moneyOf('0.00', 'GBP') }, GBP));
		expect(created.unitCost.amount).toBe('0.00');
	});

	/** `withUnitCost` rebuilds through `create`, so every edit re-runs both refusals. */
	it('re-validates on edit and keeps identity', () => {
		const created = expectOk(AssetPriceOverride.create(props(), GBP));
		const edited = expectOk(created.withUnitCost(moneyOf('21.00', 'GBP'), GBP));
		expect(edited.id).toBe(created.id);
		expect(edited.projectId).toBe(created.projectId);
		expect(edited.assetId).toBe(created.assetId);
		expect(edited.unitCost.amount).toBe('21.00');

		const refused = created.withUnitCost(moneyOf('21.00', 'EUR'), GBP);
		expect(refused.ok).toBe(false);
	});
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `npx vitest run tests/domain/asset-price/assetPriceOverride.test.ts`
Expected: FAIL — cannot resolve `src/domain/asset-price/AssetPriceOverride`.

If `tests/helpers/result.ts` has no `expectOk`, check what it exports and use the house
spelling; do not add a second helper.

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
import { isNegative, type Currency, type Money } from '../../core/money/Money';
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
	 * `projectCurrency` is a PARAMETER rather than a field, because it is not this entity's
	 * fact — it belongs to the Project, it can move independently, and storing a copy here
	 * would be a second answer to what currency a project prices in.
	 *
	 * The mismatch refusal is NOT a second expression of `computeEstimatedCost`'s. That one
	 * asks *may this figure be computed*; this asks *is this override capable of ever being
	 * used*. They answer differently on different inputs, which is the test for whether a
	 * second check is duplication rather than a guard.
	 */
	static create(
		props: CreateAssetPriceOverrideProps,
		projectCurrency: Currency,
	): Result<AssetPriceOverride, ValidationError> {
		if (props.unitCost.currency !== projectCurrency) {
			return err(
				assetPriceError(
					'currency-mismatch',
					`A price override must be in the project's currency (${projectCurrency}); `
						+ `got ${props.unitCost.amount} ${props.unitCost.currency}.`,
				),
			);
		}
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

	/** Rebuilds through `create`, so an edit re-runs both refusals. `id` is identity. */
	withUnitCost(unitCost: Money, projectCurrency: Currency): Result<AssetPriceOverride, ValidationError> {
		return AssetPriceOverride.create(
			{ id: this.id, projectId: this.projectId, assetId: this.assetId, unitCost },
			projectCurrency,
		);
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

The entity, its id and its error factory. The coherence rule is the one
thing here the task document does not specify: an override denominated in
anything but the project's currency is a dead entry, refused at the entity
because the constructor is private. Not a second expression of the
pipeline's refusal — the two answer differently on different inputs.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01G1z4YErxsacXRBUXoH94T8"
```

---

### Task 2: the port and the in-memory repository

**Files:**
- Create: `src/application/ports/AssetPriceOverrideRepository.ts`
- Create: `src/infrastructure/persistence/in-memory/InMemoryAssetPriceOverrideRepository.ts`
- Test: `tests/infrastructure/persistence/assetPriceOverrideRepository.contract.ts` (shared)
- Test: `tests/infrastructure/persistence/inMemoryAssetPriceOverride.test.ts`

**Interfaces:**
- Consumes: Task 1's `AssetPriceOverride`, `AssetPriceOverrideId`; `Expected`, `EntityVersion`,
  `Loaded` from `application/ports/versioning`; `RepositoryError` from `ports/repositoryErrors`.
- Produces: `interface AssetPriceOverrideRepository` with `getById`, `getForPair`,
  `listByProject`, `listByAsset`, `save`, `delete`; and
  `assetPriceOverrideContract(makeRepo)`, the shared contract test Task 3 reuses.

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
 */
export interface AssetPriceOverrideRepository {
	getById(id: AssetPriceOverrideId): Promise<Result<Loaded<AssetPriceOverride> | null, RepositoryError>>;
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
```

- [ ] **Step 2: Write the shared contract test**

Read `tests/infrastructure/persistence/` first and follow whatever the existing shared
contract file is called and how it is parameterised — there is one already for the other
repositories, and this must be its sibling rather than a second convention. Create
`tests/infrastructure/persistence/assetPriceOverrideRepository.contract.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { AssetPriceOverrideRepository } from '../../../src/application/ports/AssetPriceOverrideRepository';
import { AssetPriceOverride } from '../../../src/domain/asset-price/AssetPriceOverride';
import { createAssetPriceOverrideId } from '../../../src/domain/asset-price/AssetPriceOverrideId';
import { createProjectId } from '../../../src/domain/project/ProjectId';
import { createAssetId } from '../../../src/domain/asset/AssetId';
import { currencyOf, of as moneyOf } from '../../../src/core/money/Money';
import { expectOk } from '../../helpers/result';
import type { ProjectId } from '../../../src/domain/project/ProjectId';
import type { AssetId } from '../../../src/domain/asset/AssetId';

const GBP = currencyOf('GBP');

export function makeOverride(projectId: ProjectId, assetId: AssetId, amount = '19.50'): AssetPriceOverride {
	return expectOk(
		AssetPriceOverride.create(
			{ id: createAssetPriceOverrideId(), projectId, assetId, unitCost: moneyOf(amount, 'GBP') },
			GBP,
		),
	);
}

/**
 * One contract, both implementations. The in-memory double and the note-backed repository
 * must answer identically or the suite is testing a fake that production does not match —
 * the "a fake must not be kinder than the real thing" rule, expressed as a shared spec.
 */
export function assetPriceOverrideContract(
	name: string,
	makeRepo: () => Promise<AssetPriceOverrideRepository> | AssetPriceOverrideRepository,
): void {
	describe(`${name} — AssetPriceOverrideRepository contract`, () => {
		it('answers null for a pair with no override', async () => {
			const repo = await makeRepo();
			const found = expectOk(await repo.getForPair(createProjectId(), createAssetId()));
			expect(found).toBeNull();
		});

		it('round-trips an override and finds it by its pair', async () => {
			const repo = await makeRepo();
			const projectId = createProjectId();
			const assetId = createAssetId();
			const saved = expectOk(await repo.save(makeOverride(projectId, assetId), 'absent'));
			expect(saved.version.revision).toBe(1);

			const found = expectOk(await repo.getForPair(projectId, assetId));
			expect(found).not.toBeNull();
			expect(found?.entity.unitCost.amount).toBe('19.50');
			expect(found?.entity.unitCost.currency).toBe('GBP');
		});

		/** Three decimals, because `594.005` is not representable in binary floating point
		 *  while `99.99` survives a coercion — the shared rule for catching a YAML float. */
		it('preserves a three-decimal amount exactly', async () => {
			const repo = await makeRepo();
			const projectId = createProjectId();
			const assetId = createAssetId();
			expectOk(await repo.save(makeOverride(projectId, assetId, '594.005'), 'absent'));
			const found = expectOk(await repo.getForPair(projectId, assetId));
			expect(found?.entity.unitCost.amount).toBe('594.005');
		});

		it('refuses an insert for an id that is already taken', async () => {
			const repo = await makeRepo();
			const override = makeOverride(createProjectId(), createAssetId());
			expectOk(await repo.save(override, 'absent'));
			const again = await repo.save(override, 'absent');
			expect(again.ok).toBe(false);
		});

		it('refuses a save whose expected revision is stale', async () => {
			const repo = await makeRepo();
			const override = makeOverride(createProjectId(), createAssetId());
			const saved = expectOk(await repo.save(override, 'absent'));
			const edited = expectOk(saved.entity.withUnitCost(moneyOf('21.00', 'GBP'), GBP));
			expectOk(await repo.save(edited, saved.version));
			const stale = await repo.save(edited, saved.version);
			expect(stale.ok).toBe(false);
		});

		it('lists by project and by asset, and each excludes the other axis', async () => {
			const repo = await makeRepo();
			const projectA = createProjectId();
			const projectB = createProjectId();
			const assetX = createAssetId();
			const assetY = createAssetId();
			expectOk(await repo.save(makeOverride(projectA, assetX), 'absent'));
			expectOk(await repo.save(makeOverride(projectA, assetY), 'absent'));
			expectOk(await repo.save(makeOverride(projectB, assetX), 'absent'));

			const byProject = expectOk(await repo.listByProject(projectA));
            expect(byProject).toHaveLength(2);
			expect(byProject.every((o) => o.entity.projectId === projectA)).toBe(true);

			const byAsset = expectOk(await repo.listByAsset(assetX));
			expect(byAsset).toHaveLength(2);
			expect(byAsset.every((o) => o.entity.assetId === assetX)).toBe(true);
		});

		it('deletes an override, after which its pair answers null again', async () => {
			const repo = await makeRepo();
			const projectId = createProjectId();
			const assetId = createAssetId();
			const saved = expectOk(await repo.save(makeOverride(projectId, assetId), 'absent'));
			expectOk(await repo.delete(saved.entity.id, saved.version));
			expect(expectOk(await repo.getForPair(projectId, assetId))).toBeNull();
		});

		it('refuses a delete whose expected revision is stale', async () => {
			const repo = await makeRepo();
			const saved = expectOk(await repo.save(makeOverride(createProjectId(), createAssetId()), 'absent'));
			const edited = expectOk(saved.entity.withUnitCost(moneyOf('21.00', 'GBP'), GBP));
			const second = expectOk(await repo.save(edited, saved.version));
			const stale = await repo.delete(saved.entity.id, saved.version);
			expect(stale.ok).toBe(false);
			expect(expectOk(await repo.getById(second.entity.id))).not.toBeNull();
		});
	});
}
```

- [ ] **Step 3: Run the contract against nothing and watch it fail**

Create `tests/infrastructure/persistence/inMemoryAssetPriceOverride.test.ts`:

```ts
import { InMemoryAssetPriceOverrideRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryAssetPriceOverrideRepository';
import { assetPriceOverrideContract } from './assetPriceOverrideRepository.contract';

assetPriceOverrideContract('in-memory', () => new InMemoryAssetPriceOverrideRepository());
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
import type { AssetPriceOverrideRepository } from '../../../application/ports/AssetPriceOverrideRepository';
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

	getById(id: AssetPriceOverrideId): Promise<Result<Loaded<AssetPriceOverride> | null, PersistenceError>> {
		return Promise.resolve(ok(this.store.get(id)));
	}

	getForPair(
		projectId: ProjectId,
		assetId: AssetId,
	): Promise<Result<Loaded<AssetPriceOverride> | null, PersistenceError>> {
		const found = this.store
			.values()
			.find((o) => o.entity.projectId === projectId && o.entity.assetId === assetId);
		return Promise.resolve(ok(found ?? null));
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
        tests/infrastructure/persistence/assetPriceOverrideRepository.contract.ts \
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
- Modify: `src/application/ports/diagnostics.ts` (`DiagnosticEntityKind`)
- Modify: `src/infrastructure/persistence/migration/migrationSet.ts`
- Modify: `src/infrastructure/obsidian/repositories/paths.ts`
- Test: `tests/infrastructure/persistence/assetPriceMapper.test.ts`
- Test: `tests/infrastructure/obsidian/obsidianAssetPriceOverride.test.ts`

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
import { currencyOf, of as moneyOf } from '../../../src/core/money/Money';
import { expectOk } from '../../helpers/result';

const GBP = currencyOf('GBP');

function override(amount = '19.50') {
	return expectOk(
		AssetPriceOverride.create(
			{
				id: createAssetPriceOverrideId(),
				projectId: createProjectId(),
				assetId: createAssetId(),
				unitCost: moneyOf(amount, 'GBP'),
			},
			GBP,
		),
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

		const read = expectOk(assetPriceFromPersistence(dto, GBP));
		expect(read.id).toBe(entity.id);
		expect(read.projectId).toBe(entity.projectId);
		expect(read.assetId).toBe(entity.assetId);
		expect(read.unitCost.amount).toBe('19.50');
	});

	/** A YAML float is exactly what ADR-010 refuses; three decimals is what catches one. */
	it('preserves a three-decimal amount through both directions', () => {
		const dto = assetPriceToPersistence(override('594.005'), 1);
		expect(dto['unit-cost']).toBe('594.005');
		expect(expectOk(assetPriceFromPersistence(dto, GBP)).unitCost.amount).toBe('594.005');
	});

	it('refuses a note whose amount is a YAML float rather than a string', () => {
		const dto = { ...assetPriceToPersistence(override(), 1), 'unit-cost': 19.5 };
		expect(assetPriceFromPersistence(dto, GBP).ok).toBe(false);
	});

	it('refuses a note whose currency is not ISO-4217 shaped', () => {
		const dto = { ...assetPriceToPersistence(override(), 1), currency: 'pounds' };
		expect(assetPriceFromPersistence(dto, GBP).ok).toBe(false);
	});

	/**
	 * The entity's coherence rule reaches the READ path too, because a user can hand-edit the
	 * note. This is the residual the spec records: such an override is refused at the read
	 * rather than silently feeding the pipeline a figure it will reject later.
	 */
	it('refuses a hand-edited note whose currency is not the project currency', () => {
		const dto = assetPriceToPersistence(override(), 1);
		const result = assetPriceFromPersistence(dto, currencyOf('EUR'));
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('unreachable');
		expect(result.error.code).toBe('asset-price.currency-mismatch');
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
import { createMoney, type Currency } from '../../../core/money/Money';
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
 * Takes the project's currency because the entity's smart constructor does — the coherence
 * rule has to reach the READ path, since the notes are user-editable and a hand edit can part
 * an override from the project it prices for. Refusing here is the narrow, honest answer: the
 * note is skipped with a diagnostic rather than feeding the pipeline a figure it would reject
 * later with a message about a mismatch the user cannot see the origin of.
 */
export function assetPriceFromPersistence(
	rawFrontmatter: unknown,
	projectCurrency: Currency,
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

	const created = AssetPriceOverride.create(
		{
			id: dto.id as AssetPriceOverrideId,
			projectId: dto.project as ProjectId,
			assetId: dto.asset as AssetId,
			unitCost: unitCost.value,
		},
		projectCurrency,
	);
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
import type { Currency } from '../../../core/money/Money';
import type { AssetPriceOverrideRepository } from '../../../application/ports/AssetPriceOverrideRepository';
import type { EntityVersion, Expected, Loaded } from '../../../application/ports/versioning';
import type { Logger } from '../../../application/ports/Logger';
import type { ProjectRepository } from '../../../application/ports/ProjectRepository';
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
 * The note-backed half of the conditional-write contract, without a sidecar.
 *
 * **The read needs the project's currency**, because the mapper's coherence rule does — so
 * this repository holds a `ProjectRepository`. That is a real dependency and it is stated
 * rather than hidden: an override note names its project, the project names its currency, and
 * a note that has drifted from it is refused rather than fed to the pipeline.
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
		private readonly projects: ProjectRepository,
		private readonly logger: Logger,
	) {}

	async getById(
		id: AssetPriceOverrideId,
	): Promise<Result<Loaded<AssetPriceOverride> | null, RepositoryError>> {
		return this.readOne(id);
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
		return ok(matches[matches.length - 1] ?? null);
	}

	listByProject(projectId: ProjectId): Promise<Result<Loaded<AssetPriceOverride>[], RepositoryError>> {
		return this.filterLoaded((o) => o.projectId === projectId);
	}

	listByAsset(assetId: AssetId): Promise<Result<Loaded<AssetPriceOverride>[], RepositoryError>> {
		return this.filterLoaded((o) => o.assetId === assetId);
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
		const currency = override.unitCost.currency;
		const spec: NoteWriteSpec<AssetPriceOverride> = {
			kind: 'asset-price',
			indexType: 'renovation-asset-price',
			notesFolder: folder === undefined ? undefined : assetPricesFolderFor(folder),
			projectId: (entity) => entity.projectId,
			entryName: assetPriceFileName,
			toPersistence: assetPriceToPersistence,
			// The entity we are writing is coherent by construction, so its own currency is
			// the right thing to re-validate against here: this checks the DTO round-trips,
			// not that the project still agrees, which the read is what asks.
			preWriteValid: (dto) => assetPriceFromPersistence({ ...dto }, currency).ok,
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

	private async readOne(
		id: AssetPriceOverrideId,
	): Promise<Result<Loaded<AssetPriceOverride> | null, RepositoryError>> {
		// The project's currency is needed BEFORE the note can be mapped, and the note is what
		// names the project — so the id-keyed read resolves it from the index entry's own
		// project, which `buildProjectIndexEntries` records from the note's `project` key.
		const projectId = this.deps.index
			.entries()
			.find((entry) => entry.id === id)?.projectId;
		if (projectId === undefined) return ok(null);
		const currency = await this.projectCurrency(projectId);
		if (isErr(currency)) return currency;
		if (currency.value === null) return ok(null);
		return readNoteBackedEntity(
			this.deps,
			'asset-price',
			id,
			(raw: unknown) => assetPriceFromPersistence(raw, currency.value as Currency),
			'asset-price.entity-invalid',
		);
	}

	private async projectCurrency(projectId: ProjectId): Promise<Result<Currency | null, RepositoryError>> {
		const project = await this.projects.getById(projectId);
		if (isErr(project)) return project;
		return ok(project.value?.entity.currency ?? null);
	}

	private async filterLoaded(
		predicate: (o: AssetPriceOverride) => boolean,
	): Promise<Result<Loaded<AssetPriceOverride>[], RepositoryError>> {
		const ids = this.deps.index.getIdsByType('renovation-asset-price') as AssetPriceOverrideId[];
		const loaded: Loaded<AssetPriceOverride>[] = [];
		for (const id of ids) {
			const found = await this.readOne(id);
			if (isErr(found)) return found;
			if (found.value !== null && predicate(found.value.entity)) loaded.push(found.value);
		}
		return ok(loaded);
	}
}
```

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
import { assetPriceOverrideContract, makeOverride } from '../persistence/assetPriceOverrideRepository.contract';
// … plus the stack helpers this repository's siblings use.

assetPriceOverrideContract('obsidian', async () => {
	// Construct the stack, seed a project whose currency is GBP, and return the repository.
	// The project MUST exist and be GBP, because the read resolves its currency.
});

describe('ObsidianAssetPriceOverrideRepository', () => {
	/**
	 * The duplicate-pair rule, which only the note-backed repository can exercise: two notes,
	 * one pair. Asserting the warning ALONE would pass against a build that then refuses, so
	 * this asserts BOTH — a price still comes back.
	 */
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
git add src/infrastructure src/application/ports/ProjectIndex.ts \
        src/application/ports/diagnostics.ts tests/infrastructure
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
- Create: `src/application/commands/asset-price/SetAssetPriceOverride.ts`
- Create: `src/application/commands/asset-price/ClearAssetPriceOverride.ts`
- Test: `tests/application/commands/asset-price/setAssetPriceOverride.test.ts`
- Test: `tests/application/commands/asset-price/clearAssetPriceOverride.test.ts`

**Interfaces:**
- Consumes: Tasks 1–3; `ProjectRepository`, `AssetRepository`, `EventBus`, `Command`.
- Produces:
  - `class SetAssetPriceOverrideCommand implements Command<SetAssetPriceOverrideInput, Result<SetAssetPriceOverrideResult, SetAssetPriceOverrideErrors>>`
    with `SetAssetPriceOverrideInput = { projectId: ProjectId; assetId: AssetId; unitCost: Money }`
    and `SetAssetPriceOverrideResult = { override: AssetPriceOverride; created: boolean; version: EntityVersion }`.
  - `class ClearAssetPriceOverrideCommand` with `ClearAssetPriceOverrideInput = { projectId: ProjectId; assetId: AssetId }`
    and a `{ cleared: boolean }` result.
  - `AssetPriceOverrideChanged` is published by BOTH — see Task 7, which subscribes to it.

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
import { expectOk } from '../../../helpers/result';
// Build deps from the in-memory repositories and a recording bus, following the
// sibling command tests under tests/application/commands/requirement/.

describe('SetAssetPriceOverrideCommand', () => {
	it('creates an override for a pair that has none, and reports created', async () => {
		// seed: a GBP project, an EUR-priced asset
		const result = expectOk(await command.execute({ projectId, assetId, unitCost: moneyOf('19.50', 'GBP') }));
		expect(result.created).toBe(true);
		expect(result.override.unitCost.amount).toBe('19.50');
	});

	it('replaces the existing override for a pair that has one, and reports created false', async () => {
		expectOk(await command.execute({ projectId, assetId, unitCost: moneyOf('19.50', 'GBP') }));
		const second = expectOk(await command.execute({ projectId, assetId, unitCost: moneyOf('21.00', 'GBP') }));
		expect(second.created).toBe(false);
		expect(second.override.unitCost.amount).toBe('21.00');
		const listed = expectOk(await overrides.listByProject(projectId));
		expect(listed).toHaveLength(1);
	});

	/** The entity's rule, reached through the command — the user's actual door to it. */
	it('refuses a price that is not in the project currency', async () => {
		const result = await command.execute({ projectId, assetId, unitCost: moneyOf('19.50', 'EUR') });
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('unreachable');
		expect(result.error.code).toBe('asset-price.currency-mismatch');
	});

	it('refuses when the project is not there', async () => {
		const result = await command.execute({ projectId: createProjectId(), assetId, unitCost: moneyOf('1.00', 'GBP') });
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('unreachable');
		expect(result.error.code).toBe('asset-price.project-not-found');
	});

	it('refuses when the asset is not there', async () => {
		const result = await command.execute({ projectId, assetId: createAssetId(), unitCost: moneyOf('1.00', 'GBP') });
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('unreachable');
		expect(result.error.code).toBe('asset-price.asset-not-found');
	});

	it('publishes AssetPriceOverrideChanged carrying BOTH ids', async () => {
		expectOk(await command.execute({ projectId, assetId, unitCost: moneyOf('19.50', 'GBP') }));
		expect(bus.published).toContainEqual(
			expect.objectContaining({
				type: 'AssetPriceOverrideChanged',
				payload: { projectId, assetId },
			}),
		);
	});

	/**
	 * A failed WRITE must not announce. Otherwise the cascade recalculates against a price
	 * that was never persisted, and every requirement it touches is derived from a figure no
	 * note holds.
	 */
	it('publishes nothing when the save fails', async () => {
		vi.spyOn(overrides, 'save').mockResolvedValue(err(persistenceError('asset-price.write-failed', 'no')));
		const result = await command.execute({ projectId, assetId, unitCost: moneyOf('19.50', 'GBP') });
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
import { assetPriceOverrideChanged } from '../../../domain/asset-price/AssetPriceOverride.events';
import type { AssetPriceOverrideRepository } from '../../ports/AssetPriceOverrideRepository';
import type { ProjectRepository } from '../../ports/ProjectRepository';
import type { AssetRepository } from '../../ports/AssetRepository';
import { referenceError } from '../../errors';
import type { Command } from '../Command';
import type { EntityVersion } from '../../ports/versioning';

export interface SetAssetPriceOverrideInput {
	readonly projectId: ProjectId;
	readonly assetId: AssetId;
	readonly unitCost: Money;
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
 */
export class SetAssetPriceOverrideCommand
	implements Command<SetAssetPriceOverrideInput, Result<SetAssetPriceOverrideResult, SetAssetPriceOverrideErrors>>
{
	constructor(private readonly deps: SetAssetPriceOverrideDeps) {}

	async execute(
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

		const currency = project.value.entity.currency;
		const existing = await this.deps.overrides.getForPair(input.projectId, input.assetId);
		if (isErr(existing)) return existing;

		const next = existing.value === null
			? AssetPriceOverride.create(
				{
					id: createAssetPriceOverrideId(),
					projectId: input.projectId,
					assetId: input.assetId,
					unitCost: input.unitCost,
				},
				currency,
			)
			: existing.value.entity.withUnitCost(input.unitCost, currency);
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
 */
export class ClearAssetPriceOverrideCommand … {
	async execute(input: ClearAssetPriceOverrideInput): Promise<Result<{ cleared: boolean }, …>> {
		const existing = await this.deps.overrides.getForPair(input.projectId, input.assetId);
		if (isErr(existing)) return existing;
		if (existing.value === null) return ok({ cleared: false });

		const deleted = await this.deps.overrides.delete(existing.value.entity.id, existing.value.version);
		if (isErr(deleted)) return deleted;

		await this.deps.events.publish(
			assetPriceOverrideChanged({ projectId: input.projectId, assetId: input.assetId }),
		);
		return ok({ cleared: true });
	}
}
```

- [ ] **Step 6: Run and watch them pass**

Run: `npx vitest run tests/application/commands/asset-price/`
Expected: PASS.

- [ ] **Step 7: Full gate, then commit**

Run: `npm run check`

```bash
git add src/domain/asset-price/AssetPriceOverride.events.ts \
        src/application/commands/asset-price tests/application/commands/asset-price
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
- Test: `tests/application/commands/requirement/effectiveUnitCost.test.ts`
- Test: `tests/application/commands/requirement/overrideSatisfiesRefusal.test.ts` (**the witness**)

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
import { expectOk } from '../../../helpers/result';

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

		expectOk(await setOverride.execute({ projectId, assetId, unitCost: moneyOf('19.50', 'GBP') }));

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
		const refused = await setOverride.execute({ projectId, assetId, unitCost: moneyOf('24.00', 'EUR') });
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

- [ ] **Step 8: Full gate, then commit**

Run: `npm run check`

```bash
git add src/application/commands tests/application/commands
git commit -m "feat(cost): a project's own price reaches the pipeline, and the refusal is passable

The witness the Issue asks for: an assign refuses on a currency mismatch, a
price override in the project's currency is set, the same assign succeeds
with the estimate denominated in the project's currency. Application-level,
so it proves the mechanism rather than the affordance.

One shared resolveEffectiveUnitCost rather than the lookup spelled out at
each of the two callers slice 10 routed through one derivation. The
derivation itself stays pure and holds no repository.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01G1z4YErxsacXRBUXoH94T8"
```

---

### Task 6: the effective-cost correction

**Files:**
- Modify: `src/application/event-handlers/requirement/onAssetUpdated.ts`
- Modify: `src/application/queries/GetRequirementsForZone.ts`
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

**`assetMatchesCalculatedFrom` itself does not change.** The correction is to its INPUT. Its two
callers stay two questions, which Amendment 1 item 6 split deliberately.

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
		const byProject = new Map(overrides.value.map((o) => [o.entity.projectId, o.entity.unitCost]));

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
git add src/application tests/application
git commit -m "fix(cascade): compare against the cost a requirement was actually derived from

Under a price override calculatedFrom.unitCost holds the effective cost, so
comparing it against the catalogue default false-mismatches every overridden
requirement forever — the cascade never skips and the read model reads stale.

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
- Test: `tests/application/events/assetPriceOverrideCascade.test.ts`

**Interfaces:**
- Consumes: Task 4's `AssetPriceOverrideChanged`, the existing `CascadeDeps` and
  `runRecalculationCascade` from `event-handlers/requirement/cascade.ts`.
- Produces: `registerOnAssetPriceOverrideChanged(events: EventBus, deps: CascadeDeps): Disposable`.

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
git add src/application/event-handlers tests/application/events
git commit -m "feat(cascade): a price override invalidates one project, not every project

The narrowing is the whole difference from onAssetUpdated, and it takes two
projects in the fixture to be visible: a single-project fixture passes
against a cascade that ignores it entirely.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01G1z4YErxsacXRBUXoH94T8"
```

---

### Task 8: the read model, and the composition root

**Files:**
- Create: `src/application/queries/ListProjectAssetPrices.ts`
- Modify: `src/application/queries/GetRequirementsForZone.ts` (the DTO's `unitCost` group)
- Modify: `src/plugin/composition-root.ts`, `src/plugin/guardedServices.ts`
- Test: `tests/application/queries/listProjectAssetPrices.test.ts`
- Test: `tests/plugin/assetPriceWiring.test.ts`

**Interfaces:**
- Produces:
  - `interface AssetPriceRowDto { assetId: string; assetName: string; catalogue: Money; override: Money | null; overrideId: string | null; overrideVersion: EntityVersion | null; }`
  - `class ListProjectAssetPrices` with `execute(projectId): Promise<Result<AssetPriceRowDto[], RepositoryError>>`
  - `RequirementInspectorDTO.unitCost: { catalogue: Money; projectOverride: Money | null; effective: Money }`

- [ ] **Step 1: Write the failing query tests**

```ts
describe('ListProjectAssetPrices', () => {
	it('returns one row per catalogue asset, with a null override where the project has none', async () => { … });

	it('carries the override id and revision so a row can be cleared without a second read', async () => {
		// Clearing is a CONDITIONAL write. A row that cannot supply an Expected forces the view
		// to re-read before every save, which is check-then-act with extra steps.
		const row = rows.find((r) => r.assetId === assetId);
		expect(row?.overrideId).not.toBeNull();
		expect(row?.overrideVersion).not.toBeNull();
	});

	it('is sorted by asset name, so the list does not reshuffle between reads', async () => { … });

	it('returns an empty list for a vault whose library is empty', async () => { … });

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
	) {}

	async execute(projectId: ProjectId): Promise<Result<AssetPriceRowDto[], RepositoryError>> {
		const assets = await this.assets.listAll();
		if (isErr(assets)) return assets;
		const overrides = await this.overrides.listByProject(projectId);
		if (isErr(overrides)) return overrides;

		const byAsset = new Map(overrides.value.map((o) => [o.entity.assetId, o]));
		const rows = assets.value.map((loaded) => {
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
		// Sorted so the list does not reshuffle between reads — `listAll` is index order, which
		// is a fact about the vault's write history rather than anything a reader expects.
		rows.sort((a, b) => a.assetName.localeCompare(b.assetName));
		return ok(rows);
	}
}
```

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
		catalogue: Money;
		projectOverride: Money | null;
		effective: Money;
	};
```

Populate it in `buildRow` from the values Task 6 already resolved there. `catalogue` is
`assetEntity.unitCost`; when the asset is gone the whole group is unavailable, so make it
`unitCost: … | null` and set `null` for a row whose `missingTarget` is `'asset'` — do not invent
a zero.

- [ ] **Step 4: Compose and guard**

In `src/plugin/composition-root.ts`, construct the repository beside its siblings and the two
commands and the query beside theirs. In `src/plugin/guardedServices.ts`, wrap both commands and
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
	// Compose a real root, set a price, and assert the requirement in THAT project is stale
	// while one in another project on the same asset is not.
});

it('registers the cascade subscriber, not merely the commands', async () => {
	// Watched red with `registerOnAssetPriceOverrideChanged(...)` deleted from the root:
	// the commands still work and nothing else notices.
});
```

- [ ] **Step 6: Full gate, then commit**

Run: `npm run check`

```bash
git add src/application/queries src/plugin tests
git commit -m "feat(query): what this project pays, and the Inspector's third figure

One query joining the catalogue with the project's overrides, carrying each
override's id and revision because clearing one is a conditional write. The
requirement DTO gains a unitCost group beside quantity and cost — the INPUT
level beside the OUTPUT level, which is §89 at both.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01G1z4YErxsacXRBUXoH94T8"
```

---

### Task 9: the section a user reaches

**Files:**
- Create: `src/presentation/views/AssetPriceList.vue`
- Modify: `src/presentation/views/ProjectDetail.vue`, `src/presentation/views/ProjectDetailState.vue`
- Modify: `src/presentation/stores/ProjectDetailStore.ts`
- Modify: `src/presentation/i18n/en.ts`, `src/presentation/i18n/de.ts`
- Modify: `styles/` (a partial, registered in `styles/index.css`)
- Test: `tests/presentation/views/assetPriceList.test.ts`
- Test: extend `tests/harness/accessibility.test.ts`

**Interfaces:**
- Consumes: Task 8's `AssetPriceRowDto` and `ListProjectAssetPrices`, Task 4's two commands.
- Produces: `AssetPriceList.vue` with `defineProps<{ rows: readonly AssetPriceRowDto[]; commit: (edit: AssetPriceEdit) => Promise<DispatchResult>; logger: Logger }>()`.

**Read `PlanList.vue` and `RequirementRow.vue` first.** This is `PlanList`'s sibling in shape
(a header, then a `<ul>`) and `RequirementRow`'s in commit behaviour (`useFieldCommit`, blur and
enter, a rejected commit KEEPS the typed value).

- [ ] **Step 1: Add the copy to both locales**

In `en.ts`:

```ts
	'view.project.prices-title': 'Asset prices',
	'view.project.price-catalogue': 'Library price',
	'view.project.price-yours': 'This project',
	'view.project.price-set': 'Set a price',
	'view.project.price-clear': 'Use the library price',
	'view.project.no-assets': 'The library has no assets yet',
```

In `de.ts`, the same keys. **An Asset is `Objekt`, never `Material`** —
`tests/presentation/i18n/strings.test.ts` refuses that value, and slice 14 reintroduced it forty
lines below the comment recording its removal. Keep every interpolation hole that `en.ts` has:
the per-key hole check is what catches a mis-holed translation.

- [ ] **Step 2: Write the failing component test**

```ts
describe('AssetPriceList', () => {
	it('renders one row per asset, with the library price and a dash where there is no override', () => { … });

	it('dispatches a set for a typed price on blur', async () => { … });

	/** Slice 16's rule: a rejected commit KEEPS the user's value and shows the error. */
	it('keeps the typed value and shows an inline error when the command refuses', async () => {
		commit.mockResolvedValue(err({ category: 'Validation', code: 'asset-price.currency-mismatch', message: '' }));
		// … expect the input still to hold what was typed, and a .rp-field-error to be present.
	});

	/**
	 * The guard `RequirementRow` had to learn the hard way: pressing clear on a row with no
	 * override must dispatch NOTHING. A command for a no-op is a write, a revision bump and a
	 * cascade standing for a change nobody made.
	 */
	it('dispatches nothing when clear is pressed on a row that has no override', async () => {
		expect(commit).not.toHaveBeenCalled();
	});

	it('renders the empty state when the library is empty', () => { … });
});
```

- [ ] **Step 3: Write the component**

Mirror `PlanList.vue`'s structure: an `<h3>` header (the project's name above is the `<h2>`;
heading order is one of the five things the axe case grades), then a `<ul>` of rows. Each row
shows the asset name, the library price, and an input bound through `useFieldCommit` with a
clear button. No literal copy — every string through `tr(...)`.

**The project-wide warning belongs here.** A price set on this row moves every requirement in
the project on that asset; the section's own heading and its placement on a project surface are
what make that honest, which is exactly why this is not a control on the Inspector's row.

- [ ] **Step 4: Mount it, and hydrate it**

Add the section to `ProjectDetail.vue` below the plans region, and give `ProjectDetailStore` the
rows plus a request ticket — the store already hydrates from more than one caller, and without a
ticket the slower earlier read wins and a just-set price vanishes with no error.

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
git add src/presentation styles tests
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
  affordance deferral **withdrawn**, the port's fifth method, the entity's coherence rule, the
  note's id-derived filename (so the illustrative `Asset Prices/Porcelain Terrace Tile.md` is
  **not** what ships), and every Amendment 1 item 7 criterion ticked or amended by name.
- [ ] **`docs/issues/The cost pipeline is told the currency it must produce.md`** — **close it**,
  and only now: its own instruction is *"Until that pair is green, the answer above is a
  decision without an end-to-end witness."* The pair is Task 5's witness; the affordance is
  Task 9's.
- [ ] **`docs/requirements/Asset library.md`** — its open definition-of-done item, *"A project
  can record its own price against a shared definition"*, is met.
- [ ] **`CLAUDE.md`** — the increment's own paragraph, and the three residuals the spec records:
  setting a price is not undoable, a project's currency can move under existing overrides, and a
  hand-edited note can disagree with it.

---

## Self-review

Run against the spec, section by section.

**Spec coverage.** Decision 1 → Task 9. Decision 2 → Task 1. Decision 3 → Task 2. Decision 4 →
Task 5. Decision 5 → Task 6. Decision 6 → Task 8. Decision 7 → Task 3. Persistence → Task 3.
Testing → the witness is Task 5 step 1; the precedence, the false-mismatch arms, the unit arm,
the narrowed cascade, the duplicate-pair diagnostic and the create refusal are Tasks 1, 3, 6, 7.
Residuals → the documents section above.

**One gap found and closed while reviewing:** the spec names the commands nowhere — it says
"the affordance" and "the create path" without giving them names — and the witness cannot be
written without them. They are Task 4, and their two design decisions (upsert on the pair; a
no-op clear announces nothing) are stated there rather than left to be invented.

**A second, left open deliberately:** the spec's precedence case — *"a Requirement with both
overrides live, asserting the requirement override is in force and that changing the price
override moves `calculated` and not the effective figure"* — has no task of its own. It belongs
in Task 6's suite, where both halves already exist. Add it there rather than making a tenth task
for one case.

**Type consistency.** `resolveEffectiveUnitCost` (async, repository) and `effectiveUnitCostFrom`
(pure, map) are two names for two shapes and are used as such in Tasks 5 and 6.
`AssetPriceOverrideChanged` carries `{ projectId, assetId }` in Tasks 4, 7 and 8.
`getForPair(projectId, assetId)` keeps that argument order everywhere.

**Placeholder scan.** The task bodies that are deliberately partial are Task 3 step 8, Task 8
step 5 and Task 9's tests — each because the fixture stack they need is an existing helper the
implementer must read rather than one this plan should invent a second version of. Each says
which file to read. No step says "add appropriate error handling" or "write tests for the above".
