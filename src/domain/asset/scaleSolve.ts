import type { ValidationError } from '../../core/errors/AppError';
import type { Result } from '../../core/result/Result';

/** A solve this close to the typed extent has landed it; far below the whole millimetres any inspector shows. */
const TOLERANCE_MM = 1e-6;
/**
 * How near the solve comes to an extent it cannot reach: the smallest factor it tries is this over the start
 * extent. Every preset part widens by at most its start extent per unit of factor near zero (measured), so that
 * factor lands within this of the infimum — a fiftieth of the half millimetre the inspector's whole millimetres
 * round over — while two points 0.3 mm apart along a 3 m axis stay above the 1e-6 coincidence tolerance.
 */
const REACH_MM = 0.01;
/**
 * Attempts at most. A reachable shrink takes the first guess, the floor and a secant (three, exact when the extent
 * is linear in the factor); a curved one converges a few steps later. The cap is for the bisection a refused factor
 * starts, about `log2(start / REACH_MM)` steps, and that is not only a user's degenerate outline: a corner drag's
 * third pass starts from the width pass 1 left at its floor, and the oval table's clearance, with 0.0027 mm of
 * straight run left, meets its own arcs at that pass's floor — twenty attempts in one solve, measured.
 */
const MAX_STEPS = 24;

/** One axis being solved: where it starts at factor 1, where it should land, how a factor is applied, and how the result is measured. */
export interface ScaleAttempt<T> {
	readonly start: number;
	readonly target: number;
	readonly apply: (factor: number) => Result<T, ValidationError>;
	readonly measure: (value: T) => number;
}

interface Probe {
	readonly factor: number;
	readonly extent: number;
}

/**
 * What is known about where `target` lies: the latest factor measured short of it, the latest past it, the largest
 * refused with nothing short of it measured (`below`, 0 at first), and the latest refused once something short of it
 * was (`above`, infinite at first).
 */
interface Bracket {
	readonly lo: Probe | undefined;
	readonly hi: Probe | undefined;
	readonly below: number;
	readonly above: number;
	readonly floor: number;
}

/**
 * The next factor to try, positive whenever every factor measured so far is. Without a factor measured short of
 * the target, the floor, then a bisection upward from a refused factor. With the short side and an upper bound —
 * a landing past the target or a refused factor, whichever is smaller — the secant while it stays inside them and
 * the midpoint when it does not; with only the short side, the secant while it grows and a doubling when it does not.
 */
function nextFactor({ lo, hi, below, above, floor }: Bracket, secant: number): number {
	// `hi` is there: with no `lo`, the start or a landing measured past the target.
	if (lo === undefined) return below === 0 ? floor : (below + (hi as Probe).factor) / 2;
	const upper = Math.min(hi?.factor ?? Number.POSITIVE_INFINITY, above);
	if (upper === Number.POSITIVE_INFINITY) return secant > lo.factor ? secant : 2 * lo.factor;
	return secant > lo.factor && secant < upper ? secant : (lo.factor + upper) / 2;
}

/**
 * The target is as near as validation lets it be: with nothing measured short of it, a LANDING past it — a factor
 * under one, not the unscaled start, which was never applied — is within the floor of one refused, or of zero;
 * with something short of it, a factor refused above is within the floor.
 */
function outOfReach({ lo, hi, below, above, floor }: Bracket): boolean {
	if (lo !== undefined) return above - lo.factor <= floor;
	// `hi` is there: with no `lo`, the start or a landing measured past the target.
	const past = (hi as Probe).factor;
	return past < 1 && past - below <= floor;
}

