import { isErr, ok, type Result } from '../../core/result/Result';
import type { GeometryError, PersistenceError } from '../../core/errors/AppError';
import type { Zone } from '../../domain/zone/Zone';
import type { ZoneId } from '../../domain/zone/ZoneId';
import type { Query } from './Query';
import type { ZoneRepository } from '../ports/ZoneRepository';

export interface GetZoneInspectorInput {
	readonly zoneId: ZoneId;
}

/**
 * The Inspector's read model for a single selected Zone (SDD §59, design slice 6): a
 * flat, presentation-shaped DTO — never a `Loaded<Zone>` handle, and never the entity
 * itself — computed on demand from the entity a query resolved.
 */
export interface ZoneInspectorFields {
	readonly id: ZoneId;
	readonly name: string;
	readonly areaMm2: number;
}

/**
 * The application-layer query behind `InspectorStore`'s single-selection case (SDD §59:
 * "Selection → Inspector Query → Inspector DTO"). `InspectorStore` never holds a
 * `ZoneRepository` handle itself — reaching one directly from presentation would be the
 * same layer violation an `EditorTool` reaching one would be, just in a panel instead of
 * on a canvas (`EditorContext` excludes repositories for exactly this reason, SDD §58).
 *
 * "Not found" is `ok(null)`, never an error — see `GetZone`, which this mirrors.
 *
 * **Error union, widened from the task brief's `PersistenceError` alone.** The brief
 * declares this query's error as `PersistenceError` only, matching a plain repository
 * read. But this query does more than read: it calls `Zone.area()`, which resolves
 * `Result<number, GeometryError>` (a `Zone`'s geometry is validated at creation and on
 * every `withGeometry()`, so a `GeometryError` here would mean a stored polygon a repository
 * handed back is not one this domain would ever construct — belt-and-braces, not a path
 * expected to fire, but the return type has to admit it or a real failure would need an
 * unsafe cast to fit through). A union that can't carry what its own body can produce is
 * a bug waiting for its first failing geometry, so `GeometryError` joins `PersistenceError`
 * here.
 */
export class GetZoneInspector
	implements Query<GetZoneInspectorInput, Result<ZoneInspectorFields | null, PersistenceError | GeometryError>>
{
	constructor(private readonly zones: ZoneRepository) {}

	async execute({ zoneId }: GetZoneInspectorInput): Promise<Result<ZoneInspectorFields | null, PersistenceError | GeometryError>> {
		const loaded = await this.zones.getById(zoneId);
		if (isErr(loaded)) return loaded;
		if (loaded.value === null) return ok(null);

		// Explicitly typed rather than left to inference through `Loaded<Zone>`: fallow
		// resolves a class member's cross-file usage from an explicit type annotation, not
		// a bare property access (CLAUDE.md's fallow gotcha) — without this, `.area()` below
		// reads as a call on some untyped value to the tool that decides whether `Zone.area`
		// still has a first consumer.
		const entity: Zone = loaded.value.entity;
		const areaResult = entity.area();
		if (isErr(areaResult)) return areaResult;

		return ok({ id: entity.id, name: entity.name, areaMm2: areaResult.value });
	}
}
