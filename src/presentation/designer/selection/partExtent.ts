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
 * One part resized along one axis about its box centre so its curve-aware extent is `target` (asset
 * designer symbols spec, "Inspector for the selection").
 *
 * `resizeBox` carries bulges, so an arc keeps bowing by a sagitta that follows its CHORD rather than the
 * factor: typed / current lands a straight outline exactly and misses a curved one — the toilet bowl's
 * Depth 900 as a plain factor measures 596. So the factor is solved for, by a secant over the measured
 * extent: exact at the first step whenever the extent is linear in the factor, and within `TOLERANCE_MM`
 * in a few more for an arc whose chord turns with the scale.
 *
 * ponytail: at most `MAX_STEPS` resizes, then the last one is answered as it stands; an outline that
 * needed more would land near rather than on the typed value.
 */
export function resizeToExtent(
	shape: AssetShape,
	part: OutlinePart,
	axis: 'width' | 'depth',
	target: number,
): Result<AssetShape, ValidationError> {
	const outline = outlineOf(shape, part);
	if (outline === null) return err(partNotFound(part));
	const start = partBox(outline);
	const resized = (factor: number): Result<AssetShape, ValidationError> =>
		resizeBox(shape, part, axis === 'width' ? { sx: factor, sy: 1 } : { sx: 1, sy: factor }, start.centre);
	let previous = { factor: 1, extent: start[axis] };
	let factor = target / start[axis];
	let result = resized(factor);
	for (let step = 1; step < MAX_STEPS && result.ok; step += 1) {
		// The part is there: `resizeBox` just answered it.
		const extent = partBox(outlineOf(result.value, part) as CurvedPolygon)[axis];
		if (Math.abs(extent - target) <= TOLERANCE_MM) break;
		const next = factor + ((target - extent) * (factor - previous.factor)) / (extent - previous.extent);
		previous = { factor, extent };
		factor = next;
		result = resized(factor);
	}
	return result;
}
