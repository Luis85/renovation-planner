import { isErr, ok, type Result } from '../../../core/result/Result';
import type {
	GeometryError,
	ReferenceError,
} from '../../../core/errors/AppError';
import type { Polygon } from '../../../core/geometry/Polygon';
import type { EventBus } from '../../../core/events/EventBus';
import type { ZoneId } from '../../../domain/zone/ZoneId';
import { zoneGeometryChanged } from '../../../domain/zone/Zone.events';
import type { Zone } from '../../../domain/zone/Zone';
import type { Command } from '../Command';
import type { ZoneRepository } from '../../ports/ZoneRepository';
import type { RepositoryError } from '../../ports/repositoryErrors';
import type { EntityVersion, Loaded } from '../../ports/versioning';
import { loadZone } from './loadZone';

export interface MoveSpatialObjectInput {
	readonly zoneId: ZoneId;
	/** Full replacement — "move" vs "resize" is a UI/tool-level distinction. */
	readonly geometry: Polygon;
	/**
	 * Absent in this slice: a fresh gesture is last-writer-wins, so the handler saves
	 * with the version its own load returned. Slice 6's undo/redo supplies it.
	 */
	readonly expected?: EntityVersion;
}

export class MoveSpatialObjectCommand
	implements
		Command<
			MoveSpatialObjectInput,
			Result<
				{ zone: Loaded<Zone> },
				ReferenceError | GeometryError | RepositoryError
			>
		>
{
	constructor(
		private readonly zones: ZoneRepository,
		private readonly events: EventBus,
	) {}

	// The return type is ANNOTATED, not inferred, and this is the one command in
	// `application/commands/` that was not. Inference produces a union of `Result`s — one arm
	// per error type the body can return — which is not the same type as one `Result` over a
	// union of errors, and the `implements` clause above cannot catch the difference: the
	// union of arms IS assignable to the single `Result`, so the class checks out while every
	// CALLER gets the wider shape. `SetPlanBackground` states the same rule at its own
	// `execute`; what it cost here is a caller unable to name the error type at all.
	async execute(
		input: MoveSpatialObjectInput,
	): Promise<Result<{ zone: Loaded<Zone> }, ReferenceError | GeometryError | RepositoryError>> {
		const loaded = await loadZone(this.zones, input.zoneId);
		if (isErr(loaded)) {
			return loaded;
		}
		const zone: Zone = loaded.value.entity;
		const updated = zone.withGeometry(input.geometry);
		if (isErr(updated)) {
			return updated;
		}
		const saved = await this.zones.save(updated.value, input.expected ?? loaded.value.version);
		if (isErr(saved)) {
			return saved;
		}
		await this.events.publish(
			zoneGeometryChanged({
				zoneId: saved.value.entity.id,
				planId: saved.value.entity.planId,
				projectId: saved.value.entity.projectId,
			}),
		);
		return ok({ zone: saved.value });
	}
}
