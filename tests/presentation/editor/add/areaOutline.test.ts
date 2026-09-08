import { describe, expect, it } from 'vitest';
import { areaOutline } from '../../../../src/presentation/editor/add/areaOutline';

describe('Area creation outline', () => {
	it.each([
		{ points: [], code: 'polygon-too-few-points' },
		{ points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: NaN, y: 1 }], code: 'polygon-non-finite-coordinate' },
		{ points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }], code: 'polygon-zero-area' },
		{ points: [{ x: 0, y: 0 }, { x: 1e308, y: 0 }, { x: 0, y: 1e308 }], code: 'polygon-area-overflow' },
	])('refuses $code before a command exists', ({ points, code }) => {
		expect(areaOutline(points)).toMatchObject({ ok: false, error: { code } });
	});
	it('preserves a valid surface and both winding directions', () => {
		const points = [{ x: -100, y: 0 }, { x: 200, y: 0 }, { x: 0, y: 100 }];
		expect(areaOutline(points)).toEqual({ ok: true, value: { points } });
		expect(areaOutline(points.toReversed()).ok).toBe(true);
	});
});
