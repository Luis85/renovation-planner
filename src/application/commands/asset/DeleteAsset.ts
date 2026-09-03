import { err, isErr, ok, type Result } from '../../../core/result/Result';
import type {
	ReferenceError,
} from '../../../core/errors/AppError';
import type { RepositoryError } from '../../ports/repositoryErrors';
import type { EventBus } from '../../../core/events/EventBus';
import { assetDeleted } from '../../../domain/asset/Asset.events';
import type { Asset } from '../../../domain/asset/Asset';
import type { AssetId } from '../../../domain/asset/AssetId';
import type { RequirementId } from '../../../domain/requirement/RequirementId';
import { referenceError } from '../../errors';
import type { Command } from '../Command';
import type { Logger } from '../../ports/Logger';
import type { AssetRepository } from '../../ports/AssetRepository';
import type { RequirementRepository } from '../../ports/RequirementRepository';
import type { AssetPriceOverrideRepository } from '../../ports/AssetPriceOverrideRepository';
import type { SequenceMarkerStore } from '../../ports/SequenceMarkerStore';
import type { ReferenceLocks } from '../../reference/ReferenceLocks';
import {
	runDeleteResolution,
	requirementResolutionSteps,
	type ResolvedSequence,
} from '../../reference/deleteResolution';
import type { RecalculateRequirementCommand } from '../requirement/RecalculateRequirement';
import { loadAsset } from '../requirement/AssignAsset';

export interface DeleteAssetInput {
	readonly assetId: AssetId;
	/** Absent: refuse while referents exist — the path a script or migration takes. */
	readonly resolution?: 'remove-references' | 'reassign' | 'delete-anyway';
	/** Required when `resolution` is `'reassign'`; validated against the same rules assignment applies. */
	readonly reassignTo?: AssetId;
	readonly resolvedReferents?: readonly RequirementId[];
}

export type DeleteAssetErrors = ReferenceError | RepositoryError;

/** One bundle instead of six positional collaborators (the max-params budget). */
export interface DeleteAssetDeps {
	readonly assets: AssetRepository;
	readonly requirements: RequirementRepository;
	readonly recalculate: Pick<RecalculateRequirementCommand, 'execute'>;
	readonly events: EventBus;
	readonly locks: ReferenceLocks;
	readonly logger: Logger;
	readonly markers?: SequenceMarkerStore;
	/** Task 7a: a price override names no Requirement, so it goes with the asset rather than
	 *  refusing its deletion — see `deleteOverridesOf`'s header. */
	readonly overrides: AssetPriceOverrideRepository;
	/** Slice 13's toast surface, handed straight to `runDeleteResolution`; see its `notify`,
	 *  and `deleteOverridesOf`'s for `priceCleanupFailed`. */
	readonly notify?: {
		markerClearFailed(entityId: string): void;
		/** A stray price note was left behind; the asset itself is gone. */
		priceCleanupFailed(assetId: string): void;
	};
}

/**
 * Deleting an Asset a Requirement still references never silently cascades (PRD §63–64).
 * The check lives HERE and not only in a dialog, because a script, a migration or a future
 * caller that never opened one must not be able to walk past it; the enforcement runs as
 * the compensated multi-entity sequence (`runDeleteResolution`) under the reference locks,
 * so a failure leaves the vault as it was — or, where compensation itself cannot write,
 * leaves the durable marker recovery finishes at next load.
 */
export class DeleteAssetCommand
	implements Command<DeleteAssetInput, Result<ResolvedSequence, DeleteAssetErrors>>
{
	private readonly ops: Pick<DeleteAssetDeps, 'assets' | 'requirements' | 'recalculate' | 'events' | 'locks' | 'logger' | 'markers' | 'overrides' | 'notify'>;

	constructor(deps: DeleteAssetDeps) {
		this.ops = deps;
	}

	async execute(
		input: DeleteAssetInput,
	): Promise<Result<ResolvedSequence, DeleteAssetErrors>> {
		const loaded = await loadAsset(this.ops.assets, input.assetId);
		if (isErr(loaded)) return loaded;

		const resolved = await runDeleteResolution(
			{
				entityId: input.assetId,
				entityKind: 'asset',
				logger: this.ops.logger,
				notify: this.ops.notify,
				events: this.ops.events,
				listReferents: () => this.ops.requirements.listByAsset(input.assetId),
				loadEntity: async () => await this.ops.assets.getById(input.assetId),
				deleteEntity: (expected) => this.ops.assets.delete(input.assetId, expected),
				validateReassignTarget: async (target) => {
					if (target === input.assetId) {
						return err({
							category: 'Validation',
							code: 'reference.self-reassign',
							message: 'An asset cannot be reassigned to itself.',
						});
					}
					const found = await this.ops.assets.getById(target as AssetId);
					if (isErr(found)) return found;
					if (found.value === null) {
						return err(
							referenceError('reference.reassign-target-gone', `Asset ${target} not found.`),
						);
					}
					// No project check here, and the asymmetry with `DeleteZone` is deliberate:
					// since design slice 19 an Asset belongs to no project, so any catalogue
					// entry is a legitimate reassignment target. A ZONE still belongs to one,
					// and `DeleteZone` still refuses a target from another project.
					const candidate: Asset = found.value.entity;
					if (!candidate.isAreaKind()) {
						return err({
							category: 'Validation',
							code: 'requirement.unit-not-area',
							message: `Reassignment target ${target} is ${found.value.entity.unit}; `
								+ 'a zone area cannot re-derive against it.',
						});
					}
					return ok(undefined);
				},
				// Deleting the Asset repoints at a new Asset; the Zone link survives.
				...requirementResolutionSteps(this.ops.requirements, this.ops.recalculate, (requirement, target) => ({
					origin: requirement.origin,
					assetId: target as AssetId,
				})),
			},
			input,
			this.ops.locks,
			this.ops.markers,
		);
		if (isErr(resolved)) return resolved;

		await this.deleteOverridesOf(input.assetId);
		await this.ops.events.publish(
			assetDeleted({ assetId: input.assetId }),
		);
		return ok(resolved.value);
	}

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
}
