import type { GeometryError, ValidationError } from '../../../core/errors/AppError';
import type { Result } from '../../../core/result/Result';
import type { Polygon } from '../../../core/geometry/Polygon';
import { Zone } from '../../../domain/zone/Zone';
import {
	ZoneFrontmatterSchemaV1,
	ZONE_TYPE,
} from '../dto/zoneFrontmatter';
import {
	SpatialObjectGeometrySchemaV1,
	type SpatialObjectGeometryDTO,
} from '../dto/planGeometry';
import { toKebab } from '../dto/kebab';
import { parsePersisted } from './parse';

/**
 * The Zone mapper. A Zone spans two files (§42): its note carries identity and metadata
 * as frontmatter; its plan's sidecar carries the geometry entry keyed by this note's id.
 * Both halves move through this one module, so the two-file shape is visible in exactly
 * one place.
 */
export function zoneToPersistence(zone: Zone, revision: number): Record<string, unknown> {
	return {
		type: ZONE_TYPE,
		'schema-version': 1,
		id: zone.id,
		revision,
		project: zone.projectId,
		plan: zone.planId,
		name: zone.name,
		'zone-type': toKebab(zone.zoneType),
		status: toKebab(zone.status),
	};
}

/** The sidecar half of the same entity, lowered from domain geometry. */
export function zoneToGeometryEntry(zone: Zone): SpatialObjectGeometryDTO {
	return {
		id: zone.id,
		type: 'polygon',
		points: zone.geometry.points.map((point) => [point.x, point.y]),
	};
}

export function zoneFromPersistence(
	rawFrontmatter: unknown,
	rawGeometry: unknown,
): Result<Zone, ValidationError | GeometryError> {
	const frontmatter = parsePersisted(
		ZoneFrontmatterSchemaV1,
		rawFrontmatter,
		'zone.frontmatter-invalid',
		'Zone note',
	);
	if (!frontmatter.ok) return frontmatter;
	const geometry = parsePersisted(
		SpatialObjectGeometrySchemaV1,
		rawGeometry,
		'zone.geometry-invalid',
		'Zone geometry entry',
	);
	if (!geometry.ok) return geometry;

	const dto = frontmatter.value;
	const entry = geometry.value;
	return Zone.create({
		id: dto.id as Zone['id'],
		planId: dto.plan as Zone['planId'],
		projectId: dto.project as Zone['projectId'],
		name: dto.name,
		zoneType: dto['zone-type'],
		status: dto.status,
		geometry: { points: entry.points.map(([x, y]) => ({ x, y })) } satisfies Polygon,
	});
}
