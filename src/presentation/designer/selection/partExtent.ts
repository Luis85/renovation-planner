import type { CurvedPolygon } from '../../../core/geometry/CurvedPolygon';
import type { Point } from '../../../core/geometry/Point';
import { boundingBoxOf } from '../../../core/geometry/operations';
import type { ValidationError } from '../../../core/errors/AppError';
import { err, unwrap, type Result } from '../../../core/result/Result';
import { solveScale } from '../../../domain/asset/scaleSolve';
import type { AssetShape } from '../../../domain/asset/AssetShape';
import { outlineOf, partNotFound, resizeBox, type OutlinePart } from '../../../domain/asset/shapeEdits';

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
 * The factor is SOLVED rather than divided, because `resizeBox` carries bulges — `solveScale` in
 * `domain/asset/` owns that loop and the ceilings it has, and the whole-design Set dimensions path
 * (`scaleDesignToDimensions`) solves through the same function, so the two cannot disagree about what
 * a typed size means.
 */
export function resizeToExtent(
	shape: AssetShape,
	part: OutlinePart,
	axis: 'width' | 'depth',
	target: number,
): Result<AssetShape, ValidationError> {
	return withPartBox(shape, part, (start) =>
		solveScale({
			start: start[axis],
			target,
			apply: (factor) =>
				resizeBox(shape, part, axis === 'width' ? { sx: factor, sy: 1 } : { sx: 1, sy: factor }, start.centre),
			// The part is there: `resizeBox` just answered it.
			measure: (resized) => partBox(outlineOf(resized, part) as CurvedPolygon)[axis],
		}),
	);
}
