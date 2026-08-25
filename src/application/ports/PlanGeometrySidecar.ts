import type { PersistenceError, ValidationError } from '../../core/errors/AppError';
import type { Result } from '../../core/result/Result';
import type { Point } from '../../core/geometry/Point';
import type { Calibration } from '../../domain/plan/Calibration';
import type { PlanId } from '../../domain/plan/PlanId';
import type { EntityVersion } from './versioning';

/**
 * One geometry entry of the plan sidecar (ADR-002/ADR-011), raised to domain shapes: the
 * persisted `[x, y]` tuples come back as `Point`s so a caller never parses storage shape.
 * The id is the owning spatial object's (today: always a Zone note's id).
 */
export interface SpatialObjectGeometry {
	readonly id: string;
	readonly points: readonly Point[];
}

/** The whole editable content of one plan's sidecar, calibration included. */
export interface PlanGeometryDocument {
	readonly calibration: Calibration | null;
	readonly objects: readonly SpatialObjectGeometry[];
}

export interface PlanGeometrySnapshot {
	readonly document: PlanGeometryDocument;
	readonly version: EntityVersion;
}

/**
 * Read/write access to ONE plan's geometry sidecar as a single document (SDD §40). The
 * write replaces the whole document and is conditional on `expected`, exactly like every
 * other port here — recalibration rewrites the calibration and every rescaled object in
 * ONE file operation, which is why this is document-grained rather than per-object.
 *
 * `infrastructure/ObsidianPlanGeometrySidecar` adapts the concrete `PlanGeometryStore`;
 * schema, revision counter and lock stay below the port.
 */
export interface PlanGeometrySidecar {
	read(planId: PlanId): Promise<Result<PlanGeometrySnapshot, PersistenceError | ValidationError>>;
	write(
		planId: PlanId,
		document: PlanGeometryDocument,
		expected?: EntityVersion,
	): Promise<Result<EntityVersion, PersistenceError | ValidationError>>;
}
