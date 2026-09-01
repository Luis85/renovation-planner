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
import { expectOk } from '../../helpers/result';

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
		const best = winningDuplicate(bucket);
		if (best !== null) winners.set(key, best);
	}
	return winners;
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
			const edited = expectOk(saved.entity.withUnitCost(moneyOf('21.00', 'GBP')));
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

		/**
		 * The duplicate-pair rule, in the SHARED contract because it is the one place both
		 * implementations can be held to the same answer. Two notes, deterministic winner: the
		 * higher id, which `createEntityId`'s monotonic ULID makes the more recently created.
		 * Without this case the two repositories drifted — the fake answering the oldest match
		 * and the note-backed one the newest — and every duplicate test would have been evidence
		 * about a different program than the one that ships.
		 */
		it('answers the highest-id override when two notes name one pair', async () => {
			const repo = await makeRepo();
			const projectId = createProjectId();
			const assetId = createAssetId();
			const first = makeOverride(projectId, assetId, '19.50');
			const second = makeOverride(projectId, assetId, '21.00');
			// Save in BOTH orders across the two expectations below, so a repository that
			// happens to enumerate in save order cannot pass by accident.
			expectOk(await repo.save(second, 'absent'));
			expectOk(await repo.save(first, 'absent'));

			const winner = second.id > first.id ? second : first;
			const found = expectOk(await repo.getForPair(projectId, assetId));
			expect(found?.entity.id).toBe(winner.id);
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
			const edited = expectOk(saved.entity.withUnitCost(moneyOf('21.00', 'GBP')));
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

	getById(id: AssetPriceOverrideId): Promise<Result<Loaded<AssetPriceOverride> | null, PersistenceError>> {
		return Promise.resolve(ok(this.store.get(id)));
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
 * already refuses. The pipeline is what stops a wrong-currency figure being computed, and the
 * section's marker is what tells the user why their price is not being used.
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

	getById(id: AssetPriceOverrideId): Promise<Result<Loaded<AssetPriceOverride> | null, RepositoryError>> {
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

	private async filterLoaded(
		predicate: (o: AssetPriceOverride) => boolean,
	): Promise<Result<Loaded<AssetPriceOverride>[], RepositoryError>> {
		const ids = this.deps.index.getIdsByType('renovation-asset-price') as AssetPriceOverrideId[];
		const loaded: Loaded<AssetPriceOverride>[] = [];
		for (const id of ids) {
			const found = await this.getById(id);
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

	/**
	 * The coherence rule, which is this command's rather than the entity's (spec Decision 2).
	 * Watch it fail with the check deleted: the entity accepts any currency by design, so
	 * nothing else in the suite refuses this.
	 */
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
	 * The pair lock, driven as a real race: two executions started before either awaits. Both
	 * read `getForPair === null` without it, mint different ULIDs, and both inserts succeed
	 * under `'absent'` — the duplicate-pair state this design tolerates in a hand-edited vault
	 * and must never manufacture. Watch it fail with the `locks.acquire` removed.
	 */
	it('does not create two overrides when two executions race on one pair', async () => {
		const [a, b] = await Promise.all([
			command.execute({ projectId, assetId, unitCost: moneyOf('19.50', 'GBP') }),
			command.execute({ projectId, assetId, unitCost: moneyOf('21.00', 'GBP') }),
		]);
		expectOk(a);
		expectOk(b);
		expect(expectOk(await overrides.listByAsset(assetId))).toHaveLength(1);
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
		await overrides.save(makeOverride(projectId, assetId, '19.50'), 'absent');
		await overrides.save(makeOverride(projectId, assetId, '21.00'), 'absent');
		expect(expectOk(await command.execute({ projectId, assetId })).cleared).toBe(true);
		expect(expectOk(await overrides.listByAsset(assetId))).toHaveLength(0);
	});
```

And the one that only a partial failure reaches:

```ts
	/**
	 * A partial clear HAS written. The survivor is now the effective price, so a cascade that
	 * never hears about it leaves every requirement derived from the note that is gone. Asserting
	 * only the refusal passes against a build that stays silent.
	 */
	it('announces what it deleted even when a later delete fails', async () => {
		// Seed two notes for the pair, then fail the SECOND delete.
		const result = await command.execute({ projectId, assetId });
		expect(result.ok).toBe(false);
		expect(bus.published).toContainEqual(
			expect.objectContaining({ type: 'AssetPriceOverrideChanged', payload: { projectId, assetId } }),
		);
	});

	/** And the other side, so the rule is not "always announce": a FIRST delete that fails
	 *  has written nothing, so there is nothing to announce. */
	it('announces nothing when the first delete fails', async () => {
		const result = await command.execute({ projectId, assetId });
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

		const existing = await this.deps.overrides.getForPair(input.projectId, input.assetId);
		if (isErr(existing)) return existing;

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
			// `listByAsset` filtered rather than `getForPair`, because every note for the pair
			// has to go. One query: a shared asset is priced by few projects, where a project
			// may hold many assets.
			const listed = await this.deps.overrides.listByAsset(input.assetId);
			if (isErr(listed)) return listed;
			const forPair = listed.value.filter((o) => o.entity.projectId === input.projectId);
			if (forPair.length === 0) return ok({ cleared: false });

			// **Any write that landed is announced, even when a later one fails.** The rule this
			// file states elsewhere — a failed write must not announce — is about a command that
			// wrote NOTHING. A partial clear has written: deleting the highest-id note moves the
			// effective price to the survivor, so the cascade and every open pane are looking at
			// a figure derived from a note that is gone. Returning the failure without the event
			// leaves them there indefinitely, which is worse than the refusal itself.
			let removed = false;
			for (const override of forPair) {
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
git add src/application/commands src/plugin src/presentation/editor/planEditorCommands.ts tests
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
		const winners = winnersBy(overrides.value, (o) => o.entity.projectId);
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

		expectOk(await setOverride.execute({ projectId, assetId, unitCost: moneyOf('19.50', 'GBP') }));
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

### Task 7a: deleting an asset takes its price overrides with it

**Files:**
- Modify: `src/application/commands/asset/DeleteAsset.ts`
- Modify: `src/plugin/slice10Composition.ts` — **not** `composition-root.ts`. `DeleteAssetCommand`
  is constructed there (`:140`) and `sequenceNotices` is declared there (`:54`); the root only
  imports both. Bind the new `overrides` dep at the construction site, and add
  `priceCleanupFailed` to `sequenceNotices` beside `markerClearFailed`.
- Modify: `src/presentation/i18n/en.ts`, `src/presentation/i18n/de.ts` — the notice string,
  through `tr(...)` exactly as `sequence.marker-clear-failed` is. `NOTICE_TEXT_BAN` refuses a
  literal at `notifyWarning`, so this is a gate rather than a convention.
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
deletes with no referents observed, and the override's `asset` id dangles. Worse than a stale
field, because of Task 8's join: `ListProjectAssetPrices` builds its rows from `listAll`, so an
override whose asset is gone renders in **no** row — unreachable, unlistable and undeletable by
the user who made it.

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
		expectOk(await setOverride.execute({ projectId, assetId, unitCost: moneyOf('19.50', 'GBP') }));
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
	 * `ListProjectAssetPrices` joins on the catalogue, so it renders in no row — unreachable and
	 * undeletable by the user who made it. It goes with the asset rather than refusing its
	 * deletion, because there is no second outcome to offer.
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
	 */
	private async deleteOverridesOf(assetId: AssetId): Promise<void> {
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

- [ ] **Step 4: Run, then mutation-check**

Run the file — PASS. Then delete the `await this.deleteOverridesOf(...)` call: the first three
cases must redden. If only one does, your fixtures share a project or an asset and the other two
are not testing what their names say.

- [ ] **Step 5: Full gate, then commit**

Run: `npm run check`

```bash
git add src/application/commands/asset src/plugin src/presentation/i18n tests
git commit -m "fix(delete): an asset's price overrides go with the asset

DeleteAssetCommand gathered referents from requirements alone, so an asset
with an override and no requirement deleted with none observed — and the
orphan then rendered in no row, because the price list joins on the
catalogue. Unreachable, unlistable, undeletable.

They go with the asset rather than refusing its deletion: a price for a
deleted asset names nothing and there is no second outcome to offer.

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

		// `winnersBy`, never `new Map(list.map(...))`: that keeps whichever entry came last in
		// `listByProject` order, which is a different answer from the one `getForPair` gives.
		const byAsset = winnersBy(overrides.value, (o) => o.entity.assetId);
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
	expectOk(await root.setAssetPriceOverride.execute({ projectId: projectA, assetId, unitCost: moneyOf('19.50', 'GBP') }));

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

### Task 8a: the Inspector actually shows the three figures

**Files:**
- Modify: `src/presentation/editor/shell/RequirementRow.vue`
- Modify: `src/presentation/editor/tools/editor-context.ts` (or wherever `PlanEditorContext` is
  declared) and `src/plugin/composition-root.ts` — the price-change subscription, step 3a.
- Modify: `src/presentation/i18n/en.ts`, `src/presentation/i18n/de.ts`
- Modify: `styles/` (the row's own partial)
- Test: `tests/presentation/editor/requirementRow.test.ts` (extend)
- Test: `tests/presentation/editor/inspectorPriceRefresh.test.ts`

**Interfaces:**
- Consumes: Task 8's `RequirementInspectorDTO.unitCost: { catalogue, projectOverride, effective } | null`.
- Produces: no new exports.

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

	it('shows the library price alone when the project has no override', () => {
		// projectOverride: null → one figure, no comparison, no dangling label.
	});

	/** §85: never colour alone. The in-force marker is a word or a glyph plus the colour. */
	it('marks the figure in force with something a screen reader reads', () => { … });

	/** The asset is gone, so there is no catalogue price to compare against — Task 8 sets the
	 *  whole group to null rather than inventing a zero, and the row must not render an empty
	 *  comparison for it. */
	it('renders no unit-cost block when the asset is missing', () => { … });
});
```

- [ ] **Step 2: Run and watch it fail at the assertion**

Run: `npx vitest run tests/presentation/editor/requirementRow.test.ts`
Expected: FAIL because nothing renders the figures — not because the fixture lacks the field.
Add the field to the fixture FIRST, or the red proves only that the test data is stale.

- [ ] **Step 3: Add the copy to both locales**

`view.inspector.price-library`, `view.inspector.price-project`, `view.inspector.price-in-force`.
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

Bind `createProjectPricesChangeSource` (Task 9 step 4a — write it in whichever task runs first
and consume it in the other) into `PlanEditorContext`, and rehydrate the Inspector's rows on it,
through the store's existing request ticket.

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
- Create: `src/application/events/projectPricesChangeSource.ts` (step 4a)
- Modify: `src/presentation/views/ProjectDetail.vue`, `src/presentation/views/ProjectDetailState.vue`
- Modify: `src/presentation/views/renovationProjectCommands.ts` — the write boundary this
  section dispatches through, plus its unavailable fallback (step 3a).
- Modify: `src/presentation/stores/ProjectDetailStore.ts`
- Modify: `src/presentation/views/RenovationProjectContext.ts` — the two change sources reach the
  view through its context, the same seam `onPlanChanged` already uses; `presentation/` may not
  reach the event bus itself.
- Modify: `src/plugin/composition-root.ts` — bind both sources, as it already binds
  `onCatalogueChanged` for the editor.
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

Both hand rehydration to the SAME request ticket from Step 4 — two sources firing together is
exactly the concurrent-hydrate race that ticket exists for.

Test it as behaviour rather than as wiring:

```ts
	it('rehydrates the price rows when a price note changes out of band', async () => {
		// mount, then publish ProjectIndexEntryChanged for a renovation-asset-price entry
		// and assert the row's override moved. Watch it fail with the subscription removed.
	});

	it('rehydrates when the catalogue changes', async () => { … });
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
- [ ] **`CLAUDE.md`** — the increment's own paragraph, and the three residuals the spec records:
  setting a price is not undoable, a project's currency can move under existing overrides, and a
  hand-edited note can disagree with it.

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
