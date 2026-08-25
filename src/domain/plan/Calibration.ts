import type { Point } from '../../core/geometry/Point';
import { distance } from '../../core/geometry/operations';
import { err, ok, type Result } from '../../core/result/Result';
import type { BaseError, CalculationError, ValidationError } from '../../core/errors/AppError';
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

/** The three nameable business failures of a calibration derivation, narrowed by `code`. */
export type CalibrationErrorCode =
	| 'calibration.coincident-points'
	| 'calibration.invalid-distance'
	| 'calibration.degenerate-scale';

// Narrowing TCode is structurally still a CalculationError, not a new, incompatible type.
export type CalibrationError = BaseError<'Calculation', CalibrationErrorCode>;

function calibrationError(code: CalibrationErrorCode, message: string): CalibrationError {
	return { category: 'Calculation', code, message };
}

/**
 * The one place the scale is derived from (SDD §25's forward-compatibility note): two
 * points measured in CURRENT world units, the real-world distance between them, and the
 * calibration being corrected. First calibration and recalibration are the same formula —
 * first calibration just arrives with `previous === null`, whose
 * `pixelsPerWorldUnit` defaults to the uncalibrated placeholder `1`.
 *
 * Returns the points AS GIVEN; multiplying them (and every other world-unit coordinate
 * for the plan) by `scaleCorrection` so that the persisted pair measures exactly
 * `knownDistance` is the caller's transaction, not this function's.
 */
export function deriveCalibration(
	pointA: Point,
	pointB: Point,
	knownDistance: number,
	previous: Calibration | null,
): Result<{ calibration: Calibration; scaleCorrection: number }, CalibrationError> {
	if (!Number.isFinite(knownDistance) || knownDistance <= 0) {
		return err(calibrationError('calibration.invalid-distance', 'The known distance must be a finite, positive number.'));
	}
	const measuredDistance = distance(pointA, pointB);
	if (!(measuredDistance > 0)) {
		return err(calibrationError('calibration.coincident-points', 'The two calibration points must not coincide.'));
	}
	const scaleCorrection = knownDistance / measuredDistance;
	const pixelsPerWorldUnit = (previous?.pixelsPerWorldUnit ?? 1) / scaleCorrection;
	if (!Number.isFinite(pixelsPerWorldUnit) || pixelsPerWorldUnit <= 0) {
		return err(calibrationError('calibration.degenerate-scale', 'The derived scale collapsed; the inputs are pathological.'));
	}
	return ok({
		calibration: { pointA, pointB, knownDistance, pixelsPerWorldUnit },
		scaleCorrection,
	});
}

/**
 * The rescale PRODUCT can overflow where the ratio stayed finite (measured ~1e-302 over
 * a real distance gives a finite `scaleCorrection` whose product with any ordinary
 * coordinate is Infinity — which JSON persists as null). Same failure class, same code;
 * the caller that multiplies raises it over its output, not its inputs.
 */
export function nonFiniteRescaleError(): CalibrationError {
	return calibrationError(
		'calibration.degenerate-scale',
		'The rescale overflowed; the corrected coordinates would not be finite.',
	);
}
