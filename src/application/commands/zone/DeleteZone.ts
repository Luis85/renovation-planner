import { err, isErr, ok, type Result } from '../../../core/result/Result';
import type {
	PersistenceError,
	ReferenceError,
	ValidationError,
} from '../../../core/errors/AppError';
import type { EventBus } from '../../../core/events/EventBus';
import type { ZoneId } from '../../../domain/zone/ZoneId';
import { zoneDeleted } from '../../../domain/zone/Zone.events';
import type { RequirementId } from '../../../domain/requirement/RequirementId';
import { referenceError } from '../../errors';
import type { Command } from '../Command';
import type { Logger } from '../../ports/Logger';
import type { ZoneRepository } from '../../ports/ZoneRepository';
import type { RequirementRepository } from '../../ports/RequirementRepository';
import type { SequenceMarkerStore } from '../../ports/SequenceMarkerStore';
import type { ReferenceLocks } from '../../reference/ReferenceLocks';
import {
	runDeleteResolution,
	requirementResolutionSteps,
	type ResolvedSequence,
} from '../../reference/deleteResolution';
import { loadZone } from './loadZone';
import type { RecalculateRequirementCommand } from '../requirement/RecalculateRequirement';
import type { EntityVersion } from '../../ports/versioning';

export interface DeleteZoneInput {
	readonly zoneId: ZoneId;
	/**
	 * Absent for a user-initiated delete (the handler deletes with the version its own
	 * load returned); slice 8's undo-a-creation supplies it.
	 */
	readonly expected?: EntityVersionInput;
	/**
	 * Slice 10's three reference-resolution fields, all optional so every existing caller
	 * still compiles and a caller that omits them gets the SAFE behaviour — refuse while
	 * referents exist. A resolution without `resolvedReferents` is a ValidationError; a
	 * set that has since moved is refused as `reference.set-changed`, nothing written.
	 */
	readonly resolution?: 'remove-references' | 'reassign' | 'delete-anyway';
	/** Required when `resolution` is `'reassign'`. */
	readonly reassignTo?: ZoneId;
	readonly resolvedReferents?: readonly RequirementId[];
}

type EntityVersionInput = EntityVersion;

export interface DeleteZoneDeps {
	readonly zones: ZoneRepository;
	readonly requirements: RequirementRepository;
	readonly recalculate: Pick<RecalculateRequirementCommand, 'execute'>;
	readonly events: EventBus;
	readonly locks: ReferenceLocks;
	readonly logger: Logger;
	readonly markers?: SequenceMarkerStore;
}

export class DeleteZoneCommand
	implements
		Command<
			DeleteZoneInput,
			Result<
				ResolvedSequence & { zoneId: ZoneId },
				ReferenceError | ValidationError | PersistenceError
			>
		>
{
	private readonly ops: DeleteZoneDeps;

	constructor(deps: DeleteZoneDeps) {
		this.ops = deps;
	}

	async execute(
		input: DeleteZoneInput,
	): Promise<
		Result<ResolvedSequence & { zoneId: ZoneId }, ReferenceError | ValidationError | PersistenceError>
	> {
		const loaded = await loadZone(this.ops.zones, input.zoneId);
		if (isErr(loaded)) return loaded;

		const resolved = await runDeleteResolution(
			{
				entityId: input.zoneId,
				logger: this.ops.logger,
				listReferents: () => this.ops.requirements.listByZone(input.zoneId),
				loadEntity: () => this.ops.zones.getById(input.zoneId),
				deleteEntity: (snapshotVersion) =>
					this.ops.zones.delete(input.zoneId, input.expected ?? snapshotVersion),
				validateReassignTarget: async (target) => {
					if (target === input.zoneId) {
						return err({
							category: 'Validation',
							code: 'reference.self-reassign',
							message: 'A zone cannot be reassigned to itself.',
						});
					}
					const found = await this.ops.zones.getById(target as ZoneId);
					if (isErr(found)) return found;
					if (found.value === null) {
						return err(
							referenceError('reference.reassign-target-gone', `Zone ${target} not found.`),
						);
					}
					if (found.value.entity.projectId !== loaded.value.entity.projectId) {
						return err({
							category: 'Validation',
							code: 'reference.cross-project-reassign',
							message: `Zone ${target} belongs to another project than the zone being deleted.`,
						});
					}
					return ok(undefined);
				},
				// Deleting the Zone repoints at a new Zone reference; the Asset link survives.
				...requirementResolutionSteps(this.ops.requirements, this.ops.recalculate, (requirement, target) => ({
					origin: { kind: 'zone', zoneId: target as ZoneId },
					assetId: requirement.assetId,
				})),
			},
			input,
			this.ops.locks,
			this.ops.markers,
		);
		if (isErr(resolved)) return resolved;

		const entity = loaded.value.entity;
		await this.ops.events.publish(
			zoneDeleted({ zoneId: entity.id, planId: entity.planId, projectId: entity.projectId }),
		);
		return ok({ ...resolved.value, zoneId: entity.id });
	}
}
