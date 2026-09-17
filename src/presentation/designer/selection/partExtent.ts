import type { BoundingBox } from '../../../core/geometry/BoundingBox';
import type { CurvedPolygon } from '../../../core/geometry/CurvedPolygon';
import type { Point } from '../../../core/geometry/Point';
import { boundingBoxOf } from '../../../core/geometry/operations';
import type { ValidationError } from '../../../core/errors/AppError';
import { err, unwrap, type Result } from '../../../core/result/Result';
import { assetError } from '../../../domain/asset/Asset.errors';
import { solveScale } from '../../../domain/asset/scaleSolve';
import type { AssetShape } from '../../../domain/asset/AssetShape';
import { detailBox } from '../../../domain/asset/detailEdits';
import { outlineOf, partNotFound, resizeBox, type OutlinePart } from '../../../domain/asset/shapeEdits';

/** What every inspector geometry field measures its part by. */
export interface PartBox {
	readonly centre: Point;
	readonly width: number;
	readonly depth: number;
}

const measure = (box: BoundingBox): PartBox => ({
	centre: { x: (box.min.x + box.max.x) / 2, y: (box.min.y + box.max.y) / 2 },
	width: box.max.x - box.min.x,
	depth: box.max.y - box.min.y,
});

/** An outline's CURVE-AWARE box: the extent its arcs reach, not only its corner points. Takes a validated outline. */
export function partBox(outline: CurvedPolygon): PartBox {
	return measure(unwrap(boundingBoxOf(outline)));
}

/**
 * The curve-aware box of whichever part `part` names — **an OPEN graphic included** (AD11) — or
 * `null` when the shape has no such part.
 *
 * A detail is measured through `detailBox`, the domain's own both-kinds box, rather than through a
 * second reading here: an open path's bulge array is one per SEGMENT, and handing it to
 * `boundingBoxOf` unchanged answers `curve-edge-count` and refuses every curved line. That function
 * already pads the absent wrap edge, and AD10's whole composition block measures through it, so
 * the inspector and an alignment cannot disagree about where a line is.
 *
 * `unwrap` for `partBox`'s reason: `detailBox` refuses only geometry `validateAssetShape` would
 * have refused, and every shape reaching here has been through it.
 */
export function partMeasure(shape: AssetShape, part: OutlinePart): PartBox | null {
	if (part.kind !== 'detail') {
		const outline = outlineOf(shape, part);
		return outline === null ? null : partBox(outline);
	}
	const detail = shape.details.find((found) => found.id === part.id);
	return detail === undefined ? null : measure(unwrap(detailBox(detail)));
}

/**
 * `edit` over the part's box as it stands on `shape`, or `part-not-found` when `shape` no longer has the
 * part. What an inspector field builds its edit through, so a centre or a rotation origin is measured on
 * the shape the edit is HANDED rather than on the one last rendered.
 */
export function withPartBox(
	shape: AssetShape,
	part: OutlinePart,
	edit: (box: PartBox) => Result<AssetShape, ValidationError>,
): Result<AssetShape, ValidationError> {
	const box = partMeasure(shape, part);
	return box === null ? err(partNotFound(part)) : edit(box);
}

/**
 * One part resized along one axis about its box centre so its curve-aware extent is `target` (asset
 * designer symbols spec, "Inspector for the selection").
 *
 * The factor is SOLVED rather than divided, because `resizeBox` carries bulges — `solveScale` in
 * `domain/asset/` owns that loop and the ceilings it has, and the whole-design Set dimensions path
 * (`scaleDesignToDimensions`) solves through the same function, so the two cannot disagree about what
 * a typed size means.
 *
 * **A zero extent is refused HERE so that the refusal names the right thing** (AD11). A scale about
 * the box centre multiplies the distance from that centre, and every point of a horizontal line is
 * zero from it along y — so no finite factor gives that axis any depth. Reachable only on an OPEN
 * graphic: a closed one must enclose an area (`validateDetail`), so both of its extents are positive.
 *
 * **What the guard buys is the SENTENCE, not the refusal**, and the first version of this paragraph
 * claimed otherwise — that `solveScale` *"would step factors forever against a measurement that never
 * moves"*. It would not, twice over: `solveScale` stops at `MAX_STEPS`, and it never takes a step at
 * all here, because its first factor is `target / 0` and `resizeBox` refuses a non-finite one. So
 * without this the user typing `400` into Depth is told *"a part cannot be scaled to nothing"* —
 * measured, by removing the guard and reading the message the inspector then shows — which describes
 * a value they did not type. C12 asks a control that cannot do what is asked to say why; a wrong why
 * is not a why.
 */
export function resizeToExtent(
	shape: AssetShape,
	part: OutlinePart,
	axis: 'width' | 'depth',
	target: number,
): Result<AssetShape, ValidationError> {
	return withPartBox(shape, part, (start) => {
		if (start[axis] === 0) {
			return err(assetError('extent-not-scalable', `This graphic has no ${axis}, so scaling cannot give it one.`));
		}
		return solveScale({
			start: start[axis],
			target,
			apply: (factor) =>
				resizeBox(shape, part, axis === 'width' ? { sx: factor, sy: 1 } : { sx: 1, sy: factor }, start.centre),
			// The part is there: `resizeBox` just answered it.
			measure: (resized) => (partMeasure(resized, part) as PartBox)[axis],
		});
	});
}
