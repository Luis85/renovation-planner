import { boundingBoxOf } from '../../../core/geometry/operations';
import type { BoundingBox } from '../../../core/geometry/BoundingBox';
import type { Point } from '../../../core/geometry/Point';

/** Everything zoom-to-fit needs of a zone: where it is. */
export interface ExtentCandidate {
	readonly points: readonly Point[];
}

/**
 * The extent `Shift+1` and `Shift+2` frame — the union of these zones' bounding boxes, or
 * `null` when there is nothing to frame.
 *
 * It goes through Core's `boundingBoxOf` rather than scanning coordinates here, because
 * "the box around these points" already has one definition and a second one in the
 * presentation layer would be free to disagree with it.
 *
 * **`boundingBoxOf` is the ONLY gate, and `createPolygon` is deliberately not a second
 * one.** The first draft validated each zone as a polygon first, which read as belt and
 * braces and was in fact a DEAD branch: `validatePolygonPoints` refuses exactly the empty
 * and non-finite cases `boundingBoxOf` refuses, and it refuses them first — so the box's
 * own failure arm could never be reached, and no test could ever have covered it. Framing
 * is also a weaker question than well-formedness: a stored zone that no longer closes into
 * a polygon still has coordinates, and a user reaching for zoom-to-fit wants to SEE it
 * rather than have it silently dropped from the view.
 *
 * A zone the box refuses is skipped rather than fatal, for the same reason: failing the
 * whole gesture over one unusable entry would deny the user the view of every zone that is
 * fine. `null` therefore means "nothing framable at all", never "something was wrong".
 */
export function boundsOfZones(zones: readonly ExtentCandidate[]): BoundingBox | null {
	let union: BoundingBox | null = null;
	for (const zone of zones) {
		const box = boundingBoxOf(zone);
		if (!box.ok) continue;
		union = union === null ? box.value : {
			min: { x: Math.min(union.min.x, box.value.min.x), y: Math.min(union.min.y, box.value.min.y) },
			max: { x: Math.max(union.max.x, box.value.max.x), y: Math.max(union.max.y, box.value.max.y) },
		};
	}
	return union;
}
