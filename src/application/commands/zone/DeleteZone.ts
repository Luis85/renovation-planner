import { isErr, ok, type Result } from '../../../core/result/Result';
import type { ReferenceError } from '../../../core/errors/AppError';
import type { EventBus } from '../../../core/events/EventBus';
import type { ZoneId } from '../../../domain/zone/ZoneId';
import { zoneDeleted } from '../../../domain/zone/Zone.events';
import type { EntityVersion } from '../../ports/versioning';
import type { Command } from '../Command';
import type { ZoneRepository } from '../../ports/ZoneRepository';
import type { RepositoryError } from '../../ports/repositoryErrors';
import { loadZone } from './loadZone';

export interface DeleteZoneInput {
	readonly zoneId: ZoneId;
	/**
	 * Absent for a user-initiated delete (the handler deletes with the version its own
	 * load returned); slice 8's undo-a-creation supplies it. `resolution` arrives from
	 * slice 10 once Requirement exists to reference a Zone.
	 */
	readonly expected?: EntityVersion;
}

/**
 * Data Safety rule 5 (SDD §87: never cascade-delete silently) has NO enforcement point
 * here yet, deliberately: nothing in the persisted model references a Zone —
 * Requirements arrive with slice 10 — so there is no referent this delete could orphan,
 * and inventing a check against an empty set would be scaffolding for a vocabulary
 * slice 10 has not defined. When the first referencing entity arrives, THIS command is
 * where the refusal (`ReferenceError` naming the referents) or the explicit-resolution
 * gate goes; PRD §64's dialog is slice 15's over whatever this command demands.
 */

export class DeleteZoneCommand
	implements
		Command<DeleteZoneInput, Result<{ zoneId: ZoneId }, ReferenceError | RepositoryError>>
{
	constructor(
		private readonly zones: ZoneRepository,
		private readonly events: EventBus,
	) {}

	async execute(input: DeleteZoneInput) {
		const loaded = await loadZone(this.zones, input.zoneId);
		if (isErr(loaded)) {
			return loaded;
		}
		const deleted = await this.zones.delete(input.zoneId, input.expected ?? loaded.value.version);
		if (isErr(deleted)) {
			return deleted;
		}
		const entity = loaded.value.entity;
		await this.events.publish(
			zoneDeleted({ zoneId: entity.id, planId: entity.planId, projectId: entity.projectId }),
		);
		return ok({ zoneId: input.zoneId });
	}
}
