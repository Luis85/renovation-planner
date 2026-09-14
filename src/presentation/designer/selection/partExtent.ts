import type { CurvedPolygon } from '../../../core/geometry/CurvedPolygon';
import type { Point } from '../../../core/geometry/Point';
import { boundingBoxOf } from '../../../core/geometry/operations';
import type { ValidationError } from '../../../core/errors/AppError';
import { err, unwrap, type Result } from '../../../core/result/Result';
import type { AssetShape } from '../../../domain/asset/AssetShape';
import { outlineOf, partNotFound, resizeBox, type OutlinePart } from '../../../domain/asset/shapeEdits';

/** A resize this close to the typed extent has landed it; far below the whole millimetres the inspector shows. */
const TOLERANCE_MM = 1e-6;
/** The first guess plus three secant corrections. */
const MAX_STEPS = 4;

/** An outline's CURVE-AWARE box: the extent its arcs reach, not only its corner points. Takes a validated outline. */
export function partBox(outline: CurvedPolygon): { readonly centre: Point; readonly width: number; readonly depth: number } {
	const box = unwrap(boundingBoxOf(outline));
	return {
		centre: { x: (box.min.x + box.max.x) / 2, y: (box.min.y + box.max.y) / 2 },
		width: box.max.x - box.min.x,
		depth: box.max.y - box.min.y,
	};
}

/**
 * `edit` over the part's box as it stands on `shape`, or `part-not-found` when `shape` no longer has the
 * part. What an inspector field builds its edit through, so a centre or a rotation origin is measured on
 * the shape the edit is HANDED rather than on the one last rendered.
 */
export function withPartBox(
	shape: AssetShape,
	part: OutlinePart,
	edit: (box: ReturnType<typeof partBox>) => Result<AssetShape, ValidationError>,
): Result<AssetShape, ValidationError> {
	const outline = outlineOf(shape, part);
	return outline === null ? err(partNotFound(part)) : edit(partBox(outline));
}

/**
 * One part resized along one axis about its box centre so its curve-aware extent is `target` (asset
 * designer symbols spec, "Inspector for the selection").
 *
 * `resizeBox` carries bulges, so an arc keeps bowing by a sagitta that follows its CHORD rather than the
 * factor: typed / current lands a straight outline exactly and misses a curved one — the toilet bowl's
 * Depth 900 as a plain factor measures 596. So the factor is solved for, by a secant over the measured
 * extent: exact at the first step whenever the extent is linear in the factor, and within `TOLERANCE_MM`
 * in a few more for an arc whose chord turns with the scale.
 *
 * **Some extents cannot be reached at all.** Arcs keep their bulges, so a four-arc circle cannot be
 * narrowed below about a fifth of its diameter with a positive factor, and the secant can step past zero
 * on the way. A step past zero is halved toward zero instead (a negative factor is a mirror, which
 * `resizeBox` refuses), and the answer is the NEAREST resize that landed — a part as close to the typed
 * extent as the tries reached, never a refusal worded as a scale to nothing. A non-positive target still
 * refuses as `invalid-scale`, because its very first factor does.
 *
 * ponytail: at most `MAX_STEPS` resizes; an outline that needed more lands near rather than on the typed value.
 */
export function resizeToExtent(
	shape: AssetShape,
	part: OutlinePart,
	axis: 'width' | 'depth',
	target: number,
): Result<AssetShape, ValidationError> {
	return withPartBox(shape, part, (start) => {
		const resized = (factor: number): Result<AssetShape, ValidationError> =>
			resizeBox(shape, part, axis === 'width' ? { sx: factor, sy: 1 } : { sx: 1, sy: factor }, start.centre);
		const landed: { readonly result: Result<AssetShape, ValidationError>; readonly miss: number }[] = [];
		let previous = { factor: 1, extent: start[axis] };
		let factor = target / start[axis];
		let result = resized(factor);
		for (let step = 1; result.ok; step += 1) {
			// The part is there: `resizeBox` just answered it.
			const extent = partBox(outlineOf(result.value, part) as CurvedPolygon)[axis];
			landed.push({ result, miss: Math.abs(extent - target) });
			if (Math.abs(extent - target) <= TOLERANCE_MM || step === MAX_STEPS) break;
			const next = factor + ((target - extent) * (factor - previous.factor)) / (extent - previous.extent);
			previous = { factor, extent };
			factor = next > 0 ? next : factor / 2;
			result = resized(factor);
		}
		// The nearest resize that landed; the refusal only when none did.
		const misses = landed.map((tried) => tried.miss);
		return landed.length === 0 ? result : landed[misses.indexOf(Math.min(...misses))].result;
	});
}
