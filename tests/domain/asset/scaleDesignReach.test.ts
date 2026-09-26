import { describe, expect, it } from 'vitest';
import { dimensionsOf, type AssetShape } from '../../../src/domain/asset/AssetShape';
import { ASSET_PRESETS } from '../../../src/domain/asset/presets/catalogue';
import { defaultValues } from '../../../src/domain/asset/presets/presetGeometry';
import { scaleDesign, scaleDesignToDimensions } from '../../../src/domain/asset/shapeEdits';
import { expectDefined, expectOk } from '../../helpers/domain';

/**
 * AD18-R23 Task 11: Set dimensions (`scaleDesignToDimensions`) typed past what a curved footprint's kept bulges
 * can reach lands the NEAREST reachable size, and a smaller size typed does not land a larger one (beyond the
 * 1e-6 each reachable size lands within). Every preset whose footprint has an axis that tends to a floor as its
 * factor tends to zero, on that axis, at its defaults.
 *
 * The floor is measured by `scaleDesign` at a factor of 1e-7, which the solve does not try on these parts:
 * every part here widens by at most its start extent per unit of factor, so that sits within 3e-4 above the
 * infimum.
 */
const REACH_MM = 0.01;
const FLOOR_FACTOR = 1e-7;

const size = (shape: AssetShape) => expectOk(dimensionsOf(shape.footprint));

describe('Set dimensions past a curved footprint\'s reach', () => {
	it.each([
		['round-table', 'width'],
		['oval-table', 'width'],
		['curved-table', 'depth'],
		['toilet', 'depth'],
		['tree', 'width'],
		['shrub', 'width'],
	] as const)('lands the %s footprint\'s nearest %s and never a larger one for a smaller size', (id, axis) => {
		const found = expectDefined(ASSET_PRESETS.find((each) => each.id === id), id);
		const shape = expectOk(found.build(defaultValues(found)));
		const start = size(shape);
		const floor = size(expectOk(scaleDesign(shape, axis === 'width' ? FLOOR_FACTOR : 1, axis === 'depth' ? FLOOR_FACTOR : 1)))[axis];
		const slack = start[axis] * FLOOR_FACTOR;
		let outer = Number.POSITIVE_INFINITY;
		for (let target = floor + 30; target >= floor - 150; target -= 0.5) {
			const typed = axis === 'width' ? { width: target, depth: start.depth } : { width: start.width, depth: target };
			const landed = size(expectOk(scaleDesignToDimensions(shape, typed.width, typed.depth)))[axis];
			const nearest = Math.max(target, floor);
			expect(landed, `target ${target}`).toBeGreaterThanOrEqual(nearest - slack - 1e-6);
			// A size the footprint reaches with room to spare lands within TOLERANCE_MM of it, not merely REACH_MM.
			expect(landed, `target ${target}`).toBeLessThanOrEqual(nearest + (target >= floor + REACH_MM ? 1e-6 : REACH_MM));
			expect(landed, `target ${target}`).toBeLessThanOrEqual(outer + 2e-6);
			outer = landed;
		}
	});
});
