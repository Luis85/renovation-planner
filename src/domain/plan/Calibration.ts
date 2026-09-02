import type { Point } from '../../core/geometry/Point';
import { distance } from '../../core/geometry/operations';
import { err, ok, type Result } from '../../core/result/Result';
import type { BaseError, CalculationError, ValidationError } from '../../core/errors/AppError';
import { planError } from './Plan.errors';

/**
 * How background pixels map to world coordinates (SDD §25): two points and the
 * real-world distance between them. `pixelsPerWorldUnit` is calibration's DERIVED
 * output — background source pixels per world unit — never an independently settable
 * field (ADR-009: the coordinate system is always "world millimeters, established by
 * calibration").
 *
 * **`pointA` and `pointB` are in the plan's CURRENT world units**, not in the
 * background's pixel space. The two coincide only on an uncalibrated plan, where the
 * placeholder scale is `1` — which is exactly why the distinction is invisible until
 * the first recalibration and worth stating here. A calibration AT REST additionally
 * satisfies `distance(pointA, pointB) === knownDistance`: `deriveCalibration` returns
 * the points as picked and the command that persists them multiplies every world-unit
 * coordinate for the plan, its own pair included.
 *
 * Like `Polygon`, the interface is deliberately UNVALIDATED at the type level so callers
 * can hold one mid-construction; validity lives in `validateCalibration` below.
 */
export interface Calibration {
	readonly pointA: Point;
	readonly pointB: Point;
	readonly knownDistance: number;
	readonly pixelsPerWorldUnit: number;
}

/**
 * The READ path's validator, behind `Plan.withCalibration`: it rejects a non-positive or
 * non-finite known distance (validation), coincident points — the division by zero — and
 * a non-positive scale (calculation), so a hand-edited sidecar cannot load a calibration
 * the derivation would never have produced.
 *
 * It deliberately does NOT check the at-rest `distance(pointA, pointB) === knownDistance`
 * invariant the persisting command establishes: floating-point rescale does not land on
 * it exactly, and a validator that refused what the writer legitimately produces would
 * make a saved plan unloadable. That invariant is asserted where it is CREATED
 * (`reversibleCalibratePlan.test.ts`), not re-derived here.
 *
 * Its `plan.*` error codes are the read path's vocabulary; `deriveCalibration`'s
 * `calibration.*` codes are the derivation's. Two vocabularies for two different
 * questions — "can this file be loaded" and "can this gesture be turned into a scale" —
 * rather than one spelling reused for both.
 */
export function validateCalibration(
	calibration: Calibration,
): Result<void, ValidationError | CalculationError> {
	if (!Number.isFinite(calibration.knownDistance) || calibration.knownDistance <= 0) {
		return err(planError('non-positive-distance', 'The known distance must be positive.'));
	}
	// FINITE as well as positive, matching the `knownDistance` guard two lines above. `> 0`
	// alone admits `Infinity`, which endpoints at ±1e308 produce by overflowing their own
	// subtraction — a separation that is neither derivable nor rescalable, exposed as a usable
	// calibration. NaN is refused by the same expression, since every NaN comparison is false.
	const separation = distance(calibration.pointA, calibration.pointB);
	if (!(separation > 0) || !Number.isFinite(separation)) {
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
 * The coincident-points refusal as a VALUE, for the one caller that detects the condition
 * before `deriveCalibration` would.
 *
 * `CalibrateTool` refuses two clicks in the same place before it prompts for a distance —
 * asking a user to measure something the tool has already decided is meaningless is worse
 * than not asking — so the domain's own guard is never reached on that path. Before design
 * slice 17 the tool simply returned, wiping the anchor the user's first click had drawn and
 * saying nothing; giving it this factory is what lets it refuse with the SAME code the domain
 * would have raised, rather than minting a second spelling of one failure.
 *
 * Exported alone rather than exporting `calibrationError`: the other two codes have no caller
 * that can detect their condition earlier, and a general factory would be an invitation to
 * mint calibration errors anywhere. `deriveCalibration` uses this too, so there is exactly one
 * spelling of this refusal.
 */
export function coincidentPointsError(): CalibrationError {
	return calibrationError('calibration.coincident-points', 'The two calibration points must not coincide.');
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
		return err(coincidentPointsError());
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
