import { describe, expect, it } from 'vitest';
import { assetError } from '../../../src/domain/asset/Asset.errors';
import { solveScale } from '../../../src/domain/asset/scaleSolve';
import { err, ok } from '../../../src/core/result/Result';
import { expectErr, expectOk } from '../../helpers/domain';

/**
 * The secant `resizeToExtent` has always used, with its subject made explicit: a factor is solved
 * for because the thing being measured is not linear in it. Driven here against plain numbers so
 * the loop's own rules — exact at step one when it IS linear, the nearest landing when the target
 * cannot be reached, a refusal only when nothing landed — are checked without a polygon in the way.
 */
// Half the growth arrives through a square root, the way an arc's sagitta follows its chord.
const grown = (factor: number): number => 50 * factor + 50 * Math.sqrt(factor);

// 100 at factor 1 and never above 200, whatever the factor — a four-arc circle asked to
// stretch past a ceiling its kept bulges will not cross.
const capped = (factor: number): number => 200 - 100 / factor;

describe('solveScale', () => {
	it('lands a linear extent exactly at the first factor', () => {
		const tries: number[] = [];

		const solved = expectOk(
			solveScale({
				start: 100,
				target: 250,
				apply: (factor) => {
					tries.push(factor);
					return ok(100 * factor);
				},
				measure: (extent) => extent,
			}),
		);

		expect(solved).toBeCloseTo(250, 9);
		expect(tries).toEqual([2.5]);
	});

	it('converges on an extent that is not linear in the factor', () => {
		const solved = expectOk(
			solveScale({ start: 100, target: 250, apply: (factor) => ok(grown(factor)), measure: (extent) => extent }),
		);

		// Three secant corrections land this fixture within ~3.2e-5 of the target, not the 5e-7
		// `toBeCloseTo(250, 6)` would ask for — MAX_STEPS is pinned to match the extraction's
		// unchanged behaviour (see scaleSolve.ts), so the assertion is sized to what it converges to.
		expect(solved).toBeCloseTo(250, 4);
	});

	it('answers the nearest landing when the target cannot be reached', () => {
		const solved = expectOk(
			solveScale({ start: 100, target: 900, apply: (factor) => ok(capped(factor)), measure: (extent) => extent }),
		);

		expect(solved).toBeGreaterThan(100);
		expect(solved).toBeLessThan(200);
	});

	it('refuses when the first factor is refused', () => {
		const refusal = assetError('invalid-scale', 'A scale factor must be a finite positive number.');

		const answered = solveScale({
			start: 100,
			target: -5,
			apply: () => err(refusal),
			measure: () => 0,
		});

		expect(expectErr(answered).code).toBe('asset.invalid-scale');
	});
});
