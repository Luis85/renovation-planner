import { err, ok, type Result } from '../../../core/result/Result';
import type { AppError } from '../../../core/errors/AppError';
import type { EventBus } from '../../../core/events/EventBus';
import type { Zone } from '../../../domain/zone/Zone';
import type { ZoneId } from '../../../domain/zone/ZoneId';
import { zoneRenamed } from '../../../domain/zone/Zone.events';
import type { ZoneRepository } from '../../ports/ZoneRepository';
import { checkExpectedVersion, type EntityVersion, type Loaded } from '../../ports/versioning';
import type { DispatchOutcome } from '../DispatchOutcome';
import { loadZone } from './loadZone';

export interface RenameZoneInput {
	readonly zoneId: ZoneId;
	readonly name: string;
	readonly expected: EntityVersion;
}

export interface RenameZoneResult {
	readonly zone: Loaded<Zone>;
	readonly before: EntityVersion;
	readonly outcome: DispatchOutcome;
}

/** Metadata changes use the ordinary Zone repository transaction, at its existing path. */
export class RenameZoneCommand {
	constructor(private readonly zones: ZoneRepository, private readonly events: EventBus) {}

	async execute(input: RenameZoneInput): Promise<Result<RenameZoneResult, AppError>> {
		const loaded = await loadZone(this.zones, input.zoneId);
		if (!loaded.ok) return loaded;
		const conflict = checkExpectedVersion('zone', input.zoneId, loaded.value.version, input.expected);
		if (conflict) return err(conflict);
		const updated = loaded.value.entity.withName(input.name);
		if (!updated.ok) return updated;
		if (updated.value.name === loaded.value.entity.name) {
			return ok({ zone: loaded.value, before: loaded.value.version, outcome: 'no-write' });
		}
		const saved = await this.zones.save(updated.value, input.expected);
		if (!saved.ok) return saved;
		const { id: zoneId, planId, projectId } = saved.value.entity;
		await this.events.publish(zoneRenamed({ zoneId, planId, projectId }));
		return ok({ zone: saved.value, before: loaded.value.version, outcome: 'wrote' });
	}
}
