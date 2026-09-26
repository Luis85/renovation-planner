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
const REACH_MM = 0.01;
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

		// Within `TOLERANCE_MM` (1e-6). The four-attempt cap this solve had stopped about 3.2e-5 short.
		expect(Math.abs(solved - 250)).toBeLessThanOrEqual(1e-6);
	});

	it('answers the nearest landing when the target cannot be reached', () => {
		// A non-finite factor refused, as `resizeBox` refuses one: the secant runs off towards infinity as the extent
		// flattens, so the solve ends on that refusal and answers the nearest finite landing, at the ceiling.
		const tries: number[] = [];
		const solved = expectOk(
			solveScale({
				start: 100,
				target: 900,
				apply: (factor) => {
					tries.push(factor);
					return Number.isFinite(factor) ? ok(capped(factor)) : err(assetError('invalid-scale', 'Not finite.'));
				},
				measure: (extent) => extent,
			}),
		);

		expect(solved).toBeGreaterThan(200 - REACH_MM);
		expect(solved).toBeLessThanOrEqual(200);
		// The FIRST non-finite factor is the last one tried, well short of the 24 attempts the cap allows.
		expect(tries.findIndex((factor) => !Number.isFinite(factor))).toBe(tries.length - 1);
		expect(tries.length).toBeLessThan(24);
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

// The oval table's clearance across its ends: 800 of straight run scales, the 2200 its two ends reach does not.
const stadium = (factor: number): number => 800 * factor + 2200;
// Steepens tenfold at factor 2: the secant through two landings short of 400 points past one beyond it.
const kinked = (factor: number): number => (factor < 2 ? 100 * factor : 200 + 1000 * (factor - 2));
// Rises to 300 at factor 5, then falls: a secant between two falling landings points below zero.
const backward = (factor: number): number => (factor <= 5 ? 60 * factor : 300 - 10 * (factor - 5));
const REFUSED = assetError('invalid-detail', 'Kept arcs would meet.');

/** `extent` solved from 3000 onto `target`, with every factor `apply` was handed; `refuse` stands in for validation. */
function solveOn(extent: (factor: number) => number, target: number, refuse = (_factor: number) => false) {
	const tries: number[] = [];
	const landed = solveScale({
		start: extent(1),
		target,
		apply: (factor) => {
			tries.push(factor);
			return refuse(factor) ? err(REFUSED) : ok(extent(factor));
		},
		measure: (value) => value,
	});
	return { landed: expectOk(landed), tries };
}

/**
 * Targets from 100 above `reach` down to half a millimetre, in half millimetres, and every one that breaks a rule:
 * landing more than `REACH_MM` above the nearest extent `extent` can reach, or under it, or more than 1e-6 off a
 * target that far above the reach, or further out than the target above it did give or take `slack`, or past the
 * 24 attempts `MAX_STEPS` allows. A refusal throws out of `solveOn`.
 */
function sweepInward(extent: (factor: number) => number, reach: number, slack: number, refuse?: (factor: number) => boolean) {
	const broken: string[] = [];
	let outer = Number.POSITIVE_INFINITY;
	for (let target = reach + 100; target > 0; target -= 0.5) {
		const { landed, tries } = solveOn(extent, target, refuse);
		const nearest = Math.max(target, reach);
		const exact = target >= reach + REACH_MM ? 1e-6 : REACH_MM;
		const far = landed < nearest - 1e-6 || landed > nearest + exact;
		if (far || landed > outer + slack || tries.length > 24) broken.push(`${target} lands ${landed} in ${tries.length}`);
		outer = landed;
	}
	return broken;
}

describe('solveScale at the reach limit (AD18-R23 Task 11)', () => {
	it('lands the nearest reachable extent, and never further out as the target moves in', () => {
		// Before: typed 2200 landed 2786.67 and 2199.5 landed 2273.32 (Task 5's review, I1). A reachable landing
		// sits within TOLERANCE_MM of its own target, so two neighbours may cross by twice that.
		expect(sweepInward(stadium, 2200, 2e-6)).toEqual([]);
	});

	it('lands the smallest factor validation accepts when it refuses those near zero', () => {
		// Refused below a quarter, as an outline whose kept arcs meet would be: nothing under 2400 is reachable. Under
		// 750 the FIRST factor is refused too, and bisects up from itself rather than coming back as a refusal. The
		// bisection stops within the floor factor of the boundary, so a landing is monotone to within REACH_MM here.
		expect(sweepInward(stadium, 2400, REACH_MM, (factor) => factor < 0.25)).toEqual([]);
	});

	it('bisects where a secant would leave the factors known to bracket the target', () => {
		const { landed, tries } = solveOn(kinked, 400);
		expect(Math.abs(landed - 400)).toBeLessThanOrEqual(1e-6);
		expect(tries).toHaveLength(6);
	});

	it('never hands apply a factor at or below zero after the first', () => {
		for (const [extent, target] of [[backward, 500], [stadium, 1000], [capped, 900], [grown, 1]] as const) {
			const { tries } = solveOn(extent, target);
			expect(tries.slice(1).every((factor) => factor > 0), `${String(tries)}`).toBe(true);
		}
	});

	it.each([
		// 2.5 lands 204.1 short of 250; the secant's 3.16 is refused. Before fix round 2 the solve stopped on 204.1.
		['a later factor', 250],
		// 400 / 100: the FIRST factor, 4, is refused while growing. Before fix round 2 that came back as the refusal.
		['the first factor, growing', 400],
	])('bisects down to the largest factor validation accepts when %s is refused above it', (_, target) => {
		// Refused above 3, as an outline whose arcs meet once stretched: nothing past grown(3), 236.6, is reachable.
		const { landed } = solveOn(grown, target, (factor) => factor > 3);
		expect(landed).toBeLessThanOrEqual(grown(3));
		expect(landed).toBeGreaterThan(grown(3) - REACH_MM);
	});
});
