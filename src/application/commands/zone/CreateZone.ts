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

	async execute(input: CreateZoneInput) {
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
