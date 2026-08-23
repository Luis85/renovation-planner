import { describe, expect, it } from 'vitest';
import { createCalibration, validateCalibration } from '../../../src/domain/plan/Calibration';
import { expectErr, expectOk } from '../../helpers/domain';

describe('createCalibration', () => {
	it('derives pixelsPerWorldUnit from the pixel distance over the known distance', () => {
		const calibration = expectOk(
			createCalibration({
				pointA: { x: 0, y: 0 },
				pointB: { x: 100, y: 0 },
				knownDistance: 2000,
			}),
		);
		expect(calibration.pixelsPerWorldUnit).toBeCloseTo(100 / 2000);
	});

	it('rejects a non-positive known distance', () => {
		for (const knownDistance of [0, -1]) {
			const error = expectErr(
				createCalibration({
					pointA: { x: 0, y: 0 },
					pointB: { x: 10, y: 0 },
					knownDistance,
				}),
			);
			expect(error.code).toBe('plan.non-positive-distance');
			expect(error.category).toBe('Validation');
		}
	});

	it('rejects coincident points — the division by zero', () => {
		const error = expectErr(
			createCalibration({
				pointA: { x: 5, y: 5 },
				pointB: { x: 5, y: 5 },
				knownDistance: 1000,
			}),
		);
		expect(error.code).toBe('plan.degenerate-points');
		expect(error.category).toBe('Calculation');
	});
});

describe('validateCalibration', () => {
	it('accepts a well-formed calibration', () => {
		const calibration = expectOk(createCalibration({
			pointA: { x: 0, y: 0 },
			pointB: { x: 0, y: 50 },
			knownDistance: 1000,
		}));
		expect(validateCalibration(calibration)).toEqual({ ok: true, value: undefined });
	});

	it('rejects the same shapes createCalibration does', () => {
		expect(expectErr(validateCalibration({
			pointA: { x: 0, y: 0 },
			pointB: { x: 10, y: 0 },
			knownDistance: Number.NaN,
		})).code).toBe('plan.non-positive-distance');

		expect(expectErr(validateCalibration({
			pointA: { x: 1, y: 1 },
			pointB: { x: 1, y: 1 },
			knownDistance: 1000,
		})).code).toBe('plan.degenerate-points');

		expect(expectErr(validateCalibration({
			pointA: { x: 0, y: 0 },
			pointB: { x: 10, y: 0 },
			knownDistance: 1000,
			pixelsPerWorldUnit: 0,
		})).code).toBe('plan.invalid-scale');
	});
});
