import { err, isErr, ok, type Result } from '../../../core/result/Result';
import type {
	GeometryError,
	PersistenceError,
	ReferenceError,
	ValidationError,
} from '../../../core/errors/AppError';
import type { Polygon } from '../../../core/geometry/Polygon';
import type { EventBus } from '../../../core/events/EventBus';
import { Zone } from '../../../domain/zone/Zone';
import { createZoneId } from '../../../domain/zone/ZoneId';
import type { ZoneStatus } from '../../../domain/zone/ZoneStatus';
import type { ZoneType } from '../../../domain/zone/ZoneType';
import { zoneCreated } from '../../../domain/zone/Zone.events';
import type { PlanId } from '../../../domain/plan/PlanId';
import { referenceError } from '../../errors';
import type { Command } from '../Command';
import type { PlanRepository } from '../../ports/PlanRepository';
import type { ZoneRepository } from '../../ports/ZoneRepository';
import type { Loaded } from '../../ports/versioning';

export interface CreateZoneInput {
	readonly planId: PlanId;
	readonly name: string;
	readonly zoneType: ZoneType;
	/**
	 * Optional, and `Zone.create` owns the default. Here because the domain has always
	 * accepted one and this input was the only thing unable to express it — which made
	 * every zone the app can create `Planned`, and the status channel of the canvas
	 * (§17's dash patterns) unreachable from inside Obsidian. CHANGING a status is slice
	 * 8's; stating one at creation is this command's.
	 */
	readonly status?: ZoneStatus;
	readonly geometry: Polygon;
	readonly domainNoteLink?: string | null;
}

export class CreateZoneCommand
	implements
		Command<
			CreateZoneInput,
			Result<
				{ zone: Loaded<Zone> },
				ValidationError | ReferenceError | GeometryError | PersistenceError
			>
		>
{
	constructor(
		private readonly zones: ZoneRepository,
		private readonly plans: PlanRepository,
		private readonly events: EventBus,
	) {}

	// The return type is ANNOTATED, not inferred, for the reason `SetPlanBackground` states
	// at length: inference produces a union of `Result`s — one arm per error type the body
	// returns — which is not the same type as one `Result` over a union of errors, and the
	// difference only shows up in a caller. This command had no production caller until the
	// sample-project seed became one, and `isErr` could not narrow the union it got.
	async execute(
		input: CreateZoneInput,
	): Promise<
		Result<{ zone: Loaded<Zone> }, ValidationError | ReferenceError | GeometryError | PersistenceError>
	> {
		const planResult = await this.plans.getById(input.planId);
		if (isErr(planResult)) {
			return planResult;
		}
		if (planResult.value === null) {
			return err(referenceError('zone.plan-not-found', `Plan ${input.planId} not found.`));
		}

		const zoneResult = Zone.create({
			id: createZoneId(),
			planId: input.planId,
			projectId: planResult.value.entity.projectId,
			name: input.name,
			zoneType: input.zoneType,
			status: input.status,
			geometry: input.geometry,
			domainNoteLink: input.domainNoteLink,
		});
		if (isErr(zoneResult)) {
			return zoneResult;
		}

		const zone = zoneResult.value;
		// 'absent': this is a create, so a Zone already holding this ID is a conflict.
		const saveResult = await this.zones.save(zone, 'absent');
		if (isErr(saveResult)) {
			return saveResult;
		}
		await this.events.publish(
			zoneCreated({ zoneId: zone.id, planId: zone.planId, projectId: zone.projectId }),
		);
		return ok({ zone: saveResult.value });
	}
}
