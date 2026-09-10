import type { ZoneGeometryVersions } from '../../../application/ports/ZoneRepository';
import type { RepositoryError } from '../../../application/ports/repositoryErrors';
import type { ZoneId } from '../../../domain/zone/ZoneId';
import type { CurvedPolygon } from '../../../core/geometry/CurvedPolygon';
import { err, ok, type Result } from '../../../core/result/Result';
import { zoneFromPersistence, zoneToGeometryEntry } from '../../persistence/mappers/zoneMapper';
import type { NoteVaultDeps } from './NoteVaultDeps';
import { openNoteById, persistenceError } from './noteIo';
import { zoneVersion } from './zoneVersion';

/** No post-write read can accidentally adopt a peer's version as this editor's receipt. */
export function prepareZoneGeometryVersions(deps: NoteVaultDeps, id: ZoneId, geometry: CurvedPolygon): Result<ZoneGeometryVersions | null, RepositoryError> {
	const opened = openNoteById(deps, 'zone', id);
	if (opened.status === 'missing') return ok(null);
	if (opened.status === 'error') return err(opened.error);
	const entry = { id, type: 'polygon' as const, points: geometry.points.map(point => [point.x, point.y] as [number, number]), ...(geometry.bulges ? { bulges: [...geometry.bulges] } : {}) };
	const entity = zoneFromPersistence(opened.migrated, entry);
	if (!entity.ok) return err(persistenceError('zone.entity-invalid', entity.error.message));
	const raw = structuredClone(opened.raw);
	return ok({ zone: { entity: entity.value, version: zoneVersion(raw, entry) }, versionFor: next => {
		const changed = entity.value.withGeometry(next);
		return changed.ok ? ok(zoneVersion(raw, zoneToGeometryEntry(changed.value))) : changed;
	} });
}
