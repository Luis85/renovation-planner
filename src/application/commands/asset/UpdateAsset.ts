import type { Decimal } from 'decimal.js';
import { err, isErr, ok, type Result } from '../../../core/result/Result';
import type {
	DomainError,
	ReferenceError,
} from '../../../core/errors/AppError';
import type { RepositoryError } from '../../ports/repositoryErrors';
import type { EventBus } from '../../../core/events/EventBus';
import { UNIT_KIND, type MeasurementUnit } from '../../../core/units/MeasurementUnit';
import type { Money } from '../../../core/money/Money';
import type { AssetCategory } from '../../../domain/asset/AssetCategory';
import type { Asset } from '../../../domain/asset/Asset';
import type { AssetId } from '../../../domain/asset/AssetId';
import { assetUpdated } from '../../../domain/asset/Asset.events';
import { assetNotFound } from '../../../domain/asset/Asset.errors';
import type { Expected } from '../../ports/versioning';
import type { Command } from '../Command';
import type { AssetRepository } from '../../ports/AssetRepository';
import type { RequirementRepository } from '../../ports/RequirementRepository';
import type { ReferenceLocks } from '../../reference/ReferenceLocks';

export interface UpdateAssetInput {
	readonly assetId: AssetId;
	/** Omitted: this command's own read supplies it. A caller with an OLDER read is stale by construction. */
	readonly changes: Partial<{
		name: string;
		category: AssetCategory;
		supplier: string | null;
		sku: string | null;
		unit: MeasurementUnit;
		unitCost: Money;
		wasteFactorDefault: Decimal;
		notes: string | null;
	}>;
}

export type UpdateAssetErrors = DomainError | ReferenceError | RepositoryError;

/**
 * Edits a catalog item and publishes `AssetUpdated` on EVERY successful save — including
 * edits that cannot change a cost (a name or notes change). Deciding at the publisher
 * whether an edit matters would put field knowledge in a second place, and it would go
 * wrong silently the first time the pipeline started reading one more field.
 *
 * ONE edit is refused rather than cascaded: a unit change that crosses `UNIT_KIND` while
 * any Requirement still references the asset. Assignment rejects non-area assets outright,
 * so an `m2 → m` edit on a referenced asset would manufacture BY UPDATE exactly the link
 * the assignment path refuses to create — and no recalculation can rescue it, because a
 * zone's area is not a length. Changes WITHIN a kind stay allowed and cascade normally,
 * as does any unit change on an unreferenced asset.
 *
 * The lock is held from before `listByAsset` through the save — not just around the check.
 * Otherwise this is a check-and-write with a gap in it: an update observing zero referents
 * can be overtaken by an assignment creating one, landing a non-area unit under a live
 * requirement. A guard that only usually holds is not an invariant.
 */
export class UpdateAssetCommand implements Command<UpdateAssetInput, Result<Asset, UpdateAssetErrors>> {
	constructor(
		private readonly assets: AssetRepository,
		private readonly requirements: RequirementRepository,
		private readonly events: EventBus,
		private readonly locks: ReferenceLocks,
	) {}

	async execute(input: UpdateAssetInput): Promise<Result<Asset, UpdateAssetErrors>> {
		const loaded = await this.assets.getById(input.assetId);
		if (isErr(loaded)) return loaded;
		if (loaded.value === null) return err(assetNotFound(input.assetId));
		const current: Asset = loaded.value.entity;
		const nextUnit = input.changes.unit ?? current.unit;
		const kindChanges = UNIT_KIND[nextUnit] !== UNIT_KIND[current.unit];

		const release = await this.locks.acquire(kindChanges ? [current.id] : [], []);
		try {
			let expected: Expected = loaded.value.version;
			const firstCandidate = current.withChanges(input.changes);
			if (isErr(firstCandidate)) return firstCandidate;
			let candidate: Asset = firstCandidate.value;

			if (kindChanges) {
				const refreshed = await this.resolveKindChange(current, input.changes, nextUnit);
				if (isErr(refreshed)) return refreshed;
				candidate = refreshed.value.candidate;
				expected = refreshed.value.expected;
			}

			const saved = await this.assets.save(candidate, expected);
			if (isErr(saved)) return saved;
			await this.events.publish(
				assetUpdated({ assetId: saved.value.entity.id }),
			);
			return ok(saved.value.entity);
		} finally {
			release();
		}
	}

	/**
	 * The kind-change half of execute, so the lock-and-save skeleton above stays readable:
	 * re-read under the lock (the entity another tab may have moved is the one being
	 * judged, and its version is the expectation the write presents), then refuse while
	 * any Requirement still references the asset.
	 */
	private async resolveKindChange(
		current: Asset,
		changes: UpdateAssetInput['changes'],
		nextUnit: MeasurementUnit,
	): Promise<Result<{ candidate: Asset; expected: Expected }, UpdateAssetErrors>> {
		const reread = await this.assets.getById(current.id);
		if (isErr(reread)) return reread;
		if (reread.value === null) return err(assetNotFound(current.id));
		const candidate = reread.value.entity.withChanges(changes);
		if (isErr(candidate)) return candidate;

		const referents = await this.requirements.listByAsset(current.id);
		if (isErr(referents)) return referents;
		if (referents.value.length > 0) {
			return err({
				category: 'Validation',
				code: 'asset.unit-kind-referenced',
				message: `Cannot change ${current.id} from ${current.unit} to ${nextUnit}: `
					+ `${referents.value.length} requirement(s) reference it, and their areas `
					+ `would become ${UNIT_KIND[nextUnit]} figures. Reassign or delete them first.`,
			});
		}
		return ok({ candidate: candidate.value, expected: reread.value.version });
	}
}
