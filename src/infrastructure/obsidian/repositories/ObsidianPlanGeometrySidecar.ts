import type { PersistenceError, ValidationError } from '../../../core/errors/AppError';
import { err, ok, type Result } from '../../../core/result/Result';
import type { PlanId } from '../../../domain/plan/PlanId';
import type {
	EntityVersion,
} from '../../../application/ports/versioning';
import type { PlanGeometryDTO } from '../../persistence/dto/planGeometry';
import type {
	PlanGeometryDocument,
	PlanGeometrySidecar,
	PlanGeometrySnapshot,
} from '../../../application/ports/PlanGeometrySidecar';
import type { PlanGeometryStore } from './PlanGeometryStore';
import {
	calibrationFromPersistence,
	calibrationToPersistence,
} from '../../persistence/mappers/planMapper';

function toTuples(points: readonly { x: number; y: number }[]): [number, number][] {
	return points.map((point) => [point.x, point.y]);
}

/**
 * The slice-7 port's face over the concrete `PlanGeometryStore` (SDD §40): the whole
 * sidecar document raised to domain shapes on the way out, and lowered back for the one
 * `mutate` that writes it. Storage shape — tuples, schema fields, revision bookkeeping —
 * never crosses this boundary; application code sees `Point`s and an `EntityVersion`.
 *
 * The write REPLACES calibration and objects together, which is exactly why the port is
 * document-grained: a recalibration lands both halves in one file operation under the
 * plan's lock.
 */
export class ObsidianPlanGeometrySidecar implements PlanGeometrySidecar {
	constructor(private readonly store: PlanGeometryStore) {}

	async read(
		planId: PlanId,
	): Promise<Result<PlanGeometrySnapshot, PersistenceError | ValidationError>> {
		const snapshot = await this.store.read(planId);
		if (!snapshot.ok) {
			return snapshot;
		}
		const dto = snapshot.value.dto;
		return ok({
			document: {
				calibration: dto.calibration ? calibrationFromPersistence(dto.calibration) : null,
				objects: dto.objects.map((object) => ({
					id: object.id,
					points: object.points.map(([x, y]) => ({ x, y })),
				})),
			},
			version: snapshot.value.version,
		});
	}

	async write(
		planId: PlanId,
		document: PlanGeometryDocument,
		expected?: EntityVersion,
	): Promise<Result<EntityVersion, PersistenceError | ValidationError>> {
		const mutated = await this.store.mutate(
			planId,
			(dto) => ({
				...dto,
				calibration: document.calibration ? calibrationToPersistence(document.calibration) : null,
				// The port erases the entry type, and 'polygon' is the only one schema v1
				// knows — the day the schema grows a second spatial-object type, this
				// literal becomes a rewrite of every entry and must move into the port.
				objects: document.objects.map((object): PlanGeometryDTO['objects'][number] => ({
					id: object.id,
					type: 'polygon',
					points: toTuples(object.points),
				})),
			}),
			expected,
		);
		if (!mutated.ok) {
			return err(mutated.error);
		}
		return ok(mutated.value.version);
	}
}

