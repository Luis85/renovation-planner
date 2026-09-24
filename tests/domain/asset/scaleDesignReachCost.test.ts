import { describe, expect, it, vi } from 'vitest';
import { dimensionsOf } from '../../../src/domain/asset/AssetShape';
import { ASSET_PRESETS } from '../../../src/domain/asset/presets/catalogue';
import { defaultValues } from '../../../src/domain/asset/presets/presetGeometry';
import type * as ScaleSolve from '../../../src/domain/asset/scaleSolve';
import type { ScaleAttempt } from '../../../src/domain/asset/scaleSolve';
import { scaleDesignToDimensions } from '../../../src/domain/asset/shapeEdits';
import { expectDefined, expectOk } from '../../helpers/domain';

/**
 * AD18-R23 Task 11, fix round 1: Set dimensions (`scaleDesignToDimensions`) on the oval table, narrowed past its
 * reach and deepened, takes the degenerate bisection on real preset geometry. Its third pass (width again) starts
 * from the width pass 1 left at its floor, and that pass's own floor factor is refused, so it bisects upward. The
 * solver is wrapped, not replaced, to count `apply` calls per run.
 */
const runs = vi.hoisted(() => [] as number[]);
vi.mock('../../../src/domain/asset/scaleSolve', async (original) => {
	const real = await original<typeof ScaleSolve>();
	return {
		solveScale: <T>(attempt: ScaleAttempt<T>) => {
			let calls = 0;
			const solved = real.solveScale({ ...attempt, apply: (factor) => ((calls += 1), attempt.apply(factor)) });
			runs.push(calls);
			return solved;
		},
	};
});

describe('Set dimensions past the oval table\'s reach', () => {
	it('bisects on its third pass and still lands the nearest width', () => {
		const found = expectDefined(ASSET_PRESETS.find((each) => each.id === 'oval-table'), 'oval-table');
		const oval = expectOk(found.build(defaultValues(found)));
		runs.length = 0;

		// 1800 x 1000 asked to be 993.6 x 1200: the ends alone span the new depth, 1200, so that is the nearest width.
		const size = expectOk(dimensionsOf(expectOk(scaleDesignToDimensions(oval, 1800 * 0.552, 1000 * 1.2)).footprint));

		expect(runs).toHaveLength(3);
		expect(runs[2]).toBeGreaterThan(10);
		expect(runs[2]).toBeLessThanOrEqual(24);
		expect(size.depth).toBeCloseTo(1200, 6);
		expect(size.width).toBeGreaterThanOrEqual(1200 - 1e-6);
		expect(size.width).toBeLessThanOrEqual(1200 + 0.01);
	});
});
