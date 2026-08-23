import type { Point } from '../../core/geometry/Point';
import { distance } from '../../core/geometry/operations';
import { err, ok, type Result } from '../../core/result/Result';
import type { CalculationError, ValidationError } from '../../core/errors/AppError';
import { planError } from './Plan.errors';

/**
 * How background pixels map to world coordinates (SDD §25): two points measured in the
 * background's pixel space and the real-world distance between them. `pixelsPerWorldUnit`
 * is calibration's DERIVED output — pixel distance over known distance — never an
 * independently settable field (ADR-009: the coordinate system is always "world
 * millimeters, established by calibration").
 *
 * Like `Polygon`, the interface is deliberately UNVALIDATED at the type level so callers
 * can hold one mid-construction; validity lives in `validateCalibration` /
 * `createCalibration` below.
 */
export interface Calibration {
	readonly pointA: Point;
	readonly pointB: Point;
	readonly knownDistance: number;
	readonly pixelsPerWorldUnit: number;
}

export interface CreateCalibrationInput {
	readonly pointA: Point;
	readonly pointB: Point;
	/** World units (mm) — like every length here (ADR-009). */
	readonly knownDistance: number;
}

/**
 * The shared validator behind `createCalibration` and `Plan.withCalibration`: both reject
 * a non-positive or non-finite known distance (validation), coincident points — the
 * division by zero — and a non-positive scale (calculation).
 */
export function validateCalibration(
	calibration: Calibration,
): Result<void, ValidationError | CalculationError> {
	if (!Number.isFinite(calibration.knownDistance) || calibration.knownDistance <= 0) {
		return err(planError('non-positive-distance', 'The known distance must be positive.'));
	}
	if (!(distance(calibration.pointA, calibration.pointB) > 0)) {
		return err({
			category: 'Calculation',
			code: 'plan.degenerate-points',
			message: 'The two calibration points must not coincide.',
		});
	}
	if (!Number.isFinite(calibration.pixelsPerWorldUnit) || calibration.pixelsPerWorldUnit <= 0) {
		return err(planError('invalid-scale', 'pixelsPerWorldUnit must be a positive number.'));
	}
	return ok(undefined);
}

/** Derives `pixelsPerWorldUnit` from the two points and the known distance. */
export function createCalibration(
	input: CreateCalibrationInput,
): Result<Calibration, ValidationError | CalculationError> {
	if (!Number.isFinite(input.knownDistance) || input.knownDistance <= 0) {
		return err(planError('non-positive-distance', 'The known distance must be positive.'));
	}
	const pixelDistance = distance(input.pointA, input.pointB);
	if (!(pixelDistance > 0)) {
		return err({
			category: 'Calculation',
			code: 'plan.degenerate-points',
			message: 'The two calibration points must not coincide.',
		});
	}
	return ok({
		pointA: input.pointA,
		pointB: input.pointB,
		knownDistance: input.knownDistance,
		pixelsPerWorldUnit: pixelDistance / input.knownDistance,
	});
}