/**
 * The factor that lands `target`, solved rather than divided.
 *
 * Every caller scales geometry whose BULGES are kept, so an arc keeps bowing by a sagitta that follows
 * its chord: `target / start` lands a straight outline exactly and misses a curved one — the toilet
 * bowl's Depth 900 as a plain factor measures 596. So the factor is solved by a secant over the
 * measured extent, kept inside a bracket: exact at the first step whenever the extent is proportional
 * to the factor, as a straight outline's is, and otherwise within `TOLERANCE_MM` unless `MAX_STEPS`
 * runs out first, when the answer is the nearest attempt.
 *
 * **Some extents cannot be reached at all.** A stadium's ends keep their reach under a scale across them,
 * and a four-arc circle cannot be narrowed below about a fifth of its diameter: the extent tends to a floor
 * as the factor tends to zero, and a factor at or below zero is a mirror, which every caller refuses. So a
 * target short of the first guess, with nothing measured short of it, tries the smallest factor next
 * (`REACH_MM / start`). If that still lands past the target, the target is out of reach and that landing is
 * the answer — within `REACH_MM` of the nearest reachable extent (for a part that widens as `REACH_MM`
 * states), and the same landing for every target short of it, so the landed extent does not move outward
 * as the target moves in, beyond the `TOLERANCE_MM` each reachable landing may sit either side of its own
 * target. A target between the infimum and that landing is reachable and lands it too, so "out of reach"
 * above means out of reach or within `REACH_MM` of it.
 *
 * If validation refuses a factor on the way down — the floor, or the first guess itself — the solve bisects
 * upward, towards the unscaled outline, which is valid, until the smallest factor it accepts is within the
 * floor. The landing then depends on where the bisection started, so nearness and ordering hold to within
 * the extent the part moves across one floor factor: at most `REACH_MM`, and measured at 1e-7 mm on the
 * oval table's clearance `MAX_STEPS` names (its corner lands 700.0000001 against a side at 700).
 *
 * A factor refused on the way UP — growing, or inside a bracket — is the mirror: an upper bound the solve
 * bisects down from, to the largest factor it accepts within the floor, and the nearest landing below it is
 * the answer. The shrub's detail-1 reaches it: flattened to its floor and then widened, its arcs meet.
 *
 * A refusal comes back only when nothing landed at all: `apply`'s own answer to a first factor at or below
 * zero, or a bisection that never landed.
 *
 * ponytail: at most `MAX_STEPS` calls to `apply`; the drag makes up to three solves per pointer move.
 */
export function solveScale<T>(attempt: ScaleAttempt<T>): Result<T, ValidationError> {
	const { start, target, apply, measure } = attempt;
	const landed: { readonly result: Result<T, ValidationError>; readonly miss: number }[] = [];
	const unscaled = { factor: 1, extent: start };
	let bracket: Bracket = {
		lo: start < target ? unscaled : undefined,
		hi: start >= target ? unscaled : undefined,
		below: 0,
		above: Number.POSITIVE_INFINITY,
		// At most a half: a part already within REACH_MM of its floor (the washbasin's tap hole, 0.0083 mm wide after
		// a corner drag's width pass) still takes a step below one, and still lands within REACH_MM of the infimum.
		floor: Math.min(REACH_MM / start, 0.5),
	};
	let previous: Probe = unscaled;
	let secant = Number.NaN;
	let factor = target / start;
	let result = apply(factor);
	for (let step = 1; ; step += 1) {
		if (result.ok) {
			const extent = measure(result.value);
			landed.push({ result, miss: Math.abs(extent - target) });
			if (Math.abs(extent - target) <= TOLERANCE_MM) break;
			const probe = { factor, extent };
			bracket = extent < target ? { ...bracket, lo: probe } : { ...bracket, hi: probe };
			secant = factor + ((target - extent) * (factor - previous.factor)) / (extent - previous.extent);
			previous = probe;
		} else if (!(factor > 0)) break;
		else bracket = bracket.lo === undefined ? { ...bracket, below: factor } : { ...bracket, above: factor };
		if (step === MAX_STEPS || outOfReach(bracket)) break;
		factor = nextFactor(bracket, secant);
		result = apply(factor);
	}
	const misses = landed.map((tried) => tried.miss);
	return landed.length === 0 ? result : landed[misses.indexOf(Math.min(...misses))].result;
}
