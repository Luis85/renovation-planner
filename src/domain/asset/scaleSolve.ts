import type { ValidationError } from '../../core/errors/AppError';
import type { Result } from '../../core/result/Result';

/** A solve this close to the typed extent has landed it; far below the whole millimetres any inspector shows. */
const TOLERANCE_MM = 1e-6;
/** The first guess plus three secant corrections. */
const MAX_STEPS = 4;

/** One axis being solved: where it starts at factor 1, where it should land, how a factor is applied, and how the result is measured. */
export interface ScaleAttempt<T> {
	readonly start: number;
	readonly target: number;
	readonly apply: (factor: number) => Result<T, ValidationError>;
	readonly measure: (value: T) => number;
}

/**
 * The factor that lands `target`, solved rather than divided.
 *
 * Both callers scale geometry whose BULGES are kept, so an arc keeps bowing by a sagitta that follows
 * its chord: `target / start` lands a straight outline exactly and misses a curved one — the toilet
 * bowl's Depth 900 as a plain factor measures 596. So the factor is solved by a secant over the
 * measured extent: exact at the first step whenever the extent is linear in the factor, and — for an
 * arc whose chord turns with the scale — the NEAREST attempt within `MAX_STEPS`, which is not always
 * within `TOLERANCE_MM`: one fixture converges to about 3e-5 at the cap rather than landing inside it.
 *
 * **Some extents cannot be reached at all.** A four-arc circle cannot be narrowed below about a fifth
 * of its diameter with a positive factor, and the secant can step past zero on the way. A step past
 * zero is halved toward zero instead (a negative factor is a mirror, which every caller refuses), and
 * the answer is the NEAREST attempt that landed — never a refusal worded as a scale to nothing. A
 * refusal comes back only when nothing landed at all, which is `apply`'s own answer to the first factor.
 *
 * ponytail: at most `MAX_STEPS` attempts; something needing more lands near rather than on the target.
 */
export function solveScale<T>(attempt: ScaleAttempt<T>): Result<T, ValidationError> {
	const { start, target, apply, measure } = attempt;
	const landed: { readonly result: Result<T, ValidationError>; readonly miss: number }[] = [];
	let previous = { factor: 1, extent: start };
	let factor = target / start;
	let result = apply(factor);
	for (let step = 1; result.ok; step += 1) {
		const extent = measure(result.value);
		landed.push({ result, miss: Math.abs(extent - target) });
		if (Math.abs(extent - target) <= TOLERANCE_MM || step === MAX_STEPS) break;
		const next = factor + ((target - extent) * (factor - previous.factor)) / (extent - previous.extent);
		previous = { factor, extent };
		factor = next > 0 ? next : factor / 2;
		result = apply(factor);
	}
	const misses = landed.map((tried) => tried.miss);
	return landed.length === 0 ? result : landed[misses.indexOf(Math.min(...misses))].result;
}
