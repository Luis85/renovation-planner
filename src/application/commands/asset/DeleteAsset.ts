import { err, isErr, ok, type Result } from '../../../core/result/Result';
import type {
	PersistenceError,
	ReferenceError,
	ValidationError,
} from '../../../core/errors/AppError';
import type { EventBus } from '../../../core/events/EventBus';
import { UNIT_KIND } from '../../../core/units/MeasurementUnit';
import { assetDeleted } from '../../../domain/asset/Asset.events';
import type { AssetId } from '../../../domain/asset/AssetId';
import type { RequirementId } from '../../../domain/requirement/RequirementId';
import { referenceError } from '../../errors';
import type { Command } from '../Command';
import type { Logger } from '../../ports/Logger';
import type { AssetRepository } from '../../ports/AssetRepository';
import type { RequirementRepository } from '../../ports/RequirementRepository';
import type { SequenceMarkerStore } from '../../ports/SequenceMarkerStore';
import type { ReferenceLocks } from '../../reference/ReferenceLocks';
import {
	runDeleteResolution,
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

export type DeleteAssetErrors = ReferenceError | ValidationError | PersistenceError;

/** One bundle instead of six positional collaborators (the max-params budget). */
export interface DeleteAssetDeps {
	readonly assets: AssetRepository;
	readonly requirements: RequirementRepository;
	readonly recalculate: Pick<RecalculateRequirementCommand, 'execute'>;
	readonly events: EventBus;
	readonly locks: ReferenceLocks;
	readonly logger: Logger;
	readonly markers?: SequenceMarkerStore;
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
	private readonly ops: Pick<DeleteAssetDeps, 'assets' | 'requirements' | 'recalculate' | 'events' | 'locks' | 'logger' | 'markers'>;

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
				logger: this.ops.logger,
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
					if (found.value.entity.projectId !== loaded.value.projectId) {
						return err({
							category: 'Validation',
							code: 'reference.cross-project-reassign',
							message: `Asset ${target} belongs to another project than the asset being deleted.`,
						});
					}
					if (UNIT_KIND[found.value.entity.unit] !== 'area') {
						return err({
							category: 'Validation',
							code: 'requirement.unit-not-area',
							message: `Reassignment target ${target} is ${found.value.entity.unit}; `
								+ 'a zone area cannot re-derive against it.',
						});
					}
					return ok(undefined);
				},
				repointAndMarkStale: async (snapshot, target) => {
					const current = await this.ops.requirements.getById(snapshot.entity.id);
					if (isErr(current)) return err(current.error);
					if (current.value === null) {
						return err(
							referenceError(
								'requirement.not-found',
								`Requirement ${snapshot.entity.id} not found.`,
							),
						);
					}
					const repointed = current.value.entity.repointedTo(
						current.value.entity.origin,
						target as AssetId,
					);
					if (isErr(repointed)) return err(repointed.error);
					const saved = await this.ops.requirements.save(repointed.value, current.value.version);
					if (isErr(saved)) return err(saved.error);
					return ok(saved.value.version);
				},
				markStalePersisted: async (snapshot) => {
					const marked = await this.ops.requirements.markStale(snapshot.entity.id);
					if (isErr(marked)) return err(marked.error);
					const reread = await this.ops.requirements.getById(snapshot.entity.id);
					if (isErr(reread)) return err(reread.error);
					if (reread.value === null) {
						return err({
							category: 'Persistence',
							code: 'requirement.not-found',
							message: `Requirement ${snapshot.entity.id} vanished during markStale.`,
						});
					}
					return ok(reread.value.version);
				},
				removeRequirement: (snapshot) =>
					this.ops.requirements.delete(snapshot.entity.id, snapshot.version),
				recalculateInline: (id) => this.ops.recalculate.execute({ requirementId: id }),
				restoreRequirement: async (snapshot, expected) => {
					const saved = await this.ops.requirements.save(snapshot.entity, expected);
					if (isErr(saved)) return err(saved.error);
					return ok(saved.value.version);
				},
			},
			input,
			this.ops.locks,
			this.ops.markers,
		);
		if (isErr(resolved)) return resolved;

		await this.ops.events.publish(
			assetDeleted({ assetId: input.assetId, projectId: loaded.value.projectId }),
		);
		return ok(resolved.value);
	}
}
