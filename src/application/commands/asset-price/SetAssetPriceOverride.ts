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
// `sameMoney` is a VALUE import beside the `import type { Money }` above, and that split is
// legal here — measured, not assumed. `.oxlintrc.json:117` sets `import/no-duplicates` to
// error, and **27 files in `src/` already import one module twice as a type-only and a value
// statement**, `requirementMapper.ts` doing it with this very module. The rule as configured
// does not treat that pair as a duplicate; what it DOES refuse is two VALUE imports of one
// module.
import { sameMoney } from '../../../core/money/Money';

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
		// `sameMoney` (`core/money/Money.ts`) is the value comparison, and it is safe HERE only
		// because it tests currency BEFORE it asks `compare`, which returns a `Result` and
		// REFUSES a mismatch — the state this whole increment is about. The coherence rule
		// above has already refused a foreign currency, so `sameMoney`'s own currency test is
		// belt-and-braces here; it stays, because this predicate must stay correct if that rule
		// ever moves.
		const unchanged = existing.value !== null && sameMoney(existing.value.entity.unitCost, input.unitCost);
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
