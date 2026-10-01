/**
 * A location, in world units (millimeters — see `../units/WorldUnit.ts`). Never a
 * displacement: `Vector` is that.
 *
 * `__brand` is a phantom discriminant: never assigned, never read, and optional so no
 * object literal has to mention it — it carries no runtime value at all. Its only job is
 * to make `Point` incompatible with a branded coordinate type such as
 * `src/presentation/editor/viewport/Viewport.ts`'s `ScreenPoint` (`__brand: 'ScreenPoint'`),
 * which is otherwise the same two fields and would satisfy this interface structurally in
 * both directions — a screen pixel could then be passed anywhere world millimetres are
 * expected. `tests/presentation/editor/type-safety.test-d.ts` is what checks that this
 * stays true, rather than this paragraph.
 */
export interface Point {
	readonly x: number;
	readonly y: number;
	readonly __brand?: undefined;
}

/**
 * The first point with a coordinate that is not finite, or `null` when every one of them is.
 *
 * Shared by `createPolygon` and `createCurvedPath` rather than written twice: the two types
 * refuse a NaN or an Infinity for the same reason and in the same words, and `npm run analyze`
 * reported the second copy as a clone group the day it appeared. The two callers still own their
 * own ERROR CODES — a polygon's and a path's refusals are different facts about different
 * shapes — so what is shared is the scan and not the message.
 */
export function firstNonFinitePoint(points: readonly Point[]): Point | null {
	return points.find((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y)) ?? null;
}
