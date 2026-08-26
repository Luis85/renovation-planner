import { describe, expect, it } from 'vitest';
import { deriveCalibration, validateCalibration, type Calibration } from '../../../src/domain/plan/Calibration';
import { area, distance, scale } from '../../../src/core/geometry/operations';
import { expectErr, expectOk } from '../../helpers/domain';

/**
 * The READ path's gate. `createCalibration` used to sit beside it deriving a second,
 * incompatible answer — points that did not measure their own `knownDistance`, no rescale
 * of the geometry around them — and was deleted with slice 3's `CalibratePlanCommand`;
 * `deriveCalibration` below is the one derivation now.
 */
describe('validateCalibration', () => {
	const wellFormed: Calibration = {
		pointA: { x: 0, y: 0 },
		pointB: { x: 0, y: 1000 },
		knownDistance: 1000,
		pixelsPerWorldUnit: 0.05,
	};

	it('accepts a well-formed calibration', () => {
		expect(validateCalibration(wellFormed)).toEqual({ ok: true, value: undefined });
	});

	it('accepts what deriveCalibration plus its caller rescale actually produce', () => {
		// The two halves have to agree: a calibration this validator refused would be one
		// the writer can persist and `getById` can never load back.
		const { calibration, scaleCorrection } = expectOk(
			deriveCalibration({ x: 812, y: 240 }, { x: 812, y: 1040 }, 3200, null),
		);
		expect(validateCalibration({
			...calibration,
			pointA: scale(calibration.pointA, scaleCorrection, { x: 0, y: 0 }),
			pointB: scale(calibration.pointB, scaleCorrection, { x: 0, y: 0 }),
		})).toEqual({ ok: true, value: undefined });
	});

	it('rejects a non-finite or non-positive known distance', () => {
		for (const knownDistance of [Number.NaN, Number.POSITIVE_INFINITY, 0, -1]) {
			const error = expectErr(validateCalibration({ ...wellFormed, knownDistance }));
			expect(error.code).toBe('plan.non-positive-distance');
			expect(error.category).toBe('Validation');
		}
	});

	it('rejects coincident points — the division by zero', () => {
		const error = expectErr(validateCalibration({
			...wellFormed,
			pointA: { x: 1, y: 1 },
			pointB: { x: 1, y: 1 },
		}));
		expect(error.code).toBe('plan.degenerate-points');
		expect(error.category).toBe('Calculation');
	});

	it('rejects a non-finite or non-positive scale', () => {
		for (const pixelsPerWorldUnit of [0, -1, Number.NaN]) {
			expect(expectErr(validateCalibration({ ...wellFormed, pixelsPerWorldUnit })).code)
				.toBe('plan.invalid-scale');
		}
	});
});

describe('deriveCalibration', () => {
	it('derives scaleCorrection and pixelsPerWorldUnit from an uncalibrated plan', () => {
		const { calibration, scaleCorrection } = expectOk(
			deriveCalibration({ x: 0, y: 0 }, { x: 800, y: 0 }, 3200, null),
		);
		expect(scaleCorrection).toBeCloseTo(4);
		// Uncalibrated default: 1 world unit per image pixel, so ppwu starts at 1 and
		// becomes its reciprocal under the correction.
		expect(calibration.pixelsPerWorldUnit).toBeCloseTo(1 / 4);
		expect(calibration.knownDistance).toBe(3200);
	});

	it('corrects against the PREVIOUS scale on recalibration', () => {
		const previous = expectOk(
			deriveCalibration({ x: 0, y: 0 }, { x: 100, y: 0 }, 2000, null),
		).calibration;
		const { calibration, scaleCorrection } = expectOk(
			deriveCalibration({ x: 0, y: 0 }, { x: 50, y: 0 }, 500, previous),
		);
		expect(scaleCorrection).toBeCloseTo(10);
		expect(calibration.pixelsPerWorldUnit).toBeCloseTo(previous.pixelsPerWorldUnit / 10);
	});

	it('returns the points AS GIVEN — rescaling them to knownDistance is the command job', () => {
		const { calibration } = expectOk(
			deriveCalibration({ x: 3, y: 4 }, { x: 9, y: 12 }, 50, null),
		);
		expect(calibration.pointA).toEqual({ x: 3, y: 4 });
		expect(calibration.pointB).toEqual({ x: 9, y: 12 });
		expect(distance(calibration.pointA, calibration.pointB)).not.toBeCloseTo(50);
	});

	it('rejects coincident points with calibration.coincident-points', () => {
		const error = expectErr(deriveCalibration({ x: 5, y: 5 }, { x: 5, y: 5 }, 1000, null));
		expect(error).toMatchObject({ category: 'Calculation', code: 'calibration.coincident-points' });
	});

	it('rejects a non-positive or non-finite known distance with calibration.invalid-distance', () => {
		for (const knownDistance of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
			const error = expectErr(deriveCalibration({ x: 0, y: 0 }, { x: 10, y: 0 }, knownDistance, null));
			expect(error).toMatchObject({ category: 'Calculation', code: 'calibration.invalid-distance' });
		}
	});

	it('rejects a pathological floating-point scale with calibration.degenerate-scale', () => {
		// measured ~1e-300 over known 1e300 drives scaleCorrection past finite; the derived
		// pixelsPerWorldUnit collapses to 0 and must be refused, not persisted.
		const error = expectErr(deriveCalibration({ x: 0, y: 0 }, { x: 1e-300, y: 0 }, 1e300, null));
		expect(error).toMatchObject({ category: 'Calculation', code: 'calibration.degenerate-scale' });
	});

	it('classifies non-finite COORDINATES as coincident points, deliberately', () => {
		// A NaN coordinate makes distance() answer NaN, which fails the `> 0` guard. That
		// lands in coincident-points rather than a dedicated code — pinned here so the
		// classification is a decision, not an accident nobody looked at.
		const error = expectErr(
			deriveCalibration({ x: Number.NaN, y: 0 }, { x: 10, y: 0 }, 1000, null),
		);
		expect(error).toMatchObject({ category: 'Calculation', code: 'calibration.coincident-points' });
	});

	it('rescaling geometry by scaleCorrection scales area by its square', () => {
		const polygon = { points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 8 }] };
		const s = 4;
		const rescaled = scale(polygon, s, { x: 0, y: 0 });
		const before = expectOk(area(polygon));
		const after = expectOk(area(rescaled));
		expect(after).toBeCloseTo(before * s * s);
		expect(rescaled.points[2]).toEqual({ x: 40, y: 32 });
	});

	it('calibrating twice in sequence lands where one direct calibration would', () => {
		const pickedA = { x: 812, y: 240 };
		const pickedB = { x: 812, y: 1040 };
		const firstPass = expectOk(deriveCalibration(pickedA, pickedB, 1600, null));
		// The second pick happens on coordinates already rescaled by the first correction,
		// which is why the same physical feature measures s1 times further apart now.
		const repickedA = scale(firstPass.calibration.pointA, firstPass.scaleCorrection, { x: 0, y: 0 });
		const repickedB = scale(firstPass.calibration.pointB, firstPass.scaleCorrection, { x: 0, y: 0 });
		const secondPass = expectOk(deriveCalibration(repickedA, repickedB, 3200, firstPass.calibration));
		const direct = expectOk(deriveCalibration(pickedA, pickedB, 3200, null));
		expect(secondPass.scaleCorrection * firstPass.scaleCorrection).toBeCloseTo(direct.scaleCorrection);
		expect(secondPass.calibration.pixelsPerWorldUnit).toBeCloseTo(direct.calibration.pixelsPerWorldUnit, 12);
	});
});
