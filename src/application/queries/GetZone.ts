import type { PersistenceError } from '../../core/errors/AppError';
import type { Result } from '../../core/result/Result';
import type { ZoneId } from '../../domain/zone/ZoneId';
import type { Zone } from '../../domain/zone/Zone';
import type { Query } from './Query';
import type { ZoneRepository } from '../ports/ZoneRepository';
import type { Loaded } from '../ports/versioning';

export interface GetZoneInput {
	readonly zoneId: ZoneId;
}

/** See GetProject: "not found" is `ok(null)`, never an error. */
export class GetZone
	implements Query<GetZoneInput, Result<Loaded<Zone> | null, PersistenceError>>
{
	constructor(private readonly zones: ZoneRepository) {}

	execute({ zoneId }: GetZoneInput) {
		return this.zones.getById(zoneId);
	}
}
